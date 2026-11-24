import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/db";
import { requireOperator, validateSameOrigin } from "@/lib/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const decisions = new Set(["under_review", "verified", "rejected", "suspended"]);

export async function GET(request: NextRequest) {
  const auth = await requireOperator(request);
  if (auth.response) return auth.response;
  const status = request.nextUrl.searchParams.get("status") ?? "pending";
  if (!["pending", "under_review", "verified", "rejected", "suspended", "all"].includes(status)) {
    return NextResponse.json({ error: "Unsupported vehicle verification status filter." }, { status: 400, headers: noStore });
  }
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
  try {
    const result = await getDatabasePool().query(
      "SELECT v.id, v.driver_account_id, a.display_name, v.vehicle_type, v.make, v.model, v.model_year, " +
      "v.registration_country, v.verification_status, v.verified_at, v.created_at, d.service_city, d.service_country_code " +
      "FROM vehicles v INNER JOIN driver_profiles d ON d.account_id = v.driver_account_id " +
      "INNER JOIN accounts a ON a.id = v.driver_account_id " +
      (status === "all" ? "" : "WHERE v.verification_status = $1 ") +
      "ORDER BY v.created_at ASC LIMIT $" + (status === "all" ? "1" : "2"),
      status === "all" ? [limit] : [status, limit],
    );
    return NextResponse.json({ vehicles: result.rows, count: result.rowCount ?? result.rows.length }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Vehicle review queue is unavailable." }, { status: 503, headers: noStore });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireOperator(request);
  if (auth.response) return auth.response;
  if (!validateSameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers: noStore });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: noStore }); }
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const vehicleId = payload.vehicleId;
  const decision = payload.decision;
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  const verificationReference = typeof payload.verificationReference === "string" ? payload.verificationReference.trim() : "";
  const evidenceChecks = payload.evidenceChecks && typeof payload.evidenceChecks === "object" ? payload.evidenceChecks as Record<string, unknown> : {};
  if (typeof vehicleId !== "string" || !uuidPattern.test(vehicleId) ||
      typeof decision !== "string" || !decisions.has(decision)) {
    return NextResponse.json({ error: "A valid vehicle ID and review decision are required." }, { status: 422, headers: noStore });
  }
  if (["rejected", "suspended"].includes(decision) && (reason.length < 10 || reason.length > 500)) {
    return NextResponse.json({ error: "A 10–500 character reason is required for rejection or suspension." }, { status: 422, headers: noStore });
  }
  if (decision === "verified" && (verificationReference.length < 6 || verificationReference.length > 120)) {
    return NextResponse.json({ error: "An external vehicle verification case reference is required before approval." }, { status: 422, headers: noStore });
  }
  const requiredEvidenceChecks = ["registrationOwnership", "insurance", "inspection", "physicalIdentity"];
  if (decision === "verified" && !requiredEvidenceChecks.every((key) => evidenceChecks[key] === true)) {
    return NextResponse.json({ error: "Complete every required registration, ownership, insurance, inspection and physical vehicle identity check before approval." }, { status: 422, headers: noStore });
  }

  let client: PoolClient | undefined;
  try {
    client = await getDatabasePool().connect();
    await client.query("BEGIN");
    const locked = await client.query(
      "SELECT v.id, v.driver_account_id, v.vehicle_type, v.verification_status, " +
      "d.availability_status, d.preferred_vehicle_type " +
      "FROM vehicles v INNER JOIN driver_profiles d ON d.account_id = v.driver_account_id " +
      "WHERE v.id = $1 FOR UPDATE OF v, d",
      [vehicleId],
    );
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Vehicle record not found." }, { status: 404, headers: noStore });
    }
    const current = locked.rows[0] as {
      id: string;
      driver_account_id: string;
      vehicle_type: string;
      verification_status: string;
      availability_status: string;
      preferred_vehicle_type: string | null;
    };
    const previous = current.verification_status;
    if (previous === decision) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "The vehicle already has this verification status." }, { status: 409, headers: noStore });
    }
    if (previous === "suspended" && decision !== "under_review") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "A suspended vehicle must return to review before another decision." }, { status: 409, headers: noStore });
    }
    if (decision === "under_review" && !["pending", "rejected", "suspended"].includes(previous)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Only pending, rejected or suspended vehicles can enter review." }, { status: 409, headers: noStore });
    }
    if (decision === "verified" && !["pending", "under_review"].includes(previous)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Only pending or actively reviewed vehicles can be verified." }, { status: 409, headers: noStore });
    }
    if (decision === "rejected" && !["pending", "under_review"].includes(previous)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Only pending or actively reviewed vehicles can be rejected." }, { status: 409, headers: noStore });
    }
    if (decision === "suspended" && !["verified", "under_review"].includes(previous)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Only verified or actively reviewed vehicles can be suspended." }, { status: 409, headers: noStore });
    }
    if (["rejected", "suspended"].includes(decision) && current.availability_status === "busy") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Vehicle verification cannot be revoked while the driver has an active trip." }, { status: 409, headers: noStore });
    }

    const updated = await client.query(
      "UPDATE vehicles SET verification_status = $2, verified_at = CASE WHEN $2 = 'verified' THEN now() ELSE NULL END " +
      "WHERE id = $1 RETURNING id, driver_account_id, vehicle_type, make, model, model_year, registration_country, verification_status, verified_at",
      [vehicleId, decision],
    );
    const eventType = decision === "under_review" ? "vehicle_review_started" :
      decision === "verified" ? "vehicle_verified" :
      decision === "rejected" ? "vehicle_rejected" : "vehicle_suspended";
    await client.query(
      "INSERT INTO vehicle_events (vehicle_id, driver_account_id, actor_account_id, event_type, from_verification_status, to_verification_status, event_metadata) " +
      "VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)",
      [vehicleId, current.driver_account_id, auth.identity.accountId, eventType, previous, decision,
        JSON.stringify({ reason: reason || null, verification_reference: decision === "verified" ? verificationReference : null, evidence_checks: decision === "verified" ? Object.fromEntries(requiredEvidenceChecks.map((key) => [key, true])) : null, operator_role: auth.identity.role })],
    );

    if (["rejected", "suspended"].includes(decision) &&
        current.availability_status === "available" &&
        current.preferred_vehicle_type === current.vehicle_type) {
      const remaining = await client.query(
        "SELECT EXISTS (SELECT 1 FROM vehicles WHERE driver_account_id = $1 AND vehicle_type = $2 AND verification_status = 'verified' AND id <> $3) AS has_verified_vehicle",
        [current.driver_account_id, current.preferred_vehicle_type, vehicleId],
      );
      if (!remaining.rows[0].has_verified_vehicle) {
        await client.query(
          "UPDATE driver_profiles SET availability_status = 'offline' WHERE account_id = $1",
          [current.driver_account_id],
        );
        await client.query(
          "INSERT INTO driver_application_events (driver_account_id, actor_account_id, event_type, from_verification_status, to_verification_status, event_metadata) " +
          "SELECT account_id, $2, 'availability_changed', verification_status, verification_status, $3::jsonb " +
          "FROM driver_profiles WHERE account_id = $1",
          [current.driver_account_id, auth.identity.accountId, JSON.stringify({
            from_availability: "available",
            to_availability: "offline",
            reason: "preferred_vehicle_verification_revoked",
            vehicle_id: vehicleId,
          })],
        );
      }
    }

    await client.query("COMMIT");
    return NextResponse.json({ vehicle: updated.rows[0] }, { headers: noStore });
  } catch {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    return NextResponse.json({ error: "Vehicle review decision could not be saved." }, { status: 503, headers: noStore });
  } finally {
    client?.release();
  }
}
