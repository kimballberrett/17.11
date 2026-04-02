"""
Inference runner called by the Next.js /scoring API route.
Runs the inference pipeline with paths adjusted for the shopapp directory.
"""
import sys
import os
import sqlite3
import joblib
import pandas as pd
from datetime import datetime

# Paths resolved relative to this file's location (shopapp/jobs/)
SHOPAPP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(SHOPAPP_DIR)

DB_PATH = os.path.join(SHOPAPP_DIR, "shop.db")
MODEL_PATH = os.path.join(PROJECT_ROOT, "late_delivery_model.sav")

FEATURE_COLS = [
    "num_items",
    "num_distinct_products",
    "avg_unit_price",
    "order_total",
    "customer_age",
    "customer_order_count",
]


def run_inference():
    model = joblib.load(MODEL_PATH)

    conn = sqlite3.connect(DB_PATH)

    query = """
    SELECT
      o.order_id,
      o.order_total,
      o.order_datetime,
      c.birthdate,
      c.customer_id
    FROM orders o
    JOIN customers c ON o.customer_id = c.customer_id
    LEFT JOIN shipments s ON s.order_id = o.order_id
    WHERE s.shipment_id IS NULL
    """
    df_live = pd.read_sql(query, conn)

    if df_live.empty:
        print("No unfulfilled orders to score.")
        conn.close()
        print("SCORED:0")
        return

    order_ids = df_live["order_id"].tolist()
    placeholders = ",".join("?" * len(order_ids))
    items_query = f"""
    SELECT order_id, SUM(quantity) as num_items,
           COUNT(DISTINCT product_id) as num_distinct_products,
           AVG(unit_price) as avg_unit_price
    FROM order_items
    WHERE order_id IN ({placeholders})
    GROUP BY order_id
    """
    df_items = pd.read_sql(items_query, conn, params=order_ids)

    df_live = df_live.merge(df_items, on="order_id", how="left")

    df_live["order_datetime"] = pd.to_datetime(df_live["order_datetime"])
    df_live["birthdate"] = pd.to_datetime(df_live["birthdate"])
    df_live["customer_age"] = (
        (df_live["order_datetime"] - df_live["birthdate"]).dt.days // 365
    )
    df_live["customer_order_count"] = (
        df_live.groupby("customer_id")["order_id"].transform("count")
    )
    df_live[["num_items", "num_distinct_products", "avg_unit_price"]] = (
        df_live[["num_items", "num_distinct_products", "avg_unit_price"]].fillna(0)
    )

    X_live = df_live[FEATURE_COLS]
    df_live["late_delivery_probability"] = model.predict_proba(X_live)[:, 1]
    df_live["predicted_late_delivery"] = model.predict(X_live)

    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS order_predictions (
      order_id INTEGER PRIMARY KEY,
      late_delivery_probability REAL,
      predicted_late_delivery INTEGER,
      prediction_timestamp TEXT
    )
    """)

    timestamp = datetime.utcnow().isoformat()
    rows = [
        (int(r.order_id), float(r.late_delivery_probability),
         int(r.predicted_late_delivery), timestamp)
        for r in df_live.itertuples()
    ]
    cursor.executemany("""
    INSERT OR REPLACE INTO order_predictions
    (order_id, late_delivery_probability, predicted_late_delivery, prediction_timestamp)
    VALUES (?, ?, ?, ?)
    """, rows)

    conn.commit()
    conn.close()

    print(f"SCORED:{len(rows)}")


if __name__ == "__main__":
    run_inference()
