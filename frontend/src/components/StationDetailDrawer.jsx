import React, { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { STATUS_LABELS, STATUS_LABEL_3 } from "../constants/awsConfig";
import { IconX, IconExternal } from "./icons";
import DrawerRiskCards from "./DrawerRiskCards";
import DrawerRiskCharts from "./DrawerRiskCharts";

function formatUtcTimestamp(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return (
    d.toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC"
  );
}

export default function StationDetailDrawer({
  isOpen = false, onClose, station, selected, isBase,
  mode = "SIMULATED", latest, chart = [], healthSelected,
  timelineData, scenarioStep, scenarioHistory = [],
  stationHistory = [], onRecover, recovering = false,
}) {
  const [chartTab, setChartTab] = useState(timelineData ? "sim" : "temp");

  useEffect(() => {
    if (timelineData) setChartTab("sim");
  }, [timelineData]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") { e.preventDefault(); onClose?.(); }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const statusKey = healthSelected?.overall || "NO_DATA";
  const statusClass = statusKey.toLowerCase();

  return (
    <div className="station-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="station-modal-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header Unificato */}
        <header className="station-modal-header">
          <div className="station-modal-title-group">
            <div className="station-modal-title-row">
              <h2 className="station-modal-title">{station?.name || selected}</h2>
              {!isBase && (
                <span className={`station-status-badge status-${statusClass}`}>
                  <span className="badge-dot" />
                  {STATUS_LABELS[statusKey] || statusKey}
                </span>
              )}
            </div>
            <p className="station-modal-meta">
              {station?.location} · Quota {station?.altitude_m != null ? `${station.altitude_m} m` : "—"} ·{" "}
              {station?.latitude?.toFixed(4)}, {station?.longitude?.toFixed(4)}
              {!isBase && ` · ${healthSelected?.received_hours ?? "—"}/${healthSelected?.expected_slots ?? 24} letture UTC (${mode})`}
            </p>
          </div>

          <div className="station-modal-actions">
            {!isBase && (
              <div className="modal-view-switch" role="group" aria-label="Grafico visualizzato">
                <button
                  type="button"
                  className={`view-switch-btn ${chartTab === "temp" ? "active" : ""}`}
                  onClick={() => setChartTab("temp")}
                >
                  Temperatura 72h
                </button>
                <button
                  type="button"
                  className={`view-switch-btn ${chartTab === "sim" ? "active" : ""}`}
                  onClick={() => setChartTab("sim")}
                >
                  Simulazione 120s
                </button>
                <button
                  type="button"
                  className={`view-switch-btn ${chartTab === "history" ? "active" : ""}`}
                  onClick={() => setChartTab("history")}
                >
                  Storico Salute
                </button>
              </div>
            )}
            {station?.source_url && (
              <a
                href={station.source_url}
                target="_blank"
                rel="noreferrer"
                className="station-source-link"
                title="Portale ufficiale dati"
                aria-label="Portale ufficiale dati"
              >
                <IconExternal size={15} />
              </a>
            )}
            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Chiudi" title="Chiudi">
              <IconX size={18} />
            </button>
          </div>
        </header>

        {/* Body a 2 Colonne */}
        <div className="station-modal-body">
          {isBase ? (
            <div className="base-notice-modal">
              <h3>Base logistica e di ricerca PNRA</h3>
              <p>
                Le basi ospitano il personale e la strumentazione scientifica. Per consultare
                gli indicatori di rischio e le telemetrie orarie, seleziona una delle stazioni meteorologiche
                automatiche (AWS) dal menu o dalla mappa.
              </p>
              {station?.source_url && (
                <a href={station.source_url} target="_blank" rel="noreferrer" className="btn-refresh">
                  <span>Portale ufficiale PNRA</span>
                  <IconExternal size={14} />
                </a>
              )}
            </div>
          ) : (
            <>
              <DrawerRiskCards
                latest={latest}
                healthSelected={healthSelected}
                onRecover={onRecover}
                recovering={recovering}
              />

              <div className="station-modal-right">
                {chartTab === "temp" ? (
                  <div className="station-chart-card">
                    <div className="station-chart-header">
                      <h3>Andamento temperatura</h3>
                      <small className="tabular-nums">Ultime 72 osservazioni ({mode})</small>
                    </div>

                    {chart.some((x) => x.temperature != null) ? (
                      <div className="station-chart-container">
                        <ResponsiveContainer width="100%" height={290}>
                          <AreaChart data={chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="stationTempFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#e6edf3" stopOpacity={0.18} />
                                <stop offset="95%" stopColor="#e6edf3" stopOpacity={0.01} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                            <XAxis dataKey="time" stroke="#8b98a5" minTickGap={35} tick={{ fontSize: 11 }} />
                            <YAxis stroke="#8b98a5" tick={{ fontSize: 11 }} />
                            <Tooltip
                              contentStyle={{
                                background: "#161c24",
                                border: "1px solid rgba(255,255,255,0.12)",
                                color: "#e6edf3",
                                borderRadius: "6px",
                                fontSize: "12px",
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="temperature"
                              name="Temperatura °C"
                              stroke="#e6edf3"
                              strokeWidth={2}
                              fill="url(#stationTempFill)"
                              connectNulls={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="empty-chart-notice">Nessuna osservazione per questa stazione e modalità.</div>
                    )}
                  </div>
                ) : chartTab === "sim" ? (
                  <DrawerRiskCharts selected={selected} timelineData={timelineData} scenarioStep={scenarioStep} />
                ) : (
                  <div className="station-chart-card health-history-card">
                    <div className="station-chart-header">
                      <h3>Storico Stati di Salute — {station?.name || selected}</h3>
                      <small className="tabular-nums">
                        {stationHistory.length} snapshot SQLite ({mode})
                      </small>
                    </div>

                    {scenarioStep !== null && scenarioHistory.length > 0 && (
                      <div className="history-sim-strip">
                        <span className="history-sim-label">Simulazione 120s attiva:</span>
                        <div className="history-sim-pills">
                          {scenarioHistory.map((item) => {
                            const st = item.stations?.find((x) => x.station_code === selected);
                            const ov = st?.overall || "NO_DATA";
                            return (
                              <span
                                key={item.step}
                                className={`risk-status status-${ov.toLowerCase()} tabular-nums`}
                              >
                                {item.stage}: {STATUS_LABEL_3[ov] || ov}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {stationHistory.length === 0 ? (
                      <div className="empty-chart-notice">
                        Nessuno storico registrato per questa stazione.
                      </div>
                    ) : (
                      <div className="health-history-list">
                        {stationHistory.map((log) => {
                          const ovClass = (log.overall || "NO_DATA").toLowerCase();
                          const isRecovery = log.event_type === "REMOTE_RECOVERY";
                          const miniBadges = [
                            { label: "Batt", st: log.battery_status, val: log.battery_val, unit: "V/h" },
                            { label: "Ice", st: log.ice_status, val: log.ice_val, unit: "h" },
                            { label: "Therm", st: log.thermal_status, val: log.thermal_val, unit: "°C/h" },
                            { label: "Gap", st: log.gap_status, val: log.gap_val, unit: "%" },
                            { label: "Tilt", st: log.tilt_status, val: log.tilt_val, unit: "°" },
                          ];
                          return (
                            <article
                              key={log.id}
                              className={`health-history-item ${isRecovery ? "is-recovery" : ""}`}
                            >
                              <div className="history-item-top">
                                <div className="history-item-meta">
                                  <span className="history-time tabular-nums">
                                    {formatUtcTimestamp(log.timestamp)}
                                  </span>
                                  {isRecovery ? (
                                    <span className="history-event-badge recovery">
                                      ⚡ TELECOMANDO RECUPERO IoT
                                    </span>
                                  ) : (
                                    <span className="history-event-badge">
                                      Controllo Diagnostico
                                    </span>
                                  )}
                                </div>
                                <span className={`risk-status status-${ovClass}`}>
                                  {STATUS_LABEL_3[log.overall] || log.overall}
                                </span>
                              </div>
                              {log.note && <p className="history-item-note">{log.note}</p>}
                              <div className="history-mini-badges">
                                {miniBadges.map((mb) => (
                                  <span
                                    key={mb.label}
                                    className={`history-mini-pill status-${(mb.st || "no_data").toLowerCase()} tabular-nums`}
                                  >
                                    {mb.label}:{" "}
                                    {mb.val == null ? "—" : `${mb.val} ${mb.unit}`}
                                  </span>
                                ))}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
