from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class AdminResponse(BaseModel):
    id: int
    email: str
    role: str

    class Config:
        from_attributes = True

class FaceEmbeddingBase(BaseModel):
    sample_image_path: Optional[str] = None

class FaceEmbeddingResponse(FaceEmbeddingBase):
    id: int
    staff_id: int

    class Config:
        from_attributes = True

class StaffBase(BaseModel):
    staff_code: str
    first_name: str
    last_name: str
    email: EmailStr
    department: Optional[str] = None
    designation: Optional[str] = None
    status: Optional[bool] = True

class StaffCreate(StaffBase):
    pass

class StaffUpdate(BaseModel):
    staff_code: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    status: Optional[bool] = None

class StaffResponse(StaffBase):
    id: int
    embeddings: List[FaceEmbeddingResponse] = []

    class Config:
        from_attributes = True

class AttendanceConfirm(BaseModel):
    staff_id: int

class CheckOutRequest(BaseModel):
    staff_id: int

class AttendanceLogBase(BaseModel):
    status: Optional[str] = "Present"
    recognized_via: Optional[str] = "Camera"

class AttendanceLogCreate(AttendanceLogBase):
    staff_id: int
    check_in: Optional[datetime] = None

class AttendanceLogResponse(AttendanceLogBase):
    id: int
    staff_id: int
    check_in: datetime
    check_out: Optional[datetime] = None
    staff: StaffResponse

    class Config:
        from_attributes = True
