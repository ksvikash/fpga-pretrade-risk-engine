FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MODEL_PATH=/app/artifacts/fraud_ensemble.json

WORKDIR /app
COPY model/requirements.txt /tmp/requirements/model.txt
COPY service/requirements.txt /tmp/requirements/service.txt
COPY streaming/requirements.txt /tmp/requirements/streaming.txt
RUN pip install --no-cache-dir \
    -r /tmp/requirements/model.txt \
    -r /tmp/requirements/service.txt \
    -r /tmp/requirements/streaming.txt
COPY service/ ./service/
COPY model/ ./model/
COPY streaming/ ./streaming/
COPY agent/ ./agent/

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "service.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
