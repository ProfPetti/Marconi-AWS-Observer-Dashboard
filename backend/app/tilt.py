"""MEMS 3-axis accelerometer structural tilt processing and simulation (25 Hz).

Implements the ENEA/PNRA AUSDA-CON 2026 edge pipeline:
1. Initial calibration over the first 5 seconds (125 samples at 25 Hz) to obtain
   the reference gravity vector (ax_ref, ay_ref, az_ref).
2. Angular variation in degrees relative to the calibration reference via dot product.
3. 1-second median filter (25 samples per second).
4. 10-second moving average over up to 10 consecutive median values.
5. Structural Tilt classification:
   - OK (NORMAL): [0°, 2°[
   - WARNING:     [2°, 5°[
   - CRITICAL:    [5°, +∞[
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import math
import random
import statistics
from typing import Iterable

FS_HZ = 25
CALIB_SECONDS = 5
MOVING_AVG_WINDOW = 10
TILT_WARNING_DEG = 2.0
TILT_CRITICAL_DEG = 5.0
TILT_DETAIL = "Inclinazione e vibrazione stralli MEMS 25Hz (calib 5s, mediana 1s, media mobile 10s)"


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _norm(x: float, y: float, z: float) -> float:
    return math.sqrt(x * x + y * y + z * z)


def classify_tilt_status(tilt_deg: float | None) -> str:
    """Map structural tilt angle (degrees) to dashboard status."""
    if tilt_deg is None or not math.isfinite(tilt_deg):
        return "INSUFFICIENT"
    if tilt_deg >= TILT_CRITICAL_DEG:
        return "CRITICAL"
    if tilt_deg >= TILT_WARNING_DEG:
        return "WARNING"
    return "OK"


def assess_tilt_value(
    tilt_deg: float | None,
    vibration_rms_deg: float | None = None,
) -> dict:
    """Return an indicator dictionary compatible with health.indicator()."""
    if tilt_deg is None or not math.isfinite(tilt_deg):
        return {
            "status": "INSUFFICIENT",
            "value": None,
            "unit": "°",
            "vibration_rms_deg": None,
            "detail": TILT_DETAIL,
        }
    rounded = round(float(tilt_deg), 2)
    vib = (
        round(float(vibration_rms_deg), 2)
        if vibration_rms_deg is not None and math.isfinite(vibration_rms_deg)
        else round(0.08 + 0.22 * float(tilt_deg), 2)
    )
    return {
        "status": classify_tilt_status(rounded),
        "value": rounded,
        "unit": "°",
        "vibration_rms_deg": vib,
        "detail": TILT_DETAIL,
    }


def simulate_mems_xyz(
    target_tilt_deg: float = 0.5,
    duration_sec: int = 60,
    gust_deg: float = 0.8,
    seed: int = 42,
    start_utc: datetime | None = None,
) -> list[dict]:
    """Generate synthetic 3-axis MEMS accelerometer samples at 25 Hz in g units.

    The first 5 seconds represent static vertical calibration around (0, 0, 1.0)
    with Gaussian sensor noise (sigma=0.005 g). Subsequent samples apply the
    target structural inclination plus wind-gust oscillations and MEMS noise.
    """
    if duration_sec <= 0:
        return []
    rng = random.Random(seed)
    t0 = (start_utc or datetime.now(timezone.utc)).astimezone(timezone.utc)
    total_samples = duration_sec * FS_HZ
    calib_samples = CALIB_SECONDS * FS_HZ
    dt_step = timedelta(seconds=1.0 / FS_HZ)
    azimuth_rad = math.radians(30.0)

    samples: list[dict] = []
    for idx in range(total_samples):
        ts = (t0 + idx * dt_step).isoformat()
        if idx < calib_samples:
            angle_rad = 0.0
        else:
            t_post = (idx - calib_samples) / FS_HZ
            gust = gust_deg * math.sin(2.0 * math.pi * t_post / 3.5) + (
                0.35 * gust_deg * math.sin(2.0 * math.pi * t_post / 1.1)
            )
            angle_rad = math.radians(target_tilt_deg + gust)

        ax_clean = math.sin(angle_rad) * math.cos(azimuth_rad)
        ay_clean = math.sin(angle_rad) * math.sin(azimuth_rad)
        az_clean = math.cos(angle_rad)

        ax = round(ax_clean + rng.gauss(0.0, 0.005), 5)
        ay = round(ay_clean + rng.gauss(0.0, 0.005), 5)
        az = round(az_clean + rng.gauss(0.0, 0.005), 5)
        samples.append({"timestamp": ts, "ax": ax, "ay": ay, "az": az})
    return samples


def process_mems_samples(
    samples: Iterable[dict],
    fs: int = FS_HZ,
    calib_sec: int = CALIB_SECONDS,
) -> dict:
    """Run the 25 Hz MEMS tilt pipeline: 5s calibration, 1s median, 10s moving avg."""
    sample_list = list(samples)
    sample_count = len(sample_list)
    calib_count = max(1, int(fs * calib_sec))

    if sample_count <= calib_count:
        return {
            "tilt_deg": None,
            "vibration_rms_deg": None,
            "status": "INSUFFICIENT",
            "calibration_vector": None,
            "sec_medians": [],
            "moving_averages_10s": [],
            "sample_count": sample_count,
        }

    calib_slice = sample_list[:calib_count]
    ax_ref = sum(float(s["ax"]) for s in calib_slice) / calib_count
    ay_ref = sum(float(s["ay"]) for s in calib_slice) / calib_count
    az_ref = sum(float(s["az"]) for s in calib_slice) / calib_count
    ref_norm = _norm(ax_ref, ay_ref, az_ref)

    if ref_norm <= 1e-9:
        return {
            "tilt_deg": None,
            "vibration_rms_deg": None,
            "status": "INSUFFICIENT",
            "calibration_vector": (ax_ref, ay_ref, az_ref),
            "sec_medians": [],
            "moving_averages_10s": [],
            "sample_count": sample_count,
        }

    post_samples = sample_list[calib_count:]
    angles_deg: list[float] = []
    for s in post_samples:
        ax = float(s["ax"])
        ay = float(s["ay"])
        az = float(s["az"])
        a_norm = _norm(ax, ay, az)
        if a_norm <= 1e-9:
            continue
        dot = ax * ax_ref + ay * ay_ref + az * az_ref
        cos_theta = _clamp(dot / (a_norm * ref_norm), -1.0, 1.0)
        angles_deg.append(math.degrees(math.acos(cos_theta)))

    if not angles_deg:
        return {
            "tilt_deg": None,
            "vibration_rms_deg": None,
            "status": "INSUFFICIENT",
            "calibration_vector": (round(ax_ref, 5), round(ay_ref, 5), round(az_ref, 5)),
            "sec_medians": [],
            "moving_averages_10s": [],
            "sample_count": sample_count,
        }

    window_1s = max(1, int(fs))
    sec_medians: list[float] = [
        round(statistics.median(angles_deg[i : i + window_1s]), 4)
        for i in range(0, len(angles_deg), window_1s)
    ]

    moving_averages_10s: list[float] = []
    for idx in range(len(sec_medians)):
        start_idx = max(0, idx - MOVING_AVG_WINDOW + 1)
        window = sec_medians[start_idx : idx + 1]
        moving_averages_10s.append(round(sum(window) / len(window), 4))

    tilt_deg = round(moving_averages_10s[-1], 2)
    vibration_rms_deg = round(statistics.stdev(angles_deg), 2) if len(angles_deg) > 1 else 0.0
    return {
        "tilt_deg": tilt_deg,
        "vibration_rms_deg": vibration_rms_deg,
        "status": classify_tilt_status(tilt_deg),
        "calibration_vector": (round(ax_ref, 5), round(ay_ref, 5), round(az_ref, 5)),
        "sec_medians": sec_medians,
        "moving_averages_10s": moving_averages_10s,
        "sample_count": sample_count,
    }


# Aliases matching planning documents
simulate_mems_stream = simulate_mems_xyz
assess_structural_tilt = assess_tilt_value

