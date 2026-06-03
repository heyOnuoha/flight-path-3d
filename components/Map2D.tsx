"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Flight } from "@/lib/types";
import { flightKey } from "@/lib/types";
import { matchesFilters, type FilterState } from "@/lib/filters";

const EARTH_RADIUS_KM = 6371;

// AviationStack positions are often already 10+ minutes stale and the same
// `updated` value persists across many polls, so unbounded dead reckoning would
// march a plane hundreds of km off-map until it vanishes. Cap how far ahead we
// ever project so a frozen timestamp keeps the marker near its last fix.
const MAX_DEAD_RECKON_SEC = 120;

// A live plane marker plus the visual state it was last rendered with, so the
// 1s update loop only rebuilds the divIcon when heading/selection changes.
type PlaneEntry = { marker: L.Marker; heading: number; selected: boolean };

type Props = {
  flights: Flight[];
  filters: FilterState;
  selectedFlight: Flight | null;
  mapStyle: "dark" | "light" | "osm" | "satellite";
  homeTrigger: number;
  onSelectFlight: (f: Flight | null) => void;
  onSelectAirport: (iata: string) => void;
};

// Dead reckoning logic to smoothly interpolate plane location
function deadReckon(live: NonNullable<Flight["live"]>, nowMs: number) {
  let lastMs = nowMs;
  if (live.updated) {
    // Normalize spaces to 'T' for standard ISO compliance across all browsers (safari/chrome/next)
    const normalized = live.updated.includes(" ") ? live.updated.replace(" ", "T") : live.updated;
    const parsed = Date.parse(normalized);
    if (!isNaN(parsed)) {
      lastMs = parsed;
    }
  }
  const elapsedSec = Math.min(MAX_DEAD_RECKON_SEC, Math.max(0, (nowMs - lastMs) / 1000));
  const speedKmh = live.speed_horizontal || 800;
  const headingDeg = live.direction || 0;
  const distanceKm = (speedKmh / 3600) * elapsedSec;

  const lat1 = (live.latitude * Math.PI) / 180;
  const lon1 = (live.longitude * Math.PI) / 180;
  const bearing = (headingDeg * Math.PI) / 180;
  const dR = distanceKm / EARTH_RADIUS_KM;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(dR) * Math.cos(lat1),
      Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lon: (lon2 * 180) / Math.PI,
    alt: live.altitude || 10000,
  };
}

// Shift `lon` by whole turns so it lies within ±180° of `ref`, so a dateline-
// crossing route is framed the short way instead of wrapping the long way.
function unwrapLon(lon: number, ref: number): number {
  while (lon - ref > 180) lon -= 360;
  while (lon - ref < -180) lon += 360;
  return lon;
}

// Great-circle interpolation for gorgeous curved flight paths
function interpolateGeodesic(lat1: number, lon1: number, lat2: number, lon2: number, numPoints = 50) {
  const points: [number, number][] = [];
  const rLat1 = (lat1 * Math.PI) / 180;
  const rLon1 = (lon1 * Math.PI) / 180;
  const rLat2 = (lat2 * Math.PI) / 180;
  const rLon2 = (lon2 * Math.PI) / 180;

  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((rLat1 - rLat2) / 2), 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.pow(Math.sin((rLon1 - rLon2) / 2), 2)
  ));

  if (d === 0) return [[lat1, lon1] as [number, number]];

  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(rLat1) * Math.cos(rLon1) + B * Math.cos(rLat2) * Math.cos(rLon2);
    const y = A * Math.cos(rLat1) * Math.sin(rLon1) + B * Math.cos(rLat2) * Math.sin(rLon2);
    const z = A * Math.sin(rLat1) + B * Math.sin(rLat2);
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lon = Math.atan2(y, x);
    points.push([(lat * 180) / Math.PI, (lon * 180) / Math.PI]);
  }

  // Unwrap longitudes so a path crossing the ±180° antimeridian stays
  // continuous (…175, 185, 195… instead of …175, -175, -165…). Otherwise
  // Leaflet draws the segment the long way back across the whole map. Combined
  // with horizontally-wrapping tiles, this renders the short Pacific route.
  for (let i = 1; i < points.length; i++) {
    const delta = points[i][1] - points[i - 1][1];
    if (delta > 180) points[i][1] -= 360;
    else if (delta < -180) points[i][1] += 360;
  }
  return points;
}

