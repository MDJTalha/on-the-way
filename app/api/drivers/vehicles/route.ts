import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };
const vehicleTypes = new Set(["car", "bike", "rickshaw"]);
const idempotencyPattern = /^[A-Za-z0-9._:-]{16,128}$/;

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

export async function GET(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get("otw_session")?.value);
  if (!session) return NextResponse.json({ error: "Sign in with Pi to view your vehicles." }, { status: 401, headers: noStore });
  try {
    const profile = await getDatabasePool().query(
      "SELECT verification_status FROM driver_profiles WHERE account_id = $1",
      [session.sub],
    );
    if (!profile.rows[0]) return NextResponse.json({ error: "Submit a driver application before adding a vehicle." }, { status: 403, headers: noStore });
    const result = await getDatabasePool().query(
      "SELECT id, vehicle_type, make, model, model_year, registration_country, verification_status, verified_at, created_at " +
      "FROM vehicles WHERE driver_account_id = $1 ORDER BY created_at DESC",
      [session.sub],
    );
    return NextResponse.json({ vehicles: result.rows }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Vehicle records are unavailable." }, { status: 503, headers: noStore });
  }
}

export async function POST(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get("otw_session")?.value);
  if (!session) return NextResponse.json({ error: "Sign in with Pi before submitting a vehicle." }, { status: 401, headers: noStore });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers: noStore });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: noStore }); }
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const vehicleType = payload.vehicleType;
  const make = typeof payload.make === "string" ? payload.make.trim() : "";
  const model = typeof payload.model === "string" ? payload.model.trim() : "";
  const modelYear = payload.modelYear;
  const registrationCountry = typeof payload.registrationCountry === "string" ? payload.registrationCountry.trim().toUpperCase() : "";
  const currentYear = new Date().getUTCFullYear();
  if (typeof vehicleType !== "string" || !vehicleTypes.has(vehicleType) ||
      make.length < 2 || make.length > 60 || model.length < 1 || model.length > 60 ||
      typeof modelYear !== "number" || !Number.isInteger(modelYear) || modelYear < 1970 || modelYear > currentYear + 1 ||
      !/^[A-Z]{2}$/.test(registrationCountry) || payload.consent !== true) {
    return NextResponse.json({ error: "Enter a valid vehicle category, make, model, model year and registration country, then accept the vehicle review notice." }, { status: 422, headers: noStore });
  }

  const idempotencyKey = request.headers.get("Idempotency-Key") ?? "";
  if (!idempotencyPattern.test(idempotencyKey)) {
    return NextResponse.json({ error: "A valid Idempotency-Key is required for safe vehicle submission retries." }, { status: 400, headers: noStore });
  }
  const canonicalPayload = JSON.stringify({ vehicleType, make, model, modelYear, registrationCountry });
  const requestHash = createHash("sha256").update(canonicalPayload).digest("hex");

  let client: PoolClient | undefined;
  try {
    client = await getDatabasePool().connect();
    await client.query("BEGIN");
    const profile = await client.query(
      "SELECT verification_status FROM driver_profiles WHERE account_id = $1 FOR UPDATE",
      [session.sub],
    );
    if (!profile.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Submit a driver application before adding a vehicle." }, { status: 403, headers: noStore });
    }
    const profileStatus = String(profile.rows[0].verification_status);
    if (profileStatus === "rejected" || profileStatus === "suspended") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "An active driver application is required before adding a vehicle." }, { status: 403, headers: noStore });
    }

    const existing = await client.query(
      "SELECT id, vehicle_type, make, model, model_year, registration_country, verification_status, verified_at, created_at, request_hash " +
      "FROM vehicles WHERE driver_account_id = $1 AND submission_key = $2 FOR UPDATE",
      [session.sub, idempotencyKey],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].request_hash !== requestHash) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "This Idempotency-Key was already used with different vehicle details." }, { status: 409, headers: noStore });
      }
      await client.query("COMMIT");
      const { request_hash: _requestHash, ...vehicle } = existing.rows[0];
      return NextResponse.json({ vehicle, replayed: true }, { headers: noStore });
    }

    const inserted = await client.query(
      "INSERT INTO vehicles (driver_account_id, vehicle_type, make, model, model_year, registration_country, verification_status, submission_key, request_hash) " +
      "VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8) " +
      "RETURNING id, vehicle_type, make, model, model_year, registration_country, verification_status, verified_at, created_at",
      [session.sub, vehicleType, make, model, modelYear, registrationCountry, idempotencyKey, requestHash],
    );
    const vehicle = inserted.rows[0];
    await client.query(
      "INSERT INTO vehicle_events (vehicle_id, driver_account_id, actor_account_id, event_type, from_verification_status, to_verification_status, event_metadata) " +
      "VALUES ($1, $2, $2, 'vehicle_submitted', NULL, 'pending', $3::jsonb)",
      [vehicle.id, session.sub, JSON.stringify({ vehicle_type: vehicleType, make, model, model_year: modelYear, registration_country: registrationCountry })],
    );
    await client.query("COMMIT");
    return NextResponse.json({ vehicle, replayed: false, message: "Vehicle details submitted. The vehicle remains pending until an authorized operator completes the external evidence review." }, { status: 201, headers: noStore });
  } catch {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    return NextResponse.json({ error: "Vehicle details could not be submitted." }, { status: 503, headers: noStore });
  } finally {
    client?.release();
  }
}
