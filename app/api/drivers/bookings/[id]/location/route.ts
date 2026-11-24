import {NextRequest,NextResponse} from "next/server";
import type {PoolClient} from "pg";
import {getDatabasePool} from "@/lib/db";
import {verifySessionToken} from "@/lib/session";
export const runtime="nodejs";export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers={"Cache-Control":"no-store",Pragma:"no-cache"};
export async function POST(request:NextRequest,context:Context){
 const session=verifySessionToken(request.cookies.get("otw_session")?.value);if(!session)return NextResponse.json({error:"Sign in is required."},{status:401,headers});
 const origin=request.headers.get("origin");try{if(!origin||new URL(origin).origin!==new URL(request.url).origin)return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});}catch{return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});}
 const {id}=await context.params;if(!uuid.test(id))return NextResponse.json({error:"Valid booking ID required."},{status:400,headers});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Valid JSON required."},{status:400,headers});}
 const p=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const lat=p.latitude,lon=p.longitude,accuracy=p.accuracyM,heading=p.headingDegrees,speed=p.speedMps;
 const recordedAt=typeof p.recordedAt==="string"?new Date(p.recordedAt):new Date();
 if(typeof lat!=="number"||!Number.isFinite(lat)||Math.abs(lat)>90||typeof lon!=="number"||!Number.isFinite(lon)||Math.abs(lon)>180||
 typeof accuracy!=="number"||!Number.isFinite(accuracy)||accuracy<0||accuracy>100||
 (heading!==undefined&&heading!==null&&(typeof heading!=="number"||!Number.isFinite(heading)||heading<0||heading>=360))||
 (speed!==undefined&&speed!==null&&(typeof speed!=="number"||!Number.isFinite(speed)||speed<0||speed>70))||
 !Number.isFinite(recordedAt.getTime())||recordedAt.getTime()>Date.now()+30000||recordedAt.getTime()<Date.now()-120000)
 return NextResponse.json({error:"Location fix is invalid, inaccurate or stale."},{status:422,headers});
 let client:PoolClient|undefined;
 try{
  client=await getDatabasePool().connect();await client.query("BEGIN");
  const b=await client.query("SELECT status,driver_account_id FROM bookings WHERE id=$1 FOR UPDATE",[id]);
  const booking=b.rows[0] as {status:string;driver_account_id:string|null}|undefined;
  if(!booking||booking.driver_account_id!==session.sub){await client.query("ROLLBACK");return NextResponse.json({error:"This trip is not assigned to your account."},{status:403,headers});}
  if(!["driver_assigned","driver_arriving","in_progress"].includes(booking.status)){await client.query("ROLLBACK");return NextResponse.json({error:"Location sharing is only enabled for an assigned active trip."},{status:409,headers});}
  const recent=await client.query("SELECT received_at FROM trip_location_updates WHERE booking_id=$1 ORDER BY received_at DESC LIMIT 1",[id]);
  if(recent.rows[0]&&Date.now()-new Date(recent.rows[0].received_at).getTime()<2000){await client.query("ROLLBACK");return NextResponse.json({accepted:false,throttled:true},{status:202,headers});}
  const inserted=await client.query(
   "INSERT INTO trip_location_updates (booking_id,driver_account_id,location,accuracy_m,heading_degrees,speed_mps,recorded_at) VALUES ($1,$2,ST_SetSRID(ST_MakePoint($3,$4),4326)::geography,$5,$6,$7,$8) RETURNING id,recorded_at,received_at",
   [id,session.sub,lon,lat,accuracy,heading??null,speed??null,recordedAt]);
  await client.query("COMMIT");return NextResponse.json({accepted:true,locationUpdate:inserted.rows[0]},{status:201,headers});
 }catch{if(client)await client.query("ROLLBACK").catch(()=>undefined);return NextResponse.json({error:"Location update could not be stored."},{status:503,headers});}
 finally{client?.release();}
}
