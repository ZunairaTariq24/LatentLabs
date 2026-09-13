"""
Production Downtime & Maintenance Decision Intelligence
Module: ml/predictor.py
Description: Loads trained scikit-learn Pipeline and predicts machine failure probability.

EXACT FEATURES:
1. Type (H, M, L)
2. Air temperature [K]
3. Process temperature [K]
4. Rotational speed [rpm]
5. Torque [Nm]
6. Tool wear [min]

EXCLUDED LEAKAGE FIELDS (NEVER USED):
UDI, Product ID, TWF, HDF, PWF, OSF, RNF
"""

import os
import sys
import json
from typing import Dict, Any, Tuple, Optional, List

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(MODEL_DIR, "predictive_maintenance_model.pkl")
CONFIG_PATH = os.path.join(MODEL_DIR, "model_config.json")

# Authoritative feature column names as required by the trained pipeline
EXACT_FEATURE_NAMES: List[str] = [
    "Type",
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]",
]

KEY_MODEL_FACTORS: List[Dict[str, str]] = [
    {"name": "Torque", "unit": "Nm", "description": "Rotational force load applied to the machine spindle."},
    {"name": "Rotational speed", "unit": "rpm", "description": "Operating angular velocity of the drive shaft."},
    {"name": "Tool wear", "unit": "min", "description": "Cumulative cutting/operating duration of active tool piece."},
    {"name": "Air temperature", "unit": "K", "description": "Ambient environmental temperature surrounding asset."},
    {"name": "Process temperature", "unit": "K", "description": "Direct internal operating process thermodynamic reading."},
]

_CACHED_MODEL = None


def is_model_file_present() -> bool:
    """Checks if the .pkl model file exists on disk."""
    return os.path.isfile(MODEL_PATH)


def load_model_config(config_path: str = CONFIG_PATH) -> Dict[str, Any]:
    """Loads model configuration metadata from model_config.json."""
    if not os.path.isfile(config_path):
        return {
            "model_name": "Random Forest Pipeline (100 Estimators)",
            "thresholds": {
                "low_risk_max": 0.20,
                "medium_risk_max": 0.40,
                "decision_threshold": 0.40,
            },
            "metrics": {
                "roc_auc": 0.9662,
                "threshold": 0.40,
                "precision": 0.632911,
                "recall": 0.735294,
                "f1_score": 0.680272,
            },
        }

    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_feature_importances(model_path: str = MODEL_PATH) -> List[Dict[str, Any]]:
    """
    Dynamically extracts actual feature_importances_ from the trained scikit-learn
    Random Forest pipeline and aggregates one-hot encoded categories (Type).
    """
    pipeline = load_model(model_path)
    preprocessor = pipeline.named_steps.get("preprocessor")
    classifier = pipeline.named_steps.get("classifier") or pipeline.steps[-1][1]

    if hasattr(preprocessor, "get_feature_names_out"):
        feature_names = list(preprocessor.get_feature_names_out())
    else:
        feature_names = [f"feature_{i}" for i in range(len(classifier.feature_importances_))]

    raw_importances = classifier.feature_importances_

    # Aggregate one-hot Type into a single "Machine Type" category
    agg: Dict[str, float] = {}
    for name, imp in zip(feature_names, raw_importances):
        name_str = str(name)
        if "Type" in name_str:
            clean_name = "Machine Type"
        elif "__" in name_str:
            clean_name = name_str.split("__", 1)[1]
        else:
            clean_name = name_str
        agg[clean_name] = agg.get(clean_name, 0.0) + float(imp)

    sorted_importances = [
        {
            "feature": k,
            "importance": round(v, 4),
            "percentage": round(v * 100.0, 1),
            "formatted": f"{v * 100.0:.1f}%",
        }
        for k, v in sorted(agg.items(), key=lambda x: x[1], reverse=True)
    ]
    return sorted_importances


