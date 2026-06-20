from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.deviation import DeviationStatus, DeviationCategory, DeviationSeverity


class AffectedSampleBase(BaseModel):
    sample_id: int
    impact_assessment: Optional[str] = None
    impact_level: Optional[str] = Field(None, max_length=50)
    disposition_decision: Optional[str] = Field(None, max_length=100)
    disposition_rationale: Optional[str] = None


class AffectedSampleCreate(AffectedSampleBase):
    pass


class AffectedSampleOut(AffectedSampleBase):
    id: int
    deviation_id: int
    was_locked: bool
    locked_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DeviationConclusionBase(BaseModel):
    conclusion_type: str = Field(..., max_length=50)
    conclusion_text: str = Field(..., min_length=5)
    attachments: Optional[str] = None


class DeviationConclusionCreate(DeviationConclusionBase):
    pass


class DeviationConclusionOut(DeviationConclusionBase):
    id: int
    deviation_id: int
    concluded_by: int
    concluded_at: datetime

    class Config:
        from_attributes = True


class DeviationBase(BaseModel):
    category: DeviationCategory
    severity: DeviationSeverity = DeviationSeverity.MINOR
    title: str = Field(..., max_length=200)
    description: str = Field(..., min_length=10)
    discovery_date: date
    occurrence_date: Optional[date] = None
    occurrence_time: Optional[datetime] = None
    chamber_id: Optional[str] = Field(None, max_length=50)
    temp_deviation: Optional[str] = Field(None, max_length=100)
    humidity_deviation: Optional[str] = Field(None, max_length=100)
    deviation_duration_minutes: Optional[int] = None
    protocol_id: Optional[int] = None


class DeviationCreate(DeviationBase):
    affected_sample_ids: List[int] = []
    alert_id: Optional[int] = None


class DeviationUpdate(BaseModel):
    severity: Optional[DeviationSeverity] = None
    description: Optional[str] = None
    immediate_actions: Optional[str] = None
    root_cause_analysis: Optional[str] = None
    root_cause_category: Optional[str] = Field(None, max_length=100)
    affected_product_impact: Optional[str] = None
    patient_risk_assessment: Optional[str] = None
    capa_plan: Optional[str] = None
    effectiveness_check: Optional[str] = None
    final_conclusion: Optional[str] = None
    conclusion_date: Optional[date] = None


class DeviationAssign(BaseModel):
    handled_by: int
    remarks: Optional[str] = None


class DeviationStatusUpdate(BaseModel):
    status: DeviationStatus
    remarks: Optional[str] = None


class DeviationAddAffectedSamples(BaseModel):
    sample_ids: List[int]
    lock_samples: bool = True
    impact_assessment: Optional[str] = None


class DeviationClose(BaseModel):
    final_conclusion: str = Field(..., min_length=10)
    conclusion_date: date
    effectiveness_check: str = Field(..., min_length=5)


class DeviationOut(DeviationBase):
    id: int
    deviation_code: str
    status: DeviationStatus
    reported_by: int
    reported_at: datetime
    handled_by: Optional[int] = None
    assigned_at: Optional[datetime] = None
    immediate_actions: Optional[str] = None
    root_cause_analysis: Optional[str] = None
    root_cause_category: Optional[str] = None
    affected_product_impact: Optional[str] = None
    patient_risk_assessment: Optional[str] = None
    capa_plan: Optional[str] = None
    effectiveness_check: Optional[str] = None
    final_conclusion: Optional[str] = None
    conclusion_date: Optional[date] = None
    closed_by: Optional[int] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    affected_samples: List[AffectedSampleOut] = []
    conclusions: List[DeviationConclusionOut] = []

    class Config:
        from_attributes = True


class DeviationListOut(BaseModel):
    id: int
    deviation_code: str
    title: str
    category: DeviationCategory
    severity: DeviationSeverity
    status: DeviationStatus
    discovery_date: date
    protocol_id: Optional[int] = None
    chamber_id: Optional[str] = None
    reported_at: datetime

    class Config:
        from_attributes = True
