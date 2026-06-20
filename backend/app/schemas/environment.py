from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.environment import AlertLevel


class EnvironmentRecordBase(BaseModel):
    chamber_id: str = Field(..., max_length=50)
    condition_id: Optional[int] = None
    temperature: float
    humidity: Optional[float] = None
    pressure: Optional[float] = None
    light_intensity: Optional[float] = None
    recorded_at: Optional[datetime] = None
    remarks: Optional[str] = None


class EnvironmentRecordCreate(EnvironmentRecordBase):
    pass


class EnvironmentRecordOut(EnvironmentRecordBase):
    id: int
    is_valid: bool
    temp_min_limit: Optional[float] = None
    temp_max_limit: Optional[float] = None
    humidity_min_limit: Optional[float] = None
    humidity_max_limit: Optional[float] = None
    temp_deviation: float
    humidity_deviation: float
    has_deviation: bool
    recorded_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EnvironmentAlertBase(BaseModel):
    chamber_id: str = Field(..., max_length=50)
    alert_type: str = Field(..., max_length=50)
    alert_level: AlertLevel = AlertLevel.WARNING
    parameter_name: str = Field(..., max_length=50)
    actual_value: float
    expected_min: Optional[float] = None
    expected_max: Optional[float] = None
    deviation_amount: Optional[float] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: int = 0


class EnvironmentAlertAcknowledge(BaseModel):
    acknowledge_remark: str = Field(..., min_length=3)
    create_deviation: bool = False


class EnvironmentAlertOut(EnvironmentAlertBase):
    id: int
    record_id: Optional[int] = None
    is_acknowledged: bool
    acknowledged_by: Optional[int] = None
    acknowledged_at: Optional[datetime] = None
    acknowledge_remark: Optional[str] = None
    has_deviation_report: bool
    deviation_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EnvironmentStats(BaseModel):
    chamber_id: str
    date: date
    avg_temperature: Optional[float] = None
    min_temperature: Optional[float] = None
    max_temperature: Optional[float] = None
    avg_humidity: Optional[float] = None
    min_humidity: Optional[float] = None
    max_humidity: Optional[float] = None
    total_records: int
    deviation_count: int
