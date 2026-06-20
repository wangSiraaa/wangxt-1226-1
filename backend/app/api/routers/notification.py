from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.crud.crud_notification import (
    list_user_notifications, count_unread_notifications,
    mark_as_read, mark_all_as_read,
)
from app.schemas.notification import NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("", response_model=List[NotificationOut])
def get_my_notifications(
    is_read: bool = None,
    limit: int = 50,
    skip: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    notifs = list_user_notifications(db, current_user.id, is_read, limit, skip)
    return [NotificationOut.model_validate(n) for n in notifs]


@router.get("/unread-count", response_model=int)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return count_unread_notifications(db, current_user.id)


@router.patch("/{notif_id}/read", response_model=NotificationOut)
def mark_single_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    n = mark_as_read(db, notif_id, current_user.id)
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    return NotificationOut.model_validate(n)


@router.patch("/read-all", response_model=int)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    return mark_all_as_read(db, current_user.id)
