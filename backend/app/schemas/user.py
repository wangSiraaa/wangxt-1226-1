from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

from app.models.user import RoleEnum


class RoleBase(BaseModel):
    name: RoleEnum
    description: Optional[str] = None


class RoleOut(RoleBase):
    id: int

    class Config:
        from_attributes = True


class UserRoleOut(BaseModel):
    id: int
    role: RoleOut
    assigned_at: datetime

    class Config:
        from_attributes = True


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=100)


class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)
    roles: List[RoleEnum]


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    roles: Optional[List[RoleEnum]] = None


class UserOut(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    roles: List[UserRoleOut] = []

    class Config:
        from_attributes = True


class UserInDB(UserOut):
    hashed_password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    expires_in: int


class TokenPayload(BaseModel):
    sub: str
    user_id: int
    roles: List[str]
