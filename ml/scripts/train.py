"""Train Random Forest on DDXPlus features and save model artifacts."""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent))
from disease_utils import normalize_disease_map
from paths import DATA_DIR, MODELS_DIR, RANDOM_STATE


def top_k_accuracy(model, X_test, y_test, k: int = 5) -> float:
    probas = model.predict_proba(X_test)
    classes = model.classes_
    correct = 0

    for i, true_label in enumerate(y_test):
        top_indices = np.argsort(probas[i])[-k:][::-1]
        top_labels = classes[top_indices]
        if true_label in top_labels:
            correct += 1

    return correct / len(y_test)


def main() -> None:
    print("=" * 60)
    print("MediReach — Random Forest Training")
    print("=" * 60)

    X = joblib.load(DATA_DIR / "X_train.pkl")
    y = joblib.load(DATA_DIR / "y_train.pkl")

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=RANDOM_STATE,
        stratify=y,
    )

    print(f"\nTrain size: {len(X_train):,}  |  Test size: {len(X_test):,}")

    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=20,
        class_weight="balanced",
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )

    print("\nTraining RandomForestClassifier...")
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    top5_acc = top_k_accuracy(model, X_test, y_test, k=5)

    print(f"\nAccuracy (top-1): {accuracy:.4f}")
    print(f"Accuracy (top-5): {top5_acc:.4f}")

    top5_diseases = pd.Series(y_train).value_counts().head(5).index.tolist()
    mask = np.isin(y_test, top5_diseases)
    y_test_top5 = y_test[mask]
    y_pred_top5 = y_pred[mask]

    print(f"\nClassification report (5 most common diseases):")
    print(
        classification_report(
            y_test_top5,
            y_pred_top5,
            labels=top5_diseases,
            zero_division=0,
        )
    )

    cm = confusion_matrix(y_test_top5, y_pred_top5, labels=top5_diseases)
    cm_df = pd.DataFrame(cm, index=top5_diseases, columns=top5_diseases)
    print("\nConfusion matrix (5 most common diseases):")
    print(cm_df.to_string())

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    feature_columns = list(X.columns)
    severity_map_path = DATA_DIR / "severity_map.json"
    severity_map = normalize_disease_map(
        json.loads(severity_map_path.read_text(encoding="utf-8"))
    )

    joblib.dump(model, MODELS_DIR / "medireach_model.pkl")
    joblib.dump(feature_columns, MODELS_DIR / "feature_columns.pkl")
    joblib.dump(severity_map, MODELS_DIR / "severity_map.pkl")

    metrics = {
        "accuracy_top1": round(float(accuracy), 4),
        "accuracy_top5": round(float(top5_acc), 4),
        "model": "RandomForestClassifier",
        "n_estimators": 100,
        "max_depth": 20,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "num_features": len(feature_columns),
        "num_classes": len(model.classes_),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with open(MODELS_DIR / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"\nSaved: {MODELS_DIR / 'medireach_model.pkl'}")
    print(f"Saved: {MODELS_DIR / 'feature_columns.pkl'}")
    print(f"Saved: {MODELS_DIR / 'severity_map.pkl'}")
    print(f"Saved: {MODELS_DIR / 'metrics.json'}")
    print("\nTraining complete.")


if __name__ == "__main__":
    main()
