import data from "./airports.json";

export type Airport = {
  name: string;
  iata: string | null;
  icao: string | null;
  lat: number;
  lon: number;
  tz: string | null;
  country: string | null;
};

type AirportDb = {
  byIata: Record<string, Airport>;
  byIcao: Record<string, Airport>;
};

const db = data as AirportDb;

export function getAirport(iata?: string | null, icao?: string | null): Airport | null {
  if (iata && db.byIata[iata]) return db.byIata[iata];
  if (icao && db.byIcao[icao]) return db.byIcao[icao];
  return null;
}

export function airportsAvailable(): boolean {
  return Object.keys(db.byIata).length > 0;
}

export type LatLonRect = { west: number; south: number; east: number; north: number };

/**
 * Return airports inside a degree-bounded rectangle, sorted by squared distance
 * to the rectangle's center. Only IATA-coded airports are returned (commercial),
 * because they're the meaningful ones for `dep_iata=` Aviationstack queries.
 */
export function findAirportsInRect(rect: LatLonRect, limit = 5): Airport[] {
  const matches: Array<{ airport: Airport; d2: number }> = [];
  const cx = (rect.west + rect.east) / 2;
  const cy = (rect.south + rect.north) / 2;

  for (const a of Object.values(db.byIata)) {
    if (!a.iata) continue;
    let west = rect.west;
    let east = rect.east;
    // Handle antimeridian: if east < west, the rect crosses 180°. Match if
    // lon >= west OR lon <= east.
    const crossesAntimeridian = east < west;
    const inLon = crossesAntimeridian
      ? a.lon >= west || a.lon <= east
      : a.lon >= west && a.lon <= east;
    const inLat = a.lat >= rect.south && a.lat <= rect.north;
    if (!inLon || !inLat) continue;
    const dx = a.lon - cx;
    const dy = a.lat - cy;
    matches.push({ airport: a, d2: dx * dx + dy * dy });
    void west;
    void east;
  }

  matches.sort((a, b) => a.d2 - b.d2);
  return matches.slice(0, limit).map((m) => m.airport);
}

