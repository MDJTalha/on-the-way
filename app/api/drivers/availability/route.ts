import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };

async function readEligibility(accountId: string) {
  const result = await getDatabasePool().query(
    "SELECT d.verification_status, d.availability_status, d.service_city, d.service_country_code, d.preferred_vehicle_type, " +
    "EXISTS (SELECT 1 FROM vehicles v WHERE v.driver_account_id = d.account_id AND v.vehicle_type = d.preferred_vehicle_type AND v.verification_status = 'verified') AS vehicle_verified, " +
    "EXISTS (SELECT 1 FROM service_zones z WHERE lower(z.city_name) = lower(d.service_city) AND z.country_code = d.service_country_code AND z.active = true) AS active_service_zone " +
    "FROM driver_profiles d INNER JOIN account_roles ar ON ar.account_id = d.account_id AND ar.role = 'driver' " +
    "WHERE d.account_id = $1",
    [accountId],
  );
  if (!result.rows[0]) return null;
  const row = result.rows[0] as {
    verification_status: string;
    availability_status: string;
    service_city: string | null;
    service_country_code: string | null;
    preferred_vehicle_type: string | null;
    vehicle_verified: boolean;
    active_service_zone: boolean;
  };
  const blockers: string[] = [];
  if (row.verification_status !== "verified") blockers.push("Driver identity/application verification is not approved.");
  if (!row.vehicle_verified) blockers.push("A verified vehicle record for the selected vehicle category is required.");
  if (!row.active_service_zone) blockers.push("The operating city and country do not yet have an active service zone.");
  return { ...row, eligible: blockers.length === 0, blockers };
}

export async function GET(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get("otw_session")?.value);
  if (!session) return NextResponse.json({ error: "Sign in with Pi to view driver availability." }, { status: 401, headers: noStore });
  try {
    const availability = await readEligibility(session.sub);
    if (!availability) return NextResponse.json({ error: "An approved driver role is required." }, { status: 403, headers: noStore });
    return NextResponse.json({ availability }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Driver availability status is unavailable." }, { status: 503, headers: noStore });
  }
}

export async function PATCH(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get("otw_session")?.value);
  if (!session) return NextResponse.json({ error: "Sign in with Pi before changing availability." }, { status: 401, headers: noStore });
  const origin = request.headers.get("origin");
  try {
    if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers: noStore });
    }
  } catch {
    return NextResponse.json({ error: "Request origin could not be verified." }, { status: 403, headers: noStore });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: noStore }); }
  const requested = body && typeof body === "object" ? (body as Record<string, unknown>).availabilityStatus : undefined;
  if (requested !== "offline" && requested !== "available") {
    return NextResponse.json({ error: "Availability must be either offline or available." }, { status: 422, headers: noStore });
  }

  let client: PoolClient | undefined;
  try {
    client = await getDatabasePool().connect();
    await client.query("BEGIN");
    const locked = await client.query(
      "SELECT d.verification_status, d.availability_status, d.service_city, d.service_country_code, d.preferred_vehicle_type " +
      "FROM driver_profiles d INNER JOIN account_roles ar ON ar.account_id = d.account_id AND ar.role = 'driver' " +
      "WHERE d.account_id = $1 FOR UPDATE OF d",
      [session.sub],
    );
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "An approved driver role is required." }, { status: 403, headers: noStore });
    }
    const current = locked.rows[0] as {
      verification_status: string;
      availability_status: string;
      service_city: string | null;
      service_country_code: string | null;
      preferred_vehicle_type: string | null;
    };
    if (current.availability_status === "busy" && requested === "offline") {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "A driver with an active trip cannot switch offline." }, { status: 409, headers: noStore });
    }

    if (requested === "available") {
      const blockers: string[] = [];
      if (current.verification_status !== "verified") blockers.push("Driver verification is not approved.");

      const vehicle = await client.query(
        "SELECT id FROM vehicles WHERE driver_account_id = $1 AND vehicle_type = $2 AND verification_status = 'verified' LIMIT 1 FOR SHARE",
        [session.sub, current.preferred_vehicle_type],
      );
      if (!vehicle.rows[0]) blockers.push("A verified vehicle is required for the selected vehicle category.");

      const zone = await client.query(
        "SELECT id FROM service_zones WHERE lower(city_name) = lower($1) AND country_code = $2 AND active = true LIMIT 1 FOR SHARE",
        [current.service_city, current.service_country_code],
      );
      if (!zone.rows[0]) blockers.push("An active service zone is required for this city and country.");

      if (blockers.length) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Driver is not eligible to go online.", blockers }, { status: 409, headers: noStore });
      }
    }

    if (current.availability_status === requested) {
      await client.query("COMMIT");
      return NextResponse.json({ availabilityStatus: requested, replayed: true }, { headers: noStore });
    }

    await client.query(
      "UPDATE driver_profiles SET availability_status = $2 WHERE account_id = $1",
      [session.sub, requested],
    );
    await client.query(
      "INSERT INTO driver_application_events (driver_account_id, actor_account_id, event_type, from_verification_status, to_verification_status, event_metadata) " +
      "VALUES ($1, $1, 'availability_changed', $2, $2, $3::jsonb)",
      [session.sub, current.verification_status, JSON.stringify({
        from_availability: current.availability_status,
        to_availability: requested,
      })],
    );
    await client.query("COMMIT");
    return NextResponse.json({ availabilityStatus: requested, replayed: false }, { headers: noStore });
  } catch {
    if (client) await client.query("ROLLBACK").catch(() => undefined);
    return NextResponse.json({ error: "Driver availability could not be updated." }, { status: 503, headers: noStore });
  } finally {
    client?.release();
  }
}
