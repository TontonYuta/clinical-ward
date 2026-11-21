"""Admin Staff Management HTTP endpoints with direct SQLite persistence."""
import uuid
import re
import secrets
import unicodedata
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.security.auth import hash_password_argon2, hash_password
from app.services.audit_service import record_audit_event
from app.routers.auth import invalidate_login_cache
from app.schemas.staff import (
    StaffCreateRequest,
    StaffUpdateRequest,
    StaffStatusUpdateRequest,
    StaffResetPinRequest,
    StaffResetPasswordRequest,
    StaffResponse,
    StaffListResponse,
)

router = APIRouter(prefix="/admin/staff", tags=["Admin Staff Management"])


def _safe_hash_password(password: str) -> str:
    """Hash password using Argon2id with PBKDF2 fallback."""
    try:
        return hash_password_argon2(password)
    except Exception:
        return hash_password(password)


def _slugify_username(name: str, role: str) -> str:
    """Tự động sinh username gợi ý chuẩn y tế (không dấu, thường, tiền tố vai trò)."""
    normalized = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('utf-8')
    cleaned = re.sub(r'[^a-zA-Z0-9\s]', '', normalized).strip().lower()
    stop_words = {'bs', 'bsck', 'bscki', 'bsckii', 'ths', 'ts', 'pgs', 'gs', 'dd', 'ds', 'ks', 'cn'}
    parts = [p for p in cleaned.split() if p not in stop_words]
    prefix_map = {
        'doctor': 'bs',
        'nurse': 'dd',
        'pharmacist': 'ds',
        'biomedical_engineer': 'ks',
        'director': 'gd',
    }
    role_prefix = prefix_map.get(role, 'nv')
    if parts:
        return f"{role_prefix}_{parts[-1]}"
    return f"{role_prefix}_{uuid.uuid4().hex[:4]}"


