# L2 Hub API — FastAPI + uvicorn for AWS App Runner / ECS.
# Build from this directory: `docker build -t l2hub-api .`

FROM python:3.12-slim

WORKDIR /app

# ffmpeg is required only when Whisper falls back for Note Taker uploads
# that arrive without a browser transcript.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

ENV HOST=0.0.0.0
ENV PORT=8000
ENV ENVIRONMENT=production
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
