import { NextRequest, NextResponse } from "next/server";
import { noStore, reverseGeocode } from "@/lib/geocoding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rawLatitude = request.nextUrl.searchParams.get("lat");
  const rawLongitude = request.nextUrl.searchParams.get("lon");
  const latitude = rawLatitude === null || rawLatitude.trim() === "" ? Number.NaN : Number(rawLatitude);
  const longitude = rawLongitude === null || rawLongitude.trim() === "" ? Number.NaN : Number(rawLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return NextResponse.json({ error: "Valid latitude and longitude are required." }, { status: 422, headers: noStore });
  }
  try {
    return await reverseGeocode(latitude, longitude);
  } catch {
    return NextResponse.json({ error: "Address lookup is temporarily unavailable." }, { status: 503, headers: noStore });
  }
}
