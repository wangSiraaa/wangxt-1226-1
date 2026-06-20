from datetime import datetime, date
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.deviation import (
    DeviationInvestigation, DeviationAffectedSample, DeviationConclusion,
    DeviationStatus, DeviationCategory, DeviationSeverity
)
from app.models.environment import EnvironmentAlert
from app.models.sample import Sample
from app.models.user import RoleEnum
from app.schemas.deviation import (
    DeviationCreate, DeviationUpdate, DeviationAssign,
    DeviationStatusUpdate, DeviationAddAffectedSamples, DeviationClose,
    DeviationConclusionCreate
)


def generate_deviation_code(db: Session, category: DeviationCategory) -> str:
    today = date.today().strftime("%Y%m%d")
    prefix = f"DEV-{category.value[:3].upper()}-{today}"
    count = db.query(DeviationInvestigation).filter(
        DeviationInvestigation.deviation_code.like(f"{prefix}%")
    ).count()
    return f"{prefix}-{count + 1:03d}"


def get_deviation(db: Session, deviation_id: int) -> Optional[DeviationInvestigation]:
    return db.query(DeviationInvestigation).filter(
        DeviationInvestigation.id == deviation_id
    ).first()


def get_deviation_by_code(db: Session, code: str) -> Optional[DeviationInvestigation]:
    return db.query(DeviationInvestigation).filter(
        DeviationInvestigation.deviation_code == code
    ).first()


