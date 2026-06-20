from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.security import create_access_token
from app.crud.crud_user import (
    get_user_by_username, authenticate_user, create_user,
    get_user, get_users, update_user, init_roles, get_users_by_role
)
from app.api.deps import get_current_user, require_role
from app.models.user import User, RoleEnum
from app.schemas.user import (
    UserCreate, UserOut, UserUpdate, LoginRequest, TokenResponse,
    RoleOut
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.on_event("startup")
def _init_roles_on_startup():
    try:
        db = next(get_db())
        init_roles(db)
    except Exception:
        pass


@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Any:
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    from app.crud.crud_user import get_user_roles
    roles = [r.value for r in get_user_roles(user)]
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id, "roles": roles},
        expires_delta=access_token_expires,
    )
    return TokenResponse(
        access_token=access_token,
        user=UserOut.model_validate(user),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/register", response_model=UserOut)
def register(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
) -> Any:
    if get_user_by_username(db, user_in.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )
    user = create_user(db, user_in)
    return user


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)) -> Any:
    return UserOut.model_validate(current_user)


@router.get("/roles", response_model=list[str])
def list_roles(current_user: User = Depends(get_current_user)) -> Any:
    from app.crud.crud_user import get_user_roles
    return [r.value for r in get_user_roles(current_user)]


@router.get("/users", response_model=list[UserOut])
def list_users(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.QA)),
) -> Any:
    return [UserOut.model_validate(u) for u in get_users(db, skip, limit)]


@router.get("/users/by-role/{role_name}", response_model=list[UserOut])
def list_users_by_role(
    role_name: RoleEnum,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ADMIN, RoleEnum.QA)),
) -> Any:
    return [UserOut.model_validate(u) for u in get_users_by_role(db, role_name)]


@router.get("/users/{user_id}", response_model=UserOut)
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
) -> Any:
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.put("/users/{user_id}", response_model=UserOut)
def update_user_detail(
    user_id: int, user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(RoleEnum.ADMIN)),
) -> Any:
    user = update_user(db, user_id, user_in)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.post("/init-default-users")
def init_default_users(db: Session = Depends(get_db)) -> Any:
    default_users = [
        UserCreate(
            username="admin", email="admin@pharma.com", full_name="System Admin",
            password="admin123", roles=[RoleEnum.ADMIN, RoleEnum.QA, RoleEnum.RESEARCHER, RoleEnum.WAREHOUSE]
        ),
        UserCreate(
            username="researcher1", email="researcher1@pharma.com", full_name="张研究员",
            password="pass1234", roles=[RoleEnum.RESEARCHER]
        ),
        UserCreate(
            username="warehouse1", email="warehouse1@pharma.com", full_name="李仓管员",
            password="pass1234", roles=[RoleEnum.WAREHOUSE]
        ),
        UserCreate(
            username="qa1", email="qa1@pharma.com", full_name="王QA专员",
            password="pass1234", roles=[RoleEnum.QA]
        ),
    ]
    created = []
    for u in default_users:
        if not get_user_by_username(db, u.username):
            created.append(UserOut.model_validate(create_user(db, u)).username)
    return {"created_users": created, "note": "Use these accounts for testing"}
