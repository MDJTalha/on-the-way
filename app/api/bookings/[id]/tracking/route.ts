import {NextRequest,NextResponse} from "next/server";
import {getDatabasePool} from "@/lib/db";
import {verifySessionToken} from "@/lib/session";
export const runtime="nodejs";export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers={"Cache-Control":"no-store",Pragma:"no-cache"};
export async function GET(request:NextRequest,context:Context){
 const session=verifySessionToken(request.cookies.get("otw_session")?.value);if(!session)return NextResponse.json({error:"Sign in is required."},{status:401,headers});
 const {id}=await context.params;if(!uuid.test(id))return NextResponse.json({error:"Valid booking ID required."},{status:400,headers});
 try{
  const booking=await getDatabasePool().query("SELECT id,status,driver_account_id FROM bookings WHERE id=$1 AND passenger_account_id=$2",[id,session.sub]);
  if(!booking.rows[0])return NextResponse.json({error:"Booking not found."},{status:404,headers});
  if(!booking.rows[0].driver_account_id||!["driver_assigned","driver_arriving","in_progress"].includes(String(booking.rows[0].status)))return NextResponse.json({trackingAvailable:false,status:booking.rows[0].status},{headers});
  const result=await getDatabasePool().query(
   "SELECT ST_Y(location::geometry) AS latitude,ST_X(location::geometry) AS longitude,accuracy_m,heading_degrees,speed_mps,recorded_at,received_at " +
   "FROM trip_location_updates WHERE booking_id=$1 AND driver_account_id=$2 ORDER BY recorded_at DESC LIMIT 1",[id,booking.rows[0].driver_account_id]);
  const location=result.rows[0] as {latitude:number;longitude:number;accuracy_m:number;heading_degrees:number|null;speed_mps:number|null;recorded_at:Date;received_at:Date}|undefined;
  const fresh=location&&Date.now()-new Date(location.received_at).getTime()<=30000;
  return NextResponse.json({trackingAvailable:Boolean(fresh),status:booking.rows[0].status,location:fresh?location:null},{headers});
 }catch{return NextResponse.json({error:"Trip tracking is unavailable."},{status:503,headers});}
}
