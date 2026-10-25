from __future__ import annotations

import csv
import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
from xgboost import XGBClassifier

from agent.investigator import investigate_transaction
from model.train import operating_metrics, select_threshold_for_capacity, temporal_split
from service.app import main as scoring_app
from streaming import worker as streaming_worker
from streaming.worker import load_replay_sample


class TemporalTrainingTests(unittest.TestCase):
    def test_splits_are_strictly_ordered_by_timestep(self):
        frame = pd.DataFrame(
            [{"Time step": timestep, "class": label} for timestep in range(1, 11) for label in (0, 1)]
        )
        train, validation, test, groups = temporal_split(frame)
        self.assertLess(train["Time step"].max(), validation["Time step"].min())
        self.assertLess(validation["Time step"].max(), test["Time step"].min())
        self.assertEqual(groups["train"], [1, 2, 3, 4, 5, 6, 7])

    def test_validation_threshold_targets_review_capacity(self):
        probabilities = np.arange(100, dtype=float) / 100
        threshold = select_threshold_for_capacity(probabilities, 0.1)
        self.assertAlmostEqual(threshold, 0.9)
        with self.assertRaises(ValueError):
            select_threshold_for_capacity(probabilities, 1.0)

    def test_operating_metrics_include_confusion_and_alert_volume(self):
        result = operating_metrics(
            np.asarray([1, 1, 0, 0]), np.asarray([0.9, 0.4, 0.8, 0.1]), threshold=0.5
        )
        self.assertEqual(result["true_positive"], 1)
        self.assertEqual(result["false_positive"], 1)
        self.assertEqual(result["false_negative"], 1)
        self.assertEqual(result["true_negative"], 1)
        self.assertAlmostEqual(result["alert_rate"], 0.5)


class InvestigatorTests(unittest.TestCase):
    def test_only_strictly_over_threshold_creates_report_and_runs_tools(self):
        payload = {"transaction_id": "test-tx", "wallet_address": "test-wallet", "risk_score": 0.85}
        self.assertIsNone(investigate_transaction(payload))
        report = investigate_transaction({**payload, "risk_score": 0.85001})
        self.assertIsNotNone(report)
        assert report is not None
        self.assertEqual(
            set(report.tools_executed),
            {"get_wallet_history", "trace_fund_graph", "calculate_risk_factors"},
        )


class ReplayTests(unittest.TestCase):
    def test_replay_uses_temporal_split_and_cleans_non_finite_features(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            with (root / "elliptic_txs_classes.csv").open("w", newline="") as file:
                writer = csv.writer(file)
                writer.writerow(["txId", "class"])
                writer.writerow(["100", "1"])
                writer.writerow(["200", "2"])
                writer.writerow(["300", "unknown"])
            with (root / "elliptic_txs_features.csv").open("w", newline="") as file:
                writer = csv.writer(file)
                writer.writerow([100, 3, 0.3, float("nan")])
                writer.writerow([200, 2, 0.2, 0.1])
                writer.writerow([300, 4, 0.4, 0.2])
            rows = load_replay_sample(root, ["feature_0", "feature_1"], {"test": [3]}, "test", 10, 1)
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["label"], 1)
            self.assertEqual(rows[0]["features"]["feature_1"], 0.0)

    def test_report_log_rotation_keeps_a_bounded_recent_tail(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "reports.jsonl"
            old_limit = streaming_worker.MAX_REPORT_LOG_BYTES
            old_entries = streaming_worker.MAX_REPORT_LOG_ENTRIES
            try:
                streaming_worker.MAX_REPORT_LOG_BYTES = 1
                streaming_worker.MAX_REPORT_LOG_ENTRIES = 2
                for index in range(4):
                    streaming_worker.append_report(path, json.dumps({"index": index}))
                records = [json.loads(line) for line in path.read_text().splitlines()]
                self.assertEqual([record["index"] for record in records], [2, 3])
            finally:
                streaming_worker.MAX_REPORT_LOG_BYTES = old_limit
                streaming_worker.MAX_REPORT_LOG_ENTRIES = old_entries


class NativeArtifactTests(unittest.TestCase):
    def test_service_loads_native_xgboost_json_manifest(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            model_path = root / "member.json"
            classifier = XGBClassifier(n_estimators=2, max_depth=1, n_jobs=1, random_state=1)
            classifier.fit(np.asarray([[0.0], [1.0], [0.2], [0.8]]), np.asarray([0, 1, 0, 1]))
            classifier.get_booster().save_model(str(model_path))
            manifest_path = root / "manifest.json"
            manifest_path.write_text(
                json.dumps(
                    {
                        "model_files": [model_path.name],
                        "feature_names": ["feature_0"],
                        "model_version": "test-native",
                        "decision_threshold": 0.7,
                    }
                )
            )
            old_path = scoring_app.MODEL_PATH
            old_bundle = scoring_app.model_bundle
            try:
                scoring_app.MODEL_PATH = manifest_path
                scoring_app.model_bundle = None
                loaded = scoring_app.load_bundle()
                self.assertEqual(loaded["model_version"], "test-native")
                self.assertEqual(len(loaded["models"]), 1)
                self.assertEqual(loaded["models"][0].n_features_in_, 1)
            finally:
                scoring_app.MODEL_PATH = old_path
                scoring_app.model_bundle = old_bundle


class DashboardEndpointTests(unittest.TestCase):
    def test_dashboard_combines_recent_alerts_and_investigation_reports(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            metrics_path = root / "stream.json"
            investigations_path = root / "investigations.jsonl"
            scenario_path = root / "scenario.json"
            metrics_path.write_text(
                json.dumps(
                    {
                        "running": False,
                        "recent_events": [
                            {"transaction_id": "alert-1", "risk_score": 0.91, "is_alert": False}
                        ],
                    }
                )
            )
            investigations_path.write_text(
                json.dumps({"transaction_id": "audit-1", "risk_score": 0.96, "executive_summary": "review"}) + "\n"
            )
            scenario_path.write_text(json.dumps({"audit_report": {"transaction_id": "audit-2", "risk_score": 0.99}}))
            old_paths = (
                scoring_app.STREAM_METRICS_PATH,
                scoring_app.INVESTIGATIONS_PATH,
                scoring_app.SCENARIO_REPORT_PATH,
            )
            try:
                scoring_app.STREAM_METRICS_PATH = metrics_path
                scoring_app.INVESTIGATIONS_PATH = investigations_path
                scoring_app.SCENARIO_REPORT_PATH = scenario_path
                response = TestClient(scoring_app.app).get("/dashboard")
                self.assertEqual(response.status_code, 200)
                payload = response.json()
                self.assertTrue(payload["connected"])
                self.assertEqual(payload["alerts"][0]["transaction_id"], "alert-1")
                self.assertEqual({item["transaction_id"] for item in payload["investigations"]}, {"audit-1", "audit-2"})
            finally:
                scoring_app.STREAM_METRICS_PATH, scoring_app.INVESTIGATIONS_PATH, scoring_app.SCENARIO_REPORT_PATH = old_paths


if __name__ == "__main__":
    unittest.main()
