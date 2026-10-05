/**
 * Basemap configuration.
 *
 * OpenStreetMap's standard tiles are genuinely free to use with attribution —
 * no key, no account — which is why they replaced the CARTO basemaps here.
 * CARTO serves without a key but is not free to use, so the DARK and LIGHT
 * styles are now OSM with a CSS filter over the tile pane rather than separate
 * pre-styled basemaps.
 *
 * OSM asks heavy consumers to move to their own provider. Point
 * NEXT_PUBLIC_TILE_URL at any {z}/{x}/{y} endpoint to do that.
 *
 * @see https://operations.osmfoundation.org/policies/tiles/
 */
export type MapStyle = "dark" | "light" | "osm" | "satellite";

export const OSM_URL =
  process.env.NEXT_PUBLIC_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const ESRI_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";

/** OSM's standard tiles stop at 19; requesting deeper just 404s. */
export const OSM_MAX_ZOOM = 19;

export type TileConfig = {
  url: string;
  attribution: string;
  /** Applied to Leaflet's tile pane, so one basemap can serve several looks. */
  filter: string;
  maxZoom: number;
};

export const TILE_STYLES: Record<MapStyle, TileConfig> = {
  dark: {
    url: OSM_URL,
    attribution: OSM_ATTRIBUTION,
    filter: "invert(1) hue-rotate(185deg) saturate(0.42) brightness(0.78) contrast(1.08)",
    maxZoom: OSM_MAX_ZOOM,
  },
  light: {
    url: OSM_URL,
    attribution: OSM_ATTRIBUTION,
    filter: "saturate(0.55) contrast(0.95) brightness(1.04)",
    maxZoom: OSM_MAX_ZOOM,
  },
  osm: {
    url: OSM_URL,
    attribution: OSM_ATTRIBUTION,
    filter: "",
    maxZoom: OSM_MAX_ZOOM,
  },
  satellite: {
    url: ESRI_URL,
    attribution: ESRI_ATTRIBUTION,
    filter: "",
    maxZoom: 19,
  },
};
