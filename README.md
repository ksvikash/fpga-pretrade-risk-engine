# Dual-Plane Crypto Fraud Detection & Pre-Trade Risk Gateway

A portfolio prototype for transaction risk screening across two latency domains. The **fast path** is a synthesizable SystemVerilog threshold accelerator with a cycle-accurate Verilator harness. The **slow path** is a Python/FastAPI scoring and investigation stack, paired with temporal XGBoost training, asynchronous replay, and a Next.js monitoring UI.

> This repository is an engineering prototype. The RTL and Python service are separate demonstrations today: there is no FPGA deployment, hardware/software bridge, live blockchain feed, or production trading integration. The bundled graph is demo data. Evaluate and measure each component on its target environment before making operational latency or fraud-performance claims.

## Architecture

```text
 Transaction stream
        │
        ├── Fast path: SystemVerilog risk accelerator
        │     amount / velocity / watched-ID checks
        │     2 pipeline stages · 1 transaction per cycle
        │     Verilator C++ simulation + VCD for Surfer
        │
        └── Slow path: asynchronous replay → FastAPI /score
              temporal XGBoost ensemble → threshold-gated investigator
              JSONL investigation reports → Next.js live monitor
```

The RTL accepts an integer amount, source wallet identifier, and recent-window velocity counter. Three parallel comparisons produce a reason bitmap and a risk decision. Its fixed two-stage latency and sustained throughput make it a compact fast-path design exercise. See [`hardware/README.md`](hardware/README.md) for the interface contract, timing, resource estimate, build steps, and waveform workflow.

The Python pipeline trains an ensemble on chronologically separated Elliptic timesteps, selects the operating threshold using validation review capacity, then freezes that threshold for test reporting. The async worker performs bounded concurrent scoring and reports throughput and latency percentiles. A threshold-gated investigator runs deterministic mock wallet/fund-flow tools and writes JSONL reports. FastAPI serves scoring and dashboard endpoints; the web UI includes live monitoring and a separate bundled graph fixture.

## Engineering highlights

- **RTL fast path:** synthesizable SystemVerilog, explicit vector widths, synchronous active-low reset, registered comparison results, and reason-coded output.
- **Cycle-aligned verification:** C++ stimulus checks normal, boundary, over-limit, surge, simultaneous-trigger, invalid, and recovery cases; VCD traces can be inspected in Surfer.
- **Temporal model evaluation:** training, validation, and test partitions are separated by sorted time steps; validation chooses the review-capacity threshold and test metrics use that frozen value.
- **Bounded async replay:** configurable workers/rate with held-out replay metrics and p50/p99 round-trip measurements.
- **Agentic investigation path:** threshold-gated structured mock tools with reproducible scenario checks and persisted reports.
- **Full-stack view:** FastAPI scoring and dashboard API, Next.js UI, and Docker Compose services.

## Quick start

### 1. Get the Elliptic data

The raw dataset is **not tracked in Git** because it is large and has separate licensing terms. Download the original release from [Elliptic's Kaggle dataset page](https://www.kaggle.com/datasets/ellipticco/elliptic-data-set). Review and follow the dataset's current **CC BY-NC-ND 4.0** terms; do not redistribute the files or treat this as permission for commercial use. The Kaggle page provides the three CSV files used by this project. Place them directly in `fraud-detection-dataset/`:

```text
fraud-detection-dataset/
├── elliptic_txs_features.csv
├── elliptic_txs_classes.csv
└── elliptic_txs_edgelist.csv
```

The project consumes features and classes for training/replay; the edge list is included for completeness. The directory is gitignored. Follow Kaggle's download flow and terms rather than relying on an unverified mirror.

### 2. Train the temporal model

From the repository root, install Python dependencies and train a native XGBoost JSON ensemble:

```bash
python -m pip install -r model/requirements.txt -r service/requirements.txt
python model/train.py \
  --data-dir fraud-detection-dataset \
  --artifact artifacts/fraud_ensemble.json \
  --review-capacity 0.01
```

Training also writes `artifacts/fraud_ensemble.metrics.json`. Model artifacts and reports are generated locally and ignored by Git.

### 3. Start the app and replay

Build and start the API and web UI after training:

```bash
docker compose up --build scoring web
```

Open `http://localhost:3000` (graph view: `/graph`) and the scoring API at `http://localhost:8000`. Run a held-out replay in another terminal:

```bash
docker compose --profile replay run --rm replay-worker
```

The compose replay service expects the dataset directory and trained `artifacts/` to be present. For a local API without Docker, run `uvicorn service.app.main:app --host 0.0.0.0 --port 8000`; install `streaming/requirements.txt` and run `python -m streaming.worker --mode replay --split test --count 100 --workers 8 --rate 20` from the repository root.

### 4. Build and simulate the RTL

With Verilator, GNU Make, and a C++17 compiler installed:

```bash
make -C hardware run
```

This builds and runs the C++ testbench, exits nonzero on a mismatch, and writes `hardware/risk_accelerator.vcd`. To view it, run `surfer hardware/risk_accelerator.vcd`. `make -C hardware lint` runs Verilator lint.

### 5. Run project tests

```bash
python -m unittest discover -s tests
```

The RTL directed checks are run separately with `make -C hardware run`.

## Repository map

```text
hardware/                 RTL, Verilator testbench, Makefile, hardware guide
service/app/              FastAPI scoring and dashboard contracts
model/train.py            Temporal split, ensemble training, threshold selection
streaming/worker.py       Bounded asynchronous synthetic and held-out replay
agent/investigator.py     Threshold-gated structured investigation mock
src/                      Next.js dashboard and graph experience
tests/                    Python service/model/artifact tests
fraud-detection-dataset/  Local-only raw Elliptic files (gitignored)
artifacts/                Local-only models, metrics, traces, and reports
```

## Current limits and interpretation

- The RTL wallet rule is an exact ID match with an illustrative default, not a cryptographic hash lookup or maintained watchlist.
- The RTL is not integrated with the API or deployed to FPGA hardware; FPGA-emulated describes the intended fast-path concept, while the current verification target is Verilator simulation.
- The investigator's tools are deterministic mocks rather than external blockchain providers.
- The graph page uses a bundled labeled demo fixture; its counts are not a live feed.
- Ensemble member spread is not a calibrated confidence interval. Threshold ties can exceed the requested alert capacity. Reported test metrics are offline dataset results, not guarantees of future fraud detection.
- Local files back metrics and investigations. Multi-instance deployment would need shared durable storage and a broker.
- Measure p50/p95/p99 under target load and on target hardware before setting an SLO. No 15 ms service guarantee is claimed.

For the existing notebook audit and recommendations, see [`docs/PRODUCTION_AUDIT.md`](docs/PRODUCTION_AUDIT.md).
