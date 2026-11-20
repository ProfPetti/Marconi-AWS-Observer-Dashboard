from pydantic import BaseModel

class StationOut(BaseModel):
    code: str
    name: str
    location: str
    latitude: float
    longitude: float
    altitude_m: int
    source_url: str
    variables: str
    class Config:
        from_attributes = True

class ObservationOut(BaseModel):
    station_code: str
    timestamp: str
    temperature_c: float | None = None
    battery_v: float | None = None
    pressure_hpa: float | None = None
    humidity_pct: float | None = None
    wind_speed_kt: float | None = None
    wind_direction_deg: float | None = None
    tilt_deg: float | None = None
    source: str
    quality: str
    imported_at: str
    class Config:
        from_attributes = True


class TelemetryIn(BaseModel):
    station_code: str
    timestamp: str
    temperature_c: float | None = None
    battery_v: float | None = None
    pressure_hpa: float | None = None
    humidity_pct: float | None = None
    wind_speed_kt: float | None = None
    wind_direction_deg: float | None = None
    tilt_deg: float | None = None
    source: str = "SIMULATED"


class MemsSampleIn(BaseModel):
    timestamp: str | float | None = None
    ax: float
    ay: float
    az: float


class EdgeTiltPayloadIn(BaseModel):
    station_code: str
    timestamp: str
    samples: list[MemsSampleIn] | None = None
    tilt_deg: float | None = None
    source: str = "SIMULATED"


class HealthHistoryOut(BaseModel):
    id: int
    station_code: str
    timestamp: str
    mode: str
    overall: str
    battery_status: str
    battery_val: float | None = None
    ice_status: str
    ice_val: float | None = None
    thermal_status: str
    thermal_val: float | None = None
    gap_status: str
    gap_val: float | None = None
    tilt_status: str
    tilt_val: float | None = None
    event_type: str
    note: str | None = None
    class Config:
        from_attributes = True


class RecoveryCommandIn(BaseModel):
    station_code: str
    indicator: str = "structural_tilt"
