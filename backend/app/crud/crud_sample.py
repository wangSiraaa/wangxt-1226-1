from datetime import datetime, timedelta, date
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.sample import Sample, SampleMovement, SamplingRecord, SampleStatus, MovementType
from app.models.protocol import StabilityProtocol, SamplingTimepoint, ProtocolStatus
from app.schemas.sample import (
    SampleCreate, SampleUpdate, SampleInChamberRequest,
    SampleOutChamberRequest, SamplingRecordCreate,
    SampleLockRequest, SampleUnlockRequest, SampleGenerateRequest
)
from app.crud.crud_protocol import get_sampling_window_info


def generate_sample_code(protocol_code: str, condition_code: str, index: int) -> str:
    return f"{protocol_code}-{condition_code}-{index:03d}"


def get_sample(db: Session, sample_id: int) -> Optional[Sample]:
    return db.query(Sample).filter(Sample.id == sample_id).first()


def get_sample_by_code(db: Session, code: str) -> Optional[Sample]:
    return db.query(Sample).filter(Sample.sample_code == code).first()


def list_samples(
    db: Session,
    protocol_id: Optional[int] = None,
    condition_id: Optional[int] = None,
    status: Optional[SampleStatus] = None,
    is_locked: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[Sample]:
    query = db.query(Sample)
    if protocol_id:
        query = query.filter(Sample.protocol_id == protocol_id)
    if condition_id:
        query = query.filter(Sample.storage_condition_id == condition_id)
    if status:
        query = query.filter(Sample.status == status)
    if is_locked is not None:
        query = query.filter(Sample.is_locked == is_locked)
    return query.order_by(Sample.created_at.desc()).offset(skip).limit(limit).all()


def list_samples_by_protocol(db: Session, protocol_id: int) -> List[Sample]:
    return list_samples(db, protocol_id=protocol_id)


def create_sample(db: Session, obj_in: SampleCreate) -> Sample:
    db_sample = Sample(**obj_in.model_dump())
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample


def generate_samples_for_protocol(
    db: Session, obj_in: SampleGenerateRequest
) -> Tuple[List[Sample], dict]:
    from app.crud.crud_protocol import get_protocol, list_storage_conditions_by_protocol
    
    protocol = get_protocol(db, obj_in.protocol_id)
    if not protocol:
        return [], {"error": "Protocol not found"}
    if protocol.status not in [ProtocolStatus.APPROVED, ProtocolStatus.IN_PROGRESS]:
        return [], {"error": "Protocol must be APPROVED or IN_PROGRESS to generate samples"}
    
    conditions = list_storage_conditions_by_protocol(db, protocol.id)
    if not conditions:
        return [], {"error": "No storage conditions defined"}
    
    prefix = obj_in.code_prefix or protocol.protocol_code
    created_samples = []
    
    for cond in conditions:
        existing_count = db.query(Sample).filter(
            Sample.storage_condition_id == cond.id
        ).count()
        
        for i in range(1, obj_in.samples_per_condition + 1):
            idx = existing_count + i
            sample_code = generate_sample_code(prefix, cond.condition_code, idx)
            
            existing = get_sample_by_code(db, sample_code)
            if existing:
                continue
            
            db_sample = Sample(
                sample_code=sample_code,
                protocol_id=protocol.id,
                storage_condition_id=cond.id,
                quantity=1,
                location=cond.location,
                chamber_position=cond.chamber_id,
                status=SampleStatus.PENDING,
            )
            db.add(db_sample)
            db.flush()
            created_samples.append(db_sample)
    
    db.commit()
    for s in created_samples:
        db.refresh(s)
    return created_samples, {"created": len(created_samples)}


def update_sample(db: Session, sample_id: int, obj_in: SampleUpdate) -> Optional[Sample]:
    db_sample = get_sample(db, sample_id)
    if not db_sample:
        return None
    update_data = obj_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_sample, field, value)
    db_sample.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_sample)
    return db_sample


def _create_movement(
    db: Session,
    sample_id: int,
    movement_type: MovementType,
    from_loc: Optional[str],
    to_loc: Optional[str],
    operator_id: int,
    remarks: Optional[str] = None,
    temp: Optional[str] = None,
    humidity: Optional[str] = None,
) -> SampleMovement:
    movement = SampleMovement(
        sample_id=sample_id,
        movement_type=movement_type,
        from_location=from_loc,
        to_location=to_loc,
        operator_id=operator_id,
        remarks=remarks,
        temperature_at_movement=temp,
        humidity_at_movement=humidity,
    )
    db.add(movement)
    return movement


