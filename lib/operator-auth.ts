import { NextRequest, NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";

export type OperatorIdentity = { accountId: string; role: "operator" | "platform_admin" };

export async function requireOperator(request: NextRequest): Promise<
  { identity: OperatorIdentity; response?: never } |
  { identity?: never; response: NextResponse }
> {
  const session = verifySessionToken(request.cookies.get("otw_session")?.value);
  if (!session) {
    return { response: NextResponse.json({ error: "Sign in with an authorized operator account." }, { status: 401 }) };
  }

  try {
    const result = await getDatabasePool().query(
      "SELECT role FROM account_roles WHERE account_id = $1 AND role IN ('operator','platform_admin') ORDER BY CASE role WHEN 'platform_admin' THEN 0 ELSE 1 END LIMIT 1",
      [session.sub],
    );
    const role = result.rows[0]?.role;
    if (role !== "operator" && role !== "platform_admin") {
      return { response: NextResponse.json({ error: "Operator access is not granted to this account." }, { status: 403 }) };
    }
    return { identity: { accountId: session.sub, role } };
  } catch {
    return { response: NextResponse.json({ error: "Operator authorization is temporarily unavailable." }, { status: 503 }) };
  }
}

export function validateSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
