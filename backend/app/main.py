from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import json
import datetime
import ipaddress
import socket
import os
try:
    import psutil
except ImportError:
    psutil = None
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

from .database import engine, Base, SessionLocal, get_db
from . import models, schemas
from .auth import ACCESS_TOKEN_MINUTES, create_access_token, ensure_admin_user, get_current_admin, verify_password
from .recognition import decode_image, extract_face_embedding, match_face_in_db, check_liveness, calculate_cosine_similarity, MATCH_THRESHOLD

# Initialize database tables
Base.metadata.create_all(bind=engine)
startup_db = SessionLocal()
try:
    ensure_admin_user(startup_db)
finally:
    startup_db.close()

# Load configuration from .env file if available
if load_dotenv:
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))


def detect_local_networks():
    detected = [ipaddress.ip_network("127.0.0.1/32"), ipaddress.ip_network("::1/128")]
    if psutil:
        for addresses in psutil.net_if_addrs().values():
            for address in addresses:
                if address.family != socket.AF_INET or not address.address or not address.netmask:
                    continue
                try:
                    detected.append(ipaddress.ip_network(f"{address.address}/{address.netmask}", strict=False))
                except ValueError:
                    continue
    return detected


networks = detect_local_networks()
for cidr in os.getenv("ALLOWED_SUBNETS", "").split(","):
    if not cidr.strip():
        continue
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

@app.post("/api/auth/login", response_model=schemas.TokenResponse)
def login(credentials: schemas.LoginRequest, db: Session = Depends(get_db)):
    email = credentials.email.strip().lower()
    user = db.query(models.AdminUser).filter(models.AdminUser.email == email).first()
    # Keep the account created by the earlier default usable after the email fix.
    if not user and email == "admin@aegis.com":
        user = db.query(models.AdminUser).filter(models.AdminUser.email == "admin@aegis.local").first()
    if not user or not user.is_active or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {
        "access_token": create_access_token(user),
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_MINUTES * 60,
    }

@app.get("/api/auth/me", response_model=schemas.AdminResponse)
def get_me(current_admin: models.AdminUser = Depends(get_current_admin)):
    return current_admin

# --- STAFF ENDPOINTS ---

