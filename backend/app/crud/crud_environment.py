from datetime import datetime, date, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.models.environment import EnvironmentRecord, EnvironmentAlert, AlertLevel
from app.models.protocol import ProtocolStorageCondition
from app.schemas.environment import (
    EnvironmentRecordCreate, EnvironmentAlertAcknowledge
)
from app.core.config import settings


def _check_deviation(
    value: float, min_limit: Optional[float], max_limit: Optional[float]
) -> Tuple[bool, float]:
    if min_limit is None or max_limit is None:
        return False, 0.0
    deviation = 0.0
    has_deviation = False
    if value < min_limit:
        deviation = value - min_limit
        has_deviation = True
    elif value > max_limit:
        deviation = value - max_limit
        has_deviation = True
    return has_deviation, deviation


def get_environment_record(db: Session, record_id: int) -> Optional[EnvironmentRecord]:
    return db.query(EnvironmentRecord).filter(EnvironmentRecord.id == record_id).first()


def list_environment_records(
    db: Session,
    chamber_id: Optional[str] = None,
    condition_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    has_deviation_only: bool = False,
    skip: int = 0,
    limit: int = 500,
) -> List[EnvironmentRecord]:
    query = db.query(EnvironmentRecord)
    if chamber_id:
        query = query.filter(EnvironmentRecord.chamber_id == chamber_id)
    if condition_id:
        query = query.filter(EnvironmentRecord.condition_id == condition_id)
    if start_date:
        query = query.filter(func.date(EnvironmentRecord.recorded_at) >= start_date)
    if end_date:
        query = query.filter(func.date(EnvironmentRecord.recorded_at) <= end_date)
    if has_deviation_only:
        query = query.filter(EnvironmentRecord.has_deviation == True)
    return query.order_by(EnvironmentRecord.recorded_at.desc()).offset(skip).limit(limit).all()


def create_environment_record(
    db: Session, obj_in: EnvironmentRecordCreate, recorded_by: Optional[int] = None
) -> Tuple[EnvironmentRecord, List[EnvironmentAlert]]:
    temp_min = None
    temp_max = None
    hum_min = None
    hum_max = None
    
    if obj_in.condition_id:
        cond = db.query(ProtocolStorageCondition).filter(
            ProtocolStorageCondition.id == obj_in.condition_id
        ).first()
        if cond:
            temp_min = cond.temperature_min - settings.TEMP_TOLERANCE
            temp_max = cond.temperature_max + settings.TEMP_TOLERANCE
            if cond.humidity_min is not None:
                hum_min = cond.humidity_min - settings.HUMIDITY_TOLERANCE
            if cond.humidity_max is not None:
                hum_max = cond.humidity_max + settings.HUMIDITY_TOLERANCE
    else:
        temp_min = settings.TEMP_NORMAL_MIN - settings.TEMP_TOLERANCE
        temp_max = settings.TEMP_NORMAL_MAX + settings.TEMP_TOLERANCE
        hum_min = settings.HUMIDITY_NORMAL_MIN - settings.HUMIDITY_TOLERANCE
        hum_max = settings.HUMIDITY_NORMAL_MAX + settings.HUMIDITY_TOLERANCE
    
    has_temp_dev, temp_dev = _check_deviation(obj_in.temperature, temp_min, temp_max)
    has_hum_dev, hum_dev = (False, 0.0)
    if obj_in.humidity is not None and hum_min is not None and hum_max is not None:
        has_hum_dev, hum_dev = _check_deviation(obj_in.humidity, hum_min, hum_max)
    
    has_any_deviation = has_temp_dev or has_hum_dev
    
    recorded_at = obj_in.recorded_at or datetime.utcnow()
    
    record = EnvironmentRecord(
        **obj_in.model_dump(exclude={"recorded_at"}),
        recorded_at=recorded_at,
        temp_min_limit=temp_min,
        temp_max_limit=temp_max,
        humidity_min_limit=hum_min,
        humidity_max_limit=hum_max,
        temp_deviation=temp_dev,
        humidity_deviation=hum_dev,
        has_deviation=has_any_deviation,
        recorded_by=recorded_by,
    )
    db.add(record)
    db.flush()
    
    alerts = []
    if has_temp_dev:
        alert = _create_alert_from_record(
            db, record, "temperature", obj_in.temperature, temp_min, temp_max, temp_dev
        )
        alerts.append(alert)
    if has_hum_dev:
        alert = _create_alert_from_record(
            db, record, "humidity", obj_in.humidity, hum_min, hum_max, hum_dev
        )
        alerts.append(alert)
    
    db.commit()
    db.refresh(record)
    for a in alerts:
        db.refresh(a)
    return record, alerts


