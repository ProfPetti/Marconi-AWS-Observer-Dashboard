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
    source: str
    quality: str
    imported_at: str
    class Config:
        from_attributes = True
