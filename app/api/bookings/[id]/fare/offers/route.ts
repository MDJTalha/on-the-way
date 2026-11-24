import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers = { "Cache-Control":"no-store", Pragma:"no-cache" };

export async function POST(request:NextRequest,context:Context) {
  const session=verifySessionToken(request.cookies.get("otw_session")?.value);
  if(!session)return NextResponse.json({error:"Sign in is required."},{status:401,headers});
  const origin=request.headers.get("origin");
  try{if(!origin||new URL(origin).origin!==new URL(request.url).origin)return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});}
  catch{return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});}
  const {id}=await context.params;
  if(!uuid.test(id))return NextResponse.json({error:"A valid booking ID is required."},{status:400,headers});
  let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Request body must be valid JSON."},{status:400,headers});}
  const payload=body&&typeof body==="object"?body as Record<string,unknown>:{};
  const quoteId=typeof payload.quoteId==="string"?payload.quoteId:"";
  const amount=typeof payload.amount==="string"?payload.amount.trim():typeof payload.amount==="number"&&Number.isFinite(payload.amount)?String(payload.amount):"";
  const key=request.headers.get("Idempotency-Key")??"";
  if(!uuid.test(quoteId)||! /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(amount)||Number(amount)<=0||!/^[A-Za-z0-9._:-]{16,128}$/.test(key))
    return NextResponse.json({error:"A valid quote, positive PKR amount (up to two decimals) and Idempotency-Key are required."},{status:422,headers});

  let client:PoolClient|undefined;
  try{
    client=await getDatabasePool().connect();await client.query("BEGIN");
    const bookingResult=await client.query("SELECT id,passenger_account_id,status FROM bookings WHERE id=$1 FOR UPDATE",[id]);
    const booking=bookingResult.rows[0] as {passenger_account_id:string;status:string}|undefined;
    if(!booking||booking.passenger_account_id!==session.sub){await client.query("ROLLBACK");return NextResponse.json({error:"Booking not found."},{status:404,headers});}
    if(!["requested","matching"].includes(booking.status)){await client.query("ROLLBACK");return NextResponse.json({error:"Booking is not accepting offers."},{status:409,headers});}
    const quoteResult=await client.query("SELECT id,minimum_acceptable_amount,suggested_maximum_amount,status,expires_at FROM fare_quotes WHERE id=$1 AND booking_id=$2 FOR UPDATE",[quoteId,id]);
    const quote=quoteResult.rows[0] as {minimum_acceptable_amount:string;suggested_maximum_amount:string;status:string;expires_at:Date}|undefined;
    if(!quote||quote.status!=="open"||new Date(quote.expires_at).getTime()<=Date.now()){await client.query("ROLLBACK");return NextResponse.json({error:"Fare quote is expired or unavailable."},{status:409,headers});}
    const range=await client.query("SELECT $1::numeric >= $2::numeric AS above_floor,$1::numeric <= $3::numeric AS below_ceiling",[amount,quote.minimum_acceptable_amount,quote.suggested_maximum_amount]);
    if(!range.rows[0].above_floor||!range.rows[0].below_ceiling){await client.query("ROLLBACK");return NextResponse.json({error:"Offer must be within the disclosed PKR range."},{status:422,headers});}
    const prior=await client.query("SELECT id,booking_id,amount,status FROM booking_fare_offers WHERE proposer_account_id=$1 AND idempotency_key=$2 FOR UPDATE",[session.sub,key]);
    if(prior.rows[0]){if(prior.rows[0].booking_id!==id||String(prior.rows[0].amount)!==amount){await client.query("ROLLBACK");return NextResponse.json({error:"Idempotency key was already used for a different amount."},{status:409,headers});}await client.query("COMMIT");return NextResponse.json({offer:prior.rows[0],replayed:true},{headers});}
    await client.query("UPDATE booking_fare_offers SET status='superseded' WHERE booking_id=$1 AND proposer_account_id=$2 AND status='pending'",[id,session.sub]);
    const inserted=await client.query(
      "INSERT INTO booking_fare_offers (booking_id,fare_quote_id,proposer_account_id,proposer_role,amount,idempotency_key,expires_at) VALUES ($1,$2,$3,'passenger',$4,$5,$6) RETURNING id,amount,currency_code,status,expires_at,created_at",
      [id,quoteId,session.sub,amount,key,quote.expires_at]);
    await client.query("INSERT INTO booking_negotiation_events (booking_id,offer_id,actor_account_id,event_type,event_metadata) VALUES ($1,$2,$3,'passenger_offer_created',$4::jsonb)",
      [id,inserted.rows[0].id,session.sub,JSON.stringify({amount,currency:"PKR"})]);
    await client.query("UPDATE bookings SET status='matching',updated_at=now() WHERE id=$1 AND status='requested'",[id]);
    await client.query("COMMIT");
    return NextResponse.json({offer:inserted.rows[0],message:"Offer recorded. A captain has not accepted it yet."},{status:201,headers});
  }catch{
    if(client)await client.query("ROLLBACK").catch(()=>undefined);
    return NextResponse.json({error:"Fare offer could not be recorded."},{status:503,headers});
  }finally{client?.release();}
}
