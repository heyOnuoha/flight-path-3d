"use client";
import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { EarthGlobe } from "./EarthGlobe";
import { AirplaneMesh } from "./AirplaneMesh";

export default function Scene({ flights, selectedFlight, onSelectFlight }: { flights: any[], selectedFlight: any, onSelectFlight: (f: any) => void }) {
  return (
    <Canvas camera={{ position: [0, 0, 25], fov: 45 }}>
      <color attach="background" args={["#050510"]} />
      <ambientLight intensity={1.5} />
      <pointLight position={[10, 10, 10]} intensity={1.5} />
      
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      <group rotation={[0, -Math.PI / 2, 0]}>
        <EarthGlobe radius={10} />
        <React.Suspense fallback={null}>
          {flights.map((flight: any, idx: number) => (
            <AirplaneMesh 
              key={`${flight?.flight?.number}-${idx}`} 
              flight={flight} 
              globeRadius={10} 
              onClick={onSelectFlight}
              isSelected={selectedFlight?.flight?.number === flight.flight?.number}
            />
          ))}
        </React.Suspense>
      </group>

      <OrbitControls 
        enablePan={false} 
        minDistance={12} 
        maxDistance={40} 
      />
    </Canvas>
  );
}
