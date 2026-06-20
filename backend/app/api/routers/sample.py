from datetime import date
from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, require_role
from app.models.user import User, RoleEnum
from app.models.sample import SampleStatus
from app.crud.crud_sample import (
    get_sample, list_samples, create_sample, update_sample,
    generate_samples_for_protocol, put_samples_in_chamber,
    take_samples_out_chamber, check_sample_can_be_sampled,
    create_sampling_record, lock_sample, unlock_sample,
    list_sampling_records_by_sample, list_sampling_records_by_timepoint,
)
from app.crud.crud_protocol import get_timepoint, get_sampling_window_info
from app.crud.crud_notification import create_notifications
from app.models.notification import NotificationType
from app.schemas.sample import (
    SampleCreate, SampleOut, SampleUpdate, SampleDetailOut,
    SampleInChamberRequest, SampleOutChamberRequest,
    SamplingRecordCreate, SamplingRecordOut,
    SampleLockRequest, SampleUnlockRequest,
    SampleGenerateRequest, SampleCheckWindowResponse
)

router = APIRouter(prefix="/api/samples", tags=["Samples"])


@router.get("", response_model=List[SampleOut])
def list_all_samples(
    protocol_id: Optional[int] = None,
    condition_id: Optional[int] = None,
    status: Optional[SampleStatus] = None,
    is_locked: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    samples = list_samples(db, protocol_id, condition_id, status, is_locked, skip, limit)
    return [SampleOut.model_validate(s) for s in samples]


@router.post("/generate", response_model=dict, status_code=status.HTTP_201_CREATED)
def generate_protocol_samples(
    req: SampleGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.RESEARCHER, RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    samples, info = generate_samples_for_protocol(db, req)
    if "error" in info:
        raise HTTPException(status_code=400, detail=info["error"])
    
    from app.crud.crud_user import get_users_by_role
    warehouse_users = get_users_by_role(db, RoleEnum.WAREHOUSE)
    if warehouse_users and samples:
        create_notifications(db, type('NC', (), {
            'user_ids': [u.id for u in warehouse_users],
            'notification_type': NotificationType.SYSTEM,
            'title': f'样品已创建，请准备入箱',
            'message': f'试验方案 ID {req.protocol_id} 已生成 {len(samples)} 个样品等待入箱。',
            'related_type': 'protocol',
            'related_id': req.protocol_id,
            'priority': 1,
        })())
    
    return {
        "created_count": len(samples),
        "samples": [SampleOut.model_validate(s) for s in samples],
        "info": info,
    }


@router.get("/{sample_id}", response_model=SampleDetailOut)
def get_sample_detail(
    sample_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    sample = get_sample(db, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    return SampleDetailOut.model_validate(sample)


@router.post("", response_model=SampleOut, status_code=status.HTTP_201_CREATED)
def create_new_sample(
    sample_in: SampleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.RESEARCHER, RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    sample = create_sample(db, sample_in)
    return SampleOut.model_validate(sample)


@router.put("/{sample_id}", response_model=SampleOut)
def update_existing_sample(
    sample_id: int,
    sample_in: SampleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.WAREHOUSE, RoleEnum.QA, RoleEnum.ADMIN, RoleEnum.RESEARCHER)),
) -> Any:
    sample = get_sample(db, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    if sample.is_locked:
        raise HTTPException(status_code=403, detail="Cannot update locked sample")
    updated = update_sample(db, sample_id, sample_in)
    return SampleOut.model_validate(updated)


@router.post("/in-chamber", response_model=dict)
def put_samples_to_chamber(
    req: SampleInChamberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.WAREHOUSE, RoleEnum.ADMIN)),
) -> Any:
    processed, info = put_samples_in_chamber(db, req, operator_id=current_user.id)
    return {
        "processed_count": len(processed),
        "processed_samples": [SampleOut.model_validate(s) for s in processed],
        "errors": info.get("errors", []),
    }


@router.post("/out-chamber", response_model=dict)
def take_samples_from_chamber(
    req: SampleOutChamberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.WAREHOUSE, RoleEnum.ADMIN, RoleEnum.RESEARCHER)),
) -> Any:
    processed, info = take_samples_out_chamber(db, req, operator_id=current_user.id)
    if info.get("errors"):
        return {
            "processed_count": len(processed),
            "processed_samples": [SampleOut.model_validate(s) for s in processed],
            "errors": info["errors"],
        }
    return {
        "processed_count": len(processed),
        "processed_samples": [SampleOut.model_validate(s) for s in processed],
    }