def _create_alert_from_record(
    db: Session,
    record: EnvironmentRecord,
    param_name: str,
    actual: float,
    min_lim: Optional[float],
    max_lim: Optional[float],
    dev_amount: float,
) -> EnvironmentAlert:
    abs_dev = abs(dev_amount)
    threshold_temp = settings.TEMP_TOLERANCE
    threshold_hum = settings.HUMIDITY_TOLERANCE
    threshold = threshold_temp if param_name == "temperature" else threshold_hum
    
    if abs_dev > threshold * 3:
        level = AlertLevel.CRITICAL
    elif abs_dev > threshold * 1.5:
        level = AlertLevel.WARNING
    else:
        level = AlertLevel.WARNING
    
    alert = EnvironmentAlert(
        record_id=record.id,
        chamber_id=record.chamber_id,
        alert_type=f"{param_name}_deviation",
        alert_level=level,
        parameter_name=param_name,
        actual_value=actual,
        expected_min=min_lim,
        expected_max=max_lim,
        deviation_amount=dev_amount,
        start_time=record.recorded_at,
    )
    db.add(alert)
    return alert


def get_environment_alert(db: Session, alert_id: int) -> Optional[EnvironmentAlert]:
    return db.query(EnvironmentAlert).filter(EnvironmentAlert.id == alert_id).first()


def list_environment_alerts(
    db: Session,
    chamber_id: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    level: Optional[AlertLevel] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[EnvironmentAlert]:
    query = db.query(EnvironmentAlert)
    if chamber_id:
        query = query.filter(EnvironmentAlert.chamber_id == chamber_id)
    if acknowledged is not None:
        query = query.filter(EnvironmentAlert.is_acknowledged == acknowledged)
    if level:
        query = query.filter(EnvironmentAlert.alert_level == level)
    if start_date:
        query = query.filter(func.date(EnvironmentAlert.created_at) >= start_date)
    if end_date:
        query = query.filter(func.date(EnvironmentAlert.created_at) <= end_date)
    return query.order_by(EnvironmentAlert.created_at.desc()).offset(skip).limit(limit).all()


def acknowledge_alert(
    db: Session, alert_id: int, obj_in: EnvironmentAlertAcknowledge, operator_id: int
) -> Tuple[Optional[EnvironmentAlert], Optional[int]]:
    alert = get_environment_alert(db, alert_id)
    if not alert or alert.is_acknowledged:
        return None, None
    
    alert.is_acknowledged = True
    alert.acknowledged_by = operator_id
    alert.acknowledged_at = datetime.utcnow()
    alert.acknowledge_remark = obj_in.acknowledge_remark
    if alert.end_time is None:
        alert.end_time = datetime.utcnow()
        alert.duration_minutes = int(
            (alert.end_time - alert.start_time).total_seconds() / 60
        )
    
    deviation_id = None
    if obj_in.create_deviation:
        from app.crud.crud_deviation import create_deviation_from_alert
        deviation_id = create_deviation_from_alert(db, alert, operator_id)
        alert.has_deviation_report = True
        alert.deviation_id = deviation_id
    
    db.commit()
    db.refresh(alert)
    return alert, deviation_id


def get_environment_daily_stats(
    db: Session, chamber_id: str, stats_date: date
) -> dict:
    records = db.query(EnvironmentRecord).filter(
        EnvironmentRecord.chamber_id == chamber_id,
        func.date(EnvironmentRecord.recorded_at) == stats_date,
    ).all()
    
    if not records:
        return {
            "chamber_id": chamber_id,
            "date": stats_date,
            "total_records": 0,
            "deviation_count": 0,
        }
    
    temps = [r.temperature for r in records]
    hums = [r.humidity for r in records if r.humidity is not None]
    dev_count = sum(1 for r in records if r.has_deviation)
    
    return {
        "chamber_id": chamber_id,
        "date": stats_date,
        "avg_temperature": round(sum(temps) / len(temps), 2),
        "min_temperature": min(temps),
        "max_temperature": max(temps),
        "avg_humidity": round(sum(hums) / len(hums), 2) if hums else None,
        "min_humidity": min(hums) if hums else None,
        "max_humidity": max(hums) if hums else None,
        "total_records": len(records),
        "deviation_count": dev_count,
    }


def find_unacknowledged_alerts(db: Session, minutes_threshold: int = 30) -> List[EnvironmentAlert]:
    cutoff = datetime.utcnow() - timedelta(minutes=minutes_threshold)
    return db.query(EnvironmentAlert).filter(
        EnvironmentAlert.is_acknowledged == False,
        EnvironmentAlert.created_at <= cutoff,
    ).all()
