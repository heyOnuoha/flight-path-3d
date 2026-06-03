import type { Flight } from "./types";

export type FilterState = {
  query: string;
  airlines: Set<string>;
  aircraftTypes: Set<string>;
  status: Set<string>;
  minAltitudeFt: number;
  maxAltitudeFt: number;
};

export const DEFAULT_FILTERS: FilterState = {
  query: "",
  airlines: new Set(),
  aircraftTypes: new Set(),
  status: new Set(),
  minAltitudeFt: 0,
  maxAltitudeFt: 60_000,
};

export function matchesFilters(flight: Flight, f: FilterState): boolean {
  if (!flight.live) return false;

  if (f.query) {
    const q = f.query.toLowerCase();
    const haystack = [
      flight.flight?.iata,
      flight.flight?.icao,
      flight.flight?.number,
      flight.airline?.name,
      flight.airline?.iata,
      flight.departure?.iata,
      flight.arrival?.iata,
      flight.aircraft?.iata,
      flight.aircraft?.registration,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }

  if (f.airlines.size > 0) {
    const code = flight.airline?.iata || flight.airline?.icao || "";
    if (!f.airlines.has(code)) return false;
  }

  if (f.aircraftTypes.size > 0) {
    const code = flight.aircraft?.iata || flight.aircraft?.icao || "";
    if (!f.aircraftTypes.has(code)) return false;
  }

  if (f.status.size > 0) {
    if (!flight.flight_status || !f.status.has(flight.flight_status)) return false;
  }

  const altFt = (flight.live.altitude || 0) * 3.28084;
  if (altFt < f.minAltitudeFt || altFt > f.maxAltitudeFt) return false;

  return true;
}

export function collectFacets(flights: Flight[]) {
  const airlines = new Map<string, string>(); // code → display name
  const aircraftTypes = new Set<string>();
  const statuses = new Set<string>();

  for (const f of flights) {
    const airlineCode = f.airline?.iata || f.airline?.icao;
    if (airlineCode) {
      airlines.set(airlineCode, f.airline?.name || airlineCode);
    }
    const ac = f.aircraft?.iata || f.aircraft?.icao;
    if (ac) aircraftTypes.add(ac);
    if (f.flight_status) statuses.add(f.flight_status);
  }

  return { airlines, aircraftTypes, statuses };
}
