"use client";
import React, { useEffect, useState } from "react";
import Scene from "@/components/Scene";
import { UIOverlay } from "@/components/UIOverlay";
import { fetchFlights } from "@/lib/api";

export default function Home() {
  const [flights, setFlights] = useState<any[]>([]);
  const [selectedFlight, setSelectedFlight] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchFlights(100);
        setFlights(data?.data || []);
      } catch (error) {
        console.error("Failed to load flights", error);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
    // Refresh data roughly every 5 minutes
    const interval = setInterval(loadData, 5 * 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="w-screen h-screen bg-[#050510] flex overflow-hidden">
      {/* 3D Environment Space */}
      <div className="absolute inset-0 z-0">
        <Scene 
          flights={flights} 
          selectedFlight={selectedFlight} 
          onSelectFlight={setSelectedFlight} 
        />
      </div>

      {/* Cyber/Palantir UI Overlay */}
      <UIOverlay 
        selectedFlight={selectedFlight} 
        onClearSelection={() => setSelectedFlight(null)} 
        flightsCount={flights.length}
      />
      
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#050510]/80 backdrop-blur-sm pointer-events-none">
          <div className="text-[#00ffff] font-mono text-2xl animate-pulse flex flex-col items-center tracking-widest text-center">
            <div className="w-20 h-20 border-4 border-t-[#00ffff] border-l-[#ff9900] border-transparent rounded-full animate-spin mb-6"></div>
            INITIALIZING SATELLITE INTERFACE...
          </div>
        </div>
      )}
    </main>
  );
}
