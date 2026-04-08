"use client";
import React, { useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { latLongToCartesian } from "@/lib/math-utils";
import { useLoader, useFrame } from "@react-three/fiber";
import { OBJLoader, MTLLoader } from "three-stdlib";

interface AirplaneMeshProps {
  flight: any;
  globeRadius: number;
  onClick: (flight: any) => void;
  isSelected: boolean;
}

const EARTH_RADIUS_KM = 6371;

export function AirplaneMesh({ flight, globeRadius, onClick, isSelected }: AirplaneMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Group>(null);

  // Load the provided 3D plane model
  const materials = useLoader(MTLLoader, '/plane/11805_airplane_v2_L2.mtl');
  const obj = useLoader(OBJLoader, '/plane/11805_airplane_v2_L2.obj', (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });
  
  // Clone object for multiple renders
  const model = useMemo(() => obj.clone(), [obj]);

  const [currentLat, setCurrentLat] = useState(flight.live?.latitude || 0);
  const [currentLon, setCurrentLon] = useState(flight.live?.longitude || 0);

  // Apply highlight glow
  React.useEffect(() => {
    model.traverse((child: any) => {
      if (child.isMesh) {
         if (isSelected) {
            child.material.emissive = new THREE.Color("#ff9900");
            child.material.emissiveIntensity = 0.5;
         } else {
            child.material.emissive = new THREE.Color(0x000000);
            child.material.emissiveIntensity = 0;
         }
      }
    });
  }, [model, isSelected]);

  // CONTINUOUS MOVEMENT (Dead Reckoning)
  useFrame((state, delta) => {
    if (!flight.live || flight.live.latitude == null || !groupRef.current) return;

    const speedKmh = flight.live.speed_horizontal || 800; // km/h
    const headingDeg = flight.live.direction || 0; // degrees from North
    
    // 1. Calculate distance traveled since last API update
    const lastUpdate = new Date(flight.live.updated || Date.now()).getTime();
    const now = Date.now();
    const elapsedSeconds = (now - lastUpdate) / 1000;
    const distanceKm = (speedKmh / 3600) * elapsedSeconds;

    // 2. Spherical Math for new Lat/Lon
    const lat1 = flight.live.latitude * (Math.PI / 180);
    const lon1 = flight.live.longitude * (Math.PI / 180);
    const bearing = headingDeg * (Math.PI / 180);
    const dR = distanceKm / EARTH_RADIUS_KM;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(dR) +
      Math.cos(lat1) * Math.sin(dR) * Math.cos(bearing)
    );
    const lon2 = lon1 + Math.atan2(
      Math.sin(bearing) * Math.sin(dR) * Math.cos(lat1),
      Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2)
    );

    const nextLat = lat2 * (180 / Math.PI);
    const nextLon = lon2 * (180 / Math.PI);

    // 3. Update Position
    const altOffset = 0.15 + ((flight.live.altitude || 35000) / 100000); 
    const pos = latLongToCartesian(nextLat, nextLon, globeRadius + altOffset);
    groupRef.current.position.copy(pos);

    // 4. PRECISION ORIENTATION
    // Up vector is the surface normal
    const up = pos.clone().normalize();
    
    // North pole vector (0, 1, 0)
    const north = new THREE.Vector3(0, 1, 0);
    
    // Calculate North tangent (direction pointing to North Pole at this point)
    const tangentNorth = north.clone().projectOnPlane(up).normalize();
    
    // Airplane's heading: rotate current North tangent around Up vector by 'bearing'
    const forward = tangentNorth.clone().applyAxisAngle(up, -bearing);
    
    // Create matrix and apply to quaternion
    const matrix = new THREE.Matrix4();
    matrix.lookAt(new THREE.Vector3(0,0,0), forward, up);
    groupRef.current.quaternion.setFromRotationMatrix(matrix);
  });

  if (!flight.live || flight.live.latitude == null || flight.live.longitude == null) {
    return null;
  }

  return (
    <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onClick(flight); }}>
      {/* 
          AXIS ALIGNMENT FOR 3DS MAX MODEL (Y-Forward, Z-Up):
          Most OBJ models from Max need to be flipped to match Three.js (Z-Forward, Y-Up)
      */}
      <group rotation={[Math.PI / 2, 0, 0]} scale={0.0002}>
         <primitive object={model} />
      </group>
      
      {isSelected && (
        <mesh>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color="#ff9900" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
