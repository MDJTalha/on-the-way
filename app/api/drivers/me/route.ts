import { NextRequest, NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get("otw_session")?.value);
  if (!session) return NextResponse.json({ error: "Sign in with Pi to view driver application status." }, { status: 401 });
  try {
    const result = await getDatabasePool().query(
      "SELECT verification_status, availability_status, service_city, service_country_code, preferred_vehicle_type, application_submitted_at FROM driver_profiles WHERE account_id = $1",
      [session.sub],
    );
    if (!result.rows[0]) return NextResponse.json({ application: null }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ application: result.rows[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Driver application status is unavailable." }, { status: 503 });
  }
}
