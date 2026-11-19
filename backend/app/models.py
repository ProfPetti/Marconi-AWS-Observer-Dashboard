from sqlalchemy import String, Float, DateTime, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base

class Station(Base):
    __tablename__ = "stations"
    code: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    location: Mapped[str] = mapped_column(String(150))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    altitude_m: Mapped[int] = mapped_column(Integer)
    source_url: Mapped[str] = mapped_column(Text)
    variables: Mapped[str] = mapped_column(String(100), default="P,T,U,V,D")

class Observation(Base):
    __tablename__ = "observations"
    __table_args__ = (UniqueConstraint("station_code", "timestamp", "source", name="uq_obs_station_time_source"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    station_code: Mapped[str] = mapped_column(String(32), index=True)
    timestamp: Mapped[str] = mapped_column(String(40), index=True)  # ISO-8601, preserve source timezone
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    battery_v: Mapped[float | None] = mapped_column(Float, nullable=True)
    pressure_hpa: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_speed_kt: Mapped[float | None] = mapped_column(Float, nullable=True)
    wind_direction_deg: Mapped[float | None] = mapped_column(Float, nullable=True)
    tilt_deg: Mapped[float | None] = mapped_column(Float, nullable=True)
    source: Mapped[str] = mapped_column(String(20), index=True)  # HISTORICAL or SIMULATED
    quality: Mapped[str] = mapped_column(String(30), default="NOT_ASSESSED")
    imported_at: Mapped[str] = mapped_column(String(40))


class StationHealthLog(Base):
    __tablename__ = "station_health_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    station_code: Mapped[str] = mapped_column(String(32), index=True)
    timestamp: Mapped[str] = mapped_column(String(40), index=True)
    mode: Mapped[str] = mapped_column(String(20), default="SIMULATED")
    overall: Mapped[str] = mapped_column(String(20))
    battery_status: Mapped[str] = mapped_column(String(20), default="OK")
    battery_val: Mapped[float | None] = mapped_column(Float, nullable=True)
    ice_status: Mapped[str] = mapped_column(String(20), default="OK")
    ice_val: Mapped[float | None] = mapped_column(Float, nullable=True)
    thermal_status: Mapped[str] = mapped_column(String(20), default="OK")
    thermal_val: Mapped[float | None] = mapped_column(Float, nullable=True)
    gap_status: Mapped[str] = mapped_column(String(20), default="OK")
    gap_val: Mapped[float | None] = mapped_column(Float, nullable=True)
    tilt_status: Mapped[str] = mapped_column(String(20), default="OK")
    tilt_val: Mapped[float | None] = mapped_column(Float, nullable=True)
    event_type: Mapped[str] = mapped_column(String(40), default="DIAGNOSTIC_CHECK")
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
