import React from "react";
import { RISK_KEYS, STATUS_LABEL_3 } from "../constants/awsConfig";
import { IconChevronRight } from "./icons";

export default function ModalHealthTable({
  sortedHealth = [],
  stations = [],
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
    <div className="health-table-wrap">
      <table className="health-table" aria-label="Tabella comparativa salute 17 stazioni AWS">
        <thead>
          <tr>
            <th>Stazione AWS</th>
            <th>Stato Complessivo</th>
            <th>Battery</th>
            <th>Ice</th>
            <th>Thermal</th>
            <th>Gap</th>
            <th>Tilt</th>
            <th>Azione</th>
          </tr>
        </thead>
        <tbody>
          {sortedHealth.map((h) => {
            const s = stations.find((st) => st.code === h.station_code);
            const statusClass = (h.overall || "NO_DATA").toLowerCase();

            return (
              <tr
                key={h.station_code}
                onClick={() => onSelectAndClose(h.station_code)}
                className="clickable-row"
              >
                <td>
                  <b>{s?.name || h.station_code}</b>{" "}
                  <small>({s?.location || h.station_code})</small>
                </td>
                <td>
                  <span className={`risk-status status-${statusClass}`}>
                    {STATUS_LABEL_3[h.overall] || h.overall}
                  </span>
                </td>
                {RISK_KEYS.map((k) => {
                  const ind = h.indicators?.[k];
                  const indStatusClass = (ind?.status || "NO_DATA").toLowerCase();
                  return (
                    <td key={k}>
                      <span className={`risk-status status-${indStatusClass} tabular-nums`}>
                        {ind?.value == null ? "—" : `${ind.value} ${ind.unit || ""}`}
                      </span>
                    </td>
                  );
                })}
                <td>
                  <button
                    type="button"
                    className="table-jump-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectAndClose(h.station_code);
                    }}
                  >
                    <span>Mappa</span>
                    <IconChevronRight size={13} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
