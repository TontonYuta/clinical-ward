"""Optional server-side authentication for internal deployments.

Authentication is opt-in through AUTH_REQUIRED=true. Credentials are supplied
as PBKDF2 hashes in AUTH_USERS_JSON and never come from the browser bundle.
"""
import base64
import hashlib
import hmac
import json
import secrets
import time
import uuid
from dataclasses import dataclass

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

try:
    from argon2 import PasswordHasher, Type
    from argon2.exceptions import VerifyMismatchError, VerificationError
except ImportError:  # Optional until identity auth is enabled in deployment.
    PasswordHasher = Type = None
    VerifyMismatchError = VerificationError = Exception


@dataclass(frozen=True)
class AuthenticatedUser:
    username: str
    role: str
    account_id: str | None = None
    session_id: str | None = None


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def hash_password(password: str, *, salt: bytes | None = None, iterations: int = 310_000) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    if encoded.startswith("$argon2"):
        if PasswordHasher is None:
            return False
        try:
            return PasswordHasher().verify(encoded, password)
        except (VerifyMismatchError, VerificationError, ValueError, TypeError):
            return False
    try:
        algorithm, iteration_text, salt_text, digest_text = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        expected = _unb64(digest_text)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), _unb64(salt_text), int(iteration_text))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def hash_password_argon2(password: str) -> str:
    """Hash a staff password with Argon2id.

    This is deliberately separate from the legacy PBKDF2 helper so existing
    AUTH_USERS_JSON deployments remain compatible during migration.
    """
    if PasswordHasher is None:
        raise RuntimeError("argon2-cffi is required for identity authentication")
    return PasswordHasher(type=Type.ID).hash(password)


def issue_token(username: str, role: str, secret_key: str, ttl_seconds: int = 3600, session_id: str | None = None) -> str:
    payload = {"sub": username, "role": role, "exp": int(time.time()) + ttl_seconds, "jti": uuid.uuid4().hex}
    if session_id:
        payload["sid"] = session_id
    encoded = _b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
    signature = hmac.new(secret_key.encode(), encoded.encode(), hashlib.sha256).digest()
    return f"{encoded}.{_b64(signature)}"


def verify_token(token: str, secret_key: str) -> AuthenticatedUser | None:
    try:
        encoded, signature = token.split(".", 1)
        expected = hmac.new(secret_key.encode(), encoded.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_unb64(signature), expected):
            return None
        payload = json.loads(_unb64(encoded))
        if int(payload["exp"]) <= int(time.time()):
            return None
        return AuthenticatedUser(username=str(payload["sub"]), role=str(payload["role"]), session_id=payload.get("sid"))
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        return None


def require_authenticated(request: Request, secret_key: str) -> AuthenticatedUser:
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required", headers={"WWW-Authenticate": "Bearer"})
    user = verify_token(token, secret_key)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    return user


class AuthenticationMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, *, enabled: bool, secret_key: str, users_json: str, identity_store_enabled: bool = False, trusted_origins: list[str] | None = None):
        super().__init__(app)
        self.enabled = enabled
        self.secret_key = secret_key
        self.trusted_origins = {origin.rstrip("/") for origin in (trusted_origins or [])}
        try:
            users = json.loads(users_json)
            self.users = users if isinstance(users, dict) else {}
        except (ValueError, TypeError):
            self.users = {}
        self.identity_store_enabled = identity_store_enabled
        if enabled and (len(secret_key) < 32 or (not self.users and not identity_store_enabled)):
            raise RuntimeError("AUTH_REQUIRED needs a 32+ character SECRET_KEY and either identity storage or AUTH_USERS_JSON.")

    async def dispatch(self, request: Request, call_next):
        if not self.enabled or not request.url.path.startswith("/api/v1/"):
            if not self.enabled:
                request.state.authenticated_user = AuthenticatedUser(
                    username="test_director",
                    role="director"
                )
            return await call_next(request)
        if request.url.path == "/api/v1/auth/login":
            if request.method not in {"GET", "HEAD", "OPTIONS"}:
                origin = request.headers.get("origin")
                host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
                proto = request.headers.get("x-forwarded-proto", request.url.scheme).split(",", 1)[0].strip()
                same_origin = f"{proto}://{host}".rstrip("/") if host else ""
                if origin and origin.rstrip("/") not in self.trusted_origins | {same_origin}:
                    return JSONResponse({"detail": "Cross-origin request rejected"}, status_code=403)
            return await call_next(request)
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            origin = request.headers.get("origin")
            forwarded_host = request.headers.get("x-forwarded-host", request.headers.get("host", ""))
            forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme).split(",", 1)[0].strip()
            same_origin = f"{forwarded_proto}://{forwarded_host}".rstrip("/") if forwarded_host else ""
            if origin and origin.rstrip("/") not in self.trusted_origins | {same_origin}:
                return JSONResponse({"detail": "Cross-origin request rejected"}, status_code=403)
        public_auth_requests = {
            ("/api/v1/auth/me", "GET"),
            ("/api/v1/auth/me", "HEAD"),
            ("/api/v1/auth/me", "OPTIONS"),
            ("/api/v1/auth/logout", "POST"),
            ("/api/v1/auth/logout", "OPTIONS"),
        }
        # Public endpoints that do not require an authenticated clinical session:
        # - /api/v1/auth/me (GET): Allows frontend to check session status
        # - /api/v1/availability (GET/HEAD/OPTIONS): Service health and readiness metadata
        # - /api/v1/registry (GET/HEAD/OPTIONS): Public drug catalog and monograph search
        # - public_auth_requests: Login, logout, CSRF
        if (
            (request.url.path == "/api/v1/auth/me" and request.method == "GET")
            or (request.url.path == "/api/v1/availability" and request.method in {"GET", "HEAD", "OPTIONS"})
            or (request.url.path.startswith("/api/v1/registry") and request.method in {"GET", "HEAD", "OPTIONS"})
            or ((request.url.path, request.method) in public_auth_requests)
        ):
            return await call_next(request)
        token = request.cookies.get("clinical_session")
        header = request.headers.get("authorization", "")
        if header.lower().startswith("bearer "):
            token = header[7:].strip()
        user = verify_token(token or "", self.secret_key)
        if user is None:
            from app.config import settings
            if not settings.AUTH_REQUIRED:
                user = AuthenticatedUser(username="test_director", role="director")
            else:
                return JSONResponse({"detail": "Authentication required"}, status_code=401, headers={"WWW-Authenticate": "Bearer"})
        if self.identity_store_enabled:
            if not user.session_id:
                return JSONResponse({"detail": "Identity session required"}, status_code=401)
            try:
                from app.identity_database import get_identity_session_factory
                from app.services.identity_service import validate_identity_session
                _, factory = get_identity_session_factory()
                async with factory() as session:
                    is_valid = await validate_identity_session(session, token or "", user)
            except Exception:
                return JSONResponse({"detail": "Identity service unavailable"}, status_code=503)
            if not is_valid:
                return JSONResponse({"detail": "Identity session expired or revoked"}, status_code=401)
        if not self._role_allowed(request.method, request.url.path, user.role):
            return JSONResponse({"detail": "Role is not authorized for this operation"}, status_code=403)
        request.state.authenticated_user = user
        return await call_next(request)

    @staticmethod
    def _role_allowed(method: str, path: str, role: str) -> bool:
        suffix = path.removeprefix("/api/v1")
        if suffix.startswith("/admin"):
            return role == "director"
        if method in {"GET", "HEAD", "OPTIONS"}:
            if suffix.startswith("/patients") or suffix.startswith("/prescription-advice"):
                return role in {"doctor", "nurse"}
            if suffix.startswith("/audit"):
                return role in {"pharmacist", "director"}
            return True
        prefixes = {
            "/debts": {"nurse", "doctor", "pharmacist", "director"},
            "/equipment": {"nurse", "doctor", "biomedical_engineer", "director"},
            "/inventory": {"pharmacist", "director"},
            "/coldchain": {"pharmacist", "director"},
            "/assets": {"biomedical_engineer", "director"},
            "/cpoe": {"doctor"},
            "/patients": {"doctor", "nurse"},
            "/prescription-advice": {"doctor", "nurse"},
            "/sms": {"doctor", "nurse"},
            "/clinical-ddi": set(),
        }
        if suffix == "/auth/logout":
            return True
        if suffix.startswith("/auth/"):
            return False
        if suffix in {"/clinical-ddi/audit", "/clinical-ddi/check-pair", "/clinical-ddi/normalize"}:
            return role in {"nurse", "doctor", "pharmacist", "director"}
        if suffix in {"/copilot/chat", "/copilot/chat/stream", "/copilot/rag"}:
            return role in {"nurse", "doctor", "pharmacist", "director"}
        for prefix, allowed_roles in prefixes.items():
            if suffix == prefix or suffix.startswith(prefix + "/"):
                return role in allowed_roles
        return False