def list_deviations(
    db: Session,
    status: Optional[DeviationStatus] = None,
    category: Optional[DeviationCategory] = None,
    severity: Optional[DeviationSeverity] = None,
    protocol_id: Optional[int] = None,
    chamber_id: Optional[str] = None,
    reported_by: Optional[int] = None,
    handled_by: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[DeviationInvestigation]:
    query = db.query(DeviationInvestigation)
    if status:
        query = query.filter(DeviationInvestigation.status == status)
    if category:
        query = query.filter(DeviationInvestigation.category == category)
    if severity:
        query = query.filter(DeviationInvestigation.severity == severity)
    if protocol_id:
        query = query.filter(DeviationInvestigation.protocol_id == protocol_id)
    if chamber_id:
        query = query.filter(DeviationInvestigation.chamber_id == chamber_id)
    if reported_by:
        query = query.filter(DeviationInvestigation.reported_by == reported_by)
    if handled_by:
        query = query.filter(DeviationInvestigation.handled_by == handled_by)
    return query.order_by(DeviationInvestigation.created_at.desc()).offset(skip).limit(limit).all()


def _lock_affected_sample(
    db: Session, sample: Sample, deviation: DeviationInvestigation,
    impact_assessment: Optional[str] = None
) -> DeviationAffectedSample:
    from app.crud.crud_sample import lock_sample
    
    if not sample.is_locked:
        sample.is_locked = True
        sample.lock_reason = f"Locked by deviation {deviation.deviation_code}"
        sample.locked_at = datetime.utcnow()
        sample.locked_by = deviation.reported_by
        from app.models.sample import SampleStatus
        sample.status = SampleStatus.LOCKED
    
    link = DeviationAffectedSample(
        deviation_id=deviation.id,
        sample_id=sample.id,
        impact_assessment=impact_assessment or f"Affected by {deviation.category.value} deviation {deviation.deviation_code}",
        was_locked=True,
        locked_at=datetime.utcnow(),
    )
    db.add(link)
    return link


def create_deviation(db: Session, obj_in: DeviationCreate, reported_by: int) -> DeviationInvestigation:
    from app.crud.crud_sample import get_sample
    
    code = generate_deviation_code(db, obj_in.category)
    
    db_dev = DeviationInvestigation(
        **obj_in.model_dump(exclude={"affected_sample_ids", "alert_id"}),
        deviation_code=code,
        reported_by=reported_by,
        status=DeviationStatus.REPORTED,
    )
    db.add(db_dev)
    db.flush()
    
    for sid in obj_in.affected_sample_ids:
        sample = get_sample(db, sid)
        if sample and sample.protocol_id == obj_in.protocol_id:
            _lock_affected_sample(db, sample, db_dev)
    
    if obj_in.alert_id:
        alert = db.query(EnvironmentAlert).filter(EnvironmentAlert.id == obj_in.alert_id).first()
        if alert:
            alert.has_deviation_report = True
            alert.deviation_id = db_dev.id
    
    db.commit()
    db.refresh(db_dev)
    return db_dev


def create_deviation_from_alert(
    db: Session, alert: EnvironmentAlert, operator_id: int
) -> int:
    category_map = {
        "temperature": DeviationCategory.TEMPERATURE,
        "humidity": DeviationCategory.HUMIDITY,
    }
    category = category_map.get(alert.alert_type.split("_")[0], DeviationCategory.OTHER)
    
    samples_query = db.query(Sample).join(
        DeviationInvestigation.protocol_id is not None
    ).filter(
        Sample.chamber_position == alert.chamber_id,
        Sample.is_locked == False,
    ).limit(50).all()
    
    severity = DeviationSeverity.MINOR
    if alert.alert_level.value == "warning":
        severity = DeviationSeverity.MAJOR
    elif alert.alert_level.value == "critical":
        severity = DeviationSeverity.CRITICAL
    
    obj_in = DeviationCreate(
        category=category,
        severity=severity,
        title=f"{alert.parameter_name.upper()} Deviation in Chamber {alert.chamber_id}",
        description=(
            f"{alert.parameter_name.capitalize()} deviation detected. "
            f"Actual: {alert.actual_value}, "
            f"Expected: {alert.expected_min}~{alert.expected_max}. "
            f"Deviation amount: {alert.deviation_amount}. "
            f"Alert level: {alert.alert_level.value}."
        ),
        discovery_date=date.today(),
        occurrence_date=date.today(),
        occurrence_time=alert.start_time,
        chamber_id=alert.chamber_id,
        temp_deviation=str(alert.actual_value) if alert.parameter_name == "temperature" else None,
        humidity_deviation=str(alert.actual_value) if alert.parameter_name == "humidity" else None,
        deviation_duration_minutes=alert.duration_minutes or int(
            (datetime.utcnow() - alert.start_time).total_seconds() / 60
        ),
        affected_sample_ids=[s.id for s in samples_query],
        alert_id=alert.id,
    )
    dev = create_deviation(db, obj_in, operator_id)
    return dev.id


def update_deviation(
    db: Session, deviation_id: int, obj_in: DeviationUpdate, operator_id: int
) -> Optional[DeviationInvestigation]:
    from app.crud.crud_user import user_has_role
    
    dev = get_deviation(db, deviation_id)
    if not dev:
        return None
    if dev.status in [DeviationStatus.CLOSED, DeviationStatus.CANCELLED]:
        return None
    
    update_data = obj_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(dev, field, value)
    
    if obj_in.root_cause_analysis and dev.status == DeviationStatus.UNDER_INVESTIGATION:
        dev.status = DeviationStatus.ROOT_CAUSE_IDENTIFIED
    if obj_in.capa_plan and dev.status == DeviationStatus.ROOT_CAUSE_IDENTIFIED:
        dev.status = DeviationStatus.IMPLEMENTING_CAPA
    
    dev.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dev)
    return dev


def assign_deviation(
    db: Session, deviation_id: int, obj_in: DeviationAssign, operator_id: int
) -> Optional[DeviationInvestigation]:
    dev = get_deviation(db, deviation_id)
    if not dev:
        return None
    
    dev.handled_by = obj_in.handled_by
    dev.assigned_at = datetime.utcnow()
    if dev.status == DeviationStatus.REPORTED:
        dev.status = DeviationStatus.UNDER_INVESTIGATION
    dev.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dev)
    return dev


