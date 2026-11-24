import {NextRequest,NextResponse} from "next/server";
import type {PoolClient} from "pg";
import {getDatabasePool} from "@/lib/db";
import {verifySessionToken} from "@/lib/session";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{id:string}>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const headers={"Cache-Control":"no-store",Pragma:"no-cache"};
async function participant(bookingId:string,accountId:string){
 const r=await getDatabasePool().query("SELECT id,passenger_account_id,driver_account_id,status,accepted_fare_offer_id FROM bookings WHERE id=$1 AND (passenger_account_id=$2 OR driver_account_id=$2)",[bookingId,accountId]);
 return r.rows[0] as {id:string;passenger_account_id:string;driver_account_id:string|null;status:string;accepted_fare_offer_id:string|null}|undefined;
}
export async function GET(request:NextRequest,context:Context){
 const session=verifySessionToken(request.cookies.get("otw_session")?.value);if(!session)return NextResponse.json({error:"Sign in is required."},{status:401,headers});
 const {id}=await context.params;if(!uuid.test(id))return NextResponse.json({error:"Valid booking ID required."},{status:400,headers});
 try{
  const booking=await participant(id,session.sub);if(!booking)return NextResponse.json({error:"Booking not found."},{status:404,headers});
  if(!booking.accepted_fare_offer_id)return NextResponse.json({error:"Conversation opens after a fare is accepted."},{status:409,headers});
  const after=request.nextUrl.searchParams.get("after");
  const cursor=after&&/^\d+$/.test(after)?Number(after):0;
  const result=await getDatabasePool().query(
   "SELECT m.id,m.sender_account_id,m.message_type,m.body,m.client_message_id,m.created_at,m.read_at,a.display_name AS sender_name " +
   "FROM booking_messages m JOIN booking_conversations c ON c.id=m.conversation_id JOIN accounts a ON a.id=m.sender_account_id " +
   "WHERE c.booking_id=$1 AND m.id>$2 ORDER BY m.id ASC LIMIT 100",[id,cursor]);
  return NextResponse.json({messages:result.rows,conversationStatus:booking.status==="completed"||booking.status==="cancelled"?"read_only":"open"},{headers});
 }catch{return NextResponse.json({error:"Booking messages are unavailable."},{status:503,headers});}
}
export async function POST(request:NextRequest,context:Context){
 const session=verifySessionToken(request.cookies.get("otw_session")?.value);if(!session)return NextResponse.json({error:"Sign in is required."},{status:401,headers});
 const origin=request.headers.get("origin");try{if(!origin||new URL(origin).origin!==new URL(request.url).origin)return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});}catch{return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});}
 const {id}=await context.params;if(!uuid.test(id))return NextResponse.json({error:"Valid booking ID required."},{status:400,headers});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Valid JSON required."},{status:400,headers});}
 const p=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const message=typeof p.message==="string"?p.message.trim():"";const clientMessageId=typeof p.clientMessageId==="string"?p.clientMessageId:"";
 if(message.length<1||message.length>2000||!/^[A-Za-z0-9._:-]{8,128}$/.test(clientMessageId))return NextResponse.json({error:"Message must contain 1–2000 characters and a valid client message ID."},{status:422,headers});
 let client:PoolClient|undefined;
 try{
  client=await getDatabasePool().connect();await client.query("BEGIN");
  const b=await client.query("SELECT passenger_account_id,driver_account_id,status,accepted_fare_offer_id FROM bookings WHERE id=$1 AND (passenger_account_id=$2 OR driver_account_id=$2) FOR UPDATE",[id,session.sub]);
  const booking=b.rows[0] as {passenger_account_id:string;driver_account_id:string|null;status:string;accepted_fare_offer_id:string|null}|undefined;
  if(!booking){await client.query("ROLLBACK");return NextResponse.json({error:"Booking not found."},{status:404,headers});}
  if(!booking.accepted_fare_offer_id){await client.query("ROLLBACK");return NextResponse.json({error:"Conversation opens after a fare is accepted."},{status:409,headers});}
  if(["completed","cancelled","disputed"].includes(booking.status)){await client.query("ROLLBACK");return NextResponse.json({error:"This conversation is read-only. Contact support for assistance."},{status:409,headers});}
  const c=await client.query("INSERT INTO booking_conversations (booking_id) VALUES ($1) ON CONFLICT (booking_id) DO UPDATE SET status='open' WHERE booking_conversations.status='open' RETURNING id,status",[id]);
  if(!c.rows[0]||c.rows[0].status!=="open"){await client.query("ROLLBACK");return NextResponse.json({error:"Conversation is closed."},{status:409,headers});}
  const prior=await client.query("SELECT id,conversation_id,body,created_at FROM booking_messages WHERE sender_account_id=$1 AND client_message_id=$2",[session.sub,clientMessageId]);
  if(prior.rows[0]){if(prior.rows[0].conversation_id!==c.rows[0].id){await client.query("ROLLBACK");return NextResponse.json({error:"Client message ID was already used in another conversation."},{status:409,headers});}await client.query("COMMIT");return NextResponse.json({message:prior.rows[0],replayed:true},{headers});}
  const inserted=await client.query("INSERT INTO booking_messages (conversation_id,sender_account_id,message_type,body,client_message_id) VALUES ($1,$2,'text',$3,$4) RETURNING id,sender_account_id,message_type,body,client_message_id,created_at",[c.rows[0].id,session.sub,message,clientMessageId]);
  await client.query("COMMIT");return NextResponse.json({message:inserted.rows[0],replayed:false},{status:201,headers});
 }catch{if(client)await client.query("ROLLBACK").catch(()=>undefined);return NextResponse.json({error:"Message could not be sent."},{status:503,headers});}
 finally{client?.release();}
}
