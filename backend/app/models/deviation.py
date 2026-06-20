import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Date, Enum as SQLEnum, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class DeviationStatus(str, enum.Enum):
    REPORTED = "reported"
    UNDER_INVESTIGATION = "under_investigation"
    ROOT_CAUSE_IDENTIFIED = "root_cause_identified"
    IMPLEMENTING_CAPA = "implementing_capa"
    COMPLETED = "completed"
    CLOSED = "closed"
    CANCELLED = "cancelled"


class DeviationCategory(str, enum.Enum):
    TEMPERATURE = "temperature"
    HUMIDITY = "humidity"
    SAMPLING = "sampling"
    STORAGE = "storage"
    TESTING = "testing"
    DOCUMENTATION = "documentation"
    OTHER = "other"


class DeviationSeverity(str, enum.Enum):
    MINOR = "minor"
    MAJOR = "major"
    CRITICAL = "critical"


class DeviationInvestigation(Base):
    __tablename__ = "deviation_investigations"

    id = Column(Integer, primary_key=True, index=True)
    deviation_code = Column(String(50), unique=True, nullable=False, index=True)
    
    protocol_id = Column(Integer, ForeignKey("stability_protocols.id"), nullable=True)
    
    category = Column(SQLEnum(DeviationCategory), nullable=False)
    severity = Column(SQLEnum(DeviationSeverity), default=DeviationSeverity.MINOR, nullable=False)
    
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    
    discovery_date = Column(Date, nullable=False)
    occurrence_date = Column(Date)
    occurrence_time = Column(DateTime)
    
    chamber_id = Column(String(50))
    temp_deviation = Column(String(100))
    humidity_deviation = Column(String(100))
    deviation_duration_minutes = Column(Integer)
    
    reported_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reported_at = Column(DateTime, default=datetime.utcnow)
    
    handled_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    
    status = Column(SQLEnum(DeviationStatus), default=DeviationStatus.REPORTED, nullable=False)
    
    immediate_actions = Column(Text)
    root_cause_analysis = Column(Text)
    root_cause_category = Column(String(100))
    
    affected_product_impact = Column(Text)
    patient_risk_assessment = Column(Text)
    
    capa_plan = Column(Text)
    effectiveness_check = Column(Text)
    
    final_conclusion = Column(Text)
    conclusion_date = Column(Date)
    
    closed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    closed_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    protocol = relationship("StabilityProtocol", back_populates="deviations")
    reporter = relationship("User", foreign_keys=[reported_by], back_populates="created_deviations")
    handler = relationship("User", foreign_keys=[handled_by], back_populates="handled_deviations")
    affected_samples = relationship("DeviationAffectedSample", back_populates="deviation", cascade="all, delete-orphan")
    conclusions = relationship("DeviationConclusion", back_populates="deviation", cascade="all, delete-orphan")
    alerts = relationship("EnvironmentAlert", back_populates="deviation")


class DeviationAffectedSample(Base):
    __tablename__ = "deviation_affected_samples"

    id = Column(Integer, primary_key=True, index=True)
    deviation_id = Column(Integer, ForeignKey("deviation_investigations.id"), nullable=False)
    sample_id = Column(Integer, ForeignKey("samples.id"), nullable=False)
    
    impact_assessment = Column(Text)
    impact_level = Column(String(50))
    disposition_decision = Column(String(100))
    disposition_rationale = Column(Text)
    
    was_locked = Column(Boolean, default=False)
    locked_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    deviation = relationship("DeviationInvestigation", back_populates="affected_samples")
    sample = relationship("Sample", back_populates="deviation_links")


class DeviationConclusion(Base):
    __tablename__ = "deviation_conclusions"

    id = Column(Integer, primary_key=True, index=True)
    deviation_id = Column(Integer, ForeignKey("deviation_investigations.id"), nullable=False)
    
    conclusion_type = Column(String(50), nullable=False)
    conclusion_text = Column(Text, nullable=False)
    concluded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    concluded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    attachments = Column(Text)
    
    deviation = relationship("DeviationInvestigation", back_populates="conclusions")
