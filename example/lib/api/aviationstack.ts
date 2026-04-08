export interface FlightData {
  flight: {
    number: string;
    iata: string;
  };
  airline: {
    name: string;
  };
  live: {
    latitude: number;
    longitude: number;
    altitude: number;
    direction: number;
    speed_horizontal: number;
  } | null;
  departure: {
    airport: string;
    timezone: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  arrival: {
    airport: string;
    timezone: string;
    latitude?: number | null;
    longitude?: number | null;
  };
}

const MOCK_FLIGHTS: FlightData[] = [
  {
    flight: { number: "123", iata: "BA123" },
    airline: { name: "British Airways" },
    live: { latitude: 51.47, longitude: -0.45, altitude: 10000, direction: 90, speed_horizontal: 850 },
    departure: { airport: "LHR", timezone: "Europe/London", latitude: 51.47, longitude: -0.45 },
    arrival: { airport: "DXB", timezone: "Asia/Dubai", latitude: 25.25, longitude: 55.36 }
  },
  {
    flight: { number: "456", iata: "AA456" },
    airline: { name: "American Airlines" },
    live: { latitude: 40.64, longitude: -73.77, altitude: 9500, direction: 270, speed_horizontal: 820 },
    departure: { airport: "JFK", timezone: "America/New_York", latitude: 40.64, longitude: -73.77 },
    arrival: { airport: "LAX", timezone: "America/Los_Angeles", latitude: 33.94, longitude: -118.40 }
  },
  {
    flight: { number: "789", iata: "QF789" },
    airline: { name: "Qantas" },
    live: { latitude: -33.94, longitude: 151.17, altitude: 11000, direction: 315, speed_horizontal: 880 },
    departure: { airport: "SYD", timezone: "Australia/Sydney", latitude: -33.94, longitude: 151.17 },
    arrival: { airport: "SIN", timezone: "Asia/Singapore", latitude: 1.36, longitude: 103.98 }
  },
  {
    flight: { number: "101", iata: "EK101" },
    airline: { name: "Emirates" },
    live: { latitude: 25.25, longitude: 55.36, altitude: 10500, direction: 330, speed_horizontal: 860 },
    departure: { airport: "DXB", timezone: "Asia/Dubai", latitude: 25.25, longitude: 55.36 },
    arrival: { airport: "LHR", timezone: "Europe/London", latitude: 51.47, longitude: -0.45 }
  },
  {
    flight: { number: "202", iata: "AF202" },
    airline: { name: "Air France" },
    live: { latitude: 49.00, longitude: 2.55, altitude: 9800, direction: 180, speed_horizontal: 800 },
    departure: { airport: "CDG", timezone: "Europe/Paris", latitude: 49.00, longitude: 2.55 },
    arrival: { airport: "CPT", timezone: "Africa/Johannesburg", latitude: -33.97, longitude: 18.60 }
  }
];

export async function fetchLiveFlights(limit: number = 5): Promise<FlightData[]> {
  // Always use mock data while developing/testing features
  const USE_MOCK = true;

  if (USE_MOCK) {
    console.log("Using Mock AviationStack Data");
    // Return a sliced version of mock flights depending on limit
    return MOCK_FLIGHTS.slice(0, limit);
  }

  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  if (!apiKey) {
    console.error("AVIATIONSTACK_API_KEY is not defined");
    return MOCK_FLIGHTS; // Fallback to mock if no API key
  }

  try {
    const response = await fetch(`https://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_status=active&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch flights: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data || [];
  } catch (error) {
    console.error("Error fetching flights:", error);
    return MOCK_FLIGHTS; // Fallback to mock on error
  }
}
