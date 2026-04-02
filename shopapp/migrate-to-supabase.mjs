/**
 * One-time migration: SQLite shop.db → Supabase (Postgres)
 * Run from shopapp/: node migrate-to-supabase.mjs
 */
import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "shop.db");

const SUPABASE_URL = "https://iaojqthilnpbcpefmwfc.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlhb2pxdGhpbG5wYmNwZWZtd2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NjY4MzQsImV4cCI6MjA4OTQ0MjgzNH0.9LtO3TvBGo3tlZ0tY8uNX-GLggXE2KXMInzD6pw6Deo";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const db = new Database(DB_PATH, { readonly: true });

async function insertBatch(table, rows, batchSize = 200) {
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows (skip)`);
    return;
  }
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      console.error(`  ERROR ${table} [${i}-${i + batch.length}]:`, error.message);
    } else {
      inserted += batch.length;
    }
    // Progress indicator for large tables
    if (rows.length > 500 && (i + batchSize) % 1000 === 0) {
      console.log(`    ... ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
    }
  }
  console.log(`  ${table}: ${inserted}/${rows.length} rows`);
}

async function main() {
  console.log("=== Migrating SQLite → Supabase ===\n");

  const tables = [
    "customers",
    "products",
    "orders",
    "order_items",
    "shipments",
    "product_reviews",
  ];

  for (const table of tables) {
    console.log(`${table}...`);
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    await insertBatch(table, rows);
  }

  // order_predictions (may not exist or have few rows)
  try {
    const preds = db.prepare("SELECT * FROM order_predictions").all();
    console.log("order_predictions...");
    await insertBatch("order_predictions", preds);
  } catch {
    console.log("order_predictions: table not found, skip");
  }

  console.log("\n=== Done ===");
  db.close();
}

main().catch(console.error);
