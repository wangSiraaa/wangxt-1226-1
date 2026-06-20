from datetime import datetime, timedelta, date
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.protocol import (
    StabilityProtocol, SamplingTimepoint, ProtocolStorageCondition, ProtocolStatus
)
from app.schemas.protocol import ProtocolCreate, ProtocolUpdate, SamplingTimepointUpdate
from app.core.security import get_password_hash


def generate_protocol_code(db: Session, study_type: str) -> str:
    today = date.today().strftime("%Y%m%d")
    prefix = f"STB-{study_type[:3].upper()}-{today}"
    count = db.query(StabilityProtocol).filter(
        StabilityProtocol.protocol_code.like(f"{prefix}%")
    ).count()
    return f"{prefix}-{count + 1:03d}"


def get_protocol(db: Session, protocol_id: int) -> Optional[StabilityProtocol]:
    return db.query(StabilityProtocol).filter(StabilityProtocol.id == protocol_id).first()


def get_protocol_by_code(db: Session, code: str) -> Optional[StabilityProtocol]:
    return db.query(StabilityProtocol).filter(StabilityProtocol.protocol_code == code).first()


def list_protocols(
    db: Session,
    status: Optional[ProtocolStatus] = None,
    created_by: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[StabilityProtocol]:
    query = db.query(StabilityProtocol)
    if status:
        query = query.filter(StabilityProtocol.status == status)
    if created_by:
        query = query.filter(StabilityProtocol.created_by == created_by)
    return query.order_by(StabilityProtocol.created_at.desc()).offset(skip).limit(limit).all()


def create_protocol(db: Session, obj_in: ProtocolCreate, created_by: int) -> StabilityProtocol:
    protocol_code = generate_protocol_code(db, obj_in.study_type)
    
    db_protocol = StabilityProtocol(
        **obj_in.model_dump(exclude={"storage_conditions", "sampling_timepoints"}),
        protocol_code=protocol_code,
        created_by=created_by,
    )
    db.add(db_protocol)
    db.flush()
    
    for cond in obj_in.storage_conditions:
        db_cond = ProtocolStorageCondition(
            protocol_id=db_protocol.id,
            **cond.model_dump()
        )
        db.add(db_cond)
    
    for tp in obj_in.sampling_timepoints:
        db_tp = SamplingTimepoint(
            protocol_id=db_protocol.id,
            **tp.model_dump()
        )
        db.add(db_tp)
    
    db.commit()
    db.refresh(db_protocol)
    return db_protocol


def update_protocol(db: Session, protocol_id: int, obj_in: ProtocolUpdate) -> Optional[StabilityProtocol]:
    db_protocol = get_protocol(db, protocol_id)
    if not db_protocol:
        return None
    
    update_data = obj_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_protocol, field, value)
    
    db_protocol.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_protocol)
    return db_protocol


def update_protocol_status(
    db: Session, protocol_id: int, new_status: ProtocolStatus, approver_id: Optional[int] = None
) -> Optional[StabilityProtocol]:
    db_protocol = get_protocol(db, protocol_id)
    if not db_protocol:
        return None
    
    db_protocol.status = new_status
    if new_status == ProtocolStatus.APPROVED and approver_id:
        db_protocol.approved_at = datetime.utcnow()
        db_protocol.approved_by = approver_id
    
    db_protocol.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_protocol)
    return db_protocol


def delete_protocol(db: Session, protocol_id: int) -> bool:
    db_protocol = get_protocol(db, protocol_id)
    if not db_protocol or db_protocol.status != ProtocolStatus.DRAFT:
        return False
    db.delete(db_protocol)
    db.commit()
    return True


def get_timepoint(db: Session, timepoint_id: int) -> Optional[SamplingTimepoint]:
    return db.query(SamplingTimepoint).filter(SamplingTimepoint.id == timepoint_id).first()


def update_timepoint(
    db: Session, timepoint_id: int, obj_in: SamplingTimepointUpdate
) -> Optional[SamplingTimepoint]:
    db_tp = get_timepoint(db, timepoint_id)
    if not db_tp:
        return None
    
    update_data = obj_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_tp, field, value)
    
    db_tp.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_tp)
    return db_tp


def list_timepoints_by_protocol(db: Session, protocol_id: int) -> List[SamplingTimepoint]:
    return db.query(SamplingTimepoint).filter(
        SamplingTimepoint.protocol_id == protocol_id
    ).order_by(SamplingTimepoint.planned_date).all()


def get_sampling_window_info(timepoint: SamplingTimepoint, check_date: Optional[date] = None) -> dict:
    if check_date is None:
        check_date = date.today()
    
    window_start = timepoint.planned_date - timedelta(days=timepoint.window_before_days)
    window_end = timepoint.planned_date + timedelta(days=timepoint.window_after_days)
    
    is_within_window = window_start <= check_date <= window_end
    can_sample_now = is_within_window and timepoint.is_sampled < (
        get_effective_sample_count(timepoint)
    )
    
    days_until_start = (window_start - check_date).days
    is_urgent = 0 <= days_until_start <= 2
    
    return {
        "timepoint_id": timepoint.id,
        "timepoint_label": timepoint.timepoint_label,
        "planned_date": timepoint.planned_date,
        "window_start": window_start,
        "window_end": window_end,
        "is_within_window": is_within_window,
        "can_sample_now": can_sample_now,
        "days_until_window_start": days_until_start,
        "is_urgent": is_urgent,
    }


def get_effective_sample_count(timepoint: SamplingTimepoint) -> int:
    from app.models.protocol import StabilityProtocol
    protocol = timepoint.protocol
    if not protocol:
        return timepoint.sample_count_per_condition
    condition_count = len(protocol.storage_conditions)
    return timepoint.sample_count_per_condition * condition_count


def get_upcoming_sampling_windows(db: Session, hours_ahead: int = 48) -> List[dict]:
    now = date.today()
    future_cutoff = now + timedelta(hours=hours_ahead / 24)
    
    timepoints = db.query(SamplingTimepoint).join(StabilityProtocol).filter(
        StabilityProtocol.status.in_([ProtocolStatus.APPROVED, ProtocolStatus.IN_PROGRESS]),
        SamplingTimepoint.is_sampled < SamplingTimepoint.sample_count_per_condition,
        SamplingTimepoint.planned_date - timedelta(days=SamplingTimepoint.window_before_days) <= future_cutoff,
    ).all()
    
    results = []
    for tp in timepoints:
        info = get_sampling_window_info(tp)
        results.append(info)
    results.sort(key=lambda x: x["planned_date"])
    return results


def list_storage_conditions_by_protocol(db: Session, protocol_id: int) -> List[ProtocolStorageCondition]:
    return db.query(ProtocolStorageCondition).filter(
        ProtocolStorageCondition.protocol_id == protocol_id
    ).all()
