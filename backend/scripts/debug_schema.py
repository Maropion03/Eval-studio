import sqlite3
import os
from pathlib import Path

# Path to DB
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "judge_opus.db"

print(f"📂 Database Path: {DB_PATH}")

if not DB_PATH.exists():
    print("❌ Database file not found!")
    exit(1)

def get_schema(cursor, table_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = cursor.fetchall()
    return [col[1] for col in columns]

try:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. List Tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print(f"\n📋 Tables found: {[t[0] for t in tables]}")

    # 2. Inspect Datasets
    print("\n🔍 Inspecting 'datasets' table:")
    if ('datasets',) in tables:
        cols = get_schema(cursor, 'datasets')
        print(f"   Columns: {cols}")
    else:
        print("   ❌ Table 'datasets' missing!")

    # 3. Inspect AppSettings
    print("\n🔍 Inspecting 'app_settings' table:")
    if ('app_settings',) in tables:
        cols = get_schema(cursor, 'app_settings')
        print(f"   Columns: {cols}")
    else:
        print("   ❌ Table 'app_settings' missing!")

    # 4. Try Dummy Insert (Datasets)
    print("\n🧪 Attempting dummy insert into 'datasets'...")
    try:
        cursor.execute("INSERT INTO datasets (id, name, item_count, status, raw_data, created_at) VALUES (?, ?, ?, ?, ?, ?)", 
                       ("test-id", "debug_test", 0, "ready", "[]", "2023-01-01 00:00:00"))
        print("   ✅ Insert successful (rolling back)")
        conn.rollback() 
    except Exception as e:
        print(f"   ❌ Insert failed: {e}")

    conn.close()

except Exception as e:
    print(f"\n❌ Error inspecting database: {e}")