@router.get("/{sample_id}/check-sampling-window/{timepoint_id}", response_model=SampleCheckWindowResponse)
def check_sampling_window(
    sample_id: int,
    timepoint_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    sample = get_sample(db, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    
    can_sample, reason, timepoint = check_sample_can_be_sampled(db, sample, timepoint_id)
    
    window_start = None
    window_end = None
    planned_date = None
    timepoint_label = None
    
    if timepoint:
        window_info = get_sampling_window_info(timepoint)
        window_start = window_info["window_start"]
        window_end = window_info["window_end"]
        planned_date = window_info["planned_date"]
        timepoint_label = window_info["timepoint_label"]
    
    return SampleCheckWindowResponse(
        sample_id=sample.id,
        sample_code=sample.sample_code,
        timepoint_id=timepoint_id if timepoint else None,
        timepoint_label=timepoint_label,
        planned_date=planned_date,
        window_start=window_start,
        window_end=window_end,
        can_sample=can_sample,
        reason=reason,
    )


@router.post("/sampling-records", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_new_sampling_record(
    record_in: SamplingRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.WAREHOUSE, RoleEnum.RESEARCHER, RoleEnum.ADMIN)),
) -> Any:
    record, info = create_sampling_record(db, record_in, operator_id=current_user.id)
    if record is None:
        raise HTTPException(status_code=400, detail=info.get("error", "Failed to create sampling record"))
    
    if not info.get("is_within_window", True):
        from app.crud.crud_user import get_users_by_role
        qa_users = get_users_by_role(db, RoleEnum.QA)
        if qa_users:
            create_notifications(db, type('NC', (), {
                'user_ids': [u.id for u in qa_users],
                'notification_type': NotificationType.DEVIATION_REPORTED,
                'title': f'取样窗口偏差 - 样品 {record.sample.sample_code}',
                'message': f'样品 {record.sample.sample_code} 在窗口外取样。请关注并评估是否需要启动偏差调查。',
                'related_type': 'sampling_record',
                'related_id': record.id,
                'priority': 2,
            })())
    
    return {
        "record": SamplingRecordOut.model_validate(record),
        "info": info,
    }


@router.get("/{sample_id}/sampling-records", response_model=List[SamplingRecordOut])
def get_sample_sampling_records(
    sample_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    sample = get_sample(db, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    records = list_sampling_records_by_sample(db, sample_id)
    return [SamplingRecordOut.model_validate(r) for r in records]


@router.post("/{sample_id}/lock", response_model=SampleOut)
def lock_single_sample(
    sample_id: int,
    req: SampleLockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    sample = lock_sample(db, sample_id, req, operator_id=current_user.id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    
    from app.crud.crud_user import get_users_by_role
    researchers = get_users_by_role(db, RoleEnum.RESEARCHER)
    if researchers:
        create_notifications(db, type('NC', (), {
            'user_ids': [u.id for u in researchers],
            'notification_type': NotificationType.SAMPLE_LOCKED,
            'title': f'样品已锁定 - {sample.sample_code}',
            'message': f'样品 {sample.sample_code} 已被 QA 锁定。原因：{req.lock_reason}',
            'related_type': 'sample',
            'related_id': sample.id,
            'priority': 2,
        })())
    
    return SampleOut.model_validate(sample)


@router.post("/{sample_id}/unlock", response_model=SampleOut)
def unlock_single_sample(
    sample_id: int,
    req: SampleUnlockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    sample = unlock_sample(db, sample_id, req, operator_id=current_user.id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    return SampleOut.model_validate(sample)
