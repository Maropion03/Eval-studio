
import requests
import sys

try:
    base = "http://localhost:8000/api/datasets"
    
    # Request A
    print("Requesting Session A...")
    r1 = requests.get(base, headers={"x-session-id": "11111111-aaaa-bbbb-cccc-dddddddddddd"})
    r1.raise_for_status()
    data1 = r1.json()
    if not data1:
        print("FAILURE: Session A returned no data")
        sys.exit(1)
    id1 = data1[0]["id"]
    print(f"Session A Dataset ID: {id1}")

    # Request B
    print("Requesting Session B...")
    r2 = requests.get(base, headers={"x-session-id": "22222222-aaaa-bbbb-cccc-dddddddddddd"})
    r2.raise_for_status()
    data2 = r2.json()
    if not data2:
        print("FAILURE: Session B returned no data")
        sys.exit(1)
    id2 = data2[0]["id"]
    print(f"Session B Dataset ID: {id2}")

    if id1 != id2:
        print("SUCCESS: Session isolation verified!")
        # Also verify ID pattern
        if "11111111" in id1 and "22222222" in id2: # Check prefix match
             print("SUCCESS: ID patterns match session prefixes")
    else:
        print("FAILURE: IDs are identical!")
        sys.exit(1)

except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
