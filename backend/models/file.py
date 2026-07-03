from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum
from datetime import datetime
from database import Base

class AccessControlEnum(str, enum.Enum):
    VIEW = "View"
    VIEW_AND_UPDATE = "View & Update"

class File(Base):
    __tablename__ = "files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    file_name = Column(String, nullable=False)
    file_type = Column(String, nullable=False) # e.g., "pdf", "docx"
    file_size = Column(Integer, nullable=False) # in bytes
    cid = Column(String, nullable=False) # IPFS Content ID
    category = Column(String, nullable=True, default="Uncategorized") # Categorization field
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", backref="files")

class FileSection(Base):
    __tablename__ = "file_sections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    file_id = Column(UUID(as_uuid=True), ForeignKey("files.id"), nullable=False)
    section_index = Column(Integer, nullable=False) # 0 = Background, 1+ = Redacted Crops
    cid = Column(String, nullable=False)
    section_key = Column(String, nullable=True) # Encrypted AES key
    coordinates = Column(String, nullable=True) # JSON string or native JSON
    authorized_users = Column(String, nullable=True) # JSON string or native JSON

    file = relationship("File", backref="sections")

class Transfer(Base):
    __tablename__ = "transfers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    file_id = Column(UUID(as_uuid=True), ForeignKey("files.id"), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    receiver_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    access_control = Column(String, default=AccessControlEnum.VIEW_AND_UPDATE)
    deadline = Column(DateTime, nullable=True)
    sent_at = Column(DateTime, default=datetime.utcnow)
    
    sender_latitude = Column(String, nullable=True)
    sender_longitude = Column(String, nullable=True)
    sender_address = Column(String, nullable=True)
    receiver_latitude = Column(String, nullable=True)
    receiver_longitude = Column(String, nullable=True)
    receiver_address = Column(String, nullable=True)

    # Relationships
    file = relationship("File")
    sender = relationship("User", foreign_keys=[sender_id], backref="sent_transfers")
    receiver = relationship("User", foreign_keys=[receiver_id], backref="received_transfers")

class OCRResult(Base):
    __tablename__ = "ocr_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    file_id = Column(UUID(as_uuid=True), ForeignKey("files.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    extracted_text = Column(String, nullable=True) # Text column in SQL translation
    text_embedding = Column(JSON, nullable=True) # Numerical vector for AI search
    vectordb = Column(String, nullable=True) # JSON string for ChromaDB compatibility
    rag = Column(String, nullable=True) # RAG implementation results
    created_at = Column(DateTime, default=datetime.utcnow)

    file = relationship("File", backref="ocr_result")
    user = relationship("User", backref="ocr_results")
