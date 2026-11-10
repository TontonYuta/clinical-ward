from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import sqlite3
import json
import logging
import base64
import time
import re
import io
import os
import tempfile
import subprocess
try:
    import pypdf
except ImportError:
    pypdf = None

logger = logging.getLogger(__name__)

from app.schemas.bhyt import (
    BhytPrescriptionPayload,
    BhytPrescriptionItemPayload,
    BhytAuditReportSchema,
    BhytCatalogQueryResponse,
    DrugResolutionRequest,
    DrugResolutionResult,
    DrugBatchResolutionRequest,
    DrugBatchResolutionResponse,
    BhytOcrPrescriptionRequest,
    BhytOcrPrescriptionResponse
)
from app.services.bhyt_service import BhytAuditService
from app.services.drug_resolver import DrugEntityResolver
from app.services.llm_provider import query_vision_ocr
from app.seed_bhyt_catalog import resolve_db_path

router = APIRouter(prefix="/bhyt", tags=["BHYT Claims Adjudication"])
bhyt_service = BhytAuditService()
drug_resolver = DrugEntityResolver()

@router.get("/catalog", response_model=BhytCatalogQueryResponse)
def get_bhyt_catalog(
    q: str = Query("", description="Tìm kiếm hoạt chất, biệt dược hoặc mã ATC"),
    rank: str = Query("ALL", description="Lọc theo tuyến KCB / Hạng BV"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0)
):
    """
    Tra cứu danh mục quy tắc thanh toán thuốc BHYT (Thông tư 20/2022/TT-BYT)
    """
    try:
        return bhyt_service.search_catalog(query=q, rank=rank, limit=limit, offset=offset)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tra cứu danh mục BHYT: {str(e)}")

class BhytCustomLogPayload(BaseModel):
    prescription_id: Optional[str] = "RX"
    patient_name: Optional[str] = "Bệnh nhân"
    insurance_card_number: Optional[str] = ""
    hospital_rank: Optional[str] = "HANG_I"
    treatment_type: Optional[str] = "NGOAI_TRU"
    primary_icd10: Optional[str] = ""
    status: str = "PASS"
    total_cost_vnd: float = 0.0
    at_risk_cost_vnd: float = 0.0
    violations_count: int = 0
    violations_json: Optional[str] = "[]"
    error_detail: Optional[str] = None

@router.post("/audit", response_model=BhytAuditReportSchema)
def audit_bhyt_prescription_api(payload: BhytPrescriptionPayload):
    """
    Giám định đơn thuốc BHYT và cảnh báo nguy cơ xuất toán thời gian thực (<5ms)
    Căn cứ: Thông tư 20/2022/TT-BYT & Quyết định 3618/QĐ-BHXH
    """
    try:
        return bhyt_service.audit_prescription(payload)
    except Exception as e:
        bhyt_service.save_audit_error_log(payload, str(e))
        raise HTTPException(status_code=500, detail=f"Lỗi giám định BHYT: {str(e)}")

@router.get("/logs")
def get_bhyt_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None)
):
    """
    Lấy lịch sử các ca giám định BHYT đã thực hiện để kiểm tra lỗi và rà soát xuất toán
    """
    try:
        conn = sqlite3.connect(resolve_db_path())
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        sql = """
        SELECT id, prescription_id, patient_name, insurance_card_number,
               hospital_rank, treatment_type, primary_icd10, status,
               total_cost_vnd, at_risk_cost_vnd, violations_count, violations_json, created_at
        FROM bhyt_audit_logs
        WHERE 1=1
        """
        params = []
        if status and status.upper() != "ALL":
            sql += " AND status = ?"
            params.append(status.upper())
        if q and q.strip():
            sql += " AND (patient_name LIKE ? OR prescription_id LIKE ? OR insurance_card_number LIKE ? OR primary_icd10 LIKE ? OR violations_json LIKE ?)"
            term = f"%{q.strip()}%"
            params.extend([term, term, term, term, term])
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)
        cursor.execute(sql, tuple(params))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy lịch sử giám định: {str(e)}")

