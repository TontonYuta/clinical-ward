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
from dataclasses import dataclass

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


@dataclass(frozen=True)
class AuthenticatedUser:
    username: str
    role: str


def audit_actor_fields(request: Request | None) -> dict[str, str]:
    """Attribute an operation to a server-authenticated account, never a UI claim.

    Account identity is not a medical practice certificate or a verified PIN /
    second signature. Local demonstration requests remain explicitly unverified.
    """
    user = getattr(request.state, "authenticated_user", None) if request else None
    if isinstance(user, AuthenticatedUser):
        return {
            "signer_name": user.username,
            "signer_certificate": f"account:{user.username}",
            "auth_method": "AUTHENTICATED_SESSION",
        }
    return {
        "signer_name": "Chưa xác thực danh tính",
        "signer_certificate": "UNVERIFIED",
        "auth_method": "UNVERIFIED_LOCAL",
    }


def _b64(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def hash_password(password: str, *, salt: bytes | None = None, iterations: int = 310_000) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iteration_text, salt_text, digest_text = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        expected = _unb64(digest_text)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), _unb64(salt_text), int(iteration_text))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def issue_token(username: str, role: str, secret_key: str, ttl_seconds: int = 3600) -> str:
    payload = {"sub": username, "role": role, "exp": int(time.time()) + ttl_seconds}
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
        return AuthenticatedUser(username=str(payload["sub"]), role=str(payload["role"]))
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
    def __init__(self, app, *, enabled: bool, secret_key: str, users_json: str, trusted_origins: list[str] | None = None):
        super().__init__(app)
        self.enabled = enabled
        self.secret_key = secret_key
        self.trusted_origins = {origin.rstrip("/") for origin in (trusted_origins or [])}
        try:
            users = json.loads(users_json)
            self.users = users if isinstance(users, dict) else {}
        except (ValueError, TypeError):
            self.users = {}
        if enabled and (len(secret_key) < 32 or not self.users):
            raise RuntimeError("AUTH_REQUIRED needs a 32+ character SECRET_KEY and non-empty AUTH_USERS_JSON.")

    async def dispatch(self, request: Request, call_next):
        if not self.enabled or not request.url.path.startswith("/api/v1/"):
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
        token = request.cookies.get("clinical_session")
        header = request.headers.get("authorization", "")
        if header.lower().startswith("bearer "):
            token = header[7:].strip()
        user = verify_token(token or "", self.secret_key)
        if user is None:
            return JSONResponse({"detail": "Authentication required"}, status_code=401, headers={"WWW-Authenticate": "Bearer"})
        if not self._role_allowed(request.method, request.url.path, user.role):
            return JSONResponse({"detail": "Role is not authorized for this operation"}, status_code=403)
        request.state.authenticated_user = user
        return await call_next(request)

    @staticmethod
    def _role_allowed(method: str, path: str, role: str) -> bool:
        if method in {"GET", "HEAD", "OPTIONS"}:
            suffix = path.removeprefix("/api/v1")
            if suffix.startswith("/patients") or suffix.startswith("/prescription-advice"):
                return role in {"doctor", "nurse", "pharmacist", "director"}
            if suffix.startswith("/audit"):
                return role in {"pharmacist", "director"}
            if suffix == "/cpoe" or suffix.startswith("/cpoe/") or suffix in {"/sms/logs", "/copilot/history"}:
                return role in {"nurse", "doctor", "pharmacist", "director"}
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
        suffix = path.removeprefix("/api/v1")
        if suffix == "/auth/logout":
            return True
        if suffix.startswith("/auth/"):
            return False
        if suffix in {"/clinical-ddi/audit", "/clinical-ddi/check-pair", "/clinical-ddi/normalize"}:
            return role in {"nurse", "doctor", "pharmacist", "director"}
        if suffix in {"/copilot/chat", "/copilot/rag"}:
            return role in {"nurse", "doctor", "pharmacist", "director"}
        if suffix in {"/prescriptions/audit", "/mcp", "/mcp/rpc", "/mcp/execute"}:
            return role in {"nurse", "doctor", "pharmacist", "director"}
        if suffix.startswith("/assets/") and suffix.endswith("/liquidate"):
            return role == "director"
        for prefix, allowed_roles in prefixes.items():
            if suffix == prefix or suffix.startswith(prefix + "/"):
                return role in allowed_roles
        return False
