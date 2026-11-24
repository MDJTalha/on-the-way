import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/db";
import { requireOperator, validateSameOrigin } from "@/lib/operator-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedDecisions = new Set(["under_review", "verified", "rejected", "suspended"]);

export async function GET(request: NextRequest) {
  const auth = await requireOperator(request);
  if (auth.response) return auth.response;
  const status = request.nextUrl.searchParams.get("status") ?? "pending";
  if (!["pending", "under_review", "verified", "rejected", "suspended", "all"].includes(status)) {
    return NextResponse.json({ error: "Unsupported verification status filter." }, { status: 400 });
  }
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
  const limit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
  try {
    const result = await getDatabasePool().query(
      "SELECT d.account_id, a.display_name, d.service_city, d.service_country_code, d.preferred_vehicle_type, d.verification_status, " +
      "d.availability_status, d.application_submitted_at, d.application_consent_at, d.consent_version " +
      "FROM driver_profiles d INNER JOIN accounts a ON a.id = d.account_id " +
      (status === "all" ? "" : "WHERE d.verification_status = $1 ") +
      "ORDER BY d.application_submitted_at ASC NULLS LAST LIMIT $" + (status === "all" ? "1" : "2"),
      status === "all" ? [limit] : [status, limit],
    );
    return NextResponse.json({ applications: result.rows, count: result.rowCount ?? result.rows.length }, {
      headers: { "Cache-Control": "no-store", "Pragma": "no-cache" },
    });
  } catch {
    return NextResponse.json({ error: "Driver review queue is unavailable." }, { status: 503 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireOperator(request);
  if (auth.response) return auth.response;
  if (!validateSameOrigin(request)) {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const driverAccountId = payload.driverAccountId;
  const decision = payload.decision;
  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  const verificationReference = typeof payload.verificationReference === "string" ? payload.verificationReference.trim() : "";
  const evidenceChecks = payload.evidenceChecks && typeof payload.evidenceChecks === "object" ? payload.evidenceChecks as Record<string, unknown> : {};
  if (typeof driverAccountId !== "string" || !uuidPattern.test(driverAccountId) ||
      typeof decision !== "string" || !allowedDecisions.has(decision)) {
    return NextResponse.json({ error: "A valid driver account and review decision are required." }, { status: 422 });
  }
  if (["rejected", "suspended"].includes(decision) && (reason.length < 10 || reason.length > 500)) {
    return NextResponse.json({ error: "A 10–500 character reason is required for rejection or suspension." }, { status: 422 });
  }
  if (decision === "verified" && (verificationReference.length < 6 || verificationReference.length > 120)) {
    return NextResponse.json({ error: "A secure verification case reference is required before approval." }, { status: 422 });
  }
  const requiredEvidenceChecks = ["identity", "drivingEligibility", "localPermits", "safetyCoverage"];
  if (decision === "verified" && !requiredEvidenceChecks.every((key) => evidenceChecks[key] === true)) {
    return NextResponse.json({ error: "Complete every required identity, driving eligibility, local permit and safety coverage check before verification." }, { status: 422 });
  }
  if (decision === "under_review" && reason.length > 500) {
    return NextResponse.json({ error: "Review note must not exceed 500 characters." }, { status: 422 });
  }

  let client: PoolClient | undefined;
  try {
    client = await getDatabasePool().connect();
    await client.query("BEGIN");
    const locked = await client.query(
      "SELECT verification_status FROM driver_profiles WHERE account_id = $1 FOR UPDATE",
      [driverAccountId],
    );
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Driver application not found." }, { status: 404 });
    }
    const previousStatus = String(locked.rows[0].verification_status);
    if (previousStatus === "suspended" && decision !== "under_review") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "A suspended profile must be reviewed before another decision." }, { status: 409 });
    }
    if (previousStatus === decision) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "The application already has this status." }, { status: 409 });
    }
    if (decision === "verified" && !["pending", "under_review"].includes(previousStatus)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Only pending or actively reviewed applications can be verified." }, { status: 409 });
    }
    if (decision === "under_review" && !["pending", "suspended"].includes(previousStatus)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Only pending applications can enter review." }, { status: 409 });
    }
    if (decision === "rejected" && !["pending", "under_review"].includes(previousStatus)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Only pending or actively reviewed applications can be rejected." }, { status: 409 });
    }

    const updated = await client.query(
      "UPDATE driver_profiles SET verification_status = $2, availability_status = 'offline', " +
      "verified_at = CASE WHEN $2 = 'verified' THEN now() ELSE NULL END " +
      "WHERE account_id = $1 RETURNING account_id, verification_status, availability_status, service_city, preferred_vehicle_type, verified_at",
      [driverAccountId, decision],
    );
    if (decision === "verified") {
      await client.query(
        "INSERT INTO account_roles (account_id, role) VALUES ($1, 'driver') ON CONFLICT (account_id, role) DO NOTHING",
        [driverAccountId],
      );
    } else if (decision === "rejected" || decision === "suspended") {
      await client.query("DELETE FROM account_roles WHERE account_id = $1 AND role = 'driver'", [driverAccountId]);
    }
    const eventType = decision === "under_review" ? "review_started" :
      decision === "verified" ? "application_verified" :
      decision === "rejected" ? "application_rejected" : "driver_suspended";
    await client.query(
      "INSERT INTO driver_application_events " +
      "(driver_account_id, actor_account_id, event_type, from_verification_status, to_verification_status, event_metadata) " +
      "VALUES ($1, $2, $3, $4, $5, $6::jsonb)",
      [driverAccountId, auth.identity.accountId, eventType, previousStatus, decision,
        JSON.stringify({ reason: reason || null, verification_reference: decision === "verified" ? verificationReference : null, evidence_checks: decision === "verified" ? Object.fromEntries(requiredEvidenceChecks.map((key) => [key, true])) : null, operator_role: auth.identity.role })],
    );
    await client.query("COMMIT");
    return NextResponse.json({ application: updated.rows[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    return NextResponse.json({ error: "Driver review decision could not be saved." }, { status: 503 });
  } finally {
    client?.release();
  }
}
