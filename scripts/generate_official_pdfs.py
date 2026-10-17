#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script: generate_official_pdfs.py
Biên dịch 2 file HTML chuẩn A4 thành 2 ấn phẩm PDF chính thức cho Đồ Án 2 qua Playwright Chromium:
  1. 01_Cam_Nang_Toan_Dien_Nghiep_Vu_Y_Te.pdf
  2. 02_Kien_Truc_Va_Cau_Truc_Code_Do_An_2.pdf
"""

import os
import sys
import shutil
import asyncio
from playwright.async_api import async_playwright

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(BASE_DIR, "docs")

async def render_pdf(html_path: str, pdf_path: str, title: str):
    print(f"[*] Bắt đầu render PDF cho: {title}...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        # Load local HTML file
        file_url = f"file://{os.path.abspath(html_path)}"
        await page.goto(file_url, wait_until="networkidle")
        
        # Wait for Mermaid diagrams to render to SVGs if present
        try:
            await page.wait_for_selector(".mermaid svg", timeout=8000)
            print("    [+] Đã phát hiện và render các biểu đồ Mermaid SVG.")
        except Exception:
            print("    [!] Lưu ý: Không tìm thấy hoặc Mermaid đã tải xong.")
            
        # Short timeout to ensure fonts and layout settle
        await page.wait_for_timeout(1000)
        
        # Header & Footer templates
        header_template = f'''
        <div style="font-size: 7.5pt; font-family: 'Inter', -apple-system, sans-serif; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 16mm;">
          <span>ĐỒ ÁN 2 — HỆ THỐNG QUẢN LÝ KHO DƯỢC, VẬT TƯ & TỦ TRỰC LÂM SÀNG BỆNH VIỆN</span>
          <span>{title}</span>
        </div>
        '''
        
        footer_template = '''
        <div style="font-size: 7.5pt; font-family: 'Inter', -apple-system, sans-serif; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 16mm;">
          <span>Bộ Y Tế: TT 22, TT 20, NĐ 98, TT 36 GSP, NĐ 151 | clinical-ward.vercel.app</span>
          <span>Trang <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
        '''
        
        # Render PDF
        pdf_bytes = await page.pdf(
            format="A4",
            print_background=True,
            display_header_footer=True,
            header_template=header_template,
            footer_template=footer_template,
            margin={"top": "18mm", "bottom": "18mm", "left": "14mm", "right": "14mm"}
        )
        
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
            
        print(f"    [+] Xuất thành công: {pdf_path} ({len(pdf_bytes):,} bytes)")
        await browser.close()

async def main():
    print("=================================================================")
    print(" BẮT ĐẦU XUẤT BẢN 02 ẤN PHẨM PDF CHÍNH THỨC CHO ĐỒ ÁN 2")
    print("=================================================================")

    # 1. Render Document 1
    doc1_html = os.path.join(DOCS_DIR, "01_Cam_Nang_Toan_Dien_Nghiep_Vu_Y_Te.html")
    doc1_pdf_docs = os.path.join(DOCS_DIR, "01_Cam_Nang_Toan_Dien_Nghiep_Vu_Y_Te.pdf")
    doc1_pdf_root = os.path.join(BASE_DIR, "01_Cam_Nang_Toan_Dien_Nghiep_Vu_Y_Te.pdf")
    
    if not os.path.exists(doc1_html):
        print(f"Lỗi: Không tìm thấy file {doc1_html}")
        sys.exit(1)
        
    await render_pdf(doc1_html, doc1_pdf_docs, "01 - NGHIỆP VỤ Y TẾ LÂM SÀNG")
    shutil.copyfile(doc1_pdf_docs, doc1_pdf_root)
    print(f"[+] Đã sao chép Document 1 sang thư mục gốc: {doc1_pdf_root}")

    print("-----------------------------------------------------------------")

    # 2. Render Document 2
    doc2_html = os.path.join(DOCS_DIR, "02_Kien_Truc_Va_Cau_Truc_Code_Do_An_2.html")
    doc2_pdf_docs = os.path.join(DOCS_DIR, "02_Kien_Truc_Va_Cau_Truc_Code_Do_An_2.pdf")
    doc2_pdf_root = os.path.join(BASE_DIR, "02_Kien_Truc_Va_Cau_Truc_Code_Do_An_2.pdf")
    
    if not os.path.exists(doc2_html):
        print(f"Lỗi: Không tìm thấy file {doc2_html}")
        sys.exit(1)
        
    await render_pdf(doc2_html, doc2_pdf_docs, "02 - KIẾN TRÚC & CẤU TRÚC CODE")
    shutil.copyfile(doc2_pdf_docs, doc2_pdf_root)
    print(f"[+] Đã sao chép Document 2 sang thư mục gốc: {doc2_pdf_root}")

    print("=================================================================")
    print(" HOÀN TẤT XUẤT BẢN 100% 02 TÀI LIỆU PDF ĐỒ ÁN 2 THÀNH CÔNG!")
    print("=================================================================")

if __name__ == "__main__":
    asyncio.run(main())
