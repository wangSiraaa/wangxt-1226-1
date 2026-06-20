from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.sample import SampleStatus, MovementType


class MovementBase(BaseModel):
    movement_type: MovementType
    from_location: Optional[str] = Field(None, max_length=100)
    to_location: Optional[str] = Field(None, max_length=100)
    occurred_at: datetime
    remarks: Optional[str] = None
    temperature_at_movement: Optional[str] = Field(None, max_length=20)
    humidity_at_movement: Optional[str] = Field(None, max_length=20)


class MovementCreate(MovementBase):
    pass


class MovementOut(MovementBase):
    id: int
    sample_id: int
    operator_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SamplingRecordBase(BaseModel):
    sampled_at: datetime
    sampled_quantity: int = 1
    out_chamber_time: datetime
    return_chamber_time: Optional[datetime] = None
    total_exposure_minutes: Optional[int] = None
    remarks: Optional[str] = None


class SamplingRecordCreate(SamplingRecordBase):
    sample_id: int
    timepoint_id: int


class SamplingRecordOut(SamplingRecordBase):
    id: int
    sample_id: int
    timepoint_id: int
    operator_id: int
    remaining_quantity: Optional[int] = None
    is_within_window: bool
    window_deviation_note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SampleBase(BaseModel):
    batch_no: Optional[str] = Field(None, max_length=50)
    container_no: Optional[str] = Field(None, max_length=50)
    quantity: int = 1
    unit: str = "unit"
    location: Optional[str] = Field(None, max_length=100)
    chamber_position: Optional[str] = Field(None, max_length=100)


class SampleCreate(SampleBase):
    protocol_id: int
    storage_condition_id: int
    sample_code: str = Field(..., max_length=50)


class SampleGenerateRequest(BaseModel):
    protocol_id: int
    samples_per_condition: int = Field(..., gt=0, le=100)
    code_prefix: Optional[str] = None


class SampleUpdate(BaseModel):
    container_no: Optional[str] = None
    location: Optional[str] = None
    chamber_position: Optional[str] = None
    quantity: Optional[int] = None


class SampleLockRequest(BaseModel):
    lock_reason: str = Field(..., min_length=5)
    related_deviation_id: Optional[int] = None


class SampleUnlockRequest(BaseModel):
    unlock_reason: str = Field(..., min_length=5)


class SampleOut(SampleBase):
    id: int
    sample_code: str
    protocol_id: int
    storage_condition_id: int
    status: SampleStatus
    is_locked: bool
    lock_reason: Optional[str] = None
    locked_at: Optional[datetime] = None
    locked_by: Optional[int] = None
    in_chamber_at: Optional[datetime] = None
    last_movement_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SampleDetailOut(SampleOut):
    movements: List[MovementOut] = []
    sampling_records: List[SamplingRecordOut] = []


class SampleInChamberRequest(BaseModel):
    sample_ids: List[int]
    location: str = Field(..., max_length=100)
    chamber_position: Optional[str] = Field(None, max_length=100)
    temperature: Optional[str] = Field(None, max_length=20)
    humidity: Optional[str] = Field(None, max_length=20)
    remarks: Optional[str] = None


class SampleOutChamberRequest(BaseModel):
    sample_ids: List[int]
    reason: str = Field(..., min_length=3)
    temperature: Optional[str] = Field(None, max_length=20)
    humidity: Optional[str] = Field(None, max_length=20)
    remarks: Optional[str] = None


class SampleCheckWindowResponse(BaseModel):
    sample_id: int
    sample_code: str
    timepoint_id: Optional[int] = None
    timepoint_label: Optional[str] = None
    planned_date: Optional[date] = None
    window_start: Optional[date] = None
    window_end: Optional[date] = None
    can_sample: bool
    reason: str
