import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/db";
import { requireOperator, validateSameOrigin } from "@/lib/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validGeoJson(value: unknown): value is { type: "MultiPolygon"; coordinates: unknown[] } {
  if (!value || typeof value !== "object") return false;
  const geometry = value as Record<string, unknown>;
  return geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0;
}

export async function GET(request: NextRequest) {
  const auth = await requireOperator(request);
  if (auth.response) return auth.response;
  const status = request.nextUrl.searchParams.get("status") ?? "all";
  if (!["active", "inactive", "all"].includes(status)) return NextResponse.json({ error: "Unsupported service-zone status filter." }, { status: 400, headers: noStore });
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "100");
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 100;
  try {
    const result = await getDatabasePool().query(
      "SELECT id, country_code, city_name, zone_name, currency_code, active, boundary IS NOT NULL AS has_boundary, created_at, updated_at " +
      "FROM service_zones " + (status === "all" ? "" : "WHERE active = $1 ") +
      "ORDER BY country_code, city_name, zone_name LIMIT $" + (status === "all" ? "1" : "2"),
      status === "all" ? [limit] : [status === "active", limit],
    );
    return NextResponse.json({ zones: result.rows, count: result.rowCount ?? result.rows.length, canManage: auth.identity.role === "platform_admin" }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Service-zone records are unavailable." }, { status: 503, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireOperator(request);
  if (auth.response) return auth.response;
  if (auth.identity.role !== "platform_admin") return NextResponse.json({ error: "Only a platform administrator can create global service zones." }, { status: 403, headers: noStore });
  if (!validateSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers: noStore });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: noStore }); }
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const countryCode = typeof payload.countryCode === "string" ? payload.countryCode.trim().toUpperCase() : "";
  const cityName = typeof payload.cityName === "string" ? payload.cityName.trim() : "";
  const zoneName = typeof payload.zoneName === "string" ? payload.zoneName.trim() : "";
  const currencyCode = typeof payload.currencyCode === "string" ? payload.currencyCode.trim().toUpperCase() : "";
  if (!/^[A-Z]{2}$/.test(countryCode) || cityName.length < 2 || cityName.length > 100 ||
      zoneName.length < 2 || zoneName.length > 100 || !/^[A-Z]{3}$/.test(currencyCode) || !validGeoJson(payload.boundary)) {
    return NextResponse.json({ error: "Provide a valid ISO country code, city, zone name, ISO currency code and GeoJSON MultiPolygon boundary." }, { status: 422, headers: noStore });
  }
  let client: PoolClient | undefined;
  try {
    client = await getDatabasePool().connect();
    await client.query("BEGIN");
    const inserted = await client.query(
      "INSERT INTO service_zones (country_code, city_name, zone_name, boundary, currency_code, active, created_by) " +
      "SELECT $1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)::geography, $5, false, $6 " +
      "WHERE ST_GeometryType(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)) = 'ST_MultiPolygon' " +
      "AND ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)) " +
      "AND NOT ST_IsEmpty(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)) " +
      "AND ST_Area(ST_SetSRID(ST_GeomFromGeoJSON($4), 4326)::geography) > 100 " +
      "RETURNING id, country_code, city_name, zone_name, currency_code, active, boundary IS NOT NULL AS has_boundary, created_at, updated_at",
      [countryCode, cityName, zoneName, JSON.stringify(payload.boundary), currencyCode, auth.identity.accountId],
    );
    if (!inserted.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "The boundary must be a valid, non-empty GeoJSON MultiPolygon with a measurable area." }, { status: 422, headers: noStore });
    }
    const zone = inserted.rows[0];
    await client.query(
      "INSERT INTO service_zone_events (service_zone_id, actor_account_id, event_type, new_state) VALUES ($1, $2, 'zone_created', $3::jsonb)",
      [zone.id, auth.identity.accountId, JSON.stringify({ country_code: countryCode, city_name: cityName, zone_name: zoneName, currency_code: currencyCode, active: false, has_boundary: true })],
    );
    await client.query("COMMIT");
    return NextResponse.json({ zone, message: "Service zone created inactive. An authorized operator must explicitly activate it after market and boundary checks." }, { status: 201, headers: noStore });
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    if ((error as { code?: string })?.code === "23505") return NextResponse.json({ error: "A service zone with this country, city and name already exists." }, { status: 409, headers: noStore });
    return NextResponse.json({ error: "Service zone could not be created." }, { status: 503, headers: noStore });
  } finally {
    client?.release();
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireOperator(request);
  if (auth.response) return auth.response;
  if (auth.identity.role !== "platform_admin") return NextResponse.json({ error: "Only a platform administrator can activate or deactivate global service zones." }, { status: 403, headers: noStore });
  if (!validateSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers: noStore });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: noStore }); }
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const zoneId = payload.zoneId;
  const active = payload.active;
  const reference = typeof payload.activationReference === "string" ? payload.activationReference.trim() : "";
  if (typeof zoneId !== "string" || !uuidPattern.test(zoneId) || typeof active !== "boolean") return NextResponse.json({ error: "A valid service-zone ID and active boolean are required." }, { status: 422, headers: noStore });
  if (active && (reference.length < 6 || reference.length > 120)) return NextResponse.json({ error: "An external market-readiness reference of 6–120 characters is required before activation." }, { status: 422, headers: noStore });
  let client: PoolClient | undefined;
  try {
    client = await getDatabasePool().connect();
    await client.query("BEGIN");
    const locked = await client.query(
      "SELECT id, country_code, city_name, zone_name, currency_code, active, boundary IS NOT NULL AS has_boundary, CASE WHEN boundary IS NULL THEN false ELSE ST_GeometryType(boundary::geometry) = 'ST_MultiPolygon' AND ST_IsValid(boundary::geometry) AND NOT ST_IsEmpty(boundary::geometry) AND ST_Area(boundary) > 100 END AS boundary_valid FROM service_zones WHERE id = $1 FOR UPDATE",
      [zoneId],
    );
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Service zone not found." }, { status: 404, headers: noStore });
    }
    const current = locked.rows[0];
    if (current.active === active) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Service zone already has the requested status." }, { status: 409, headers: noStore });
    }
    if (active && !current.boundary_valid) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "A valid, non-empty mapped MultiPolygon boundary is required before activation." }, { status: 409, headers: noStore });
    }
    const updated = await client.query(
      "UPDATE service_zones SET active = $2, updated_at = now() WHERE id = $1 RETURNING id, country_code, city_name, zone_name, currency_code, active, boundary IS NOT NULL AS has_boundary, created_at, updated_at",
      [zoneId, active],
    );
    await client.query(
      "INSERT INTO service_zone_events (service_zone_id, actor_account_id, event_type, previous_state, new_state, event_metadata) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)",
      [zoneId, auth.identity.accountId, active ? "zone_activated" : "zone_deactivated",
        JSON.stringify({ active: current.active }), JSON.stringify({ active, country_code: current.country_code, city_name: current.city_name, zone_name: current.zone_name }),
        JSON.stringify({ activation_reference: active ? reference : null, operator_role: auth.identity.role })],
    );
    await client.query("COMMIT");
    return NextResponse.json({ zone: updated.rows[0], message: active ? "Service zone activated. This does not enable dispatch or passenger bookings." : "Service zone deactivated." }, { headers: noStore });
  } catch {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    return NextResponse.json({ error: "Service-zone status could not be changed." }, { status: 503, headers: noStore });
  } finally {
    client?.release();
  }
}
