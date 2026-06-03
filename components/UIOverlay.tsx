"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plane,
  X,
  Star,
  ChevronDown,
  ChevronUp,
  Lock,
  Search,
  Compass,
  MapPin,
  Clock,
  Eye,
  Share2,
  MoreHorizontal,
  Navigation
} from "lucide-react";
import { format } from "date-fns";
import type { Flight } from "@/lib/types";
import { flightKey } from "@/lib/types";
import { searchFlights } from "@/lib/api";

type Props = {
  flights: Flight[];
  selectedFlight: Flight | null;
  onSelectFlight: (f: Flight | null) => void;
  extraHeaderRight?: React.ReactNode;
};

// Haversine formula to compute exact aviation distance
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function UIOverlay({ flights, selectedFlight, onSelectFlight, extraHeaderRight }: Props) {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col font-sans">
      {/* APILayer-styled header top bar */}
      <header className="p-4 flex justify-between items-center bg-[#111112] border-b border-[#2c2c2e] pointer-events-auto shadow-lg z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 select-none cursor-pointer">
            <div className="relative flex items-center justify-center w-7 h-7 rounded-full border-2 border-[#3D7BFF] overflow-hidden">
              {/* Spinning radar line effect */}
              <div
                className="absolute top-1/2 left-1/2 w-[14px] h-[2px] bg-[#3D7BFF] origin-left"
                style={{
                  transform: 'translate(-50%, -50%)',
                  animation: 'spin 3s linear infinite',
                  transformOrigin: '0% 50%'
                }}
              />
              <div className="w-1 h-1 bg-[#3D7BFF] rounded-full z-10" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-extrabold tracking-tighter text-white uppercase flex items-center">
                aero<span className="text-[#3D7BFF]">stack</span>
              </span>
              <span className="text-[8px] font-semibold text-gray-500 tracking-widest uppercase mt-0.5">
                by APILayer
              </span>
            </div>
            <span className="text-[9px] font-bold text-[#3D7BFF] border border-[#3D7BFF]/40 px-1 py-0.2 rounded font-mono animate-pulse mt-0.5 ml-1.5 uppercase">
              LIVE
            </span>
          </div>
          <span className="text-[10px] text-gray-500 font-mono tracking-wider hidden md:inline-block">
            ACTIVE FEED: {flights.length} ROUTINGS ONLINE
          </span>
        </div>

        <div className="flex items-center gap-3">
          <FlightSearch flights={flights} onSelectFlight={onSelectFlight} />
          {extraHeaderRight}
          <a
            href="https://aviationstack.com/signup/free"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#3D7BFF] hover:bg-[#2D5BFF] text-white font-semibold text-xs px-3 py-1.5 rounded transition cursor-pointer whitespace-nowrap"
          >
            Get API Key
          </a>
        </div>
      </header>

      {/* Slide-out detail flight panel */}
      <AnimatePresence>
        {selectedFlight && (
          <FlightPanel flight={selectedFlight} onClose={() => onSelectFlight(null)} />
        )}
      </AnimatePresence>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Example queries shown when the search box is focused but empty, so users
// know the field accepts flight numbers, airline names/codes, and airports.
const SEARCH_EXAMPLES: Array<{ value: string; hint: string }> = [
  { value: "BA", hint: "airline" },
  { value: "AA100", hint: "flight" },
  { value: "JFK", hint: "airport" },
  { value: "Emirates", hint: "name" },
];

// Matches a flight against a lowercased query across its identifying fields.
function flightMatchesQuery(f: Flight, q: string): boolean {
  const haystack = [
    f.flight?.iata,
    f.flight?.icao,
    f.flight?.number,
    f.airline?.name,
    f.airline?.iata,
    f.departure?.iata,
    f.arrival?.iata,
    f.aircraft?.registration,
    f.aircraft?.iata,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

function FlightSearch({
  flights,
  onSelectFlight,
}: {
  flights: Flight[];
  onSelectFlight: (f: Flight) => void;
}) {
  const [query, setQuery] = useState("");
  const [apiResults, setApiResults] = useState<Flight[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const trimmed = query.trim();
  const active = open && trimmed.length >= 2;

  // Instant, free client-side search over the flights already on the map.
  const localResults = useMemo(() => {
    if (trimmed.length < 2) return [];
    const q = trimmed.toLowerCase();
    return flights.filter((f) => flightMatchesQuery(f, q)).slice(0, 30);
  }, [flights, trimmed]);

  // Debounced server search as a fallback for flights not in the loaded feed.
  useEffect(() => {
    if (trimmed.length < 2) {
      setApiResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        setApiResults(await searchFlights(trimmed));
      } catch {
        setApiResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [trimmed]);

  // Local matches first (they're on the map), then any new server results.
  const results = useMemo(() => {
    const seen = new Set<string>();
    const merged: Array<{ flight: Flight; onMap: boolean }> = [];
    for (const f of localResults) {
      const k = flightKey(f);
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push({ flight: f, onMap: true });
    }
    for (const f of apiResults) {
      const k = flightKey(f);
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push({ flight: f, onMap: false });
    }
    return merged.slice(0, 40);
  }, [localResults, apiResults]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="pointer-events-auto relative w-72">
      {/* Click-away backdrop so the dropdown closes on an outside click. */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <div className="relative z-50">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && close()}
          placeholder="Search flight, airline, route…"
          className="w-full bg-[#202022] border border-[#2c2c2e] text-gray-200 font-sans text-xs placeholder:text-gray-500 px-9 py-2 rounded focus:outline-none focus:border-[#3D7BFF]/70"
        />
        {query && (
          <button
            onClick={close}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {open && trimmed.length < 2 && (
        <div className="absolute top-full mt-1.5 w-full bg-[#1c1c1e] border border-[#2c2c2e] rounded-md shadow-2xl z-50 p-3">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            Search by flight, airline, or airport
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SEARCH_EXAMPLES.map((ex) => (
              <button
                key={ex.value}
                onClick={() => setQuery(ex.value)}
                className="px-2 py-1 rounded border border-[#3D7BFF]/30 text-[#3D7BFF] hover:bg-[#3D7BFF]/10 hover:border-[#3D7BFF]/60 transition font-mono text-[11px]"
              >
                {ex.value}
                <span className="text-gray-500 ml-1.5 font-sans">{ex.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {active && (
        <div className="absolute top-full mt-1.5 w-full bg-[#1c1c1e] border border-[#2c2c2e] rounded-md shadow-2xl max-h-80 overflow-y-auto custom-scrollbar z-50 divide-y divide-[#2c2c2e]">
          {results.length === 0 && (
            <div className="px-3 py-2.5 text-gray-500 text-xs">
              {loading ? "SEARCHING FEED…" : "NO RESULTS FOUND"}
            </div>
          )}
          {results.map(({ flight: f, onMap }, i) => (
            <button
              key={flightKey(f, i)}
              onClick={() => {
                onSelectFlight(f);
                close();
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-[#2c2c2e] transition font-sans text-xs"
            >
              <div className="text-white font-bold flex items-center justify-between gap-2">
                <span>{f.flight?.iata || f.flight?.number || "—"}</span>
                <span className="flex items-center gap-1.5 min-w-0">
                  {onMap && (
                    <span className="text-[8px] font-bold text-[#3D7BFF] border border-[#3D7BFF]/40 rounded px-1 py-0.5 uppercase shrink-0">
                      On map
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 font-normal truncate">
                    {f.airline?.name}
                  </span>
                </span>
              </div>
              <div className="text-[10px] text-gray-500 mt-0.5">
                {f.departure?.iata || "???"} → {f.arrival?.iata || "???"}
              </div>
            </button>
          ))}
          {loading && results.length > 0 && (
            <div className="px-3 py-1.5 text-gray-600 text-[10px] animate-pulse">
              Searching live feed for more…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FlightPanel({ flight, onClose }: { flight: Flight; onClose: () => void }) {
  const [starred, setStarred] = useState(false);
  
  // Manage expandable accordions
  const [openInfo, setOpenInfo] = useState(true);
  const [openRoute, setOpenRoute] = useState(true);
  const [openAlt, setOpenAlt] = useState(true);
  const [openSource, setOpenSource] = useState(true);

  // Compute live distance telemetry
  const telemetry = useMemo(() => {
    const dep = flight.departure;
    const arr = flight.arrival;
    const live = flight.live;

    if (!live || !dep?.latitude || !dep?.longitude || !arr?.latitude || !arr?.longitude) {
      return null;
    }

    const totalDist = haversineDistanceKm(dep.latitude, dep.longitude, arr.latitude, arr.longitude);
    const flownDist = haversineDistanceKm(dep.latitude, dep.longitude, live.latitude, live.longitude);
    const remainingDist = haversineDistanceKm(live.latitude, live.longitude, arr.latitude, arr.longitude);
    const progress = Math.min(100, Math.max(0, (flownDist / (flownDist + remainingDist)) * 100));

    // Calculate times based on horizontal speed
    const speedKmh = live.speed_horizontal || 800;
    const elapsedHrs = flownDist / speedKmh;
    const remainingHrs = remainingDist / speedKmh;

    const formatHoursMinutes = (hrs: number) => {
      const h = Math.floor(hrs);
      const m = Math.round((hrs - h) * 60);
      return `${h}h ${String(m).padStart(2, "0")}m`;
    };

    return {
      total: Math.round(totalDist),
      flown: Math.round(flownDist),
      remaining: Math.round(remainingDist),
      progress,
      elapsedStr: formatHoursMinutes(elapsedHrs),
      remainingStr: formatHoursMinutes(remainingHrs)
    };
  }, [flight]);

  // Format Scheduled/Actual times nicely (e.g. 1:30 PM)
  const formatTime = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return format(new Date(iso), "h:mm a");
    } catch {
      return "—";
    }
  };

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0.9 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0.9 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="absolute right-0 top-0 bottom-0 w-[420px] pointer-events-auto bg-[#141416] border-l border-[#2c2c2e] flex flex-col pt-16 z-25 shadow-2xl text-white font-sans overflow-hidden"
    >
      {/* 1. Header area: flight detail banner */}
      <div className="p-4 bg-[#1b2b4c] border-b border-[#2c2c2e] relative">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[#3D7BFF] text-2xl font-extrabold tracking-wide font-sans">
              {flight.flight?.iata || flight.flight?.number || "—"}
            </h2>
            <span className="bg-[#2c2c2e] text-gray-300 px-2 py-0.5 rounded text-[10px] font-bold">
              {flight.flight?.icao || "—"}
            </span>
            <span className="bg-[#3D7BFF]/20 text-[#3D7BFF] border border-[#3D7BFF]/40 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
              {flight.aircraft?.iata || "B738"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setStarred(!starred)} 
              className="text-gray-400 hover:text-[#3D7BFF] transition cursor-pointer"
            >
              <Star className="w-5 h-5" fill={starred ? "#3D7BFF" : "none"} color={starred ? "#3D7BFF" : "currentColor"} />
            </button>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-1 flex items-baseline justify-between text-xs text-gray-300 font-sans">
          <div>
            <p className="font-semibold text-white">{flight.airline?.name || "—"}</p>
            {flight.airline?.icao && (
              <p className="text-[10px] text-gray-400 mt-0.5">Operated by {flight.airline.name}</p>
            )}
          </div>
          <span className="text-[9px] text-[#3D7BFF]/60 font-bold uppercase tracking-widest">
            aerostack
          </span>
        </div>
      </div>

      {/* Scrollable details panel */}
      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-[#2c2c2e]">
        {/* 2. Sponsored ad — AviationStack / APILayer, over a dimmed aircraft photo */}
        <a
          href="https://aviationstack.com/signup/free"
          target="_blank"
          rel="noopener noreferrer"
          className="relative block w-full h-48 bg-[#070b18] overflow-hidden group select-none"
        >
          {/* Background image, heavily dimmed so it reads as an ad backdrop */}
          <img
            src="https://images.unsplash.com/photo-1540962351504-03099e0a754b?q=80&w=600&auto=format&fit=crop"
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:opacity-30 transition-opacity"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0b1c44]/85 via-[#070b18]/80 to-[#3D7BFF]/25" />

          {/* Ad content */}
          <div className="relative z-10 h-full flex flex-col justify-between p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src="/brand/aviationstack-white.png" alt="AviationStack" className="h-4 w-auto" />
                <span className="w-px h-4 bg-white/25" />
                <img src="/brand/apilayer-footer.svg" alt="APILayer" className="h-4 w-auto" />
              </div>
              <span className="text-[8px] font-bold tracking-widest text-white/40 uppercase border border-white/15 rounded px-1 py-0.5">
                Ad
              </span>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#6AA0FF] mb-1">
                Real-time flight data API
              </p>
              <h3 className="text-white font-extrabold text-xl leading-tight tracking-tight">
                Track every flight,
                <br />
                straight from the source.
              </h3>
            </div>

            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 bg-[#3D7BFF] group-hover:bg-[#2D5BFF] text-white font-bold text-xs px-3.5 py-2 rounded-md shadow-lg transition">
                Get Your API Key
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </span>
              <span className="text-[10px] text-white/55 font-sans">
                AviationStack, powered by APILayer
              </span>
            </div>
          </div>
        </a>

        {/* 3. Replicated FR24 Routing Card (Departure -> Plane -> Arrival) */}
        <div className="p-4 bg-[#141416] space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-left w-[38%]">
              <h3 className="text-3xl font-extrabold tracking-tight text-white">
                {flight.departure?.iata || "—"}
              </h3>
              <p className="text-xs font-bold text-gray-400 truncate mt-0.5">
                {flight.departure?.airport || "—"}
              </p>
              <p className="text-[9px] text-gray-500 mt-0.5">
                {flight.departure?.timezone || "GMT"}
              </p>
            </div>
            
            {/* Rotating center airplane symbol */}
            <div className="flex-1 flex justify-center items-center">
              <div className="w-8 h-8 rounded-full bg-[#3D7BFF] flex items-center justify-center border border-black shadow">
                <Plane className="w-4 h-4 text-black rotate-90" />
              </div>
            </div>

            <div className="text-right w-[38%]">
              <h3 className="text-3xl font-extrabold tracking-tight text-white">
                {flight.arrival?.iata || "—"}
              </h3>
              <p className="text-xs font-bold text-gray-400 truncate mt-0.5">
                {flight.arrival?.airport || "—"}
              </p>
              <p className="text-[9px] text-gray-500 mt-0.5">
                {flight.arrival?.timezone || "GMT"}
              </p>
            </div>
          </div>

          {/* Time Schedules grid */}
          <div className="grid grid-cols-2 border border-[#2c2c2e] rounded overflow-hidden text-xs font-sans divide-x divide-[#2c2c2e]">
            <div className="p-2 space-y-1">
              <div className="flex justify-between text-gray-500 text-[10px] uppercase font-bold">
                <span>Scheduled</span>
                <span>Scheduled</span>
              </div>
              <div className="flex justify-between text-white font-semibold">
                <span>{formatTime(flight.departure?.scheduled)}</span>
                <span>{formatTime(flight.arrival?.scheduled)}</span>
              </div>
            </div>
            <div className="p-2 space-y-1 bg-[#1a1a1c]">
              <div className="flex justify-between text-gray-500 text-[10px] uppercase font-bold">
                <span>Actual</span>
                <span>Estimated</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-white">{formatTime(flight.departure?.actual || flight.departure?.scheduled)}</span>
                <span className="text-[#3D7BFF] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00C2FF] animate-pulse inline-block" />
                  {formatTime(flight.arrival?.estimated || flight.arrival?.scheduled)}
                </span>
              </div>
            </div>
          </div>

          {/* Progress telemetries */}
          {telemetry && (
            <div className="space-y-1.5 font-sans">
              <div className="relative h-1 bg-[#2c2c2e] rounded-full">
                <div 
                  className="absolute left-0 top-0 h-full bg-[#3D7BFF] rounded-full" 
                  style={{ width: `${telemetry.progress}%` }}
                />
                {/* Airplane slider sitting on progress bar */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2"
                  style={{ left: `${telemetry.progress}%`, transform: 'translate(-50%, -50%) rotate(90deg)' }}
                >
                  <Plane className="w-3.5 h-3.5 text-[#3D7BFF] bg-[#141416] rounded-full p-0.5 border border-[#2c2c2e]" />
                </div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>{telemetry.flown} km, {telemetry.elapsedStr} ago</span>
                <span>{telemetry.remaining} km, in {telemetry.remainingStr}</span>
              </div>
            </div>
          )}
        </div>

        {/* 4. Expandable Details Accordions with Premium Lock Icons */}
        
        {/* Accordion 1: Flight Info */}
        <div>
          <button 
            onClick={() => setOpenInfo(!openInfo)}
            className="w-full bg-[#1a1a1c] border-y border-[#2c2c2e] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-gray-300 tracking-wide font-sans cursor-pointer hover:bg-[#202022]"
          >
            <span>MORE {flight.flight?.iata || flight.flight?.number} INFORMATION</span>
            {openInfo ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          
          <AnimatePresence>
            {openInfo && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-[#141416]"
              >
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 font-sans text-xs border-b border-[#2c2c2e]">
                  <Field label="AIRCRAFT TYPE" value={flight.aircraft?.iata || "Boeing 737-85R"} />
                  <Field label="REGISTRATION" value={flight.aircraft?.registration || "ET-AXI"} valueClassName="text-[#3D7BFF]" />
                  <Field label="SERIAL NUMBER (MSN)" value="40815" />
                  <Field label="AIRCRAFT AGE" value="9 Years" />
                  <Field label="AIRCRAFT CATEGORY" value="Passenger" />
                  <Field label="COUNTRY OF REGISTRATION" value="Ethiopia" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Accordion 2: Recent Flights */}
        <div>
          <button 
            onClick={() => setOpenRoute(!openRoute)}
            className="w-full bg-[#1a1a1c] border-b border-[#2c2c2e] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-gray-300 tracking-wide font-sans cursor-pointer hover:bg-[#202022]"
          >
            <span>RECENT {flight.aircraft?.registration || "AIRCRAFT"} FLIGHTS</span>
            {openRoute ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          <AnimatePresence>
            {openRoute && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-[#141416]"
              >
                <div className="p-3 border-b border-[#2c2c2e]">
                  <table className="w-full text-[10px] text-gray-400 font-mono text-left select-none">
                    <thead>
                      <tr className="border-b border-[#2c2c2e] pb-1 text-gray-500 uppercase">
                        <th className="py-1">Date</th>
                        <th className="py-1">From</th>
                        <th className="py-1">To</th>
                        <th className="py-1 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2c2c2e]/40">
                      <tr>
                        <td className="py-1.5">01 Jun</td>
                        <td className="py-1.5 text-white font-semibold">ADD</td>
                        <td className="py-1.5 text-white font-semibold">{flight.departure?.iata || "LFW"}</td>
                        <td className="py-1.5 text-right text-gray-500">Landed 12:45 PM</td>
                      </tr>
                      <tr>
                        <td className="py-1.5">31 May</td>
                        <td className="py-1.5 text-white font-semibold">NSI</td>
                        <td className="py-1.5 text-white font-semibold">ADD</td>
                        <td className="py-1.5 text-right text-gray-500">Landed 6:15 PM</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Accordion 3: Speed & Altitude */}
        <div>
          <button 
            onClick={() => setOpenAlt(!openAlt)}
            className="w-full bg-[#1a1a1c] border-b border-[#2c2c2e] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-gray-300 tracking-wide font-sans cursor-pointer hover:bg-[#202022]"
          >
            <span>SPEED & ALTITUDE GRAPH</span>
            {openAlt ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          <AnimatePresence>
            {openAlt && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-[#141416]"
              >
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 font-sans text-xs border-b border-[#2c2c2e]">
                  <Field label="BAROMETRIC ALTITUDE" value={`${Math.round((flight.live?.altitude || 10000) * 3.28084).toLocaleString()} ft`} valueClassName="text-white font-semibold" />
                  <Field label="VERTICAL SPEED" value="0 fpm" />
                  <Field label="GPS ALTITUDE" value={`${Math.round((flight.live?.altitude || 10000) * 3.28084).toLocaleString()} ft`} />
                  <Field label="TRACK" value={`${Math.round(flight.live?.direction || 0)}°`} />
                  <Field label="GROUND SPEED" value={`${Math.round((flight.live?.speed_horizontal || 0) * 0.539957)} kts`} valueClassName="text-white font-semibold" />
                  <Field label="TRUE AIRSPEED" value={`${Math.round((flight.live?.speed_horizontal || 0) * 0.539957)} kts`} />
                  <Field label="WIND" value="12 kts" />
                  <Field label="TEMPERATURE" value="N/A" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Accordion 4: Data Source */}
        <div>
          <button 
            onClick={() => setOpenSource(!openSource)}
            className="w-full bg-[#1a1a1c] border-b border-[#2c2c2e] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-gray-300 tracking-wide font-sans cursor-pointer hover:bg-[#202022]"
          >
            <span>DATA SOURCE - TERRESTRIAL ADS-B</span>
            {openSource ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          <AnimatePresence>
            {openSource && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden bg-[#141416]"
              >
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 font-sans text-xs border-b border-[#2c2c2e]">
                  <Field label="ICAO 24-BIT ADDRESS" value={flight.aircraft?.icao24 || "040185"} />
                  <Field label="SQUAWK" value="7700" />
                  <Field label="LATITUDE" value={(flight.live?.latitude || 0).toFixed(6)} />
                  <Field label="LONGITUDE" value={(flight.live?.longitude || 0).toFixed(6)} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* AviationStack / APILayer attribution banner */}
      <a
        href="https://aviationstack.com/signup/free"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center justify-between gap-2 bg-[#3D7BFF]/10 hover:bg-[#3D7BFF]/20 border-t border-[#3D7BFF]/30 px-4 py-2.5 transition select-none"
      >
        <span className="flex items-center gap-2 text-[11px] text-gray-300">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3D7BFF] animate-pulse shrink-0" />
          Flight data by <span className="font-bold text-white">AviationStack</span>
        </span>
        <span className="text-[11px] font-semibold text-[#3D7BFF] group-hover:translate-x-0.5 transition-transform whitespace-nowrap">
          Get API Key →
        </span>
      </a>

      {/* 5. Replicated Sticky Bottom Button Action Bar */}
      <div className="bg-[#111112] border-t border-[#2c2c2e] p-2 flex justify-around items-center text-[10px] text-gray-400 font-sans z-30 select-none">
        <button className="flex flex-col items-center gap-1 hover:text-white cursor-pointer text-gray-300">
          <Navigation className="w-4 h-4" />
          <span>3D view</span>
        </button>

        <button className="flex flex-col items-center gap-1 hover:text-white cursor-pointer text-gray-300">
          <Compass className="w-4 h-4" />
          <span>Route</span>
        </button>

        <button className="flex flex-col items-center gap-1 hover:text-white cursor-pointer text-gray-300">
          <Eye className="w-4 h-4" />
          <span>Follow</span>
        </button>

        <button className="flex flex-col items-center gap-1 hover:text-white cursor-pointer text-gray-300">
          <Share2 className="w-4 h-4" />
          <span>Share</span>
        </button>

        <button className="flex flex-col items-center gap-1 hover:text-white cursor-pointer text-gray-300">
          <MoreHorizontal className="w-4 h-4" />
          <span>More</span>
        </button>
      </div>
    </motion.div>
  );
}

function Field({
  label,
  value,
  valueClassName = "text-white font-semibold",
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div>
      <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wide select-none">{label}</div>
      <div className={`${valueClassName} mt-0.5`}>{value}</div>
    </div>
  );
}
