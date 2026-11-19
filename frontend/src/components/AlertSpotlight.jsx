import React from "react";
import { RISK_NAMES, RISK_NOTES, STATUS_LABELS } from "../constants/awsConfig";

export default function AlertSpotlight({ event }) {
  if (!event) return null;

  const {
    station_code,
    to: status = "WARNING",
    indicators = [],
    seconds = 0,
    stationName,
    location,
  } = event;

  const statusClass = status.toLowerCase();
  const statusLabel = STATUS_LABELS[status] || status;

  return (
    <aside
      className="alert-spotlight"
      role="status"
      aria-live="polite"
      aria-label={`Allarme ${statusLabel} per stazione ${stationName || station_code}`}
    >
      <div className="spotlight-header">
        <div className={`spotlight-badge status-${statusClass}`}>
          <span className="badge-dot" />
          <span className="badge-text">{statusLabel.toUpperCase()}</span>
        </div>
        <span className="spotlight-time tabular-nums">t = {seconds} s</span>
      </div>

      <div className="spotlight-body">
        <h2 className="spotlight-station-title">{stationName || station_code}</h2>
        {location && <p className="spotlight-location">{location}</p>}

        {indicators.length > 0 && (
          <ul className="spotlight-indicators-list" role="list">
            {indicators.map((ind) => {
              const name = RISK_NAMES[ind.key] || ind.key;
              const note = RISK_NOTES[ind.key];
              const valueStr =
                ind.value != null
                  ? `${Number(ind.value).toFixed(1)}${ind.unit ? " " + ind.unit : ""}`
                  : null;

              return (
                <li key={ind.key} className="spotlight-indicator-item">
                  <div className="indicator-row">
                    <span className="indicator-name">{name}</span>
                    {valueStr && (
                      <span className="indicator-val tabular-nums">
                        {valueStr}
                      </span>
                    )}
                  </div>
                  {note && <div className="indicator-note">{note}</div>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

