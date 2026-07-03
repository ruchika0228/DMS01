from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Boolean, JSON, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime
from database import Base

class WorkflowStatus(str, enum.Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    CANCELLED = "Cancelled"

class StageStatus(str, enum.Enum):
    QUEUED = "Queued"
    PENDING = "Pending"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    SKIPPED = "Skipped"

class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    file_id = Column(UUID(as_uuid=True), ForeignKey("files.id"), nullable=False)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(SQLEnum(WorkflowStatus), default=WorkflowStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    file = relationship("File", backref="document")
    creator = relationship("User", foreign_keys=[creator_id], backref="created_documents")
    stages = relationship("ApprovalStage", back_populates="document", cascade="all, delete-orphan", order_by="ApprovalStage.stage_number")

class ApprovalStage(Base):
    __tablename__ = "approval_stages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    stage_number = Column(Integer, nullable=False) # 1-6
    stage_name = Column(String, nullable=False) # e.g., "Section Officer"
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(SQLEnum(StageStatus), default=StageStatus.QUEUED)
    
    assigned_at = Column(DateTime, nullable=True)
    due_date = Column(DateTime, nullable=True)
    action_at = Column(DateTime, nullable=True)
    remarks = Column(String, nullable=True)

    document = relationship("Document", back_populates="stages")
    user = relationship("User", backref="approval_tasks")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True) # Can be null for system actions
    action = Column(String, nullable=False) # e.g., "Approved", "Escalated"
    details = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    document = relationship("Document", backref="audit_logs")
    user = relationship("User", backref="audit_actions")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False, server_default="false")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="notifications")
    document = relationship("Document", backref="notifications")
