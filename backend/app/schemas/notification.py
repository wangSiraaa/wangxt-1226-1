from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.notification import NotificationType


class NotificationOut(BaseModel):
    id: int
    user_id: int
    notification_type: NotificationType
    title: str
    message: str
    related_type: Optional[str] = None
    related_id: Optional[int] = None
    is_read: bool
    read_at: Optional[datetime] = None
    priority: int
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationCreate(BaseModel):
    user_ids: List[int]
    notification_type: NotificationType
    title: str
    message: str
    related_type: Optional[str] = None
    related_id: Optional[int] = None
    priority: int = 0