@app.post("/api/staff", response_model=schemas.StaffResponse, status_code=status.HTTP_201_CREATED)
def create_staff(staff: schemas.StaffCreate, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
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
def get_all_staff(db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
    return db.query(models.Staff).all()

@app.get("/api/staff/{staff_id}", response_model=schemas.StaffResponse)
def get_staff_by_id(staff_id: int, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
    staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
    return staff

@app.put("/api/staff/{staff_id}", response_model=schemas.StaffResponse)
def update_staff(staff_id: int, payload: schemas.StaffUpdate, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
    staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    update_data = payload.model_dump(exclude_unset=True)

    if "staff_code" in update_data and update_data["staff_code"] != staff.staff_code:
        existing = db.query(models.Staff).filter(models.Staff.staff_code == update_data["staff_code"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Staff code already registered by another profile")

    if "email" in update_data and update_data["email"] != staff.email:
        existing = db.query(models.Staff).filter(models.Staff.email == update_data["email"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered by another profile")

    for key, value in update_data.items():
        setattr(staff, key, value)

    db.commit()
    db.refresh(staff)
    return staff

@app.delete("/api/staff/{staff_id}")
def delete_staff(staff_id: int, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
    staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    name = f"{staff.first_name} {staff.last_name}"
    db.delete(staff)
    db.commit()
    return {"status": "success", "message": f"Staff profile '{name}' deleted successfully."}

@app.post("/api/staff/{staff_id}/face", status_code=status.HTTP_201_CREATED)
async def upload_staff_face(staff_id: int, file: UploadFile = File(...), append: bool = False, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
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

        embedding_json = json.dumps(embedding)
        
        if not append:
            # Clear previous face embeddings if fresh single registration
            db.query(models.FaceEmbedding).filter(models.FaceEmbedding.staff_id == staff_id).delete()

        new_embedding = models.FaceEmbedding(staff_id=staff_id, embedding_json=embedding_json)
        db.add(new_embedding)
        db.commit()

        total_samples = db.query(models.FaceEmbedding).filter(models.FaceEmbedding.staff_id == staff_id).count()
        return {
            "status": "success",
            "message": f"Face sample registered! Total samples: {total_samples}.",
            "sample_count": total_samples
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process image: {str(e)}")


@app.post("/api/staff/{staff_id}/faces/batch", status_code=status.HTTP_201_CREATED)
async def upload_staff_faces_batch(staff_id: int, files: List[UploadFile] = File(...), append: bool = False, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
    staff = db.query(models.Staff).filter(models.Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")
        
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    if not append:
        db.query(models.FaceEmbedding).filter(models.FaceEmbedding.staff_id == staff_id).delete()

    success_count = 0
    errors = []

    for idx, file in enumerate(files, start=1):
        try:
            contents = await file.read()
            img = decode_image(contents)
            embedding = extract_face_embedding(img)

            # Check duplicate face enrollment across OTHER registered staff members
            other_embeddings = db.query(models.FaceEmbedding).filter(models.FaceEmbedding.staff_id != staff_id).all()
            for record in other_embeddings:
                try:
                    other_vector = json.loads(record.embedding_json)
                    similarity = calculate_cosine_similarity(embedding, other_vector)
                    if similarity >= MATCH_THRESHOLD:
                        other_staff = db.query(models.Staff).filter(models.Staff.id == record.staff_id).first()
                        name = f"{other_staff.first_name} {other_staff.last_name}" if other_staff else f"Staff ID #{record.staff_id}"
                        raise ValueError(f"File #{idx} matched existing staff {name}")
                except ValueError as ve:
                    raise ve
                except Exception:
                    continue

            embedding_json = json.dumps(embedding)
            new_embedding = models.FaceEmbedding(staff_id=staff_id, embedding_json=embedding_json)
            db.add(new_embedding)
            success_count += 1
        except Exception as e:
            errors.append(f"Image {idx}: {str(e)}")

    db.commit()
    total_samples = db.query(models.FaceEmbedding).filter(models.FaceEmbedding.staff_id == staff_id).count()

    if success_count == 0:
        raise HTTPException(status_code=400, detail=f"Failed to process image batch: {'; '.join(errors)}")

    return {
        "status": "success",
        "message": f"Successfully enrolled {success_count} face sample(s). Total registered samples: {total_samples}.",
        "enrolled_count": success_count,
        "sample_count": total_samples,
        "errors": errors
    }


# --- NETWORK & SYSTEM ENDPOINTS ---

def get_server_local_ip():
    if psutil:
        candidates = []
        for addresses in psutil.net_if_addrs().values():
            for address in addresses:
                if address.family != socket.AF_INET or not address.address:
                    continue
                try:
                    ip_obj = ipaddress.ip_address(address.address)
                except ValueError:
                    continue
                if ip_obj.is_private and not ip_obj.is_loopback and not ip_obj.is_link_local:
                    candidates.append(address.address)

        # Prefer Windows Mobile Hotspot's default gateway when it is present.
        for prefix in ("192.168.137.", "192.168.", "10.", "172."):
            for candidate in candidates:
                if candidate.startswith(prefix):
                    return candidate

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        s.connect(('10.254.254.254', 1))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return "127.0.0.1"

@app.get("/api/network/info")
def get_network_info(request: Request, current_admin: models.AdminUser = Depends(get_current_admin)):
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "127.0.0.1"

    ip_allowed = False
    try:
        ip_obj = ipaddress.ip_address(client_ip)
        for network in networks:
            if ip_obj in network:
                ip_allowed = True
                break
    except ValueError:
        pass

    server_ip = get_server_local_ip()
    return {
        "server_ip": server_ip,
        "client_ip": client_ip,
        "is_on_wifi": ip_allowed,
        "authorized_subnets": [str(network) for network in networks],
        "frontend_mobile_url": f"https://{server_ip}:5173",
        "backend_mobile_url": f"http://{server_ip}:8000"
    }


# --- ATTENDANCE ENDPOINTS ---

@app.get("/api/attendance/logs", response_model=List[schemas.AttendanceLogResponse])
def get_attendance_logs(db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
    return db.query(models.AttendanceLog).order_by(models.AttendanceLog.check_in.desc()).all()


@app.post("/api/attendance/check-out")
def check_out_attendance(payload: schemas.CheckOutRequest, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
    staff = db.query(models.Staff).filter(models.Staff.id == payload.staff_id).first()
    if not staff or not staff.status:
        raise HTTPException(status_code=404, detail="Staff member not found or inactive.")

    now = datetime.datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    log = db.query(models.AttendanceLog).filter(
        models.AttendanceLog.staff_id == staff.id,
        models.AttendanceLog.check_in >= today_start
    ).order_by(models.AttendanceLog.check_in.desc()).first()

    if not log:
        raise HTTPException(status_code=400, detail=f"No active check-in record found for {staff.first_name} today. Please check in first.")

    if log.check_out is not None:
        return {
            "status": "success",
            "message": f"{staff.first_name} has already checked out today at {log.check_out.strftime('%I:%M %p')}.",
            "check_out": log.check_out.isoformat(),
            "already_checked_out": True
        }

    log.check_out = now
    db.commit()
    db.refresh(log)

    return {
        "status": "success",
        "message": f"Goodbye, {staff.first_name}! Checked out successfully at {now.strftime('%I:%M %p')}.",
        "check_out": now.isoformat(),
        "already_checked_out": False
    }

@app.post("/api/attendance/identify")
async def identify_face(file: UploadFile = File(...), db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
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
            
        # Check if already checked in today
        now = datetime.datetime.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        existing_log = db.query(models.AttendanceLog).filter(
            models.AttendanceLog.staff_id == staff.id,
            models.AttendanceLog.check_in >= today_start
        ).first()
        
        return {
            "status": "success",
            "staff_id": staff.id,
            "first_name": staff.first_name,
            "last_name": staff.last_name,
            "name": f"{staff.first_name} {staff.last_name}",
            "staff_code": staff.staff_code,
            "department": staff.department or "N/A",
            "designation": staff.designation or "N/A",
            "already_checked_in": existing_log is not None
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Identification failed: {str(e)}")


@app.post("/api/attendance/mark-attendance")
def mark_attendance(payload: schemas.AttendanceConfirm, db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
    try:
        staff = db.query(models.Staff).filter(models.Staff.id == payload.staff_id).first()
        if not staff or not staff.status:
            raise HTTPException(status_code=404, detail="Staff member not found or inactive.")
            
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
                "attendance_status": existing_log.status,
                "staff_id": staff.id,
                "name": f"{staff.first_name} {staff.last_name}",
                "log_id": existing_log.id,
                "already_checked_in": True
            }
            
        # Determine status based on WORK_START_TIME (Default 08:00 AM)
        work_start_time_str = os.getenv("WORK_START_TIME", "08:00")
        try:
            target_hour, target_minute = map(int, work_start_time_str.split(":"))
        except Exception:
            target_hour, target_minute = 8, 0

        if (now.hour > target_hour) or (now.hour == target_hour and now.minute > target_minute):
            attendance_status = "Late"
            status_msg = f"Checked in (LATE - after {work_start_time_str})."
        else:
            attendance_status = "Present"
            status_msg = "Your attendance has been recorded successfully."

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
            "log_id": new_log.id,
            "already_checked_in": False
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to mark attendance: {str(e)}")


@app.post("/api/attendance/verify-face")
async def verify_face(file: UploadFile = File(...), db: Session = Depends(get_db), current_admin: models.AdminUser = Depends(get_current_admin)):
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

