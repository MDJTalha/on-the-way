import {NextRequest,NextResponse} from "next/server";
import type {PoolClient} from "pg";
import {getDatabasePool} from "@/lib/db";
import {verifySessionToken} from "@/lib/session";
export const runtime="nodejs";export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const types=new Set(["sos","route_deviation","harassment","accident","medical","vehicle_issue","other"]);
const headers={"Cache-Control":"no-store",Pragma:"no-cache"};
export async function POST(request:NextRequest,context:Context){
 const session=verifySessionToken(request.cookies.get("otw_session")?.value);if(!session)return NextResponse.json({error:"Sign in is required."},{status:401,headers});
 const origin=request.headers.get("origin");try{if(!origin||new URL(origin).origin!==new URL(request.url).origin)return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});}catch{return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});}
 const {id}=await context.params;if(!uuid.test(id))return NextResponse.json({error:"Valid booking ID required."},{status:400,headers});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Valid JSON required."},{status:400,headers});}
 const p=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const type=typeof p.incidentType==="string"?p.incidentType:"other";
 const severity=type==="sos"?"critical":typeof p.severity==="string"?p.severity:"medium";
 const description=typeof p.description==="string"?p.description.trim():"";
 const lat=p.latitude,lon=p.longitude;
 if(!types.has(type)||!["low","medium","high","critical"].includes(severity)||description.length>2000||
 ((lat===undefined)!==(lon===undefined))||(lat!==undefined&&(typeof lat!=="number"||!Number.isFinite(lat)||Math.abs(lat)>90||typeof lon!=="number"||!Number.isFinite(lon)||Math.abs(lon)>180)))
 return NextResponse.json({error:"Incident type, severity, description or location is invalid."},{status:422,headers});
 let client:PoolClient|undefined;
 try{
  client=await getDatabasePool().connect();await client.query("BEGIN");
  const b=await client.query("SELECT passenger_account_id,driver_account_id,status FROM bookings WHERE id=$1 AND (passenger_account_id=$2 OR driver_account_id=$2) FOR UPDATE",[id,session.sub]);
  const booking=b.rows[0] as {passenger_account_id:string;driver_account_id:string|null;status:string}|undefined;
  if(!booking){await client.query("ROLLBACK");return NextResponse.json({error:"Booking not found."},{status:404,headers});}
  if(!["driver_assigned","driver_arriving","in_progress"].includes(booking.status)){await client.query("ROLLBACK");return NextResponse.json({error:"Safety incident reporting is available for an assigned active trip. For immediate danger, call local emergency services directly."},{status:409,headers});}
  if(type==="sos"){
   const open=await client.query("SELECT id,status,created_at FROM trip_safety_incidents WHERE booking_id=$1 AND reported_by=$2 AND incident_type='sos' AND status IN ('open','acknowledged','investigating') ORDER BY created_at DESC LIMIT 1 FOR UPDATE",[id,session.sub]);
   if(open.rows[0]){await client.query("COMMIT");return NextResponse.json({incident:open.rows[0],replayed:true,message:"An SOS case is already open for this trip. If immediate danger exists, call 15 or 1122 directly."},{headers});}
  }
  const inserted=await client.query(
   "INSERT INTO trip_safety_incidents (booking_id,reported_by,incident_type,severity,description,location) VALUES ($1,$2,$3,$4,$5,CASE WHEN $6::double precision IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint($7,$6),4326)::geography END) RETURNING id,incident_type,severity,status,created_at",
   [id,session.sub,type,severity,description||null,lat??null,lon??null]);
  await client.query("INSERT INTO trip_safety_incident_events (incident_id,actor_account_id,event_type,next_status,event_metadata) VALUES ($1,$2,'incident_reported','open',$3::jsonb)",[inserted.rows[0].id,session.sub,JSON.stringify({incident_type:type,severity})]);
  await client.query("COMMIT");
  return NextResponse.json({incident:inserted.rows[0],message:type==="sos"?"SOS incident recorded. This app does not automatically dispatch police or ambulance services. Call 15 for police or 1122 for rescue/medical emergencies.":"Safety report recorded for operator review."},{status:201,headers});
 }catch{if(client)await client.query("ROLLBACK").catch(()=>undefined);return NextResponse.json({error:"Safety incident could not be recorded."},{status:503,headers});}
 finally{client?.release();}
}
