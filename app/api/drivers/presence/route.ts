import {NextRequest,NextResponse} from "next/server";
import {getDatabasePool} from "@/lib/db";
import {verifySessionToken} from "@/lib/session";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store",Pragma:"no-cache"};
export async function POST(request:NextRequest){
 const session=verifySessionToken(request.cookies.get("otw_session")?.value);if(!session)return NextResponse.json({error:"Sign in is required."},{status:401,headers});
 const origin=request.headers.get("origin");try{if(!origin||new URL(origin).origin!==new URL(request.url).origin)return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});}catch{return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});}
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Valid JSON required."},{status:400,headers});}
 const p=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const lat=p.latitude,lon=p.longitude,accuracy=p.accuracyM,heading=p.headingDegrees;
 const recordedAt=typeof p.recordedAt==="string"?new Date(p.recordedAt):new Date();
 if(typeof lat!=="number"||!Number.isFinite(lat)||Math.abs(lat)>90||typeof lon!=="number"||!Number.isFinite(lon)||Math.abs(lon)>180||
 typeof accuracy!=="number"||!Number.isFinite(accuracy)||accuracy<0||accuracy>100||
 (heading!==undefined&&heading!==null&&(typeof heading!=="number"||!Number.isFinite(heading)||heading<0||heading>=360))||
 !Number.isFinite(recordedAt.getTime())||recordedAt.getTime()>Date.now()+30000||recordedAt.getTime()<Date.now()-180000)
 return NextResponse.json({error:"Location fix is invalid, inaccurate or stale."},{status:422,headers});
 try{
  const result=await getDatabasePool().query(
   "INSERT INTO driver_presence_updates (driver_account_id,location,accuracy_m,heading_degrees,recorded_at,expires_at) " +
   "SELECT d.account_id,ST_SetSRID(ST_MakePoint($2,$3),4326)::geography,$4,$5,$6,now()+INTERVAL '120 seconds' " +
   "FROM driver_profiles d JOIN account_roles ar ON ar.account_id=d.account_id AND ar.role='driver' " +
   "WHERE d.account_id=$1 AND d.verification_status='verified' AND d.availability_status='available' " +
   "ON CONFLICT (driver_account_id) DO UPDATE SET location=EXCLUDED.location,accuracy_m=EXCLUDED.accuracy_m,heading_degrees=EXCLUDED.heading_degrees,recorded_at=EXCLUDED.recorded_at,received_at=now(),expires_at=now()+INTERVAL '120 seconds' " +
   "RETURNING driver_account_id,recorded_at,expires_at",
   [session.sub,lon,lat,accuracy,heading??null,recordedAt]);
  if(!result.rows[0])return NextResponse.json({error:"Only a verified captain who is online and available can share dispatch presence."},{status:409,headers});
  return NextResponse.json({presence:result.rows[0]},{status:201,headers});
 }catch{return NextResponse.json({error:"Driver presence could not be updated."},{status:503,headers});}
}
export async function DELETE(request:NextRequest){
 const session=verifySessionToken(request.cookies.get("otw_session")?.value);if(!session)return NextResponse.json({error:"Sign in is required."},{status:401,headers});
 const origin=request.headers.get("origin");try{if(!origin||new URL(origin).origin!==new URL(request.url).origin)return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});}catch{return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});}
 try{await getDatabasePool().query("DELETE FROM driver_presence_updates WHERE driver_account_id=$1",[session.sub]);return NextResponse.json({cleared:true},{headers});}
 catch{return NextResponse.json({error:"Driver presence could not be cleared."},{status:503,headers});}
}
