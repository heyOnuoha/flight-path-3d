import * as THREE from 'three';

export const GLOBE_RADIUS = 5;

export function latLongToVector3(lat: number, lon: number, radius: number = GLOBE_RADIUS): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

// Calculate new lat/lon given a distance (in km) and heading (in degrees)
export function calculateNewPosition(lat: number, lon: number, distance: number, heading: number): { lat: number, lon: number } {
  // Earth radius in km
  const R = 6371; 
  const ad = distance / R; // angular distance in radians

  const lat1 = lat * (Math.PI / 180);
  const lon1 = lon * (Math.PI / 180);
  const brng = heading * (Math.PI / 180);

  let lat2 = Math.asin(Math.sin(lat1) * Math.cos(ad) + Math.cos(lat1) * Math.sin(ad) * Math.cos(brng));
  let lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(ad) * Math.cos(lat1), Math.cos(ad) - Math.sin(lat1) * Math.sin(lat2));

  // Convert back to degrees
  return {
    lat: lat2 * (180 / Math.PI),
    lon: lon2 * (180 / Math.PI)
  };
}

export function getFlightQuaternion(lat: number, lon: number, heading: number, radius: number = GLOBE_RADIUS): THREE.Quaternion {
  const position = latLongToVector3(lat, lon, radius);
  
  // Calculate a point slightly ahead to look at
  const aheadPosition = calculateNewPosition(lat, lon, 50, heading); // 50km ahead
  const target = latLongToVector3(aheadPosition.lat, aheadPosition.lon, radius);
  
  const up = position.clone().normalize();
  
  const matrix = new THREE.Matrix4();
  // Object3D lookAt points the -Z axis of the object to target and +Y to up.
  matrix.lookAt(position, target, up);
  
  const quaternion = new THREE.Quaternion();
  quaternion.setFromRotationMatrix(matrix);
  
  return quaternion;
}

export function getFlightArcPoints(
  startLat: number, 
  startLon: number, 
  endLat: number, 
  endLon: number, 
  segments: number = 50, 
  radius: number = GLOBE_RADIUS, 
  arcHeight: number = 1.0
): THREE.Vector3[] {
  const start = latLongToVector3(startLat, startLon, radius);
  const end = latLongToVector3(endLat, endLon, radius);

  const startNorm = start.clone().normalize();
  const endNorm = end.clone().normalize();
  
  // Create a quaternion representing the full rotation from start to end
  const fullRotation = new THREE.Quaternion().setFromUnitVectors(startNorm, endNorm);

  const points: THREE.Vector3[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    // Slerp from identity to fullRotation by t
    const currentRot = new THREE.Quaternion().slerp(fullRotation, t);
    const currentPoint = startNorm.clone().applyQuaternion(currentRot);
    
    // Add height to make it an arc (parabola shape)
    const height = arcHeight * (1 - Math.pow(2 * t - 1, 2));
    
    // Extend the point outwards from the center to add the true scaled height
    currentPoint.multiplyScalar(radius + height);
    
    points.push(currentPoint);
  }

  return points;
}
