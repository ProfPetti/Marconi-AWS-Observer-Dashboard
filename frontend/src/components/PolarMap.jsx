import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  WMSTileLayer,
  Marker,
  ScaleControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { BASES } from "../constants/awsConfig";
import {
  polarCRS,
  wmsEndpoint,
  wmsBase,
  nasaDate,
} from "./polarMapConfig";

export const bases = BASES;

/**
 * Compute small radial screen-space offsets for markers that overlap at the current zoom,
 * keeping their underlying geographic lat/lon untouched and collapsing to (0, 0) once zoomed in.
 */
function computeClusterOffsets(items, zoom) {
  const offsets = {};
  if (zoom >= 9 || items.length < 2) return offsets;

  const minDistPx = 22;
  const projected = items
    .filter((it) => it.latitude != null && it.longitude != null)
    .map((it) => ({
      code: it.code,
      pt: polarCRS.latLngToPoint(L.latLng(it.latitude, it.longitude), zoom),
    }));

  const visited = new Set();
  for (let i = 0; i < projected.length; i++) {
    if (visited.has(i)) continue;
    const queue = [i];
    visited.add(i);
    const group = [];
    while (queue.length > 0) {
      const idx = queue.shift();
      group.push(projected[idx]);
      for (let j = 0; j < projected.length; j++) {
        if (visited.has(j)) continue;
        const dx = projected[idx].pt.x - projected[j].pt.x;
        const dy = projected[idx].pt.y - projected[j].pt.y;
        if (Math.hypot(dx, dy) < minDistPx) {
          visited.add(j);
          queue.push(j);
        }
      }
    }
    if (group.length >= 2) {
      group.sort((a, b) => a.code.localeCompare(b.code));
      const radius = Math.max(14, group.length * 4.5);
      group.forEach((member, idx) => {
        const angle = (2 * Math.PI * idx) / group.length - Math.PI / 4;
        offsets[member.code] = {
          dx: Math.round(radius * Math.cos(angle)),
          dy: Math.round(radius * Math.sin(angle)),
        };
      });
    }
  }
  return offsets;
}

function createStationDotIcon(name, active, status, offset = { dx: 0, dy: 0 }) {
  const s = (status || "NO_DATA").toLowerCase();
  const activeClass = active ? "is-selected" : "";
  const criticalClass = s === "critical" ? "is-critical" : "";
  const labelAlways =
    active || s === "warning" || s === "critical" ? "always-visible" : "";

  return L.divIcon({
    className: "aws-dot-marker-wrap",
    html: `
      <div class="aws-dot-node ${s} ${activeClass} ${criticalClass}">
        <span class="aws-dot"></span>
        <span class="aws-dot-pulse"></span>
        <span class="aws-dot-label ${labelAlways}">${name}</span>
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8 - offset.dx, 8 - offset.dy],
  });
}

function createBaseDotIcon(name, active, offset = { dx: 0, dy: 0 }) {
  const activeClass = active ? "is-selected" : "";
  const labelAlways = active ? "always-visible" : "";
  return L.divIcon({
    className: "base-dot-marker-wrap",
    html: `
      <div class="base-diamond-node ${activeClass}">
        <span class="base-diamond"></span>
        <span class="base-dot-label ${labelAlways}">${name}</span>
      </div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7 - offset.dx, 7 - offset.dy],
  });
}

function MapCameraController({ focusTarget }) {
  const map = useMap();
  const prevTargetRef = useRef(null);

  useEffect(() => {
    if (!focusTarget) return;

    let targetLat, targetLon, targetZoom, seqKey;
    if (focusTarget === "overview") {
      targetLat = BASES[1].latitude;
      targetLon = BASES[1].longitude;
      targetZoom = 3;
      seqKey = "overview";
    } else if (focusTarget.lat != null && focusTarget.lon != null) {
      targetLat = focusTarget.lat;
      targetLon = focusTarget.lon;
      targetZoom = focusTarget.zoom ?? 6;
      seqKey = focusTarget.seq ?? "";
    } else {
      return;
    }

    const key = `${Number(targetLat).toFixed(4)},${Number(targetLon).toFixed(4)},${targetZoom},${seqKey}`;
    if (prevTargetRef.current === key) return;
    prevTargetRef.current = key;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    map.stop();
    if (prefersReducedMotion) {
      map.setView([targetLat, targetLon], targetZoom);
    } else {
      map.flyTo([targetLat, targetLon], targetZoom, { duration: 1.1 });
    }
  }, [focusTarget, map]);

  return null;
}

