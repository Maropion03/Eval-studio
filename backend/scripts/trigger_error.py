import urllib.request
import urllib.error
import json

URL = "http://localhost:8000/api/settings"

print(f"🚀 Hitting {URL}...")

try:
    with urllib.request.urlopen(URL) as response:
        print(f"✅ Success: {response.status}")
        print(response.read().decode())
except urllib.error.HTTPError as e:
    print(f"❌ HTTP Error: {e.code}")
    print(e.read().decode())
except Exception as e:
    print(f"❌ Error: {e}")
