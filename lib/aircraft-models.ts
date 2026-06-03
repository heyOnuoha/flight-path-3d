/**
 * Maps Aviationstack `aircraft.iata` codes (e.g. "B738", "A320") to glTF / glb
 * model URLs served from /public/models/.
 *
 * The default model is `Cesium_Air.glb` (Apache 2.0 — ships with the CesiumJS
 * sample data). Drop per-type glTF files into `public/models/` and register
 * them in `BY_TYPE` to use a different mesh for that aircraft.
 *
 * Notes on glTF authoring conventions used by `applyHeadingOffset`:
 * - Cesium reads the model's local +X as "east" / forward when heading = 0.
 * - The bundled `airliner.glb` (Cesium_Air) has its nose along +X, so the
 *   default heading offset is 0. If you import a model whose nose is along
 *   another axis, set its `headingOffsetDeg` here.
 */

export type AircraftModelSpec = {
  url: string;
  /** Rotation (deg) applied to flight heading to align the model's nose to "forward". */
  headingOffsetDeg?: number;
  /** Cesium `minimumPixelSize` — keeps planes visible at any zoom. */
  minimumPixelSize?: number;
};

const DEFAULT: AircraftModelSpec = {
  url: "/models/airliner.glb",
  headingOffsetDeg: 0,
  minimumPixelSize: 28,
};

// Add per-type entries here as you drop in more glTF files.
const BY_TYPE: Record<string, AircraftModelSpec> = {
  // Example (uncomment & ship the file once you have it):
  // B738: { url: "/models/B738.glb", headingOffsetDeg: 0, minimumPixelSize: 30 },
  // A320: { url: "/models/A320.glb", headingOffsetDeg: 0, minimumPixelSize: 30 },
  // B777: { url: "/models/B777.glb", headingOffsetDeg: 0, minimumPixelSize: 36 },
  // A380: { url: "/models/A380.glb", headingOffsetDeg: 0, minimumPixelSize: 42 },
};

export function modelForAircraft(iata?: string | null): AircraftModelSpec {
  if (iata && BY_TYPE[iata]) return BY_TYPE[iata];
  return DEFAULT;
}
