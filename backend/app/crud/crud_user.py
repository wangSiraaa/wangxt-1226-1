from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.security import get_password_hash, verify_password
from app.models.user import User, Role, UserRole, RoleEnum
from app.schemas.user import UserCreate, UserUpdate


def get_user(db: Session, user_id: int) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    return db.query(User).offset(skip).limit(limit).all()


def get_users_by_role(db: Session, role_name: RoleEnum) -> List[User]:
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        return []
    return [ur.user for ur in role.users if ur.user.is_active]


def create_user(db: Session, obj_in: UserCreate) -> User:
    hashed_password = get_password_hash(obj_in.password)
    db_user = User(
        username=obj_in.username,
        email=obj_in.email,
        full_name=obj_in.full_name,
        hashed_password=hashed_password,
    )
    db.add(db_user)
    db.flush()
    
    for role_name in obj_in.roles:
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            role = Role(name=role_name, description=f"{role_name.value} role")
            db.add(role)
            db.flush()
        user_role = UserRole(user_id=db_user.id, role_id=role.id)
        db.add(user_role)
    
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user(db: Session, user_id: int, obj_in: UserUpdate) -> Optional[User]:
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    
    update_data = obj_in.model_dump(exclude_unset=True, exclude={"roles"})
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    if obj_in.roles is not None:
        db.query(UserRole).filter(UserRole.user_id == user_id).delete()
        for role_name in obj_in.roles:
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                role = Role(name=role_name, description=f"{role_name.value} role")
                db.add(role)
                db.flush()
            user_role = UserRole(user_id=db_user.id, role_id=role.id)
            db.add(user_role)
    
    db.commit()
    db.refresh(db_user)
    return db_user


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    user = get_user_by_username(db, username)
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def user_has_role(user: User, role_name: RoleEnum) -> bool:
    return any(ur.role.name == role_name for ur in user.roles)


def get_user_roles(user: User) -> List[RoleEnum]:
    return [ur.role.name for ur in user.roles]


def init_roles(db: Session):
    for role_name in RoleEnum:
        existing = db.query(Role).filter(Role.name == role_name).first()
        if not existing:
            db.add(Role(name=role_name, description=f"{role_name.value} role"))
    db.commit()
