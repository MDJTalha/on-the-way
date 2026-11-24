import { NextResponse } from "next/server";

export type GeocodedPlace = {
  display_name: string;
  lat: string;
  lon: string;
};

const noStore = { "Cache-Control": "no-store" };

function validCoordinates(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

async function mapboxRequest(url: URL): Promise<Response> {
  return fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
}

export async function searchPlaces(query: string) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (token) {
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("limit", "5");
    url.searchParams.set("autocomplete", "true");
    const response = await mapboxRequest(url);
    if (!response.ok) throw new Error("Geocoding provider request failed");
    const data: unknown = await response.json();
    const features = data && typeof data === "object" && Array.isArray((data as { features?: unknown }).features)
      ? (data as { features: unknown[] }).features : [];
    return features.flatMap((feature): GeocodedPlace[] => {
      if (!feature || typeof feature !== "object") return [];
      const item = feature as { place_name?: unknown; center?: unknown };
      const center = Array.isArray(item.center) ? item.center : [];
      const longitude = Number(center[0]);
      const latitude = Number(center[1]);
      if (typeof item.place_name !== "string" || !validCoordinates(latitude, longitude)) return [];
      return [{ display_name: item.place_name, lat: String(latitude), lon: String(longitude) }];
    }).slice(0, 5);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Production geocoding provider is not configured");
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "OnTheWayMobility/1.0 (development geocoding)" },
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error("Development geocoding provider request failed");
  const data: unknown = await response.json();
  if (!Array.isArray(data)) return [];
  return data.flatMap((item): GeocodedPlace[] => {
    if (!item || typeof item !== "object") return [];
    const place = item as { display_name?: unknown; lat?: unknown; lon?: unknown };
    const latitude = Number(place.lat);
    const longitude = Number(place.lon);
    if (typeof place.display_name !== "string" || !validCoordinates(latitude, longitude)) return [];
    return [{ display_name: place.display_name, lat: String(latitude), lon: String(longitude) }];
  }).slice(0, 5);
}

export async function reverseGeocode(latitude: number, longitude: number) {
  if (!validCoordinates(latitude, longitude)) {
    return NextResponse.json({ error: "Valid latitude and longitude are required." }, { status: 422, headers: noStore });
  }

  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (token) {
    const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`);
    url.searchParams.set("access_token", token);
    url.searchParams.set("limit", "1");
    const response = await mapboxRequest(url);
    if (!response.ok) throw new Error("Geocoding provider request failed");
    const data: unknown = await response.json();
    const features = data && typeof data === "object" && Array.isArray((data as { features?: unknown }).features)
      ? (data as { features: unknown[] }).features : [];
    const first = features[0] as { place_name?: unknown } | undefined;
    return NextResponse.json({ display_name: typeof first?.place_name === "string" ? first.place_name : null }, { headers: noStore });
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Production geocoding provider is not configured." }, { status: 503, headers: noStore });
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "jsonv2");
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "OnTheWayMobility/1.0 (development geocoding)" },
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error("Development geocoding provider request failed");
  const data: unknown = await response.json();
  const label = data && typeof data === "object" && typeof (data as { display_name?: unknown }).display_name === "string"
    ? (data as { display_name: string }).display_name : null;
  return NextResponse.json({ display_name: label }, { headers: noStore });
}

export { noStore };
