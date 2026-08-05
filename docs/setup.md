# Local Setup

## Prerequisites

- Python 3.12
- Node.js 20+ and npm
- Git

## Backend

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

## Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173 — the home page should show that the backend health check succeeded.

## Notes

- Never commit `.env` files.
- Never commit `.venv/`, `node_modules/`, or SQLite database files.
- `.env.example` files are safe templates and should be committed.
