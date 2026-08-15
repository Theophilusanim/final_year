from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import json
import datetime
import ipaddress
import os
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

from .database import engine, Base, get_db
from . import models, schemas
from .recognition import decode_image, extract_face_embedding, match_face_in_db, check_liveness, calculate_cosine_similarity, MATCH_THRESHOLD

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Load configuration from .env file if available
if load_dotenv:
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))


ALLOWED_SUBNETS = os.getenv("ALLOWED_SUBNETS", "127.0.0.1/32,::1/128")
networks = []
for cidr in ALLOWED_SUBNETS.split(","):
    try:
        networks.append(ipaddress.ip_network(cidr.strip()))
    except ValueError as e:
        print(f"Skipping invalid network configuration: {cidr}. Error: {e}")

app = FastAPI(title="Smart Attendance System API", version="1.0.0")

# Enable CORS for frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def network_access_middleware(request: Request, call_next):
    # Restrict only /api/ requests (allow docs and root)
    if request.url.path.startswith("/api"):
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host

        ip_allowed = False
        try:
            ip_obj = ipaddress.ip_address(client_ip)
            for network in networks:
                if ip_obj in network:
                    ip_allowed = True
                    break
        except ValueError:
            pass

        if not ip_allowed:
            return JSONResponse(
                status_code=403,
                content={
                    "status": "error",
                    "detail": f"Access Denied: Your connection source ({client_ip}) is not verified on the authorized Campus Network."
                }
            )

    response = await call_next(request)
    return response

@app.get("/")
def read_root():
    return {"message": "Smart Attendance System API is running"}

# --- STAFF ENDPOINTS ---

@app.post("/api/staff", response_model=schemas.StaffResponse, status_code=status.HTTP_201_CREATED)
def create_staff(staff: schemas.StaffCreate, db: Session = Depends(get_db)):
    db_staff = db.query(models.Staff).filter(models.Staff.staff_code == staff.staff_code).first()
    if db_staff:
        raise HTTPException(status_code=400, detail="Staff code already registered")
    
    db_staff_email = db.query(models.Staff).filter(models.Staff.email == staff.email).first()
    if db_staff_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_staff = models.Staff(**staff.model_dump())
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff

@app.get("/api/staff", response_model=List[schemas.StaffResponse])
def get_all_staff(db: Session = Depends(get_db)):
    return db.query(models.Staff).all()

@app.get("/api/staff/{staff_id}", response_model=schemas.StaffResponse)
def get_staff_by_id(staff_id: int, db: Session = Depends(get_db)):
    staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return staff

@app.post("/api/staff/{staff_id}/face", status_code=status.HTTP_201_CREATED)
async def upload_staff_face(staff_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    
    try:
        contents = await file.read()
        img = decode_image(contents)
        embedding = extract_face_embedding(img)
        
        # Check for duplicate face enrollment across OTHER registered staff members
        other_embeddings = db.query(models.FaceEmbedding).filter(models.FaceEmbedding.staff_id != staff_id).all()
        for record in other_embeddings:
            try:
                other_vector = json.loads(record.embedding_json)
                similarity = calculate_cosine_similarity(embedding, other_vector)
                if similarity >= MATCH_THRESHOLD:
                    other_staff = db.query(models.Staff).filter(models.Staff.id == record.staff_id).first()
                    name = f"{other_staff.first_name} {other_staff.last_name}" if other_staff else f"Staff ID #{record.staff_id}"
                    code = f" ({other_staff.staff_code})" if other_staff and other_staff.staff_code else ""
                    raise HTTPException(
                        status_code=400,
                        detail=f"Duplicate face detected! This face is already enrolled for {name}{code}. Multiple profiles cannot share the same facial template."
                    )
            except HTTPException:
                raise
            except Exception:
                continue

        # Serialize vector list to JSON string
        embedding_json = json.dumps(embedding)
        
        # Check if face embedding already exists, overwrite if yes, else create new
        db_embedding = db.query(models.FaceEmbedding).filter(models.FaceEmbedding.staff_id == staff_id).first()
        if db_embedding:
            db_embedding.embedding_json = embedding_json
        else:
            db_embedding = models.FaceEmbedding(staff_id=staff_id, embedding_json=embedding_json)
            db.add(db_embedding)
            
        db.commit()
        return {"status": "success", "message": "Face embedding successfully registered!"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")


# --- ATTENDANCE ENDPOINTS ---

@app.get("/api/attendance/logs", response_model=List[schemas.AttendanceLogResponse])
def get_attendance_logs(db: Session = Depends(get_db)):
    return db.query(models.AttendanceLog).order_by(models.AttendanceLog.check_in.desc()).all()

@app.post("/api/attendance/verify-face")
async def verify_face(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        contents = await file.read()
        img = decode_image(contents)
        
        # 1. Run liveness check
        if not check_liveness(img):
            raise HTTPException(status_code=400, detail="Liveness check failed. Spoofing attempt detected.")
            
        # 2. Extract embedding from live image
        candidate_embedding = extract_face_embedding(img)
        
        # 3. Retrieve all face embeddings from DB
        db_records = db.query(models.FaceEmbedding).all()
        if not db_records:
            raise HTTPException(status_code=400, detail="No registered staff face profiles found in the database. Please enroll your face first.")
            
        db_embeddings = []
        for record in db_records:
            try:
                vector = json.loads(record.embedding_json)
                db_embeddings.append((record.staff_id, vector))
            except Exception:
                continue
                
        # 4. Compare embeddings
        matched_staff_id = match_face_in_db(candidate_embedding, db_embeddings)
        if not matched_staff_id:
            raise HTTPException(status_code=400, detail="Face recognition failed. Match not found.")
            
        staff = db.query(models.Staff).filter(models.Staff.id == matched_staff_id).first()
        if not staff or not staff.status:
            raise HTTPException(status_code=400, detail="Recognized staff member is inactive.")
            
        # 5. Prevent duplicate check-ins today
        now = datetime.datetime.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        existing_log = db.query(models.AttendanceLog).filter(
            models.AttendanceLog.staff_id == staff.id,
            models.AttendanceLog.check_in >= today_start
        ).first()
        
        if existing_log:
            return {
                "status": "success",
                "message": f"Welcome back, {staff.first_name}! (Already checked in today)",
                "staff_id": staff.id,
                "name": f"{staff.first_name} {staff.last_name}",
                "log_id": existing_log.id
            }
            
        # 6. Determine status based on WORK_START_TIME (Default 08:00 AM)
        work_start_time_str = os.getenv("WORK_START_TIME", "08:00")
        try:
            target_hour, target_minute = map(int, work_start_time_str.split(":"))
        except Exception:
            target_hour, target_minute = 8, 0

        # Any check-in at or before 08:00 is "Present". From 08:01 onwards is "Late".
        if (now.hour > target_hour) or (now.hour == target_hour and now.minute > target_minute):
            attendance_status = "Late"
            status_msg = f"Checked in (LATE - after {work_start_time_str})."
        else:
            attendance_status = "Present"
            status_msg = "Your attendance is checked in."

        # Log attendance
        new_log = models.AttendanceLog(
            staff_id=staff.id,
            check_in=now,
            status=attendance_status,
            recognized_via="Camera"
        )
        db.add(new_log)
        db.commit()
        db.refresh(new_log)
        
        return {
            "status": "success",
            "message": f"Welcome, {staff.first_name}! {status_msg}",
            "attendance_status": attendance_status,
            "staff_id": staff.id,
            "name": f"{staff.first_name} {staff.last_name}",
            "log_id": new_log.id
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification failed: {str(e)}")

