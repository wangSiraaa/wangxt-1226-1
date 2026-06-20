from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationType
from app.schemas.notification import NotificationCreate


def get_notification(db: Session, notif_id: int) -> Optional[Notification]:
    return db.query(Notification).filter(Notification.id == notif_id).first()


def list_user_notifications(
    db: Session, user_id: int, is_read: Optional[bool] = None,
    limit: int = 50, skip: int = 0,
) -> List[Notification]:
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)
    return query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()


def count_unread_notifications(db: Session, user_id: int) -> int:
    return db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False,
    ).count()


def create_notifications(db: Session, obj_in: NotificationCreate) -> List[Notification]:
    created = []
    for uid in obj_in.user_ids:
        n = Notification(
            user_id=uid,
            notification_type=obj_in.notification_type,
            title=obj_in.title,
            message=obj_in.message,
            related_type=obj_in.related_type,
            related_id=obj_in.related_id,
            priority=obj_in.priority,
        )
        db.add(n)
        created.append(n)
    db.commit()
    for n in created:
        db.refresh(n)
    return created


def mark_as_read(db: Session, notif_id: int, user_id: int) -> Optional[Notification]:
    n = get_notification(db, notif_id)
    if not n or n.user_id != user_id:
        return None
    n.is_read = True
    n.read_at = datetime.utcnow()
    db.commit()
    db.refresh(n)
    return n


def mark_all_as_read(db: Session, user_id: int) -> int:
    count = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False,
    ).update(
        {"is_read": True, "read_at": datetime.utcnow()},
        synchronize_session=False,
    )
    db.commit()
    return count
