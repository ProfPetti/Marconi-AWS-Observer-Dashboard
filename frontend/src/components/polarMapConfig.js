import L from "leaflet";
import "proj4";
import "proj4leaflet";
import { BASES } from "../constants/awsConfig";

// EPSG:3031 Antarctic polar stereographic (zoom 0..10 down to 16 m/px for tight station clusters)
export const polarCRS = new L.Proj.CRS(
  "EPSG:3031",
  "+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs",
  {
    origin: [-4194304, 4194304],
    resolutions: [16384, 8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16],
    bounds: L.bounds([-4194304, -4194304], [4194304, 4194304]),
  },
);

function distanceKm(a, b) {
  const latMid = ((a.latitude + b.latitude) * Math.PI) / 360;
  const dLat = (a.latitude - b.latitude) * 111.32;
  const dLon = (a.longitude - b.longitude) * 111.32 * Math.cos(latMid);
  return Math.hypot(dLat, dLon);
}

/**
 * Compute an optimal zoom level for a target station based on its nearest neighbor,
 * separating dense clusters (e.g. Terra Nova Bay: Eneide, Jennica, Base MZS) automatically.
 */
export function getSmartStationZoom(targetCode, allStations = []) {
  const all = [...allStations, ...BASES];
  const target = all.find((x) => x.code === targetCode);
  if (!target || target.latitude == null || target.longitude == null) return 6;
  let minKm = Infinity;
  for (const other of all) {
    if (other.code === target.code || other.latitude == null || other.longitude == null) {
      continue;
    }
    const d = distanceKm(target, other);
    if (d < minKm) minKm = d;
  }
  if (minKm < 2.0) return 9;
  if (minKm < 25.0) return 7;
  return 6;
}

export const wmsEndpoint = "https://gibs.earthdata.nasa.gov/wms/epsg3031/best/wms.cgi";

export const wmsBase = {
  version: "1.1.1",
  format: "image/jpeg",
  transparent: false,
  tileSize: 256,
  attribution: "NASA GIBS / NASA Earthdata",
  noWrap: true,
};

export const nasaDate = import.meta.env.VITE_NASA_DATE || "2025-01-15";

