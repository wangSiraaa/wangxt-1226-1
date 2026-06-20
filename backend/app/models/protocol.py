import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Date, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


class ProtocolStatus(str, enum.Enum):
    DRAFT = "draft"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class StabilityProtocol(Base):
    __tablename__ = "stability_protocols"

    id = Column(Integer, primary_key=True, index=True)
    protocol_code = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    product_name = Column(String(100), nullable=False)
    batch_number = Column(String(50), nullable=False)
    specification = Column(String(200))
    manufacturer = Column(String(100))
    package_type = Column(String(100))
    
    study_type = Column(String(50), nullable=False)
    storage_conditions = relationship("ProtocolStorageCondition", back_populates="protocol", cascade="all, delete-orphan")
    
    start_date = Column(Date, nullable=False)
    expected_end_date = Column(Date, nullable=False)
    total_duration_months = Column(Integer, nullable=False)
    
    purpose = Column(Text)
    testing_scope = Column(Text)
    reference_standards = Column(Text)
    
    status = Column(SQLEnum(ProtocolStatus), default=ProtocolStatus.DRAFT, nullable=False)
    
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    sampling_timepoints = relationship("SamplingTimepoint", back_populates="protocol", cascade="all, delete-orphan")
    samples = relationship("Sample", back_populates="protocol", cascade="all, delete-orphan")
    deviations = relationship("DeviationInvestigation", back_populates="protocol")
    
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_protocols")


class ProtocolStorageCondition(Base):
    __tablename__ = "protocol_storage_conditions"

    id = Column(Integer, primary_key=True, index=True)
    protocol_id = Column(Integer, ForeignKey("stability_protocols.id"), nullable=False)
    
    condition_code = Column(String(50), nullable=False)
    condition_name = Column(String(100), nullable=False)
    temperature_min = Column(Float, nullable=False)
    temperature_max = Column(Float, nullable=False)
    temperature_target = Column(Float, nullable=False)
    humidity_min = Column(Float)
    humidity_max = Column(Float)
    humidity_target = Column(Float)
    light_condition = Column(String(100))
    
    location = Column(String(100), nullable=False)
    chamber_id = Column(String(50))
    
    protocol = relationship("StabilityProtocol", back_populates="storage_conditions")
    samples = relationship("Sample", back_populates="storage_condition")


class SamplingTimepoint(Base):
    __tablename__ = "sampling_timepoints"

    id = Column(Integer, primary_key=True, index=True)
    protocol_id = Column(Integer, ForeignKey("stability_protocols.id"), nullable=False)
    
    timepoint_month = Column(Integer, nullable=False)
    timepoint_label = Column(String(50), nullable=False)
    planned_date = Column(Date, nullable=False)
    
    window_before_days = Column(Integer, default=3)
    window_after_days = Column(Integer, default=3)
    
    sample_count_per_condition = Column(Integer, default=1)
    
    is_sampled = Column(Integer, default=0)
    sampled_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    protocol = relationship("StabilityProtocol", back_populates="sampling_timepoints")
    sampling_records = relationship("SamplingRecord", back_populates="timepoint")
