import React from "react";

const baseProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
};

export function IconPlay({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPause({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <rect x="6" y="4" width="4" height="16" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconMenu({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}

export function IconX({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function IconChevronRight({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function IconChart({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <line x1="18" x2="18" y1="20" y2="10" />
      <line x1="12" x2="12" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="14" />
    </svg>
  );
}

export function IconShield({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

export function IconLayers({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
      <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
      <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
    </svg>
  );
}

export function IconSatellite({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <path d="M13 7 9 3 5 7l4 4" />
      <path d="m17 11 4 4-4 4-4-4" />
      <path d="m8 12 4 4" />
      <path d="m16 8 4 4" />
      <path d="M12 20a8 8 0 1 0-8-8" />
    </svg>
  );
}

export function IconDatabase({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  );
}

export function IconUpload({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}

export function IconExternal({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function IconSearch({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function IconRefresh({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

export function IconAlertTriangle({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

export function IconBattery({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <rect x="2" y="7" width="16" height="10" rx="2" />
      <line x1="22" x2="22" y1="11" y2="13" />
      <line x1="6" x2="6" y1="10" y2="14" />
      <line x1="10" x2="10" y1="10" y2="14" />
    </svg>
  );
}

export function IconSnowflake({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <line x1="2" x2="22" y1="12" y2="12" />
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="m20 16-4-4 4-4" />
      <path d="m4 8 4 4-4 4" />
      <path d="m16 4-4 4-4-4" />
      <path d="m8 20 4-4 4 4" />
    </svg>
  );
}

export function IconThermometer({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
    </svg>
  );
}

export function IconRadio({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
      <path d="M19.1 4.9C23 8.8 23 15.2 19.1 19.1" />
    </svg>
  );
}

export function IconCompass({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

export function IconRadar({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" />
      <path d="M4 6h.01" />
      <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" />
      <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67" />
      <path d="M12 18h.01" />
      <path d="M17.99 11.66A6 6 0 0 1 15.77 16.67" />
      <circle cx="12" cy="12" r="2" />
      <path d="m13.41 10.59 5.66-5.66" />
    </svg>
  );
}

export function IconMapPin({ size = 20, className = "", ...props }) {
  return (
    <svg width={size} height={size} {...baseProps} className={className} {...props}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

