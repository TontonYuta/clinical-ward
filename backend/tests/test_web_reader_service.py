import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.services.chatbot.web_reader_service import (
    _is_public_http_url,
    extract_readable_paragraphs,
    fetch_web_reader_content,
)


def test_ssrf_guard_blocks_private_and_non_http_urls():
    assert _is_public_http_url("file:///etc/passwd")[0] is False
    assert _is_public_http_url("http://127.0.0.1:8000/health")[0] is False
    assert _is_public_http_url("http://localhost/admin")[0] is False
    assert _is_public_http_url("http://192.168.1.1/")[0] is False


def test_extract_readable_paragraphs_strips_scripts_and_keeps_medical_text():
    sample_html = """
    <html>
      <head><title>KDIGO 2024 CKD Guideline</title><script>alert(1)</script></head>
      <body>
        <nav>Home | About</nav>
        <p>KDIGO 2024 recommends treating patients with CKD and eGFR >= 20 mL/min/1.73 m2 with an SGLT2 inhibitor.</p>
        <p>Once initiated, the SGLT2 inhibitor can be continued even if eGFR falls below 20 mL/min/1.73 m2.</p>
        <footer>Copyright 2024</footer>
      </body>
    </html>
    """
    title, paragraphs = extract_readable_paragraphs(sample_html)
    assert title == "KDIGO 2024 CKD Guideline"
    assert len(paragraphs) == 2
    assert "eGFR >= 20 mL/min/1.73 m2" in paragraphs[0]
    assert "alert(1)" not in " ".join(paragraphs)


def test_bot_challenge_patterns_cover_slideshare_and_cloudflare():
    from app.services.chatbot.web_reader_service import _BOT_CHALLENGE_PATTERNS

    sample = "Client Challenge: A required part of this site couldn't load.".lower()
    assert any(pat in sample for pat in _BOT_CHALLENGE_PATTERNS)


def test_extract_rich_article_blocks_preserves_images_tables_and_lists():
    from app.services.chatbot.web_reader_service import extract_readable_article

    rich_html = """
    <html>
      <head><title>Empagliflozin ADA 2025</title></head>
      <body>
        <article>
          <h2>1. Bảng liều SGLT2i</h2>
          <p>Empagliflozin được khuyến cáo cho bệnh nhân bệnh thận mạn có eGFR từ 20 mL/min/1.73 m2 trở lên.</p>
          <figure>
            <img src="/uploads/chart-sglt2.png" alt="Biểu đồ SGLT2i" width="600" height="400" />
            <figcaption>Hình 1: Hiệu quả bảo vệ thận của Empagliflozin</figcaption>
          </figure>
          <img src="/images/site-logo.png" alt="Logo" width="32" height="32" />
          <table>
            <tr><th>Thuốc</th><th>Liều khởi đầu</th></tr>
            <tr><td>Empagliflozin</td><td>10 mg/ngày</td></tr>
          </table>
          <ul>
            <li>Theo dõi eGFR định kỳ sau khởi trị</li>
            <li>Tạm ngưng khi mất nước nặng</li>
          </ul>
        </article>
      </body>
    </html>
    """
    title, blocks, paragraphs = extract_readable_article(rich_html, base_url="https://timmachhoc.vn/article/1")
    assert title == "Empagliflozin ADA 2025"
    types = [b["type"] for b in blocks]
    assert "heading" in types
    assert "image" in types
    assert "table" in types
    assert "list" in types
    img_blocks = [b for b in blocks if b["type"] == "image"]
    assert len(img_blocks) == 1
    assert img_blocks[0]["src"] == "https://timmachhoc.vn/uploads/chart-sglt2.png"
    assert "Hình 1" in img_blocks[0]["caption"]
    tbl = next(b for b in blocks if b["type"] == "table")
    assert tbl["headers"] == ["Thuốc", "Liều khởi đầu"]
    assert tbl["rows"] == [["Empagliflozin", "10 mg/ngày"]]
    assert len(paragraphs) >= 3


@pytest.mark.asyncio
async def test_web_reader_blocks_localhost_and_requires_auth():
    blocked = await fetch_web_reader_content("http://127.0.0.1:8000/health")
    assert blocked["status"] == "blocked"
    assert blocked["paragraphs"] == []

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/copilot/web-reader", params={"url": "https://example.com"})
    assert res.status_code in (200, 401)
