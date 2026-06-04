"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Building2, PlaneTakeoff, PlaneLanding, X } from "lucide-react";
import { format } from "date-fns";
import type { Flight } from "@/lib/types";

type Props = {
  iata: string | null;
  flights: Flight[];
  onClose: () => void;
  onSelectFlight: (f: Flight) => void;
};

export function AirportPanel({ iata, flights, onClose, onSelectFlight }: Props) {
  const departures = iata ? flights.filter((f) => f.departure?.iata === iata) : [];
  const arrivals = iata ? flights.filter((f) => f.arrival?.iata === iata) : [];
  const airportInfo = iata
    ? flights.find((f) => f.departure?.iata === iata)?.departure ??
      flights.find((f) => f.arrival?.iata === iata)?.arrival
    : null;

  return (
    <AnimatePresence>
      {iata && (
        <motion.div
          initial={{ x: "-100%", opacity: 0.9 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "-100%", opacity: 0.9 }}
          transition={{ type: "spring", damping: 26, stiffness: 200 }}
          className="absolute left-0 w-full sm:left-80 sm:w-96 top-0 bottom-0 pointer-events-auto bg-[#141416] border-r border-[#2c2c2e] p-6 flex flex-col z-20 shadow-2xl pt-16 font-sans text-white"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="border-b border-[#2c2c2e] pb-4 mb-4 select-none">
            <div className="flex items-center gap-1.5 text-gray-400 font-sans text-[10px] font-bold uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5 text-[#3D7BFF]" />
              <span>AIRPORT INFORMATION</span>
            </div>
            <div className="text-3xl font-extrabold text-[#3D7BFF] font-sans mt-2">{iata}</div>
            <div className="text-gray-300 text-sm font-semibold mt-1">
              {airportInfo?.airport || "Unknown International Airport"}
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-1 uppercase">
              TIMEZONE: {airportInfo?.timezone || "UTC"}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
            <FlightSection
              icon={<PlaneTakeoff className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              title="DEPARTURES"
              count={departures.length}
              flights={departures}
              dir="dep"
              onSelectFlight={onSelectFlight}
            />
            <FlightSection
              icon={<PlaneLanding className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
              title="ARRIVALS"
              count={arrivals.length}
              flights={arrivals}
              dir="arr"
              onSelectFlight={onSelectFlight}
            />
          </div>

          <div className="mt-4 pt-3 border-t border-[#2c2c2e] text-[9px] text-gray-500 font-mono select-none uppercase">
            FEED BOUNDS: Active flights only.
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FlightSection({
  icon,
  title,
  count,
  flights,
  dir,
  onSelectFlight,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  flights: Flight[];
  dir: "dep" | "arr";
  onSelectFlight: (f: Flight) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-gray-300 font-sans text-xs font-bold tracking-wider select-none">
        <div className="flex items-center gap-1.5">
          {icon}
          <span>{title}</span>
        </div>
        <span className="bg-[#2c2c2e] text-gray-400 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
          {count}
        </span>
      </div>
      {flights.length === 0 ? (
        <div className="text-[10px] text-gray-500 font-mono py-1">NO DIRECT ROUTING IN FEED</div>
      ) : (
        <div className="space-y-1.5 divide-y divide-[#2c2c2e]/40">
          {flights.map((f, i) => {
            const otherEnd = dir === "dep" ? f.arrival : f.departure;
            const scheduled =
              dir === "dep" ? f.departure?.scheduled : f.arrival?.estimated || f.arrival?.scheduled;
            let timeStr = "--:--";
            if (scheduled) {
              try {
                timeStr = format(new Date(scheduled), "HH:mm");
              } catch {}
            }
            return (
              <button
                key={f.flight?.iata || f.flight?.number || i}
                onClick={() => onSelectFlight(f)}
                className="w-full text-left pt-2 pb-1 font-sans hover:bg-[#202022]/40 rounded-sm transition cursor-pointer flex items-center justify-between group"
              >
                <div>
                  <div className="text-white font-bold text-xs group-hover:text-[#3D7BFF] transition">
                    {f.flight?.iata || f.flight?.number || "—"}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                    <span>{dir === "dep" ? "→" : "←"}</span>
                    <span className="font-semibold text-gray-300">{otherEnd?.iata || "???"}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[#3D7BFF] font-mono text-xs font-semibold">{timeStr}</div>
                  <div className="text-[9px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.2 rounded font-sans uppercase mt-0.5 font-bold scale-[0.9] origin-right">
                    {f.flight_status || "Active"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
