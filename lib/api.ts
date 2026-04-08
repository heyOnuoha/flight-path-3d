import axios from "axios";

const CACHE_KEY = "flightpath_api_cache_v1";
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes to prevent rapid exhaustion

export const fetchFlights = async (limit = 100) => {
  // 1. Check valid cache first
  if (typeof window !== "undefined") {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION_MS) {
          console.log(`[CACHE HIT] Using cached flight data. Age: ${Math.round((Date.now() - timestamp) / 1000)}s`);
          return data;
        }
      } catch (e) {
        console.error("Cache parsing error", e);
      }
    }
  }

  // 2. Fetch fresh data
  console.log("[CACHE MISS] Fetching fresh aviation data from proxy...");
  const res = await axios.get(`/api/flights?limit=${limit}`);
  
  // 3. Save to cache
  if (typeof window !== "undefined" && res.data && !res.data.error) {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      data: res.data
    }));
  }
  
  return res.data;
};
