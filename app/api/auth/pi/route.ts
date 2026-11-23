import { NextRequest, NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/db";
import { issueSessionToken, sessionCookieOptions } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }); }

  const accessToken = body && typeof body === "object" ? (body as Record<string, unknown>).accessToken : undefined;
  if (typeof accessToken !== "string" || accessToken.length < 16 || accessToken.length > 4096) {
    return NextResponse.json({ error: "A valid Pi access token is required." }, { status: 400 });
  }
  if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    return NextResponse.json({ error: "Authentication service is not configured." }, { status: 503 });
  }

  let piResponse: Response;
  try {
    piResponse = await fetch("https://api.minepi.com/v2/me", {
      method: "GET",
      headers: { Authorization: "Bearer " + accessToken, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return NextResponse.json({ error: "Pi identity verification service is temporarily unavailable." }, { status: 503 });
  }
  if (!piResponse.ok) return NextResponse.json({ error: "Pi access token was not accepted." }, { status: 401 });

  let piUser: unknown;
  try { piUser = await piResponse.json(); }
  catch { return NextResponse.json({ error: "Pi identity response was invalid." }, { status: 502 }); }

  const user = piUser as { uid?: unknown; username?: unknown };
  if (typeof user.uid !== "string" || user.uid.length < 1 || user.uid.length > 160 ||
      typeof user.username !== "string" || user.username.length < 1 || user.username.length > 100) {
    return NextResponse.json({ error: "Pi identity response did not contain a valid user." }, { status: 502 });
  }

  try {
    const pool = getDatabasePool();
    const result = await pool.query(
      "INSERT INTO accounts (pi_uid, role, display_name) VALUES ($1, 'passenger', $2) ON CONFLICT (pi_uid) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now() RETURNING id, display_name",
      [user.uid, user.username],
    );
    const account = result.rows[0] as { id: string; display_name: string };
    await pool.query(
      "INSERT INTO account_roles (account_id, role) VALUES ($1, 'passenger') ON CONFLICT (account_id, role) DO NOTHING",
      [account.id],
    );
    const token = issueSessionToken({ sub: account.id, username: account.display_name, role: "passenger" });
    const response = NextResponse.json({ authenticated: true, user: { username: account.display_name, role: "passenger" } });
    response.cookies.set("otw_session", token, sessionCookieOptions);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ error: "Could not establish a secure application session." }, { status: 503 });
  }
}
