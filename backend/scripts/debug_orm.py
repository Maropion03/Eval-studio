import sys
import os
from pathlib import Path

# Add backend directory to sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal, engine
from app.models.models import AppSettings, Dataset
from app.schemas.schemas import SettingsResponse, DatasetResponse

def test_settings():
    print("\n🧪 Testing Settings ORM...")
    db = SessionLocal()
    try:
        # Simulate get_settings logic
        row = db.query(AppSettings).filter(AppSettings.id == 1).first()
        if not row:
            print("   creating new settings row...")
            row = AppSettings(id=1)
            db.add(row)
            db.commit()
            db.refresh(row)
        
        print(f"   Settings Row: {row.__dict__}")
        
        # Test Pydantic Validation
        print("   Validating with Pydantic...")
        resp = SettingsResponse.model_validate(row)
        print(f"   ✅ Pydantic Validated: {resp}")
        
    except Exception as e:
        print(f"   ❌ Settings Failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

def test_dataset_insert():
    print("\n🧪 Testing Dataset ORM Insert...")
    db = SessionLocal()
    try:
        dataset = Dataset(
            name="debug_orm_test",
            item_count=1,
            raw_data=[{"q": "test"}],
            status="ready"
        )
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
        print(f"   Dataset created: {dataset.id}")
        
        # Pydantic
        resp = DatasetResponse.model_validate(dataset)
        print(f"   ✅ Pydantic Validated: {resp}")
        
        # Cleanup
        db.delete(dataset)
        db.commit()
        print("   Cleanup done.")
        
    except Exception as e:
        print(f"   ❌ Dataset Failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    print("🚀 Starting ORM Debug...")
    try:
        test_settings()
        test_dataset_insert()
    except Exception as e:
        print(f"Fatal: {e}")
