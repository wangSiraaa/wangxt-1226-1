import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


class SampleStatus(str, enum.Enum):
    PENDING = "pending"
    IN_STORAGE = "in_storage"
    IN_SAMPLING_WINDOW = "in_sampling_window"
    SAMPLED = "sampled"
    TESTING = "testing"
    TESTED = "tested"
    LOCKED = "locked"
    DISCARDED = "discarded"


class MovementType(str, enum.Enum):
    IN_CHAMBER = "in_chamber"
    OUT_CHAMBER = "out_chamber"
    TRANSFER = "transfer"
    SAMPLING = "sampling"
    RETURN = "return"


class Sample(Base):
    __tablename__ = "samples"

    id = Column(Integer, primary_key=True, index=True)
    sample_code = Column(String(50), unique=True, nullable=False, index=True)
    
    protocol_id = Column(Integer, ForeignKey("stability_protocols.id"), nullable=False)
    storage_condition_id = Column(Integer, ForeignKey("protocol_storage_conditions.id"), nullable=False)
    
    batch_no = Column(String(50))
    container_no = Column(String(50))
    quantity = Column(Integer, default=1)
    unit = Column(String(20), default="unit")
    
    status = Column(SQLEnum(SampleStatus), default=SampleStatus.PENDING, nullable=False)
    is_locked = Column(Boolean, default=False)
    lock_reason = Column(Text, nullable=True)
    locked_at = Column(DateTime, nullable=True)
    locked_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    location = Column(String(100))
    chamber_position = Column(String(100))
    
    in_chamber_at = Column(DateTime, nullable=True)
    last_movement_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    protocol = relationship("StabilityProtocol", back_populates="samples")
    storage_condition = relationship("ProtocolStorageCondition", back_populates="samples")
    movements = relationship("SampleMovement", back_populates="sample", cascade="all, delete-orphan", order_by="SampleMovement.occurred_at.desc()")
    sampling_records = relationship("SamplingRecord", back_populates="sample", cascade="all, delete-orphan")
    test_results = relationship("TestResult", back_populates="sample", cascade="all, delete-orphan")
    deviation_links = relationship("DeviationAffectedSample", back_populates="sample")


class SampleMovement(Base):
    __tablename__ = "sample_movements"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    
    movement_type = Column(SQLEnum(MovementType), nullable=False)
    from_location = Column(String(100))
    to_location = Column(String(100))
    occurred_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    remarks = Column(Text)
    
    temperature_at_movement = Column(String(20))
    humidity_at_movement = Column(String(20))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    sample = relationship("Sample", back_populates="movements")
    operator = relationship("User", foreign_keys=[operator_id], back_populates="created_movements")


class SamplingRecord(Base):
    __tablename__ = "sampling_records"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    timepoint_id = Column(Integer, ForeignKey("sampling_timepoints.id"), nullable=False)
    
    sampled_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    operator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    sampled_quantity = Column(Integer, default=1)
    remaining_quantity = Column(Integer)
    
    out_chamber_time = Column(DateTime, nullable=False)
    return_chamber_time = Column(DateTime)
    total_exposure_minutes = Column(Integer)
    
    is_within_window = Column(Boolean, default=True)
    window_deviation_note = Column(Text)
    
    remarks = Column(Text)
    attachments = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    sample = relationship("Sample", back_populates="sampling_records")
    timepoint = relationship("SamplingTimepoint", back_populates="sampling_records")
    operator = relationship("User", foreign_keys=[operator_id], back_populates="created_samplings")
    test_result = relationship("TestResult", back_populates="sampling_record", uselist=False)
