"""
Training Pipeline: warehouse.db → late_delivery_model.sav
Trains a scikit-learn pipeline on the analytical modeling table and saves artifacts.
"""

import sqlite3
import json
import joblib
import pandas as pd
from datetime import datetime

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, f1_score, roc_auc_score, classification_report
)

WAREHOUSE_PATH = "../warehouse.db"
MODEL_PATH = "../late_delivery_model.sav"
METADATA_PATH = "../model_metadata.json"
METRICS_PATH = "../metrics.json"

FEATURE_COLS = [
    "num_items",
    "num_distinct_products",
    "avg_unit_price",
    "order_total",
    "customer_age",
    "customer_order_count",
]
LABEL_COL = "late_delivery"
MODEL_VERSION = "1.0.0"


def run_training():
    # --- Load ---
    conn = sqlite3.connect(WAREHOUSE_PATH)
    df = pd.read_sql("SELECT * FROM fact_orders_ml", conn)
    conn.close()
    print(f"Loaded {df.shape[0]} rows from warehouse.db")

    # --- Split ---
    X = df[FEATURE_COLS]
    y = df[LABEL_COL].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )
    print(f"Train: {X_train.shape[0]} rows | Test: {X_test.shape[0]} rows")

    # --- Pipeline ---
    pipeline = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("model", GradientBoostingClassifier(n_estimators=100, random_state=42)),
    ])

    pipeline.fit(X_train, y_train)
    print("Model trained.")

    # --- Evaluate ---
    y_pred = pipeline.predict(X_test)
    y_prob = pipeline.predict_proba(X_test)[:, 1]

    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_prob)
    report = classification_report(y_test, y_pred, output_dict=True)

    print(f"Accuracy: {accuracy:.4f} | F1: {f1:.4f} | ROC-AUC: {roc_auc:.4f}")

    # --- Save model ---
    joblib.dump(pipeline, MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")

    # --- Save metadata ---
    metadata = {
        "model_name": "late_delivery_pipeline",
        "model_version": MODEL_VERSION,
        "trained_at_utc": datetime.utcnow().isoformat(),
        "warehouse_table": "fact_orders_ml",
        "num_training_rows": int(X_train.shape[0]),
        "num_test_rows": int(X_test.shape[0]),
        "features": FEATURE_COLS,
        "label": LABEL_COL,
    }
    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    metrics = {
        "accuracy": float(accuracy),
        "f1": float(f1),
        "roc_auc": float(roc_auc),
        "classification_report": report,
    }
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"Metadata → {METADATA_PATH}")
    print(f"Metrics  → {METRICS_PATH}")


if __name__ == "__main__":
    run_training()
