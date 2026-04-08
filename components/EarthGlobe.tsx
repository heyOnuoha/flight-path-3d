"use client";
import React from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export const EarthGlobe = React.forwardRef<THREE.Group, { radius?: number }>(({ radius = 10 }, ref) => {
  // Use a reliable high-quality daytime earth texture from the official three.js repo
  const colorMap = useTexture("https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg");

  return (
    <group ref={ref}>
      {/* Base Globe */}
      <mesh>
        <sphereGeometry args={[radius, 64, 64]} />
        <meshBasicMaterial map={colorMap} color="#ffffff" />
      </mesh>
      
      {/* Atmosphere Glow effect */}
      <mesh>
        <sphereGeometry args={[radius + 0.15, 64, 64]} />
        <meshBasicMaterial 
          color="#00aaee" 
          transparent={true} 
          opacity={0.15} 
          side={THREE.BackSide} 
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
});
EarthGlobe.displayName = "EarthGlobe";
