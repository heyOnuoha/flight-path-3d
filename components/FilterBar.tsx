"use client";
import { Filter, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Flight } from "@/lib/types";
import { DEFAULT_FILTERS, collectFacets, type FilterState } from "@/lib/filters";

type Props = {
  flights: Flight[];
  filters: FilterState;
  onChange: (next: FilterState) => void;
};

export function FilterBar({ flights, filters, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const { airlines, aircraftTypes, statuses } = useMemo(() => collectFacets(flights), [flights]);

  const activeCount =
    filters.airlines.size +
    filters.aircraftTypes.size +
    filters.status.size +
    (filters.minAltitudeFt > DEFAULT_FILTERS.minAltitudeFt ? 1 : 0) +
    (filters.maxAltitudeFt < DEFAULT_FILTERS.maxAltitudeFt ? 1 : 0);

  function toggleSet(set: Set<string>, key: string): Set<string> {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }

  return (
    <div className="relative pointer-events-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 font-mono text-xs px-3 py-2 border rounded ${
          activeCount > 0
            ? "bg-[#3D7BFF]/15 border-[#3D7BFF]/50 text-[#3D7BFF]"
            : "bg-black/60 border-[#3D7BFF]/30 text-[#3D7BFF] hover:border-[#3D7BFF]/60"
        }`}
      >
        <Filter className="w-3 h-3" />
        FILTER{activeCount > 0 ? ` · ${activeCount}` : ""}
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 w-80 max-h-[70vh] overflow-y-auto custom-scrollbar bg-black/90 backdrop-blur-md border border-[#3D7BFF]/30 rounded p-4 font-mono text-xs space-y-4 z-20">
          <Section title="STATUS">
            <FacetChips
              options={Array.from(statuses).sort()}
              selected={filters.status}
              onToggle={(k) => onChange({ ...filters, status: toggleSet(filters.status, k) })}
            />
          </Section>

          <Section title="ALTITUDE (FT)">
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                value={filters.minAltitudeFt}
                onChange={(e) =>
                  onChange({ ...filters, minAltitudeFt: Number(e.target.value) || 0 })
                }
                className="w-24 bg-black/60 border border-[#3D7BFF]/30 px-2 py-1 text-[#3D7BFF]"
              />
              <span className="text-gray-500">→</span>
              <input
                type="number"
                value={filters.maxAltitudeFt}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    maxAltitudeFt: Number(e.target.value) || DEFAULT_FILTERS.maxAltitudeFt,
                  })
                }
                className="w-24 bg-black/60 border border-[#3D7BFF]/30 px-2 py-1 text-[#3D7BFF]"
              />
            </div>
          </Section>

          <Section title={`AIRLINE · ${airlines.size}`}>
            <FacetChips
              options={Array.from(airlines.entries())
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([code]) => code)}
              labels={Object.fromEntries(airlines)}
              selected={filters.airlines}
              onToggle={(k) => onChange({ ...filters, airlines: toggleSet(filters.airlines, k) })}
            />
          </Section>

          <Section title={`AIRCRAFT · ${aircraftTypes.size}`}>
            <FacetChips
              options={Array.from(aircraftTypes).sort()}
              selected={filters.aircraftTypes}
              onToggle={(k) =>
                onChange({ ...filters, aircraftTypes: toggleSet(filters.aircraftTypes, k) })
              }
            />
          </Section>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#3D7BFF]/20">
            <button
              onClick={() => onChange(DEFAULT_FILTERS)}
              className="flex items-center gap-1 text-gray-400 hover:text-[#3D7BFF]"
            >
              <X className="w-3 h-3" />
              RESET
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[#3D7BFF]/70 tracking-widest mb-1">{title}</div>
      {children}
    </div>
  );
}

function FacetChips({
  options,
  selected,
  onToggle,
  labels,
}: {
  options: string[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  labels?: Record<string, string>;
}) {
  if (options.length === 0) return <div className="text-gray-500 text-[10px]">—</div>;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {options.map((opt) => {
        const isActive = selected.has(opt);
        return (
          <button
            key={opt}
            onClick={() => onToggle(opt)}
            className={`px-2 py-0.5 rounded border text-[10px] ${
              isActive
                ? "bg-[#3D7BFF]/30 border-[#3D7BFF] text-[#3D7BFF]"
                : "border-[#3D7BFF]/30 text-[#3D7BFF]/80 hover:border-[#3D7BFF]/70"
            }`}
            title={labels?.[opt]}
          >
            {labels?.[opt] || opt}
          </button>
        );
      })}
    </div>
  );
}
