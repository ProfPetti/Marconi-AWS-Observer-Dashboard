import React, { useState, useMemo } from "react";
import { IconX, IconRefresh, IconSearch } from "./icons";
import ModalHealthTable from "./ModalHealthTable";
import ModalCardsGrid from "./ModalCardsGrid";

export default function HealthOverviewModal({
  isOpen = false, onClose, stations = [], sortedHealth = [],
  counts = {}, mode = "SIMULATED", onChangeMode,
  scenarioStep = null, timelineData = null, healthError = "",
  onRefreshHealth, onSelectStation,
}) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");

  const handleSelectAndClose = (code) => {
    onSelectStation?.(code);
    onClose?.();
  };

  const filteredHealth = useMemo(() => {
    return sortedHealth.filter((h) => {
      if (statusFilter === "NO_DATA") {
        if (h.overall !== "NO_DATA" && h.overall !== "INSUFFICIENT") return false;
      } else if (statusFilter !== "ALL") {
        if (h.overall !== statusFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const s = stations.find((st) => st.code === h.station_code);
        const nameMatch = (s?.name || "").toLowerCase().includes(q);
        const locMatch = (s?.location || "").toLowerCase().includes(q);
        const codeMatch = (h.station_code || "").toLowerCase().includes(q);
        if (!nameMatch && !locMatch && !codeMatch) return false;
      }
      return true;
    });
  }, [sortedHealth, statusFilter, searchQuery, stations]);

  if (!isOpen) return null;
  const noDataTotal = (counts.INSUFFICIENT ?? 0) + (counts.NO_DATA ?? 0);

  const kpis = [
    { id: "ALL", label: "Tutte", count: sortedHealth.length, dot: null },
    { id: "CRITICAL", label: "Critiche", count: counts.CRITICAL ?? 0, dot: "status-critical" },
    { id: "WARNING", label: "Warning", count: counts.WARNING ?? 0, dot: "status-warning" },
    { id: "OK", label: "Regolari", count: counts.OK ?? 0, dot: "status-ok" },
    { id: "NO_DATA", label: "Senza dati", count: noDataTotal, dot: "status-no_data" },
  ];

  return (
    <div className="windy-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="windy-modal-container health-overview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header Unificato */}
        <header className="modal-header">
          <div className="modal-title-col">
            <h2 className="modal-title">Centro Salute · 17 AWS</h2>
            <p className="modal-subtitle">Diagnostica predittiva su finestra mobile 24h UTC</p>
          </div>

          <div className="modal-header-actions">
            <div className="modal-view-switch" role="group" aria-label="Modalità vista">
              <button
                type="button"
                className={`view-switch-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
              >
                Griglia
              </button>
              <button
                type="button"
                className={`view-switch-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
              >
                Tabella
              </button>
            </div>

            <div className="modal-view-switch" role="group" aria-label="Origine dati">
              <button
                type="button"
                disabled={scenarioStep !== null}
                className={`view-switch-btn ${mode === "SIMULATED" ? "active" : ""}`}
                onClick={() => onChangeMode?.("SIMULATED")}
              >
                SIMULATED
              </button>
              <button
                type="button"
                disabled={scenarioStep !== null}
                className={`view-switch-btn ${mode === "HISTORICAL" ? "active" : ""}`}
                onClick={() => onChangeMode?.("HISTORICAL")}
              >
                HISTORICAL
              </button>
            </div>

            <button
              type="button"
              className="btn-refresh"
              disabled={scenarioStep !== null}
              onClick={onRefreshHealth}
              title="Aggiorna diagnostica"
            >
              <IconRefresh size={14} />
              <span>Aggiorna</span>
            </button>

            <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Chiudi" title="Chiudi">
              <IconX size={18} />
            </button>
          </div>
        </header>

        {/* Barra Filtri KPI + Ricerca */}
        <div className="modal-filter-bar">
          <div className="kpi-filter-pills" role="radiogroup" aria-label="Filtra per stato">
            {kpis.map((k) => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={statusFilter === k.id}
                className={`kpi-filter-btn ${statusFilter === k.id ? "active" : ""}`}
                onClick={() => setStatusFilter(k.id)}
              >
                {k.dot && <span className={`kpi-dot ${k.dot}`} />}
                <span>{k.label}</span>
                <strong className="tabular-nums">({k.count})</strong>
              </button>
            ))}
          </div>

          <div className="modal-search-box">
            <IconSearch size={14} className="search-icon" />
            <input
              type="search"
              placeholder="Cerca stazione o località..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Cerca stazione"
            />
          </div>
        </div>

        {/* Corpo Principale con Scroll */}
        <div className="modal-scroll-content">
          {healthError && <div className="data-warning">{healthError}</div>}
          {viewMode === "grid" ? (
            <ModalCardsGrid
              sortedHealth={filteredHealth}
              stations={stations}
              timelineData={timelineData}
              scenarioStep={scenarioStep}
              onSelectAndClose={handleSelectAndClose}
            />
          ) : (
            <ModalHealthTable
              sortedHealth={filteredHealth}
              stations={stations}
              onSelectAndClose={handleSelectAndClose}
            />
          )}
        </div>

        {/* Footer Sottile */}
        <footer className="modal-footer">
          <p className="modal-footer-disclaimer">
            Diagnostica sperimentale ENEA · PNRA · IAMCO — Il livello CRITICAL segnala una forte anomalia, non la certezza di blocco meccanico.
          </p>
          <span className="modal-footer-counter tabular-nums">
            Mostrate {filteredHealth.length} di {sortedHealth.length} AWS
          </span>
        </footer>
      </div>
    </div>
  );
}
