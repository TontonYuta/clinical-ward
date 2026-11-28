"""Lightweight, SSRF-safe Rich Web Reader service (zero external HTML parser deps)."""
from __future__ import annotations

import html
import ipaddress
import re
import socket
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx

_MAX_HTML_BYTES = 512 * 1024
_MAX_BLOCKS = 140
_SKIP_TAGS = {"script", "style", "noscript", "svg", "nav", "footer", "header", "aside", "iframe", "form"}
_BOT_CHALLENGE_PATTERNS = (
    "client challenge",
    "just a moment",
    "checking your browser",
    "verify you are human",
    "enable javascript and cookies",
    "a required part of this site couldn't load",
    "access denied",
    "attention required! | cloudflare",
    "please enable cookies",
)
_NOISE_IMAGE_HINTS = (
    "logo",
    "favicon",
    "avatar",
    "icon",
    "sprite",
    "pixel",
    "tracker",
    "badge",
    "share-",
    "facebook",
    "twitter",
    "zalo",
    "linkedin",
    "/ads/",
    "advert",
    "banner-ad",
)


def _clean_text(parts: list[str]) -> str:
    return re.sub(r"\s+", " ", html.unescape("".join(parts))).strip()


def _parse_int_attr(val: str | None) -> int | None:
    if not val:
        return None
    m = re.match(r"^\s*(\d+)", val)
    return int(m.group(1)) if m else None


def _resolve_article_image(attrs: dict[str, str | None], base_url: str) -> dict[str, Any] | None:
    raw_src = (
        attrs.get("data-src")
        or attrs.get("data-lazy-src")
        or attrs.get("data-original")
        or attrs.get("src")
        or ""
    ).strip()
    if not raw_src or raw_src.startswith("data:") or raw_src.startswith("javascript:"):
        return None
    resolved = urljoin(base_url, raw_src) if base_url else raw_src
    parsed = urlparse(resolved)
    if parsed.scheme not in {"http", "https"}:
        return None
    low_url = resolved.lower()
    if low_url.endswith(".svg") or low_url.endswith(".ico"):
        return None
    if any(hint in low_url for hint in _NOISE_IMAGE_HINTS):
        return None
    width = _parse_int_attr(attrs.get("width"))
    height = _parse_int_attr(attrs.get("height"))
    if (width is not None and width < 48) or (height is not None and height < 48):
        return None
    alt = re.sub(r"\s+", " ", html.unescape(attrs.get("alt") or "")).strip()
    return {"type": "image", "src": resolved, "alt": alt, "caption": ""}


