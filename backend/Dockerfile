# Container image for the FastAPI backend.
#
# Deliberately runtime-agnostic: the same image runs on ECS (Express Mode or a
# plain Fargate service), on App Runner's image-based source, or locally with
# `docker run`. Nothing here assumes a particular host.
FROM python:3.12-slim

# No .pyc files to write and no stdout buffering, so container logs show up in
# CloudWatch as they happen rather than in bursts when the buffer flushes.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Whisper shells out to ffmpeg to decode uploaded audio; without it the Note
# Taker fallback fails at transcription time rather than at startup, which is
# the worst place to find out.
RUN apt-get update \
    && apt-get install --no-install-recommends -y ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

# openai-whisper depends on torch, and torch's default PyPI wheel for Linux
# bundles the CUDA runtime — roughly 2.5 GB of GPU libraries that Fargate has
# no GPU to use. Installing the CPU-only build first means the requirements
# install below sees torch as already satisfied and leaves it alone.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Dependencies before app code: this layer is cached and only rebuilds when
# requirements.txt changes, not on every edit to a route.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Bake the Whisper weights into the image. Left out, every cold task downloads
# them on the first transcription — the container filesystem is ephemeral, so
# that download repeats for the life of the service rather than once.
# Override with `--build-arg WHISPER_MODEL=small` to match a non-default
# WHISPER_MODEL; a mismatch is not fatal, it just falls back to downloading.
ARG WHISPER_MODEL=base
ENV XDG_CACHE_HOME=/opt/cache
RUN python -c "import whisper; whisper.load_model('${WHISPER_MODEL}', device='cpu')" \
    && chmod -R a+rX /opt/cache

COPY app ./app

# Run as a non-root user. The app writes nothing under /srv at runtime, so it
# needs no ownership changes.
RUN useradd --create-home --uid 10001 appuser
USER appuser

# Settings come entirely from the environment in a container: app/core/config.py
# looks for /srv/.env, which is intentionally not copied in, so every value has
# to be supplied by the host's environment configuration.
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
