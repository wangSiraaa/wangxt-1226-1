import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


class NotificationType(str, enum.Enum):
    SAMPLING_REMINDER = "sampling_reminder"
    ENVIRONMENT_ALERT = "environment_alert"
    DEVIATION_REPORTED = "deviation_reported"
    DEVIATION_ASSIGNED = "deviation_assigned"
    RESULT_APPROVAL_REQUEST = "result_approval_request"
    RESULT_APPROVED = "result_approved"
    RESULT_REJECTED = "result_rejected"
    SAMPLE_LOCKED = "sample_locked"
    SAMPLE_UNLOCKED = "sample_unlocked"
    SYSTEM = "system"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    notification_type = Column(SQLEnum(NotificationType), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    
    related_type = Column(String(50))
    related_id = Column(Integer)
    
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    
    priority = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="notifications")
