"""
Inference Script: shop.db → order_predictions table
Loads trained model, scores unfulfilled orders (no shipment record), writes predictions back.
Run this from the project root: python pipeline/inference.py
"""

import sqlite3
import joblib
import pandas as pd
from datetime import datetime

DB_PATH = "../shop.db"
MODEL_PATH = "../late_delivery_model.sav"

FEATURE_COLS = [
    "num_items",
    "num_distinct_products",
    "avg_unit_price",
    "order_total",
    "customer_age",
    "customer_order_count",
]


def run_inference():
    # --- Load model ---
    model = joblib.load(MODEL_PATH)
    print("Model loaded.")

    # --- Load unfulfilled orders (no shipment record yet) ---
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
    print(f"Found {len(df_live)} unfulfilled orders to score.")

    if df_live.empty:
        print("No unfulfilled orders to score. Place a new order first via the web app.")
        conn.close()
        return 0

    # --- Aggregate order items for live orders ---
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

    # Merge item features
    df_live = df_live.merge(df_items, on="order_id", how="left")

    # --- Feature engineering (must match ETL logic) ---
    df_live["order_datetime"] = pd.to_datetime(df_live["order_datetime"])
    df_live["birthdate"] = pd.to_datetime(df_live["birthdate"])
    df_live["customer_age"] = (
        (df_live["order_datetime"] - df_live["birthdate"]).dt.days // 365
    )
    df_live["customer_order_count"] = (
        df_live.groupby("customer_id")["order_id"].transform("count")
    )

    # Fill missing item features for orders with no items yet
    df_live[["num_items", "num_distinct_products", "avg_unit_price"]] = (
        df_live[["num_items", "num_distinct_products", "avg_unit_price"]].fillna(0)
    )

    X_live = df_live[FEATURE_COLS]

    # --- Generate predictions ---
    df_live["late_delivery_probability"] = model.predict_proba(X_live)[:, 1]
    df_live["predicted_late_delivery"] = model.predict(X_live)

    # --- Write predictions back to operational DB ---
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
        (
            int(row.order_id),
            float(row.late_delivery_probability),
            int(row.predicted_late_delivery),
            timestamp,
        )
        for row in df_live.itertuples()
    ]

    cursor.executemany("""
    INSERT OR REPLACE INTO order_predictions
    (order_id, late_delivery_probability, predicted_late_delivery, prediction_timestamp)
    VALUES (?, ?, ?, ?)
    """, rows)

    conn.commit()
    conn.close()

    scored = len(rows)
    print(f"Scored {scored} orders. Predictions written to order_predictions table.")
    return scored


if __name__ == "__main__":
    run_inference()
