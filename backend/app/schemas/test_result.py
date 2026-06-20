from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.test_result import ResultStatus


class TestItemBase(BaseModel):
    test_item_code: str = Field(..., max_length=50)
    test_item_name: str = Field(..., max_length=200)
    specification_limit: Optional[str] = Field(None, max_length=200)
    result_value: Optional[str] = Field(None, max_length=100)
    result_numeric: Optional[float] = None
    unit: Optional[str] = Field(None, max_length=20)
    remarks: Optional[str] = None


class TestItemCreate(TestItemBase):
    is_conforming: Optional[bool] = True


class TestItemOut(TestItemBase):
    id: int
    result_id: int
    is_conforming: bool
    is_oos: bool
    is_oot: bool

    class Config:
        from_attributes = True


class TestApprovalBase(BaseModel):
    approval_type: str = Field(..., max_length=50)
    approval_action: str = Field(..., max_length=20)
    comments: Optional[str] = None


class TestApprovalCreate(TestApprovalBase):
    pass


class TestApprovalOut(TestApprovalBase):
    id: int
    result_id: int
    approver_id: int
    approved_at: datetime
    electronic_signature: Optional[str] = None

    class Config:
        from_attributes = True


class TestResultBase(BaseModel):
    testing_date: date
    testing_lab: Optional[str] = Field(None, max_length=100)
    testing_method: Optional[str] = Field(None, max_length=200)
    instrument_no: Optional[str] = Field(None, max_length=50)
    analyst: str = Field(..., max_length=100)
    overall_conclusion: Optional[str] = None


class TestResultCreate(TestResultBase):
    sample_id: int
    sampling_record_id: int
    items: List[TestItemCreate]


class TestResultUpdate(BaseModel):
    testing_method: Optional[str] = None
    instrument_no: Optional[str] = None
    overall_conclusion: Optional[str] = None
    items: Optional[List[TestItemCreate]] = None


class TestResultSubmit(BaseModel):
    comments: Optional[str] = None


class TestResultReview(BaseModel):
    approved: bool
    comments: str = Field(..., min_length=3)


class TestResultOut(TestResultBase):
    id: int
    result_code: str
    sample_id: int
    sampling_record_id: int
    is_oos: bool
    is_oot: bool
    status: ResultStatus
    created_by: int
    created_at: datetime
    updated_at: datetime
    submitted_at: Optional[datetime] = None
    items: List[TestItemOut] = []
    approvals: List[TestApprovalOut] = []

    class Config:
        from_attributes = True


class TestResultListOut(BaseModel):
    id: int
    result_code: str
    sample_id: int
    testing_date: date
    analyst: str
    status: ResultStatus
    is_oos: bool
    is_oot: bool
    created_at: datetime

    class Config:
        from_attributes = True
