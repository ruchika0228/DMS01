from pydantic import BaseModel, EmailStr
from typing import Optional, Generic, TypeVar, List
from datetime import datetime
from uuid import UUID

T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int

# Department Schemas
class DepartmentBase(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[bool] = True

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Position Schemas
class PositionBase(BaseModel):
    name: str
    department_id: UUID
    description: Optional[str] = None
    status: Optional[bool] = True

class PositionCreate(PositionBase):
    pass

class PositionResponse(PositionBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str
class UserCreate(UserBase):
    password: str
    department: Optional[str] = None
    designation: Optional[str] = None
    approval_stage: Optional[int] = None
    department_id: Optional[UUID] = None
    position_id: Optional[UUID] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None

class UserResponse(UserBase):
    id: UUID
    friend_code: str
    profile_picture: Optional[str] = None
    created_at: datetime
    is_active: bool
    is_admin: bool
    department: Optional[str] = None
    designation: Optional[str] = None
    approval_stage: Optional[int] = None
    Address: Optional[str] = None
    Latitude: Optional[str] = None
    Longitude: Optional[str] = None
    department_id: Optional[UUID] = None
    position_id: Optional[UUID] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None

    class Config:
        from_attributes = True

class UserProfileResponse(BaseModel):
    id: UUID
    username: str
    email: str
    friend_code: Optional[str] = None
    profile_picture: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    approval_stage: Optional[int] = None
    Address: Optional[str] = None
    Latitude: Optional[str] = None
    Longitude: Optional[str] = None
    department_id: Optional[UUID] = None
    position_id: Optional[UUID] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    
    class Config:
        from_attributes = True

class UserProfilePictureUpdate(BaseModel):
    profile_picture: str

class UserLocationUpdate(BaseModel):
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    location_string: Optional[str] = None # Added for placeholder logic
    address: Optional[str] = None

class UserAdminUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    approval_stage: Optional[int] = None
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    password: Optional[str] = None
    department_id: Optional[UUID] = None
    position_id: Optional[UUID] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None

class UserAdminCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    department: Optional[str] = None
    designation: Optional[str] = None
    approval_stage: Optional[int] = None
    is_admin: Optional[bool] = False
    is_active: Optional[bool] = True
    department_id: Optional[UUID] = None
    position_id: Optional[UUID] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None

# File Schemas
class FileSectionBase(BaseModel):
    section_index: int
    cid: str
    section_key: Optional[str] = None
    coordinates: Optional[str] = None
    authorized_users: Optional[str] = None

class FileSectionCreate(FileSectionBase):
    pass

class FileSectionResponse(FileSectionBase):
    id: UUID
    file_id: UUID

    class Config:
        from_attributes = True

class FileCreate(BaseModel):
    file_name: str
    file_type: str
    file_size: int
    cid: str
    category: Optional[str] = "Uncategorized"
    sections: Optional[List[FileSectionCreate]] = None
    # JIT Location Metadata
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    accuracy_meters: Optional[float] = None
    device_timestamp: Optional[int] = None
    location_tier: Optional[str] = "high"

class FileResponse(BaseModel):
    id: UUID
    owner_id: UUID
    file_name: str
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    cid: str
    category: Optional[str] = "Uncategorized"
    created_at: Optional[datetime] = None
    sections: Optional[List[FileSectionResponse]] = []
    
    class Config:
        from_attributes = True

class FileUploadResponse(FileResponse):
    sync_success: bool
    sync_message: Optional[str] = None
    sync_data: Optional[dict] = None

class FileUpdate(BaseModel):
    cid: str
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    file_size: Optional[int] = None
    category: Optional[str] = None

class FileUpdateSyncResponse(FileResponse):
    sync_success: bool
    sync_message: Optional[str] = None
    sync_data: Optional[dict] = None

# G-DMAS Workflow Schemas
class ApprovalStageBase(BaseModel):
    stage_number: int
    stage_name: str
    user_id: UUID
    due_date: Optional[datetime] = None

class ApprovalStageCreate(ApprovalStageBase):
    pass

class DocumentInStageResponse(BaseModel):
    id: UUID
    title: str
    file_id: UUID
    file: FileResponse
    creator: UserProfileResponse

    class Config:
        from_attributes = True

class ApprovalStageResponse(ApprovalStageBase):
    id: UUID
    status: str
    assigned_at: Optional[datetime] = None
    action_at: Optional[datetime] = None
    remarks: Optional[str] = None
    user: UserProfileResponse
    document: Optional[DocumentInStageResponse] = None

    class Config:
        from_attributes = True

class DocumentBase(BaseModel):
    title: str
    description: Optional[str] = None

class DocumentCreate(DocumentBase):
    file_id: UUID
    stages: List[ApprovalStageCreate]

class DocumentResponse(DocumentBase):
    id: UUID
    file_id: UUID
    creator_id: UUID
    status: str
    created_at: datetime
    updated_at: datetime
    file: FileResponse
    creator: UserProfileResponse
    stages: List[ApprovalStageResponse]

    class Config:
        from_attributes = True

class ApprovalAction(BaseModel):
    status: str # Approved, Rejected
    remarks: Optional[str] = None

class AuditLogResponse(BaseModel):
    id: UUID
    document_id: UUID
    user_id: Optional[UUID] = None
    action: str
    details: Optional[str] = None
    timestamp: datetime
    user: Optional[UserProfileResponse] = None

    class Config:
        from_attributes = True

class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    message: str
    document_id: Optional[UUID] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Connection Schemas
class ConnectionRequest(BaseModel):
    friend_code: str

class ConnectionResponse(BaseModel):
    id: UUID
    requester_id: UUID
    addressee_id: UUID
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class ConnectionListResponse(BaseModel):
    id: UUID
    friend_user: UserProfileResponse
    status: str
    created_at: datetime
    is_requester: bool

    class Config:
        from_attributes = True

class TransferRequest(BaseModel):
    file_id: UUID
    receiver_id: UUID
    access_control: Optional[str] = "View & Update"
    due_date: Optional[datetime] = None
    # JIT Location Metadata
    latitude: Optional[str] = None
    longitude: Optional[str] = None
    accuracy_meters: Optional[float] = None
    device_timestamp: Optional[int] = None
    location_tier: Optional[str] = "high"

class TransferResponse(BaseModel):
    id: UUID
    file: FileResponse
    sender: UserProfileResponse
    receiver: UserProfileResponse
    access_control: Optional[str] = None
    deadline: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    sender_latitude: Optional[str] = None
    sender_longitude: Optional[str] = None
    sender_address: Optional[str] = None
    receiver_latitude: Optional[str] = None
    receiver_longitude: Optional[str] = None
    receiver_address: Optional[str] = None
    
    class Config:
        from_attributes = True

class TransferSyncResponse(TransferResponse):
    sync_success: bool
    sync_message: Optional[str] = None
    sync_data: Optional[dict] = None

class RedactedRegisterRequest(BaseModel):
    id: UUID
    primary_file_id: UUID
    redacted_by: UUID
    redacted_cid: str
    shared_with: UUID
    sender_latitude: Optional[str] = None
    sender_longitude: Optional[str] = None
    receiver_latitude: Optional[str] = None
    receiver_longitude: Optional[str] = None
    accuracy_meters: Optional[float] = None
    device_timestamp: Optional[int] = None
    location_tier: Optional[str] = "high"

class RedactedRegisterResponse(BaseModel):
    sync_success: bool
    sync_message: Optional[str] = None
    sync_data: Optional[dict] = None
    status_code: Optional[int] = None
    raw_response: Optional[str] = None

class OCRResultResponse(BaseModel):
    file_id: UUID
    extracted_text: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Search schemas
class SearchResponseItem(BaseModel):
    chunk_id: str
    document_id: str
    filename: str
    content: str
    score: float
    search_type: str  # 'semantic', 'keyword', 'hybrid'
    highlighted_content: Optional[str] = None

class SearchResponse(BaseModel):
    answer: Optional[str] = None
    results: List[SearchResponseItem]

# Meta Search schemas
class WebResult(BaseModel):
    title: str
    url: str
    content: str
    source_type: str = "web"

class MetaSearchResponse(BaseModel):
    answer: Optional[str] = None
    document_results: List[SearchResponseItem]
    web_results: List[WebResult]
