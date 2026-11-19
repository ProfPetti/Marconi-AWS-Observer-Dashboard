export const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const fmt = (v, unit = "") =>
  v == null ? "—" : `${Number(v).toFixed(1)}${unit}`;

export const BASES = [
  {
    code: "BASE_CONCORDIA",
    name: "Base Concordia",
    location: "Dome C",
    latitude: -75.1,
    longitude: 123.35,
    altitude_m: 3233,
    source_url: "https://www.pnra.aq/it/stazione-concordia",
  },
  {
    code: "BASE_MZS",
    name: "Base Mario Zucchelli",
    location: "Baia Terra Nova",
    latitude: -(74 + 41 / 60 + 42 / 3600),
    longitude: 164 + 7 / 60 + 23 / 3600,
    altitude_m: 15,
    source_url: "https://www.pnra.aq/",
  },
];

export const RISK_KEYS = [
  "battery_stress",
  "ice_locking",
  "thermal_shock",
  "data_gap",
  "structural_tilt",
];

export const RISK_NAMES = {
  battery_stress: "Battery Stress",
  ice_locking: "Ice Locking",
  thermal_shock: "Thermal Shock Rate",
  data_gap: "Data Gap Rate",
  structural_tilt: "Structural Tilt",
};

export const RISK_SHORT_LABELS = {
  overall: "Salute AWS",
  battery_stress: "Batteria",
  ice_locking: "Ghiaccio / Vento",
  thermal_shock: "Shock Termico",
  data_gap: "Data Gap",
  structural_tilt: "Inclinazione",
};

export const RISK_NOTES = {
  battery_stress: "Discesa massima della tensione nelle ore fredde (12h)",
  ice_locking: "Vento nullo e direzione invariata per 12 ore",
  thermal_shock: "Crollo massimo della temperatura in un’ora",
  data_gap: "Percentuale di letture orarie mancanti",
  structural_tilt: "Inclinazione strutturale MEMS 25 Hz (mediana 1s + media 10s)",
};

export const STATUS_LABELS = {
  OK: "NORMAL (Regolare)",
  WARNING: "Attenzione",
  CRITICAL: "Critico",
  INSUFFICIENT: "Dati insufficienti",
  NO_DATA: "Nessun dato",
};

export const STATUS_LABEL_3 = {
  OK: "NORMAL",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
  INSUFFICIENT: "DATI INSUFFICIENTI",
  NO_DATA: "NESSUN DATO",
};

export const STATUS_DESCRIPTION = {
  OK: "Nessuna anomalia rilevata",
  WARNING: "Possibile capacità ridotta / anomalia da verificare",
  CRITICAL: "Rischio elevato: possibile blocco o guasto",
  INSUFFICIENT: "Telemetria insufficiente per valutare il rischio",
  NO_DATA: "Nessuna telemetria disponibile",
};

export const SORT_STATUSES = [
  "CRITICAL",
  "WARNING",
  "INSUFFICIENT",
  "NO_DATA",
  "OK",
];
