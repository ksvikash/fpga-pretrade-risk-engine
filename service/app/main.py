from __future__ import annotations

import json
import logging
import os
import time
from collections import deque
from pathlib import Path
from typing import Any
from uuid import uuid4

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from model.artifacts import load_model_bundle
from .schemas import ScoreRequest, ScoreResponse


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return json.dumps(
            {
                "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
                **getattr(record, "context", {}),
            },
            separators=(",", ":"),
        )


handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), handlers=[handler], force=True)
logger = logging.getLogger("fraud.scoring")

app = FastAPI(title="Transaction Risk Scoring", version="0.1.0")
MODEL_PATH = Path(os.getenv("MODEL_PATH", "artifacts/fraud_ensemble.json"))
STREAM_METRICS_PATH = Path(os.getenv("STREAM_METRICS_PATH", "artifacts/streaming_metrics.json"))
INVESTIGATIONS_PATH = Path(os.getenv("INVESTIGATIONS_PATH", "artifacts/investigations.jsonl"))
SCENARIO_REPORT_PATH = Path(os.getenv("SCENARIO_REPORT_PATH", "artifacts/investigator_scenario.json"))
model_bundle: dict[str, Any] | None = None


def load_bundle() -> dict[str, Any] | None:
    global model_bundle
    if model_bundle is None and MODEL_PATH.is_file():
        model_bundle = load_model_bundle(MODEL_PATH)
    return model_bundle


@app.middleware("http")
async def log_request(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid4()))
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("request_failed", extra={"context": {"request_id": request_id}})
        raise
    logger.info(
        "request_completed",
        extra={
            "context": {
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round((time.perf_counter() - started) * 1000, 3),
            }
        },
    )
    response.headers["x-request-id"] = request_id
    return response


@app.exception_handler(Exception)
async def internal_error_handler(request: Request, exc: Exception):
    logger.exception("unhandled_error", extra={"context": {"path": request.url.path}})
    return JSONResponse(status_code=500, content={"detail": "Internal scoring error"})


@app.get("/health")
async def health():
    bundle = load_bundle()
    return {"status": "ok", "model_loaded": bundle is not None}


@app.get("/schema")
async def schema():
    bundle = load_bundle()
    if bundle is None:
        raise HTTPException(status_code=503, detail="Model artifact is not available")
    return {
        "model_version": bundle["model_version"],
        "feature_names": bundle["feature_names"],
        "decision_threshold": bundle.get("decision_threshold", 0.85),
        "split_timesteps": bundle.get("split_timesteps", bundle.get("training_metadata", {}).get("split_timesteps", {})),
    }


@app.get("/dashboard")
async def dashboard():
    """Return the latest stream snapshot and recent investigation reports."""
    if STREAM_METRICS_PATH.is_file():
        try:
            stream = json.loads(STREAM_METRICS_PATH.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            logger.exception("stream_metrics_unavailable")
            stream = None
    else:
        stream = None

    investigations: deque[dict[str, Any]] = deque(maxlen=50)
    if INVESTIGATIONS_PATH.is_file():
        try:
            with INVESTIGATIONS_PATH.open(encoding="utf-8") as source:
                for line in source:
                    if line.strip():
                        investigations.append(json.loads(line))
        except (OSError, json.JSONDecodeError):
            logger.exception("investigation_log_unavailable")
    if SCENARIO_REPORT_PATH.is_file():
        try:
            scenario_payload = json.loads(SCENARIO_REPORT_PATH.read_text(encoding="utf-8"))
            scenario = scenario_payload.get("audit_report", scenario_payload)
            if not any(item.get("transaction_id") == scenario.get("transaction_id") for item in investigations):
                investigations.append(scenario)
        except (OSError, json.JSONDecodeError):
            logger.exception("scenario_report_unavailable")

    investigations_list = list(investigations)
    recent_events = stream.get("recent_events", []) if isinstance(stream, dict) else []
    alerts = [
        event
        for event in recent_events
        if event.get("is_alert") or float(event.get("risk_score", 0)) > 0.85
    ]
    alerted_ids = {event.get("transaction_id") for event in alerts}
    alerts.extend(
        {
            "timestamp": report.get("generated_at"),
            "transaction_id": report.get("transaction_id"),
            "risk_score": report.get("risk_score", 0),
            "investigation_created": True,
            "source": "investigation-report",
        }
        for report in investigations_list
        if report.get("transaction_id") not in alerted_ids
    )
    return {
        "connected": True,
        "stream_available": stream is not None,
        "stream": stream,
        "alerts": alerts[-50:],
        "investigations": investigations_list[-20:],
    }


@app.get("/")
async def root():
    return {
        "service": "Transaction Risk Scoring",
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
        "schema": "/schema",
        "score_endpoint": "POST /score",
    }


@app.post("/score", response_model=ScoreResponse)
def score(request: ScoreRequest) -> ScoreResponse:
    bundle = load_bundle()
    if bundle is None:
        raise HTTPException(status_code=503, detail="Model artifact is not available")

    expected: list[str] = bundle["feature_names"]
    missing = sorted(set(expected) - request.features.keys())
    extra = sorted(request.features.keys() - set(expected))
    if missing or extra:
        raise HTTPException(
            status_code=422,
            detail={"message": "Feature names do not match the model schema", "missing": missing, "extra": extra},
        )

    row = np.asarray([[request.features[name] for name in expected]], dtype=np.float32)
    started = time.perf_counter()
    try:
        probabilities = np.asarray([member.predict_proba(row)[0, 1] for member in bundle["models"]])
    except Exception as exc:
        logger.exception("model_inference_failed", extra={"context": {"transaction_id": request.transaction_id}})
        raise HTTPException(status_code=500, detail="Model inference failed") from exc
    scoring_ms = (time.perf_counter() - started) * 1000
    low, high = np.quantile(probabilities, [0.05, 0.95])
    decision_threshold = float(bundle.get("decision_threshold", 0.85))
    return ScoreResponse(
        transaction_id=request.transaction_id,
        risk_score=float(np.mean(probabilities)),
        confidence_interval=(float(low), float(high)),
        model_version=bundle["model_version"],
        decision_threshold=decision_threshold,
        is_alert=float(np.mean(probabilities)) >= decision_threshold,
        scoring_ms=scoring_ms,
    )
