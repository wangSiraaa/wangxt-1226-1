import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Table, Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


class RoleEnum(str, enum.Enum):
    RESEARCHER = "researcher"
    WAREHOUSE = "warehouse"
    QA = "qa"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    created_protocols = relationship("StabilityProtocol", foreign_keys="StabilityProtocol.created_by", back_populates="creator")
    approved_results = relationship("TestResultApproval", back_populates="approver")
    created_deviations = relationship("DeviationInvestigation", foreign_keys="DeviationInvestigation.reported_by", back_populates="reporter")
    handled_deviations = relationship("DeviationInvestigation", foreign_keys="DeviationInvestigation.handled_by", back_populates="handler")
    notifications = relationship("Notification", back_populates="user")
    created_movements = relationship("SampleMovement", foreign_keys="SampleMovement.operator_id", back_populates="operator")
    created_samplings = relationship("SamplingRecord", foreign_keys="SamplingRecord.operator_id", back_populates="operator")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(SQLEnum(RoleEnum), unique=True, nullable=False)
    description = Column(String(200))

    users = relationship("UserRole", back_populates="role")


class UserRole(Base):
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="roles")
    role = relationship("Role", back_populates="users")
