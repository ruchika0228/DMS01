from sqlalchemy import Column, String, DateTime, Boolean, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import random
from datetime import datetime
from database import Base, SessionLocal

class Department(Base):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    status = Column(Boolean, default=True) # True = Active, False = Inactive
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    positions = relationship("Position", back_populates="department", cascade="all, delete-orphan")


class Position(Base):
    __tablename__ = "positions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(Boolean, default=True) # True = Active, False = Inactive
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint('department_id', 'name', name='_dept_position_uc'),)

    department = relationship("Department", back_populates="positions")
    users = relationship("User", back_populates="position_rel")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    username = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    friend_code = Column(String, unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False, nullable=False, server_default="false")
    department = Column(String, nullable=True) # e.g., Finance, HR
    designation = Column(String, nullable=True) # e.g., Clerk, Section Officer
    approval_stage = Column(Integer, nullable=True) # 1-6
    profile_picture = Column(String, nullable=True)
    Latitude = Column(String, nullable=True)
    Longitude = Column(String, nullable=True)
    Address = Column(String, nullable=True)

    # New fields for relational structure
    full_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    department_id = Column(UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True)
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id"), nullable=True)

    department_rel = relationship("Department", foreign_keys=[department_id])
    position_rel = relationship("Position", foreign_keys=[position_id], back_populates="users")

    @staticmethod
    def generate_unique_friend_code(db_session):
        while True:
            # Generate FMS-XXXXX
            random_digits = "".join([str(random.randint(0, 9)) for _ in range(5)])
            code = f"FMS-{random_digits}"
            
            # Check uniqueness
            existing_user = db_session.query(User).filter(User.friend_code == code).first()
            if not existing_user:
                return code
