from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_auth import router as auth_router
from app.api.routes_committees import router as committees_router
from app.api.routes_events import router as events_router
from app.api.routes_feedback import router as feedback_router
from app.api.routes_grades import router as grades_router
from app.api.routes_users import router as users_router
from app.core.config import settings

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(grades_router)
app.include_router(feedback_router)
app.include_router(committees_router)
app.include_router(users_router)
app.include_router(events_router)


@app.get("/health")
def health() -> dict[str, str]:
    """Simple health check used by the frontend and smoke tests."""
    return {"status": "ok"}
