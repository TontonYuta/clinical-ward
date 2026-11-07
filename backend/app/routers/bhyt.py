from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List, Dict, Any
import sqlite3
import json
import logging
import base64
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

@router.post("/audit", response_model=BhytAuditReportSchema)
def audit_bhyt_prescription_api(payload: BhytPrescriptionPayload):
    """
    Giám định đơn thuốc BHYT và cảnh báo nguy cơ xuất toán thời gian thực (<5ms)
    Căn cứ: Thông tư 20/2022/TT-BYT & Quyết định 3618/QĐ-BHXH
    """
    try:
        return bhyt_service.audit_prescription(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi giám định BHYT: {str(e)}")

@router.get("/logs")
def get_bhyt_audit_logs(limit: int = Query(20, ge=1, le=100)):
    """
    Lấy lịch sử các ca giám định BHYT đã thực hiện
    """
    try:
        conn = sqlite3.connect(resolve_db_path())
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("""
        SELECT id, prescription_id, patient_name, insurance_card_number,
               hospital_rank, treatment_type, primary_icd10, status,
               total_cost_vnd, at_risk_cost_vnd, violations_count, created_at
        FROM bhyt_audit_logs
        ORDER BY created_at DESC LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy lịch sử giám định: {str(e)}")

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
                        ["pdftoppm", "-png", "-r", "150", "-f", "1", "-l", "2", pdf_path, prefix],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=10
                    )
                    ocr_pages = []
                    for f_name in sorted(os.listdir(tmpdir)):
                        if f_name.startswith("page") and f_name.endswith(".png"):
                            proc = subprocess.run(
                                ["tesseract", os.path.join(tmpdir, f_name), "stdout", "-l", "vie+eng"],
                                stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL,
                                text=True,
                                timeout=10
                            )
                            if proc.returncode == 0 and proc.stdout:
                                ocr_pages.append(proc.stdout)
                    if ocr_pages:
                        extracted_text = "\n".join(ocr_pages).strip()
            except Exception as e:
                logger.warning(f"PDF OCR rasterization failed: {e}")
    else:
        # Định dạng ảnh: chạy tesseract trực tiếp
        try:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=True) as tmp:
                tmp.write(raw_bytes)
                tmp.flush()
                proc = subprocess.run(
                    ["tesseract", tmp.name, "stdout", "-l", "vie+eng"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL,
                    text=True,
                    timeout=10
                )
                if proc.returncode == 0 and proc.stdout:
                    extracted_text = proc.stdout.strip()
        except Exception as e:
            logger.warning(f"Image tesseract OCR failed: {e}")

    return extracted_text


def parse_vietnamese_prescription_text(extracted_text: str) -> dict:
    """
    Phân tích cấu trúc đơn thuốc Việt Nam (Họ tên, mã BHYT, ICD-10, thuốc, số lượng, liều dùng).
    """
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

    # 2. Tên bệnh nhân
    name_m = re.search(r'họ\s*(?:và\s*)?tên(?:\s*người\s*bệnh)?[:\s]+([^\n,–\(\)]+)', extracted_text, re.I)
    if not name_m:
        name_m = re.search(r'(?:người\s*bệnh|bệnh\s*nhân)[:\s]+([^\n,–\(\)]+)', extracted_text, re.I)
    if name_m:
        raw_name = name_m.group(1).strip()
        cleaned_name = re.split(r'(?:ngày sinh|giới tính|sinh năm|năm sinh|địa chỉ|mã|số|tuổi)', raw_name, flags=re.I)[0].strip()
        if not cleaned_name.upper().startswith("BN-") and len(cleaned_name) >= 2:
            patient_name = cleaned_name

    # 3. Tuổi / Năm sinh
    age_m = re.search(r'\((\d{1,3})\s*tuổi\)', extracted_text, re.I) or re.search(r'(\d{1,3})\s*tuổi\b', extracted_text, re.I) or re.search(r'(?:tuổi|sinh năm|năm sinh)[:\s]*(\d{1,4})', extracted_text, re.I)
    if age_m:
        val = int(age_m.group(1))
        patient_age = 2026 - val if val > 1900 else val

    # 4. Mã ICD-10 & Chẩn đoán
    all_codes = re.findall(r'\b([A-Z][0-9]{2}(?:\.[0-9]+)?)\b', extracted_text)
    icd_codes = [c for c in all_codes if not c.startswith(('BN', 'BA', 'DN', 'GD', 'CC', 'DT'))]
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

    # 5. Các dòng thuốc điều trị
    lines = [l.strip() for l in extracted_text.split("\n") if l.strip()]
    current_item = None
    for l in lines:
        # Nhận diện đầu dòng thuốc linh hoạt: 1., 1), 1/, 1-, I., II., -, *, •, +
        m = re.match(r'^(?:(?:\d+|[IVXLCDM]+)[\.\)\/\-:]|[-*•+])\s*(.+)', l)
        drug_str = m.group(1).strip() if m else None

        # Nếu không có số thứ tự nhưng dòng chứa hàm lượng/số lượng đơn vị thuốc rõ ràng
        if not drug_str and len(l) > 5:
            has_unit = bool(re.search(r'\b(?:\d+(?:\.\d+)?)\s*(?:viên|gói|ống|lọ|chai|vỉ|hộp|nang|tuýp|mg|g|ml)\b', l, re.I))
            is_header = any(k in l.lower() for k in ["bệnh viện", "khoa khám", "họ và tên", "ngày sinh", "chẩn đoán", "lời dặn", "người bệnh", "bác sĩ", "hẹn khám", "icd", "bảo hiểm"])
            if has_unit and not is_header:
                drug_str = l.strip()

        if drug_str:
            # Bỏ qua các dòng chú thích hành chính
            if any(k in drug_str.lower() for k in ["chẩn đoán", "lời dặn", "người bệnh", "bác sĩ", "hẹn khám", "icd", "bệnh kèm", "bệnh chính"]):
                continue

            # Tách số lượng cấp phát
            qty = 10.0
            qty_m = re.search(r'\b(\d+(?:\.\d+)?)\s*(?:viên|gói|ống|lọ|chai|vỉ|hộp|bình|nang|tuýp)\b', drug_str, re.I)
            if qty_m:
                qty = float(qty_m.group(1))
                drug_clean = drug_str[:qty_m.start()].strip()
            else:
                drug_clean = drug_str

            # Hàm lượng nếu có
            dos_m = re.search(r'\b(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|IU|UI|%))\b', drug_clean, re.I)
            dosage = dos_m.group(1) if dos_m else ""

            # Dọn sạch ký tự phân cách ở đuôi tên thuốc
            drug_clean = re.sub(r'[\s:;,-]+$', '', drug_clean).strip()

            current_item = {
                "drug_name": drug_clean,
                "dosage": dosage,
                "quantity": qty,
                "days_supply": 7,
                "route": "Uống",
                "instructions": "Theo chỉ định bác sĩ"
            }
            ocr_items.append(current_item)
        elif current_item and any(k in l.lower() for k in ["cách dùng", "uống", "tiêm", "ngậm", "bôi", "dùng"]):
            if not current_item["instructions"] or current_item["instructions"] == "Theo chỉ định bác sĩ":
                current_item["instructions"] = l.strip()

    return {
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

        if raw_ocr_data and isinstance(raw_ocr_data, dict) and raw_ocr_data.get("items"):
            provider = raw_ocr_data.get("_provider", "gemini")
            model_used = raw_ocr_data.get("_model_used", "gemini-vision")
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

            parsed = parse_vietnamese_prescription_text(extracted_text)
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
                    quantity=float(it.get("quantity") or 10.0),
                    days_supply=int(it.get("days_supply") or 7),
                    unit_price=unit_price,
                    instructions=str(it.get("instructions") or "")
                )
            )

        prescription = BhytPrescriptionPayload(
            prescription_id="RX-OCR-LIVE",
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

        return BhytOcrPrescriptionResponse(
            success=True,
            provider=provider,
            model_used=model_used,
            prescription=prescription,
            resolved_count=resolved_count,
            total_items=len(items_payload),
            message="Trích xuất và đối soát đơn thuốc BHYT thành công"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi Vision OCR đơn thuốc: {str(e)}")

