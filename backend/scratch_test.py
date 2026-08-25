import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

print("Testing python-dotenv loading...")
try:
    # pyrefly: ignore [missing-import]
    from dotenv import load_dotenv
    load_dotenv()
    print("Dotenv loaded successfully.")
except ImportError as e:
    print(f"Error loading dotenv: {e}")

print("Testing database connection and persistence...")
try:
    from app.database import engine, Base, DATABASE_URL, SessionLocal
    from app import models, schemas
    print(f"Database URL resolved: {DATABASE_URL}")

    db = SessionLocal()
    try:
        with engine.connect() as conn:
            journal_row = conn.exec_driver_sql("PRAGMA journal_mode;").fetchone()
            foreign_keys_row = conn.exec_driver_sql("PRAGMA foreign_keys;").fetchone()
            journal_mode = journal_row[0] if journal_row is not None else "unknown"
            foreign_keys = foreign_keys_row[0] if foreign_keys_row is not None else "unknown"
            print(f"SQLite journal_mode: {journal_mode}")
            print(f"SQLite foreign_keys: {foreign_keys}")

        staff_count = db.query(models.Staff).count()
        embeddings_count = db.query(models.FaceEmbedding).count()
        logs_count = db.query(models.AttendanceLog).count()
        print(f"Staff records: {staff_count}, Embeddings: {embeddings_count}, Logs: {logs_count}")
    finally:
        db.close()
except Exception as e:
    print(f"Database test error: {e}")

print("Testing OpenCV and DeepFace imports...")
try:
    import cv2
    import numpy as np
    from deepface import DeepFace
    print("Computer vision libraries imported successfully!")
except Exception as e:
    print(f"CV/DeepFace import error: {e}")

print("All imports and database persistence checks completed!")
