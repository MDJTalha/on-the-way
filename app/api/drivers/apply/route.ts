import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const vehicleTypes = new Set(["car", "bike", "rickshaw"]);
const CONSENT_VERSION = "driver-onboarding-v1";

export async function POST(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get("otw_session")?.value);
  if (!session) return NextResponse.json({ error: "Sign in with Pi before applying." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const city = typeof payload.serviceCity === "string" ? payload.serviceCity.trim() : "";
  const countryCode = typeof payload.serviceCountryCode === "string" ? payload.serviceCountryCode.trim().toUpperCase() : "";
  const vehicleType = payload.vehicleType;
  if (city.length < 2 || city.length > 80 || !/^[A-Z]{2}$/.test(countryCode) || typeof vehicleType !== "string" || !vehicleTypes.has(vehicleType) || payload.consent !== true) {
    return NextResponse.json({ error: "Enter a valid operating city and two-letter country code, choose a vehicle and accept the driver application notice." }, { status: 422 });
  }
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Driver application service is not configured." }, { status: 503 });

  let client: PoolClient | undefined;
  try {
    client = await getDatabasePool().connect();
    await client.query("BEGIN");
    const account = await client.query(
      "SELECT a.id FROM accounts a INNER JOIN account_roles ar ON ar.account_id = a.id WHERE a.id = $1 AND ar.role = 'passenger' FOR UPDATE OF a",
      [session.sub],
    );
    if (!account.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "A verified passenger account is required." }, { status: 403 });
    }

    const existing = await client.query(
      "SELECT verification_status, availability_status, service_city, service_country_code, preferred_vehicle_type FROM driver_profiles WHERE account_id = $1 FOR UPDATE",
      [session.sub],
    );
    const previous = existing.rows[0] as {
      verification_status: string;
      availability_status: string;
      service_city: string | null;
      service_country_code: string | null;
      preferred_vehicle_type: string | null;
    } | undefined;
    const changed = Boolean(previous && (
      previous.service_city?.trim().toLocaleLowerCase() !== city.toLocaleLowerCase() ||
      previous.service_country_code?.trim().toUpperCase() !== countryCode ||
      previous.preferred_vehicle_type !== vehicleType
    ));
    const nextVerification = previous?.verification_status === "suspended"
      ? "suspended"
      : previous?.verification_status === "verified" && !changed
        ? "verified"
        : "pending";
    const nextAvailability = nextVerification === "verified" && !changed
      ? previous?.availability_status ?? "offline"
      : "offline";

    const result = await client.query(
      "INSERT INTO driver_profiles " +
      "(account_id, verification_status, availability_status, service_city, service_country_code, preferred_vehicle_type, application_submitted_at, application_consent_at, consent_version) " +
      "VALUES ($1, $2, $3, $4, $5, $6, now(), now(), $7) " +
      "ON CONFLICT (account_id) DO UPDATE SET service_city = EXCLUDED.service_city, service_country_code = EXCLUDED.service_country_code, preferred_vehicle_type = EXCLUDED.preferred_vehicle_type, " +
      "application_submitted_at = now(), application_consent_at = now(), consent_version = EXCLUDED.consent_version, " +
      "verification_status = $2, availability_status = $3 " +
      "RETURNING verification_status, availability_status, service_city, service_country_code, preferred_vehicle_type, application_submitted_at",
      [session.sub, nextVerification, nextAvailability, city, countryCode, vehicleType, CONSENT_VERSION],
    );

    await client.query(
      "INSERT INTO driver_application_events " +
      "(driver_account_id, actor_account_id, event_type, from_verification_status, to_verification_status, event_metadata) " +
      "VALUES ($1, $1, $2, $3, $4, $5::jsonb)",
      [
        session.sub,
        previous ? "application_updated" : "application_submitted",
        previous?.verification_status ?? null,
        nextVerification,
        JSON.stringify({
          service_city: city,
          service_country_code: countryCode,
          preferred_vehicle_type: vehicleType,
          application_changed: changed,
          consent_version: CONSENT_VERSION,
        }),
      ],
    );

    await client.query("COMMIT");
    return NextResponse.json({
      application: result.rows[0],
      message: changed && previous?.verification_status === "verified"
        ? "Your application details changed. Your profile has returned to pending verification and remains offline."
        : nextVerification === "suspended"
          ? "Your application details were recorded. Your account remains suspended and offline."
          : "Application received. Your driver status remains offline until verification is completed.",
    }, { status: previous ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    return NextResponse.json({ error: "Driver application could not be saved." }, { status: 503 });
  } finally {
    client?.release();
  }
}
