from datetime import date
from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, require_role
from app.models.user import User, RoleEnum
from app.models.deviation import DeviationStatus, DeviationCategory, DeviationSeverity
from app.crud.crud_deviation import (
    get_deviation, list_deviations, create_deviation,
    update_deviation, assign_deviation, update_deviation_status,
    add_affected_samples, add_conclusion, close_deviation,
    unlock_affected_samples,
)
from app.crud.crud_user import get_users_by_role
from app.crud.crud_notification import create_notifications
from app.models.notification import NotificationType
from app.schemas.deviation import (
    DeviationCreate, DeviationOut, DeviationUpdate,
    DeviationAssign, DeviationStatusUpdate, DeviationAddAffectedSamples,
    DeviationConclusionCreate, DeviationConclusionOut, DeviationClose,
    DeviationListOut
)

router = APIRouter(prefix="/api/deviations", tags=["Deviation Investigations"])


@router.get("", response_model=List[DeviationListOut])
def list_all_deviations(
    status: Optional[DeviationStatus] = None,
    category: Optional[DeviationCategory] = None,
    severity: Optional[DeviationSeverity] = None,
    protocol_id: Optional[int] = None,
    chamber_id: Optional[str] = None,
    reported_by: Optional[int] = None,
    handled_by: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    devs = list_deviations(
        db, status, category, severity, protocol_id,
        chamber_id, reported_by, handled_by, skip, limit
    )
    return [DeviationListOut.model_validate(d) for d in devs]


@router.post("", response_model=DeviationOut, status_code=status.HTTP_201_CREATED)
def create_new_deviation(
    dev_in: DeviationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.QA, RoleEnum.RESEARCHER, RoleEnum.WAREHOUSE, RoleEnum.ADMIN)),
) -> Any:
    dev = create_deviation(db, dev_in, reported_by=current_user.id)
    
    qa_users = get_users_by_role(db, RoleEnum.QA)
    if qa_users:
        severity_label = dev.severity.value.upper()
        create_notifications(db, type('NC', (), {
            'user_ids': [u.id for u in qa_users],
            'notification_type': NotificationType.DEVIATION_REPORTED,
            'title': f'[{severity_label}] 新偏差报告 - {dev.deviation_code}',
            'message': (
                f'偏差 {dev.deviation_code} ({dev.category.value}) 已报告。'
                f'标题: {dev.title}。'
                f'受影响样品数: {len(dev.affected_samples)}。'
                f'请 QA 指派处理人员。'
            ),
            'related_type': 'deviation',
            'related_id': dev.id,
            'priority': 3 if dev.severity in [DeviationSeverity.MAJOR, DeviationSeverity.CRITICAL] else 2,
        })())
    
    return DeviationOut.model_validate(dev)


@router.get("/{deviation_id}", response_model=DeviationOut)
def get_deviation_detail(
    deviation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    dev = get_deviation(db, deviation_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")
    return DeviationOut.model_validate(dev)


@router.put("/{deviation_id}", response_model=DeviationOut)
def update_existing_deviation(
    deviation_id: int,
    dev_in: DeviationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    dev = get_deviation(db, deviation_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")
    if dev.status in [DeviationStatus.CLOSED, DeviationStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="Cannot update CLOSED/CANCELLED deviation")
    updated = update_deviation(db, deviation_id, dev_in, operator_id=current_user.id)
    return DeviationOut.model_validate(updated)


@router.post("/{deviation_id}/assign", response_model=DeviationOut)
def assign_deviation_handler(
    deviation_id: int,
    assign_in: DeviationAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    dev = get_deviation(db, deviation_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")
    dev = assign_deviation(db, deviation_id, assign_in, operator_id=current_user.id)
    
    create_notifications(db, type('NC', (), {
        'user_ids': [assign_in.handled_by],
        'notification_type': NotificationType.DEVIATION_ASSIGNED,
        'title': f'偏差处理已指派 - {dev.deviation_code}',
        'message': (
            f'您已被指派处理偏差 {dev.deviation_code}。'
            f'标题: {dev.title}。'
            f'{assign_in.remarks or ""}'
        ),
        'related_type': 'deviation',
        'related_id': dev.id,
        'priority': 2,
    })())
    
    return DeviationOut.model_validate(dev)


@router.patch("/{deviation_id}/status", response_model=DeviationOut)
def update_status(
    deviation_id: int,
    status_in: DeviationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    dev = update_deviation_status(db, deviation_id, status_in, operator_id=current_user.id)
    if not dev:
        raise HTTPException(status_code=400, detail="Cannot update status")
    return DeviationOut.model_validate(dev)


@router.post("/{deviation_id}/add-affected-samples", response_model=DeviationOut)
def add_samples_to_deviation(
    deviation_id: int,
    samples_in: DeviationAddAffectedSamples,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    dev = add_affected_samples(db, deviation_id, samples_in, operator_id=current_user.id)
    if not dev:
        raise HTTPException(status_code=400, detail="Failed to add affected samples")
    return DeviationOut.model_validate(dev)


@router.post("/{deviation_id}/conclusions", response_model=DeviationConclusionOut, status_code=status.HTTP_201_CREATED)
def add_new_conclusion(
    deviation_id: int,
    conclusion_in: DeviationConclusionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    dev = get_deviation(db, deviation_id)
    if not dev:
        raise HTTPException(status_code=404, detail="Deviation not found")
    conclusion = add_conclusion(db, deviation_id, conclusion_in, concluded_by=current_user.id)
    if not conclusion:
        raise HTTPException(status_code=400, detail="Failed to add conclusion")
    return DeviationConclusionOut.model_validate(conclusion)


@router.post("/{deviation_id}/close", response_model=DeviationOut)
def close_completed_deviation(
    deviation_id: int,
    close_in: DeviationClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    dev = close_deviation(db, deviation_id, close_in, operator_id=current_user.id)
    if not dev:
        raise HTTPException(status_code=400, detail="Cannot close deviation")
    
    if dev.reported_by and dev.reported_by != current_user.id:
        create_notifications(db, type('NC', (), {
            'user_ids': [dev.reported_by],
            'notification_type': NotificationType.SYSTEM,
            'title': f'偏差已关闭 - {dev.deviation_code}',
            'message': (
                f'偏差 {dev.deviation_code} 已由 QA 关闭。'
                f'最终结论: {close_in.final_conclusion}'
            ),
            'related_type': 'deviation',
            'related_id': dev.id,
            'priority': 1,
        })())
    
    return DeviationOut.model_validate(dev)


@router.post("/{deviation_id}/unlock-samples", response_model=DeviationOut)
def unlock_all_samples(
    deviation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    dev = unlock_affected_samples(db, deviation_id, operator_id=current_user.id)
    if not dev:
        raise HTTPException(
            status_code=400,
            detail="Can only unlock samples after deviation is COMPLETED"
        )
    return DeviationOut.model_validate(dev)