def load_model(model_path: str = MODEL_PATH):
    """
    Loads the trained scikit-learn pipeline using joblib.
    Caches model in memory for fast repeated inference.
    """
    global _CACHED_MODEL

    if _CACHED_MODEL is not None:
        return _CACHED_MODEL

    if not os.path.isfile(model_path):
        raise FileNotFoundError(
            f"Trained model file not found at: '{model_path}'. "
            f"Please place 'predictive_maintenance_model.pkl' in the 'ml/' directory."
        )

    try:
        import joblib
    except ImportError as err:
        raise ImportError(
            "The 'joblib' package is required for loading the model. "
            "Please install via: pip install joblib scikit-learn pandas"
        ) from err

    try:
        loaded_pipeline = joblib.load(model_path)
        _CACHED_MODEL = loaded_pipeline
        return _CACHED_MODEL
    except Exception as exc:
        raise RuntimeError(
            f"Failed to load predictive maintenance model from '{model_path}': {str(exc)}"
        ) from exc


def validate_prediction_inputs(
    machine_type: Any,
    air_temperature: Any,
    process_temperature: Any,
    rotational_speed: Any,
    torque: Any,
    tool_wear: Any,
) -> Dict[str, Any]:
    """
    Validates the 6 model inputs.
    Strictly forbids data leakage fields (UDI, Product ID, TWF, HDF, PWF, OSF, RNF).
    """
    # 1. Type validation
    if not isinstance(machine_type, str):
        raise ValueError(f"Machine Type must be a string ('H', 'M', or 'L'), got {type(machine_type).__name__}")
    
    clean_type = machine_type.strip().upper()
    if clean_type not in ("H", "M", "L"):
        raise ValueError(
            f"Invalid Machine Type '{machine_type}'. Allowed types are 'H' (High), 'M' (Medium), or 'L' (Low)."
        )

    # Helper for numeric validation
    def _validate_numeric(val: Any, field_name: str, min_val: Optional[float] = None, max_val: Optional[float] = None) -> float:
        try:
            num = float(val)
        except (ValueError, TypeError):
            raise ValueError(f"Invalid numeric input for '{field_name}': {val}")

        import math
        if math.isnan(num) or math.isinf(num):
            raise ValueError(f"Field '{field_name}' cannot be NaN or Infinite: {val}")

        if min_val is not None and num < min_val:
            raise ValueError(f"Field '{field_name}' must be >= {min_val}, got {num}")

        if max_val is not None and num > max_val:
            raise ValueError(f"Field '{field_name}' must be <= {max_val}, got {num}")

        return num

    # 2. Air temperature [K] (typical ~290K - 320K)
    clean_air_temp = _validate_numeric(air_temperature, "Air temperature [K]", min_val=200.0, max_val=400.0)

    # 3. Process temperature [K] (typical ~300K - 330K)
    clean_proc_temp = _validate_numeric(process_temperature, "Process temperature [K]", min_val=200.0, max_val=400.0)

    # 4. Rotational speed [rpm] (typical ~1100 - 3000)
    clean_rot_speed = _validate_numeric(rotational_speed, "Rotational speed [rpm]", min_val=0.0, max_val=10000.0)

    # 5. Torque [Nm] (typical ~3 - 80)
    clean_torque = _validate_numeric(torque, "Torque [Nm]", min_val=0.0, max_val=200.0)

    # 6. Tool wear [min] (typical ~0 - 300)
    clean_tool_wear = _validate_numeric(tool_wear, "Tool wear [min]", min_val=0.0, max_val=1000.0)

    return {
        "Type": clean_type,
        "Air temperature [K]": clean_air_temp,
        "Process temperature [K]": clean_proc_temp,
        "Rotational speed [rpm]": clean_rot_speed,
        "Torque [Nm]": clean_torque,
        "Tool wear [min]": clean_tool_wear,
    }


