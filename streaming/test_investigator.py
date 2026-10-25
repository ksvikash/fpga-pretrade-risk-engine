"""Find a real held-out high-risk feature row and verify API -> investigator flow.

This is an integration scenario, not a model-quality evaluation: the labels are
used only to find a known illicit example, and the running API must independently
return risk > 0.85 before the investigator is invoked.

Run with the scoring service active:
  python -m streaming.test_investigator --data-dir fraud-detection-dataset
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
from pathlib import Path
from typing import Any

import httpx
import numpy as np

from agent.investigator import investigate_transaction
from model.artifacts import load_model_bundle

THRESHOLD = 0.85


def canonical_id(value: str) -> str:
    return str(int(float(value)))


def find_high_risk_features(data_dir: Path, artifact: Path) -> tuple[str, int, dict[str, float], float]:
    """Search labeled illicit holdout rows; return the highest-scoring one."""
    with (data_dir / "elliptic_txs_classes.csv").open(newline="", encoding="utf-8") as source:
        labels = {canonical_id(row["txId"]): row["class"].strip() for row in csv.DictReader(source)}

    bundle: dict[str, Any] = load_model_bundle(artifact)
    feature_names: list[str] = bundle["feature_names"]
    test_timesteps = set(bundle.get("split_timesteps", bundle.get("training_metadata", {}).get("split_timesteps", {})).get("test", []))
    if not test_timesteps:
        raise RuntimeError("Model artifact does not include held-out test timesteps")
    tx_ids: list[str] = []
    timesteps: list[int] = []
    matrices: list[list[float]] = []
    with (data_dir / "elliptic_txs_features.csv").open(newline="", encoding="utf-8") as source:
        for row in csv.reader(source):
            if len(row) != len(feature_names) + 2:
                continue
            tx_id = canonical_id(row[0])
            timestep = int(float(row[1]))
            # Labels select a scenario only; the API score independently gates investigation.
            if labels.get(tx_id) != "1" or timestep not in test_timesteps:
                continue
            values = [float(value) if value else 0.0 for value in row[2:]]
            if not np.isfinite(values).all():
                values = [value if np.isfinite(value) else 0.0 for value in values]
            tx_ids.append(tx_id)
            timesteps.append(timestep)
            matrices.append(values)

    if not matrices:
        raise RuntimeError(f"No labeled illicit transactions found in held-out timesteps {sorted(test_timesteps)}")

    features = np.asarray(matrices, dtype=np.float32)
    member_probabilities = np.asarray([model.predict_proba(features)[:, 1] for model in bundle["models"]])
    probabilities = member_probabilities.mean(axis=0)
    best_index = int(np.argmax(probabilities))
    best_score = float(probabilities[best_index])
    if best_score <= THRESHOLD:
        raise RuntimeError(
            f"No held-out illicit example exceeded {THRESHOLD:.2f}; highest local model score was {best_score:.5f} "
            "(no investigator trigger was fabricated)."
        )
    return (
        tx_ids[best_index],
        timesteps[best_index],
        dict(zip(feature_names, map(float, features[best_index]), strict=True)),
        best_score,
    )


async def run(base_url: str, data_dir: Path, artifact: Path, report_path: Path) -> dict[str, Any]:
    original_id, timestep, features, local_score = find_high_risk_features(data_dir, artifact)
    transaction_id = f"scenario-{original_id}"
    payload = {"transaction_id": transaction_id, "features": features}
    async with httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=15) as client:
        health = await client.get("/health")
        health.raise_for_status()
        if not health.json().get("model_loaded"):
            raise RuntimeError("Scoring API has no loaded model")
        schema = (await client.get("/schema"))
        schema.raise_for_status()
        if schema.json()["feature_names"] != list(features):
            raise RuntimeError("Local artifact schema does not match the running scoring service")
        response = await client.post("/score", json=payload)
        response.raise_for_status()
        result = response.json()

    if float(result["risk_score"]) <= THRESHOLD:
        raise RuntimeError(
            f"Service score {result['risk_score']:.5f} did not exceed {THRESHOLD:.2f}; investigator was not triggered"
        )

    transaction = {
        "transaction_id": transaction_id,
        "wallet_address": f"scenario-wallet-{original_id}",
        **result,
    }
    report = investigate_transaction(transaction)
    if report is None:
        raise RuntimeError("Investigator unexpectedly returned no report for a high-risk score")
    required_tools = {"get_wallet_history", "trace_fund_graph", "calculate_risk_factors"}
    if set(report.tools_executed) != required_tools:
        raise RuntimeError(f"Investigation tool execution incomplete: {report.tools_executed}")
    if not report.wallet_history or not report.fund_flow_trace or not report.risk_factors:
        raise RuntimeError("Investigation report is missing tool outputs")

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(report.model_dump_json(indent=2) + "\n", encoding="utf-8")
    return {
        "status": "verified",
        "scenario_source": "held-out labeled illicit Elliptic row; label used only to select test fixture",
        "original_transaction_id": original_id,
        "timestep": timestep,
        "local_model_score": round(local_score, 6),
        "service_risk_score": result["risk_score"],
        "threshold": THRESHOLD,
        "tools_executed": report.tools_executed,
        "audit_report": report.model_dump(mode="json"),
        "report_path": str(report_path),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--data-dir", type=Path, default=Path("fraud-detection-dataset"))
    parser.add_argument("--artifact", type=Path, default=Path("artifacts/fraud_ensemble.json"))
    parser.add_argument("--report", type=Path, default=Path("artifacts/investigator_scenario.json"))
    args = parser.parse_args()
    result = asyncio.run(run(args.base_url, args.data_dir, args.artifact, args.report))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
