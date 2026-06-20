from datetime import date
from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, require_role
from app.models.user import User, RoleEnum
from app.models.environment import AlertLevel
from app.crud.crud_environment import (
    list_environment_records, create_environment_record,
    list_environment_alerts, acknowledge_alert, get_environment_daily_stats,
    get_environment_record, get_environment_alert
)
from app.crud.crud_user import get_users_by_role
from app.crud.crud_notification import create_notifications
from app.models.notification import NotificationType
from app.schemas.environment import (
    EnvironmentRecordCreate, EnvironmentRecordOut,
    EnvironmentAlertOut, EnvironmentAlertAcknowledge,
    EnvironmentStats
)

router = APIRouter(prefix="/api/environment", tags=["Environment Monitoring"])


@router.get("/records", response_model=List[EnvironmentRecordOut])
def list_records(
    chamber_id: Optional[str] = None,
    condition_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    has_deviation_only: bool = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=5000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    records = list_environment_records(
        db, chamber_id, condition_id, start_date, end_date, has_deviation_only, skip, limit
    )
    return [EnvironmentRecordOut.model_validate(r) for r in records]


@router.post("/records", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_new_record(
    record_in: EnvironmentRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.WAREHOUSE, RoleEnum.QA, RoleEnum.RESEARCHER, RoleEnum.ADMIN)),
) -> Any:
    record, alerts = create_environment_record(db, record_in, recorded_by=current_user.id)
    
    if alerts:
        qa_users = get_users_by_role(db, RoleEnum.QA)
        if qa_users:
            critical_count = sum(1 for a in alerts if a.alert_level == AlertLevel.CRITICAL)
            create_notifications(db, type('NC', (), {
                'user_ids': [u.id for u in qa_users],
                'notification_type': NotificationType.ENVIRONMENT_ALERT,
                'title': f'温湿度偏差警报 - {record.chamber_id}',
                'message': (
                    f'培养箱 {record.chamber_id} 检测到 {len(alerts)} 个环境警报，'
                    f'其中严重警报 {critical_count} 个。请 QA 及时查看并确认。'
                ),
                'related_type': 'environment_record',
                'related_id': record.id,
                'priority': 3 if critical_count > 0 else 2,
            })())
    
    return {
        "record": EnvironmentRecordOut.model_validate(record),
        "alerts": [EnvironmentAlertOut.model_validate(a) for a in alerts],
        "deviation_detected": len(alerts) > 0,
    }


@router.get("/records/{record_id}", response_model=EnvironmentRecordOut)
def get_single_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    record = get_environment_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return EnvironmentRecordOut.model_validate(record)


@router.get("/alerts", response_model=List[EnvironmentAlertOut])
def list_alerts(
    chamber_id: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    level: Optional[AlertLevel] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    alerts = list_environment_alerts(
        db, chamber_id, acknowledged, level, start_date, end_date, skip, limit
    )
    return [EnvironmentAlertOut.model_validate(a) for a in alerts]


@router.get("/alerts/{alert_id}", response_model=EnvironmentAlertOut)
def get_single_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    alert = get_environment_alert(db, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return EnvironmentAlertOut.model_validate(alert)


@router.post("/alerts/{alert_id}/acknowledge", response_model=dict)
def acknowledge_single_alert(
    alert_id: int,
    ack_in: EnvironmentAlertAcknowledge,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    alert, deviation_id = acknowledge_alert(db, alert_id, ack_in, operator_id=current_user.id)
    if not alert:
        raise HTTPException(status_code=400, detail="Alert not found or already acknowledged")
    
    result = {
        "alert": EnvironmentAlertOut.model_validate(alert),
        "deviation_created": deviation_id is not None,
    }
    if deviation_id:
        result["deviation_id"] = deviation_id
    
    return result


@router.get("/daily-stats/{chamber_id}", response_model=EnvironmentStats)
def get_daily_stats(
    chamber_id: str,
    stats_date: date = Query(..., description="Date for stats (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    stats = get_environment_daily_stats(db, chamber_id, stats_date)
    return EnvironmentStats(**stats)
