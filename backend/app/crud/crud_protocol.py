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


def get_sampling_calendar(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    protocol_id: Optional[int] = None,
) -> List[dict]:
    if start_date is None:
        start_date = date.today() - timedelta(days=30)
    if end_date is None:
        end_date = date.today() + timedelta(days=90)

    query = db.query(SamplingTimepoint).join(StabilityProtocol).filter(
        StabilityProtocol.status.in_([ProtocolStatus.APPROVED, ProtocolStatus.IN_PROGRESS]),
        SamplingTimepoint.planned_date + timedelta(days=SamplingTimepoint.window_after_days) >= start_date,
        SamplingTimepoint.planned_date - timedelta(days=SamplingTimepoint.window_before_days) <= end_date,
    )
    if protocol_id:
        query = query.filter(SamplingTimepoint.protocol_id == protocol_id)

    timepoints = query.order_by(SamplingTimepoint.planned_date).all()
    results = []
    for tp in timepoints:
        info = get_sampling_window_info(tp)
        protocol = tp.protocol
        conditions = protocol.storage_conditions if protocol else []
        effective_total = get_effective_sample_count(tp)

        from app.models.sample import SamplingRecord
        sampled_count = db.query(SamplingRecord).filter(
            SamplingRecord.timepoint_id == tp.id
        ).count()

        status = "completed" if sampled_count >= effective_total else (
            "in_window" if info["is_within_window"] else (
                "urgent" if info["is_urgent"] else "upcoming"
            )
        )

        results.append({
            "id": f"tp-{tp.id}",
            "timepoint_id": tp.id,
            "protocol_id": protocol.id if protocol else 0,
            "protocol_code": protocol.protocol_code if protocol else "",
            "protocol_title": protocol.title if protocol else "",
            "timepoint_label": tp.timepoint_label,
            "planned_date": info["planned_date"],
            "window_start": info["window_start"],
            "window_end": info["window_end"],
            "status": status,
            "is_within_window": info["is_within_window"],
            "is_urgent": info["is_urgent"],
            "can_sample_now": info["can_sample_now"],
            "sample_count_total": effective_total,
            "sample_count_sampled": sampled_count,
            "storage_conditions": [
                {"id": c.id, "code": c.condition_code, "name": c.condition_name, "location": c.location}
                for c in conditions
            ],
        })
    return results


def get_upcoming_samples_by_protocol(
    db: Session,
    protocol_id: int,
    days_ahead: int = 7,
) -> List[dict]:
    from app.models.sample import Sample, SampleStatus, SamplingRecord

    protocol = get_protocol(db, protocol_id)
    if not protocol:
        return []

    cutoff_date = date.today() + timedelta(days=days_ahead)

    timepoints = db.query(SamplingTimepoint).filter(
        SamplingTimepoint.protocol_id == protocol_id,
        SamplingTimepoint.is_sampled < SamplingTimepoint.sample_count_per_condition,
        SamplingTimepoint.planned_date - timedelta(days=SamplingTimepoint.window_before_days) <= cutoff_date,
    ).order_by(SamplingTimepoint.planned_date).all()

    results = []
    for tp in timepoints:
        info = get_sampling_window_info(tp)
        samples = db.query(Sample).filter(
            Sample.protocol_id == protocol_id,
            Sample.status.in_([SampleStatus.IN_STORAGE, SampleStatus.IN_SAMPLING_WINDOW]),
        ).all()

        for sample in samples:
            already_sampled = db.query(SamplingRecord).filter(
                SamplingRecord.sample_id == sample.id,
                SamplingRecord.timepoint_id == tp.id,
            ).count()
            if already_sampled > 0:
                continue

            cond = sample.storage_condition
            results.append({
                "sample_id": sample.id,
                "sample_code": sample.sample_code,
                "protocol_id": protocol.id,
                "protocol_code": protocol.protocol_code,
                "timepoint_id": tp.id,
                "timepoint_label": tp.timepoint_label,
                "planned_date": info["planned_date"],
                "window_start": info["window_start"],
                "window_end": info["window_end"],
                "storage_condition_id": cond.id if cond else 0,
                "condition_code": cond.condition_code if cond else "",
                "condition_name": cond.condition_name if cond else "",
                "location": cond.location if cond else (sample.location or ""),
                "chamber_position": sample.chamber_position,
                "is_within_window": info["is_within_window"],
                "can_sample_now": info["can_sample_now"] and not sample.is_locked,
                "days_until_window_start": info["days_until_window_start"],
                "is_urgent": info["is_urgent"],
                "is_locked": sample.is_locked,
            })
    results.sort(key=lambda x: (x["planned_date"], x["sample_code"]))
    return results


def get_available_samples_for_timepoint(
    db: Session,
    timepoint_id: int,
) -> List[dict]:
    from app.models.sample import Sample, SampleStatus, SamplingRecord

    tp = get_timepoint(db, timepoint_id)
    if not tp:
        return []

    info = get_sampling_window_info(tp)
    protocol = tp.protocol

    samples = db.query(Sample).filter(
        Sample.protocol_id == tp.protocol_id,
        Sample.status.in_([SampleStatus.IN_STORAGE, SampleStatus.IN_SAMPLING_WINDOW]),
    ).all()

    results = []
    for sample in samples:
        already_sampled = db.query(SamplingRecord).filter(
            SamplingRecord.sample_id == sample.id,
            SamplingRecord.timepoint_id == tp.id,
        ).count()
        if already_sampled > 0:
            continue

        cond = sample.storage_condition
        results.append({
            "sample_id": sample.id,
            "sample_code": sample.sample_code,
            "protocol_id": protocol.id if protocol else tp.protocol_id,
            "protocol_code": protocol.protocol_code if protocol else "",
            "timepoint_id": tp.id,
            "timepoint_label": tp.timepoint_label,
            "planned_date": info["planned_date"],
            "window_start": info["window_start"],
            "window_end": info["window_end"],
            "storage_condition_id": cond.id if cond else 0,
            "condition_code": cond.condition_code if cond else "",
            "condition_name": cond.condition_name if cond else "",
            "location": cond.location if cond else (sample.location or ""),
            "chamber_position": sample.chamber_position,
            "quantity": sample.quantity,
            "is_within_window": info["is_within_window"],
            "can_sample_now": info["can_sample_now"] and not sample.is_locked,
            "is_locked": sample.is_locked,
            "lock_reason": sample.lock_reason,
        })
    results.sort(key=lambda x: (x["condition_code"], x["sample_code"]))
    return results
