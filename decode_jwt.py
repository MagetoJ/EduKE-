import base64
import json
import os
import sys


def decode_jwt_payload(token: str) -> dict:
    parts = token.strip().split(".")

    if len(parts) != 3:
        raise ValueError(
            f"Expected a JWT with 3 parts, but received {len(parts)}"
        )

    _, payload_b64, _ = parts

    payload_b64 += "=" * (-len(payload_b64) % 4)

    try:
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
    except (ValueError, base64.binascii.Error) as exc:
        raise ValueError("JWT payload is not valid Base64URL") from exc

    try:
        data = json.loads(payload_bytes)
    except json.JSONDecodeError as exc:
        raise ValueError("JWT payload is not valid JSON") from exc

    if not isinstance(data, dict):
        raise ValueError("JWT payload must be a JSON object")

    return data


def main() -> None:
    token = os.getenv("JWT_TOKEN")

    if not token:
        print("Set JWT_TOKEN before running this script.")
        sys.exit(1)

    try:
        parts = token.strip().split(".")

        print(f"JWT parts: {len(parts)}")

        if len(parts) != 3:
            raise ValueError(
                f"Expected a JWT with 3 parts, but received {len(parts)}"
            )

        print(f"Header length: {len(parts[0])}")
        print(f"Payload length: {len(parts[1])}")
        print(f"Signature length: {len(parts[2])}")

        payload = decode_jwt_payload(token)

        print("\nJWT payload:")
        print(json.dumps(payload, indent=2))

    except ValueError as exc:
        print(f"\nJWT decoding failed: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