class _RichArticleHTMLParser(HTMLParser):
    """Extract structured headings, paragraphs, images, tables, lists, and quotes cleanly."""

    def __init__(self, base_url: str = "") -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.skip_depth = 0
        self.in_title = False
        self.title_parts: list[str] = []

        self.blocks: list[dict[str, Any]] = []
        self._seen_images: set[str] = set()

        # Current inline text buffer
        self._buf: list[str] = []
        self._heading_level: int | None = None
        self._in_blockquote = False
        self._in_figcaption = False

        # List state
        self._list_stack: list[dict[str, Any]] = []
        self._in_li = False

        # Table state
        self._in_table = False
        self._table_rows: list[tuple[bool, list[str]]] = []
        self._cur_row_cells: list[str] = []
        self._cur_row_is_header = False
        self._in_cell = False
        self._cell_buf: list[str] = []

    def _push_block(self, block: dict[str, Any]) -> None:
        if len(self.blocks) >= _MAX_BLOCKS:
            return
        if block["type"] in {"paragraph", "heading", "quote"}:
            if self.blocks and self.blocks[-1].get("type") == block["type"] and self.blocks[-1].get("text") == block["text"]:
                return
        self.blocks.append(block)

    def _flush_text_buf(self, force_type: str | None = None) -> None:
        text = _clean_text(self._buf)
        self._buf.clear()
        if not text:
            return
        if self._in_figcaption:
            if self.blocks and self.blocks[-1]["type"] == "image" and not self.blocks[-1]["caption"]:
                self.blocks[-1]["caption"] = text
                return
        if force_type == "heading" and self._heading_level is not None:
            if len(text) >= 2:
                self._push_block({"type": "heading", "level": self._heading_level, "text": text})
            return
        if force_type == "quote" or self._in_blockquote:
            if len(text) >= 15:
                self._push_block({"type": "quote", "text": text})
            return
        if self._in_li and self._list_stack:
            if len(text) >= 4:
                self._list_stack[-1]["items"].append(text)
            return
        if len(text) >= 25:
            self._push_block({"type": "paragraph", "text": text})

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        t = tag.lower()
        if t in _SKIP_TAGS:
            self.skip_depth += 1
            return
        if self.skip_depth > 0:
            return

        if t == "title":
            self.in_title = True
            return

        if t == "table":
            self._flush_text_buf()
            self._in_table = True
            self._table_rows = []
            return
        if self._in_table:
            if t == "tr":
                self._cur_row_cells = []
                self._cur_row_is_header = False
            elif t in {"th", "td"}:
                self._in_cell = True
                self._cell_buf = []
                if t == "th":
                    self._cur_row_is_header = True
            return

        if t in {"h1", "h2", "h3", "h4"}:
            self._flush_text_buf()
            self._heading_level = int(t[1])
            return
        if t == "blockquote":
            self._flush_text_buf()
            self._in_blockquote = True
            return
        if t == "figcaption":
            self._flush_text_buf()
            self._in_figcaption = True
            return
        if t in {"ul", "ol"}:
            self._flush_text_buf()
            self._list_stack.append({"type": "list", "ordered": t == "ol", "items": []})
            return
        if t == "li":
            self._flush_text_buf()
            self._in_li = True
            return
        if t == "img":
            attr_map = {k.lower(): v for k, v in attrs}
            img_block = _resolve_article_image(attr_map, self.base_url)
            if img_block and img_block["src"] not in self._seen_images:
                self._flush_text_buf()
                self._seen_images.add(img_block["src"])
                self._push_block(img_block)
            return
        if t in {"p", "div", "section", "article"}:
            self._flush_text_buf()

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t in _SKIP_TAGS and self.skip_depth > 0:
            self.skip_depth -= 1
            return
        if self.skip_depth > 0:
            return

        if t == "title":
            self.in_title = False
            return

        if self._in_table:
            if t in {"th", "td"} and self._in_cell:
                self._cur_row_cells.append(_clean_text(self._cell_buf))
                self._cell_buf.clear()
                self._in_cell = False
            elif t == "tr":
                if any(c for c in self._cur_row_cells):
                    self._table_rows.append((self._cur_row_is_header, self._cur_row_cells))
                self._cur_row_cells = []
            elif t == "table":
                self._in_table = False
                if len(self._table_rows) >= 2:
                    headers: list[str] = []
                    body_rows: list[list[str]] = []
                    if self._table_rows[0][0]:
                        headers = self._table_rows[0][1]
                        body_rows = [r[1] for r in self._table_rows[1:]]
                    else:
                        headers = self._table_rows[0][1]
                        body_rows = [r[1] for r in self._table_rows[1:]]
                    if any(headers) and body_rows:
                        self._push_block({"type": "table", "headers": headers, "rows": body_rows[:40]})
                self._table_rows = []
            return

        if t in {"h1", "h2", "h3", "h4"}:
            self._flush_text_buf(force_type="heading")
            self._heading_level = None
            return
        if t == "blockquote":
            self._flush_text_buf(force_type="quote")
            self._in_blockquote = False
            return
        if t == "figcaption":
            self._flush_text_buf()
            self._in_figcaption = False
            return
        if t == "li":
            self._flush_text_buf()
            self._in_li = False
            return
        if t in {"ul", "ol"} and self._list_stack:
            self._flush_text_buf()
            lst = self._list_stack.pop()
            if lst["items"]:
                self._push_block(lst)
            return
        if t in {"p", "div", "section", "article"}:
            self._flush_text_buf()

    def handle_data(self, data: str) -> None:
        if self.skip_depth > 0:
            return
        if self.in_title:
            self.title_parts.append(data)
            return
        if self._in_table:
            if self._in_cell:
                self._cell_buf.append(data)
            return
        self._buf.append(data)


def _extract_primary_html_region(raw_html: str) -> str:
    """Prefer <article> or <main> container when substantial to exclude site chrome."""
    for tag in ("article", "main"):
        m = re.search(rf"<{tag}\b[^>]*>([\s\S]*?)</{tag}>", raw_html, flags=re.IGNORECASE)
        if m:
            candidate = m.group(0)
            plain_len = len(re.sub(r"<[^>]+>", " ", candidate).strip())
            if plain_len >= 400:
                return candidate
    return raw_html


