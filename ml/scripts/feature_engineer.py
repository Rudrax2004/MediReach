"""Build binary feature matrix from train sample and save X/y pickles."""

import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from paths import DATA_DIR, PATIENTS_FILE, RANDOM_STATE, SAMPLE_SIZE, SYMPTOMS_FILE


def get_symptom_ids(symptoms: pd.DataFrame) -> list[str]:
    for col in ["evidence_id", "symptom_id", "id", "code"]:
        if col in symptoms.columns:
            return symptoms[col].astype(str).tolist()

    return symptoms.iloc[:, 0].astype(str).tolist()


def get_train_patients() -> pd.DataFrame:
    cached = DATA_DIR / "patients_train_100k.csv"
    if cached.exists():
        return pd.read_csv(cached)

    patients = pd.read_csv(PATIENTS_FILE)
    split_col = patients["split"].astype(str).str.lower()
    train = patients[split_col == "train"]

    if len(train) > SAMPLE_SIZE:
        train = train.sample(n=SAMPLE_SIZE, random_state=RANDOM_STATE)

    return train.reset_index(drop=True)


def encode_sex(series: pd.Series) -> np.ndarray:
    normalized = series.astype(str).str.strip().str.upper()
    return np.where(normalized.isin(["M", "MALE", "1"]), 1, 0).astype(int)


def main() -> None:
    print("=" * 60)
    print("MediReach — Feature Engineering")
    print("=" * 60)

    symptoms = pd.read_csv(SYMPTOMS_FILE)
    symptom_ids = get_symptom_ids(symptoms)

    if len(symptom_ids) != 110:
        print(f"Warning: expected 110 symptom columns, found {len(symptom_ids)}")

    patients = get_train_patients()
    n = len(patients)

    X = pd.DataFrame(0, index=range(n), columns=symptom_ids, dtype=np.int8)
    X["age"] = patients["age"].astype(int).values
    X["sex"] = encode_sex(patients["sex"])

    for idx, evidence_id in enumerate(patients["initial_evidence_id"].astype(str)):
        if evidence_id in X.columns:
            X.at[idx, evidence_id] = 1
        else:
            print(f"Warning: initial_evidence_id {evidence_id} not in symptom columns")

    y = patients["ground_truth_disease_name"].astype(str).values

    expected_cols = 112
    if X.shape[1] != expected_cols:
        print(f"Warning: feature matrix has {X.shape[1]} columns (expected {expected_cols})")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(X, DATA_DIR / "X_train.pkl")
    joblib.dump(y, DATA_DIR / "y_train.pkl")

    feature_columns = list(X.columns)
    joblib.dump(feature_columns, DATA_DIR / "feature_columns.pkl")

    print(f"\nPatients:     {n:,}")
    print(f"Feature shape: {X.shape}  (target: {expected_cols} = 110 symptoms + age + sex)")
    print(f"Labels:       {len(np.unique(y))} unique diseases")
    print(f"\nSaved: {DATA_DIR / 'X_train.pkl'}")
    print(f"Saved: {DATA_DIR / 'y_train.pkl'}")
    print("\nFeature engineering complete.")


if __name__ == "__main__":
    main()