def update_deviation_status(
    db: Session, deviation_id: int, obj_in: DeviationStatusUpdate, operator_id: int
) -> Optional[DeviationInvestigation]:
    dev = get_deviation(db, deviation_id)
    if not dev:
        return None
    if dev.status in [DeviationStatus.CLOSED, DeviationStatus.CANCELLED]:
        return None
    
    dev.status = obj_in.status
    dev.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dev)
    return dev


def add_affected_samples(
    db: Session, deviation_id: int, obj_in: DeviationAddAffectedSamples, operator_id: int
) -> Optional[DeviationInvestigation]:
    from app.crud.crud_sample import get_sample
    
    dev = get_deviation(db, deviation_id)
    if not dev or dev.status in [DeviationStatus.CLOSED, DeviationStatus.CANCELLED]:
        return None
    
    for sid in obj_in.sample_ids:
        existing = db.query(DeviationAffectedSample).filter(
            DeviationAffectedSample.deviation_id == deviation_id,
            DeviationAffectedSample.sample_id == sid,
        ).first()
        if existing:
            continue
        sample = get_sample(db, sid)
        if not sample:
            continue
        if obj_in.lock_samples:
            _lock_affected_sample(db, sample, dev, obj_in.impact_assessment)
        else:
            link = DeviationAffectedSample(
                deviation_id=dev.id,
                sample_id=sid,
                impact_assessment=obj_in.impact_assessment,
                was_locked=False,
            )
            db.add(link)
    
    dev.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dev)
    return dev


def add_conclusion(
    db: Session, deviation_id: int, obj_in: DeviationConclusionCreate, concluded_by: int
) -> Optional[DeviationConclusion]:
    dev = get_deviation(db, deviation_id)
    if not dev:
        return None
    
    conclusion = DeviationConclusion(
        deviation_id=deviation_id,
        **obj_in.model_dump(),
        concluded_by=concluded_by,
    )
    db.add(conclusion)
    db.commit()
    db.refresh(conclusion)
    return conclusion


def close_deviation(
    db: Session, deviation_id: int, obj_in: DeviationClose, operator_id: int
) -> Optional[DeviationInvestigation]:
    dev = get_deviation(db, deviation_id)
    if not dev or dev.status in [DeviationStatus.CLOSED, DeviationStatus.CANCELLED]:
        return None
    
    dev.final_conclusion = obj_in.final_conclusion
    dev.conclusion_date = obj_in.conclusion_date
    dev.effectiveness_check = obj_in.effectiveness_check
    dev.status = DeviationStatus.COMPLETED
    dev.closed_by = operator_id
    dev.closed_at = datetime.utcnow()
    dev.updated_at = datetime.utcnow()
    
    conclusion = DeviationConclusion(
        deviation_id=deviation_id,
        conclusion_type="final_close",
        conclusion_text=obj_in.final_conclusion,
        concluded_by=operator_id,
    )
    db.add(conclusion)
    db.commit()
    db.refresh(dev)
    return dev


def unlock_affected_samples(
    db: Session, deviation_id: int, operator_id: int
) -> Optional[DeviationInvestigation]:
    from app.crud.crud_sample import unlock_sample
    
    dev = get_deviation(db, deviation_id)
    if not dev:
        return None
    if dev.status != DeviationStatus.COMPLETED:
        return None
    
    links = db.query(DeviationAffectedSample).filter(
        DeviationAffectedSample.deviation_id == deviation_id,
    ).all()
    
    for link in links:
        from app.schemas.sample import SampleUnlockRequest
        req = SampleUnlockRequest(
            unlock_reason=f"Unlocked after deviation {dev.deviation_code} closed. Disposition: {link.disposition_decision or 'Released'}"
        )
        unlock_sample(db, link.sample_id, req, operator_id)
    
    return dev
