import { NextRequest, NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/db";
import { requireOperator } from "@/lib/operator-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };
const filters = new Set(["all", "driver", "vehicle", "service_zone", "booking"]);
export async function GET(request: NextRequest) {
  const auth = await requireOperator(request);
  if (auth.response) return auth.response;
  const entity = request.nextUrl.searchParams.get("entity") ?? "all";
  if (!filters.has(entity)) return NextResponse.json({ error: "Unsupported audit entity filter." }, { status: 400, headers: noStore });
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "30");
  const rawOffset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 30;
  const offset = Number.isInteger(rawOffset) ? Math.min(Math.max(rawOffset, 0), 10000) : 0;
  try {
    const result = await getDatabasePool().query(
      `SELECT e.id, e.entity_type, e.entity_id, e.actor_account_id, a.display_name AS actor_display_name,
              e.event_type, e.from_status, e.to_status, e.created_at, e.details
       FROM (
         SELECT id, 'driver'::text AS entity_type, driver_account_id AS entity_id, actor_account_id,
                event_type, from_verification_status::text AS from_status, to_verification_status::text AS to_status,
                created_at, jsonb_strip_nulls(jsonb_build_object('evidence_checks',
                  CASE WHEN jsonb_typeof(event_metadata->'evidence_checks') = 'object' THEN event_metadata->'evidence_checks' ELSE NULL END)) AS details
         FROM driver_application_events
         UNION ALL
         SELECT id, 'vehicle'::text, vehicle_id, actor_account_id, event_type,
                from_verification_status::text, to_verification_status::text, created_at,
                jsonb_strip_nulls(jsonb_build_object('evidence_checks',
                  CASE WHEN jsonb_typeof(event_metadata->'evidence_checks') = 'object' THEN event_metadata->'evidence_checks' ELSE NULL END))
         FROM vehicle_events
         UNION ALL
         SELECT id, 'service_zone'::text, service_zone_id, actor_account_id, event_type,
                previous_state->>'active', new_state->>'active', created_at, '{}'::jsonb
         FROM service_zone_events
         UNION ALL
         SELECT id, 'booking'::text, booking_id, actor_account_id, event_type,
                from_status::text, to_status::text, created_at, '{}'::jsonb
         FROM booking_events
       ) e LEFT JOIN accounts a ON a.id = e.actor_account_id
       WHERE ($1 = 'all' OR e.entity_type = $1)
       ORDER BY e.created_at DESC, e.id DESC LIMIT $2 OFFSET $3`,
      [entity, limit + 1, offset],
    );
    return NextResponse.json({ events: result.rows.slice(0, limit), pagination: { limit, offset, returned: Math.min(result.rows.length, limit), hasMore: result.rows.length > limit, maxOffset: 10000 }, viewerRole: auth.identity.role }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Audit history is temporarily unavailable." }, { status: 503, headers: noStore });
  }
}
