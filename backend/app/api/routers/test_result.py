from typing import Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user, require_role
from app.models.user import User, RoleEnum
from app.models.test_result import ResultStatus
from app.crud.crud_test_result import (
    get_test_result, list_test_results, create_test_result,
    update_test_result, submit_test_result, review_test_result,
    can_user_edit_result, can_user_approve_result, list_test_approvals,
)
from app.crud.crud_user import get_users_by_role
from app.crud.crud_notification import create_notifications
from app.models.notification import NotificationType
from app.schemas.test_result import (
    TestResultCreate, TestResultOut, TestResultUpdate,
    TestResultSubmit, TestResultReview, TestResultListOut,
    TestApprovalOut
)

router = APIRouter(prefix="/api/test-results", tags=["Test Results"])


@router.get("", response_model=List[TestResultListOut])
def list_all_results(
    sample_id: Optional[int] = None,
    status: Optional[ResultStatus] = None,
    is_oos: Optional[bool] = None,
    created_by: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    results = list_test_results(db, sample_id, status, is_oos, created_by, skip, limit)
    return [TestResultListOut.model_validate(r) for r in results]


@router.post("", response_model=TestResultOut, status_code=status.HTTP_201_CREATED)
def create_new_result(
    result_in: TestResultCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.RESEARCHER, RoleEnum.QA, RoleEnum.ADMIN)),
) -> Any:
    result = create_test_result(db, result_in, created_by=current_user.id)
    if not result:
        raise HTTPException(status_code=400, detail="Failed to create test result (sample not found)")
    return TestResultOut.model_validate(result)


@router.get("/{result_id}", response_model=TestResultOut)
def get_result_detail(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = get_test_result(db, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")
    return TestResultOut.model_validate(result)


@router.put("/{result_id}", response_model=TestResultOut)
def update_existing_result(
    result_id: int,
    result_in: TestResultUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = get_test_result(db, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")
    if not can_user_edit_result(result, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Cannot edit this result. "
                "DRAFT/REJECTED results can only be edited by creator. "
                "APPROVED results cannot be edited. "
                "QA/Admin can override."
            )
        )
    updated = update_test_result(db, result_id, result_in, operator_id=current_user.id)
    if not updated:
        raise HTTPException(
            status_code=400,
            detail="Cannot update result in current status"
        )
    return TestResultOut.model_validate(updated)


@router.post("/{result_id}/submit", response_model=TestResultOut)
def submit_result_for_approval(
    result_id: int,
    submit_in: TestResultSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = get_test_result(db, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")
    if result.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the creator can submit")
    
    result = submit_test_result(db, result_id, submit_in, operator_id=current_user.id)
    if not result:
        raise HTTPException(status_code=400, detail="Cannot submit result not in DRAFT status")
    
    qa_users = get_users_by_role(db, RoleEnum.QA)
    if qa_users:
        oos_tag = "[OOS] " if result.is_oos else ""
        create_notifications(db, type('NC', (), {
            'user_ids': [u.id for u in qa_users],
            'notification_type': NotificationType.RESULT_APPROVAL_REQUEST,
            'title': f'{oos_tag}检测结果待审批 - {result.result_code}',
            'message': (
                f'检测结果 {result.result_code} 已提交审批。'
                f'分析员: {result.analyst}。'
                f'样品 ID: {result.sample_id}。'
                f'{"*** 存在 OOS 结果，需要重点关注 ***" if result.is_oos else ""}'
            ),
            'related_type': 'test_result',
            'related_id': result.id,
            'priority': 3 if result.is_oos else 2,
        })())
    
    return TestResultOut.model_validate(result)


@router.post("/{result_id}/review", response_model=TestResultOut)
def review_result_approval(
    result_id: int,
    review_in: TestResultReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = get_test_result(db, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")
    if result.status != ResultStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Result must be in SUBMITTED status for review")
    if not can_user_approve_result(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only QA or Admin can approve/reject test results"
        )
    
    result = review_test_result(db, result_id, review_in, reviewer_id=current_user.id)
    if not result:
        raise HTTPException(status_code=400, detail="Review failed")
    
    researcher_ids = [result.created_by]
    if review_in.approved:
        n_type = NotificationType.RESULT_APPROVED
        title = f'检测结果已批准 - {result.result_code}'
        message = f'检测结果 {result.result_code} 已由 QA 批准。审批意见：{review_in.comments}'
    else:
        n_type = NotificationType.RESULT_REJECTED
        title = f'检测结果被驳回 - {result.result_code}'
        message = f'检测结果 {result.result_code} 被 QA 驳回。原因：{review_in.comments}'
    
    create_notifications(db, type('NC', (), {
        'user_ids': researcher_ids,
        'notification_type': n_type,
        'title': title,
        'message': message,
        'related_type': 'test_result',
        'related_id': result.id,
        'priority': 2,
    })())
    
    return TestResultOut.model_validate(result)


@router.get("/{result_id}/approvals", response_model=List[TestApprovalOut])
def get_result_approvals(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = get_test_result(db, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")
    approvals = list_test_approvals(db, result_id)
    return [TestApprovalOut.model_validate(a) for a in approvals]


@router.get("/{result_id}/can-edit", response_model=bool)
def check_can_edit(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    result = get_test_result(db, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Test result not found")
    return can_user_edit_result(result, current_user)
