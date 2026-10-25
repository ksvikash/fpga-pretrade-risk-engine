"""Replay held-out Elliptic transactions through the local scoring API.

Example: python -m streaming.worker --mode replay --split test --count 1000 --workers 8
Use --mode synthetic only to smoke-test API plumbing.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import logging
import math
import random
import statistics
import time
import uuid
from collections import deque
from collections.abc import Sequence
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from agent.investigator import investigate_transaction

logger = logging.getLogger("fraud.streaming")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
MAX_REPORT_LOG_BYTES = 5 * 1024 * 1024
MAX_REPORT_LOG_ENTRIES = 2000


def append_report(path: Path, report_json: str) -> None:
    with path.open("a", encoding="utf-8") as output:
        output.write(report_json + "\n")
    if path.stat().st_size <= MAX_REPORT_LOG_BYTES:
        return
    recent_lines: deque[str] = deque(maxlen=MAX_REPORT_LOG_ENTRIES)
    with path.open(encoding="utf-8") as source:
        recent_lines.extend(line for line in source if line.strip())
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text("".join(f"{line.rstrip()}\n" for line in recent_lines), encoding="utf-8")
    temporary_path.replace(path)


def make_transaction(feature_names: list[str], sequence: int) -> dict[str, Any]:
    rng = random.Random(sequence)
    return {
        "transaction_id": f"sim-{sequence}-{uuid.uuid4().hex[:8]}",
        "wallet_address": f"sim-wallet-{sequence % 5000}",
        "features": {name: rng.uniform(-1.0, 1.0) for name in feature_names},
        "source": "synthetic-demo",
    }


def _canonical_id(value: str) -> str:
    return str(int(float(value)))


def load_replay_sample(
    data_dir: Path,
    feature_names: list[str],
    split_timesteps: dict[str, list[int]],
    split: str,
    limit: int,
    seed: int,
) -> list[dict[str, Any]]:
    labels_file = data_dir / "elliptic_txs_classes.csv"
    features_file = data_dir / "elliptic_txs_features.csv"
    if not labels_file.is_file() or not features_file.is_file():
        raise FileNotFoundError(f"Expected Elliptic CSV files under {data_dir}")
    with labels_file.open(newline="", encoding="utf-8") as source:
        labels = {_canonical_id(row["txId"]): row["class"].strip() for row in csv.DictReader(source)}

    allowed_timesteps = set(split_timesteps.get(split, []))
    if split not in {"all", "unlabeled"} and not allowed_timesteps:
        raise ValueError(f"Model artifact has no timestep list for split '{split}'")

    rng = random.Random(seed)
    sample: list[dict[str, Any]] = []
    eligible = 0
    with features_file.open(newline="", encoding="utf-8") as source:
        for row in csv.reader(source):
            if len(row) != len(feature_names) + 2:
                continue
            tx_id = _canonical_id(row[0])
            timestep = int(float(row[1]))
            label = labels.get(tx_id, "unknown")
            if split == "unlabeled":
                if label != "unknown":
                    continue
            elif split != "all" and (timestep not in allowed_timesteps or label not in {"1", "2"}):
                continue

            values = [float(value) if value else 0.0 for value in row[2:]]
            values = [value if math.isfinite(value) else 0.0 for value in values]
            transaction: dict[str, Any] = {
                "transaction_id": f"replay-{tx_id}",
                "wallet_address": f"elliptic-tx-{tx_id}",
                "features": dict(zip(feature_names, values, strict=True)),
                "source": "elliptic-replay",
                "timestep": timestep,
            }
            if label in {"1", "2"}:
                transaction["label"] = 1 if label == "1" else 0
            eligible += 1
            if len(sample) < limit:
                sample.append(transaction)
            else:
                replacement = rng.randrange(eligible)
                if replacement < limit:
                    sample[replacement] = transaction

    if not sample:
        raise ValueError(f"No rows found for replay split '{split}' under {data_dir}")
    rng.shuffle(sample)
    return sample


def percentile(values: Sequence[float], quantile: float) -> float:
    if not values:
        return 0.0
    return float(statistics.quantiles(values, n=100, method="inclusive")[98]) if quantile >= 0.99 and len(values) > 1 else float(sorted(values)[min(int((len(values) - 1) * quantile), len(values) - 1)])


async def run(args: argparse.Namespace) -> dict[str, Any]:
    base_url = args.base_url.rstrip("/")
    timeout = httpx.Timeout(args.timeout)
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue(maxsize=args.queue_size)
    latencies: deque[float] = deque(maxlen=100_000)
    errors = 0
    scored = 0
    investigations = 0
    labeled_metrics = {
        "count": 0,
        "tp": 0,
        "fp": 0,
        "fn": 0,
        "tn": 0,
        "agent_tp": 0,
        "agent_fp": 0,
        "agent_fn": 0,
    }
    stream_source = "elliptic-replay" if args.mode == "replay" else "synthetic-demo"
    metrics_lock = asyncio.Lock()
    report_lock = asyncio.Lock()
    report_path = Path(args.reports)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path = Path(args.metrics_file)
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    recent_events: deque[dict[str, Any]] = deque(maxlen=200)
    wall_started = datetime.now(timezone.utc)
    run_started = time.perf_counter()

    def persist_status(running: bool) -> None:
        elapsed = time.perf_counter() - run_started
        snapshot = {
            "source": stream_source,
            "running": running,
            "started_at": wall_started.isoformat(),
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "transactions_requested": args.count,
            "transactions_scored": scored,
            "errors": errors,
            "investigations_created": investigations,
            "elapsed_seconds": round(elapsed, 4),
            "throughput_per_second": round(scored / elapsed, 2) if elapsed else 0,
            "latency_ms": {
                "mean": round(statistics.fmean(latencies), 3) if latencies else 0,
                "p50": round(percentile(latencies, 0.50), 3),
                "p99": round(percentile(latencies, 0.99), 3),
                "sample_count": len(latencies),
            },
            "recent_events": list(recent_events),
        }
        temporary_path = metrics_path.with_suffix(metrics_path.suffix + ".tmp")
        temporary_path.write_text(json.dumps(snapshot) + "\n", encoding="utf-8")
        temporary_path.replace(metrics_path)

    async with httpx.AsyncClient(base_url=base_url, timeout=timeout) as client:
        health = await client.get("/health")
        health.raise_for_status()
        health_body = health.json()
        if not health_body.get("model_loaded"):
            raise RuntimeError("Scoring API is healthy but has no loaded model artifact")
        schema_response = await client.get("/schema")
        schema_response.raise_for_status()
        schema = schema_response.json()
        feature_names = schema["feature_names"]
        replay_transactions: list[dict[str, Any]] = []
        if args.mode == "replay":
            replay_transactions = await asyncio.to_thread(
                load_replay_sample,
                args.data_dir,
                feature_names,
                schema.get("split_timesteps", {}),
                args.split,
                args.count,
                args.seed,
            )

        async def producer() -> None:
            transactions = (
                iter(replay_transactions)
                if args.mode == "replay"
                else (make_transaction(feature_names, sequence) for sequence in range(args.count))
            )
            for transaction in transactions:
                if args.mode == "synthetic":
                    transaction["source"] = stream_source
                await queue.put(transaction)
                if args.rate > 0:
                    await asyncio.sleep(1 / args.rate)
            for _ in range(args.workers):
                await queue.put(None)

        async def consumer(worker_id: int) -> None:
            nonlocal errors, scored, investigations
            while True:
                transaction = await queue.get()
                try:
                    if transaction is None:
                        return
                    payload = {key: transaction[key] for key in ("transaction_id", "features")}
                    started = time.perf_counter()
                    try:
                        response = await client.post("/score", json=payload)
                        response.raise_for_status()
                        latency_ms = (time.perf_counter() - started) * 1000
                        result = response.json()
                        risk = float(result["risk_score"])
                        event = {
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "transaction_id": transaction["transaction_id"],
                            "risk_score": risk,
                            "round_trip_ms": round(latency_ms, 3),
                            "source": transaction["source"],
                            "is_alert": bool(result.get("is_alert", risk > 0.85)),
                            "decision_threshold": float(result.get("decision_threshold", 0.85)),
                            "investigation_created": False,
                        }
                        if "label" in transaction:
                            event["label"] = transaction["label"]
                            actual = int(transaction["label"])
                            predicted = risk >= float(result.get("decision_threshold", 0.85))
                            agent_predicted = risk > 0.85
                            async with metrics_lock:
                                labeled_metrics["count"] += 1
                                labeled_metrics["tp" if actual == 1 and predicted else "fp" if actual == 0 and predicted else "fn" if actual == 1 else "tn"] += 1
                                if agent_predicted:
                                    labeled_metrics["agent_tp" if actual == 1 else "agent_fp"] += 1
                                elif actual == 1:
                                    labeled_metrics["agent_fn"] += 1
                        async with metrics_lock:
                            latencies.append(latency_ms)
                            scored += 1
                            recent_events.append(event)
                        logger.info("scored transaction=%s risk=%.5f round_trip_ms=%.3f worker=%d", transaction["transaction_id"], risk, latency_ms, worker_id)

                        if risk > 0.85:
                            report = investigate_transaction({**transaction, **result})
                            if report is not None:
                                async with report_lock:
                                    append_report(report_path, report.model_dump_json())
                                async with metrics_lock:
                                    investigations += 1
                                    event["investigation_created"] = True
                                    event["audit_report"] = report.model_dump(mode="json")
                                logger.warning("investigation_created tx=%s risk=%.5f report=%s", transaction["transaction_id"], risk, report_path)
                        async with metrics_lock:
                            persist_status(running=True)
                    except (httpx.HTTPError, KeyError, ValueError) as exc:
                        async with metrics_lock:
                            errors += 1
                            persist_status(running=True)
                        logger.exception("score_request_failed tx=%s error=%s", transaction["transaction_id"], exc)
                finally:
                    queue.task_done()

        started = time.perf_counter()
        async with metrics_lock:
            persist_status(running=True)
        producer_task = asyncio.create_task(producer())
        consumers = [asyncio.create_task(consumer(index)) for index in range(args.workers)]
        await producer_task
        await queue.join()
        await asyncio.gather(*consumers)
        elapsed = time.perf_counter() - started

        async with metrics_lock:
            persist_status(running=False)

    summary = {
        "source": stream_source,
        "transactions_requested": args.count,
        "transactions_scored": scored,
        "errors": errors,
        "investigations_created": investigations,
        "elapsed_seconds": round(elapsed, 4),
        "throughput_per_second": round(scored / elapsed, 2) if elapsed else 0,
        "latency_ms": {
            "mean": round(statistics.fmean(latencies), 3) if latencies else 0,
            "p50": round(percentile(latencies, 0.50), 3),
            "p99": round(percentile(latencies, 0.99), 3),
            "max": round(max(latencies), 3) if latencies else 0,
            "sample_count": len(latencies),
        },
        "model_version": schema_response.json()["model_version"],
    }
    if labeled_metrics["count"]:
        true_positive = labeled_metrics["tp"]
        false_positive = labeled_metrics["fp"]
        false_negative = labeled_metrics["fn"]
        true_negative = labeled_metrics["tn"]
        agent_true_positive = labeled_metrics["agent_tp"]
        agent_false_positive = labeled_metrics["agent_fp"]
        agent_false_negative = labeled_metrics["agent_fn"]
        summary["replay_evaluation"] = {
            "threshold": schema.get("decision_threshold", 0.85),
            "labeled_count": labeled_metrics["count"],
            "alert_count": true_positive + false_positive,
            "alert_rate": (true_positive + false_positive) / labeled_metrics["count"],
            "precision": true_positive / (true_positive + false_positive) if true_positive + false_positive else 0.0,
            "recall": true_positive / (true_positive + false_negative) if true_positive + false_negative else 0.0,
            "true_positive": true_positive,
            "false_positive": false_positive,
            "false_negative": false_negative,
            "true_negative": true_negative,
            "agent_trigger_at_0_85": {
                "alert_count": agent_true_positive + agent_false_positive,
                "precision": agent_true_positive / (agent_true_positive + agent_false_positive) if agent_true_positive + agent_false_positive else 0.0,
                "recall": agent_true_positive / (agent_true_positive + agent_false_negative) if agent_true_positive + agent_false_negative else 0.0,
            },
            "note": "Metrics cover only this sampled replay and the frozen threshold; use the full held-out report for model evaluation.",
        }
    logger.info("run_summary %s", json.dumps(summary, sort_keys=True))
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--count", type=int, default=100)
    parser.add_argument("--mode", choices=("replay", "synthetic"), default="replay")
    parser.add_argument("--split", choices=("train", "validation", "test", "unlabeled", "all"), default="test")
    parser.add_argument("--data-dir", type=Path, default=Path("fraud-detection-dataset"))
    parser.add_argument("--seed", type=int, default=17)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--rate", type=float, default=0, help="producer rate in transactions/second; 0 means as fast as queue permits")
    parser.add_argument("--queue-size", type=int, default=256)
    parser.add_argument("--timeout", type=float, default=5.0)
    parser.add_argument("--reports", default="artifacts/investigations.jsonl")
    parser.add_argument("--metrics-file", default="artifacts/streaming_metrics.json")
    args = parser.parse_args()
    if args.count < 1 or args.workers < 1 or args.queue_size < 1 or args.rate < 0:
        parser.error("count, workers, and queue-size must be positive; rate cannot be negative")
    print(json.dumps(asyncio.run(run(args)), indent=2))


if __name__ == "__main__":
    main()
