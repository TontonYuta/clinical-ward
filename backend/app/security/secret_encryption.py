"""Application-layer encryption for provider secrets."""
import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag


def _decode_key(encoded_key: str | None) -> bytes:
    value = (encoded_key or "").strip()
    if not value:
        raise RuntimeError("KEY_ENCRYPTION_KEY is required for provider secret storage.")
    try:
        key = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
    except (ValueError, TypeError) as exc:
        raise RuntimeError("KEY_ENCRYPTION_KEY must be URL-safe base64.") from exc
    if len(key) not in {16, 24, 32}:
        raise RuntimeError("KEY_ENCRYPTION_KEY must decode to 16, 24 or 32 bytes.")
    return key


def encrypt_secret(secret: str, encoded_key: str | None) -> str:
    if not secret:
        raise ValueError("Secret cannot be empty.")
    nonce = os.urandom(12)
    ciphertext = AESGCM(_decode_key(encoded_key)).encrypt(nonce, secret.encode("utf-8"), None)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")


def decrypt_secret(payload: str, encoded_key: str | None) -> str:
    try:
        raw = base64.urlsafe_b64decode((payload or "") + "=" * (-len(payload or "") % 4))
        if len(raw) <= 12:
            raise ValueError("Encrypted payload is invalid.")
        plaintext = AESGCM(_decode_key(encoded_key)).decrypt(raw[:12], raw[12:], None)
        return plaintext.decode("utf-8")
    except (ValueError, TypeError, UnicodeDecodeError, InvalidTag) as exc:
        raise RuntimeError("Unable to decrypt provider secret.") from exc
