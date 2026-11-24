import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control": "no-store", Pragma: "no-cache" };

export async function POST(request: NextRequest, context: Context) {
  const session = verifySessionToken(request.cookies.get("otw_session")?.value);
  if (!session) return NextResponse.json({ error: "Sign in is required." }, { status: 401, headers });
  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).origin !== new URL(request.url).origin) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers });
  } catch { return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers }); }
  const { id } = await context.params;
  if (!uuid.test(id)) return NextResponse.json({ error: "A valid booking ID is required." }, { status: 400, headers });
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Production routing is not configured. No fare quote was created.", code: "ROUTING_NOT_CONFIGURED" }, { status: 503, headers });

  let client: PoolClient | undefined;
  try {
    client = await getDatabasePool().connect();
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT b.id,b.vehicle_type,b.status,b.pickup_latitude,b.pickup_longitude,b.destination_latitude,b.destination_longitude " +
      "FROM bookings b JOIN service_zones z ON z.country_code='PK' AND lower(z.city_name)='lahore' AND z.active=true " +
      "AND ST_Covers(z.boundary::geometry,ST_SetSRID(ST_MakePoint(b.pickup_longitude,b.pickup_latitude),4326)) " +
      "AND ST_Covers(z.boundary::geometry,ST_SetSRID(ST_MakePoint(b.destination_longitude,b.destination_latitude),4326)) " +
      "WHERE b.id=$1 AND b.passenger_account_id=$2 FOR UPDATE OF b", [id, session.sub]);
    const booking = result.rows[0] as { vehicle_type:string; status:string; pickup_latitude:number; pickup_longitude:number; destination_latitude:number; destination_longitude:number } | undefined;
    if (!booking) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Booking not found or its route is outside the approved Lahore service boundary.", code: "OUTSIDE_SERVICE_BOUNDARY" }, { status: 404, headers }); }
    if (!["requested","matching"].includes(booking.status)) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Booking is not accepting a fare quote.", code: "BOOKING_STATE_INVALID" }, { status: 409, headers }); }
    if (booking.vehicle_type === "rickshaw") { await client.query("ROLLBACK"); return NextResponse.json({ error: "Rickshaw routing has not been certified. No proxy route or fare will be calculated.", code: "VEHICLE_ROUTING_UNSUPPORTED" }, { status: 422, headers }); }

    const routed = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { "Content-Type":"application/json", "X-Goog-Api-Key":apiKey, "X-Goog-FieldMask":"routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline" },
      body: JSON.stringify({
        origin:{location:{latLng:{latitude:Number(booking.pickup_latitude),longitude:Number(booking.pickup_longitude)}}},
        destination:{location:{latLng:{latitude:Number(booking.destination_latitude),longitude:Number(booking.destination_longitude)}}},
        travelMode:booking.vehicle_type==="bike"?"TWO_WHEELER":"DRIVE",
        routingPreference:"TRAFFIC_AWARE",polylineQuality:"OVERVIEW"
      })
    });
    if (!routed.ok) { await client.query("ROLLBACK"); return NextResponse.json({ error:"Routing provider failed; no fare quote was created.",code:"ROUTE_UNAVAILABLE"},{status:503,headers}); }
    const routeBody = await routed.json() as {routes?:Array<{distanceMeters?:number;duration?:string;polyline?:{encodedPolyline?:string}}>};
    const route = routeBody.routes?.[0];
    const distance = Number(route?.distanceMeters);
    const duration = Math.ceil(Number(String(route?.duration ?? "").replace(/s$/,"")));
    if (!Number.isSafeInteger(distance)||distance<=0||!Number.isSafeInteger(duration)||duration<=0||!route?.polyline?.encodedPolyline) {
      await client.query("ROLLBACK"); return NextResponse.json({error:"Routing provider returned incomplete route data.",code:"INVALID_ROUTE_RESPONSE"},{status:502,headers});
    }

    const policyResult = await client.query(
      "SELECT id,version,negotiation_window_seconds FROM fare_policies WHERE country_code='PK' AND city_slug='lahore' AND vehicle_type=$1 AND currency_code='PKR' AND active=true AND effective_from<=now() AND (effective_until IS NULL OR effective_until>now()) FOR SHARE",
      [booking.vehicle_type]);
    const policy = policyResult.rows[0] as {id:string;version:number;negotiation_window_seconds:number}|undefined;
    if (!policy) { await client.query("ROLLBACK"); return NextResponse.json({error:"No approved active Lahore fare policy exists for this vehicle type.",code:"FARE_POLICY_NOT_ACTIVE"},{status:409,headers}); }

    const quoteResult = await client.query(
      "WITH p AS (SELECT * FROM fare_policies WHERE id=$1), c AS (SELECT GREATEST(p.minimum_fare,p.base_fare+($2::numeric/1000)*p.per_km_rate+($3::numeric/60)*p.per_minute_rate) AS raw,p.* FROM p) " +
      "INSERT INTO fare_quotes (booking_id,fare_policy_id,route_provider,route_distance_m,route_duration_s,base_component,distance_component,time_component,demand_multiplier,recommended_amount,minimum_acceptable_amount,suggested_maximum_amount,expires_at) " +
      "SELECT $4,p.id,'google_routes',$2,$3,p.base_fare,($2::numeric/1000)*p.per_km_rate,($3::numeric/60)*p.per_minute_rate,1," +
      "CEIL(c.raw/p.rounding_increment)*p.rounding_increment,GREATEST(p.minimum_fare,p.passenger_bid_floor),p.negotiation_ceiling,now()+($5::text||' seconds')::interval " +
      "FROM p CROSS JOIN c WHERE c.negotiation_ceiling>=CEIL(c.raw/c.rounding_increment)*c.rounding_increment RETURNING id,route_distance_m,route_duration_s,recommended_amount,minimum_acceptable_amount,suggested_maximum_amount,currency_code,expires_at",
      [policy.id,distance,duration,id,policy.negotiation_window_seconds]);
    if (!quoteResult.rows[0]) { await client.query("ROLLBACK"); return NextResponse.json({error:"The approved fare policy does not cover this route price. Operator calibration is required.",code:"FARE_POLICY_RANGE_INVALID"},{status:409,headers}); }
    await client.query("INSERT INTO booking_negotiation_events (booking_id,actor_account_id,event_type,event_metadata) VALUES ($1,$2,'quote_created',$3::jsonb)",
      [id,session.sub,JSON.stringify({fare_quote_id:quoteResult.rows[0].id,policy_version:policy.version,route_provider:"google_routes"})]);
    await client.query("COMMIT");
    return NextResponse.json({quote:quoteResult.rows[0],route:{encodedPolyline:route.polyline.encodedPolyline},pricing:{currency:"PKR",explanation:"Reference estimate uses the approved route, estimated duration and active policy. Captain approach cost, tolls and other charges are excluded unless separately verified."}},{status:201,headers});
  } catch {
    if (client) await client.query("ROLLBACK").catch(()=>undefined);
    return NextResponse.json({error:"Fare quote could not be created.",code:"FARE_QUOTE_FAILED"},{status:503,headers});
  } finally { client?.release(); }
}
