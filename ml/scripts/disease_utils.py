"""Shared disease name normalization for consistent lookups across the pipeline."""

import pandas as pd


def normalize_disease_name(name) -> str:
    return str(name).strip()


def normalize_disease_series(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip()


def normalize_disease_map(severity_map: dict) -> dict:
    return {normalize_disease_name(k): int(v) for k, v in severity_map.items()}
