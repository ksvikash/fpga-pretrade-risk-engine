# Bitcoin Fraud Detection

A hackathon prototype combining an Elliptic Bitcoin transaction notebook with a Next.js graph dashboard. The current dashboard serves a bundled graph fixture; the notebook is exploratory and is not a production scoring service.

## Run the dashboard

```bash
npm install
npm run dev
```

Open `http://localhost:3000/graph` for the graph view. `GET /api/network` serves the bundled fixture and supports `nodeTypes`, `maxNodes` (1–100000), and `includeMetadata=false` query parameters. The fixture and its risk labels are demonstrations, not a live or validated fraud feed.

## Notebook

Open `bitcoin-fraud-detection.ipynb` with Jupyter and provide the Elliptic dataset under `fraud-detection-dataset/`. The notebook currently includes exploratory model training and synthetic analytics; its reported metrics should not be treated as production or out-of-sample performance. See [the audit and upgrade plan](docs/PRODUCTION_AUDIT.md) before extending its results.

## Current limitations

- No live ingestion, scoring API, model artifact management, or alert lifecycle.
- The dashboard graph is a bundled fixture; dashboard summaries include demo data.
- Notebook validation splits and feature preparation do not provide a trustworthy temporal evaluation.
- There is no automated test suite, container setup, or production observability.
