"""ApexGate investigator scaffold with deterministic mock evidence providers."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class WalletHistory(BaseModel):
    address: str
    observed_transactions_24h: int = Field(ge=0)
    velocity_z_score: float
    prior_high_risk_events: int = Field(ge=0)
    source: str = "simulated"


class FundFlowTrace(BaseModel):
    transaction_id: str
    hops_traced: int = Field(ge=0)
    connected_wallets: int = Field(ge=0)
    high_risk_links: int = Field(ge=0)
    source: str = "simulated"


class RiskFactors(BaseModel):
    transaction_id: str
    model_risk_score: float = Field(ge=0, le=1)
    signals: list[str]
    assessment: str


class AuditReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    transaction_id: str
    risk_score: float = Field(gt=0.85, le=1)
    decision: str = "escalate_for_human_review"
    executive_summary: str
    risk_breakdown: list[str]
    tools_executed: list[Literal["get_wallet_history", "trace_fund_graph", "calculate_risk_factors"]]
    wallet_history: WalletHistory
    fund_flow_trace: FundFlowTrace
    risk_factors: RiskFactors
    evidence_sources: list[str]
    generated_at: datetime
    disclaimer: str = "Simulated investigation output; not a compliance determination."


def _stable_number(key: str, modulo: int) -> int:
    digest = hashlib.sha256(key.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "big") % modulo


def get_wallet_history(address: str) -> WalletHistory:
    """Mock tool. Replace with a rate-limited, audited blockchain data provider."""
    return WalletHistory(
        address=address,
        observed_transactions_24h=_stable_number(address, 120),
        velocity_z_score=round(_stable_number(address + ":velocity", 60) / 10 - 2, 2),
        prior_high_risk_events=_stable_number(address + ":risk", 4),
    )


def trace_fund_graph(tx_id: str) -> FundFlowTrace:
    """Mock tool that produces repeatable bounded graph summary values."""
    return FundFlowTrace(
        transaction_id=tx_id,
        hops_traced=3,
        connected_wallets=5 + _stable_number(tx_id + ":wallets", 30),
        high_risk_links=_stable_number(tx_id + ":links", 5),
    )


def calculate_risk_factors(tx_data: dict[str, Any]) -> RiskFactors:
    score = float(tx_data["risk_score"])
    signals = ["model_score_exceeded_escalation_threshold"]
    if score >= 0.95:
        signals.append("model_score_in_critical_band")
    return RiskFactors(
        transaction_id=str(tx_data["transaction_id"]),
        model_risk_score=score,
        signals=signals,
        assessment="high model risk; supporting on-chain signals require human verification",
    )


def investigate_transaction(tx_data: dict[str, Any]) -> AuditReport | None:
    """Run the mock tool workflow only for scores strictly greater than 0.85."""
    score = float(tx_data["risk_score"])
    if score <= 0.85:
        return None

    transaction_id = str(tx_data["transaction_id"])
    address = str(tx_data.get("wallet_address", "unknown-wallet"))
    history = get_wallet_history(address)
    flow = trace_fund_graph(transaction_id)
    factors = calculate_risk_factors(tx_data)
    evidence = [
        f"Model risk score {score:.4f} exceeded the 0.85 investigation threshold.",
        f"Wallet history reports {history.observed_transactions_24h} transactions in 24h and velocity z-score {history.velocity_z_score:.2f}.",
        f"Fund-flow trace reports {flow.hops_traced} hops, {flow.connected_wallets} connected wallets, and {flow.high_risk_links} simulated high-risk links.",
    ]
    return AuditReport(
        transaction_id=transaction_id,
        risk_score=score,
        executive_summary=(
            f"Transaction {transaction_id} was escalated because the model assigned risk {score:.1%}, "
            "above the configured 85% threshold. Simulated wallet and fund-flow context is included "
            "for an analyst to verify."
        ),
        risk_breakdown=[*factors.signals, f"wallet_velocity_z_score={history.velocity_z_score:.2f}"],
        tools_executed=["get_wallet_history", "trace_fund_graph", "calculate_risk_factors"],
        wallet_history=history,
        fund_flow_trace=flow,
        risk_factors=factors,
        evidence_sources=["model-score", "simulated-wallet-history", "simulated-fund-flow"],
        generated_at=datetime.now(timezone.utc),
    )


def investigate_hardware_alert(alert: dict[str, Any]) -> dict[str, Any]:
    """Attach deterministic mock context to a hardware policy alert.

    The report preserves the RTL's reason bits as policy evidence and does not
    invent a model probability or claim a real on-chain investigation.
    """
    status_code = int(alert["status_code"])
    reasons = []
    if status_code & 0b0001:
        reasons.append("amount_limit_exceeded")
    if status_code & 0b0010:
        reasons.append("velocity_limit_exceeded")
    if status_code & 0b0100:
        reasons.append("watched_wallet_match")

    alert_id = str(alert["alert_id"])
    wallet = f"0x{int(alert['wallet_id']):08x}"
    history = get_wallet_history(wallet)
    flow = trace_fund_graph(alert_id)
    return {
        "alert_id": alert_id,
        "transaction_id": alert_id,
        "source": "apexgate-hardware-fast-path",
        "timestamp": int(alert["timestamp"]),
        "amount": int(alert["amount"]),
        "velocity": int(alert["velocity"]),
        "wallet_id": int(alert["wallet_id"]),
        "status_code": status_code,
        "risk_reasons": reasons,
        "decision": "escalate_for_human_review",
        "executive_summary": (
            f"ApexGate hardware policy raised {', '.join(reasons)} for {alert_id}. "
            "Deterministic simulated wallet and fund-flow context is attached for analyst review."
        ),
        "wallet_history": history.model_dump(mode="json"),
        "fund_flow_trace": flow.model_dump(mode="json"),
        "evidence_sources": ["rtl-policy-status", "simulated-wallet-history", "simulated-fund-flow"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "disclaimer": "Hardware policy alert with simulated investigation context; not a compliance determination.",
    }
