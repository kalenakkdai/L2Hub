# Note Taker

Otter-inspired meeting capture for Leadership members.

## What it does

1. Record audio in the browser (`MediaRecorder`).
2. Transcribe **live** with **Chrome Web Speech** (`webkitSpeechRecognition` /
   `SpeechRecognition`) — no Whisper on the server for the normal path.
3. Upload the original recording plus the browser transcript to ObjectStorage /
   the API under an opaque `note-taker/` key.
4. Persist a **raw transcript** (full text + timed segments from speech results).
5. Generate a structured **meeting note** (summary, key points, decisions,
   action items, open questions) on the FastAPI backend.

It lives under **Tools** in the sidebar (`/tools` lists it, `/note-taker` is the
tool itself).

## Browser requirement

Chrome voice recognition needs a Chromium browser:

- **Supported:** Google Chrome, Microsoft Edge (desktop)
- **Not supported:** Safari, Firefox, most iOS browsers

The record page checks for the Web Speech API and blocks with a clear message
when it is missing. Recognition uses the device microphone over HTTPS (or
`localhost` in development).

## Event planning link

Event planning shows a campfire per running event (`EventCampfireBoard`). Each
campfire has a **Record meeting** button that opens the recorder pre-filed
under that event, and expands into a **constellation** of the meeting docs
already filed there — oldest star leftmost, so the line through the stars is
the event's timeline.

### Reusable logs on fire pits

Meeting docs are also **literal logs**:

- A **log yard** on the campfire board lists every meeting you can see.
- Drag a log onto an event fire (or use the per-fire “Add a meeting log…”
  select / “Add selected log” button). The same log may sit under many fires.
- Flame size scales with how many logs are on that fire (`lib/fireScale.ts`).
- Named crossed-log graphics appear under each pit and link to the meeting.

Placements are stored in `meeting_session_event_links` (many-to-many). The
session’s optional `event_id` is still the record-time filing; campfire
membership is the union of that column and the link table. APIs:

- `POST /note-taker/sessions/{id}/events/{eventId}` — link (idempotent)
- `DELETE /note-taker/sessions/{id}/events/{eventId}` — unlink (keeps the meeting)
- `GET /note-taker/sessions?eventId=…` — all logs on that fire

### Choosing the event

The recorder has an **Event** dropdown so a meeting can be filed without going
through a campfire. Options are grouped by phase (Happening now, Upcoming,
Earlier this year, Previous years) by `lib/eventOptions.ts`, and empty groups are
dropped. Arriving with `?eventId=…` preselects that event; `?eventName=…` labels
it if the viewer cannot load that event in the list. Leaving it on **No event**
files a general leadership meeting. Changing the selection re-fetches the
server's auto-generated name, so the title placeholder always matches what an
empty title would produce.

Once an event is chosen, an **Open timeline** link sits beside the dropdown, and
a finished meeting doc shows **Filed under &lt;event&gt;** as the same link. Both
go to `eventTimelinePath()` — `/event-planning?campfire=<eventId>` — and
`EventCampfireBoard` reads that param to arrive with the event's constellation
already expanded. Each campfire row also carries an `id="campfire-<eventId>"`
anchor.

### Auto-generated names

Posting a session without a `title` accepts the server-generated name:

- with an event: `Maze Day 2026 · Meeting 3 · 8.8.2026`
- without one: `Leadership meeting 3 · 8.8.2026`

The sequence counts existing sessions filed against that event. Naming lives in
`app/services/note_taker/naming.py` and stays server-side so the browser clock
never decides a document name. Owners (and `note_taker.manage` holders) can
rename a doc afterwards from its star, or see the name from the recorder page's
placeholder before recording.

## Fallback transcription

If an upload arrives **without** a browser transcript, the backend still has an
optional local Whisper path (`openai-whisper` + ffmpeg). The product UI always
sends the Chrome transcript, so Whisper is not required for day-to-day use.

| Env var | Default | Meaning |
|---------|---------|---------|
| `WHISPER_MODEL` | `base` | Only used for the fallback path |
| `WHISPER_DEVICE` | `cpu` | Pass `cuda` if a GPU is available |

Audio files still use the shared ObjectStorage settings (`STORAGE_BACKEND`, `STORAGE_LOCAL_ROOT`).

## Permissions

| Key | Who |
|-----|-----|
| `note_taker.view` | Members (own sessions) |
| `note_taker.record` | Members |
| `note_taker.manage` | ASBO / AC / President (any session) |

Class Advisors do **not** receive Note Taker permissions.

## Local SQLite

After pulling, ensure the new tables exist (tests use `create_all`). For the
dev SQLite file:

```bash
cd backend && .venv/bin/python -c "import app.models; from app.db.session import Base, engine; Base.metadata.create_all(engine)"
```

## API sketch

- `GET /note-taker/sessions?eventId=…` — all own sessions, or just one event's fire
- `POST /note-taker/sessions` — `title` optional (omit for the auto name), `eventId` optional
- `PATCH /note-taker/sessions/{id}` — rename; owner or `note_taker.manage`
- `POST /note-taker/sessions/{id}/events/{eventId}` — place log on fire (idempotent)
- `DELETE /note-taker/sessions/{id}/events/{eventId}` — remove from fire (keeps meeting)
- `GET /note-taker/suggested-title?eventId=…` — the name a new doc would get
- `POST /note-taker/sessions/{id}/audio` (multipart) — `file`, optional
  `durationMs`, and when using Chrome STT: `transcriptFullText`,
  `transcriptSegmentsJson`, `transcriptLanguage`, `transcriptProvider`
- `GET /note-taker/sessions/{id}/transcript`
- `GET /note-taker/sessions/{id}/note`
- `GET /note-taker/sessions/{id}/audio`
