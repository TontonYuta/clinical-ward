"""Staff authentication HTTP endpoints."""
import json
import time
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.security.auth import verify_token
from app.services.auth_service import (
    authenticate_user, create_login_session, refresh_login_session, revoke_user_session, validate_user_session,
    get_user_profile_data, AuthenticatedUser
)

router = APIRouter(prefix="/auth", tags=["Staff authentication"])

_LOGIN_CACHE: dict[str, tuple[float, dict]] = {}
_LOGIN_CACHE_TTL = 300.0  # 5 phút

def invalidate_login_cache(username: str | None = None) -> None:
    """Xóa bộ nhớ đệm đăng nhập khi đổi mật khẩu hoặc đổi trạng thái nhân sự."""
    global _LOGIN_CACHE
    if username is None:
        _LOGIN_CACHE.clear()
    else:
        prefix = f"{username.strip().lower()}:"
        _LOGIN_CACHE = {k: v for k, v in _LOGIN_CACHE.items() if not k.lower().startswith(prefix)}

DEMO_ROLES = {
    "admin": "director",
    "director": "director",
    "bac_si_test": "doctor",
    "duoc_si_test": "pharmacist",
    "dieu_duong_test": "nurse"
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
    profile = await get_user_profile_data(user.username)
    res_data = {
        "username": user.username,
        "role": user.role,
        "name": profile.get("name") or user.name or user.username,
        "role_name": profile.get("role_name") or user.role_name or ("Bác Sĩ Điều Trị" if user.role == "doctor" else "Điều Dưỡng Ca Trực"),
        "department": profile.get("department") or user.department or "Khoa Lâm Sàng",
        "practice_certificate": profile.get("practice_certificate") or user.practice_certificate or "000000/BYT-CCHN",
        "pin_code": profile.get("pin_code") or user.pin_code or "1234",
        "rfid_card_id": profile.get("rfid_card_id") or user.rfid_card_id or "RFID-STAFF",
        "academic_title": profile.get("academic_title") or user.academic_title,
        "avatar_url": profile.get("avatar_url") or user.avatar_url,
        "email": profile.get("email") or user.email,
        "phone": profile.get("phone") or user.phone,
        "dob": profile.get("dob") or user.dob,
        "responsibilities": profile.get("responsibilities") or user.responsibilities or "",
        "must_change_password": profile.get("must_change_password") if profile.get("must_change_password") is not None else user.must_change_password,
        "expires_in": settings.AUTH_TOKEN_TTL_SECONDS,
        "token": token,
    }
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
    profile = await get_user_profile_data(user.username)
    payload_data = {
        "enabled": True,
        "authenticated": True,
        "username": user.username,
        "role": user.role,
        "name": profile.get("name") or user.name or user.username,
        "role_name": profile.get("role_name") or user.role_name or ("Bác Sĩ Điều Trị" if user.role == "doctor" else "Điều Dưỡng Ca Trực"),
        "department": profile.get("department") or user.department or "Khoa Lâm Sàng",
        "practice_certificate": profile.get("practice_certificate") or user.practice_certificate or "000000/BYT-CCHN",
        "pin_code": profile.get("pin_code") or user.pin_code or "1234",
        "rfid_card_id": profile.get("rfid_card_id") or user.rfid_card_id or "RFID-STAFF",
        "academic_title": profile.get("academic_title") or user.academic_title,
        "avatar_url": profile.get("avatar_url") or user.avatar_url,
        "email": profile.get("email") or user.email,
        "phone": profile.get("phone") or user.phone,
        "dob": profile.get("dob") or user.dob,
        "responsibilities": profile.get("responsibilities") or user.responsibilities or "",
        "must_change_password": profile.get("must_change_password") if profile.get("must_change_password") is not None else user.must_change_password,
    }
    response = Response(content=json.dumps(payload_data, ensure_ascii=False), media_type="application/json")
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


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)


@router.post("/change-password")
async def change_password_endpoint(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Đổi mật khẩu tài khoản cá nhân với các lớp phòng thủ đa tầng."""
    token = request.cookies.get("clinical_session", "")
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    user = verify_token(token, settings.SECRET_KEY) if token else None
    if not user or not await validate_user_session(user, token):
        raise HTTPException(status_code=401, detail="Phiên làm việc đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.")

    from app.services.staff_password_service import change_staff_password
    client_ip = request.client.host if request.client else "127.0.0.1"

    result = await change_staff_password(
        db=db,
        authenticated_user=user,
        current_password=payload.current_password,
        new_password=payload.new_password,
        confirm_password=payload.confirm_password,
        client_ip=client_ip,
    )

    if "token" in result:
        _set_session_cookie(response, result["token"])

    return result

