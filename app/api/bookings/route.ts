import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedVehicleTypes = new Set(["car", "bike", "rickshaw"]);
const isCoordinate = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

async function getPassengerAccount(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get("otw_session")?.value);
  if (!session) return null;
  const result = await getDatabasePool().query(
    "SELECT a.id FROM accounts a INNER JOIN account_roles ar ON ar.account_id = a.id WHERE a.id = $1 AND ar.role = 'passenger'",
    [session.sub],
  );
  return (result.rows[0] as { id: string } | undefined) ?? null;
}

function canonicalRequest(payload: {
  pickup: { label: string; latitude: number; longitude: number };
  destination: { label: string; latitude: number; longitude: number };
  vehicleType: string;
  passengerNote: string | null;
}) {
  return JSON.stringify({
    pickup: { label: payload.pickup.label.trim(), latitude: payload.pickup.latitude, longitude: payload.pickup.longitude },
    destination: { label: payload.destination.label.trim(), latitude: payload.destination.latitude, longitude: payload.destination.longitude },
    vehicleType: payload.vehicleType,
    passengerNote: payload.passengerNote,
  });
}

async function rollback(client: PoolClient) {
  try { await client.query("ROLLBACK"); } catch { /* Preserve the original failure. */ }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "A booking payload is required." }, { status: 400 });

  const payload = body as Record<string, unknown>;
  const pickup = payload.pickup as Record<string, unknown> | undefined;
  const destination = payload.destination as Record<string, unknown> | undefined;
  const vehicleType = payload.vehicleType;
  const passengerNote = typeof payload.passengerNote === "string" ? payload.passengerNote.trim() : "";
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();

  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(idempotencyKey)) {
    return NextResponse.json({ error: "A unique Idempotency-Key header (16–128 safe characters) is required.", code: "IDEMPOTENCY_KEY_REQUIRED" }, { status: 400 });
  }
  if (!pickup || !destination ||
      typeof pickup.label !== "string" || pickup.label.trim().length < 2 ||
      typeof destination.label !== "string" || destination.label.trim().length < 2 ||
      !isCoordinate(pickup.latitude) || !isCoordinate(pickup.longitude) ||
      !isCoordinate(destination.latitude) || !isCoordinate(destination.longitude) ||
      Math.abs(pickup.latitude) > 90 || Math.abs(destination.latitude) > 90 ||
      Math.abs(pickup.longitude) > 180 || Math.abs(destination.longitude) > 180 ||
      typeof vehicleType !== "string" || !allowedVehicleTypes.has(vehicleType) || passengerNote.length > 500) {
    return NextResponse.json({ error: "Invalid pickup, destination, vehicle type or passenger note." }, { status: 422 });
  }
  if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) {
    return NextResponse.json({ error: "Booking service is not configured." }, { status: 503 });
  }

  try {
    const passenger = await getPassengerAccount(request);
    if (!passenger) return NextResponse.json({ error: "A verified passenger session is required." }, { status: 401 });
    const normalized = {
      pickup: { label: pickup.label.trim(), latitude: pickup.latitude, longitude: pickup.longitude },
      destination: { label: destination.label.trim(), latitude: destination.latitude, longitude: destination.longitude },
      vehicleType,
      passengerNote: passengerNote || null,
    };
    const requestHash = createHash("sha256").update(canonicalRequest(normalized)).digest("hex");
    const client = await getDatabasePool().connect();

    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        "INSERT INTO bookings (passenger_account_id, vehicle_type, status, pickup_label, pickup_latitude, pickup_longitude, destination_label, destination_latitude, destination_longitude, passenger_note, idempotency_key, request_hash) VALUES ($1, $2, 'requested', $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (passenger_account_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING id, vehicle_type, status, pickup_label, destination_label, created_at",
        [passenger.id, normalized.vehicleType, normalized.pickup.label, normalized.pickup.latitude, normalized.pickup.longitude, normalized.destination.label, normalized.destination.latitude, normalized.destination.longitude, normalized.passengerNote, idempotencyKey, requestHash],
      );
      if (inserted.rowCount === 1) {
        await client.query(
          "INSERT INTO booking_events (booking_id, actor_account_id, event_type, from_status, to_status) VALUES ($1, $2, 'booking_requested', NULL, 'requested')",
          [inserted.rows[0].id, passenger.id],
        );
        await client.query("COMMIT");
        return NextResponse.json({ booking: inserted.rows[0], replayed: false }, { status: 201, headers: { "Cache-Control": "no-store" } });
      }

      const existing = await client.query(
        "SELECT id, vehicle_type, status, pickup_label, destination_label, created_at, request_hash FROM bookings WHERE passenger_account_id = $1 AND idempotency_key = $2",
        [passenger.id, idempotencyKey],
      );
      await client.query("COMMIT");
      const prior = existing.rows[0] as {
        id: string; vehicle_type: string; status: string; pickup_label: string;
        destination_label: string; created_at: Date; request_hash: string;
      } | undefined;
      if (!prior) return NextResponse.json({ error: "Booking retry could not be reconciled.", code: "IDEMPOTENCY_LOOKUP_FAILED" }, { status: 503 });
      if (prior.request_hash !== requestHash) {
        return NextResponse.json({ error: "This Idempotency-Key was already used for a different booking request.", code: "IDEMPOTENCY_KEY_REUSED" }, { status: 409 });
      }
      return NextResponse.json({
        booking: { id: prior.id, vehicle_type: prior.vehicle_type, status: prior.status, pickup_label: prior.pickup_label, destination_label: prior.destination_label, created_at: prior.created_at },
        replayed: true,
      }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      await rollback(client);
      throw error;
    } finally { client.release(); }
  } catch {
    return NextResponse.json({ error: "Booking could not be persisted. No confirmation was issued.", code: "BOOKING_PERSISTENCE_FAILED" }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) return NextResponse.json({ error: "Booking service is not configured." }, { status: 503 });
  try {
    const passenger = await getPassengerAccount(request);
    if (!passenger) return NextResponse.json({ error: "A verified passenger session is required." }, { status: 401 });
    const result = await getDatabasePool().query(
      "SELECT id, vehicle_type, status, pickup_label, destination_label, created_at FROM bookings WHERE passenger_account_id = $1 ORDER BY created_at DESC LIMIT 50",
      [passenger.id],
    );
    return NextResponse.json({ bookings: result.rows }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Booking history is unavailable." }, { status: 503 }); }
}
