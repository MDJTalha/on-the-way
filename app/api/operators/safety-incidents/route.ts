import {NextRequest,NextResponse} from "next/server";
import type {PoolClient} from "pg";
import {getDatabasePool} from "@/lib/db";
import {requireOperator,validateSameOrigin} from "@/lib/operator-auth";
export const runtime="nodejs";export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store",Pragma:"no-cache"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(request:NextRequest){
 const auth=await requireOperator(request);if(auth.response)return auth.response;
 const status=request.nextUrl.searchParams.get("status")??"open";
 if(!["open","acknowledged","investigating","resolved","referred","all"].includes(status))return NextResponse.json({error:"Unsupported incident status."},{status:400,headers});
 const limitRaw=Number(request.nextUrl.searchParams.get("limit")??"50");const limit=Number.isInteger(limitRaw)?Math.min(Math.max(limitRaw,1),100):50;
 try{
  const result=await getDatabasePool().query(
   "SELECT i.id,i.booking_id,i.reported_by,i.incident_type,i.severity,i.status,i.description,i.created_at,i.acknowledged_by,i.resolved_at,"+
   "ST_Y(i.location::geometry) AS latitude,ST_X(i.location::geometry) AS longitude,a.display_name AS reporter_name "+
   "FROM trip_safety_incidents i JOIN accounts a ON a.id=i.reported_by "+
   (status==="all"?"":"WHERE i.status=$1 ")+
   "ORDER BY CASE i.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,i.created_at DESC LIMIT $"+(status==="all"?"1":"2"),
   status==="all"?[limit]:[status,limit]);
  return NextResponse.json({incidents:result.rows,count:result.rowCount??result.rows.length},{headers});
 }catch{return NextResponse.json({error:"Safety incident queue is unavailable."},{status:503,headers});}
}
export async function PATCH(request:NextRequest){
 const auth=await requireOperator(request);if(auth.response)return auth.response;
 if(!validateSameOrigin(request))return NextResponse.json({error:"Request origin could not be verified."},{status:403,headers});
 let body:unknown;try{body=await request.json();}catch{return NextResponse.json({error:"Valid JSON required."},{status:400,headers});}
 const p=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const id=typeof p.incidentId==="string"?p.incidentId:"";const next=typeof p.status==="string"?p.status:"";
 const reason=typeof p.reason==="string"?p.reason.trim():"";
 const emergencyContacted=p.emergencyServicesContacted===true;
 if(!uuid.test(id)||!["acknowledged","investigating","resolved","referred"].includes(next)||reason.length>500)
  return NextResponse.json({error:"Valid incident ID, status and optional reason are required."},{status:422,headers});
 let client:PoolClient|undefined;
 try{
  client=await getDatabasePool().connect();await client.query("BEGIN");
  const locked=await client.query("SELECT status,incident_type FROM trip_safety_incidents WHERE id=$1 FOR UPDATE",[id]);
  const incident=locked.rows[0] as {status:string;incident_type:string}|undefined;
  if(!incident){await client.query("ROLLBACK");return NextResponse.json({error:"Incident not found."},{status:404,headers});}
  const allowed:Record<string,string[]>={open:["acknowledged","referred"],acknowledged:["investigating","resolved","referred"],investigating:["resolved","referred"],resolved:[],referred:[]};
  if(!allowed[incident.status]?.includes(next)){await client.query("ROLLBACK");return NextResponse.json({error:"This incident status transition is not allowed."},{status:409,headers});}
  const eventType=next==="acknowledged"?"incident_acknowledged":next==="investigating"?"investigation_started":next==="resolved"?"incident_resolved":"incident_referred";
  const updated=await client.query(
   "UPDATE trip_safety_incidents SET status=$2,acknowledged_by=CASE WHEN $2='acknowledged' THEN $3 ELSE acknowledged_by END,resolved_at=CASE WHEN $2='resolved' THEN now() ELSE resolved_at END,emergency_service_contacted_at=CASE WHEN $4 THEN now() ELSE emergency_service_contacted_at END WHERE id=$1 RETURNING id,status,acknowledged_by,resolved_at,emergency_service_contacted_at",
   [id,next,auth.identity.accountId,emergencyContacted]);
  await client.query("INSERT INTO trip_safety_incident_events (incident_id,actor_account_id,event_type,previous_status,next_status,event_metadata) VALUES ($1,$2,$3,$4,$5,$6::jsonb)",
   [id,auth.identity.accountId,eventType,incident.status,next,JSON.stringify({reason:reason||null,emergency_services_contacted:emergencyContacted,operator_role:auth.identity.role})]);
  if(emergencyContacted)await client.query("INSERT INTO trip_safety_incident_events (incident_id,actor_account_id,event_type,event_metadata) VALUES ($1,$2,'emergency_services_contacted',$3::jsonb)",[id,auth.identity.accountId,JSON.stringify({status:next})]);
  await client.query("COMMIT");return NextResponse.json({incident:updated.rows[0]},{headers});
 }catch{if(client)await client.query("ROLLBACK").catch(()=>undefined);return NextResponse.json({error:"Incident update could not be saved."},{status:503,headers});}
 finally{client?.release();}
}
