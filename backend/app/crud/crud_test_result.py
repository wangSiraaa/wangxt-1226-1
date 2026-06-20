from datetime import datetime, date
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.test_result import (
    TestResult, TestResultItem, TestResultApproval, ResultStatus
)
from app.models.sample import Sample, SampleStatus
from app.schemas.test_result import (
    TestResultCreate, TestResultUpdate, TestResultSubmit,
    TestResultReview, TestApprovalCreate
)
from app.models.user import User, RoleEnum


def generate_result_code(db: Session) -> str:
    today = date.today().strftime("%Y%m%d")
    prefix = f"TR-{today}"
    count = db.query(TestResult).filter(
        TestResult.result_code.like(f"{prefix}%")
    ).count()
    return f"{prefix}-{count + 1:04d}"


def _check_item_oos_oot(specification_limit: Optional[str], result_numeric: Optional[float]) -> Tuple[bool, bool]:
    is_oos = False
    is_oot = False
    if specification_limit and result_numeric is not None:
        import re
        match = re.search(r"(\d+(?:\.\d+)?)\s*[~-]\s*(\d+(?:\.\d+)?)", specification_limit)
        if match:
            low = float(match.group(1))
            high = float(match.group(2))
            if result_numeric < low or result_numeric > high:
                is_oos = True
            elif (
                result_numeric < low + (high - low) * 0.1
                or result_numeric > high - (high - low) * 0.1
            ):
                is_oot = True
        else:
            match2 = re.search(r"(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)", specification_limit)
            if match2:
                op = match2.group(1)
                val = float(match2.group(2))
                if op == ">=" and result_numeric < val:
                    is_oos = True
                elif op == "<=" and result_numeric > val:
                    is_oos = True
                elif op == ">" and result_numeric <= val:
                    is_oos = True
                elif op == "<" and result_numeric >= val:
                    is_oos = True
                elif op == "=" and result_numeric != val:
                    is_oos = True
    return is_oos, is_oot


def get_test_result(db: Session, result_id: int) -> Optional[TestResult]:
    return db.query(TestResult).filter(TestResult.id == result_id).first()


def get_test_result_by_code(db: Session, code: str) -> Optional[TestResult]:
    return db.query(TestResult).filter(TestResult.result_code == code).first()