def put_samples_in_chamber(
    db: Session, obj_in: SampleInChamberRequest, operator_id: int
) -> Tuple[List[Sample], dict]:
    processed = []
    errors = []
    
    for sid in obj_in.sample_ids:
        sample = get_sample(db, sid)
        if not sample:
            errors.append(f"Sample {sid}: not found")
            continue
        if sample.is_locked:
            errors.append(f"Sample {sample.sample_code}: is locked")
            continue
        if sample.status == SampleStatus.IN_STORAGE:
            errors.append(f"Sample {sample.sample_code}: already in storage")
            continue
        
        _create_movement(
            db, sample.id, MovementType.IN_CHAMBER,
            sample.location, obj_in.location,
            operator_id, obj_in.remarks,
            obj_in.temperature, obj_in.humidity
        )
        
        sample.location = obj_in.location
        sample.chamber_position = obj_in.chamber_position
        sample.status = SampleStatus.IN_STORAGE
        sample.in_chamber_at = datetime.utcnow()
        sample.last_movement_at = datetime.utcnow()
        sample.updated_at = datetime.utcnow()
        processed.append(sample)
    
    db.commit()
    for s in processed:
        db.refresh(s)
    return processed, {"errors": errors}


def take_samples_out_chamber(
    db: Session, obj_in: SampleOutChamberRequest, operator_id: int
) -> Tuple[List[Sample], dict]:
    processed = []
    errors = []
    
    for sid in obj_in.sample_ids:
        sample = get_sample(db, sid)
        if not sample:
            errors.append(f"Sample {sid}: not found")
            continue
        if sample.is_locked:
            errors.append(f"Sample {sample.sample_code}: is locked due to deviation, cannot remove")
            continue
        if sample.status != SampleStatus.IN_STORAGE:
            errors.append(f"Sample {sample.sample_code}: not in storage (status: {sample.status.value})")
            continue
        
        _create_movement(
            db, sample.id, MovementType.OUT_CHAMBER,
            sample.location, None,
            operator_id, f"{obj_in.reason} | {obj_in.remarks or ''}",
            obj_in.temperature, obj_in.humidity
        )
        
        sample.last_movement_at = datetime.utcnow()
        sample.updated_at = datetime.utcnow()
        processed.append(sample)
    
    db.commit()
    for s in processed:
        db.refresh(s)
    return processed, {"errors": errors}


def check_sample_can_be_sampled(
    db: Session, sample: Sample, timepoint_id: int
) -> Tuple[bool, str, Optional[SamplingTimepoint]]:
    if sample.is_locked:
        return False, f"Sample {sample.sample_code} is locked due to deviation", None
    
    timepoint = db.query(SamplingTimepoint).filter(SamplingTimepoint.id == timepoint_id).first()
    if not timepoint:
        return False, "Timepoint not found", None
    
    if timepoint.protocol_id != sample.protocol_id:
        return False, "Timepoint does not belong to sample's protocol", None
    
    window_info = get_sampling_window_info(timepoint)
    if not window_info["can_sample_now"]:
        today = date.today()
        if today < window_info["window_start"]:
            days_left = (window_info["window_start"] - today).days
            return False, (
                f"Sampling window not yet open. Window opens on {window_info['window_start']} "
                f"({days_left} days from now). Cannot sample before window start."
            ), timepoint
        if today > window_info["window_end"]:
            return False, (
                f"Sampling window has closed. Window was {window_info['window_start']} "
                f"to {window_info['window_end']}."
            ), timepoint
    
    existing_count = db.query(SamplingRecord).filter(
        SamplingRecord.sample_id == sample.id,
        SamplingRecord.timepoint_id == timepoint_id,
    ).count()
    if existing_count > 0:
        return False, f"Sample already sampled for this timepoint", timepoint
    
    return True, "OK", timepoint


