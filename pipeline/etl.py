"""
ETL Pipeline: shop.db (operational) → warehouse.db (analytical)
Extracts, joins, engineers features, and loads a modeling table for late delivery prediction.
"""

import sqlite3
import pandas as pd

DB_PATH = "../shop.db"
WAREHOUSE_PATH = "../warehouse.db"


def run_etl():
    conn = sqlite3.connect(DB_PATH)

    # --- Extract ---
    orders = pd.read_sql("SELECT * FROM orders", conn)
    customers = pd.read_sql("SELECT * FROM customers", conn)
    order_items = pd.read_sql("SELECT * FROM order_items", conn)
    products = pd.read_sql("SELECT * FROM products", conn)
    shipments = pd.read_sql("SELECT * FROM shipments", conn)

    conn.close()
    print(f"Loaded: orders={orders.shape}, customers={customers.shape}, "
          f"order_items={order_items.shape}, products={products.shape}, "
          f"shipments={shipments.shape}")

    # --- Aggregate order items to one row per order ---
    item_features = (
        order_items
        .merge(products[["product_id", "price", "category"]], on="product_id", how="left")
        .groupby("order_id")
        .agg(
            num_items=("quantity", "sum"),
            num_distinct_products=("product_id", "nunique"),
            avg_unit_price=("unit_price", "mean"),
        )
        .reset_index()
    )

    # --- Join everything into one row per order ---
    df = (
        orders
        .merge(customers[["customer_id", "full_name", "birthdate", "customer_segment",
                           "loyalty_tier", "gender", "city", "state"]], on="customer_id", how="left")
        .merge(item_features, on="order_id", how="left")
        .merge(shipments[["order_id", "ship_datetime", "carrier", "shipping_method",
                           "distance_band", "promised_days", "actual_days", "late_delivery"]],
               on="order_id", how="inner")  # inner: only fulfilled orders have a label
    )

    print(f"Joined shape: {df.shape}")

    # --- Feature Engineering ---
    df["order_datetime"] = pd.to_datetime(df["order_datetime"])
    df["birthdate"] = pd.to_datetime(df["birthdate"])
    df["customer_age"] = (df["order_datetime"] - df["birthdate"]).dt.days // 365

    df["customer_order_count"] = (
        df.groupby("customer_id")["order_id"].transform("count")
    )

    # --- Select modeling columns ---
    # Exclude leaky columns: actual_days (used to derive late_delivery), ship_datetime
    feature_cols = [
        "num_items",
        "num_distinct_products",
        "avg_unit_price",
        "order_total",
        "customer_age",
        "customer_order_count",
    ]
    label_col = "late_delivery"

    keep_cols = ["order_id"] + feature_cols + [label_col]
    df_model = df[keep_cols].copy()
    df_model = df_model.dropna(subset=feature_cols)

    print(f"Modeling table shape: {df_model.shape}")
    print(f"Late delivery rate: {df_model[label_col].mean():.2%}")

    # --- Load into warehouse.db ---
    warehouse_conn = sqlite3.connect(WAREHOUSE_PATH)
    df_model.to_sql("fact_orders_ml", warehouse_conn, if_exists="replace", index=False)
    warehouse_conn.close()

    print(f"warehouse.db created with table: fact_orders_ml ({df_model.shape[0]} rows)")


if __name__ == "__main__":
    run_etl()
