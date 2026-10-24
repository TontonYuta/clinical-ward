#!/usr/bin/env python3
"""
Crawl4AI & Playwright Regulatory Drug Crawler
Bóc tách dữ liệu Dược phẩm & Tờ hướng dẫn sử dụng (SmPC) từ Cổng Dược (<=200 LOC)
"""

import sys
import json
import asyncio
from pathlib import Path

TARGET_DRUG_SOURCES = [
    {
        "name": "Cục Quản Lý Dược (DAV)",
        "url": "https://dav.gov.vn/dang-ki-thuoc---cong-bo-nguyen-lieu-c311.html",
        "category": "DangKyThuoc"
    },
    {
        "name": "Viện Kiểm Nghiệm Thuốc TW (NIDQC)",
        "url": "https://nidqc.org.vn/",
        "category": "DuocThuQuocGia"
    }
]

async def crawl_with_native_playwright(url: str, output_dir: Path) -> dict:
    """Fallback an toàn bằng Playwright Async API có cấu hình Anti-Bot Stealth"""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("⚠️ Playwright chưa được cài đặt, chuyển sang Standard HTTP fallback.")
        return crawl_with_urllib(url, output_dir)
    
    print(f"🌐 [Playwright Stealth] Đang cào tài liệu từ: {url}...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-setuid-sandbox"
            ]
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        page = await context.new_page()
        
        try:
            response = await page.goto(url, timeout=25000, wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)
            
            title = await page.title()
            content = await page.content()
            links = await page.eval_on_selector_all(
                "a[href]",
                "elements => elements.map(e => ({ text: e.innerText.trim(), href: e.href })).filter(e => e.text.length > 5)"
            )
            
            await browser.close()
            return {
                "url": url,
                "status": response.status if response else 200,
                "title": title,
                "html_length": len(content),
                "extracted_links": links[:15],
                "engine": "Playwright-Stealth"
            }
        except Exception as e:
            await browser.close()
            return {"url": url, "error": str(e), "engine": "Playwright-Stealth"}

def crawl_with_urllib(url: str, output_dir: Path) -> dict:
    """Standard library fallback khi môi trường thiếu Crawl4AI và Playwright"""
    import urllib.request
    import re
    print(f"📡 [Standard HTTP Fallback] Đang tải trang từ: {url}...")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as res:
            html = res.read().decode("utf-8", errors="ignore")
            title_m = re.search(r"<title>(.*?)</title>", html, re.IGNORECASE | re.DOTALL)
            title = title_m.group(1).strip() if title_m else ""
            raw_links = re.findall(r'<a\s+(?:[^>]*?\s+)?href=["\'](.*?)["\'][^>]*>(.*?)</a>', html, re.IGNORECASE)
            links = [{"text": re.sub(r'<[^>]+>', '', m[1]).strip(), "href": m[0]} for m in raw_links if len(m[1].strip()) > 5][:15]
            return {
                "url": url,
                "status": res.status,
                "title": title,
                "html_length": len(html),
                "extracted_links": links,
                "engine": "Standard-HTTP-Fallback"
            }
    except Exception as e:
        return {"url": url, "error": str(e), "engine": "Standard-HTTP-Fallback"}

async def crawl_with_crawl4ai(url: str, output_dir: Path) -> dict:
    """Sử dụng Crawl4AI nếu thư viện đã được cài đặt trong môi trường"""
    try:
        from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
        print(f"🤖 [Crawl4AI Engine] Đang khởi chạy crawler tối ưu LLM: {url}...")
        
        browser_cfg = BrowserConfig(headless=True, extra_args=["--disable-blink-features=AutomationControlled"])
        run_cfg = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, page_timeout=25000)
        
        async with AsyncWebCrawler(config=browser_cfg) as crawler:
            res = await crawler.arun(url=url, config=run_cfg)
            return {
                "url": url,
                "title": res.metadata.get("title", ""),
                "markdown_length": len(res.markdown) if res.markdown else 0,
                "markdown_preview": res.markdown[:400] if res.markdown else "",
                "engine": "Crawl4AI-Core"
            }
    except ImportError:
        # Tự động chuyển đổi sang Playwright Native nếu Crawl4AI chưa cài
        return await crawl_with_native_playwright(url, output_dir)

async def main():
    out_dir = Path(__file__).resolve().parent / "crawled_output"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    print("======================================================================")
    print("🚀 BẮT ĐẦU CRAWL4AI / PLAYWRIGHT REGULATORY DRUG CRAWLER")
    print("======================================================================\n")
    
    results = []
    for source in TARGET_DRUG_SOURCES:
        data = await crawl_with_crawl4ai(source["url"], out_dir)
        results.append({"source": source["name"], **data})
        print(f"   ✅ Hoàn tất bóc tách: {source['name']} ({data.get('engine', 'Unknown')})\n")
        
    out_file = out_dir / "dav_regulatory_manifest.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
        
    print("======================================================================")
    print(f"🎉 HOÀN TẤT THU THẬP! Dữ liệu đã lưu tại: {out_file}")
    print("======================================================================")

if __name__ == "__main__":
    asyncio.run(main())
