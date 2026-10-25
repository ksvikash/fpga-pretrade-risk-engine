"""Load versioned native XGBoost artifacts with legacy pickle compatibility."""

from __future__ import annotations

import json
import warnings
from pathlib import Path
from typing import Any

import joblib
from xgboost import XGBClassifier


def load_model_bundle(path: Path) -> dict[str, Any]:
    if path.suffix.lower() == ".json":
        manifest = json.loads(path.read_text(encoding="utf-8"))
        models = []
        for filename in manifest["model_files"]:
            member_path = (path.parent / filename).resolve()
            if member_path.parent != path.parent.resolve():
                raise ValueError("Model member path must remain beside the manifest")
            model = XGBClassifier()
            model.load_model(str(member_path))
            models.append(model)
        if not models or not manifest.get("feature_names"):
            raise ValueError("Model manifest must contain model members and feature names")
        return {**manifest, "models": models}

    warnings.warn(
        "Loading legacy joblib/pickle model artifacts can emit XGBoost version warnings; retrain to native JSON.",
        RuntimeWarning,
        stacklevel=2,
    )
    return joblib.load(path)
