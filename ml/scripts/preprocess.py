"""Load DDXPlus raw data, filter train split, sample 100k rows, export cleaned artifacts."""

import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from disease_utils import normalize_disease_series
from paths import (
    ANTECEDENTS_FILE,
    DATA_DIR,
    DISEASES_FILE,
    EVIDENCE_VALUES_FILE,
    PATIENTS_FILE,
    RANDOM_STATE,
    SAMPLE_SIZE,
    SYMPTOMS_FILE,
)


def load_csv(path: Path, name: str) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Missing {name}: {path}")
    return pd.read_csv(path)


def get_train_sample(patients: pd.DataFrame) -> pd.DataFrame:
    split_col = patients["split"].astype(str).str.lower()
    train = patients[split_col == "train"].copy()

    if len(train) == 0:
        raise ValueError("No rows found with split='train'. Check patients.csv split values.")

    if len(train) > SAMPLE_SIZE:
        train = train.sample(n=SAMPLE_SIZE, random_state=RANDOM_STATE)

    return train.reset_index(drop=True)


def main() -> None:
    print("=" * 60)
    print("MediReach — DDXPlus Preprocessing")
    print("=" * 60)

    patients = load_csv(PATIENTS_FILE, "patients.csv")
    symptoms = load_csv(SYMPTOMS_FILE, "symptoms.csv")
    diseases = load_csv(DISEASES_FILE, "diseases.csv")
    evidence_values = load_csv(EVIDENCE_VALUES_FILE, "evidence_values.csv")
    antecedents = load_csv(ANTECEDENTS_FILE, "antecedents.csv")

    print("\n--- Raw dataset stats ---")
    print(f"patients.csv:         {len(patients):,} rows, {len(patients.columns)} columns")
    print(f"symptoms.csv:         {len(symptoms):,} rows")
    print(f"diseases.csv:         {len(diseases):,} rows")
    print(f"evidence_values.csv:  {len(evidence_values):,} rows")
    print(f"antecedents.csv:      {len(antecedents):,} rows")

    required_patient_cols = {
        "patient_id",
        "age",
        "sex",
        "ground_truth_disease_name",
        "initial_evidence_id",
        "split",
    }
    missing = required_patient_cols - set(patients.columns)
    if missing:
        raise ValueError(f"patients.csv missing columns: {missing}")

    train_sample = get_train_sample(patients)

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    disease_name_col = next(
        (c for c in ["disease_name", "name", "ground_truth_disease_name"] if c in diseases.columns),
        diseases.columns[0],
    )
    severity_col = next(
        (c for c in ["severity", "severity_score", "severity_level"] if c in diseases.columns),
        None,
    )
    if severity_col is None:
        raise ValueError("diseases.csv must contain a severity column (1=critical, 5=mild)")

    diseases_clean = diseases.copy()
    diseases_clean[disease_name_col] = normalize_disease_series(diseases_clean[disease_name_col])
    diseases_clean = diseases_clean.drop_duplicates(subset=[disease_name_col]).reset_index(drop=True)

    severity_map = dict(
        zip(
            diseases_clean[disease_name_col].astype(str),
            diseases_clean[severity_col].astype(int),
        )
    )

    train_sample["ground_truth_disease_name"] = normalize_disease_series(
        train_sample["ground_truth_disease_name"]
    )

    diseases_clean.to_csv(DATA_DIR / "diseases_clean.csv", index=False)
    with open(DATA_DIR / "severity_map.json", "w", encoding="utf-8") as f:
        json.dump(severity_map, f, indent=2)

    train_sample.to_csv(DATA_DIR / "patients_train_100k.csv", index=False)

    print("\n--- Train sample (100k max) ---")
    print(f"Total patients (train sample): {len(train_sample):,}")

    class_counts = train_sample["ground_truth_disease_name"].value_counts()
    print("\nTop 10 disease class distribution:")
    for disease, count in class_counts.head(10).items():
        pct = 100 * count / len(train_sample)
        print(f"  {disease}: {count:,} ({pct:.1f}%)")

    print(f"\nAge range: {train_sample['age'].min()} – {train_sample['age'].max()}")

    sex_counts = train_sample["sex"].astype(str).str.upper().value_counts()
    print("\nSex split:")
    for sex, count in sex_counts.items():
        pct = 100 * count / len(train_sample)
        print(f"  {sex}: {count:,} ({pct:.1f}%)")

    print(f"\nSaved: {DATA_DIR / 'diseases_clean.csv'}")
    print(f"Saved: {DATA_DIR / 'severity_map.json'}")
    print(f"Saved: {DATA_DIR / 'patients_train_100k.csv'}")
    print("\nPreprocessing complete.")


if __name__ == "__main__":
    main()
