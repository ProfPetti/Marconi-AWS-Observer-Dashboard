import React from "react";
import {
  RISK_KEYS,
  RISK_NAMES,
  RISK_SHORT_LABELS,
  STATUS_LABEL_3,
} from "../constants/awsConfig";
import { IconChevronRight } from "./icons";

export default function ModalCardsGrid({
  sortedHealth = [],
  stations = [],
  timelineData = null,
  scenarioStep = null,
  onSelectAndClose,
}) {
  if (sortedHealth.length === 0) {
    return (
      <div className="modal-empty-state">
        Nessuna stazione corrisponde ai filtri selezionati.
      </div>
    );
  }

  return (
    <div className="overview-grid">
      {sortedHealth.map((h) => {
        const s = stations.find((x) => x.code === h.station_code);
        const statusClass = (h.overall || "NO_DATA").toLowerCase();

        return (
          <article
            key={h.station_code}
            className={`overview-card status-${statusClass}`}
            onClick={() => onSelectAndClose(h.station_code)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectAndClose(h.station_code);
              }
            }}
          >
            <div className="overview-card-top">
              <div className="overview-card-title-wrap">
                <h3>{s?.name || h.station_code}</h3>
                <small>{s?.location || h.station_code}</small>
              </div>
              <span className={`risk-status status-${statusClass}`}>
                {STATUS_LABEL_3[h.overall] || h.overall}
              </span>
            </div>

            <div className="overview-indicators">
              {RISK_KEYS.map((k) => {
                const v = h.indicators?.[k];
                const indStatusClass = (v?.status || "no_data").toLowerCase();

                return (
                  <div className="overview-indicator-box" key={k}>
                    <div className="ind-box-header">
                      <span className={`indicator-dot status-${indStatusClass}`} />
                      <span className="ind-box-name">
                        {RISK_SHORT_LABELS[k] || RISK_NAMES[k]}
                      </span>
                    </div>
                    <strong className="ind-box-val tabular-nums">
                      {v?.value == null ? "—" : `${v.value}${v.unit ? " " + v.unit : ""}`}
                    </strong>
                  </div>
                );
              })}
            </div>

            <div className="overview-card-bottom">
              <small className="tabular-nums">
                {h.received_hours ?? "—"}/{timelineData ? (scenarioStep ?? 0) + 1 : 24} letture
              </small>
              <span className="card-map-link">
                <span>Mappa</span>
                <IconChevronRight size={13} />
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
