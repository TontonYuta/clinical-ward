"""
Provider-reported token telemetry and cost ledger.
"""
import os
import sqlite3
import time
from contextlib import contextmanager
from typing import Optional, Tuple
from datetime import datetime

_DEFAULT_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/telemetry_ledger.db"))

def resolve_telemetry_db_path(environ=None) -> str:
    """Resolve a configurable SQLite path for deployments with persistent storage."""
    env = os.environ if environ is None else environ
    configured_path = (env.get("TELEMETRY_DB_PATH") or "").strip()
    return os.path.abspath(configured_path) if configured_path else _DEFAULT_DB_PATH

_DB_PATH = resolve_telemetry_db_path()

@contextmanager
def _get_connection():
    os.makedirs(os.path.dirname(_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(_DB_PATH, timeout=10.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA cache_size = -500;")
        yield conn
    finally:
        conn.close()

def init_telemetry_db() -> None:
    """Khởi tạo bảng lưu trữ vết token thực tế."""
    with _get_connection() as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS token_ledger (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL,
                date_str TEXT NOT NULL,
                month_str TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                prompt_tokens INTEGER NOT NULL,
                completion_tokens INTEGER NOT NULL,
                total_tokens INTEGER NOT NULL,
                cost_vnd REAL NOT NULL,
                usage_source TEXT NOT NULL DEFAULT 'provider'
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ledger_date ON token_ledger(date_str)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ledger_month ON token_ledger(month_str)")
        cols = {row[1] for row in conn.execute("PRAGMA table_info(token_ledger)").fetchall()}
        if "usage_source" not in cols:
            conn.execute("ALTER TABLE token_ledger ADD COLUMN usage_source TEXT NOT NULL DEFAULT 'provider'")
        if "cached_tokens" not in cols:
            conn.execute("ALTER TABLE token_ledger ADD COLUMN cached_tokens INTEGER NOT NULL DEFAULT 0")

        # Bảng sổ cái truy vấn Web Search (Serper / DuckDuckGo)
        conn.execute("""
        CREATE TABLE IF NOT EXISTS search_ledger (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL,
                date_str TEXT NOT NULL,
                month_str TEXT NOT NULL,
                provider TEXT NOT NULL,
                query TEXT NOT NULL,
                credits INTEGER NOT NULL DEFAULT 1,
                cost_vnd REAL NOT NULL DEFAULT 0.0,
                latency_ms REAL NOT NULL DEFAULT 0.0,
                status TEXT NOT NULL DEFAULT 'success'
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_search_ledger_date ON search_ledger(date_str)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_search_ledger_month ON search_ledger(month_str)")
        conn.commit()

init_telemetry_db()

def record_llm_token_usage(
    prompt_tokens: int,
    completion_tokens: int,
    model: str = "gemini-auto",
    provider: str = "gemini",
    usage_source: str = "provider",
    cached_tokens: int = 0,
) -> float:
    """
    Store token counts only when supplied by provider metadata. Cost uses configured
    historical rate assumptions and exchange rate, not an invoice total:
    - Fresh Input: $0.075 / 1M tokens
    - Cached Input: $0.01875 / 1M tokens (75% savings via Context Caching)
    - Output: $0.30 / 1M tokens
    """
    # Cost ledger is a billing record; estimated token counts belong in request
    # telemetry and must never be converted into a provider charge.
    if usage_source != "provider":
        return 0.0

    now = time.time()
    dt = datetime.fromtimestamp(now)
    date_str = dt.strftime("%Y-%m-%d")
    month_str = dt.strftime("%Y-%m")

    p_tok = max(0, int(prompt_tokens))
    c_tok = max(0, int(completion_tokens))
    cd_tok = max(0, min(p_tok, int(cached_tokens)))
    fresh_p_tok = max(0, p_tok - cd_tok)
    total = p_tok + c_tok

    # Estimate cost from configured rate assumptions with 75% Context Caching discount.
    input_usd = (fresh_p_tok / 1_000_000) * 0.075 + (cd_tok / 1_000_000) * 0.01875
    output_usd = (c_tok / 1_000_000) * 0.30
    cost_vnd = round((input_usd + output_usd) * 25500.0, 2)

    try:
        with _get_connection() as conn:
            conn.execute("""
                INSERT INTO token_ledger (
                    timestamp, date_str, month_str, provider, model,
                    prompt_tokens, completion_tokens, total_tokens, cost_vnd, usage_source, cached_tokens
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (now, date_str, month_str, provider, model, p_tok, c_tok, total, cost_vnd, usage_source, cd_tok))
            conn.commit()
    except Exception:
        pass

    return cost_vnd

def get_daily_token_usage(date_str: Optional[str] = None) -> Tuple[int, float]:
    """Trả về (total_tokens, total_cost_vnd) trong ngày."""
    target_date = date_str or datetime.now().strftime("%Y-%m-%d")
    try:
        with _get_connection() as conn:
            cur = conn.execute("""
                SELECT COALESCE(SUM(total_tokens), 0) as tok, COALESCE(SUM(cost_vnd), 0.0) as cost
                FROM token_ledger WHERE date_str = ? AND usage_source = 'provider'
            """, (target_date,))
            row = cur.fetchone()
            if row:
                return int(row["tok"]), float(row["cost"])
    except Exception:
        pass
    return 0, 0.0

def get_monthly_token_usage(month_str: Optional[str] = None) -> Tuple[int, float]:
    """Trả về (total_tokens, total_cost_vnd) trong tháng."""
    target_month = month_str or datetime.now().strftime("%Y-%m")
    try:
        with _get_connection() as conn:
            cur = conn.execute("""
                SELECT COALESCE(SUM(total_tokens), 0) as tok, COALESCE(SUM(cost_vnd), 0.0) as cost
                FROM token_ledger WHERE month_str = ? AND usage_source = 'provider'
            """, (target_month,))
            row = cur.fetchone()
            if row:
                return int(row["tok"]), float(row["cost"])
    except Exception:
        pass
    return 0, 0.0

def get_all_time_token_usage() -> Tuple[int, int, int, float]:
    """Trả về (prompt_tokens, completion_tokens, total_tokens, cost_vnd) toàn thời gian."""
    try:
        with _get_connection() as conn:
            cur = conn.execute("""
                SELECT 
                    COALESCE(SUM(prompt_tokens), 0) as p_tok,
                    COALESCE(SUM(completion_tokens), 0) as c_tok,
                    COALESCE(SUM(total_tokens), 0) as t_tok,
                    COALESCE(SUM(cost_vnd), 0.0) as cost
                FROM token_ledger WHERE usage_source = 'provider'
            """)
            row = cur.fetchone()
            if row:
                return int(row["p_tok"]), int(row["c_tok"]), int(row["t_tok"]), float(row["cost"])
    except Exception:
        pass
    return 0, 0, 0, 0.0

def get_last_7_days_token_trend() -> list:
    """Trả về xu hướng tiêu thụ token thực tế của 7 ngày gần nhất (không dùng dữ liệu mẫu)."""
    import datetime as dt_mod
    results = []
    weekday_map = {0: "T2", 1: "T3", 2: "T4", 3: "T5", 4: "T6", 5: "T7", 6: "CN"}
    today = dt_mod.date.today()

    try:
        with _get_connection() as conn:
            for i in range(6, -1, -1):
                d = today - dt_mod.timedelta(days=i)
                d_str = d.strftime("%Y-%m-%d")
                w_label = weekday_map.get(d.weekday(), "T?")

                cur = conn.execute("SELECT COALESCE(SUM(total_tokens), 0) as tok FROM token_ledger WHERE date_str = ? AND usage_source = 'provider'", (d_str,))
                row = cur.fetchone()
                tok = int(row["tok"]) if row else 0
                results.append({
                    "day": w_label,
                    "date": d.strftime("%d/%m"),
                    "consumed_k": round(tok / 1000, 2),
                    "saved_k": round((tok * 2.4) / 1000, 2) if tok > 0 else 0.0
                })
    except Exception:
        pass
    return results


def record_search_query_usage(
    provider: str = "serper",
    query: str = "",
    credits: int = 1,
    cost_vnd: float = 25.5,
    latency_ms: float = 0.0,
    status: str = "success"
) -> float:
    """
    Ghi nhận lượt gọi tìm kiếm Web (Serper.dev hoặc Fallback Engine) vào Sổ cái Truy vấn Web.
    Serper định mức ~0.001 USD/query (~25.5 VNĐ/query).
    """
    now = time.time()
    dt = datetime.fromtimestamp(now)
    date_str = dt.strftime("%Y-%m-%d")
    month_str = dt.strftime("%Y-%m")

    try:
        with _get_connection() as conn:
            conn.execute("""
                INSERT INTO search_ledger (
                    timestamp, date_str, month_str, provider, query,
                    credits, cost_vnd, latency_ms, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (now, date_str, month_str, provider, query[:500], max(1, credits), cost_vnd, latency_ms, status))
            conn.commit()
    except Exception:
        pass

    return cost_vnd


def get_daily_search_query_usage(date_str: Optional[str] = None) -> Tuple[int, float]:
    """Trả về (total_search_queries, total_search_cost_vnd) trong ngày."""
    target_date = date_str or datetime.now().strftime("%Y-%m-%d")
    try:
        with _get_connection() as conn:
            cur = conn.execute("""
                SELECT COALESCE(SUM(credits), 0) as q_cnt, COALESCE(SUM(cost_vnd), 0.0) as cost
                FROM search_ledger WHERE date_str = ? AND status = 'success'
            """, (target_date,))
            row = cur.fetchone()
            if row:
                return int(row["q_cnt"]), float(row["cost"])
    except Exception:
        pass
    return 0, 0.0


def get_monthly_search_query_usage(month_str: Optional[str] = None) -> Tuple[int, float]:
    """Trả về (total_search_queries, total_search_cost_vnd) trong tháng."""
    target_month = month_str or datetime.now().strftime("%Y-%m")
    try:
        with _get_connection() as conn:
            cur = conn.execute("""
                SELECT COALESCE(SUM(credits), 0) as q_cnt, COALESCE(SUM(cost_vnd), 0.0) as cost
                FROM search_ledger WHERE month_str = ? AND status = 'success'
            """, (target_month,))
            row = cur.fetchone()
            if row:
                return int(row["q_cnt"]), float(row["cost"])
    except Exception:
        pass
    return 0, 0.0


def get_all_time_search_query_usage() -> Tuple[int, float]:
    """Trả về (total_search_queries, total_cost_vnd) toàn thời gian."""
    try:
        with _get_connection() as conn:
            cur = conn.execute("""
                SELECT COALESCE(SUM(credits), 0) as q_cnt, COALESCE(SUM(cost_vnd), 0.0) as cost
                FROM search_ledger WHERE status = 'success'
            """)
            row = cur.fetchone()
            if row:
                return int(row["q_cnt"]), float(row["cost"])
    except Exception:
        pass
    return 0, 0.0


def get_avg_search_latency(date_str: Optional[str] = None) -> float:
    """Trả về độ trễ trung bình của các truy vấn Serper (ms)."""
    target_date = date_str or datetime.now().strftime("%Y-%m-%d")
    try:
        with _get_connection() as conn:
            cur = conn.execute("""
                SELECT AVG(latency_ms) as avg_lat
                FROM search_ledger WHERE date_str = ? AND status = 'success' AND latency_ms > 0
            """, (target_date,))
            row = cur.fetchone()
            if row and row["avg_lat"] is not None:
                return round(float(row["avg_lat"]), 1)
    except Exception:
        pass
    return 0.0

