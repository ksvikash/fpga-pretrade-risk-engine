"""Train a temporal XGBoost ensemble on Elliptic transaction features.

Example:
  python model/train.py --data-dir fraud-detection-dataset --artifact artifacts/fraud_ensemble.json

The dataset labels are 1=illicit, 2=licit, unknown excluded. Splits are made
by sorted timestep before fitting any model or preprocessing step.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score
from xgboost import XGBClassifier


def load_dataset(data_dir: Path) -> pd.DataFrame:
    features = pd.read_csv(data_dir / "elliptic_txs_features.csv", header=None)
    if features.shape[1] < 3:
        raise ValueError("Feature CSV must contain txId, timestep, and at least one feature")
    features.columns = ["txId", "Time step", *[f"feature_{i}" for i in range(features.shape[1] - 2)]]
    labels = pd.read_csv(data_dir / "elliptic_txs_classes.csv", dtype={"class": "string"})
    labels["txId"] = pd.to_numeric(labels["txId"], errors="raise")
    features["txId"] = pd.to_numeric(features["txId"], errors="raise")
    data = features.merge(labels[["txId", "class"]], on="txId", how="inner", validate="one_to_one")
    data["class"] = data["class"].map({"1": 1, "2": 0})
    data = data.dropna(subset=["class"]).copy()
    data["class"] = data["class"].astype("int8")
    if data.empty:
        raise ValueError("No labeled transactions found after joining feature and class files")
    return data.sort_values(["Time step", "txId"], kind="stable").reset_index(drop=True)


def temporal_split(data: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, dict[str, list[int]]]:
    timesteps = np.sort(data["Time step"].unique())
    if len(timesteps) < 3:
        raise ValueError("At least three distinct timesteps are required for train/validation/test")
    train_end = max(1, int(len(timesteps) * 0.70))
    validation_end = max(train_end + 1, int(len(timesteps) * 0.85))
    validation_end = min(validation_end, len(timesteps) - 1)
    groups = {
        "train": timesteps[:train_end],
        "validation": timesteps[train_end:validation_end],
        "test": timesteps[validation_end:],
    }
    parts = tuple(data[data["Time step"].isin(groups[key])].copy() for key in ("train", "validation", "test"))
    if any(part.empty for part in parts):
        raise ValueError("Temporal split produced an empty partition")
    return (*parts, {key: [int(t) for t in values] for key, values in groups.items()})


def matrix(part: pd.DataFrame, feature_names: list[str]) -> tuple[np.ndarray, np.ndarray]:
    # Tree models do not need global scaling. Imputation uses a fixed neutral value,
    # so no held-out partition statistics leak into preprocessing.
    x = part[feature_names].replace([np.inf, -np.inf], np.nan).fillna(0).to_numpy(dtype=np.float32)
    return x, part["class"].to_numpy(dtype=np.int8)


def operating_metrics(y_true: np.ndarray, probabilities: np.ndarray, threshold: float) -> dict[str, float | int]:
    predicted = probabilities >= threshold
    true_positive = int(np.logical_and(predicted, y_true == 1).sum())
    false_positive = int(np.logical_and(predicted, y_true == 0).sum())
    false_negative = int(np.logical_and(~predicted, y_true == 1).sum())
    true_negative = int(np.logical_and(~predicted, y_true == 0).sum())
    precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 0.0
    recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else 0.0
    return {
        "threshold": float(threshold),
        "precision": precision,
        "recall": recall,
        "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
        "alert_rate": float(predicted.mean()),
        "alert_count": int(predicted.sum()),
        "true_positive": true_positive,
        "false_positive": false_positive,
        "false_negative": false_negative,
        "true_negative": true_negative,
    }


def select_threshold_for_capacity(probabilities: np.ndarray, review_capacity: float) -> float:
    if not 0 < review_capacity < 1:
        raise ValueError("review_capacity must be between 0 and 1")
    # 'higher' selects an observed validation score and avoids interpolation into
    # a threshold that did not occur. Ties can make the realized rate exceed target.
    return float(np.quantile(probabilities, 1 - review_capacity, method="higher"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def train(data_dir: Path, artifact_path: Path, n_estimators: int, n_members: int, review_capacity: float) -> dict:
    data = load_dataset(data_dir)
    train_df, validation_df, test_df, split_info = temporal_split(data)
    feature_names = [column for column in data.columns if column.startswith("feature_")]
    x_train, y_train = matrix(train_df, feature_names)
    x_validation, y_validation = matrix(validation_df, feature_names)
    x_test, y_test = matrix(test_df, feature_names)
    if len(np.unique(y_train)) < 2:
        raise ValueError("Training partition must contain both licit and illicit labels")

    positive = int(y_train.sum())
    negative = int(len(y_train) - positive)
    if positive == 0:
        raise ValueError("Training partition contains no illicit examples")
    scale_pos_weight = negative / positive
    models = []
    for seed in range(n_members):
        model = XGBClassifier(
            objective="binary:logistic",
            eval_metric="aucpr",
            n_estimators=n_estimators,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=scale_pos_weight,
            tree_method="hist",
            n_jobs=1,
            random_state=seed,
        )
        model.fit(x_train, y_train, eval_set=[(x_validation, y_validation)], verbose=False)
        models.append(model)

    validation_probability = np.mean([m.predict_proba(x_validation)[:, 1] for m in models], axis=0)
    test_probability = np.mean([m.predict_proba(x_test)[:, 1] for m in models], axis=0)
    decision_threshold = select_threshold_for_capacity(validation_probability, review_capacity)
    report = {
        "split_timesteps": split_info,
        "rows": {"train": len(train_df), "validation": len(validation_df), "test": len(test_df)},
        "average_precision": {
            "validation": float(average_precision_score(y_validation, validation_probability)),
            "test": float(average_precision_score(y_test, test_probability)),
        },
        "roc_auc": {
            "validation": float(roc_auc_score(y_validation, validation_probability)) if len(np.unique(y_validation)) == 2 else None,
            "test": float(roc_auc_score(y_test, test_probability)) if len(np.unique(y_test)) == 2 else None,
        },
        "validation_at_review_capacity": operating_metrics(y_validation, validation_probability, decision_threshold),
        "test_at_validation_threshold": operating_metrics(y_test, test_probability, decision_threshold),
        "validation_at_agent_threshold_0_85": operating_metrics(y_validation, validation_probability, 0.85),
        "test_at_agent_threshold_0_85": operating_metrics(y_test, test_probability, 0.85),
        "target_review_capacity": review_capacity,
        "validation_selected_threshold": decision_threshold,
        "threshold_selection_note": "Threshold selected on validation scores only. Tied scores may push realized alert rate above target; test metrics are reported at the frozen validation threshold.",
        "interval_note": "Serving interval is the 5th–95th percentile of member probabilities; it is ensemble spread, not a calibrated statistical confidence interval.",
    }

    artifact_path.parent.mkdir(parents=True, exist_ok=True)
    model_files = []
    for index, model in enumerate(models):
        model_filename = f"{artifact_path.stem}.member-{index}.json"
        model.get_booster().save_model(str(artifact_path.parent / model_filename))
        model_files.append(model_filename)
    bundle = {
        "format_version": 1,
        "model_files": model_files,
        "feature_names": feature_names,
        "model_version": datetime.now(timezone.utc).strftime("elliptic-xgb-%Y%m%dT%H%M%SZ"),
        "split_timesteps": split_info,
        "decision_threshold": decision_threshold,
        "target_review_capacity": review_capacity,
        "training_metadata": {
            "created_at": datetime.now(timezone.utc).isoformat(),
            "training_data_sha256": sha256_file(data_dir / "elliptic_txs_features.csv"),
            "split_timesteps": split_info,
            "n_estimators": n_estimators,
            "n_members": n_members,
            "scale_pos_weight": scale_pos_weight,
            "validation_metrics": report["validation_at_review_capacity"],
            "test_metrics": report["test_at_validation_threshold"],
        },
    }
    artifact_path.write_text(json.dumps(bundle, indent=2) + "\n", encoding="utf-8")
    report_path = artifact_path.with_suffix(".metrics.json")
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--artifact", type=Path, default=Path("artifacts/fraud_ensemble.json"))
    parser.add_argument("--n-estimators", type=int, default=400)
    parser.add_argument("--n-members", type=int, default=5)
    parser.add_argument("--review-capacity", type=float, default=0.01, help="Target validation alert fraction, e.g. 0.01 for 1%%")
    args = parser.parse_args()
    if args.n_estimators < 1 or args.n_members < 1:
        parser.error("--n-estimators and --n-members must be positive")
    print(json.dumps(train(args.data_dir, args.artifact, args.n_estimators, args.n_members, args.review_capacity), indent=2))


if __name__ == "__main__":
    main()
