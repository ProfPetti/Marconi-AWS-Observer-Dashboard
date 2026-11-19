import React from "react";
import { fmt, STATUS_LABELS } from "../constants/awsConfig";
import { IconX, IconChart, IconExternal, IconChevronRight } from "./icons";

export default function StationCard({
  station,
  isBase,
  latest,
  healthSelected,
  onClose,
  onOpenDrawer,
}) {
  if (!station) return null;

  const overallStatus = healthSelected?.overall || "NO_DATA";
  const overallLabel = STATUS_LABELS[overallStatus] || overallStatus;
  const statusClass = overallStatus.toLowerCase();

  return (
    <aside
      className={`station-card ${!isBase ? `status-accent-${statusClass}` : ""}`}
      aria-label={`Scheda stazione ${station.name}`}
    >
      {/* Header con titolo, località e tasto chiudi */}
      <div className="station-card-header">
        <div className="station-card-title-wrap">
          <h2 className="station-card-name">{station.name}</h2>
          <p className="station-card-meta">
            {station.location}
            {station.altitude_m != null && ` · ${station.altitude_m} m s.l.m.`}
          </p>
        </div>

        <button
          type="button"
          className="station-card-close-btn"
          onClick={onClose}
          title="Chiudi scheda stazione"
          aria-label="Chiudi"
        >
          <IconX size={18} />
        </button>
      </div>

      {/* Badge stato per stazioni AWS */}
      {!isBase && (
        <div className="station-card-status-row">
          <span className={`station-status-badge status-${statusClass}`}>
            <span className="badge-dot" />
            <span className="badge-text">{overallLabel}</span>
          </span>
        </div>
      )}

      {/* Corpo principale */}
      <div className="station-card-body">
        {!isBase ? (
          <div className="telemetry-grid">
            <div className="telemetry-temp-block">
              <span className="temp-value tabular-nums">
                {fmt(latest?.temperature_c, "°")}
              </span>
              <span className="temp-label">Temperatura</span>
            </div>

            <div className="telemetry-details">
              <div className="telemetry-detail-row">
                <span className="detail-label">Vento</span>
                <span className="detail-val tabular-nums">
                  {fmt(latest?.wind_speed_kt, " kt")}{" "}
                  {latest?.wind_direction_deg != null && (
                    <small className="detail-sub">
                      {fmt(latest.wind_direction_deg, "°")}
                    </small>
                  )}
                </span>
              </div>

              <div className="telemetry-detail-row">
                <span className="detail-label">Pressione</span>
                <span className="detail-val tabular-nums">
                  {fmt(latest?.pressure_hpa, " hPa")}
                </span>
              </div>

              <div className="telemetry-detail-row">
                <span className="detail-label">Umidità</span>
                <span className="detail-val tabular-nums">
                  {fmt(latest?.humidity_pct, "%")}
                </span>
              </div>

              {latest?.battery_v != null && (
                <div className="telemetry-detail-row">
                  <span className="detail-label">Batteria</span>
                  <span className="detail-val tabular-nums">
                    {fmt(latest.battery_v, " V")}
                  </span>
                </div>
              )}

              {latest?.tilt_deg != null && (
                <div className="telemetry-detail-row">
                  <span className="detail-label">Tilt MEMS</span>
                  <span className="detail-val tabular-nums">
                    {fmt(latest.tilt_deg, "°")}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="base-info-block">
            <div className="base-info-badge">Base PNRA, non AWS</div>
            <p className="base-info-desc">
              Base di ricerca scientifica logistica in Antartide. Non registra telemetria AWS diretta.
            </p>
            <div className="base-info-coords tabular-nums">
              Lat: {station.latitude?.toFixed(4)} · Lon: {station.longitude?.toFixed(4)}
            </div>
          </div>
        )}
      </div>

      {/* Footer con Dettagli e grafici + link esterno */}
      <div className="station-card-footer">
        <button
          type="button"
          className="station-details-btn"
          onClick={onOpenDrawer}
          title="Apri pannello dettagli, grafici e telecomando recupero"
        >
          <IconChart size={16} />
          <span>Dettagli, Grafici &amp; Telecomando</span>
          <IconChevronRight size={15} />
        </button>

        {station.source_url && (
          <a
            href={station.source_url}
            target="_blank"
            rel="noreferrer"
            className="station-source-link"
            title="Apri scheda ufficiale ClimAntartide"
            aria-label="Scheda ClimAntartide esterna"
          >
            <IconExternal size={16} />
          </a>
        )}
      </div>
    </aside>
  );
}

