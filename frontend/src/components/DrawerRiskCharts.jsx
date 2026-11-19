import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { RISK_KEYS, RISK_NAMES, STATUS_LABEL_3 } from "../constants/awsConfig";

export default function DrawerRiskCharts({ selected, timelineData, scenarioStep }) {
  if (!timelineData) {
    return (
      <div className="empty-chart-notice">
        Simulazione 0–120s non attiva. Avvia il Play dalla barra timeline in basso per osservare le curve predittive in tempo reale.
      </div>
    );
  }

  return (
    <div className="timeline-mini-charts-grid">
      {RISK_KEYS.map((key) => {
        const record = timelineData.stations?.find((x) => x.station_code === selected);
        const spec = timelineData.thresholds?.[key];
        const data = (record?.series || []).map((p, i) => ({
          ...p,
          label: `${i * 10}s`,
        }));
        const descending = key === "battery_stress" || key === "thermal_shock";
        const vals = data
          .map((x) => x[key])
          .filter((v) => v !== null && Number.isFinite(v));
        const low =
          Math.min(0, spec?.critical ?? 0, spec?.warning ?? 0, ...vals) -
          Math.max(0.1, Math.abs(spec?.critical || 1) * 0.15);
        const high =
          Math.max(0, spec?.critical ?? 0, spec?.warning ?? 0, ...vals) +
          Math.max(0.1, Math.abs(spec?.critical || 1) * 0.15);
        const warning = spec?.warning;
        const critical = spec?.critical;
        const indicator = record?.indicators?.[key];
        const statusClass = (indicator?.status || "NO_DATA").toLowerCase();

        return (
          <div className="timeline-chart-box" key={key}>
            <div className="chart-box-header">
              <b>{RISK_NAMES[key]}</b>
              <span className={`risk-status status-${statusClass}`}>
                {STATUS_LABEL_3[indicator?.status] || indicator?.status || "NO DATA"}
              </span>
            </div>
            <div className="chart-box-metric tabular-nums">
              {indicator?.value == null ? "—" : `${indicator.value} ${indicator?.unit || ""}`}
            </div>
            <div className="chart-box-svg-wrap">
              <ResponsiveContainer width="100%" height={115}>
                <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -25 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#8b98a5" tick={{ fontSize: 9 }} />
                  <YAxis stroke="#8b98a5" domain={[low, high]} tick={{ fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#161c24",
                      color: "#e6edf3",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "6px",
                      fontSize: "11px",
                    }}
                  />
                  <ReferenceArea y1={low} y2={high} fill="#3fb950" fillOpacity={0.08} />
                  {descending ? (
                    <>
                      <ReferenceArea y1={low} y2={critical} fill="#f85149" fillOpacity={0.2} />
                      <ReferenceArea y1={critical} y2={warning} fill="#d29922" fillOpacity={0.16} />
                    </>
                  ) : (
                    <>
                      <ReferenceArea y1={warning} y2={critical} fill="#d29922" fillOpacity={0.16} />
                      <ReferenceArea y1={critical} y2={high} fill="#f85149" fillOpacity={0.2} />
                    </>
                  )}
                  <ReferenceLine y={warning} stroke="#d29922" strokeDasharray="4 2" />
                  <ReferenceLine y={critical} stroke="#f85149" strokeDasharray="4 2" />
                  <Area
                    type="linear"
                    dataKey={key}
                    stroke="#e6edf3"
                    strokeWidth={2}
                    fill="none"
                    connectNulls={false}
                    dot={{ r: 2, fill: "#e6edf3" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