def predict_failure_probability(
    machine_type: str,
    air_temperature: float,
    process_temperature: float,
    rotational_speed: float,
    torque: float,
    tool_wear: float,
    model_path: str = MODEL_PATH,
) -> float:
    """
    Executes the trained scikit-learn pipeline to compute the failure probability.

    Steps:
    1. Validates inputs
    2. Constructs a pandas DataFrame using exact feature column names
    3. Executes model.predict_proba()
    4. Returns failure probability (class 1)
    """
    validated = validate_prediction_inputs(
        machine_type=machine_type,
        air_temperature=air_temperature,
        process_temperature=process_temperature,
        rotational_speed=rotational_speed,
        torque=torque,
        tool_wear=tool_wear,
    )

    pipeline = load_model(model_path)

    try:
        import pandas as pd
    except ImportError as err:
        raise ImportError(
            "The 'pandas' package is required for DataFrame inference. "
            "Please install via: pip install pandas"
        ) from err

    # Construct DataFrame with EXACT feature names
    input_data = pd.DataFrame([{
        "Type": validated["Type"],
        "Air temperature [K]": validated["Air temperature [K]"],
        "Process temperature [K]": validated["Process temperature [K]"],
        "Rotational speed [rpm]": validated["Rotational speed [rpm]"],
        "Torque [Nm]": validated["Torque [Nm]"],
        "Tool wear [min]": validated["Tool wear [min]"],
    }])

    try:
        probabilities = pipeline.predict_proba(input_data)
        # Class 1 is machine failure
        prob_failure = float(probabilities[0][1])
        return prob_failure
    except Exception as exc:
        raise RuntimeError(f"Prediction execution failed on model pipeline: {str(exc)}") from exc


if __name__ == "__main__":
    # Test CLI / JSON interface
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        print(f"Model path: {MODEL_PATH}")
        print(f"Model file present: {is_model_file_present()}")
        sys.exit(0)

    if len(sys.argv) > 1 and sys.argv[1] == "--model-info":
        try:
            config = load_model_config()
            importances = get_feature_importances(MODEL_PATH)
            res = {
                "success": True,
                "model_name": config.get("model_name", "Random Forest Pipeline (100 Estimators)"),
                "model_type": config.get("model_type", "scikit-learn Pipeline (RandomForestClassifier)"),
                "dataset": config.get("dataset", "AI4I 2020 Predictive Maintenance Dataset"),
                "dataset_records": config.get("dataset_records", 10000),
                "thresholds": config.get("thresholds", {
                    "low_risk_max": 0.20,
                    "medium_risk_max": 0.40,
                    "decision_threshold": 0.40,
                }),
                "metrics": config.get("metrics", {
                    "roc_auc": 0.9662,
                    "threshold": 0.40,
                    "precision": 0.632911,
                    "recall": 0.735294,
                    "f1_score": 0.680272,
                }),
                "features": config.get("features", EXACT_FEATURE_NAMES),
                "feature_importance": importances,
            }
            print(json.dumps(res))
            sys.exit(0)
        except Exception as err:
            print(json.dumps({"success": False, "error": str(err)}))
            sys.exit(1)

    if len(sys.argv) > 1 and sys.argv[1] == "--predict-json":
        # Add parent directory to sys.path to import services.decision_engine
        parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if parent_dir not in sys.path:
            sys.path.insert(0, parent_dir)

        try:
            from services.decision_engine import evaluate_maintenance_decision
            input_json = sys.argv[2] if len(sys.argv) > 2 else sys.stdin.read()
            data = json.loads(input_json)

            prob = predict_failure_probability(
                machine_type=data.get("Type", data.get("type", "L")),
                air_temperature=data.get("Air temperature [K]", data.get("air_temperature", 300.0)),
                process_temperature=data.get("Process temperature [K]", data.get("process_temperature", 310.0)),
                rotational_speed=data.get("Rotational speed [rpm]", data.get("rotational_speed", 1500.0)),
                torque=data.get("Torque [Nm]", data.get("torque", 40.0)),
                tool_wear=data.get("Tool wear [min]", data.get("tool_wear", 100.0)),
            )

            decision = evaluate_maintenance_decision(prob)
            config = load_model_config()
            feature_importance = get_feature_importances(MODEL_PATH)

            result = {
                "success": True,
                "data": decision,
                "inputs": {
                    "Type": data.get("Type", "L"),
                    "Air temperature [K]": data.get("Air temperature [K]", 300.0),
                    "Process temperature [K]": data.get("Process temperature [K]", 310.0),
                    "Rotational speed [rpm]": data.get("Rotational speed [rpm]", 1500.0),
                    "Torque [Nm]": data.get("Torque [Nm]", 40.0),
                    "Tool wear [min]": data.get("Tool wear [min]", 100.0),
                },
                "feature_importance": feature_importance,
                "model_config": config,
            }
            print(json.dumps(result))
            sys.exit(0)
        except Exception as err:
            err_result = {
                "success": False,
                "error": str(err),
                "error_type": type(err).__name__
            }
            print(json.dumps(err_result))
            sys.exit(1)

