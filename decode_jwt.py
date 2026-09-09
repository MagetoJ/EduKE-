import base64
import json

token = "rgxjQTcFOCVXGp.tv1hCPM.f2EeqKUGDBL1xJ76jLXw.SwPbwklizfPvG.TYMvdUgPbQrI8FmvLy3cVomAsHBw"

parts = token.strip().split(".")

print(f"JWT parts: {len(parts)}")

if len(parts) != 3:
    raise ValueError(
        f"Expected a JWT with 3 parts, but received {len(parts)}"
    )

header_b64, payload_b64, signature_b64 = parts

print(f"Header length: {len(header_b64)}")
print(f"Payload length: {len(payload_b64)}")
print(f"Signature length: {len(signature_b64)}")

payload_b64 += "=" * (-len(payload_b64) % 4)

try:
    payload_bytes = base64.urlsafe_b64decode(payload_b64)
    print("Decoded payload bytes:", payload_bytes[:20])

    data = json.loads(payload_bytes)

    print("\nJWT payload:")
    print(json.dumps(data, indent=2))

except Exception as e:
    print(f"\nPayload decoding failed: {type(e).__name__}: {e}")