def list_test_results(
    db: Session,
    sample_id: Optional[int] = None,
    status: Optional[ResultStatus] = None,
    is_oos: Optional[bool] = None,
    created_by: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[TestResult]:
    query = db.query(TestResult)
    if sample_id:
        query = query.filter(TestResult.sample_id == sample_id)
    if status:
        query = query.filter(TestResult.status == status)
    if is_oos is not None:
        query = query.filter(TestResult.is_oos == is_oos)
    if created_by:
        query = query.filter(TestResult.created_by == created_by)
    return query.order_by(TestResult.created_at.desc()).offset(skip).limit(limit).all()


def create_test_result(
    db: Session, obj_in: TestResultCreate, created_by: int
) -> Optional[TestResult]:
    from app.crud.crud_sample import get_sample
    
    sample = get_sample(db, obj_in.sample_id)
    if not sample:
        return None
    
    result_code = generate_result_code(db)
    
    has_any_oos = False
    has_any_oot = False
    items = []
    for item_in in obj_in.items:
        is_oos, is_oot = _check_item_oos_oot(item_in.specification_limit, item_in.result_numeric)
        is_conforming = item_in.is_conforming if item_in.is_conforming is not None else (not is_oos)
        if is_oos:
            has_any_oos = True
        if is_oot:
            has_any_oot = True
        item = TestResultItem(
            **item_in.model_dump(exclude={"is_conforming"}),
            is_conforming=is_conforming,
            is_oos=is_oos,
            is_oot=is_oot,
        )
        items.append(item)
    
    db_result = TestResult(
        **obj_in.model_dump(exclude={"items"}),
        result_code=result_code,
        created_by=created_by,
        is_oos=has_any_oos,
        is_oot=has_any_oot,
        status=ResultStatus.DRAFT,
        items=items,
    )
    db.add(db_result)
    
    if sample.status == SampleStatus.TESTING:
        pass
    
    db.commit()
    db.refresh(db_result)
    return db_result


def update_test_result(
    db: Session, result_id: int, obj_in: TestResultUpdate, operator_id: int
) -> Optional[TestResult]:
    result = get_test_result(db, result_id)
    if not result:
        return None
    if result.status in [ResultStatus.APPROVED, ResultStatus.CANCELLED]:
        return None
    if result.status not in [ResultStatus.DRAFT, ResultStatus.REJECTED]:
        return None
    
    if obj_in.items is not None:
        db.query(TestResultItem).filter(TestResultItem.result_id == result_id).delete()
        has_any_oos = False
        has_any_oot = False
        new_items = []
        for item_in in obj_in.items:
            is_oos, is_oot = _check_item_oos_oot(item_in.specification_limit, item_in.result_numeric)
            is_conforming = item_in.is_conforming if item_in.is_conforming is not None else (not is_oos)
            if is_oos:
                has_any_oos = True
            if is_oot:
                has_any_oot = True
            item = TestResultItem(
                result_id=result_id,
                **item_in.model_dump(exclude={"is_conforming"}),
                is_conforming=is_conforming,
                is_oos=is_oos,
                is_oot=is_oot,
            )
            new_items.append(item)
        db.add_all(new_items)
        result.is_oos = has_any_oos
        result.is_oot = has_any_oot
    
    update_data = obj_in.model_dump(exclude_unset=True, exclude={"items"})
    for field, value in update_data.items():
        setattr(result, field, value)
    
    result.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(result)
    return result


def submit_test_result(
    db: Session, result_id: int, obj_in: TestResultSubmit, operator_id: int
) -> Optional[TestResult]:
    result = get_test_result(db, result_id)
    if not result or result.status != ResultStatus.DRAFT:
        return None
    
    result.status = ResultStatus.SUBMITTED
    result.submitted_at = datetime.utcnow()
    result.updated_at = datetime.utcnow()
    
    if obj_in.comments:
        approval = TestResultApproval(
            result_id=result.id,
            approval_type="submit",
            approval_action="SUBMIT",
            approver_id=operator_id,
            comments=obj_in.comments,
        )
        db.add(approval)
    
    db.commit()
    db.refresh(result)
    return result


def review_test_result(
    db: Session, result_id: int, obj_in: TestResultReview, reviewer_id: int
) -> Optional[TestResult]:
    result = get_test_result(db, result_id)
    if not result or result.status != ResultStatus.SUBMITTED:
        return None
    
    action = "APPROVE" if obj_in.approved else "REJECT"
    new_status = ResultStatus.APPROVED if obj_in.approved else ResultStatus.REJECTED
    
    result.status = new_status
    result.updated_at = datetime.utcnow()
    
    signature = f"{reviewer_id}-{datetime.utcnow().isoformat()}"
    approval = TestResultApproval(
        result_id=result.id,
        approval_type="final_review",
        approval_action=action,
        approver_id=reviewer_id,
        comments=obj_in.comments,
        electronic_signature=signature,
    )
    db.add(approval)
    
    if obj_in.approved:
        sample = db.query(Sample).filter(Sample.id == result.sample_id).first()
        if sample and sample.status == SampleStatus.TESTING:
            sample.status = SampleStatus.TESTED
            sample.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(result)
    return result


def can_user_edit_result(result: TestResult, user: User) -> bool:
    if result.status == ResultStatus.APPROVED:
        return False
    if result.status == ResultStatus.DRAFT and result.created_by == user.id:
        return True
    if result.status == ResultStatus.REJECTED and result.created_by == user.id:
        return True
    from app.crud.crud_user import user_has_role
    if user_has_role(user, RoleEnum.QA) or user_has_role(user, RoleEnum.ADMIN):
        return True
    return False


def can_user_approve_result(user: User) -> bool:
    from app.crud.crud_user import user_has_role
    return user_has_role(user, RoleEnum.QA) or user_has_role(user, RoleEnum.ADMIN)


def list_test_approvals(db: Session, result_id: int) -> List[TestResultApproval]:
    return db.query(TestResultApproval).filter(
        TestResultApproval.result_id == result_id
    ).order_by(TestResultApproval.approved_at.desc()).all()
