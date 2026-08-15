import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True)
    staff_code = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    department = Column(String, nullable=True)
    designation = Column(String, nullable=True)
    status = Column(Boolean, default=True)

    embeddings = relationship("FaceEmbedding", back_populates="staff", cascade="all, delete-orphan")
    attendance_logs = relationship("AttendanceLog", back_populates="staff", cascade="all, delete-orphan")


class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    embedding_json = Column(String, nullable=False)  # Serialized list of floats
    sample_image_path = Column(String, nullable=True)

    staff = relationship("Staff", back_populates="embeddings")


class AttendanceLog(Base):
    __tablename__ = "attendance_logs"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    check_in = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    check_out = Column(DateTime, nullable=True)
    status = Column(String, default="Present")  # "Present", "Late", "Absent"
    recognized_via = Column(String, default="Camera")

    staff = relationship("Staff", back_populates="attendance_logs")