export default function Map2D({
  flights,
  filters,
  selectedFlight,
  mapStyle,
  homeTrigger,
  onSelectFlight,
  onSelectAirport,
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // References to track map elements dynamically. Each plane entry caches the
  // heading/selected state it was last rendered with so the per-second tick can
  // skip the expensive divIcon rebuild when nothing visual changed.
  const planeMarkersRef = useRef<Map<string, PlaneEntry>>(new Map());
  const trailFlownRef = useRef<L.Polyline | null>(null);
  const trailRemainingRef = useRef<L.Polyline | null>(null);
  const pinDepRef = useRef<L.Marker | null>(null);
  const pinArrRef = useRef<L.Marker | null>(null);

  // Keep track of latest props inside ref to prevent hook re-triggering polling timers
  const stateRef = useRef({ flights, filters, selectedFlight, onSelectFlight, onSelectAirport });
  useEffect(() => {
    stateRef.current = { flights, filters, selectedFlight, onSelectFlight, onSelectAirport };
  }, [flights, filters, selectedFlight, onSelectFlight, onSelectAirport]);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create Leaflet map with disabled zoom controls (so we can add them to the bottom right)
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: true,
      fadeAnimation: true,
      // No maxBounds: tiles wrap horizontally (infinite world copies) so flights
      // crossing the ±180° dateline — e.g. Hong Kong → Anchorage — render the
      // short way across the Pacific, and western regions can always be panned
      // out from behind the opaque left flight list. The dark container
      // background covers the only remaining void (vertical over-pan).
      minZoom: 2,
      worldCopyJump: true,
    }).setView([20, 0], 3);

    mapRef.current = map;

    // A fresh map means any previously-created markers/trails belong to a now-
    // discarded map instance (e.g. after a hydration-driven remount). Drop those
    // stale refs so updatePlanes re-adds every marker to THIS map instead of
    // silently calling setLatLng on orphaned ones — which would blank the map.
    planeMarkersRef.current.clear();
    trailFlownRef.current = null;
    trailRemainingRef.current = null;
    pinDepRef.current = null;
    pinArrRef.current = null;

    // Add custom zoom controls on the bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Initial tile layer setup (Dark Mode default)
    const tileLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20,
      }
    ).addTo(map);
    tileLayerRef.current = tileLayer;

    // Recompute the map size once layout settles and whenever the container
    // resizes. Without this, a map initialized before its container has its
    // final size renders tiles but mis-positions / hides markers.
    const ensureSize = () => map.invalidateSize();
    requestAnimationFrame(ensureSize);
    const sizeTimer = setTimeout(ensureSize, 300);
    const resizeObserver = new ResizeObserver(ensureSize);
    resizeObserver.observe(mapContainerRef.current);

    // ESC Key deselects flight
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stateRef.current.onSelectFlight(null);
      }
    };
    window.addEventListener("keydown", handleEsc);

    return () => {
      window.removeEventListener("keydown", handleEsc);
      clearTimeout(sizeTimer);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. React to Map Style Change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileLayerRef.current) return;

    let url = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    let attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    if (mapStyle === "light") {
      url = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    } else if (mapStyle === "osm") {
      url = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    } else if (mapStyle === "satellite") {
      url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{x}/{y}";
      attribution = "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";
    }

    tileLayerRef.current.setUrl(url);
    // Leaflet's setUrl updates tiles dynamically, but we update attribution in layer's options
    tileLayerRef.current.options.attribution = attribution;
    map.attributionControl.addAttribution(attribution);
  }, [mapStyle]);

  // 3. React to Home Button Trigger (Reset Camera to global view)
  useEffect(() => {
    if (homeTrigger === 0) return;
    const map = mapRef.current;
    if (map) {
      map.flyTo([20, 0], 3, { duration: 1.5 });
    }
  }, [homeTrigger]);

  // 4. Create and Update plane markers smoothly using a high-performance rendering loop (every 1 second)
  useEffect(() => {
    let active = true;

    // Helper to create beautiful airplane SVGs rotated by flight direction
    const createPlaneIcon = (heading: number, isSelected: boolean) => {
      const color = isSelected ? "#00C2FF" : "#3D7BFF"; // APILayer sky highlight / brand blue
      const size = isSelected ? 34 : 24;
      const glow = isSelected ? "filter: drop-shadow(0 0 6px rgba(255, 123, 0, 0.9));" : "filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7));";

      const htmlContent = `
        <div style="width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 24 24" width="${size}" height="${size}" style="transform: rotate(${heading}deg); transform-origin: center; ${glow} transition: transform 0.2s ease-out; fill: ${color}; stroke: #000; stroke-width: 0.5px;">
            <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
          </svg>
        </div>
      `;

      return L.divIcon({
        html: htmlContent,
        className: "custom-plane-container",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    };

    function updatePlanes() {
      const map = mapRef.current;
      if (!map || !active) return;

      const { flights, filters, selectedFlight, onSelectFlight } = stateRef.current;
      const selectedKey = selectedFlight ? flightKey(selectedFlight) : null;
      const wantedKeys = new Set<string>();
      const now = Date.now();

      const renderFlight = (flight: Flight, key: string, isSelected: boolean) => {
        const live = flight.live;
        if (!live || live.latitude == null || live.longitude == null) return;

        wantedKeys.add(key);
        const { lat, lon } = deadReckon(live, now);
        // Round heading so sub-degree dead-reckoning noise doesn't trigger an
        // icon rebuild; the icon is visually identical at that resolution.
        const heading = Math.round(live.direction || 0);

        const entry = planeMarkersRef.current.get(key);
        if (!entry) {
          const marker = L.marker([lat, lon], {
            icon: createPlaneIcon(heading, isSelected),
            zIndexOffset: isSelected ? 1000 : 0,
          }).addTo(map);
          marker.on("click", () => {
            onSelectFlight(flight);
          });
          planeMarkersRef.current.set(key, { marker, heading, selected: isSelected });
        } else {
          // Position changes every tick (dead reckoning); the icon does not.
          entry.marker.setLatLng([lat, lon]);
          if (entry.heading !== heading || entry.selected !== isSelected) {
            entry.marker.setIcon(createPlaneIcon(heading, isSelected));
            entry.marker.setZIndexOffset(isSelected ? 1000 : 0);
            entry.heading = heading;
            entry.selected = isSelected;
          }
        }
      };

      let idx = 0;
      for (const flight of flights) {
        if (!flight.live || flight.live.latitude == null || flight.live.longitude == null) continue;
        const key = flightKey(flight, idx++);
        if (!(matchesFilters(flight, filters) || key === selectedKey)) continue;
        renderFlight(flight, key, key === selectedKey);
      }

      // Keep the selected flight on the map even if it dropped out of the latest
      // (sparse) refresh, so it never vanishes from under the open detail panel.
      if (selectedFlight && selectedKey && !wantedKeys.has(selectedKey)) {
        renderFlight(selectedFlight, selectedKey, true);
      }

      // Cleanup planes that are no longer in scope
      planeMarkersRef.current.forEach((entry, key) => {
        if (!wantedKeys.has(key)) {
          entry.marker.remove();
          planeMarkersRef.current.delete(key);
        }
      });
    }

    // Run initial update and poll smoothly
    updatePlanes();
    const interval = setInterval(updatePlanes, 1000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [flights]); // Sync whenever flights lists fetch updates

  // 5. Selected flight trail and airport pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Reset previous elements
    const cleanupSelectedElements = () => {
      if (trailFlownRef.current) {
        trailFlownRef.current.remove();
        trailFlownRef.current = null;
      }
      if (trailRemainingRef.current) {
        trailRemainingRef.current.remove();
        trailRemainingRef.current = null;
      }
      if (pinDepRef.current) {
        pinDepRef.current.remove();
        pinDepRef.current = null;
      }
      if (pinArrRef.current) {
        pinArrRef.current.remove();
        pinArrRef.current = null;
      }
    };

    cleanupSelectedElements();

    if (!selectedFlight) return;

    const dep = selectedFlight.departure;
    const arr = selectedFlight.arrival;
    const live = selectedFlight.live;

    if (!live || !dep?.latitude || !dep?.longitude || !arr?.latitude || !arr?.longitude) return;

    // Periodic updater to draw trails
    const drawSelectedPath = () => {
      const currentMap = mapRef.current;
      if (!currentMap || !selectedFlight) return;

      const { lat, lon } = deadReckon(live, Date.now());

      // Create beautiful custom airport circular pins
      const createAirportIcon = (iata: string) => {
        const color = "#3D7BFF"; // APILayer brand blue
        // The colored dot is centered on the icon's anchor point (12,12) so it
        // sits exactly on the airport coordinate — i.e. on the trail's endpoint.
        // The IATA label floats just below without shifting the dot.
        const html = `
          <div class="select-none" style="position:relative; width:24px; height:24px;">
            <span class="animate-ping" style="position:absolute; top:12px; left:12px; transform:translate(-50%,-50%); width:16px; height:16px; border-radius:9999px; opacity:0.6; background-color:${color}"></span>
            <span style="position:absolute; top:12px; left:12px; transform:translate(-50%,-50%); width:14px; height:14px; border-radius:9999px; border:1px solid #000; background-color:${color}"></span>
            <div class="px-1.5 py-0.5 bg-black/85 border border-white/20 rounded font-mono text-[9px] font-bold text-white whitespace-nowrap shadow-md" style="position:absolute; top:20px; left:50%; transform:translateX(-50%);">
              ${iata}
            </div>
          </div>
        `;
        return L.divIcon({
          html,
          className: "custom-airport-pin",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
      };

      // 1. Estimated great-circle route: departure → live position (flown) and
      // live position → arrival (remaining). AviationStack has no flown-track
      // data, so this is an estimate, not the literal path taken.
      const flownCoordinates = interpolateGeodesic(dep.latitude!, dep.longitude!, lat, lon);
      // Anchor the flown leg's end exactly to the plane's longitude (by whole
      // turns) so it joins the remaining leg seamlessly across the dateline.
      const endShift = lon - flownCoordinates[flownCoordinates.length - 1][1];
      if (Math.abs(endShift) > 1e-6) for (const p of flownCoordinates) p[1] += endShift;
      const remainingCoordinates = interpolateGeodesic(lat, lon, arr.latitude!, arr.longitude!);

      // Place the pins on the unwrapped endpoints of the line (not the raw
      // ±180° coords), so they sit on the trail ends even across the dateline.
      const depLatLng: [number, number] = [dep.latitude!, flownCoordinates[0][1]];
      const arrLatLng: [number, number] = [
        arr.latitude!,
        remainingCoordinates[remainingCoordinates.length - 1][1],
      ];

      // 2. Render Departure & Arrival Airport Pins
      if (!pinDepRef.current) {
        pinDepRef.current = L.marker(depLatLng, {
          icon: createAirportIcon(dep.iata || dep.icao || "DEP"),
        }).addTo(currentMap);
        pinDepRef.current.on("click", () => stateRef.current.onSelectAirport(dep.iata || dep.icao || "DEP"));
      }

      if (!pinArrRef.current) {
        pinArrRef.current = L.marker(arrLatLng, {
          icon: createAirportIcon(arr.iata || arr.icao || "ARR"),
        }).addTo(currentMap);
        pinArrRef.current.on("click", () => stateRef.current.onSelectAirport(arr.iata || arr.icao || "ARR"));
      }

      // 3. Render/Update Flown trail
      if (!trailFlownRef.current) {
        trailFlownRef.current = L.polyline(flownCoordinates, {
          color: "#334155", // Solid slate-charcoal trail like FR24
          weight: 3.5,
          opacity: 0.95,
          lineCap: "round",
        }).addTo(currentMap);
      } else {
        trailFlownRef.current.setLatLngs(flownCoordinates);
      }

      // 4. Render/Update Remaining trail
      if (!trailRemainingRef.current) {
        trailRemainingRef.current = L.polyline(remainingCoordinates, {
          color: "#64748b", // Dotted slate scheduled trail
          weight: 2.5,
          dashArray: "6, 8",
          opacity: 0.75,
          lineCap: "square",
        }).addTo(currentMap);
      } else {
        trailRemainingRef.current.setLatLngs(remainingCoordinates);
      }
    };

    drawSelectedPath();
    const trailInterval = setInterval(drawSelectedPath, 1000);

    // Center and zoom on the route, framing dateline-crossing flights the short
    // way by unwrapping the airport longitudes around the live position.
    const anchorLon = deadReckon(live, Date.now()).lon;
    const bounds = L.latLngBounds([
      [dep.latitude!, unwrapLon(dep.longitude!, anchorLon)],
      [arr.latitude!, unwrapLon(arr.longitude!, anchorLon)],
    ]);
    map.flyToBounds(bounds, {
      padding: [80, 80],
      maxZoom: 7,
      duration: 1.2,
    });

    return () => {
      clearInterval(trailInterval);
      cleanupSelectedElements();
    };
  }, [selectedFlight]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full bg-[#050510]"
      style={{ minHeight: "100%", width: "100%" }}
    />
  );
}
