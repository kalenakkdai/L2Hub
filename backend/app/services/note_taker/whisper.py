"""Local Whisper transcription for Note Taker."""

from __future__ import annotations

import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from app.core.config import settings


@dataclass(frozen=True, slots=True)
class TranscriptSegment:
    start_ms: int
    end_ms: int
    text: str


@dataclass(frozen=True, slots=True)
class TranscriptResult:
    full_text: str
    segments: tuple[TranscriptSegment, ...]
    language: str | None
    provider: str = "whisper-local"


class Transcriber(Protocol):
    def transcribe(self, audio_bytes: bytes, *, content_type: str | None = None) -> TranscriptResult:
        """Turn raw audio into text + timed segments."""


def _extension_for(content_type: str | None) -> str:
    if not content_type:
        return "webm"
    lowered = content_type.split(";")[0].strip().lower()
    mapping = {
        "audio/webm": "webm",
        "audio/wav": "wav",
        "audio/x-wav": "wav",
        "audio/mpeg": "mp3",
        "audio/mp4": "m4a",
        "audio/ogg": "ogg",
    }
    return mapping.get(lowered, "webm")


class WhisperTranscriber:
    """Lazy-loaded openai-whisper model (CPU by default)."""

    def __init__(self, *, model_name: str | None = None, device: str | None = None) -> None:
        self._model_name = model_name or settings.whisper_model
        self._device = device or settings.whisper_device
        self._model = None

    def _load(self):
        if self._model is not None:
            return self._model
        try:
            import whisper  # type: ignore[import-untyped]
        except ImportError as exc:  # pragma: no cover - exercised only without the package
            raise RuntimeError(
                "openai-whisper is not installed. Install backend requirements "
                "and ensure ffmpeg is on PATH. See docs/note-taker.md."
            ) from exc
        self._model = whisper.load_model(self._model_name, device=self._device)
        return self._model

    def transcribe(self, audio_bytes: bytes, *, content_type: str | None = None) -> TranscriptResult:
        if not audio_bytes:
            raise ValueError("Audio is empty.")

        model = self._load()
        suffix = f".{_extension_for(content_type)}"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
            handle.write(audio_bytes)
            temp_path = Path(handle.name)

        try:
            result = model.transcribe(str(temp_path), fp16=False)
        finally:
            temp_path.unlink(missing_ok=True)

        segments: list[TranscriptSegment] = []
        for raw in result.get("segments") or []:
            start = float(raw.get("start") or 0)
            end = float(raw.get("end") or start)
            text = str(raw.get("text") or "").strip()
            if not text:
                continue
            segments.append(
                TranscriptSegment(
                    start_ms=int(start * 1000),
                    end_ms=int(end * 1000),
                    text=text,
                )
            )

        full_text = str(result.get("text") or "").strip()
        if not full_text and segments:
            full_text = " ".join(segment.text for segment in segments)

        language = result.get("language")
        return TranscriptResult(
            full_text=full_text,
            segments=tuple(segments),
            language=str(language) if language else None,
            provider="whisper-local",
        )


_transcriber: Transcriber | None = None


def get_transcriber() -> Transcriber:
    global _transcriber
    if _transcriber is None:
        _transcriber = WhisperTranscriber()
    return _transcriber


def set_transcriber(transcriber: Transcriber | None) -> None:
    """Test hook to replace or clear the singleton."""
    global _transcriber
    _transcriber = transcriber
