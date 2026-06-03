export type Flight = {
  flight_date: string | null;
  flight_status: string | null;
  airline: { name: string | null; iata: string | null; icao: string | null } | null;
  flight: {
    number: string | null;
    iata: string | null;
    icao: string | null;
    codeshared: unknown;
  } | null;
  aircraft: {
    registration: string | null;
    iata: string | null;
    icao: string | null;
    icao24: string | null;
  } | null;
  departure: AirportRef | null;
  arrival: AirportRef | null;
  live: LiveTelemetry | null;
};

export type AirportRef = {
  airport: string | null;
  timezone: string | null;
  iata: string | null;
  icao: string | null;
  terminal: string | null;
  gate: string | null;
  delay: number | null;
  scheduled: string | null;
  estimated: string | null;
  actual: string | null;
  // Enriched server-side from lib/airports.json (may be missing if airports.json is empty)
  latitude?: number;
  longitude?: number;
};

export type LiveTelemetry = {
  updated: string;
  latitude: number;
  longitude: number;
  altitude: number;
  direction: number;
  speed_horizontal: number;
  speed_vertical: number;
  is_ground: boolean;
} | null;

// Stable identity for a flight that does NOT depend on its (constantly moving)
// position — otherwise every poll would mint a new key, churn the marker, and
// break selection matching. Registration is most stable; fall back to the route
// pair, then the caller-supplied index.
export function flightKey(f: Flight, idx?: number): string {
  const base = f.flight?.iata || f.flight?.icao || f.flight?.number || "F";
  const route =
    f.departure?.iata && f.arrival?.iata ? `${f.departure.iata}-${f.arrival.iata}` : null;
  const suffix = f.aircraft?.registration || route || (idx ?? 0);
  return `${base}-${suffix}`;
}
