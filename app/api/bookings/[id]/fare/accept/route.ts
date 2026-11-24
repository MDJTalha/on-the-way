import { NextRequest,NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";

export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers={"Cache-Control":"no-store",Pragma:"no-cache"};

export async function POST(request:NextRequest,context:Context){
 const session=verifySessionToken(request.cookies.get("otw_session")?.value);
 if(!session)return NextResponse.json({error:"Sign in is required."},{status:401,headers});
 const origin=request.headers.get("origin");
 try{if(!origin||new URL(origin).origin!==new URL(request.url).origin)return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});}
 catch{return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});}
 const {id}=await context.params;
 if(!uuid.test(id))return NextResponse.json({error:"A valid booking ID is required."},{status:400,headers});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Request body must be valid JSON."},{status:400,headers});}
 const offerId=body&&typeof body==="object"?(body as Record<string,unknown>).offerId:"";
 if(typeof offerId!=="string"||!uuid.test(offerId))return NextResponse.json({error:"A valid offer ID is required."},{status:422,headers});
 let client:PoolClient|undefined;
 try{
  client=await getDatabasePool().connect();await client.query("BEGIN");
  const b=await client.query("SELECT id,passenger_account_id,status,accepted_fare_offer_id FROM bookings WHERE id=$1 FOR UPDATE",[id]);
  const booking=b.rows[0] as {passenger_account_id:string;status:string;accepted_fare_offer_id:string|null}|undefined;
  if(!booking||booking.passenger_account_id!==session.sub){await client.query("ROLLBACK");return NextResponse.json({error:"Booking not found."},{status:404,headers});}
  if(booking.accepted_fare_offer_id){if(booking.accepted_fare_offer_id===offerId){await client.query("COMMIT");return NextResponse.json({accepted:true,replayed:true},{headers});}await client.query("ROLLBACK");return NextResponse.json({error:"Another fare has already been locked."},{status:409,headers});}
  if(!["requested","matching"].includes(booking.status)){await client.query("ROLLBACK");return NextResponse.json({error:"Booking is not negotiable."},{status:409,headers});}
  const result=await client.query(
   "SELECT o.id,o.amount,o.currency_code,o.status,o.expires_at,q.status AS quote_status,q.expires_at AS quote_expires_at " +
   "FROM booking_fare_offers o JOIN fare_quotes q ON q.id=o.fare_quote_id AND q.booking_id=o.booking_id " +
   "WHERE o.id=$1 AND o.booking_id=$2 AND o.proposer_role='driver' AND EXISTS (SELECT 1 FROM bookings b WHERE b.id=o.booking_id AND b.driver_account_id=o.proposer_account_id) FOR UPDATE OF o,q",[offerId,id]);
  const offer=result.rows[0] as {id:string;amount:string;currency_code:string;status:string;expires_at:Date;quote_status:string;quote_expires_at:Date}|undefined;
  if(!offer||offer.status!=="pending"||offer.quote_status!=="open"||new Date(offer.expires_at).getTime()<=Date.now()||new Date(offer.quote_expires_at).getTime()<=Date.now()){
   await client.query("ROLLBACK");return NextResponse.json({error:"Only a current captain counteroffer can be accepted."},{status:409,headers});
  }
  await client.query("UPDATE booking_fare_offers SET status='accepted',accepted_at=now() WHERE id=$1",[offerId]);
  await client.query("UPDATE booking_fare_offers SET status='superseded' WHERE booking_id=$1 AND id<>$2 AND status='pending'",[id,offerId]);
  await client.query("UPDATE fare_quotes SET status='accepted' WHERE booking_id=$1 AND status='open'",[id]);
  await client.query("UPDATE bookings SET accepted_fare_offer_id=$2,accepted_fare_amount=$3,accepted_fare_currency='PKR',fare_locked_at=now(),status='driver_assigned',updated_at=now() WHERE id=$1",[id,offerId,offer.amount]);
  await client.query("INSERT INTO booking_negotiation_events (booking_id,offer_id,actor_account_id,event_type,event_metadata) VALUES ($1,$2,$3,'offer_accepted',$4::jsonb),($1,$2,$3,'fare_locked',$4::jsonb)",
   [id,offerId,session.sub,JSON.stringify({amount:offer.amount,currency:"PKR"})]);
  await client.query("INSERT INTO booking_conversations (booking_id) VALUES ($1) ON CONFLICT (booking_id) DO NOTHING",[id]);
  await client.query("COMMIT");
  return NextResponse.json({accepted:true,lockedFare:{amount:offer.amount,currency:"PKR"},message:"The negotiated fare is locked and cannot be changed unilaterally during the ride."},{headers});
 }catch{
  if(client)await client.query("ROLLBACK").catch(()=>undefined);
  return NextResponse.json({error:"Fare acceptance could not be confirmed."},{status:503,headers});
 }finally{client?.release();}
}
