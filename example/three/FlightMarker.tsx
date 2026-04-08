'use client'

import React, { useRef, useState, useEffect, useMemo } from 'react'
import { ThreeElements, useFrame } from '@react-three/fiber'
import { Html, useGLTF, Line } from '@react-three/drei'
import * as THREE from 'three'
import { latLongToVector3, calculateNewPosition, getFlightQuaternion, getFlightArcPoints } from '@/lib/utils/three-utils'

type FlightMarkerProps = ThreeElements['group'] & {
  lat: number
  lon: number
  direction?: number | null
  speed?: number | null
  flightNumber: string
  airline: string
  altitude?: number
  isSelected?: boolean
  departure?: { latitude?: number | null; longitude?: number | null }
  arrival?: { latitude?: number | null; longitude?: number | null }
}

// Preload the specific model for performance
useGLTF.preload('/models/plane.glb')

// Default fallback values if AviationStack returns null
const DEFAULT_SPEED = 800; // km/h
const DEFAULT_DIRECTION = 90; // moving straight East

export function FlightMarker({ lat, lon, direction, speed, flightNumber, airline, altitude = 0, isSelected = false, departure, arrival, ...props }: FlightMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // Load the downloaded GLB 
  const { scene } = useGLTF('/models/plane.glb')

  // We need to clone it so we can have multiple independent meshes from the same source
  const clonedScene = useMemo(() => scene.clone(true), [scene])

  // Change color when selected by traversing the meshes
  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;

        if (!mesh.userData.originalMaterial) {
          mesh.userData.originalMaterial = mesh.material;
        }

        if (isSelected) {
          mesh.material = new THREE.MeshStandardMaterial({
            color: "#60a5fa",
            emissive: "#2563eb",
            emissiveIntensity: 0.8
          })
        } else {
          mesh.material = mesh.userData.originalMaterial;
        }
      }
    });
  }, [clonedScene, isSelected]);

  // A ref to keep track of our simulated location
  const locationRef = useRef({ lat, lon });

  const actualSpeed = speed || DEFAULT_SPEED;
  const actualDirection = direction || DEFAULT_DIRECTION;

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // speed is km/h. To get km/s:
    const speedKmSec = actualSpeed / 3600;
    // Let's use a 10x simulation speed multiplier otherwise planes move extremely slowly
    const SIMULATION_SPEED = 10;
    const distance = speedKmSec * delta * SIMULATION_SPEED;

    // Update ref location
    const newLoc = calculateNewPosition(
      locationRef.current.lat,
      locationRef.current.lon,
      distance,
      actualDirection
    );
    locationRef.current = newLoc;

    const heightFactor = 1 + (altitude / 10000) * 0.1;

    // Update Object3D Position
    const positionVector = latLongToVector3(newLoc.lat, newLoc.lon, 5 * heightFactor);
    groupRef.current.position.copy(positionVector);

    // Update Object3D Rotation (Quaternion)
    const quaternion = getFlightQuaternion(newLoc.lat, newLoc.lon, actualDirection, 5 * heightFactor);
    groupRef.current.quaternion.copy(quaternion);
  });

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto'
    return () => { document.body.style.cursor = 'auto' }
  }, [hovered])

  // Calculate Great Circle Arc points
  const arcPoints = useMemo(() => {
    if (departure?.latitude && departure?.longitude && arrival?.latitude && arrival?.longitude) {
      return getFlightArcPoints(
        departure.latitude,
        departure.longitude,
        arrival.latitude,
        arrival.longitude,
        64,     // segments
        5,      // radius (GLOBE_RADIUS)
        0.5     // arc height
      )
    }
    return null
  }, [departure, arrival])


  return (
    <group>
      {/* Path Line */}
      {arcPoints && (
        <Line
          points={arcPoints}
          color={isSelected ? "#60a5fa" : "#3b82f6"}
          lineWidth={isSelected ? 3 : 1.5}
          transparent
          opacity={isSelected ? 0.9 : 0.3}
        />
      )}

      {/* Airplane Object */}
      <group
        ref={groupRef}
        {...props}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
      >
        {/* Invisible larger hitbox for easier clicking */}
        <mesh visible={false}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {/* Correct alignment: The raw OBJ has its nose on +Y and top on +Z. 
            Our lookAt matrix makes -Z point forward and +Y point to the sky. 
            To move the model's +Y (nose) to -Z (forward) and +Z (top) to +Y (sky), 
            we rotate it around X by -90 degrees (-Math.PI/2). */}
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <primitive object={clonedScene} scale={[0.0002, 0.0002, 0.0002]} />
        </group>

        {/* Flight Information tag */}
        <Html distanceFactor={10}>
          <div className={`bg-black/80 text-white px-2 py-1 rounded text-xs whitespace-nowrap border ${isSelected ? 'border-green-400 font-bold scale-110' : 'border-blue-500/50'} backdrop-blur-sm pointer-events-none select-none -translate-x-1/2 -translate-y-full transition-all`}>
            <span className={`${isSelected ? 'text-green-400' : ''}`}>{flightNumber}</span>
            {!isSelected && <span className="ml-1 opacity-70">({airline})</span>}
          </div>
        </Html>
      </group>
    </group>
  )
}
