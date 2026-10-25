# Workspace audit and production upgrade plan

## Phase 1 — Audit

### Architecture and performance

- The Python work is one stateful Jupyter notebook (about 800 lines of analysis); the web app is a separate Next.js project. There is no shared service contract or runnable inference package.
- The notebook repeatedly filters/copies whole Pandas frames inside loops. Building timestep hyperedges and recomputing graph degrees this way scales poorly and consumes avoidable memory. NetworkX/HyperNetX materialize graph structures in process, which is unsuitable for an unbounded stream.
- `src/app/api/network/route.ts` was empty, while the graph page generated random fallback graph data and waited on simulated timers. A `setTimeout` delay in the stats route added latency without doing work.
- `src/app/api/network/stats/route.ts` reports hard-coded and internally inconsistent demonstration statistics (including a `0.33` rate described as 33%). The graph UI also renders random percentages. These values are not computed from the fixture or model.
- Repeated calls to `predict_proba` and neighbor lookup via DataFrame `.values`/row filters are unnecessarily expensive; use indexed maps/vectorized joins and batch graph queries.

### Data and ML validity

- `RobustScaler` is fitted on every labeled row before evaluation, so held-out rows influence preprocessing. Random five-fold CV also mixes Elliptic time steps and does not simulate future deployment. Hyperparameter selection and reported CV are not a clean, final untouched evaluation.
- The hypergraph feature groups all labeled transactions in the same timestep, not wallets or transaction edges. This is timestep membership, not a wallet-interaction graph, and likely adds little meaningful relational signal.
- Unknown-label transactions are excluded from training, appropriately, but are transformed with a scaler fitted using labeled data from all timesteps. Reported unknown risk scores are not calibrated probabilities; fixed probability bins are unvalidated thresholds.
- `scale_pos_weight=9.25` is hard-coded and may not match the actual training fold. Accuracy and ROC AUC alone obscure alert precision and operational recall under severe imbalance. Report PR AUC, precision/recall at a fixed review budget, confusion counts, calibration, and temporal stability.
- The notebook's analytics fabricate BTC amounts using `np.random.uniform`; transaction values are not present in the Elliptic edge list, so volume totals and related claims are not evidence-based. T-tests on the same full labeled set are exploratory and do not establish predictive value; multiple comparisons are uncorrected.

### Engineering and security

- Most logic depends on notebook globals and execution order; dependencies are installed in a notebook cell with no pinned environment. Broad warning suppression hides useful diagnostics.
- Missing input validation, typed configuration, structured errors, reproducible artifact/version tracking, and tests. Several analytics functions assume non-empty dataframes and can fail while sorting empty results.
- No explicit concurrency boundaries or resource limits exist because inference is not a service. The network upload service accepts `any` data and has no client-side schema validation. API uploads need server-side validation, size limits, authentication, and authorization before being enabled.
- The bundled graph and UI are demo artifacts. Fraud flags in the graph must not be represented as verified production findings.

## Phase 2 — Upgrade blueprint

### Target layout

```text
apps/web/                 Next.js investigation dashboard
services/scoring/         Python API and online scoring
services/investigator/    Isolated agent worker
src/fraud_detection/      feature, model, graph, and evaluation libraries
models/                   versioned model metadata (large weights in artifact storage)
tests/unit/               deterministic feature/model/API tests
tests/integration/        broker-to-score-to-alert flows
infra/                    Dockerfiles, compose, dashboards, deployment config
```

### Staged implementation

1. **Establish trustworthy baseline:** extract notebook stages into importable modules; freeze dependencies and dataset schema; add deterministic unit tests. Split by ordered timestep (train earlier, validation later, final test latest), fit all transforms on train only, use fold-specific class weights, and tune only against validation. Keep final test untouched. Measure PR AUC, recall at a chosen precision/review capacity, calibration, and latency.
2. **Online scoring path:** ingest normalized transaction/edge events through an adapter (websocket/RPC or Kafka), validate and deduplicate by transaction ID, enrich from a bounded feature store, batch only where latency permits, and call a stateless scoring API. Use async I/O for network-bound enrichment and bounded queues/backpressure; keep CPU model inference in worker processes or a serving runtime. Emit versioned score and provenance events to Kafka with idempotent keys and dead-letter handling.
3. **Graph features and learning:** build temporal wallet/transaction graph features from actual address/edge data (degree velocity, fan-in/out, motif counts, neighborhood risk with label-time controls). Benchmark XGBoost plus unsupervised anomaly baselines first. Add temporal graph samples and a PyTorch Geometric GNN only when graph data and leakage-safe evaluation support it. Compare against the baseline at equal alert volume; track drift and graph freshness.
4. **Fraud Investigator Agent:** alerts above a policy threshold enter a durable queue. An isolated agent receives a bounded case payload and read-only, allowlisted tools (chain explorer/provider lookups, lineage expansion with depth/node limits, sanctions source lookup if licensed). Require citations/provenance, timeouts, retries, rate limits, prompt-injection defenses for external text, and human approval for decisions or outbound actions. Persist a structured summary and tool trace; the LLM must explain evidence, never decide guilt.
5. **Production foundation:** containerize web, scoring, broker, and local feature store; add CI, unit/contract/integration tests, schema/version migrations, secret management, RBAC, retention controls, structured JSON logs, request IDs, OpenTelemetry traces, and metrics for throughput, p50/p95/p99 latency, queue lag, errors, drift, alert rate, and investigator completion. Load-test with bounded memory and graceful shutdown.

## Phase 3 — First applied refactor

- Implemented `GET /api/network` using the existing bundled fixture, with cached file loading, query validation, node-type and node-count filtering, and edge pruning.
- Added an async replay worker that reservoir-samples the model's held-out temporal split, reports latency/throughput and labeled confusion metrics, and writes bounded recent status snapshots for the dashboard.
- Added validation-only review-capacity threshold selection, a frozen threshold evaluation on the later test partition, and metrics at the independent agent threshold of 0.85.
- Migrated new model artifacts to native XGBoost JSON members plus a JSON manifest. Legacy joblib artifacts remain loadable during transition.
- Replaced fabricated graph counts and random fraud percentages in the active dashboard with actual fixture counts and a live FastAPI dashboard feed. Added Python tests and Docker Compose definitions.
- Latest full-data run: validation PR AUC 0.934, test PR AUC 0.556, test ROC AUC 0.855. At the validation-selected 1% review threshold (0.999912), test alert rate fell to 0.011% with 1/408 illicit transactions detected. At the separate 0.85 agent threshold, test precision was 94.1%, recall 46.8%, and alert rate 2.30%. This is evidence of substantial temporal drift; the review-capacity threshold should be treated as a starting operating point, not a stable guarantee.
- A 100-row random sample of held-out test transactions completed through the live API with zero errors, about 7.8 ms mean and 11.1 ms p99 round-trip latency, and four investigator reports. These sample throughput/latency values are local smoke-test results, not production capacity claims.
- Remaining work: replace simulated wallet and fund-flow tools with approved blockchain data providers, use durable shared storage/broker infrastructure for multi-instance deployments, and investigate temporal drift before claiming deployment-ready detection quality.
