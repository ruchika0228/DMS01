from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.user import User, Department, Position
from models.workflow import Document, ApprovalStage, AuditLog, Notification
from models.file import File, Transfer, OCRResult
from models.connection import Connection
from schemas import (
    UserResponse, UserAdminUpdate, UserAdminCreate, DocumentResponse, AuditLogResponse,
    DepartmentCreate, DepartmentResponse, PositionCreate, PositionResponse
)
from routers.auth import get_current_user, get_password_hash

router = APIRouter(
    prefix="/admin",
    tags=["admin"]
)

def check_admin(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges"
        )
    return current_user

@router.get("/users", response_model=List[UserResponse])
def get_all_users(
    designation: str = None,
    approval_stage: int = None,
    department_id: str = None,
    position_id: str = None,
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    query = db.query(User)
    if designation:
        query = query.filter(User.designation.ilike(f"%{designation}%"))
    if approval_stage is not None:
        query = query.filter(User.approval_stage == approval_stage)
    if department_id:
        query = query.filter(User.department_id == department_id)
    if position_id:
        query = query.filter(User.position_id == position_id)
    return query.all()


# --- Relational Departments APIs ---

@router.get("/departments", response_model=List[DepartmentResponse])
def get_departments(
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    return db.query(Department).all()

@router.post("/departments", response_model=DepartmentResponse, status_code=201)
def create_department(
    data: DepartmentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    existing = db.query(Department).filter(Department.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Department name already exists")
    
    dept = Department(
        name=data.name,
        description=data.description,
        status=data.status if data.status is not None else True
    )
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return dept

@router.put("/departments/{id}", response_model=DepartmentResponse)
def update_department(
    id: str,
    data: DepartmentCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    dept = db.query(Department).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    if data.name != dept.name:
        existing = db.query(Department).filter(Department.name == data.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Department name already exists")
            
    dept.name = data.name
    dept.description = data.description
    if data.status is not None:
        dept.status = data.status
        
    db.commit()
    db.refresh(dept)
    return dept

@router.delete("/departments/{id}", status_code=204)
def delete_department(
    id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    dept = db.query(Department).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=404, detail="Department not found")
    
    pos_count = db.query(Position).filter(Position.department_id == dept.id).count()
    if pos_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete department. There are active positions assigned to this department.")
        
    db.delete(dept)
    db.commit()
    return None


# --- Relational Positions APIs ---

@router.get("/positions", response_model=List[PositionResponse])
def get_positions(
    department_id: str = None,
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    query = db.query(Position)
    if department_id:
        query = query.filter(Position.department_id == department_id)
    return query.all()

@router.post("/positions", response_model=PositionResponse, status_code=201)
def create_position(
    data: PositionCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    existing = db.query(Position).filter(Position.department_id == data.department_id, Position.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Position already exists in this department")
        
    pos = Position(
        department_id=data.department_id,
        name=data.name,
        description=data.description,
        status=data.status if data.status is not None else True
    )
    db.add(pos)
    db.commit()
    db.refresh(pos)
    return pos

@router.put("/positions/{id}", response_model=PositionResponse)
def update_position(
    id: str,
    data: PositionCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    pos = db.query(Position).filter(Position.id == id).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
        
    if data.name != pos.name or data.department_id != pos.department_id:
        existing = db.query(Position).filter(Position.department_id == data.department_id, Position.name == data.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Position already exists in this department")
            
    pos.department_id = data.department_id
    pos.name = data.name
    pos.description = data.description
    if data.status is not None:
        pos.status = data.status
        
    db.commit()
    db.refresh(pos)
    return pos

@router.delete("/positions/{id}", status_code=204)
def delete_position(
    id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    pos = db.query(Position).filter(Position.id == id).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")
        
    user_count = db.query(User).filter(User.position_id == pos.id).count()
    if user_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete position. There are active users assigned to this position.")
        
    db.delete(pos)
    db.commit()
    return None


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user_admin(
    user_id: str,
    update_data: UserAdminUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if update_data.is_active is not None:
        user.is_active = update_data.is_active
    if update_data.is_admin is not None:
        user.is_admin = update_data.is_admin
        
    # Handle relational fields and sync legacy strings
    if update_data.department_id is not None:
        user.department_id = update_data.department_id
        dept = db.query(Department).filter(Department.id == update_data.department_id).first()
        user.department = dept.name if dept else None
    elif update_data.department is not None:
        user.department = update_data.department
        dept = db.query(Department).filter(Department.name == update_data.department).first()
        user.department_id = dept.id if dept else None
        
    if update_data.position_id is not None:
        user.position_id = update_data.position_id
        pos = db.query(Position).filter(Position.id == update_data.position_id).first()
        user.designation = pos.name if pos else None
    elif update_data.designation is not None:
        user.designation = update_data.designation
        pos = db.query(Position).filter(Position.name == update_data.designation).first()
        user.position_id = pos.id if pos else None

    if update_data.full_name is not None:
        user.full_name = update_data.full_name
    if update_data.phone is not None:
        user.phone = update_data.phone
    if update_data.approval_stage is not None:
        user.approval_stage = update_data.approval_stage
    if update_data.email is not None:
        user.email = update_data.email
    if update_data.username is not None:
        user.username = update_data.username
    if update_data.password is not None:
        user.password_hash = get_password_hash(update_data.password)
        
    db.commit()
    db.refresh(user)
    return user

@router.get("/documents", response_model=List[DocumentResponse])
def get_all_documents(
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    return db.query(Document).all()

@router.get("/audit-logs", response_model=List[AuditLogResponse])
def get_all_audit_logs(
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    return db.query(AuditLog).all()

@router.get("/sla-breaches", response_model=List[AuditLogResponse])
def get_sla_breaches(
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    return db.query(AuditLog).filter(AuditLog.action == "Escalated").all()

@router.post("/users", response_model=UserResponse, status_code=201)
def create_user_admin(
    user_data: UserAdminCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    # Check if email or username exists
    db_user_email = db.query(User).filter(User.email == user_data.email).first()
    if db_user_email:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    db_user_username = db.query(User).filter(User.username == user_data.username).first()
    if db_user_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Generate Friend Code
    friend_code = User.generate_unique_friend_code(db)

    # Sync relational fields and legacy strings
    dept_id = user_data.department_id
    dept_name = user_data.department
    if dept_id:
        dept = db.query(Department).filter(Department.id == dept_id).first()
        dept_name = dept.name if dept else None
    elif dept_name:
        dept = db.query(Department).filter(Department.name == dept_name).first()
        dept_id = dept.id if dept else None

    pos_id = user_data.position_id
    pos_name = user_data.designation
    if pos_id:
        pos = db.query(Position).filter(Position.id == pos_id).first()
        pos_name = pos.name if pos else None
    elif pos_name:
        pos = db.query(Position).filter(Position.name == pos_name).first()
        pos_id = pos.id if pos else None

    # Create User
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        username=user_data.username,
        password_hash=hashed_password,
        friend_code=friend_code,
        department=dept_name,
        designation=pos_name,
        department_id=dept_id,
        position_id=pos_id,
        full_name=user_data.full_name or user_data.username.title(),
        phone=user_data.phone,
        approval_stage=user_data.approval_stage,
        is_admin=user_data.is_admin if user_data.is_admin is not None else False,
        is_active=user_data.is_active if user_data.is_active is not None else True
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if str(user.id) == str(admin.id):
        raise HTTPException(status_code=400, detail="Admins cannot delete their own accounts")

    # Clean up relations to avoid foreign key violations
    # 1. Delete notifications
    db.query(Notification).filter(Notification.user_id == user.id).delete()
    
    # 2. Delete connections
    db.query(Connection).filter((Connection.requester_id == user.id) | (Connection.addressee_id == user.id)).delete()
    
    # 3. Delete transfers
    db.query(Transfer).filter((Transfer.sender_id == user.id) | (Transfer.receiver_id == user.id)).delete()
    
    # 4. Delete ocr_results
    db.query(OCRResult).filter(OCRResult.user_id == user.id).delete()
    
    # 5. Delete approval stages
    db.query(ApprovalStage).filter(ApprovalStage.user_id == user.id).delete()
    
    # 6. Delete audit logs by setting user_id to NULL
    db.query(AuditLog).filter(AuditLog.user_id == user.id).update({AuditLog.user_id: None})
    
    # 7. Delete documents created by user (and their stages will be deleted due to cascade)
    db.query(Document).filter(Document.creator_id == user.id).delete()

    # 8. Delete files owned by user
    db.query(File).filter(File.owner_id == user.id).delete()

    # Finally delete the user
    db.delete(user)
    db.commit()
    return None
