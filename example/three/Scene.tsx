'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars, PerspectiveCamera, Environment } from '@react-three/drei'
import { Globe } from './Globe'
import { FlightMarker } from './FlightMarker'
import { FlightData } from '@/lib/api/aviationstack'

interface SceneProps {
  flights: FlightData[]
  selectedFlight: FlightData | null
  onSelectFlight: (flight: FlightData | null) => void
}

export function Scene({ flights, selectedFlight, onSelectFlight }: SceneProps) {
  return (
    <div className="w-full h-full relative bg-slate-950">
      <Canvas shadows legacy={false}>
        <Suspense fallback={null}>
          <PerspectiveCamera makeDefault position={[0, 0, 15]} fov={45} />
          <OrbitControls 
            enablePan={false} 
            minDistance={8} 
            maxDistance={25} 
            makeDefault
            autoRotate
            autoRotateSpeed={0.5}
          />
          
          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1.5} />
          <spotLight position={[-10, 20, 10]} angle={0.15} penumbra={1} intensity={1} />
          
          {/* Stars & Atmosphere */}
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <Environment preset="night" />
          
          <Globe />
          
          {/* Active Flights */}
          {flights.map((flight, idx) => {
            const isSelected = selectedFlight?.flight.iata === flight.flight.iata;
            return flight.live ? (
              <FlightMarker 
                key={`${flight.flight.iata}-${idx}`}
                lat={flight.live.latitude}
                lon={flight.live.longitude}
                altitude={flight.live.altitude}
                direction={flight.live.direction}
                speed={flight.live.speed_horizontal}
                flightNumber={flight.flight.iata}
                airline={flight.airline.name}
                departure={flight.departure}
                arrival={flight.arrival}
                isSelected={isSelected}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectFlight(flight);
                }}
              />
            ) : null
          })}
          
        </Suspense>
      </Canvas>
      
      {/* Flight tracking overlay info */}
      <div className="absolute top-4 left-4 p-4 rounded-xl backdrop-blur-md bg-black/40 border border-white/10 text-white z-10">
        <h2 className="text-xl font-bold font-sans tracking-tight mb-2">Live Flight Radar 3D</h2>
        <div className="flex items-center gap-2 text-sm opacity-80">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
          <span>{flights.filter(f => f.live).length} active flights tracked</span>
        </div>
      </div>
    </div>
  )
}
