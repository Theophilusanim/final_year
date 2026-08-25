import os
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

# Base directory for backend
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Load environment variables from backend/.env if available
if load_dotenv:
    env_path = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_path):
        load_dotenv(dotenv_path=env_path)

# Default database path points to persistent backend/attendance.db
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "attendance.db")

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = f"sqlite:///{DEFAULT_DB_PATH}"

# Ensure parent directory exists for file-based SQLite database
if DATABASE_URL.startswith("sqlite:///"):
    sqlite_path = DATABASE_URL.replace("sqlite:///", "")
    if sqlite_path and sqlite_path != ":memory:":
        os.makedirs(os.path.dirname(os.path.abspath(sqlite_path)), exist_ok=True)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL, connect_args=connect_args
)

# Enable WAL mode, synchronous=NORMAL, and foreign keys for SQLite database resilience
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