@router.get("", response_model=StaffListResponse)
async def list_staff(
    search: Optional[str] = Query(None, description="Tìm kiếm họ tên, mã NV, CCHN, khoa phòng"),
    role: Optional[str] = Query(None, description="Lọc theo vai trò"),
    department: Optional[str] = Query(None, description="Lọc theo khoa phòng"),
    status_filter: Optional[str] = Query(None, alias="status", description="all | active | suspended"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách nhân viên từ CSDL kèm bộ lọc và phân trang."""
    # 1. Base query for counting stats
    total_q = await db.execute(select(func.count(User.id)))
    total_all = total_q.scalar() or 0

    active_q = await db.execute(select(func.count(User.id)).where(User.is_active.is_(True)))
    active_count = active_q.scalar() or 0
    suspended_count = total_all - active_count

    # 2. Filtered query
    stmt = select(User)

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.name).like(term),
                func.lower(User.id).like(term),
                func.lower(User.practice_certificate).like(term),
                func.lower(User.department).like(term),
                func.lower(User.role_name).like(term),
                func.lower(User.rfid_card_id).like(term),
            )
        )

    if role and role.strip() and role != "all":
        stmt = stmt.where(User.role == role.strip())

    if department and department.strip() and department != "all":
        stmt = stmt.where(User.department == department.strip())

    if status_filter == "active":
        stmt = stmt.where(User.is_active.is_(True))
    elif status_filter in ("suspended", "inactive"):
        stmt = stmt.where(User.is_active.is_(False))

    stmt = stmt.order_by(User.created_at.asc()).offset((page - 1) * pageSize).limit(pageSize)

    result = await db.execute(stmt)
    users = result.scalars().all()

    return StaffListResponse(
        total=total_all,
        active_count=active_count,
        suspended_count=suspended_count,
        items=[StaffResponse.model_validate(u) for u in users],
    )


@router.post("", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
async def create_staff(
    payload: StaffCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Thêm nhân viên mới trực tiếp vào cơ sở dữ liệu."""
    user_id = (payload.id or "").strip()
    if not user_id:
        # Tự sinh mã định danh duy nhất
        user_id = f"u-{uuid.uuid4().hex[:8]}"

    # Kiểm tra trùng ID
    existing = await db.get(User, user_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mã nhân viên '{user_id}' đã tồn tại trong hệ thống.",
        )

    # Kiểm tra trùng CCHN nếu có
    if payload.practice_certificate:
        cchn_check = await db.execute(
            select(User).where(User.practice_certificate == payload.practice_certificate.strip())
        )
        if cchn_check.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Số chứng chỉ hành nghề '{payload.practice_certificate}' đã được đăng ký cho nhân viên khác.",
            )

    # 1. Xử lý Tên đăng nhập (Username)
    username = (payload.username or "").strip().lower()
    if not username:
        base_username = _slugify_username(payload.name, payload.role)
        check_u = await db.execute(select(User).where(func.lower(User.username) == base_username))
        if check_u.scalar_one_or_none():
            username = f"{base_username}_{uuid.uuid4().hex[:4]}"
        else:
            username = base_username
    else:
        if not re.match(r"^[a-z0-9_.-]{3,50}$", username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tên đăng nhập không hợp lệ. Chỉ chấp nhận chữ cái thường không dấu, số, dấu gạch dưới (từ 3-50 ký tự).",
            )
        check_u = await db.execute(select(User).where(func.lower(User.username) == username))
        if check_u.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Tên đăng nhập '{username}' đã được sử dụng. Vui lòng chọn tên khác.",
            )

    # 2. Xử lý Mật khẩu khởi tạo
    raw_password = (payload.password or "").strip()
    if not raw_password:
        raw_password = f"MedSecure@{secrets.token_hex(3)}"
    elif len(raw_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu khởi tạo phải có độ dài tối thiểu 6 ký tự.",
        )
    hashed_pwd = _safe_hash_password(raw_password)

    new_user = User(
        id=user_id,
        role=payload.role.strip(),
        name=payload.name.strip(),
        role_name=payload.role_name.strip(),
        department=payload.department.strip(),
        practice_certificate=payload.practice_certificate.strip(),
        pin_code=payload.pin_code.strip(),
        rfid_card_id=payload.rfid_card_id.strip(),
        responsibilities=payload.responsibilities or "",
        email=payload.email.strip() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        dob=payload.dob.strip() if payload.dob else None,
        academic_title=payload.academic_title.strip() if payload.academic_title else None,
        username=username,
        hashed_password=hashed_pwd,
        must_change_password=payload.must_change_password,
        is_active=payload.is_active,
        avatar_url=payload.avatar_url,
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Ghi nhận nhật ký kiểm toán (Audit Trail)
    try:
        await record_audit_event(
            db=db,
            action_type="STAFF_ACCOUNT_CREATED",
            action_title=f"Khởi tạo tài khoản nhân viên {new_user.name} ({new_user.id})",
            target_item=new_user.id,
            legal_basis="Nghị định 13/2023/NĐ-CP & Quản lý nhân sự HIS",
            signer_name="Ban Giám Đốc",
            signer_certificate="001002/BYT-CCHN",
            auth_method="ADMIN_REGISTRATION",
            payload_data={
                "staff_id": new_user.id,
                "username": new_user.username,
                "role": new_user.role,
                "cchn": new_user.practice_certificate,
            }
        )
    except Exception:
        pass

    return StaffResponse.model_validate(new_user)


@router.get("/{user_id}", response_model=StaffResponse)
async def get_staff_detail(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Lấy chi tiết thông tin nhân viên theo ID."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên với mã này.")
    return StaffResponse.model_validate(user)


@router.put("/{user_id}", response_model=StaffResponse)
async def update_staff(
    user_id: str,
    payload: StaffUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật thông tin nhân viên trực tiếp vào cơ sở dữ liệu."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên cần cập nhật.")

    # 1. Kiểm tra username nếu có thay đổi
    if payload.username is not None:
        new_uname = payload.username.strip().lower()
        if new_uname and new_uname != (user.username or ""):
            if not re.match(r"^[a-z0-9_.-]{3,50}$", new_uname):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Tên đăng nhập không hợp lệ (từ 3-50 ký tự, không dấu).",
                )
            check_u = await db.execute(
                select(User).where(func.lower(User.username) == new_uname, User.id != user_id)
            )
            if check_u.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Tên đăng nhập '{new_uname}' đã được sử dụng bởi nhân viên khác.",
                )
            user.username = new_uname

    # 2. Kiểm tra mật khẩu nếu có nhập đổi mới
    if payload.password is not None and payload.password.strip():
        pwd = payload.password.strip()
        if len(pwd) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mật khẩu mới phải có tối thiểu 6 ký tự.",
            )
        user.hashed_password = _safe_hash_password(pwd)

    # 3. Cập nhật các trường còn lại
    update_data = payload.model_dump(exclude_unset=True, exclude={"username", "password"})
    for field, val in update_data.items():
        if val is not None and hasattr(user, field):
            setattr(user, field, val)

    user.updated_at = datetime.now()
    await db.commit()
    await db.refresh(user)
    if user.username:
        invalidate_login_cache(user.username)

    return StaffResponse.model_validate(user)


