import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Date, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


class ResultStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class TestResult(Base):
    __tablename__ = "test_results"

    id = Column(Integer, primary_key=True, index=True)
    result_code = Column(String(50), unique=True, nullable=False, index=True)
    
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    sampling_record_id = Column(Integer, ForeignKey("sampling_records.id"), nullable=False)
    
    testing_date = Column(Date, nullable=False)
    testing_lab = Column(String(100))
    testing_method = Column(String(200))
    instrument_no = Column(String(50))
    analyst = Column(String(100), nullable=False)
    
    overall_conclusion = Column(Text)
    is_oos = Column(Boolean, default=False)
    is_oot = Column(Boolean, default=False)
    
    status = Column(SQLEnum(ResultStatus), default=ResultStatus.DRAFT, nullable=False)
    
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    
    sample = relationship("Sample", back_populates="test_results")
    sampling_record = relationship("SamplingRecord", back_populates="test_result")
    items = relationship("TestResultItem", back_populates="result", cascade="all, delete-orphan")
    approvals = relationship("TestResultApproval", back_populates="result", cascade="all, delete-orphan", order_by="TestResultApproval.approved_at.desc()")


class TestResultItem(Base):
    __tablename__ = "test_result_items"

    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(Integer, ForeignKey("test_results.id"), nullable=False)
    
    test_item_code = Column(String(50), nullable=False)
    test_item_name = Column(String(200), nullable=False)
    
    specification_limit = Column(String(200))
    result_value = Column(String(100))
    result_numeric = Column(Float)
    unit = Column(String(20))
    
    is_conforming = Column(Boolean, default=True)
    is_oos = Column(Boolean, default=False)
    is_oot = Column(Boolean, default=False)
    
    remarks = Column(Text)
    
    result = relationship("TestResult", back_populates="items")


class TestResultApproval(Base):
    __tablename__ = "test_result_approvals"

    id = Column(Integer, primary_key=True, index=True)
    result_id = Column(Integer, ForeignKey("test_results.id"), nullable=False)
    
    approval_type = Column(String(50), nullable=False)
    approval_action = Column(String(20), nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approved_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    comments = Column(Text)
    
    electronic_signature = Column(String(255))
    
    result = relationship("TestResult", back_populates="approvals")
    approver = relationship("User", back_populates="approved_results")
