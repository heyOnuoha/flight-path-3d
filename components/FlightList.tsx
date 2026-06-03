"use client";

import { Plane, Compass } from "lucide-react";
import type { Flight } from "@/lib/types";
import { flightKey } from "@/lib/types";

type Props = {
  flights: Flight[];
  selectedFlight: Flight | null;
  onSelectFlight: (f: Flight) => void;
};

export function FlightList({ flights, selectedFlight, onSelectFlight }: Props) {
  const selectedId = selectedFlight ? flightKey(selectedFlight) : null;

  return (
    <div className="pointer-events-auto bg-[#1a1a1c] border-r border-[#2c2c2e] w-80 flex flex-col shadow-2xl z-20">
      <div className="px-4 py-3.5 bg-[#111112] border-b border-[#2c2c2e] font-sans text-xs font-bold tracking-wider text-gray-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="w-4 h-4 text-[#3D7BFF]" />
          <span>ACTIVE FLIGHTS</span>
        </div>
        <span className="bg-[#2c2c2e] text-[#3D7BFF] px-2 py-0.5 rounded font-mono text-[10px]">
          {flights.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-[#2c2c2e]">
        {flights.length === 0 && (
          <div className="px-4 py-8 font-sans text-xs text-gray-500 text-center">
            NO FLIGHTS IN VIEW RANGE
          </div>
        )}
        {flights.map((f, i) => {
          const id = flightKey(f, i);
          const isSelected = id === selectedId;
          const altFt = Math.round((f.live?.altitude || 0) * 3.28084);
          const speedKts = Math.round((f.live?.speed_horizontal || 0) * 0.539957);
          const heading = Math.round(f.live?.direction || 0);

          return (
            <button
              key={id}
              onClick={() => onSelectFlight(f)}
              className={`w-full text-left px-4 py-3 font-sans transition cursor-pointer border-l-4 ${
                isSelected
                  ? "bg-[#242426] border-l-[#00C2FF] shadow-inner"
                  : "border-l-transparent hover:bg-[#202022]"
              }`}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span
                  className={`text-sm font-bold tracking-wide ${
                    isSelected ? "text-[#3D7BFF]" : "text-white"
                  }`}
                >
                  {f.flight?.iata || f.flight?.number || "—"}
                </span>
                <span className="text-[10px] text-gray-400 font-semibold truncate max-w-[120px]">
                  {f.airline?.name || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-300 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-gray-200">
                    {f.departure?.iata || "???"}
                  </span>
                  <span className="text-gray-500">→</span>
                  <span className="font-semibold text-gray-200">
                    {f.arrival?.iata || "???"}
                  </span>
                </div>
                {f.aircraft?.iata && (
                  <span className="bg-[#2c2c2e] text-gray-400 px-1.5 py-0.5 rounded text-[9px] font-mono">
                    {f.aircraft.iata}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono">
                <span>{altFt.toLocaleString()} FT</span>
                <span>{speedKts} KTS</span>
                <span className="flex items-center gap-0.5">
                  <Compass className="w-2.5 h-2.5 shrink-0" />
                  {heading}°
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
