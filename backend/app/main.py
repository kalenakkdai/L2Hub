from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_attendance import router as attendance_router
from app.api.routes_auth import router as auth_router
from app.api.routes_calendar import router as calendar_router
from app.api.routes_campsite import router as campsite_router
from app.api.routes_committees import router as committees_router
from app.api.routes_events import router as events_router
from app.api.routes_feedback import router as feedback_router
from app.api.routes_grades import router as grades_router
from app.api.routes_internal import router as internal_router
from app.api.routes_messenger_agenda import router as messenger_agenda_router
from app.api.routes_note_taker import router as note_taker_router
from app.api.routes_push import router as push_router
from app.api.routes_shadow import router as shadow_router
from app.api.routes_storage import router as storage_router
from app.api.routes_users import router as users_router
from app.api.routes_work import router as work_router
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
app.include_router(attendance_router)
app.include_router(campsite_router)
app.include_router(calendar_router)
app.include_router(grades_router)
app.include_router(feedback_router)
app.include_router(committees_router)
app.include_router(users_router)
app.include_router(events_router)
app.include_router(note_taker_router)
app.include_router(messenger_agenda_router)
app.include_router(push_router)
app.include_router(storage_router)
app.include_router(work_router)
app.include_router(shadow_router)
app.include_router(internal_router)


@app.get("/health")
def health() -> dict[str, str]:
    """Simple health check used by the frontend and smoke tests."""
    return {"status": "ok"}
