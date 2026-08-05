# L2 Hub

Student-government operations platform for Mission San Jose High School’s Leadership 2 class.

The first launch product is a synchronized five-minute Maze Day event debrief.

## Repository layout

```
L2Hub/
  backend/     Python FastAPI API
  frontend/    React + TypeScript + Vite UI
  docs/        Project documentation
  .gitignore
  README.md
```

## Quick start

### 1. Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Verify:

```bash
curl http://127.0.0.1:8000/health
```

### 2. Frontend

In a second terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173. The home page should report a successful backend health check.

## Documentation

- [Overview](docs/overview.md)
- [Setup](docs/setup.md)
- [Architecture](docs/architecture.md)

## Tech stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Recharts, Lucide React, Vitest

**Backend:** Python 3.12, FastAPI, SQLAlchemy 2, Pydantic v2, Alembic, SQLite (local), JWT, WebSockets, Pytest, Ruff
