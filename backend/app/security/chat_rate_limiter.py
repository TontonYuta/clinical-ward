"""Per-user and per-role rate limiting + daily quota guard for AI endpoints (OWASP LLM10 / FinOps)."""
from datetime import date
from threading import Lock
import time
from fastapi import HTTPException, Request


_CLINICAL_OR_ADMIN_ROLES = {"doctor", "pharmacist", "director", "admin", "bác sĩ", "dược sĩ", "giám đốc"}


class UserChatRateLimiter:
    """Thread-safe sliding-window (per minute) + daily cap rate limiter per user/IP."""

    def __init__(
        self,
        *,
        window_seconds: float = 60.0,
        standard_per_minute: int = 20,
        privileged_per_minute: int = 40,
        standard_per_day: int = 300,
        privileged_per_day: int = 600,
    ) -> None:
        self.window_seconds = window_seconds
        self.standard_per_minute = standard_per_minute
        self.privileged_per_minute = privileged_per_minute
        self.standard_per_day = standard_per_day
        self.privileged_per_day = privileged_per_day
        self._lock = Lock()
        self._minute_buckets: dict[str, list[float]] = {}
        self._daily_counts: dict[str, tuple[str, int]] = {}

    def _limits_for_role(self, user_role: str) -> tuple[int, int]:
        role_lower = (user_role or "").strip().lower()
        if role_lower in _CLINICAL_OR_ADMIN_ROLES:
            return self.privileged_per_minute, self.privileged_per_day
        return self.standard_per_minute, self.standard_per_day

    def check_and_consume(self, request: Request, user_name: str, user_role: str = "staff") -> None:
        """Enforce both short-window burst limit and daily spend-protection quota."""
        client_host = getattr(getattr(request, "client", None), "host", None) or "unknown"
        identity = (user_name or "anon").strip().lower()
        key = f"{client_host}:{identity}"
        per_minute_limit, per_day_limit = self._limits_for_role(user_role)
        now = time.monotonic()
        today = date.today().isoformat()

        with self._lock:
            # Prune expired buckets opportunistically to keep memory bounded.
            if len(self._minute_buckets) > 2000:
                stale_keys = [
                    k for k, timestamps in self._minute_buckets.items()
                    if not timestamps or (now - timestamps[-1]) >= self.window_seconds
                ]
                for sk in stale_keys:
                    self._minute_buckets.pop(sk, None)

            history = [ts for ts in self._minute_buckets.get(key, []) if now - ts < self.window_seconds]
            if len(history) >= per_minute_limit:
                self._minute_buckets[key] = history
                retry_after = max(1, int(self.window_seconds - (now - history[0])))
                raise HTTPException(
                    status_code=429,
                    detail=f"Bạn đang gửi yêu cầu quá nhanh ({per_minute_limit} lượt/phút). Vui lòng thử lại sau {retry_after} giây.",
                    headers={"Retry-After": str(retry_after)},
                )

            rec_day, rec_count = self._daily_counts.get(key, (today, 0))
            if rec_day != today:
                rec_count = 0
            if rec_count >= per_day_limit:
                raise HTTPException(
                    status_code=429,
                    detail=f"Tài khoản đã đạt hạn mức an toàn ngày ({per_day_limit} lượt/ngày). Vui lòng liên hệ quản trị viên nếu cần mở rộng.",
                    headers={"Retry-After": "3600"},
                )

            history.append(now)
            self._minute_buckets[key] = history
            self._daily_counts[key] = (today, rec_count + 1)

    def reset_all(self) -> None:
        with self._lock:
            self._minute_buckets.clear()
            self._daily_counts.clear()


chat_rate_limiter = UserChatRateLimiter()
