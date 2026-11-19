import React from "react";
import {
  IconShield,
  IconBattery,
  IconSnowflake,
  IconThermometer,
  IconRadio,
  IconCompass,
  IconSatellite,
  IconLayers,
} from "./icons";

const LAYER_OPTIONS = [
  { id: "overall", label: "Salute Globale", Icon: IconShield },
  { id: "battery_stress", label: "Battery Stress", Icon: IconBattery },
  { id: "ice_locking", label: "Ice Locking", Icon: IconSnowflake },
  { id: "thermal_shock", label: "Thermal Shock", Icon: IconThermometer },
  { id: "data_gap", label: "Data Gap", Icon: IconRadio },
  { id: "structural_tilt", label: "Tilt & Stralli", Icon: IconCompass },
];

export default function ControlMenuLayers({
  activeLayerMetric,
  onChangeLayerMetric,
  mapLayer,
  onChangeMapLayer,
}) {
  return (
    <>
      {/* Layer diagnostico: griglia simmetrica 2x3 con icone dedicate */}
      <section className="menu-section" role="radiogroup" aria-label="Layer diagnostico">
        <div className="menu-section-title with-icon">
          <IconLayers size={13} />
          <span>Layer Diagnostico Mappa</span>
        </div>
        <div className="menu-layer-grid">
          {LAYER_OPTIONS.map(({ id, label, Icon }) => {
            const isActive = activeLayerMetric === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={isActive}
                className={`menu-layer-pill ${isActive ? "active" : ""}`}
                onClick={() => onChangeLayerMetric(id)}
              >
                <span className="pill-left">
                  <Icon size={14} className="pill-icon" />
                  <span className="pill-label">{label}</span>
                </span>
                <span className="pill-dot" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Cartografia Satellitare NASA GIBS */}
      <section className="menu-section">
        <div className="menu-section-title with-icon">
          <IconSatellite size={13} />
          <span>Cartografia Satellitare NASA GIBS</span>
        </div>
        <div className="menu-segmented-track">
          <button
            type="button"
            className={`menu-segmented-btn ${mapLayer === "MODIS" ? "active" : ""}`}
            onClick={() => onChangeMapLayer("MODIS")}
          >
            <span className="seg-main">MODIS Terra</span>
            <span className="seg-sub">250m</span>
          </button>
          <button
            type="button"
            className={`menu-segmented-btn ${mapLayer === "VIIRS" ? "active" : ""}`}
            onClick={() => onChangeMapLayer("VIIRS")}
          >
            <span className="seg-main">VIIRS SNPP</span>
            <span className="seg-sub">500m</span>
          </button>
        </div>
      </section>
    </>
  );
}
