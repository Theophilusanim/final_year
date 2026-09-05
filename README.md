# Aegis Attendance

A smart attendance and staff management system built for face-based recognition using a FastAPI backend and a React/Vite frontend.

The application is designed to:
- register and manage staff profiles
- store face embeddings for recognition
- detect attendance via camera-based matching
- monitor staff attendance logs
- provide an admin dashboard and staff directory

## Project Overview

This project combines:
- Backend: FastAPI, SQLAlchemy, SQLite, DeepFace, OpenCV
- Frontend: React, Vite, Axios
- Security: JWT-based admin authentication and optional campus-network access restrictions

## Project Structure

```text
.
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── database.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── recognition.py
│   │   └── schemas.py
│   ├── requirements.txt
│   ├── attendance.db
│   └── .env (optional)
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
├── docs/
│   └── documentation.md
├── pyrightconfig.json
├── Untitled-1.txt
└── README.md
```

## Features

- Admin login and session-based access control
- Staff creation, update, deletion, and directory view
- Face enrollment with embedding extraction
- Attendance recognition using DeepFace + cosine similarity
- Admin dashboard with attendance reporting
- Mobile and camera terminal interfaces
- SQLite persistence with auto-created tables

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm
- A working webcam for face recognition
- Optional: local campus network access for the backend security filter

## Backend Setup

1. Open a terminal and navigate to the backend folder.

```bash
cd backend
```

2. Create and activate a virtual environment.

On Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

3. Install dependencies.

```bash
pip install -r requirements.txt
```

4. Create a `.env` file in the `backend` folder, if needed.

Example:

```env
ADMIN_EMAIL=admin@aegis.com
ADMIN_PASSWORD=admin1234
JWT_SECRET=change-this-secret-in-production
ACCESS_TOKEN_MINUTES=60
ALLOWED_SUBNETS=127.0.0.1/32,::1/128
MATCH_THRESHOLD=0.70
```

> The backend also has a default admin user created automatically if none exists. For production, change the credentials and JWT secret.

5. Start the API.

```bash
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will run at:
- http://localhost:8000
- Swagger docs: http://localhost:8000/docs

## Frontend Setup

1. Open a second terminal and navigate to the frontend folder.

```bash
cd frontend
```

2. Install dependencies.

```bash
npm install
```

3. Start the Vite app.

```bash
npm run dev
```

The frontend usually runs at:
- http://localhost:5173

## Default Admin Login

If you do not set custom values in `backend/.env`, the application creates an initial admin user with:
- Email: `admin@aegis.com`
- Password: `admin1234`

## Notes on Network Security

The backend restricts `/api` requests to approved local networks. If you are running the app outside the configured allowed range, requests may return a `403` response. For local development, ensure your `ALLOWED_SUBNETS` includes your local IP or use the default loopback entry.

## Useful Commands

Backend:

```bash
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```

## License

This project is currently set up for local academic or internal use and includes the default ISC license entry in the frontend package metadata.

## Additional Documentation

See [docs/documentation.md](docs/documentation.md) for project background and system design documentation.
