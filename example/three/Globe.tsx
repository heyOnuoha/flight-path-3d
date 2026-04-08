'use client'

import React, { useRef } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { GLOBE_RADIUS } from '@/lib/utils/three-utils'

export function Globe() {
  const meshRef = useRef<THREE.Mesh>(null)
  
  const [colorMap, normalMap, specularMap, cloudsMap] = useTexture([
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png'
  ])

  // To match the formula in three-utils:
  // theta = (lon + 180). When lon = 0, theta = 180 (math +PI)
  // Our math formula sets prime meridian at +X axis.
  // Standard SphereGeometry with texture maps usually puts prime meridian at -Z, but starting wrap at -Z might mean prime meridian is elsewhere.
  // We'll apply it and we can adjust the rotation if needed. Usually, -Math.PI / 2 is a common adjustment for Earth textures.

  return (
    <group>
      {/* Main Globe Mesh */}
      <mesh ref={meshRef} rotation={[0, -Math.PI / 2, 0]}>
        <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
        <meshPhongMaterial
          map={colorMap}
          bumpMap={normalMap}
          bumpScale={0.05}
          specularMap={specularMap}
          specular={new THREE.Color('grey')}
        />
        
        {/* Clouds */}
        <mesh scale={[1.005, 1.005, 1.005]}>
          <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
          <meshPhongMaterial
            map={cloudsMap}
            transparent={true}
            opacity={0.4}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </mesh>
    </group>
  )
}
