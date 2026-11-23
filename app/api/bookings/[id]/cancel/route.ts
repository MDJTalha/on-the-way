import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { getDatabasePool } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function rollback(client: PoolClient) {
  try { await client.query("ROLLBACK"); } catch { /* Keep the original error. */ }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) {
    return NextResponse.json({ error: "Booking service is not configured." }, { status: 503 });
  }

  const session = verifySessionToken(request.cookies.get("otw_session")?.value);
  if (!session) {
    return NextResponse.json({ error: "A verified passenger session is required." }, { status: 401 });
  }

  const { id } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "A valid booking ID is required." }, { status: 400 });
  }

  let client: PoolClient | undefined;
  try {
    client = await getDatabasePool().connect();
    await client.query("BEGIN");
    const result = await client.query(
      "SELECT id, passenger_account_id, vehicle_type, status, pickup_label, destination_label, created_at FROM bookings WHERE id = $1 AND passenger_account_id = $2 FOR UPDATE",
      [id, session.sub],
    );
    const booking = result.rows[0] as {
      id: string; passenger_account_id: string; vehicle_type: string; status: string;
      pickup_label: string; destination_label: string; created_at: Date;
    } | undefined;

    if (!booking) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }

    if (booking.status === "cancelled") {
      await client.query("COMMIT");
      return NextResponse.json({ booking, replayed: true }, { headers: { "Cache-Control": "no-store" } });
    }

    if (!["requested", "matching"].includes(booking.status)) {
      await client.query("ROLLBACK");
      return NextResponse.json({
        error: "This booking can no longer be cancelled in the app. Contact support for assistance.",
        code: "BOOKING_CANCELLATION_NOT_ALLOWED",
      }, { status: 409 });
    }

    const updated = await client.query(
      "UPDATE bookings SET status = 'cancelled', updated_at = now() WHERE id = $1 RETURNING id, vehicle_type, status, pickup_label, destination_label, created_at",
      [id],
    );
    await client.query(
      "INSERT INTO booking_events (booking_id, actor_account_id, event_type, from_status, to_status) VALUES ($1, $2, 'booking_cancelled', $3, 'cancelled')",
      [id, session.sub, booking.status],
    );
    await client.query("COMMIT");
    return NextResponse.json({ booking: updated.rows[0], replayed: false }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    if (client) await rollback(client);
    return NextResponse.json({ error: "Cancellation could not be confirmed. Check ride history before retrying.", code: "BOOKING_CANCELLATION_FAILED" }, { status: 503 });
  } finally {
    client?.release();
  }
}
