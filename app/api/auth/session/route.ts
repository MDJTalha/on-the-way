import { NextRequest, NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get("otw_session")?.value);
  if (!session || !process.env.DATABASE_URL) {
    return NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const result = await getDatabasePool().query(
      "SELECT a.id, a.display_name FROM accounts a INNER JOIN account_roles ar ON ar.account_id = a.id WHERE a.id = $1 AND ar.role = 'passenger'",
      [session.sub],
    );
    const account = result.rows[0] as { id: string; display_name: string } | undefined;
    if (!account) return NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ authenticated: true, user: { username: account.display_name, role: "passenger" } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Session service is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
