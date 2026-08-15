import sys
import os

# Add parent directory to sys.path to allow absolute imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

print("Testing python-dotenv loading...")
from dotenv import load_dotenv
load_dotenv()
print("Dotenv loaded.")

print("Testing database models...")
from app.database import engine, Base
from app import models, schemas
print("Database models imported.")

print("Testing OpenCV and DeepFace imports...")
import cv2
import numpy as np
from deepface import DeepFace
print("Computer vision libraries imported successfully!")

print("All imports tested successfully!")
