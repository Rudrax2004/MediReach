"""Flask inference API for MediReach Random Forest model."""

import sys
from pathlib import Path

import joblib
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS

sys.path.insert(0, str(Path(__file__).resolve().parent))
from disease_utils import normalize_disease_map, normalize_disease_name
from paths import MODELS_DIR

app = Flask(__name__)
CORS(app)

MODEL = None
FEATURE_COLUMNS = None
SEVERITY_MAP = None


def severity_to_tier(severity: int) -> str:
    if severity <= 2:
        return "red"
    if severity == 3:
        return "yellow"
    return "green"


def load_artifacts() -> None:
    global MODEL, FEATURE_COLUMNS, SEVERITY_MAP

    MODEL = joblib.load(MODELS_DIR / "medireach_model.pkl")
    FEATURE_COLUMNS = joblib.load(MODELS_DIR / "feature_columns.pkl")
    SEVERITY_MAP = normalize_disease_map(
        joblib.load(MODELS_DIR / "severity_map.pkl")
    )


def build_feature_vector(symptoms: list, age: int, sex: str) -> np.ndarray:
    row = {col: 0 for col in FEATURE_COLUMNS}

    for symptom_id in symptoms:
        symptom_id = str(symptom_id)
        if symptom_id in row:
            row[symptom_id] = 1

    if "age" in row:
        row["age"] = int(age)

    if "sex" in row:
        sex_norm = str(sex).strip().upper()
        row["sex"] = 1 if sex_norm in ("M", "MALE", "1") else 0

    return np.array([row[col] for col in FEATURE_COLUMNS]).reshape(1, -1)


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "model_loaded": MODEL is not None,
            "num_diseases": len(MODEL.classes_) if MODEL is not None else 0,
        }
    )


@app.route("/predict", methods=["POST"])
def predict():
    if MODEL is None:
        return jsonify({"error": "Model not loaded"}), 503

    body = request.get_json(silent=True) or {}
    symptoms = body.get("symptoms", [])
    age = body.get("age")
    sex = body.get("sex")

    if not isinstance(symptoms, list):
        return jsonify({"error": "symptoms must be an array of evidence IDs"}), 400
    if age is None:
        return jsonify({"error": "age is required"}), 400
    if sex is None:
        return jsonify({"error": "sex is required"}), 400

    features = build_feature_vector(symptoms, age, sex)
    probabilities = MODEL.predict_proba(features)[0]
    classes = MODEL.classes_

    top_indices = np.argsort(probabilities)[::-1][:3]
    top_3_predictions = [
        {
            "disease": normalize_disease_name(classes[i]),
            "probability": round(float(probabilities[i]), 4),
        }
        for i in top_indices
    ]

    best_idx = top_indices[0]
    predicted_disease = normalize_disease_name(classes[best_idx])
    confidence = round(float(probabilities[best_idx]), 4)

    severity_score = SEVERITY_MAP.get(predicted_disease)
    if severity_score is None:
        severity_score = 3
    severity_score = int(severity_score)
    tier = severity_to_tier(severity_score)

    return jsonify(
        {
            "predicted_disease": predicted_disease,
            "severity_score": severity_score,
            "tier": tier,
            "confidence": confidence,
            "top_3_predictions": top_3_predictions,
            "model": "random-forest-v1",
            "dataset": "DDXPlus",
        }
    )


if __name__ == "__main__":
    load_artifacts()
    print("MediReach ML API loaded.")
    print(f"  Diseases: {len(MODEL.classes_)}")
    print(f"  Features: {len(FEATURE_COLUMNS)}")
    print("  Listening on http://localhost:5001")
    app.run(host="0.0.0.0", port=5001, debug=False)