@router.post("/log")
def record_bhyt_audit_log(payload: BhytCustomLogPayload):
    """Ghi nhận log giám định hoặc log lỗi từ client vào sổ kiểm toán BHYT."""
    try:
        violations_data = payload.violations_json or "[]"
        if payload.error_detail:
            err_item = [{
                "id": f"CLIENT-ERR-{int(time.time())}",
                "severity": "ERROR",
                "category": "CLIENT_AUDIT_ERROR",
                "title": "Lỗi client khi giám định BHYT",
                "detail": payload.error_detail,
                "rejection_risk_vnd": payload.at_risk_cost_vnd,
                "action": "Kiểm tra log chi tiết trong Monitor."
            }]
            violations_data = json.dumps(err_item, ensure_ascii=False)
            status = "ERROR"
        else:
            status = payload.status

        log_id = bhyt_service.record_custom_log(
            prescription_id=payload.prescription_id or "RX",
            patient_name=payload.patient_name or "Bệnh nhân",
            insurance_card_number=payload.insurance_card_number or "",
            hospital_rank=payload.hospital_rank or "HANG_I",
            treatment_type=payload.treatment_type or "NGOAI_TRU",
            primary_icd10=payload.primary_icd10 or "",
            status=status,
            total_cost=payload.total_cost_vnd,
            at_risk_cost=payload.at_risk_cost_vnd,
            violations_count=max(payload.violations_count, 1 if payload.error_detail else 0),
            violations_json=violations_data
        )
        return {"status": "success", "log_id": log_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi ghi log giám định: {str(e)}")

@router.post("/resolve-drug", response_model=DrugResolutionResult)
def resolve_drug_entity(req: DrugResolutionRequest):
    """
    Phân giải thực thể thuốc (Hybrid Entity Resolution):
    Nhận diện tên thương mại, viết tắt, gõ sai chính tả và ánh xạ về 54.885 thuốc DAV & TT 20/2022
    """
    try:
        return drug_resolver.resolve_drug(req.raw_query)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân giải thực thể thuốc: {str(e)}")

@router.post("/batch-resolve-drugs", response_model=DrugBatchResolutionResponse)
def batch_resolve_drugs(req: DrugBatchResolutionRequest):
    """
    Phân giải hàng loạt thực thể thuốc (cho OCR đơn thuốc và bảng HITL)
    """
    try:
        return drug_resolver.batch_resolve_drugs(req.raw_drugs)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân giải danh sách thuốc: {str(e)}")

def extract_text_from_prescription_bytes(raw_bytes: bytes, mime_type: str = "") -> str:
    """
    Trích xuất văn bản đơn thuốc từ bytes (Hỗ trợ cả PDF và các định dạng Ảnh PNG/JPEG).
    - Với PDF: Ưu tiên pypdf đọc text layer điện tử, nếu scan thì dùng pdftoppm + tesseract.
    - Với Ảnh: Dùng tesseract OCR tiếng Việt.
    """
    extracted_text = ""
    is_pdf = (mime_type == "application/pdf") or raw_bytes.startswith(b"%PDF")

    if is_pdf:
        # Bước 1: Trích xuất text layer điện tử từ PDF qua pypdf nếu có
        if pypdf is not None:
            try:
                reader = pypdf.PdfReader(io.BytesIO(raw_bytes))
                pages = []
                for p in reader.pages:
                    t = p.extract_text()
                    if t:
                        pages.append(t)
                extracted_text = "\n".join(pages).strip()
            except Exception as e:
                logger.debug(f"pypdf extraction skipped: {e}")

        # Bước 2: Nếu PDF scan dạng ảnh không có text layer (len < 40), dùng pdftoppm + tesseract
        if len(extracted_text) < 40:
            try:
                with tempfile.TemporaryDirectory() as tmpdir:
                    pdf_path = os.path.join(tmpdir, "doc.pdf")
                    with open(pdf_path, "wb") as f:
                        f.write(raw_bytes)
                    prefix = os.path.join(tmpdir, "page")
                    subprocess.run(
                        ["pdftoppm", "-png", "-r", "200", "-f", "1", "-l", "3", pdf_path, prefix],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=12
                    )
                    ocr_pages = []
                    for f_name in sorted(os.listdir(tmpdir)):
                        if f_name.startswith("page") and f_name.endswith(".png"):
                            proc = subprocess.run(
                                ["tesseract", os.path.join(tmpdir, f_name), "stdout", "-l", "vie+eng", "--psm", "3"],
                                stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL,
                                text=True,
                                timeout=12
                            )
                            if proc.returncode == 0 and proc.stdout:
                                ocr_pages.append(proc.stdout)
                    if ocr_pages:
                        extracted_text = "\n".join(ocr_pages).strip()
            except Exception as e:
                logger.warning(f"PDF OCR rasterization failed: {e}")
    else:
        # Định dạng ảnh: chạy tesseract trực tiếp với độ phân giải cao
        try:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=True) as tmp:
                tmp.write(raw_bytes)
                tmp.flush()
                proc = subprocess.run(
                    ["tesseract", tmp.name, "stdout", "-l", "vie+eng", "--psm", "3"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                    timeout=12
                )
                if proc.returncode == 0 and proc.stdout:
                    extracted_text = proc.stdout.strip()
        except Exception as e:
            logger.warning(f"Image tesseract OCR failed: {e}")

    return extracted_text


def parse_vietnamese_prescription_text(extracted_text: str) -> dict:
    """
    Phân tích cấu trúc chứng từ y tế - dược phẩm Việt Nam thích ứng đa dạng bố cục (Multi-Layout):
    - Đơn thuốc ngoại trú/nội trú (BHYT & Phòng khám tư)
    - Hóa đơn điện tử VAT (e-Invoice)
    - Phiếu xuất kho kiêm vận chuyển nội bộ / Bảng kê dược (CPC1, DHG, Sanofi)
    - Hóa đơn bán lẻ / Bill nhiệt POS (K80/K57)
    """
    doc_type = "DON_THUOC"
    low_text = extracted_text.lower()
    if any(k in low_text for k in ["hóa đơn giá trị gia tăng", "hóa đơn điện tử", "e-invoice", "tiền thuế gtgt", "thuế suất"]):
        doc_type = "HOA_DON_VAT"
    elif any(k in low_text for k in ["phiếu xuất kho", "kiêm vận chuyển nội bộ", "phiếu nhập kho", "bảng kê chi tiết"]):
        doc_type = "PHIEU_XUAT_KHO"
    elif any(k in low_text for k in ["hóa đơn bán lẻ", "phiếu thanh toán", "k80", "k57"]):
        doc_type = "HOA_DON_BAN_LE"

    seller_name = ""
    seller_m = re.search(r'(?:công ty|bệnh viện|trung tâm y tế|nhà thuốc|chi nhánh|ctcp|tnhh)[:\s]+([^\n,–\(\)]+)', extracted_text, re.I)
    if seller_m:
        seller_name = seller_m.group(0).strip()

    seller_tax_id = ""
    tax_m = re.search(r'(?:mst|mã số thuế)[:\s]*([0-9]{10}(?:-[0-9]{3})?)', extracted_text, re.I)
    if tax_m:
        seller_tax_id = tax_m.group(1).strip()

    invoice_no = ""
    inv_m = re.search(r'(?:số\s*hđ|số\s*hóa\s*đơn|số\s*phiếu|hóa\s*đơn\s*số)[:\s]*([A-Z0-9\-\/]+)', extracted_text, re.I)
    if not inv_m:
        inv_m = re.search(r'\b(?:số|no)[:\s]+([A-Z0-9\-\/]+)', extracted_text, re.I)
    if inv_m:
        val = inv_m.group(1).strip()
        if not val.lower().startswith(('lượng', 'ngày', 'thứ', 'tiền')):
            invoice_no = val

    patient_name = "Bệnh nhân BHYT"
    patient_age = 50
    card_no = "GD4790000000000"
    icd10 = "I10"
    diag = "Bệnh tim mạch / Tăng huyết áp"
    sec_icds: List[str] = []
    ocr_items: List[dict] = []

    # 1. Mã thẻ BHYT (15 ký tự chữ-số theo QĐ 1666 / TT 52)
    card_m = re.search(r'\b([A-Z]{2}[0-9]{13})\b', extracted_text)
    if card_m:
        card_no = card_m.group(1).upper()

    # 2. Tên bệnh nhân hoặc Khách hàng
    name_m = re.search(r'(?:họ\s*(?:và\s*)?tên(?:\s*người\s*bệnh)?|người\s*bệnh|bệnh\s*nhân|khách\s*hàng|người\s*mua)[:\s]+([^\n,–\(\)]+)', extracted_text, re.I)
    if name_m:
        raw_name = name_m.group(1).strip()
        cleaned_name = re.split(r'(?:ngày sinh|giới tính|sinh năm|năm sinh|địa chỉ|mã|số|tuổi|mst)', raw_name, flags=re.I)[0].strip()
        if not cleaned_name.upper().startswith("BN-") and len(cleaned_name) >= 2:
            patient_name = cleaned_name

    # 3. Tuổi / Năm sinh
    age_m = re.search(r'\((\d{1,3})\s*tuổi\)', extracted_text, re.I) or re.search(r'(\d{1,3})\s*tuổi\b', extracted_text, re.I) or re.search(r'(?:tuổi|sinh năm|năm sinh)[:\s]*(\d{1,4})', extracted_text, re.I)
    if age_m:
        val = int(age_m.group(1))
        patient_age = 2026 - val if val > 1900 else val

    # 4. Mã ICD-10 & Chẩn đoán
    all_codes = re.findall(r'\b([A-Z][0-9]{2}(?:\.[0-9]+)?)\b', extracted_text)
    icd_codes = [c for c in all_codes if not c.startswith(('BN', 'BA', 'DN', 'GD', 'CC', 'DT', 'RX'))]
    if icd_codes:
        icd10 = icd_codes[0]
        sec_icds = icd_codes[1:4]

    diag_m = re.search(r'(?:bệnh chính|chẩn đoán(?: lâm sàng)?|chẩn đoán)[:\s]+([^\n]+)', extracted_text, re.I)
    if diag_m:
        raw_diag = diag_m.group(1)
        cleaned_diag = re.split(r'\(|mã icd|icd-10|bệnh kèm|kèm theo', raw_diag, flags=re.I)[0].strip(' :–-•')
        cleaned_diag = re.sub(r'^[•\s–-]*(?:bệnh chính[:\s]*)?', '', cleaned_diag, flags=re.I).strip()
        if cleaned_diag:
            diag = cleaned_diag

    # 5. Phân tích các dòng thuốc & bố cục bảng linh hoạt
    lines = [l.strip() for l in extracted_text.split("\n") if l.strip()]
    current_item = None

    for l in lines:
        l_low = l.lower()

        # Bỏ qua các dòng tiêu đề hành chính không phải thuốc
        if any(k in l_low for k in ["bệnh viện", "khoa khám", "họ và tên", "ngày sinh", "chẩn đoán", "lời dặn", "người bệnh", "bác sĩ", "hẹn khám", "bảo hiểm", "cộng tiền", "tổng cộng", "thuế suất", "tiền thuế"]):
            continue

        # 1. Nhận diện dòng thuốc mới (STT 1., 1), -, *, •, + hoặc bảng có pipe |)
        drug_str = None
        is_table_pipe = '|' in l
        m = re.match(r'^(?:(?:\d+|[IVXLCDM]+)[\.\)\/\-:]|[-*•+])\s*(.+)', l)

        if m:
            drug_str = m.group(1).strip()
        elif is_table_pipe:
            # Dòng phân cách dạng bảng |
            parts = [p.strip() for p in l.split('|') if p.strip()]
            # Nếu là dòng tiêu đề bảng thì bỏ qua
            if any(k in l_low for k in ["tên hàng", "đơn giá", "thành tiền", "số lượng", "stt"]):
                continue
            if len(parts) >= 2:
                drug_str = l.strip()
        elif current_item is None:
            # Kiểm tra nếu dòng chứa thuốc có đơn vị tính
            has_unit = bool(re.search(r'\b(?:\d+(?:\.\d+)?)\s*(?:viên|gói|ống|lọ|chai|vỉ|hộp|nang|tuýp|bút|mg|g|ml)\b', l, re.I))
            if has_unit:
                drug_str = l.strip()

        # 2. Nếu không phải dòng thuốc mới, kiểm tra dòng phụ (Lô/HSD hoặc Hướng dẫn) của thuốc hiện tại
        if not drug_str:
            if current_item and any(k in l_low for k in ["lô:", "lô ", "batch", "lot", "hsd:", "hsd ", "exp:", "exp ", "hạn dùng", "giá:", "đơn giá:"]):
                batch_m = re.search(r'(?:lô|batch|lot)[:\s#]*([A-Z0-9\-\/]+)', l, re.I)
                if batch_m and not current_item.get("batch_number"):
                    current_item["batch_number"] = batch_m.group(1).strip()
                exp_m = re.search(r'(?:hsd|exp|hạn dùng|hạn sử dụng)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{2}\/\d{4})', l, re.I)
                if exp_m and not current_item.get("expiry_date"):
                    current_item["expiry_date"] = exp_m.group(1).strip()
                p_m = re.search(r'(?:đơn giá|giá)[:\s]*(\d{1,3}(?:[.,]\d{3})+|\d{4,8})', l, re.I)
                if p_m and current_item.get("unit_price", 0.0) <= 0.0:
                    val_p = float(p_m.group(1).replace('.', '').replace(',', ''))
                    current_item["unit_price"] = val_p
                    if current_item.get("quantity", 0) > 0:
                        current_item["total_price"] = round(current_item["quantity"] * val_p, 2)
                continue

            if current_item and any(k in l_low for k in ["cách dùng", "uống", "tiêm", "ngậm", "bôi", "dùng", "ngày 2 lần", "ngày 1 lần", "sau ăn", "trước ăn"]):
                if not current_item["instructions"] or current_item["instructions"] == "Theo chỉ định bác sĩ":
                    current_item["instructions"] = l.strip()
                continue

        # 3. Phân tích chi tiết dòng thuốc
        if drug_str:
            unit = "Viên"
            qty = 10.0
            dosage = ""
            batch_no = ""
            exp_date = ""
            unit_price = 0.0
            total_price = 0.0
            instructions = "Theo chỉ định bác sĩ"

            # Xử lý riêng cho định dạng bảng phân cách bằng | (Pipe-delimited table)
            if '|' in drug_str:
                parts = [p.strip() for p in drug_str.split('|') if p.strip()]
                # Loại bỏ STT ở đầu nếu có
                if parts and re.match(r'^\d+$', parts[0]):
                    parts = parts[1:]
                if parts:
                    drug_clean = parts[0]
                    if len(parts) >= 2 and re.search(r'\b(hộp|viên|vỉ|gói|lọ|chai|ống|tuýp)\b', parts[1], re.I):
                        unit = parts[1].capitalize()
                    # Cột số lượng
                    for col in parts[1:]:
                        if re.match(r'^\d+(?:\.\d+)?$', col):
                            val = float(col)
                            if 0 < val <= 5000 and qty == 10.0:
                                qty = val
                                break
                    # Cột đơn giá & thành tiền
                    numeric_cols = [float(re.sub(r'[.,]', '', col)) for col in parts[1:] if re.match(r'^\d{1,3}(?:[.,]\d{3})+$|^\d{4,9}$', col)]
                    if len(numeric_cols) >= 2:
                        unit_price = min(numeric_cols)
                        total_price = max(numeric_cols)
                    elif len(numeric_cols) == 1:
                        unit_price = numeric_cols[0]
                        total_price = round(qty * unit_price, 2)
            else:
                # Dạng danh sách text hoặc câu
                drug_clean = drug_str

                # Tách số lượng ưu tiên dạng: x 30 hộp / SL: 20
                x_qty_m = re.search(r'(?:x|sl[:\s]*|\*)\s*(\d+(?:\.\d+)?)\s*(?:viên|gói|ống|lọ|chai|vỉ|hộp|bình|nang|tuýp|bút|túi|liều)?\b', drug_clean, re.I)
                if x_qty_m and float(x_qty_m.group(1)) > 0:
                    qty = float(x_qty_m.group(1))
                    drug_clean = drug_clean[:x_qty_m.start()].strip()
                else:
                    qty_m = re.search(r'\b(\d+(?:\.\d+)?)\s*(?:viên|gói|ống|lọ|chai|vỉ|hộp|bình|nang|tuýp|bút|túi|liều)\b', drug_clean, re.I)
                    if qty_m and float(qty_m.group(1)) > 0:
                        qty = float(qty_m.group(1))
                        drug_clean = drug_clean[:qty_m.start()].strip()

                # Tách đơn vị tính
                unit_m = re.search(r'\b(viên|gói|ống|lọ|chai|vỉ|hộp|bình|nang|tuýp|bút|túi|liều)\b', drug_str, re.I)
                if unit_m:
                    unit = unit_m.group(1).capitalize()

                # Tách số lô & hạn dùng
                batch_m = re.search(r'(?:lô|batch|lot)[:\s#]*([A-Z0-9\-\/]+)', drug_str, re.I)
                if batch_m:
                    batch_no = batch_m.group(1).strip()
                exp_m = re.search(r'(?:hsd|exp|hạn dùng)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{2}\/\d{4})', drug_str, re.I)
                if exp_m:
                    exp_date = exp_m.group(1).strip()

                # Tách giá nếu có
                price_m = re.search(r'(?:giá|đơn giá)[:\s]*(\d{1,3}(?:[.,]\d{3})+|\d{4,8})', drug_str, re.I)
                if price_m:
                    try:
                        clean_p = price_m.group(1).replace('.', '').replace(',', '')
                        unit_price = float(clean_p)
                    except Exception:
                        pass

                # Tách chỉ dẫn trong ngoặc đơn nếu có
                instr_m = re.search(r'\(([^)]+)\)', drug_str)
                if instr_m and any(k in instr_m.group(1).lower() for k in ["uống", "tiêm", "ngày", "lần", "sáng", "tối", "ăn"]):
                    instructions = instr_m.group(1).strip()
                    drug_clean = re.sub(r'\([^)]+\)', '', drug_clean).strip()

            # Tách hàm lượng (mg, g, mcg, ml, UI...)
            dos_m = re.search(r'\b(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|IU|UI|%|µg))\b', drug_clean, re.I)
            if dos_m:
                dosage = dos_m.group(1)

            # Tính toán logic số học 100%: Total = Qty * Price
            if total_price <= 0.0 and unit_price > 0.0:
                total_price = round(qty * unit_price, 2)
            elif unit_price <= 0.0 and total_price > 0.0 and qty > 0.0:
                unit_price = round(total_price / qty, 2)

            # Làm sạch chuỗi tên thuốc
            drug_clean = re.sub(r'^(?:(?:\d+|[IVXLCDM]+)[\.\)\/\-:]|[-*•+])\s*', '', drug_clean).strip()
            drug_clean = re.sub(r'\b(?:lô|batch|lot|hsd|exp|hạn dùng)[:\s#]*[A-Z0-9\-\/.]+', '', drug_clean, flags=re.I).strip()
            drug_clean = re.sub(r'[\s:;,-]+$', '', drug_clean).strip()
            if not drug_clean:
                drug_clean = drug_str[:30].strip()

            current_item = {
                "drug_name": drug_clean,
                "dosage": dosage,
                "unit": unit,
                "quantity": qty,
                "unit_price": unit_price,
                "total_price": total_price,
                "batch_number": batch_no,
                "expiry_date": exp_date,
                "days_supply": 7,
                "route": "Uống",
                "instructions": instructions
            }
            ocr_items.append(current_item)

    return {
        "document_type": doc_type,
        "seller_name": seller_name,
        "seller_tax_id": seller_tax_id,
        "invoice_number": invoice_no,
        "patient_name": patient_name,
        "patient_age": patient_age,
        "insurance_card_number": card_no,
        "primary_icd10": icd10,
        "primary_diagnosis": diag,
        "secondary_icd10s": sec_icds,
        "items": ocr_items
    }


@router.post("/ocr-prescription", response_model=BhytOcrPrescriptionResponse)
async def ocr_prescription_endpoint(req: BhytOcrPrescriptionRequest):
    """
    Trích xuất đa phương thức (Multimodal Vision OCR) đơn thuốc BHYT:
    1. Nhận diện hình ảnh / tài liệu PDF qua Gemini hoặc nhà cung cấp bên thứ 3 (OpenAI/Qwen-VL)
    2. Fallback ngoại tuyến tự động qua pypdf / pdftoppm / tesseract OCR cho cả PDF và Ảnh
    3. Tự động đối soát và chuẩn hóa mọi thuốc với CSDL Dược Quốc Gia (54.885 thuốc DAV & TT20)
    4. Trả về cấu trúc đơn thuốc sẵn sàng cho bảng duyệt HITL Card 3 và thẩm định BHYT
    """
    try:
        raw_ocr_data = None
        provider = "gemini"
        model_used = None

        if req.image_base64:
            raw_ocr_data = await query_vision_ocr(
                image_base64=req.image_base64,
                mime_type=req.mime_type or "image/jpeg"
            )

        doc_type = "DON_THUOC"
        seller_name = ""
        seller_tax_id = ""
        invoice_no = ""

        if raw_ocr_data and isinstance(raw_ocr_data, dict):
            provider = raw_ocr_data.get("_provider", "gemini")
            model_used = raw_ocr_data.get("_model_used", "gemini-vision")
            doc_type = str(raw_ocr_data.get("document_type") or "DON_THUOC").upper()
            is_valid_doc = raw_ocr_data.get("is_valid", True)

            # Trường hợp tài liệu không phải y tế hoặc hình ảnh mờ không đọc được
            if doc_type in ("NON_MEDICAL", "UNREADABLE") or not is_valid_doc:
                msg = raw_ocr_data.get("validation_message") or (
                    "Tài liệu tải lên không phải là đơn thuốc hoặc chứng từ y tế hợp lệ."
                    if doc_type == "NON_MEDICAL" else
                    "Hình ảnh quá mờ hoặc rung nhòe, không thể nhận diện được thông tin y tế trên tài liệu."
                )
                empty_rx = BhytPrescriptionPayload(
                    prescription_id="RX-OCR-INVALID",
                    document_type=doc_type,
                    seller_name="",
                    seller_tax_id="",
                    invoice_number="",
                    patient_name="",
                    patient_age=0,
                    insurance_card_number="",
                    hospital_rank=req.hospital_rank or "HANG_I",
                    treatment_type=req.treatment_type or "NGOAI_TRU",
                    primary_icd10="",
                    primary_diagnosis="",
                    secondary_icd10s=[],
                    items=[]
                )
                return BhytOcrPrescriptionResponse(
                    success=False,
                    is_valid_document=False,
                    document_classification=doc_type,
                    warning_code="INVALID_DOCUMENT_TYPE" if doc_type == "NON_MEDICAL" else "UNREADABLE_IMAGE",
                    provider=provider,
                    model_used=model_used,
                    prescription=empty_rx,
                    resolved_count=0,
                    total_items=0,
                    message=msg
                )

            seller_name = raw_ocr_data.get("seller_name") or ""
            seller_tax_id = raw_ocr_data.get("seller_tax_id") or ""
            invoice_no = raw_ocr_data.get("invoice_number") or ""
            patient_name = raw_ocr_data.get("patient_name") or "Bệnh nhân"
            patient_age = int(raw_ocr_data.get("patient_age") or 50)
            card_no = raw_ocr_data.get("insurance_card_number") or "GD4790000000000"
            icd10 = raw_ocr_data.get("primary_icd10") or "I10"
            diag = raw_ocr_data.get("primary_diagnosis") or "Tăng huyết áp"
            sec_icds = raw_ocr_data.get("secondary_icd10s") or []
            ocr_items = raw_ocr_data.get("items") or []
        else:
            # Fallback ngoại tuyến: Hỗ trợ cả PDF (pypdf/pdftoppm) và Ảnh (tesseract)
            provider = "offline_extractor"
            model_used = "local_prescription_extractor"
            
            extracted_text = (req.raw_text or "").strip()
            if not extracted_text and req.image_base64:
                try:
                    clean_b64 = req.image_base64
                    if "," in clean_b64:
                        clean_b64 = clean_b64.split(",", 1)[1]
                    file_bytes = base64.b64decode(clean_b64)
                    extracted_text = extract_text_from_prescription_bytes(file_bytes, req.mime_type or "")
                except Exception as ex:
                    logger.warning(f"Local file extraction failed: {ex}")

            if not extracted_text or len(extracted_text.strip()) < 10:
                empty_rx = BhytPrescriptionPayload(
                    prescription_id="RX-OCR-EMPTY",
                    document_type="UNKNOWN",
                    seller_name="",
                    seller_tax_id="",
                    invoice_number="",
                    patient_name="",
                    patient_age=0,
                    insurance_card_number="",
                    hospital_rank=req.hospital_rank or "HANG_I",
                    treatment_type=req.treatment_type or "NGOAI_TRU",
                    primary_icd10="",
                    primary_diagnosis="",
                    secondary_icd10s=[],
                    items=[]
                )
                return BhytOcrPrescriptionResponse(
                    success=False,
                    is_valid_document=False,
                    document_classification="UNKNOWN",
                    warning_code="NO_TEXT_EXTRACTED",
                    provider=provider,
                    model_used=model_used,
                    prescription=empty_rx,
                    resolved_count=0,
                    total_items=0,
                    message="Không thể trích xuất văn bản từ tài liệu tải lên. Vui lòng kiểm tra lại độ rõ nét hoặc chọn tệp hợp lệ."
                )

            parsed = parse_vietnamese_prescription_text(extracted_text)
            doc_type = parsed.get("document_type", "DON_THUOC")
            seller_name = parsed.get("seller_name", "")
            seller_tax_id = parsed.get("seller_tax_id", "")
            invoice_no = parsed.get("invoice_number", "")
            patient_name = parsed["patient_name"]
            patient_age = parsed["patient_age"]
            card_no = parsed["insurance_card_number"]
            icd10 = parsed["primary_icd10"]
            diag = parsed["primary_diagnosis"]
            sec_icds = parsed["secondary_icd10s"]
            ocr_items = parsed["items"]

        # Chuẩn hóa từng thuốc qua DrugEntityResolver (54.885 thuốc DAV & TT20)
        items_payload: List[BhytPrescriptionItemPayload] = []
        resolved_count = 0

        for idx, it in enumerate(ocr_items):
            raw_drug_name = str(it.get("drug_name") or f"Thuốc {idx + 1}").strip()
            res = drug_resolver.resolve_drug(raw_drug_name)

            drug_code = ""
            active_ing = it.get("active_ingredient") or ""
            dosage = it.get("dosage") or ""
            route = it.get("route") or "Uống"
            unit_price = float(it.get("unit_price") or 0.0)
            quantity = float(it.get("quantity") or 10.0)
            total_price = float(it.get("total_price") or 0.0)

            # Đảm bảo logic tính toán 100%: Total = Qty * Price
            if total_price <= 0.0 and unit_price > 0.0 and quantity > 0.0:
                total_price = round(quantity * unit_price, 2)
            elif unit_price <= 0.0 and total_price > 0.0 and quantity > 0.0:
                unit_price = round(total_price / quantity, 2)

            batch_no = str(it.get("batch_number") or it.get("batch_no") or it.get("lot_no") or it.get("lot") or "").strip()
            exp_date = str(it.get("expiry_date") or it.get("exp_date") or it.get("hsd") or "").strip()
            unit = str(it.get("unit") or it.get("dvt") or "Viên").strip()
            vat_rate = float(it.get("vat_rate") or it.get("vat") or 0.0)

            if res.match_status in ("HIGH", "MEDIUM", "LOW"):
                resolved_count += 1
                if res.matched_dav:
                    drug_code = res.matched_dav.national_code or ""
                    if not active_ing:
                        active_ing = res.matched_dav.active_ingredient or ""
                    if not dosage and res.matched_dav.concentration:
                        dosage = res.matched_dav.concentration
                    if not route and res.matched_dav.route:
                        route = res.matched_dav.route
                elif res.matched_bhyt:
                    drug_code = res.matched_bhyt.atc_code or ""
                    if not active_ing:
                        active_ing = res.matched_bhyt.active_ingredient

            items_payload.append(
                BhytPrescriptionItemPayload(
                    id=f"ITEM-{idx + 1}",
                    drug_code=drug_code,
                    drug_name=raw_drug_name,
                    active_ingredient=active_ing,
                    dosage=dosage,
                    route=route,
                    quantity=quantity,
                    days_supply=int(it.get("days_supply") or 7),
                    unit_price=unit_price,
                    total_price=total_price,
                    unit=unit,
                    batch_number=batch_no,
                    expiry_date=exp_date,
                    vat_rate=vat_rate,
                    instructions=str(it.get("instructions") or "")
                )
            )

        prescription = BhytPrescriptionPayload(
            prescription_id="RX-OCR-LIVE",
            document_type=doc_type,
            seller_name=seller_name,
            seller_tax_id=seller_tax_id,
            invoice_number=invoice_no,
            patient_name=patient_name,
            patient_age=patient_age,
            insurance_card_number=card_no,
            hospital_rank=req.hospital_rank or "HANG_I",
            treatment_type=req.treatment_type or "NGOAI_TRU",
            primary_icd10=icd10,
            primary_diagnosis=diag,
            secondary_icd10s=sec_icds,
            items=items_payload
        )

        warning_code = None
        resp_msg = "Trích xuất và đối soát đơn thuốc BHYT thành công"
        if len(items_payload) == 0:
            warning_code = "NO_ITEMS_FOUND"
            resp_msg = "Đã nhận diện thông tin hành chính & chẩn đoán. Không tìm thấy danh mục thuốc trong tài liệu."

        return BhytOcrPrescriptionResponse(
            success=True,
            is_valid_document=True,
            document_classification=doc_type,
            warning_code=warning_code,
            provider=provider,
            model_used=model_used,
            prescription=prescription,
            resolved_count=resolved_count,
            total_items=len(items_payload),
            message=resp_msg
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi Vision OCR đơn thuốc: {str(e)}")

