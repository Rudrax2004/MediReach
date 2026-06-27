from pathlib import Path

ML_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ML_ROOT / "data" / "raw"
DATA_DIR = ML_ROOT / "data"
MODELS_DIR = ML_ROOT / "models"

PATIENTS_FILE = RAW_DIR / "patients.csv"
SYMPTOMS_FILE = RAW_DIR / "symptoms.csv"
DISEASES_FILE = RAW_DIR / "diseases.csv"
EVIDENCE_VALUES_FILE = RAW_DIR / "evidence_values.csv"
ANTECEDENTS_FILE = RAW_DIR / "antecedents.csv"

SAMPLE_SIZE = 100_000
RANDOM_STATE = 42