function MapZoomControls({ onResetOverview }) {
  const map = useMap();
  const containerRef = useRef(null);
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);

  return (
    <div ref={containerRef} className="map-zoom-controls" aria-label="Controlli zoom mappa">
      <button
        type="button"
        className="map-zoom-btn"
        onClick={() => map.zoomIn()}
        disabled={zoom >= map.getMaxZoom()}
        title="Zoom avanti (+)"
        aria-label="Zoom avanti"
      >
        +
      </button>
      <span className="map-zoom-level tabular-nums" title="Livello zoom corrente">
        z{zoom}
      </span>
      <button
        type="button"
        className="map-zoom-btn"
        onClick={() => map.zoomOut()}
        disabled={zoom <= map.getMinZoom()}
        title="Zoom indietro (-)"
        aria-label="Zoom indietro"
      >
        −
      </button>
      <button
        type="button"
        className="map-zoom-btn map-zoom-reset"
        onClick={() => {
          map.stop();
          map.flyTo([BASES[1].latitude, BASES[1].longitude], 3, { duration: 0.9 });
          onResetOverview?.();
        }}
        title="Vista panoramica Antartide (z3)"
        aria-label="Reset vista panoramica"
      >
        ⌖
      </button>
    </div>
  );
}

function MapMarkersLayer({
  stations,
  selected,
  onSelect,
  health,
  activeLayerMetric,
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    click: () => onSelect?.(null),
  });

  const clusterOffsets = useMemo(
    () => computeClusterOffsets([...stations, ...BASES], zoom),
    [stations, zoom],
  );

  return (
    <>
      {stations.map((s) => {
        const h = health.find((x) => x.station_code === s.code);
        let metricStatus = "NO_DATA";
        if (h) {
          metricStatus =
            activeLayerMetric === "overall"
              ? h.overall || "NO_DATA"
              : h.indicators?.[activeLayerMetric]?.status || "NO_DATA";
        }
        const active = selected === s.code;
        const icon = createStationDotIcon(
          s.name,
          active,
          metricStatus,
          clusterOffsets[s.code],
        );

        return (
          <Marker
            key={s.code}
            position={[s.latitude, s.longitude]}
            icon={icon}
            zIndexOffset={active ? 1000 : 100}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                onSelect?.(s.code);
              },
            }}
          />
        );
      })}

      {BASES.map((b) => {
        const active = selected === b.code;
        const icon = createBaseDotIcon(b.name, active, clusterOffsets[b.code]);
        return (
          <Marker
            key={b.code}
            position={[b.latitude, b.longitude]}
            icon={icon}
            zIndexOffset={active ? 2000 : 1500}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                onSelect?.(b.code);
              },
            }}
          />
        );
      })}
    </>
  );
}

export default function PolarMap({
  stations = [],
  selected,
  onSelect,
  health = [],
  activeLayerMetric = "overall",
  mapLayer = "MODIS",
  focusTarget = null,
  onResetOverview,
}) {
  const layerName =
    mapLayer === "VIIRS"
      ? "VIIRS_SNPP_CorrectedReflectance_TrueColor"
      : "MODIS_Terra_CorrectedReflectance_TrueColor";

  return (
    <MapContainer
      className="polar-map"
      crs={polarCRS}
      center={[BASES[1].latitude, BASES[1].longitude]}
      zoom={3}
      minZoom={0}
      maxZoom={10}
      zoomControl={false}
    >
      <WMSTileLayer
        key={mapLayer}
        url={wmsEndpoint}
        {...wmsBase}
        layers={layerName}
        time={nasaDate}
        maxNativeZoom={7}
      />
      <ScaleControl position="bottomleft" />
      <MapCameraController focusTarget={focusTarget} />
      <MapZoomControls onResetOverview={onResetOverview} />
      <MapMarkersLayer
        stations={stations}
        selected={selected}
        onSelect={onSelect}
        health={health}
        activeLayerMetric={activeLayerMetric}
      />
    </MapContainer>
  );
}
