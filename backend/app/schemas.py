from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

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

class StaffResponse(StaffBase):
    id: int
    embeddings: List[FaceEmbeddingResponse] = []

    class Config:
        from_attributes = True

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
