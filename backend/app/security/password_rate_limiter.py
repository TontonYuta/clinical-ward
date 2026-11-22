"""
Brute-Force & Credential Stuffing Rate Limiter for Password Changes.
Implements a time-window sliding block to protect healthcare staff credentials.
"""
import time
from threading import Lock

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 900  # 15 phút


class PasswordRateLimiter:
    def __init__(self, max_attempts: int = MAX_FAILED_ATTEMPTS, lockout_seconds: int = LOCKOUT_DURATION_SECONDS):
        self.max_attempts = max_attempts
        self.lockout_seconds = lockout_seconds
        self._failures: dict[str, list[float]] = {}
        self._lockouts: dict[str, float] = {}
        self._lock = Lock()

    def check_rate_limit(self, identifier: str) -> tuple[bool, int]:
        """
        Check if the identifier (e.g. username or username:ip) is currently locked out.
        Returns:
            (is_blocked: bool, remaining_lockout_seconds: int)
        """
        now = time.time()
        clean_key = identifier.strip().lower()

        with self._lock:
            # Check active lockout
            locked_until = self._lockouts.get(clean_key)
            if locked_until is not None:
                if now < locked_until:
                    remaining = int(locked_until - now)
                    return True, max(1, remaining)
                else:
                    # Lockout expired, clear lockout
                    del self._lockouts[clean_key]
                    self._failures.pop(clean_key, None)

            return False, 0

    def record_failure(self, identifier: str) -> int:
        """
        Record a failed attempt. If threshold exceeded, engage lockout.
        Returns the number of recent failures.
        """
        now = time.time()
        clean_key = identifier.strip().lower()

        with self._lock:
            attempts = self._failures.get(clean_key, [])
            # Prune attempts older than lockout window
            attempts = [t for t in attempts if now - t < self.lockout_seconds]
            attempts.append(now)
            self._failures[clean_key] = attempts

            if len(attempts) >= self.max_attempts:
                self._lockouts[clean_key] = now + self.lockout_seconds
                self._failures.pop(clean_key, None)
                return self.max_attempts

            return len(attempts)

    def record_success(self, identifier: str) -> None:
        """Reset failed attempt counters on a successful operation."""
        clean_key = identifier.strip().lower()
        with self._lock:
            self._failures.pop(clean_key, None)
            self._lockouts.pop(clean_key, None)

    def reset_all(self) -> None:
        """Clear all tracking state (used in testing)."""
        with self._lock:
            self._failures.clear()
            self._lockouts.clear()


# Global singleton instance
password_rate_limiter = PasswordRateLimiter()
