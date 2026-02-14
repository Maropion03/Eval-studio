import sys
import os
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))
try:
    from app.main import app
    print("✅ Import successful")
except Exception as e:
    print(f"❌ Import failed: {e}")
    import traceback
    traceback.print_exc()
