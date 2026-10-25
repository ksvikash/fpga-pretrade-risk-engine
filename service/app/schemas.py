from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ScoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    transaction_id: str = Field(min_length=1, max_length=128)
    features: dict[str, float] = Field(min_length=1, max_length=512)

    @field_validator("features")
    @classmethod
    def finite_features(cls, value: dict[str, float]) -> dict[str, float]:
        # Pydantic rejects NaN/inf for float inputs in JSON; keep a clear invariant here too.
        import math

        if not all(math.isfinite(number) for number in value.values()):
            raise ValueError("features must contain only finite numbers")
        return value


class HardwareAlertRequest(BaseModel):
    """Decoded 148-bit slow-path FIFO record from the RTL fast path."""

    model_config = ConfigDict(extra="forbid")

    alert_id: str = Field(min_length=1, max_length=128)
    timestamp: int = Field(ge=0, le=(1 << 64) - 1)
    status_code: int = Field(ge=1, le=7)
    velocity: int = Field(ge=0, le=(1 << 16) - 1)
    amount: int = Field(ge=0, le=(1 << 32) - 1)
    wallet_id: int = Field(ge=0, le=(1 << 32) - 1)


class ScoreResponse(BaseModel):
    transaction_id: str
    risk_score: float = Field(ge=0, le=1)
    confidence_interval: tuple[float, float]
    interval_kind: str = "ensemble_spread_90pct"
    model_version: str
    decision_threshold: float = Field(ge=0, le=1)
    is_alert: bool
    scoring_ms: float = Field(ge=0)

    @model_validator(mode="after")
    def ordered_interval(self) -> "ScoreResponse":
        low, high = self.confidence_interval
        if low > high:
            raise ValueError("confidence_interval lower bound must not exceed upper bound")
        return self
