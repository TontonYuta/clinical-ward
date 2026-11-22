"""
Medical Staff Password Policy & Complexity Engine.
Conforms to NIST SP 800-63B and OWASP ASVS v4.0 for healthcare information systems.
"""
import re
import unicodedata

# Common weak passwords blocked in medical environments
COMMON_WEAK_PASSWORDS = {
    "12345678", "123456789", "1234567890", "password", "password123", "password@123",
    "admin123", "admin@123", "administrator", "benhvien", "benhvien123", "hospital",
    "hospital123", "hospital2025", "hospital2026", "doctor123", "nurse123", "quantri123",
    "qwertyuiop", "asdfghjkl", "11111111", "00000000", "welcome123", "DoAn2@2025",
    "DoAn2@2026", "Yuta@2025", "Yuta@2026", "bacsicapcuu", "dieuduongca9"
}

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def _normalize_text(text: str) -> str:
    """Normalize vietnamese text to ascii lowercase alphanumeric."""
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKD", text).encode("ASCII", "ignore").decode("utf-8")
    return re.sub(r"[^a-zA-Z0-9]", "", normalized).lower()


def validate_password_complexity(
    password: str,
    username: str = "",
    full_name: str = ""
) -> tuple[bool, str]:
    """
    Validate that a proposed password meets healthcare enterprise security standards.

    Returns:
        (is_valid: bool, error_message: str)
    """
    if not password:
        return False, "Mật khẩu không được để trống."

    raw_len = len(password)
    if raw_len < MIN_PASSWORD_LENGTH:
        return False, f"Mật khẩu phải có tối thiểu {MIN_PASSWORD_LENGTH} ký tự."

    if raw_len > MAX_PASSWORD_LENGTH:
        return False, f"Mật khẩu không được vượt quá {MAX_PASSWORD_LENGTH} ký tự."

    # 1. Lowercase character check
    if not re.search(r"[a-z]", password):
        return False, "Mật khẩu phải chứa ít nhất 1 chữ cái viết thường (a-z)."

    # 2. Uppercase character check
    if not re.search(r"[A-Z]", password):
        return False, "Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa (A-Z)."

    # 3. Numeric digit check
    if not re.search(r"[0-9]", password):
        return False, "Mật khẩu phải chứa ít nhất 1 chữ số (0-9)."

    # 4. Special symbol check
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`'\"]", password):
        return False, "Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*...)."

    # 5. Denylist check
    lower_pwd = password.strip().lower()
    if lower_pwd in COMMON_WEAK_PASSWORDS:
        return False, "Mật khẩu quá phổ biến hoặc dễ đoán. Vui lòng chọn mật khẩu phức tạp hơn."

    # 6. Username substring check
    if username:
        norm_user = _normalize_text(username)
        if len(norm_user) >= 3 and norm_user in lower_pwd:
            return False, "Mật khẩu không được chứa tên đăng nhập của bạn."
        parts = [p for p in re.split(r"[_.\-]", username) if len(p) >= 3]
        for p in parts:
            norm_p = _normalize_text(p)
            if len(norm_p) >= 3 and norm_p in lower_pwd:
                return False, "Mật khẩu không được chứa tên đăng nhập của bạn."

    # 7. Name substring check
    if full_name:
        name_parts = full_name.split()
        for part in name_parts:
            norm_part = _normalize_text(part)
            if len(norm_part) >= 4 and norm_part in lower_pwd:
                return False, f"Mật khẩu không nên chứa tên riêng ('{part}')."

    return True, ""


def is_password_reused(
    new_password: str,
    current_password: str | None = None,
    current_hash: str | None = None,
    verify_func=None
) -> bool:
    """Check if the new password is identical to the current one."""
    if current_password and new_password == current_password:
        return True

    if current_hash and verify_func:
        try:
            if verify_func(new_password, current_hash):
                return True
        except Exception:
            pass

    return False
