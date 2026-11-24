import { NextRequest, NextResponse } from "next/server";
import { noStore, searchPlaces } from "@/lib/geocoding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3 || query.length > 180) {
    return NextResponse.json({ error: "Search text must contain 3 to 180 characters." }, { status: 422, headers: noStore });
  }
  try {
    const results = await searchPlaces(query);
    return NextResponse.json({ results }, { headers: noStore });
  } catch {
    const configured = Boolean(process.env.MAPBOX_ACCESS_TOKEN);
    const missingProductionConfig = process.env.NODE_ENV === "production" && !configured;
    return NextResponse.json({
      error: missingProductionConfig ? "Production geocoding is not configured." : "Place search is temporarily unavailable.",
      code: missingProductionConfig ? "GEOCODING_NOT_CONFIGURED" : "GEOCODING_UNAVAILABLE",
    }, { status: 503, headers: noStore });
  }
}