@router.patch("/{user_id}/reset-password")
async def reset_staff_password(
    user_id: str,
    payload: StaffResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Cấp lại mật khẩu đăng nhập Web cho nhân viên với nhật ký kiểm toán y tế."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên.")

    pwd = payload.new_password.strip()
    if len(pwd) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới phải có tối thiểu 6 ký tự.",
        )

    user.hashed_password = _safe_hash_password(pwd)
    user.must_change_password = payload.must_change_password
    user.updated_at = datetime.now()

    try:
        await record_audit_event(
            db=db,
            action_type="STAFF_PASSWORD_RESET",
            action_title=f"Quản trị viên cấp lại mật khẩu cho {user.name} ({user.id})",
            target_item=user.id,
            legal_basis="Nghị định 13/2023/NĐ-CP & Quy trình an toàn thông tin BYT",
            signer_name="Ban Giám Đốc",
            signer_certificate="001002/BYT-CCHN",
            auth_method="ADMIN_CREDENTIAL_OVERRIDE",
            payload_data={
                "staff_id": user.id,
                "username": user.username,
                "must_change_password": payload.must_change_password,
            }
        )
    except Exception:
        pass

    await db.commit()
    await db.refresh(user)
    if user.username:
        invalidate_login_cache(user.username)

    return {
        "status": "success",
        "user_id": user.id,
        "username": user.username,
        "must_change_password": user.must_change_password,
        "message": f"Đã cấp lại mật khẩu mới cho nhân sự {user.name} thành công.",
    }


@router.patch("/{user_id}/status")
async def toggle_staff_status(
    user_id: str,
    payload: StaffStatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Khóa hoặc Mở khóa tài khoản nhân viên."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên.")

    user.is_active = payload.is_active
    user.updated_at = datetime.now()
    await db.commit()
    if user.username:
        invalidate_login_cache(user.username)

    return {
        "status": "success",
        "id": user_id,
        "is_active": user.is_active,
        "message": "Đã kích hoạt hoạt động" if user.is_active else "Đã chuyển sang trạng thái Tạm ngưng",
    }


@router.patch("/{user_id}/reset-pin")
async def reset_staff_pin(
    user_id: str,
    payload: StaffResetPinRequest,
    db: AsyncSession = Depends(get_db),
):
    """Đặt lại mã PIN ca trực cho nhân viên."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên.")

    user.pin_code = payload.new_pin.strip()
    user.updated_at = datetime.now()
    await db.commit()

    return {"status": "pin_updated", "id": user_id, "message": "Đã cập nhật mã PIN mới thành công"}


@router.delete("/{user_id}")
async def soft_delete_staff(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Xóa an toàn nhân viên (Chuyển sang trạng thái Tạm ngưng để bảo toàn lịch sử ký đơn)."""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên cần xóa.")

    user.is_active = False
    user.updated_at = datetime.now()
    await db.commit()
    if user.username:
        invalidate_login_cache(user.username)

    return {
        "status": "suspended",
        "id": user_id,
        "message": f"Nhân viên {user.name} ({user_id}) đã được chuyển sang trạng thái Tạm ngưng công tác.",
    }
