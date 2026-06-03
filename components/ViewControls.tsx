"use client";
import { Home, Layers, Eye, Map, Image } from "lucide-react";

type Props = {
  mapStyle: "dark" | "light" | "osm" | "satellite";
  onChange: (style: "dark" | "light" | "osm" | "satellite") => void;
  onResetCamera?: () => void;
};

export function ViewControls({ mapStyle, onChange, onResetCamera }: Props) {
  const options: Array<{ mode: "dark" | "light" | "osm" | "satellite"; label: string; icon: React.ReactNode }> = [
    { mode: "dark", label: "DARK", icon: <Layers className="w-3 h-3" /> },
    { mode: "light", label: "LIGHT", icon: <Eye className="w-3 h-3" /> },
    { mode: "osm", label: "ROADS", icon: <Map className="w-3 h-3" /> },
    { mode: "satellite", label: "SATELLITE", icon: <Image className="w-3 h-3" /> },
  ];
  return (
    <div className="pointer-events-auto flex items-stretch gap-2">
      {onResetCamera && (
        <button
          onClick={onResetCamera}
          title="Reset camera to global view"
          className="flex items-center gap-1 px-2.5 py-1.5 bg-black/60 border border-[#3D7BFF]/30 rounded font-mono text-[10px] tracking-widest text-[#3D7BFF]/80 hover:text-[#3D7BFF] hover:border-[#3D7BFF]/70 cursor-pointer"
        >
          <Home className="w-3 h-3" />
          WORLD
        </button>
      )}
      <div className="flex bg-black/60 border border-[#3D7BFF]/30 rounded overflow-hidden">
        {options.map((o) => {
          const active = mapStyle === o.mode;
          return (
            <button
              key={o.label}
              onClick={() => onChange(o.mode)}
              className={`flex items-center gap-1 px-2.5 py-1.5 font-mono text-[10px] tracking-widest transition cursor-pointer ${
                active ? "bg-[#3D7BFF]/20 text-[#3D7BFF] font-bold" : "text-[#3D7BFF]/60 hover:text-[#3D7BFF]"
              }`}
            >
              {o.icon}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

