import base64
import pytest
from app.security.secret_encryption import decrypt_secret, encrypt_secret


def test_secret_encryption_round_trip_and_nonce_is_unique():
    key = base64.urlsafe_b64encode(b"k" * 32).decode()
    first = encrypt_secret("provider-secret", key)
    second = encrypt_secret("provider-secret", key)
    assert first != second
    assert decrypt_secret(first, key) == "provider-secret"
    assert decrypt_secret(second, key) == "provider-secret"
    assert "provider-secret" not in first


def test_secret_encryption_rejects_missing_or_wrong_key():
    with pytest.raises(RuntimeError, match="required"):
        encrypt_secret("x", None)
    key = base64.urlsafe_b64encode(b"k" * 32).decode()
    wrong = base64.urlsafe_b64encode(b"w" * 32).decode()
    payload = encrypt_secret("x", key)
    with pytest.raises(RuntimeError, match="decrypt"):
        decrypt_secret(payload, wrong)