def create_sampling_record(
    db: Session, obj_in: SamplingRecordCreate, operator_id: int
) -> Tuple[Optional[SamplingRecord], dict]:
    sample = get_sample(db, obj_in.sample_id)
    if not sample:
        return None, {"error": "Sample not found"}
    
    can_sample, reason, timepoint = check_sample_can_be_sampled(db, sample, obj_in.timepoint_id)
    if not can_sample:
        return None, {"error": reason}
    
    today = date.today()
    window_info = get_sampling_window_info(timepoint)
    is_within_window = window_info["window_start"] <= today <= window_info["window_end"]
    
    remaining = (sample.quantity or 0) - obj_in.sampled_quantity
    
    exposure_minutes = None
    if obj_in.out_chamber_time and obj_in.return_chamber_time:
        exposure_minutes = int((obj_in.return_chamber_time - obj_in.out_chamber_time).total_seconds() / 60)
    
    record = SamplingRecord(
        **obj_in.model_dump(exclude={"operator_id"}),
        operator_id=operator_id,
        remaining_quantity=max(remaining, 0),
        is_within_window=is_within_window,
        window_deviation_note=None if is_within_window else (
            f"Sampled outside window. Window: {window_info['window_start']} to {window_info['window_end']}"
        ),
        total_exposure_minutes=exposure_minutes,
    )
    db.add(record)
    db.flush()
    
    _create_movement(
        db, sample.id, MovementType.SAMPLING,
        sample.location, "QC_LAB",
        operator_id, f"Sampling for {timepoint.timepoint_label}"
    )
    
    sample.quantity = max(remaining, 0)
    sample.status = SampleStatus.TESTING if remaining <= 0 else SampleStatus.IN_STORAGE
    sample.last_movement_at = datetime.utcnow()
    sample.updated_at = datetime.utcnow()
    
    condition_count = len(sample.protocol.storage_conditions) if sample.protocol else 1
    effective_count = (timepoint.sample_count_per_condition or 1) * condition_count
    already_sampled = db.query(SamplingRecord).filter(
        SamplingRecord.timepoint_id == timepoint.id
    ).count()
    timepoint.is_sampled = already_sampled
    if already_sampled >= effective_count:
        timepoint.sampled_at = datetime.utcnow()
    timepoint.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(record)
    return record, {
        "is_within_window": is_within_window,
        "remaining": remaining,
        "timepoint_progress": f"{already_sampled}/{effective_count}",
    }


def lock_sample(
    db: Session, sample_id: int, obj_in: SampleLockRequest, operator_id: int
) -> Optional[Sample]:
    sample = get_sample(db, sample_id)
    if not sample:
        return None
    if sample.is_locked:
        return sample
    
    sample.is_locked = True
    sample.lock_reason = obj_in.lock_reason
    sample.locked_at = datetime.utcnow()
    sample.locked_by = operator_id
    sample.updated_at = datetime.utcnow()
    
    prev_status = sample.status
    sample.status = SampleStatus.LOCKED
    
    _create_movement(
        db, sample.id, MovementType.TRANSFER,
        sample.location, sample.location,
        operator_id, f"SAMPLE LOCKED. Reason: {obj_in.lock_reason} | Previous status: {prev_status.value}"
    )
    
    db.commit()
    db.refresh(sample)
    return sample


def unlock_sample(
    db: Session, sample_id: int, obj_in: SampleUnlockRequest, operator_id: int
) -> Optional[Sample]:
    sample = get_sample(db, sample_id)
    if not sample or not sample.is_locked:
        return sample
    
    sample.is_locked = False
    sample.locked_at = None
    sample.locked_by = None
    sample.lock_reason = None
    sample.updated_at = datetime.utcnow()
    
    if sample.quantity and sample.quantity > 0:
        sample.status = SampleStatus.IN_STORAGE
    
    _create_movement(
        db, sample.id, MovementType.TRANSFER,
        sample.location, sample.location,
        operator_id, f"SAMPLE UNLOCKED. Reason: {obj_in.unlock_reason}"
    )
    
    db.commit()
    db.refresh(sample)
    return sample


def list_sampling_records_by_sample(db: Session, sample_id: int) -> List[SamplingRecord]:
    return db.query(SamplingRecord).filter(
        SamplingRecord.sample_id == sample_id
    ).order_by(SamplingRecord.sampled_at.desc()).all()


def list_sampling_records_by_timepoint(db: Session, timepoint_id: int) -> List[SamplingRecord]:
    return db.query(SamplingRecord).filter(
        SamplingRecord.timepoint_id == timepoint_id
    ).order_by(SamplingRecord.sampled_at.desc()).all()
