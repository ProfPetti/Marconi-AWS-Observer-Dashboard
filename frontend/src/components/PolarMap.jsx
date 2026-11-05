import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, WMSTileLayer, Marker, Popup, LayersControl, ScaleControl } from 'react-leaflet';
import 'proj4';
import 'proj4leaflet';

// EPSG:3031 Antarctic polar stereographic. Leaflet markers and WMS imagery
// now share the exact same CRS and geographic-to-projected transformation.
const polarCRS = new L.Proj.CRS(
  'EPSG:3031',
  '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
  {
    origin: [-4194304, 4194304],
    resolutions: [16384, 8192, 4096, 2048, 1024, 512, 256, 128],
    bounds: L.bounds([-4194304, -4194304], [4194304, 4194304])
  }
);

// GIBS WMS (not WMTS) accepts the projected BBOX requested by Leaflet.
// This avoids a mismatch between Leaflet zooms and NASA WMTS TileMatrixSet.
const wmsEndpoint = 'https://gibs.earthdata.nasa.gov/wms/epsg3031/best/wms.cgi';
const wmsBase = {
  version: '1.1.1', // EPSG:3031 axis order is unambiguous here
  format: 'image/jpeg',
  transparent: false,
  tileSize: 256,
  attribution: 'NASA GIBS / NASA Earthdata',
  noWrap: true,
};

const icon = L.divIcon({ className: 'aws-icon', html: '<span class="aws-pulse"><i></i></span>', iconSize: [20,20], iconAnchor: [10,10] });
const selectedIcon = L.divIcon({ className: 'aws-icon aws-selected', html: '<span class="aws-pulse"><i></i></span>', iconSize: [26,26], iconAnchor: [13,13] });
const baseIcon = L.divIcon({ className: 'base-icon', html: '<span class="base-star">★</span>', iconSize: [32,32], iconAnchor: [16,16] });
const selectedBaseIcon = L.divIcon({ className: 'base-icon base-selected', html: '<span class="base-star">★</span>', iconSize: [36,36], iconAnchor: [18,18] });
// Coordinate pubblicate dal PNRA/COMNAP, distinte dalle AWS del CSV.
export const bases = [
  { code: 'BASE_CONCORDIA', name: 'Base Concordia', location: 'Dome C', latitude: -75.1, longitude: 123.35, altitude_m: 3233, source_url: 'https://www.pnra.aq/it/stazione-concordia' },
  { code: 'BASE_MZS', name: 'Base Mario Zucchelli', location: 'Baia Terra Nova', latitude: -(74 + 41/60 + 42/3600), longitude: 164 + 7/60 + 23/3600, altitude_m: 15, source_url: 'https://www.pnra.aq/' }
];
const date = import.meta.env.VITE_NASA_DATE || '2025-01-15';


function StationMarker({ station, selected, onSelect }) {
  const markerRef = useRef(null);
  const active = selected === station.code;
  useEffect(() => {
    if (active) markerRef.current?.openPopup();
    else markerRef.current?.closePopup();
  }, [active]);

  return <Marker
    ref={markerRef}
    position={[station.latitude, station.longitude]}
    icon={active ? selectedIcon : icon}
    zIndexOffset={active ? 1000 : 0}
    eventHandlers={{ click: () => onSelect(station.code) }}
  >
    <Popup><div className="popup-station"><strong>{station.name}</strong><br/>{station.location}<br/>Quota: {station.altitude_m} m<br/>Lat: {station.latitude.toFixed(5)}<br/>Lon: {station.longitude.toFixed(5)}<br/><a href={station.source_url} target="_blank" rel="noreferrer">Scheda ClimAntartide</a></div></Popup>
  </Marker>;
}

function BaseMarker({ base, selected, onSelect }) {
  const markerRef = useRef(null);
  const active = selected === base.code;
  useEffect(() => {
    if (active) markerRef.current?.openPopup();
    else markerRef.current?.closePopup();
  }, [active]);
  return <Marker
    ref={markerRef}
    position={[base.latitude, base.longitude]}
    icon={active ? selectedBaseIcon : baseIcon}
    zIndexOffset={active ? 2000 : 1500}
    eventHandlers={{ click: () => onSelect(base.code) }}
  >
    <Popup><div className="popup-station"><strong>★ {base.name}</strong><br/>{base.location}<br/>Base di ricerca PNRA<br/>Quota: {base.altitude_m} m<br/>Lat: {base.latitude.toFixed(5)}<br/>Lon: {base.longitude.toFixed(5)}<br/><a href={base.source_url} target="_blank" rel="noreferrer">Informazioni ufficiali PNRA</a><br/><small>Base logistica: non è una misura AWS.</small></div></Popup>
  </Marker>;
}

export default function PolarMap({ stations, selected, onSelect }) {
  const mapRef = useRef(null);
  const previousSelected = useRef(null);

  useEffect(() => {
    if (!selected || previousSelected.current === selected) return;
    const station = [...stations, ...bases].find(s => s.code === selected);
    if (!station || !mapRef.current) return;
    // La selezione dal pannello sposta la vista e apre il popup del POI.
    // Non cambia il sistema di riferimento EPSG:3031.
    mapRef.current.setView([station.latitude, station.longitude], Math.max(mapRef.current.getZoom(), 4), { animate: previousSelected.current !== null });
    previousSelected.current = selected;
  }, [selected, stations]);

  return <MapContainer ref={mapRef} className="polar-map" crs={polarCRS} center={[bases[1].latitude, bases[1].longitude]} zoom={4} minZoom={0} maxZoom={7} zoomControl={true}>
    <LayersControl position="topright">
      <LayersControl.BaseLayer checked name="NASA MODIS True Color (250 m)">
        <WMSTileLayer url={wmsEndpoint} {...wmsBase} layers="MODIS_Terra_CorrectedReflectance_TrueColor" time={date} />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="NASA VIIRS True Color (500 m)">
        <WMSTileLayer url={wmsEndpoint} {...wmsBase} layers="VIIRS_SNPP_CorrectedReflectance_TrueColor" time={date} />
      </LayersControl.BaseLayer>
    </LayersControl>
    <ScaleControl position="bottomleft" />
    {stations.map(s => <StationMarker key={s.code} station={s} selected={selected} onSelect={onSelect} />)}
    {bases.map(b => <BaseMarker key={b.code} base={b} selected={selected} onSelect={onSelect} />)}
  </MapContainer>;
}