def extract_readable_article(raw_html: str, base_url: str = "") -> tuple[str, list[dict[str, Any]], list[str]]:
    """Parse HTML into (title, rich_blocks, plain_paragraphs)."""
    title_match = re.search(r"<title[^>]*>([\s\S]*?)</title>", raw_html, flags=re.IGNORECASE)
    doc_title = _clean_text([title_match.group(1)]) if title_match else ""

    region_html = _extract_primary_html_region(raw_html)
    parser = _RichArticleHTMLParser(base_url=base_url)
    parser.feed(region_html)
    parser.close()
    parser._flush_text_buf()

    title = doc_title or _clean_text(parser.title_parts)
    blocks = parser.blocks

    # Flatten text paragraphs for backwards compatibility & matching
    paragraphs: list[str] = []
    for b in blocks:
        if b["type"] in {"paragraph", "quote"}:
            paragraphs.append(b["text"])
        elif b["type"] == "list":
            paragraphs.extend(b["items"])
    return title, blocks, paragraphs


def extract_readable_paragraphs(raw_html: str) -> tuple[str, list[str]]:
    """Backwards-compatible helper returning (title, paragraphs)."""
    title, _, paragraphs = extract_readable_article(raw_html)
    return title, paragraphs


def _is_public_http_url(raw_url: str) -> tuple[bool, str]:
    """Reject non-HTTP(S) schemes and private/loopback/link-local hosts (SSRF guard)."""
    parsed = urlparse((raw_url or "").strip())
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return False, "URL không hợp lệ (chỉ hỗ trợ http/https)."
    host = parsed.hostname.strip().lower()
    if host in {"localhost", "127.0.0.1", "::1", "0.0.0.0"} or host.endswith(".local"):
        return False, "Không cho phép truy cập địa chỉ nội bộ."
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror:
        return False, "Không phân giải được tên miền."
    for info in infos:
        ip_str = info[4][0]
        try:
            ip_obj = ipaddress.ip_address(ip_str)
            if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local or ip_obj.is_reserved or ip_obj.is_multicast:
                return False, "Địa chỉ IP đích thuộc mạng nội bộ/riêng tư."
        except ValueError:
            continue
    return True, ""


async def fetch_web_reader_content(url: str) -> dict[str, Any]:
    """Fetch and extract rich structured blocks (headings, images, tables, paragraphs) cleanly."""
    allowed, reason = _is_public_http_url(url)
    if not allowed:
        return {"url": url, "status": "blocked", "reason": reason, "title": "", "blocks": [], "paragraphs": []}

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
        final_url = str(resp.url)
        if resp.status_code in {401, 403, 429}:
            return {
                "url": final_url,
                "status": "blocked",
                "reason": f"Trang web gốc chặn đọc tự động (HTTP {resp.status_code}).",
                "title": "",
                "blocks": [],
                "paragraphs": [],
            }
        if resp.status_code >= 400:
            return {
                "url": final_url,
                "status": "error",
                "reason": f"Không tải được trang web (HTTP {resp.status_code}).",
                "title": "",
                "blocks": [],
                "paragraphs": [],
            }
        content_type = (resp.headers.get("content-type") or "").lower()
        if "pdf" in content_type:
            return {
                "url": final_url,
                "status": "pdf",
                "reason": "Nguồn đích là tệp PDF, vui lòng mở trực tiếp trên tab mới.",
                "title": "",
                "blocks": [],
                "paragraphs": [],
            }
        raw_html = resp.text[:_MAX_HTML_BYTES]
        title, blocks, paragraphs = extract_readable_article(raw_html, base_url=final_url)
        joined_low = f"{title} {' '.join(paragraphs[:4])}".lower()
        if any(pat in joined_low for pat in _BOT_CHALLENGE_PATTERNS):
            return {
                "url": final_url,
                "status": "blocked",
                "reason": "Trang gốc yêu cầu xác minh trình duyệt / chặn đọc tự động.",
                "title": "",
                "blocks": [],
                "paragraphs": [],
            }
        if not blocks:
            return {
                "url": final_url,
                "status": "empty",
                "reason": "Trang sử dụng render JS động nên không trích xuất được văn bản tĩnh.",
                "title": title,
                "blocks": [],
                "paragraphs": [],
            }
        return {
            "url": final_url,
            "status": "ok",
            "reason": "",
            "title": title,
            "blocks": blocks,
            "paragraphs": paragraphs,
        }
    except Exception as exc:
        return {
            "url": url,
            "status": "error",
            "reason": f"Lỗi kết nối khi tải trang: {type(exc).__name__}",
            "title": "",
            "blocks": [],
            "paragraphs": [],
        }
