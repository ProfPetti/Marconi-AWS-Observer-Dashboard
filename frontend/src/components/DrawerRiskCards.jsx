import React from "react";
import {
  RISK_KEYS,
  RISK_NAMES,
  RISK_NOTES,
  STATUS_LABELS,
  fmt,
} from "../constants/awsConfig";

export default function DrawerRiskCards({
  latest,
  healthSelected,
  onRecover,
  recovering = false,
  recoveryComment = "",
}) {
  const quickMetrics = [
    { label: "Temp.", val: fmt(latest?.temperature_c, " °C") },
    { label: "Vento", val: fmt(latest?.wind_speed_kt, " kt") },
    { label: "Press.", val: fmt(latest?.pressure_hpa, " hPa") },
    { label: "Umidità", val: fmt(latest?.humidity_pct, " %") },
    { label: "Batteria", val: fmt(latest?.battery_v, " V") },
    { label: "Tilt MEMS", val: fmt(healthSelected?.indicators?.structural_tilt?.value ?? latest?.tilt_deg, "°") },
  ];

  const tiltStatus = healthSelected?.indicators?.structural_tilt?.status;
  const canRecoverTilt = tiltStatus === "CRITICAL";

  return (
    <div className="station-modal-left">
      {/* Striscia compatta telemetrie istantanee */}
      <div className="station-quick-metrics">
        {quickMetrics.map((m) => (
          <div key={m.label} className="quick-metric-cell">
            <span className="quick-metric-label">{m.label}</span>
            <strong className="quick-metric-val tabular-nums">{m.val}</strong>
          </div>
        ))}
      </div>

      {/* Telecomando IoT di Recupero Esclusivo per Structural Tilt (CRITICAL) */}
      {canRecoverTilt && (
        <div className="recovery-command-banner status-critical">
          <div className="recovery-banner-head">
            <strong>Recupero Strutturale TILT (CRITICAL)</strong>
            <span className="recovery-banner-tag">Attuatore Lineare Stralli</span>
          </div>
          <p className="recovery-banner-desc">
            Rilevata inclinazione critica del pilastro AWS. È possibile azionare da remoto
            l&apos;attuatore lineare collegato al filo di tiraggio in acciaio.
          </p>
          <button
            type="button"
            className="btn-recovery-global"
            disabled={recovering}
            onClick={() => onRecover?.("structural_tilt")}
          >
            {recovering
              ? "Attivazione attuatore in corso..."
              : "⚡ Recupera Stato CRITICAL (TILT)"}
          </button>
        </div>
      )}

      {recoveryComment && (
        <div className="tilt-recovery-comment" role="status">
          <strong>Procedura di recupero TILT attivata</strong>
          <p>{recoveryComment}</p>
        </div>
      )}

      {/* Titolo e griglia dei 5 indicatori diagnostici e strutturali */}
      <h3 className="risk-cards-title">5 Indicatori Diagnostici & Strutturali (AWS + IoT Edge)</h3>
      <div className="risk-cards-grid">
        {RISK_KEYS.map((key) => {
          const ind = healthSelected?.indicators?.[key];
          const status = ind?.status || "NO_DATA";
          const showTiltRecover = key === "structural_tilt" && status === "CRITICAL";
          return (
            <article className={`drawer-risk-card card-status-${status.toLowerCase()}`} key={key}>
              <div className="risk-card-head">
                <span className="risk-title">{RISK_NAMES[key]}</span>
                <span className={`risk-status status-${status.toLowerCase()}`}>
                  {STATUS_LABELS[status] || status}
                </span>
              </div>
              <div className="risk-val tabular-nums">
                {ind?.value == null ? "—" : `${ind.value}${ind.unit ? " " + ind.unit : ""}`}
              </div>
              <p className="risk-explanation">{RISK_NOTES[key]}</p>
              {key === "data_gap" && (
                <div className="data-gap-extra tabular-nums">
                  Ricezione: {ind?.delivery_pct ?? "—"}% ({ind?.received ?? 0}/{ind?.expected ?? 24})
                </div>
              )}
              {key === "structural_tilt" && (
                <div className="data-gap-extra tabular-nums">
                  Vibrazione stralli: {ind?.vibration_rms_deg ?? "0.18"}° RMS (25 Hz)
                </div>
              )}
              {showTiltRecover && (
                <button
                  type="button"
                  className="btn-card-recover"
                  disabled={recovering}
                  onClick={() => onRecover?.("structural_tilt")}
                >
                  {recovering ? "Attivazione..." : "⚡ Attiva Attuatore Lineare TILT"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
