import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import AdminUser

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "60"))
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, salt_hex, digest_hex = stored_hash.split("$", 2)
        if algorithm != "scrypt":
            return False
        digest = hashlib.scrypt(password.encode("utf-8"), salt=bytes.fromhex(salt_hex), n=2**14, r=8, p=1)
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def create_access_token(user: AdminUser) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "iat": int(now.timestamp()),
        "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> AdminUser:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload.get("sub", ""))
    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise unauthorized

    user = db.query(AdminUser).filter(AdminUser.id == user_id, AdminUser.is_active.is_(True)).first()
    if not user:
        raise unauthorized
    return user


def ensure_admin_user(db: Session) -> None:
    if db.query(AdminUser).count() > 0:
        return

    email = os.getenv("ADMIN_EMAIL", "admin@aegis.com").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "admin1234")
    user = AdminUser(email=email, password_hash=hash_password(password), role="admin")
    db.add(user)
    db.commit()
    print(f"Created initial admin account: {email}")
    if "ADMIN_PASSWORD" not in os.environ:
        print("Set ADMIN_PASSWORD in backend/.env and recreate the database before production use.")