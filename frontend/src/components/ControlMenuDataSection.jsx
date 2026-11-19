import React, { useRef } from "react";
import { IconDatabase, IconUpload, IconRefresh } from "./icons";

export default function ControlMenuDataSection({
  mode,
  onChangeMode,
  scenarioActive,
  busy,
  message,
  onGenerateDemo,
  onImportCSV,
}) {
  const fileInputRef = useRef(null);

  return (
    <>
      <section className="menu-section">
        <div className="menu-section-title with-icon">
          <IconDatabase size={13} />
          <span>Sorgente Telemetria &amp; Dataset</span>
        </div>
        <div className="menu-segmented-track">
          <button
            type="button"
            disabled={scenarioActive}
            className={`menu-segmented-btn ${mode === "SIMULATED" ? "active" : ""}`}
            onClick={() => onChangeMode("SIMULATED")}
          >
            SIMULATED
          </button>
          <button
            type="button"
            disabled={scenarioActive}
            className={`menu-segmented-btn ${mode === "HISTORICAL" ? "active" : ""}`}
            onClick={() => onChangeMode("HISTORICAL")}
          >
            HISTORICAL
          </button>
        </div>
        {scenarioActive && (
          <p className="menu-help-text">Origine bloccata durante la simulazione 120s.</p>
        )}

        <div className="menu-data-grid">
          <button
            type="button"
            className="menu-action-btn"
            disabled={busy}
            onClick={onGenerateDemo}
            title="Rigenera dataset simulato per le ultime 72 ore"
          >
            <IconRefresh size={14} />
            <span>Rigenera Demo 72h</span>
          </button>

          <button
            type="button"
            className="menu-action-btn"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            title="Importa letture meteorologiche da file CSV"
          >
            <IconUpload size={14} />
            <span>Importa CSV</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={onImportCSV}
          />
        </div>

        {message && <div className="menu-feedback-msg">{message}</div>}
      </section>

      <footer className="menu-compact-footer">
        <span className="footer-brand-badge">ENEA · PNRA · AUSDA-CON 2026</span>
        <div className="footer-links">
          <a
            href="https://www.climantartide.it/"
            target="_blank"
            rel="noreferrer"
            className="footer-link"
          >
            ClimAntartide ↗
          </a>
          <a
            href="https://www.pnra.aq/"
            target="_blank"
            rel="noreferrer"
            className="footer-link"
          >
            PNRA ↗
          </a>
        </div>
      </footer>
    </>
  );
}
