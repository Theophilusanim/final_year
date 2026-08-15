import cv2
import numpy as np
import json
import os
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from deepface import DeepFace

# Recommended threshold for Facenet model (Cosine similarity)
# Default threshold increased to 0.70 to prevent false matches with different faces
MATCH_THRESHOLD = float(os.getenv("MATCH_THRESHOLD", "0.70"))



def configure_opencv_cascades() -> None:
    """Restore OpenCV's cascade path when a faulty wheel omits its XML data."""
    cascade_name = "haarcascade_frontalface_default.xml"
    configured_dir = Path(cv2.data.haarcascades)
    if (configured_dir / cascade_name).is_file():
        return

    candidates = []
    if os.getenv("OPENCV_HAAR_CASCADES"):
        candidates.append(Path(os.environ["OPENCV_HAAR_CASCADES"]))

    # Conda's OpenCV package stores the same official cascade data here.
    conda_root = Path.home() / "anaconda3" / "envs"
    if conda_root.is_dir():
        candidates.extend(conda_root.glob("*/Library/etc/haarcascades"))

    for candidate in candidates:
        if (candidate / cascade_name).is_file():
            cv2.data.haarcascades = str(candidate) + os.sep
            return


configure_opencv_cascades()

# Some faulty OpenCV 5.0.0.93 wheels expose image decoding but omit
# CascadeClassifier. In that case DeepFace can still create an embedding from
# the camera frame; use its explicit no-detector mode until dependencies are
# refreshed to the pinned OpenCV 4.x release.
DETECTOR_BACKEND = "opencv" if hasattr(cv2, "CascadeClassifier") else "skip"

def decode_image(image_bytes: bytes) -> np.ndarray:
    """Decodes raw image bytes into an OpenCV BGR numpy array."""
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image file format")
    return img

def extract_face_embedding(img: np.ndarray) -> List[float]:
    """
    Detects a face in the image and extracts its 128D embedding vector
    using the FaceNet model via DeepFace.
    """
    try:
        # DeepFace represent returns a list of dictionaries, one for each face detected.
        # Enforce_detection=True raises an error if no face is found.
        representations = DeepFace.represent(
            img_path=img, 
            model_name="Facenet", 
            enforce_detection=DETECTOR_BACKEND != "skip",
            detector_backend=DETECTOR_BACKEND  # Falls back only for the broken OpenCV 5.0.0.93 wheel.
        )
        
        if not representations:
            raise ValueError("No faces detected in the image.")
            
        # Get the first face's embedding (128D list of floats)
        embedding = representations[0]["embedding"]
        return embedding
    except Exception as e:
        # Wrap deepface errors with a user-friendly error message
        if "Face could not be detected" in str(e) or "No faces detected" in str(e):
            raise ValueError("No face detected. Please ensure your face is clearly visible to the camera.")
        raise ValueError(f"Face processing error: {str(e)}")

def calculate_cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Computes the cosine similarity between two vector lists."""
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    
    dot_product = np.dot(v1, v2)
    norm_v1 = np.linalg.norm(v1)
    norm_v2 = np.linalg.norm(v2)
    
    if norm_v1 == 0.0 or norm_v2 == 0.0:
        return 0.0
        
    return float(dot_product / (norm_v1 * norm_v2))

def match_face_in_db(candidate_embedding: List[float], db_embeddings: List[Tuple[int, List[float]]]) -> Optional[int]:
    """
    Compares candidate embedding against a list of database embeddings.
    Returns the staff_id of the best match if similarity exceeds MATCH_THRESHOLD, otherwise None.
    db_embeddings is a list of tuples: (staff_id, embedding_vector)
    """
    best_match_id = None
    highest_similarity = -1.0
    
    for staff_id, db_vector in db_embeddings:
        similarity = calculate_cosine_similarity(candidate_embedding, db_vector)
        if similarity > highest_similarity:
            highest_similarity = similarity
            best_match_id = staff_id
            
    # Check if the highest similarity is above our threshold
    if highest_similarity >= MATCH_THRESHOLD:
        print(f"Match found for staff ID: {best_match_id} (Similarity: {highest_similarity:.4f})")
        return best_match_id
        
    print(f"No match found. Closest match similarity was: {highest_similarity:.4f}")
    return None

def check_liveness(img: np.ndarray) -> bool:
    """
    Placeholder for Liveness (Anti-Spoofing) detection.
    Real projects should run Eye Aspect Ratio (EAR) blink check,
    or look for photo reflections or texture patterns.
    """
    # For now, we assume the subject is live.
    # Academic projects can showcase this hook for blink tracking demo.
    return True
