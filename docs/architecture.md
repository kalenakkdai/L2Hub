# Architecture (MVP)

## Folders

- `frontend/` — React + TypeScript + Vite UI
- `backend/` — FastAPI + SQLAlchemy API
- `docs/` — project documentation

## Frontend responsibilities

- Pages and forms for students, officers, and advisers
- Live countdown display using backend-provided `ends_at`
- WebSocket client for live participant status
- Calling backend APIs (never treating frontend-only checks as security)

## Backend responsibilities

- Authentication and authorization (JWT + role checks)
- Session timing (start/end, lateness, grading)
- Submissions, gradebook creation, Wrapped, agendas
- WebSocket updates for live dashboards
- Privacy redaction for anonymous concerns

## Local development defaults

| Service  | URL                         |
|----------|-----------------------------|
| Frontend | http://localhost:5173       |
| Backend  | http://127.0.0.1:8000       |
| Health   | http://127.0.0.1:8000/health |

## Data store (local)

SQLite is used for local development. Production database choices can come later.
