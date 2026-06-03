"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { UIOverlay } from "@/components/UIOverlay";
import { FlightList } from "@/components/FlightList";
import { FilterBar } from "@/components/FilterBar";
import { ViewControls } from "@/components/ViewControls";
import { AirportPanel } from "@/components/AirportPanel";
import { fetchFlights, FlightsApiError } from "@/lib/api";
import { loadCachedFlights, saveCachedFlights } from "@/lib/flight-cache";
import { type Flight } from "@/lib/types";
import { DEFAULT_FILTERS, matchesFilters, type FilterState } from "@/lib/filters";
const Map2D = dynamic(() => import("@/components/Map2D"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#050510]" />,
});

export default function Home() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [mapStyle, setMapStyle] = useState<"dark" | "light" | "osm" | "satellite">("dark");
  const [homeTrigger, setHomeTrigger] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);

  // List panel shows whatever the filter bar passes — no viewport restriction.
  const visibleFlights = useMemo(
    () => flights.filter((f) => matchesFilters(f, filters)),
    [flights, filters]
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let hasFlights = false;

    // Show last session's flights immediately on reload, so the map is never
    // blank while the first refresh is in flight (or if it comes back empty).
    const cached = loadCachedFlights();
    if (cached && cached.length > 0) setFlights(cached);

    async function loadData() {
      try {
        const data = await fetchFlights();
        if (cancelled) return;
        // Only swap in a fresh feed when it actually has flights. An occasional
        // empty/sparse refresh (few flights carry live positions) would
        // otherwise wipe every plane off the map until the next good poll.
        const next = data?.data ?? [];
        if (next.length > 0) {
          setFlights(next);
          saveCachedFlights(next);
          hasFlights = true;
        }
        setApiError(null);
      } catch (error) {
        if (cancelled) return;
        const msg =
          error instanceof FlightsApiError
            ? error.status === 429
              ? error.code === "client_rate_limited"
                ? "You're refreshing too fast. The map will resume on the next cycle."
                : "Aviationstack monthly quota reached. The map will keep working with cached data."
              : error.message
            : "Network error while loading flights.";
        setApiError(msg);
        console.error(error);
      } finally {
        if (!cancelled) {
          // Retry quickly until the first feed actually arrives (covers a
          // reload landing on a slow or fluke-empty response), then settle into
          // the 2-min poll matching the server revalidate window
          // (DEFAULT_FEED_REVALIDATE_S = 120). Polls inside that window are
          // cache hits; only the first after it expires hits Aviationstack.
          timer = setTimeout(loadData, hasFlights ? 2 * 60_000 : 6_000);
        }
      }
    }
    loadData();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const handleSelectFlight = useCallback((f: Flight | null) => {
    setSelectedFlight(f);
    if (f) setSelectedAirport(null);
  }, []);
  const handleSelectAirport = useCallback((iata: string) => {
    setSelectedAirport(iata);
    setSelectedFlight(null);
  }, []);
  const handleResetCamera = useCallback(() => {
    setSelectedFlight(null);
    setSelectedAirport(null);
    setHomeTrigger((n) => n + 1);
  }, []);

  return (
    <main className="w-screen h-screen bg-[#050510] flex overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Map2D
          flights={flights}
          filters={filters}
          selectedFlight={selectedFlight}
          mapStyle={mapStyle}
          homeTrigger={homeTrigger}
          onSelectFlight={handleSelectFlight}
          onSelectAirport={handleSelectAirport}
        />
      </div>

      <div className="absolute inset-0 z-10 flex pointer-events-none">
        <FlightList
          flights={visibleFlights}
          selectedFlight={selectedFlight}
          onSelectFlight={handleSelectFlight}
        />
        <AirportPanel
          iata={selectedAirport}
          flights={flights}
          onClose={() => setSelectedAirport(null)}
          onSelectFlight={handleSelectFlight}
        />
        <div className="flex-1 relative pointer-events-none">
          <UIOverlay
            flights={flights}
            selectedFlight={selectedFlight}
            onSelectFlight={handleSelectFlight}
            extraHeaderRight={
              <div className="flex items-center gap-3 pointer-events-auto">
                <FilterBar flights={flights} filters={filters} onChange={setFilters} />
                <ViewControls
                  mapStyle={mapStyle}
                  onChange={setMapStyle}
                  onResetCamera={handleResetCamera}
                />
              </div>
            }
          />
        </div>
      </div>

      {apiError && (
        <ErrorBanner message={apiError} onDismiss={() => setApiError(null)} />
      )}

      <AttributionBanner />
    </main>
  );
}

// Sponsored ad for the AviationStack/APILayer data source. A slim 4:0.4 (10:1)
// banner, 420×42, pinned bottom-center clear of the left flight list and the
// bottom-right map zoom controls.
function AttributionBanner() {
  return (
    <a
      href="https://aviationstack.com/signup/free"
      target="_blank"
      rel="noopener noreferrer"
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-auto group block w-[420px] h-[42px] rounded-lg overflow-hidden shadow-2xl border border-[#3D7BFF]/30 hover:border-[#3D7BFF]/70 transition select-none"
    >
      <img
        src="https://images.unsplash.com/photo-1540962351504-03099e0a754b?q=80&w=600&auto=format&fit=crop"
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:opacity-30 transition-opacity"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b1c44]/90 via-[#070b18]/85 to-[#3D7BFF]/30" />

      <div className="relative z-10 h-full flex items-center justify-between gap-2 px-3">
        <div className="flex items-center gap-2 shrink-0">
          <img src="/brand/aviationstack-white.png" alt="AviationStack" className="h-3 w-auto" />
          <span className="w-px h-3 bg-white/25" />
          <img src="/brand/apilayer-footer.svg" alt="APILayer" className="h-3 w-auto" />
        </div>
        <span className="text-[10px] text-white/65 font-sans truncate hidden sm:inline">
          Real-time flight data API
        </span>
        <span className="shrink-0 inline-flex items-center gap-1 bg-[#3D7BFF] group-hover:bg-[#2D5BFF] text-white font-bold text-[10px] px-2.5 py-1 rounded shadow transition">
          Get API Key
          <span className="group-hover:translate-x-0.5 transition-transform">→</span>
        </span>
      </div>
    </a>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 pointer-events-auto bg-amber-500/10 border border-amber-400/60 backdrop-blur-md text-amber-200 font-mono text-xs px-4 py-2 rounded flex items-center gap-3 max-w-2xl">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="hover:text-amber-100">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
