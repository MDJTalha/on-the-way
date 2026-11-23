import { NextResponse } from "next/server";
import { getDatabasePool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ status: "degraded", service: "on-the-way-api", database: "not_configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    await getDatabasePool().query("SELECT 1");
    return NextResponse.json({ status: "ok", service: "on-the-way-api", database: "connected" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "degraded", service: "on-the-way-api", database: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
