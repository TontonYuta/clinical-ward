"""Staff authentication HTTP endpoints."""
import json
import time
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.config import settings
from app.security.auth import verify_token
from app.services.auth_service import (
    authenticate_user, create_login_session, refresh_login_session, revoke_user_session, validate_user_session,
    AuthenticatedUser
)

router = APIRouter(prefix="/auth", tags=["Staff authentication"])

_LOGIN_CACHE: dict[str, tuple[float, dict]] = {}
_LOGIN_CACHE_TTL = 300.0  # 5 phút

DEMO_ROLES = {
    "bac_si_test": "doctor",
    "duoc_si_test": "pharmacist",
    "dieu_duong_test": "nurse",
    "director": "director"
}

class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=1, max_length=256)


@router.post("/login")
async def login(payload: LoginRequest, request: Request, response: Response):
    if not settings.AUTH_REQUIRED:
        raise HTTPException(status_code=404, detail="Đăng nhập bị tắt khi AUTH_REQUIRED=false")

    origin = request.headers.get("origin")
    trusted = {item.rstrip("/") for item in settings.CORS_ORIGINS} | {str(request.base_url).rstrip("/")}
    if origin and origin.rstrip("/") not in trusted:
        raise HTTPException(status_code=403, detail="Cross-origin request rejected")

    clean_user = (payload.username or "").strip()
    cache_key = f"{clean_user}:{payload.password}"
    now = time.time()
    if cache_key in _LOGIN_CACHE:
        c_time, c_data = _LOGIN_CACHE[cache_key]
        if now - c_time < _LOGIN_CACHE_TTL:
            _set_session_cookie(response, c_data["token"])
            return c_data

    user = await authenticate_user(payload.username, payload.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Tên đăng nhập hoặc mật khẩu không chính xác")
    token, _ = await create_login_session(user)
    _set_session_cookie(response, token)
    res_data = {"username": user.username, "role": user.role, "expires_in": settings.AUTH_TOKEN_TTL_SECONDS, "token": token}
    _LOGIN_CACHE[cache_key] = (now, res_data)
    return res_data


@router.get("/me")
async def auth_me(request: Request):
    if not settings.AUTH_REQUIRED:
        return {"enabled": False, "authenticated": True, "username": "local", "role": "nurse"}
    token = request.cookies.get("clinical_session", "")
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    user = verify_token(token, settings.SECRET_KEY) if token else None
    if not user or not await validate_user_session(user, token):
        return {"enabled": True, "authenticated": False, "username": None, "role": None}
    refreshed_token = await refresh_login_session(user, token)
    request.state.refreshed_auth_token = refreshed_token
    response = Response(content=json.dumps({
        "enabled": True, "authenticated": True, "username": user.username, "role": user.role,
    }), media_type="application/json")
    _set_session_cookie(response, refreshed_token)
    return response


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="clinical_session", value=token, httponly=True,
        secure=settings.APP_ENV.lower() in {"production", "prod"},
        samesite="lax", max_age=settings.AUTH_TOKEN_TTL_SECONDS, path="/",
    )


@router.post("/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("clinical_session", "")
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    await revoke_user_session(token)
    response.delete_cookie(
        "clinical_session", path="/", httponly=True,
        secure=settings.APP_ENV.lower() in {"production", "prod"}, samesite="lax",
    )
    return {"status": "logged_out"}
