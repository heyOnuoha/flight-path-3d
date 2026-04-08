"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plane, MapPin, Clock, Navigation, Info } from "lucide-react";
import { format } from "date-fns";

export function UIOverlay({ selectedFlight, onClearSelection, flightsCount }: { selectedFlight: any, onClearSelection: () => void, flightsCount: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between overflow-hidden">
      {/* Header */}
      <header className="p-6 flex justify-between items-center pointer-events-auto bg-gradient-to-b from-black/80 to-transparent">
        <div>
          <h1 className="text-3xl font-bold tracking-widest text-[#00ffff] uppercase font-mono flex items-center gap-3">
            <Plane className="w-8 h-8" />
            FlightPath3D
          </h1>
          <p className="text-cyan-600/80 font-mono tracking-widest text-sm mt-1">GLOBAL AVIATION TELEMETRY [{flightsCount} ACTIVE ROUTING]</p>
        </div>
      </header>

      {/* Selected Flight Panel */}
      <AnimatePresence>
        {selectedFlight && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute right-0 top-0 bottom-0 w-96 pointer-events-auto bg-[#050510]/80 backdrop-blur-md border-l border-[#00ffff]/30 p-6 flex flex-col pt-24"
          >
            <button 
              onClick={onClearSelection}
              className="absolute top-6 right-6 text-[#00ffff]/70 hover:text-[#00ffff] transition font-mono tracking-wider"
            >
              [X] CLOSE
            </button>

            <div className="mb-8 border-b border-[#00ffff]/20 pb-4">
              <h2 className="text-[#ff9900] text-2xl font-mono mb-1">{selectedFlight.airline?.name || "Unknown Airline"}</h2>
              <div className="flex items-center gap-2 text-cyan-400 font-mono mt-2">
                <span className="bg-[#00ffff]/10 border border-[#00ffff]/30 px-2 py-1 rounded text-sm uppercase">
                  {selectedFlight.flight?.iata || selectedFlight.flight?.number}
                </span>
                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 border border-green-500/30 rounded">
                  {selectedFlight.flight_status?.toUpperCase() || 'ACTIVE'}
                </span>
              </div>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <InfoBlock icon={<Info />} title="AIRCRAFT DETAILS">
                <div className="grid grid-cols-2 gap-4 mt-2 font-mono text-sm">
                  <div>
                    <div className="text-gray-500 text-xs tracking-wider">EQUIPMENT</div>
                    <div className="text-white">{selectedFlight.aircraft?.iata || selectedFlight.flight?.icao || 'B738'}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs tracking-wider">FLIGHT NO</div>
                    <div className="text-white">{selectedFlight.flight?.number || 'N/A'}</div>
                  </div>
                </div>
              </InfoBlock>

              <InfoBlock icon={<MapPin />} title="ROUTE PROGRESS">
                <div className="flex items-center justify-between mt-2 font-mono">
                  <div className="text-center">
                    <div className="text-xl text-white">{selectedFlight.departure?.iata || 'N/A'}</div>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-[#00ffff]/20 via-[#00ffff]/80 to-[#00ffff]/20 mx-4 relative">
                     <motion.div 
                       className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-[#ff9900]"
                       initial={{ left: "0%", x: "-50%" }}
                       animate={{ left: "65%", x: "-50%" }}
                       transition={{ duration: 1.5, ease: "easeOut" }}
                     >
                       <Plane className="w-4 h-4" />
                     </motion.div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl text-white">{selectedFlight.arrival?.iata || 'N/A'}</div>
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-gray-500 font-mono text-center">
                   <span className="w-16">{selectedFlight.departure?.timezone?.split('/')[1]?.replace('_', ' ') || 'Origin'}</span>
                   <span className="w-16">{selectedFlight.arrival?.timezone?.split('/')[1]?.replace('_', ' ') || 'Dest'}</span>
                </div>
              </InfoBlock>

              <InfoBlock icon={<Navigation />} title="TELEMETRY">
                <div className="grid grid-cols-2 gap-4 mt-2 font-mono text-sm">
                  <div>
                    <div className="text-gray-500 text-xs tracking-wider">ALTITUDE</div>
                    <div className="text-[#00ffff]">{Math.round((selectedFlight.live?.altitude || 0) * 3.28084).toLocaleString()} FT</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs tracking-wider">SPEED (AS)</div>
                    <div className="text-[#00ffff]">{Math.round((selectedFlight.live?.speed_horizontal || 0) * 0.539957)} KTS</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs tracking-wider">HEADING</div>
                    <div className="text-[#00ffff]">{Math.round(selectedFlight.live?.direction || 0)}°</div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-xs tracking-wider">LAT / LNG</div>
                    <div className="text-[#00ffff] text-xs">{(selectedFlight.live?.latitude || 0).toFixed(4)}<br/>{(selectedFlight.live?.longitude || 0).toFixed(4)}</div>
                  </div>
                </div>
              </InfoBlock>
              
              <InfoBlock icon={<Clock />} title="SCHEDULE DATA">
                <div className="space-y-3 font-mono text-sm mt-2">
                  <div className="flex justify-between items-center bg-[#00ffff]/5 p-2 rounded">
                    <span className="text-gray-400">DEPARTURE</span>
                    <span className="text-white font-bold">
                      {selectedFlight.departure?.scheduled ? format(new Date(selectedFlight.departure.scheduled), 'HH:mm') : '--:--'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-[#00ffff]/5 p-2 rounded">
                    <span className="text-gray-400">EST ARRIVAL</span>
                    <span className="text-white font-bold">
                      {selectedFlight.arrival?.estimated ? format(new Date(selectedFlight.arrival.estimated), 'HH:mm') : '--:--'}
                    </span>
                  </div>
                </div>
              </InfoBlock>
            </div>
            
            <div className="mt-4 pt-4 border-t border-[#00ffff]/20 text-center font-mono text-[10px] text-gray-500 tracking-widest">
              SYS::DATA_LINK_SECURE // TIMING: {new Date().toISOString()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoBlock({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) {
  return (
    <div className="bg-black/40 border border-[#00ffff]/20 p-4 rounded-sm shadow-[0_0_15px_rgba(0,255,255,0.05)]">
      <div className="flex items-center gap-2 text-[#00ffff]/70 font-mono text-xs mb-3 tracking-widest uppercase">
        <span className="flex items-center justify-center [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}
