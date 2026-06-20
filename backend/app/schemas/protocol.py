from datetime import datetime, date
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field

from app.models.protocol import ProtocolStatus


class StorageConditionBase(BaseModel):
    condition_code: str = Field(..., max_length=50)
    condition_name: str = Field(..., max_length=100)
    temperature_min: float
    temperature_max: float
    temperature_target: float
    humidity_min: Optional[float] = None
    humidity_max: Optional[float] = None
    humidity_target: Optional[float] = None
    light_condition: Optional[str] = Field(None, max_length=100)
    location: str = Field(..., max_length=100)
    chamber_id: Optional[str] = Field(None, max_length=50)


class StorageConditionCreate(StorageConditionBase):
    pass


class StorageConditionOut(StorageConditionBase):
    id: int
    protocol_id: int

    class Config:
        from_attributes = True


class SamplingTimepointBase(BaseModel):
    timepoint_month: int = Field(..., ge=0)
    timepoint_label: str = Field(..., max_length=50)
    planned_date: date
    window_before_days: int = 3
    window_after_days: int = 3
    sample_count_per_condition: int = 1


class SamplingTimepointCreate(SamplingTimepointBase):
    pass


class SamplingTimepointUpdate(BaseModel):
    window_before_days: Optional[int] = None
    window_after_days: Optional[int] = None
    sample_count_per_condition: Optional[int] = None


class SamplingTimepointOut(SamplingTimepointBase):
    id: int
    protocol_id: int
    is_sampled: int
    sampled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProtocolBase(BaseModel):
    title: str = Field(..., max_length=200)
    product_name: str = Field(..., max_length=100)
    batch_number: str = Field(..., max_length=50)
    specification: Optional[str] = Field(None, max_length=200)
    manufacturer: Optional[str] = Field(None, max_length=100)
    package_type: Optional[str] = Field(None, max_length=100)
    study_type: str = Field(..., max_length=50)
    start_date: date
    expected_end_date: date
    total_duration_months: int = Field(..., gt=0)
    purpose: Optional[str] = None
    testing_scope: Optional[str] = None
    reference_standards: Optional[str] = None


class ProtocolCreate(ProtocolBase):
    storage_conditions: List[StorageConditionCreate]
    sampling_timepoints: List[SamplingTimepointCreate]


class ProtocolUpdate(BaseModel):
    title: Optional[str] = None
    specification: Optional[str] = None
    manufacturer: Optional[str] = None
    package_type: Optional[str] = None
    expected_end_date: Optional[date] = None
    purpose: Optional[str] = None
    testing_scope: Optional[str] = None
    reference_standards: Optional[str] = None
    status: Optional[ProtocolStatus] = None


class ProtocolOut(ProtocolBase):
    id: int
    protocol_code: str
    status: ProtocolStatus
    created_by: int
    created_at: datetime
    updated_at: datetime
    approved_at: Optional[datetime] = None
    approved_by: Optional[int] = None
    storage_conditions: List[StorageConditionOut] = []
    sampling_timepoints: List[SamplingTimepointOut] = []

    class Config:
        from_attributes = True


class ProtocolListOut(BaseModel):
    id: int
    protocol_code: str
    title: str
    product_name: str
    batch_number: str
    study_type: str
    status: ProtocolStatus
    start_date: date
    expected_end_date: date
    total_duration_months: int
    created_at: datetime

    class Config:
        from_attributes = True


class ProtocolStatusUpdate(BaseModel):
    status: ProtocolStatus
    remarks: Optional[str] = None


class SamplingWindowInfo(BaseModel):
    timepoint_id: int
    timepoint_label: str
    planned_date: date
    window_start: date
    window_end: date
    is_within_window: bool
    can_sample_now: bool
    days_until_window_start: int
    is_urgent: bool
