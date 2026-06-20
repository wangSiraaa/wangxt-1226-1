import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


class AlertLevel(str, enum.Enum):
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"


class EnvironmentRecord(Base):
    __tablename__ = "environment_records"

    id = Column(Integer, primary_key=True, index=True)
    
    chamber_id = Column(String(50), nullable=False, index=True)
    condition_id = Column(Integer, ForeignKey("protocol_storage_conditions.id"), nullable=True)
    
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    temperature = Column(Float, nullable=False)
    humidity = Column(Float)
    pressure = Column(Float)
    light_intensity = Column(Float)
    
    is_valid = Column(Boolean, default=True)
    
    temp_min_limit = Column(Float)
    temp_max_limit = Column(Float)
    humidity_min_limit = Column(Float)
    humidity_max_limit = Column(Float)
    
    temp_deviation = Column(Float, default=0)
    humidity_deviation = Column(Float, default=0)
    has_deviation = Column(Boolean, default=False)
    
    recorded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    remarks = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    alerts = relationship("EnvironmentAlert", back_populates="record")


class EnvironmentAlert(Base):
    __tablename__ = "environment_alerts"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("environment_records.id"), nullable=False)
    
    chamber_id = Column(String(50), nullable=False)
    alert_type = Column(String(50), nullable=False)
    alert_level = Column(SQLEnum(AlertLevel), default=AlertLevel.WARNING, nullable=False)
    
    parameter_name = Column(String(50), nullable=False)
    actual_value = Column(Float, nullable=False)
    expected_min = Column(Float)
    expected_max = Column(Float)
    deviation_amount = Column(Float)
    
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=0)
    
    is_acknowledged = Column(Boolean, default=False)
    acknowledged_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    acknowledge_remark = Column(Text)
    
    has_deviation_report = Column(Boolean, default=False)
    deviation_id = Column(Integer, ForeignKey("deviation_investigations.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    record = relationship("EnvironmentRecord", back_populates="alerts")
    deviation = relationship("DeviationInvestigation", back_populates="alerts")
