"""Relay decoded ApexGate RTL FIFO alerts to the FastAPI investigation hook.

The Verilator harness writes ``hardware/alerts.jsonl`` by default. Each line
contains timestamp, status_code, velocity, amount, and wallet_id. For adapters
that expose the raw FIFO word, records may instead contain ``fifo_dout`` as a
hex string or integer with the RTL layout:
{timestamp[63:0], status[3:0], velocity[15:0], amount[31:0], wallet_id[31:0]}.

Run from the repository root after ``make -C hardware run`` and with the API
available: ``python -m service.hardware_bridge``.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, AsyncIterator


@dataclass(frozen=True)
class HardwareAlert:
    alert_id: str
    timestamp: int
    status_code: int
    velocity: int
    amount: int
    wallet_id: int

    @classmethod
    def from_record(cls, record: dict[str, Any]) -> "HardwareAlert":
        if "fifo_dout" in record:
            packed_value = record["fifo_dout"]
            if isinstance(packed_value, str):
                packed_value = int(packed_value.lower().removeprefix("0x"), 16)
            packed = int(packed_value)
            if packed < 0 or packed >= (1 << 148):
                raise ValueError("fifo_dout must fit the 148-bit default FIFO payload")
            wallet_id = packed & 0xFFFFFFFF
            amount = (packed >> 32) & 0xFFFFFFFF
            velocity = (packed >> 64) & 0xFFFF
            status_code = (packed >> 80) & 0xF
            timestamp = (packed >> 84) & 0xFFFFFFFFFFFFFFFF
        else:
            try:
                timestamp = int(record["timestamp"])
                status_code = int(record["status_code"])
                velocity = int(record["velocity"])
                amount = int(record["amount"])
                wallet_id = int(record["wallet_id"])
            except (KeyError, TypeError, ValueError) as exc:
                raise ValueError("record must contain integer timestamp/status_code/velocity/amount/wallet_id") from exc

        limits = {
            "timestamp": (timestamp, 0, (1 << 64) - 1),
            "status_code": (status_code, 1, 7),
            "velocity": (velocity, 0, (1 << 16) - 1),
            "amount": (amount, 0, (1 << 32) - 1),
            "wallet_id": (wallet_id, 0, (1 << 32) - 1),
        }
        for name, (value, minimum, maximum) in limits.items():
            if not minimum <= value <= maximum:
                raise ValueError(f"{name}={value} outside [{minimum}, {maximum}]")

        event_id = record.get("alert_id") or (
            f"hw-{timestamp:016x}-{wallet_id:08x}-{status_code:x}"
        )
        return cls(
            alert_id=str(event_id),
            timestamp=timestamp,
            status_code=status_code,
            velocity=velocity,
            amount=amount,
            wallet_id=wallet_id,
        )

    def to_payload(self) -> dict[str, Any]:
        return asdict(self)


async def iter_alerts(path: Path, follow: bool = False) -> AsyncIterator[HardwareAlert]:
    """Read JSONL asynchronously, optionally waiting for appended records."""
    if not path.is_file():
        raise FileNotFoundError(f"Alert export not found: {path}")

    source = path.open("r", encoding="utf-8")
    line_number = 0
    try:
        while True:
            line = await asyncio.to_thread(source.readline)
            if not line:
                if not follow:
                    break
                await asyncio.sleep(0.25)
                continue
            line_number += 1
            if not line.strip():
                continue
            try:
                decoded = json.loads(line)
                if not isinstance(decoded, dict):
                    raise ValueError("each JSONL row must be an object")
                yield HardwareAlert.from_record(decoded)
            except (json.JSONDecodeError, ValueError) as exc:
                raise ValueError(f"Invalid alert export at {path}:{line_number}: {exc}") from exc
    finally:
        source.close()


async def post_alert(
    client: Any,
    api_url: str,
    alert: HardwareAlert,
    max_retries: int,
) -> dict[str, Any]:
    import httpx

    endpoint = f"{api_url.rstrip('/')}/hardware-alerts"
    for attempt in range(max_retries + 1):
        try:
            response = await client.post(
                endpoint,
                json=alert.to_payload(),
                headers={"Idempotency-Key": alert.alert_id},
            )
            if response.status_code == 429 or response.status_code >= 500:
                response.raise_for_status()
            response.raise_for_status()
            return response.json()
        except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as exc:
            retryable = not isinstance(exc, httpx.HTTPStatusError) or (
                exc.response.status_code == 429 or exc.response.status_code >= 500
            )
            if not retryable or attempt >= max_retries:
                raise
            await asyncio.sleep(min(0.25 * (2**attempt), 4.0))
    raise RuntimeError("unreachable retry state")


async def relay(args: argparse.Namespace) -> int:
    delivered = 0
    if args.dry_run:
        async for alert in iter_alerts(args.input, follow=args.follow):
            print(json.dumps(alert.to_payload(), separators=(",", ":")))
            delivered += 1
        print(f"Decoded {delivered} hardware alerts", file=sys.stderr)
        return 0

    try:
        import httpx
    except ModuleNotFoundError as exc:
        raise RuntimeError("Install service dependencies with `python -m pip install -r service/requirements.txt` to relay alerts") from exc

    timeout = httpx.Timeout(args.timeout)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async for alert in iter_alerts(args.input, follow=args.follow):
                result = await post_alert(client, args.api_url, alert, args.max_retries)
                print(json.dumps(result, separators=(",", ":")))
                delivered += 1
    except httpx.HTTPError as exc:
        raise RuntimeError(f"FastAPI alert relay failed: {exc}") from exc
    print(f"Relayed {delivered} hardware alerts", file=sys.stderr)
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("hardware/alerts.jsonl"))
    parser.add_argument("--api-url", default="http://127.0.0.1:8000")
    parser.add_argument("--follow", action="store_true", help="wait for new JSONL lines")
    parser.add_argument("--dry-run", action="store_true", help="decode and print without calling the API")
    parser.add_argument("--timeout", type=float, default=10.0)
    parser.add_argument("--max-retries", type=int, default=3)
    args = parser.parse_args()
    if args.timeout <= 0 or args.max_retries < 0:
        parser.error("--timeout must be positive and --max-retries non-negative")
    try:
        raise SystemExit(asyncio.run(relay(args)))
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        parser.exit(1, f"hardware bridge error: {exc}\n")


if __name__ == "__main__":
    main()
