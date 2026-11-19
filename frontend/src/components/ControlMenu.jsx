import React, { useEffect, useRef } from "react";
import {
  IconX,
  IconShield,
  IconSatellite,
  IconChevronRight,
  IconMapPin,
  IconRadar,
} from "./icons";
import ControlMenuLayers from "./ControlMenuLayers";
import ControlMenuDataSection from "./ControlMenuDataSection";

export default function ControlMenu({
  isOpen,
  onClose,
  triggerRef,
  counts = {},
  activeAlerts = [],
  onOpenOverview,
  stations = [],
  bases = [],
  selected,
  onSelectStation,
  directorEnabled,
  onToggleDirector,
  activeLayerMetric,
  onChangeLayerMetric,
  mapLayer,
  onChangeMapLayer,
  mode,
  onChangeMode,
  scenarioActive,
  busy,
  message,
  onGenerateDemo,
  onImportCSV,
}) {
  const menuRef = useRef(null);
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    closeBtnRef.current?.focus();
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        triggerRef?.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      triggerRef?.current?.focus();
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const okCount = counts.OK ?? 0;
  const warnCount = counts.WARNING ?? 0;
  const critCount = counts.CRITICAL ?? 0;
  const noDataCount = (counts.INSUFFICIENT ?? 0) + (counts.NO_DATA ?? 0);
  const totalCount = Math.max(1, okCount + warnCount + critCount + noDataCount);

  const kpis = [
    { key: "ok", label: "NORMAL", val: okCount },
    { key: "warning", label: "WARN", val: warnCount },
    { key: "critical", label: "CRIT", val: critCount },
    { key: "no_data", label: "N/D", val: noDataCount },
  ];

  const getStationName = (code) =>
    stations.find((s) => s.code === code)?.name || code;

  return (
    <div className="control-menu-backdrop" onClick={onClose}>
      <aside
        ref={menuRef}
        className="control-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Controllo Rete"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="control-menu-header">
          <div className="control-menu-brand">
            <span className="menu-brand-icon" aria-hidden="true">
              <IconSatellite size={16} />
            </span>
            <div className="menu-brand-text">
              <h2 className="control-menu-title">Marconi AWS Observer</h2>
              <span className="control-menu-subtitle">
                ENEA · PNRA · Mission Control
              </span>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="control-menu-close-btn"
            onClick={onClose}
            title="Chiudi menu (Esc)"
            aria-label="Chiudi"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Sezione 1 — Stato Rete & Barra Proporzionale */}
        <section className="menu-section">
          <div className="menu-section-head">
            <div className="menu-section-title">Stato Rete (17 AWS)</div>
            <span className={`menu-mode-badge ${mode === "SIMULATED" ? "sim" : "hist"}`}>
              {scenarioActive ? "SIM 120s" : mode}
            </span>
          </div>

          <div className="menu-kpi-strip">
            {kpis.map((k) => (
              <div key={k.key} className={`menu-kpi-cell status-${k.key}`}>
                <div className="kpi-cell-top">
                  <span className={`kpi-cell-dot status-${k.key}`} />
                  <strong className="tabular-nums">{k.val}</strong>
                </div>
                <span>{k.label}</span>
              </div>
            ))}
          </div>

          <div className="menu-health-bar" aria-label="Distribuzione stato rete">
            {okCount > 0 && (
              <span
                className="health-seg ok"
                style={{ width: `${(okCount / totalCount) * 100}%` }}
                title={`NORMAL: ${okCount}`}
              />
            )}
            {warnCount > 0 && (
              <span
                className="health-seg warning"
                style={{ width: `${(warnCount / totalCount) * 100}%` }}
                title={`WARNING: ${warnCount}`}
              />
            )}
            {critCount > 0 && (
              <span
                className="health-seg critical"
                style={{ width: `${(critCount / totalCount) * 100}%` }}
                title={`CRITICAL: ${critCount}`}
              />
            )}
            {noDataCount > 0 && (
              <span
                className="health-seg nodata"
                style={{ width: `${(noDataCount / totalCount) * 100}%` }}
                title={`N/D: ${noDataCount}`}
              />
            )}
          </div>

          {activeAlerts.length > 0 && (
            <div className="menu-alerts-quick">
              <div className="menu-alerts-quick-title">
                Accesso rapido allarmi ({activeAlerts.length})
              </div>
              <div className="menu-alerts-chips">
                {activeAlerts.map((alert) => {
                  const stClass = (alert.overall || "WARNING").toLowerCase();
                  return (
                    <button
                      key={alert.station_code}
                      type="button"
                      className={`menu-alert-chip status-${stClass} ${selected === alert.station_code ? "is-selected" : ""}`}
                      onClick={() => onSelectStation(alert.station_code)}
                      title={`Seleziona ${getStationName(alert.station_code)} (${alert.overall})`}
                    >
                      <span className={`chip-dot status-${stClass}`} />
                      <span>{getStationName(alert.station_code)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            className="menu-action-btn primary hero-cta"
            onClick={() => {
              onClose();
              onOpenOverview();
            }}
          >
            <span className="hero-cta-left">
              <IconShield size={16} />
              <span>Apri Centro Salute 17 AWS</span>
            </span>
            <IconChevronRight size={15} />
          </button>
        </section>

        {/* Sezione 2 — Navigazione Stazione & Regia */}
        <section className="menu-section">
          <div className="menu-section-head">
            <label htmlFor="station-search-select" className="menu-section-title">
              Seleziona Stazione o Base
            </label>
            {selected && (
              <button
                type="button"
                className="menu-clear-btn"
                onClick={() => onSelectStation(null)}
              >
                Deseleziona
              </button>
            )}
          </div>

          <div className="menu-select-wrap">
            <IconMapPin size={14} className="select-prefix-icon" />
            <select
              id="station-search-select"
              className="menu-select"
              value={selected || ""}
              onChange={(e) => onSelectStation(e.target.value || null)}
            >
              <option value="">— Tutte le stazioni (vista polare) —</option>
              <optgroup label="Basi di ricerca PNRA">
                {bases.map((b) => (
                  <option key={b.code} value={b.code}>
                    Base {b.name} ({b.location})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Stazioni automatiche AWS">
                {stations.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} — {s.location}
                  </option>
                ))}
              </optgroup>
            </select>
            <IconChevronRight size={14} className="select-chevron-icon" />
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={directorEnabled}
            className={`menu-switch-card ${directorEnabled ? "is-on" : ""}`}
            onClick={() => onToggleDirector(!directorEnabled)}
          >
            <span className="switch-card-icon" aria-hidden="true">
              <IconRadar size={16} />
            </span>
            <div className="switch-card-text">
              <span className="switch-card-title">Regia allarmi automatica</span>
              <span className="switch-card-sub">
                Vola sulla stazione in allarme durante Play
              </span>
            </div>
            <span className="menu-switch-track" aria-hidden="true">
              <span className="menu-switch-thumb" />
            </span>
          </button>
        </section>

        <ControlMenuLayers
          activeLayerMetric={activeLayerMetric}
          onChangeLayerMetric={onChangeLayerMetric}
          mapLayer={mapLayer}
          onChangeMapLayer={onChangeMapLayer}
        />

        <ControlMenuDataSection
          mode={mode}
          onChangeMode={onChangeMode}
          scenarioActive={scenarioActive}
          busy={busy}
          message={message}
          onGenerateDemo={onGenerateDemo}
          onImportCSV={onImportCSV}
        />
      </aside>
    </div>
  );
}
