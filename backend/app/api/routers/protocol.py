from datetime import date
from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, require_role
from app.models.user import User, RoleEnum
from app.models.protocol import ProtocolStatus
from app.crud.crud_protocol import (
    get_protocol, list_protocols, create_protocol,
    update_protocol, update_protocol_status, delete_protocol,
    list_timepoints_by_protocol, update_timepoint, get_timepoint,
    get_sampling_window_info, get_upcoming_sampling_windows,
    list_storage_conditions_by_protocol,
)
from app.crud.crud_notification import create_notifications
from app.models.notification import NotificationType
from app.schemas.protocol import (
    ProtocolCreate, ProtocolOut, ProtocolUpdate, ProtocolListOut,
    ProtocolStatusUpdate, SamplingTimepointUpdate, SamplingTimepointOut,
    SamplingWindowInfo, StorageConditionOut
)

router = APIRouter(prefix="/api/protocols", tags=["Stability Protocols"])


@router.get("", response_model=List[ProtocolListOut])
def list_all_protocols(
    status: Optional[ProtocolStatus] = None,
    created_by: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    protocols = list_protocols(db, status, created_by, skip, limit)
    return [ProtocolListOut.model_validate(p) for p in protocols]


@router.post("", response_model=ProtocolOut, status_code=status.HTTP_201_CREATED)
def create_new_protocol(
    protocol_in: ProtocolCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.RESEARCHER, RoleEnum.ADMIN, RoleEnum.QA)),
) -> Any:
    protocol = create_protocol(db, protocol_in, created_by=current_user.id)
    return ProtocolOut.model_validate(protocol)


@router.get("/upcoming-sampling", response_model=List[SamplingWindowInfo])
def get_upcoming_windows(
    hours_ahead: int = Query(48, ge=1, le=24 * 30),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    windows = get_upcoming_sampling_windows(db, hours_ahead=hours_ahead)
    return [SamplingWindowInfo(**w) for w in windows]


@router.get("/{protocol_id}", response_model=ProtocolOut)
def get_protocol_detail(
    protocol_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    protocol = get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    return ProtocolOut.model_validate(protocol)


@router.put("/{protocol_id}", response_model=ProtocolOut)
def update_existing_protocol(
    protocol_id: int,
    protocol_in: ProtocolUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.RESEARCHER, RoleEnum.ADMIN, RoleEnum.QA)),
) -> Any:
    protocol = get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    if protocol.status == ProtocolStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Completed protocol cannot be updated")
    updated = update_protocol(db, protocol_id, protocol_in)
    return ProtocolOut.model_validate(updated)


@router.patch("/{protocol_id}/status", response_model=ProtocolOut)
def change_protocol_status(
    protocol_id: int,
    status_in: ProtocolStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    protocol = get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    
    approver_id = None
    if status_in.status in [ProtocolStatus.APPROVED, ProtocolStatus.IN_PROGRESS]:
        approver_id = current_user.id
    
    updated = update_protocol_status(db, protocol_id, status_in.status, approver_id)
    
    if status_in.status == ProtocolStatus.APPROVED:
        from app.crud.crud_user import get_users_by_role
        warehouse_users = get_users_by_role(db, RoleEnum.WAREHOUSE)
        researcher_ids = [u.id for u in warehouse_users]
        if protocol.created_by not in researcher_ids:
            researcher_ids.append(protocol.created_by)
        if researcher_ids:
            create_notifications(db, type('NC', (), {
                'user_ids': researcher_ids,
                'notification_type': NotificationType.SYSTEM,
                'title': f'方案已批准: {protocol.protocol_code}',
                'message': f'方案 {protocol.title} 已由 QA 批准，可以开始样品入箱。',
                'related_type': 'protocol',
                'related_id': protocol.id,
                'priority': 1,
            })())
    
    return ProtocolOut.model_validate(updated)


@router.delete("/{protocol_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_protocol(
    protocol_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
) -> Any:
    success = delete_protocol(db, protocol_id)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete protocol (not found or not in DRAFT status)"
        )
    return None


@router.get("/{protocol_id}/timepoints", response_model=List[SamplingTimepointOut])
def get_protocol_timepoints(
    protocol_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    protocol = get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    timepoints = list_timepoints_by_protocol(db, protocol_id)
    return [SamplingTimepointOut.model_validate(tp) for tp in timepoints]


@router.patch("/{protocol_id}/timepoints/{timepoint_id}", response_model=SamplingTimepointOut)
def update_timepoint_config(
    protocol_id: int,
    timepoint_id: int,
    tp_in: SamplingTimepointUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.RESEARCHER, RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    tp = get_timepoint(db, timepoint_id)
    if not tp or tp.protocol_id != protocol_id:
        raise HTTPException(status_code=404, detail="Timepoint not found")
    updated = update_timepoint(db, timepoint_id, tp_in)
    return SamplingTimepointOut.model_validate(updated)


@router.get("/{protocol_id}/timepoints/{timepoint_id}/window-info", response_model=SamplingWindowInfo)
def get_timepoint_window_info(
    protocol_id: int,
    timepoint_id: int,
    check_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    tp = get_timepoint(db, timepoint_id)
    if not tp or tp.protocol_id != protocol_id:
        raise HTTPException(status_code=404, detail="Timepoint not found")
    info = get_sampling_window_info(tp, check_date=check_date)
    return SamplingWindowInfo(**info)


@router.get("/{protocol_id}/storage-conditions", response_model=List[StorageConditionOut])
def get_protocol_storage_conditions(
    protocol_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    protocol = get_protocol(db, protocol_id)
    if not protocol:
        raise HTTPException(status_code=404, detail="Protocol not found")
    conds = list_storage_conditions_by_protocol(db, protocol_id)
    return [StorageConditionOut.model_validate(c) for c in conds]
