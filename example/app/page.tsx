'use client'

import React, { useState, useEffect } from 'react'
import { Scene } from '@/components/three/Scene'
import { fetchLiveFlights, FlightData } from '@/lib/api/aviationstack'
import { Plane, RefreshCw, Satellite, Navigation, ArrowLeft, Image as ImageIcon } from 'lucide-react'

export default function Home() {
  const [flights, setFlights] = useState<FlightData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFlight, setSelectedFlight] = useState<FlightData | null>(null)

  const loadFlights = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/flights')
      const data = await response.json()
      setFlights(data)
      setError(null)
    } catch (err) {
      console.error(err)
      setError("Failed to fetch flight data. Check your API key.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFlights()
  }, [])

  return (
    <main className="flex flex-col h-screen w-full overflow-hidden bg-slate-950 font-sans">
      <div className="flex-1 relative">
        <Scene flights={flights} selectedFlight={selectedFlight} onSelectFlight={setSelectedFlight} />
        
        {/* Right Sidebar - Flight List Overlay */}
        <div className="absolute top-0 right-0 w-80 h-full p-4 pointer-events-none">
          <div className="h-full flex flex-col gap-4 pointer-events-auto">
            
            {selectedFlight ? (
              // --- SELECTED FLIGHT VIEW ---
              <div className="p-4 rounded-xl backdrop-blur-md bg-black/80 border border-blue-500/30 shadow-2xl overflow-y-auto max-h-[calc(100%-100px)]">
                <button 
                  onClick={() => setSelectedFlight(null)} 
                  className="flex items-center gap-2 text-xs text-blue-400 mb-4 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to all flights
                </button>
                
                {/* Airplane Image Placeholder */}
                <div className="w-full h-32 rounded-lg bg-slate-800 mb-4 overflow-hidden relative flex items-center justify-center border border-white/10 group">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10"></div>
                  <ImageIcon className="w-8 h-8 text-white/20" />
                  <div className="absolute bottom-2 left-3 z-20">
                    <span className="text-white font-bold text-lg">{selectedFlight.flight.iata}</span>
                    <span className="block text-white/70 text-xs">{selectedFlight.airline.name}</span>
                  </div>
                </div>

                {/* Route Information */}
                <div className="bg-white/5 rounded-lg p-3 border border-white/5 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-xl font-bold text-white">{selectedFlight.departure.airport}</div>
                    <Plane className="w-4 h-4 text-white/40" />
                    <div className="text-xl font-bold text-white">{selectedFlight.arrival.airport}</div>
                  </div>
                  <div className="flex justify-between text-[10px] text-white/50 uppercase">
                    <div>{selectedFlight.departure.timezone?.split('/')[1] || 'Unknown'}</div>
                    <div>{selectedFlight.arrival.timezone?.split('/')[1] || 'Unknown'}</div>
                  </div>
                </div>

                {/* Live Telemetry */}
                <h4 className="text-white/60 text-[10px] tracking-wider uppercase mb-2">Live Telemetry</h4>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-blue-500/10 rounded-lg p-2 border border-blue-500/20">
                    <div className="text-[10px] text-blue-300/70 mb-1 uppercase">Altitude</div>
                    <div className="text-white font-mono text-sm">{selectedFlight.live?.altitude ? `${Math.round(selectedFlight.live.altitude)} ft` : 'N/A'}</div>
                  </div>
                  <div className="bg-blue-500/10 rounded-lg p-2 border border-blue-500/20">
                    <div className="text-[10px] text-blue-300/70 mb-1 uppercase">Speed</div>
                    <div className="text-white font-mono text-sm">{selectedFlight.live?.speed_horizontal ? `${Math.round(selectedFlight.live.speed_horizontal)} km/h` : 'N/A'}</div>
                  </div>
                  <div className="bg-blue-500/10 rounded-lg p-2 border border-blue-500/20">
                    <div className="text-[10px] text-blue-300/70 mb-1 uppercase">Heading</div>
                    <div className="text-white font-mono text-sm">{selectedFlight.live?.direction ? `${Math.round(selectedFlight.live.direction)}°` : 'N/A'}</div>
                  </div>
                  <div className="bg-blue-500/10 rounded-lg p-2 border border-blue-500/20">
                    <div className="text-[10px] text-blue-300/70 mb-1 uppercase">Lat/Lon</div>
                    <div className="text-white font-mono text-[10px] mt-0.5">
                      {selectedFlight.live ? `${selectedFlight.live.latitude.toFixed(2)}, ${selectedFlight.live.longitude.toFixed(2)}` : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // --- ALL FLIGHTS VIEW ---
              <div className="p-4 rounded-xl backdrop-blur-md bg-black/60 border border-white/10 shadow-2xl overflow-y-auto max-h-[calc(100%-100px)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-blue-400" />
                    Active Flights
                  </h3>
                  <button 
                    onClick={loadFlights}
                    disabled={loading}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/70 transition-colors disabled:opacity-50"
                    aria-label="Refresh"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {loading && flights.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 opacity-50">
                    <RefreshCw className="w-8 h-8 text-white animate-spin" />
                    <p className="text-white text-xs">Fetching global traffic...</p>
                  </div>
                ) : flights.length === 0 ? (
                  <div className="text-white/40 text-sm text-center py-10 italic">
                    No active flights found.
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {flights.map((flight, idx) => (
                      <div 
                        key={`${flight.flight.iata}-${idx}`}
                        onClick={() => setSelectedFlight(flight)}
                        className="p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col">
                            <span className="text-blue-400 font-bold text-sm tracking-widest">{flight.flight.iata}</span>
                            <span className="text-white/60 text-[10px] uppercase truncate max-w-[140px]">{flight.airline.name}</span>
                          </div>
                          <Plane className="w-4 h-4 text-white/20 group-hover:text-blue-400/50 transition-colors" />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-white/40 border-t border-white/5 pt-2">
                          <div className="flex flex-col">
                            <span className="text-white/60">{flight.departure.airport}</span>
                            <span>DEP</span>
                          </div>
                          <div className="flex-1 mx-2 h-[1px] bg-white/10 relative">
                             <div className="absolute -top-[2px] right-0 w-1 h-1 rounded-full bg-white/20"></div>
                          </div>
                          <div className="flex flex-col items-end text-right">
                            <span className="text-white/60">{flight.arrival.airport}</span>
                            <span>ARR</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Stats Card */}
            <div className="mt-auto p-4 rounded-xl backdrop-blur-md bg-blue-600/20 border border-blue-400/30 text-white shadow-lg">
              <div className="flex items-center gap-3">
                <Satellite className="w-5 h-5 text-blue-300" />
                <div>
                  <div className="text-[10px] opacity-70 uppercase font-bold tracking-wider">Tracking Resolution</div>
                  <div className="text-sm font-medium">Real-time Aviationstack Data</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Legend Footer */}
      <footer className="h-12 bg-black border-t border-white/10 flex items-center px-6 text-[10px] text-white/40 uppercase tracking-[0.2em]">
        <span>FlightPath3D</span>
        <div className="w-[1px] h-3 bg-white/10 mx-4"></div>
        <span>OpenSky Network Proxy</span>
        <div className="w-[1px] h-3 bg-white/10 mx-4"></div>
        <span>Three.js Engine 0.17x</span>
        <div className="ml-auto flex items-center gap-4">
          <span className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> System Active
          </span>
        </div>
      </footer>

      {error && !loading && (
        <div className="fixed bottom-16 left-4 right-4 bg-red-500/90 text-white p-3 rounded-lg backdrop-blur-md text-sm sm:left-auto sm:w-80 shadow-2xl animate-in slide-in-from-bottom-5">
           Error: {error}
        </div>
      )}
    </main>
  )
}
