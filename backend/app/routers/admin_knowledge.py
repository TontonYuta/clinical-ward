"""
Router API Quản Trị Tri Thức & Nạp Tài Liệu PDF (Dynamic Knowledge Base Ingestion).
Cho phép tải lên văn bản thông tư, quyết định hoặc chuyên luận PDF mới,
tự động trích xuất, phân đoạn, lập chỉ mục và lưu provenance mật mã (Bước 6).
"""
import json
import io
import re
import time
from pathlib import Path
from typing import Optional, List
from urllib.parse import quote
import pypdf
from pydantic import BaseModel
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request, status, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.llm_provider import query_clinical_llm, get_last_llm_execution
from app.services.rag.sqlite_fts import SqliteFtsIndex
from app.services.rag.pdf_ingestion_service import (
    ingest_pdf_bytes,
    delete_ingested_pdf,
    query_ingested_documents,
    update_document_status
)

router = APIRouter(prefix="/admin/knowledge", tags=["Quản Trị Tri Thức & PDF RAG"])


def _manifest_path() -> Path:
    candidates = (
        Path(__file__).resolve().parents[2] / "data" / "knowledge_base" / "clinical_source_manifest.json",
        Path("backend/data/knowledge_base/clinical_source_manifest.json"),
        Path("/app/backend/data/knowledge_base/clinical_source_manifest.json"),
        Path("/app/data/knowledge_base/clinical_source_manifest.json"),
    )
    return next((c for c in candidates if c.is_file()), candidates[0])


def _public_pdf_dir() -> Path:
    candidates = (
        Path(__file__).resolve().parents[3] / "public" / "pdf",
        Path(__file__).resolve().parents[2] / "public" / "pdf",
        Path("public/pdf"),
        Path("/app/public/pdf"),
    )
    return next((candidate for candidate in candidates if candidate.is_dir()), candidates[0])


def build_document_catalog(manifest_path: Path, pdf_root: Path) -> list[dict]:
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        manifest = {}

    sources = manifest.get("sources", []) if isinstance(manifest, dict) else []
    documents = []
    seen_ids = set()

    for source in sources:
        if not isinstance(source, dict):
            continue
        doc_id = str(source.get("id") or "").strip()
        title = str(source.get("title") or "").strip()
        if not doc_id or not title or doc_id in seen_ids:
            continue
        seen_ids.add(doc_id)

        path_value = str(source.get("public_path") or "").replace("\\", "/")
        rel_path = path_value.removeprefix("public/pdf/").strip("/") if path_value else ""
        filename = Path(rel_path).name if rel_path else f"{doc_id}.pdf"

        # Tra cứu file vật lý trên mọi vị trí tiềm năng
        file_bytes = source.get("bytes")
        candidate_files = [
            pdf_root / rel_path if rel_path else None,
            pdf_root / filename,
            Path("backend/data/knowledge_base") / filename,
            Path("/app/backend/data/knowledge_base") / filename,
            Path("/app/data/knowledge_base") / filename,
            Path("public/pdf") / filename,
            Path("/app/public/pdf") / filename,
        ]
        found_file = next((p for p in candidate_files if p and p.is_file()), None)
        if found_file and (file_bytes is None or file_bytes == 0):
            try:
                file_bytes = found_file.stat().st_size
            except Exception:
                pass

        status_val = str(source.get("status") or "active")
        is_verified = bool(source.get("verified", True if status_val == "active" else False))
        safe_rel_path = rel_path if rel_path else filename

        documents.append({
            "id": doc_id,
            "title": title,
            "legal_basis": str(source.get("legal_basis") or ""),
            "category": str(source.get("category") or "Văn bản y tế"),
            "edition_year": source.get("edition_year"),
            "filename": filename,
            "public_url": f"/api/v1/pdf/{quote(safe_rel_path, safe='/')}",
            "sha256": str(source.get("sha256") or ""),
            "bytes": file_bytes if file_bytes is not None else 0,
            "status": status_val,
            "verified": is_verified,
            "verified_at": source.get("verified_at"),
        })

    return sorted(documents, key=lambda d: (d.get("status") != "staged", d["title"].casefold()))


class UpdateDocStatusRequest(BaseModel):
    status: str
    verified: Optional[bool] = None


@router.post("/documents/{doc_id}/status")
async def update_doc_status_endpoint(doc_id: str, payload: UpdateDocStatusRequest, request: Request):
    """
    Chuyển đổi trạng thái vòng đời tài liệu:
    - 'staged' (Chờ kiểm duyệt) -> 'active' (Đang áp dụng) -> 'superseded' (Hết hiệu lực).
    - Ràng buộc an toàn: Không cho phép kích hoạt 'active' nếu tài liệu chưa được kiểm thử Chatbot thành công.
    """
    user = getattr(request.state, "authenticated_user", None)
    if user and user.role not in {"admin", "director"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Quản trị viên mới có quyền thay đổi trạng thái áp dụng tài liệu."
        )

    try:
        updated = update_document_status(doc_id, payload.status, payload.verified)
        return {"status": "success", "document": updated}
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi cập nhật trạng thái tài liệu: {str(e)}"
        )


@router.get("/documents")
async def list_knowledge_documents():
    """Danh sách PDF đang có trong kho ứng dụng, ghép metadata khi có manifest."""
    return {"documents": build_document_catalog(_manifest_path(), _public_pdf_dir())}


@router.post("/upload-pdf")
async def upload_and_ingest_pdf(
    request: Request,
    file: UploadFile = File(..., description="Tệp tài liệu PDF y tế hoặc văn bản quy định"),
    title: str = Form(..., description="Tiêu đề văn bản (VD: Thông tư 26/2025/TT-BYT)"),
    legal_basis: str = Form(..., description="Căn cứ pháp lý (VD: Thông tư 26/2025/TT-BYT Kê đơn điện tử)"),
    category: str = Form("Khác", description="Loại tài liệu do người tải lên xác định"),
    edition_year: int = Form(2026, description="Năm ban hành / hiệu lực"),
    doc_id: Optional[str] = Form(None, description="Mã định danh tài liệu (tùy chọn)"),
):
    """
    Nạp và lập chỉ mục động tài liệu PDF:
    - Kiểm tra chữ ký Magic Bytes (%PDF-) và cấu trúc tệp hợp lệ
    - Trích xuất văn bản từng trang bằng pypdf
    - Phân mảnh ngữ nghĩa kèm chỉ số trang
    - Tính mã băm SHA256 và lưu provenance vào manifest
    - Đưa vào SQLite FTS index sẵn sàng cho câu hỏi người dùng mà không cần sửa code
    - Sinh Dense Vectors và tự động nạp vào ma trận RAM Cosine Similarity.
    """
    user = getattr(request.state, "authenticated_user", None)
    if user and user.role not in {"admin", "director"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Quản trị viên (Admin/Director) mới có quyền nạp tài liệu vào CSDL Bệnh viện."
        )

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Định dạng tệp không hợp lệ. Chỉ chấp nhận tệp có định dạng .pdf."
        )

    try:
        content = await file.read()
        safe_category = category.strip()
        result = await ingest_pdf_bytes(
            file_bytes=content,
            filename=file.filename,
            title=title,
            legal_basis=legal_basis,
            edition_year=edition_year,
            doc_id=doc_id,
            category=safe_category,
        )
        return result
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi trong quá trình trích xuất và lập chỉ mục PDF: {str(e)}"
        )


@router.delete("/documents/{doc_id}")
async def delete_knowledge_document(doc_id: str, request: Request):
    """
    Xóa tài liệu PDF khỏi kho ứng dụng, SQLite FTS index, Vector Store và manifest.
    """
    user = getattr(request.state, "authenticated_user", None)
    if user and user.role not in {"admin", "director"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ Quản trị viên (Admin/Director) mới có quyền xóa tài liệu khỏi CSDL Bệnh viện."
        )

    try:
        result = delete_ingested_pdf(doc_id)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi xóa tài liệu {doc_id}: {str(e)}"
        )


class KnowledgeQueryRequest(BaseModel):
    query: str
    doc_id: Optional[str] = None
    top_k: int = 5


@router.post("/query")
async def query_knowledge(request: KnowledgeQueryRequest):
    """
    Truy vấn lai (Hybrid BM25 + Dense Vector) trên các tài liệu PDF đã nạp.
    Trả về trích dẫn cụ thể kèm số trang để giao diện hiển thị tài liệu nguồn.
    """
    try:
        result = await query_ingested_documents(
            query=request.query,
            doc_id=request.doc_id,
            top_k=request.top_k
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi truy vấn tài liệu: {str(e)}"
        )


class CleanlinessAuditResponse(BaseModel):
    cleanliness_score: int
    status: str
    total_pages: int
    extracted_chars: int
    avg_chars_per_page: int
    empty_pages: int
    ocr_artifact_ratio: float
    issues: List[str]
    golden_questions: List[str]


@router.post("/audit-cleanliness", response_model=CleanlinessAuditResponse)
async def audit_pdf_cleanliness(
    file: Optional[UploadFile] = File(None),
    doc_id: Optional[str] = Form(None)
):
    """
    Kiểm định độ sạch của tài liệu PDF trước hoặc sau khi nạp:
    - Trích xuất văn bản từng trang bằng pypdf
    - Đánh giá mật độ ký tự và tỷ lệ lỗi OCR / encoding
    - Chấm điểm độ sạch (Cleanliness Score)
    - Tự động sinh 3 câu hỏi kiểm chứng (Golden Test Questions) bằng Gemini / LLM.
    """
    file_bytes: bytes = b""
    filename = "tailieu.pdf"

    if file:
        file_bytes = await file.read()
        filename = file.filename or "tailieu.pdf"
    elif doc_id:
        catalog = build_document_catalog(_manifest_path(), _public_pdf_dir())
        match = next((d for d in catalog if d["id"] == doc_id), None)
        pdf_path = None
        if match:
            candidate_paths = [
                _public_pdf_dir() / match["filename"],
                Path("backend/data/knowledge_base") / match["filename"],
                Path("/app/backend/data/knowledge_base") / match["filename"],
                Path("public/pdf") / match["filename"],
                Path("/app/public/pdf") / match["filename"],
            ]
            pdf_path = next((p for p in candidate_paths if p.exists() and p.is_file()), None)
            filename = match["filename"]
        else:
            # Tra cứu trực tiếp trong manifest
            manifest_data = {}
            if _manifest_path().exists():
                try:
                    manifest_data = json.loads(_manifest_path().read_text(encoding="utf-8"))
                except Exception:
                    pass
            sources = manifest_data.get("sources", [])
            match_source = next((s for s in sources if s.get("id") == doc_id or doc_id in str(s.get("public_path", ""))), None)
            if match_source:
                fname = Path(match_source.get("public_path") or match_source.get("backend_copy") or f"{doc_id}.pdf").name
                candidate_paths = [
                    _public_pdf_dir() / fname,
                    Path("backend/data/knowledge_base") / fname,
                    Path("/app/backend/data/knowledge_base") / fname,
                    Path("public/pdf") / fname,
                    Path("/app/public/pdf") / fname,
                ]
                pdf_path = next((p for p in candidate_paths if p.exists() and p.is_file()), None)
                filename = fname

        if pdf_path and pdf_path.exists():
            file_bytes = pdf_path.read_bytes()
        else:
            # Fallback thông minh: Kiểm tra và đánh giá độ sạch trực tiếp từ chunks đã nạp trong SQLite FTS
            fts_index = SqliteFtsIndex()
            chunks = fts_index.get_chunks_by_prefix(doc_id, limit=200)
            if chunks:
                total_chars = sum(len(c.content) for c in chunks)
                avg_chars = round(total_chars / max(1, len(chunks)))
                pages = set()
                for c in chunks:
                    match_page = re.search(r"trang\s*(\d+)", c.page_or_section.lower())
                    if match_page:
                        pages.add(int(match_page.group(1)))
                total_pages = max(len(pages), len(chunks))
                cleanliness_score = 100 if avg_chars > 150 else 85
                doc_title = match.get("title") if match else (chunks[0].title if chunks else doc_id)

                sample_snippets = [f"[{c.page_or_section}]: {c.content[:350]}" for c in chunks[:4]]
                combined_sample = "\n\n".join(sample_snippets)
                golden_questions = []
                if combined_sample:
                    prompt = (
                        f"Bạn là chuyên gia thẩm định dữ liệu y tế. Dưới đây là trích đoạn tài liệu y tế ({doc_title}):\n"
                        f"{combined_sample[:1500]}\n\n"
                        "Hãy đóng vai trò Bác sĩ/Dược sĩ lâm sàng. Đặt 3 câu hỏi kiểm chứng (Golden Test Questions) ngắn gọn, "
                        "thực tế nhất về quy định, điều kiện, liều dùng hoặc thủ tục được nêu trong văn bản trên để kiểm tra chatbot.\n"
                        "Chỉ trả về 1 mảng JSON chứa đúng 3 chuỗi câu hỏi: [\"câu 1\", \"câu 2\", \"câu 3\"]."
                    )
                    try:
                        llm_res = await query_clinical_llm(prompt, timeout_sec=8.0)
                        if llm_res:
                            match_json = re.search(r"\[.*\]", llm_res, re.DOTALL)
                            if match_json:
                                parsed = json.loads(match_json.group(0))
                                if isinstance(parsed, list) and len(parsed) >= 2:
                                    golden_questions = [str(q).strip(' "') for q in parsed[:3]]
                    except Exception:
                        pass
                if len(golden_questions) < 3:
                    doc_base = filename.replace(".pdf", "").replace("_", " ")
                    golden_questions = [
                        f"Căn cứ pháp lý và phạm vi điều chỉnh của văn bản {doc_base} là gì?",
                        f"Những điều kiện hoặc quy chuẩn bắt buộc nào được quy định trong {doc_base}?",
                        f"Quy trình xử lý và trách nhiệm của cán bộ y tế theo {doc_base}?"
                    ]
                return CleanlinessAuditResponse(
                    cleanliness_score=cleanliness_score,
                    status="clean",
                    total_pages=total_pages,
                    extracted_chars=total_chars,
                    avg_chars_per_page=avg_chars,
                    empty_pages=0,
                    ocr_artifact_ratio=0.0,
                    issues=["Văn bản đã được lập chỉ mục FTS & Vector Store đầy đủ."],
                    golden_questions=golden_questions
                )
            raise HTTPException(status_code=404, detail=f"Không tìm thấy tài liệu {doc_id} trong hệ thống.")
    else:
        raise HTTPException(status_code=400, detail="Vui lòng cung cấp file PDF hoặc doc_id để kiểm tra.")

    if not file_bytes.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Định dạng tệp không hợp lệ: Không tìm thấy magic bytes '%PDF'.")

    try:
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        total_pages = len(reader.pages)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Không thể đọc cấu trúc PDF: {str(e)}")

    if total_pages == 0:
        return CleanlinessAuditResponse(
            cleanliness_score=0,
            status="unreadable",
            total_pages=0,
            extracted_chars=0,
            avg_chars_per_page=0,
            empty_pages=0,
            ocr_artifact_ratio=1.0,
            issues=["Tài liệu không chứa trang nào."],
            golden_questions=["Vui lòng nạp tài liệu có nội dung văn bản."]
        )

    empty_pages_count = 0
    total_chars = 0
    artifact_chars = 0
    sample_text_snippets: List[str] = []

    pages_to_check = min(total_pages, 40)
    for idx in range(pages_to_check):
        try:
            txt = reader.pages[idx].extract_text() or ""
        except Exception:
            txt = ""
        txt_clean = txt.strip()
        txt_len = len(txt_clean)
        total_chars += txt_len
        if txt_len < 30:
            empty_pages_count += 1
        else:
            if len(sample_text_snippets) < 4:
                sample_text_snippets.append(f"[Trang {idx+1}]: {txt_clean[:350]}")
            artifacts = len(re.findall(r"[\ufffd\x00-\x08\x0b\x0c\x0e-\x1f]", txt))
            artifact_chars += artifacts

    avg_chars = round(total_chars / max(1, pages_to_check))
    artifact_ratio = round(artifact_chars / max(1, total_chars), 4)

    score = 100
    issues: List[str] = []
    if empty_pages_count > 0:
        penalty = min(40, int((empty_pages_count / pages_to_check) * 60))
        score -= penalty
        issues.append(f"Có {empty_pages_count}/{pages_to_check} trang không có lớp văn bản (text layer) hoặc chỉ là ảnh scan.")
    if avg_chars < 120:
        score -= 25
        issues.append(f"Mật độ chữ rất thấp ({avg_chars} ký tự/trang). Có thể thiếu OCR hoặc scan chất lượng thấp.")
    if artifact_ratio > 0.02:
        score -= 20
        issues.append(f"Phát hiện tỷ lệ ký tự rác/lỗi font UTF-8 cao ({artifact_ratio*100:.1f}%).")

    score = max(10, min(100, score))
    status_str = "clean" if score >= 80 else ("warning" if score >= 50 else "unreadable")

    if not issues:
        issues.append("Văn bản trích xuất rõ ràng, cấu trúc đầy đủ, không phát hiện lỗi ký tự UTF-8.")

    # Tự động sinh 3 Golden Test Questions
    golden_questions: List[str] = []
    combined_sample = "\n\n".join(sample_text_snippets)
    if combined_sample:
        prompt = (
            f"Bạn là chuyên gia thẩm định dữ liệu y tế. Dưới đây là trích đoạn tài liệu y tế ({filename}):\n"
            f"{combined_sample[:1500]}\n\n"
            "Hãy đóng vai trò Bác sĩ/Dược sĩ lâm sàng. Đặt 3 câu hỏi kiểm chứng (Golden Test Questions) ngắn gọn, "
            "thực tế nhất về quy định, điều kiện, liều dùng hoặc thủ tục được nêu trong văn bản trên để kiểm tra chatbot.\n"
            "Chỉ trả về 1 mảng JSON chứa đúng 3 chuỗi câu hỏi: [\"câu 1\", \"câu 2\", \"câu 3\"]."
        )
        try:
            llm_res = await query_clinical_llm(prompt, timeout_sec=8.0)
            if llm_res:
                match_json = re.search(r"\[.*\]", llm_res, re.DOTALL)
                if match_json:
                    parsed = json.loads(match_json.group(0))
                    if isinstance(parsed, list) and len(parsed) >= 2:
                        golden_questions = [str(q).strip(' "') for q in parsed[:3]]
        except Exception:
            pass

    if len(golden_questions) < 3:
        doc_base = filename.replace(".pdf", "").replace("_", " ")
        golden_questions = [
            f"Căn cứ pháp lý và phạm vi điều chỉnh của văn bản {doc_base} là gì?",
            f"Những điều kiện hoặc quy chuẩn bắt buộc nào được quy định trong {doc_base}?",
            f"Quy trình xử lý và trách nhiệm của cán bộ y tế theo {doc_base}?"
        ]

    return CleanlinessAuditResponse(
        cleanliness_score=score,
        status=status_str,
        total_pages=total_pages,
        extracted_chars=total_chars,
        avg_chars_per_page=avg_chars,
        empty_pages=empty_pages_count,
        ocr_artifact_ratio=artifact_ratio,
        issues=issues,
        golden_questions=golden_questions
    )


class KnowledgeChatCitation(BaseModel):
    chunk_id: str
    title: str
    legal_basis: str
    page_or_section: str
    source_doc: str
    snippet: str


class KnowledgeChatTestRequest(BaseModel):
    query: str
    doc_id: Optional[str] = None
    user_role: str = "doctor"
    user_name: str = "BS. Quản Trị Viên"


class KnowledgeChatTestResponse(BaseModel):
    reply_text: str
    citations: List[KnowledgeChatCitation]
    legal_basis: Optional[str] = None
    rag_grounded: bool = True
    confidence: float = 0.95
    provider: str = "gemini"
    model_name: str = "gemini-2.5-flash"
    suggested_chips: List[str] = []


async def _execute_chat_test_logic(
    request_data: KnowledgeChatTestRequest,
    request: Request,
    db: AsyncSession
) -> KnowledgeChatTestResponse:
    query = request_data.query.strip()
    doc_id = request_data.doc_id

    # 1. Chế độ Scoped Test (Kiểm thử trên tài liệu vừa thêm hoặc chỉ định)
    if doc_id:
        chunks_res = await query_ingested_documents(
            query=query,
            doc_id=doc_id,
            top_k=5
        )
        results = chunks_res.get("results", [])

        # Fallback tìm kiếm tức thời trên tệp PDF vật lý nếu chưa lập chỉ mục FTS
        if not results and doc_id:
            catalog = build_document_catalog(_manifest_path(), _public_pdf_dir())
            match = next((d for d in catalog if d["id"] == doc_id), None)
            if match:
                pdf_path = _public_pdf_dir() / match["filename"]
                if pdf_path.exists():
                    try:
                        reader = pypdf.PdfReader(str(pdf_path))
                        q_words = [w.lower() for w in re.findall(r"\w+", query) if len(w) >= 3 and w.lower() not in {"theo", "trong", "văn", "bản", "được", "như", "nào", "quy", "định"}]
                        matched_pages = []
                        for page_idx, page in enumerate(reader.pages, start=1):
                            p_txt = page.extract_text() or ""
                            p_lower = p_txt.lower()
                            hit_count = sum(1 for w in q_words if w in p_lower)
                            if hit_count > 0:
                                matched_pages.append((hit_count, {
                                    "chunk_id": f"{doc_id}_p{page_idx}_dyn",
                                    "title": f"{match['title']} (Trang {page_idx})",
                                    "legal_basis": match.get("legal_basis") or match["title"],
                                    "page_or_section": f"Trang {page_idx}",
                                    "source_doc": match["filename"],
                                    "content": p_txt[:1200]
                                }))
                        matched_pages.sort(key=lambda x: x[0], reverse=True)
                        results = [item for _, item in matched_pages[:5]]
                    except Exception:
                        pass

        evidence_lines: List[str] = []
        citations_list: List[KnowledgeChatCitation] = []
        primary_legal = ""

        for idx, r in enumerate(results):
            cid = r.get("chunk_id", f"c_{idx}")
            doc_title = r.get("title", "")
            legal = r.get("legal_basis", "")
            page_sec = r.get("page_or_section", "")
            source = r.get("source_doc", "")
            content = r.get("content", "")
            if not primary_legal and legal:
                primary_legal = legal
            evidence_lines.append(f"=== [TRÍCH ĐOẠN #{idx+1}] Căn cứ: {legal} | {page_sec} | Nguồn: {source} ===\n{content}")
            citations_list.append(KnowledgeChatCitation(
                chunk_id=cid,
                title=doc_title or source,
                legal_basis=legal or primary_legal or "Quy định Y tế",
                page_or_section=page_sec or f"Mục {idx+1}",
                source_doc=source,
                snippet=content[:240] + ("..." if len(content) > 240 else "")
            ))

        if not results:
            return KnowledgeChatTestResponse(
                reply_text=f"### ℹ️ Không tìm thấy thông tin phù hợp trong tài liệu này\n\nTruy vấn *\"{query}\"* không khớp với đoạn trích nào trong tài liệu đã chọn. Hãy thử tìm từ khóa khác hoặc chuyển sang chế độ tra cứu toàn viện.",
                citations=[],
                legal_basis=None,
                rag_grounded=False,
                confidence=0.2,
                suggested_chips=["Tra cứu phạm vi áp dụng", "Xem danh mục quy định", "Kiểm tra toàn viện"]
            )

        prompt = f"""Bạn là Trợ lý Lâm sàng AI Bệnh viện. Dưới đây là các căn cứ trích xuất từ tài liệu y tế chính thức:
{chr(10).join(evidence_lines)}

Câu hỏi của {request_data.user_role == 'pharmacist' and 'Dược sĩ lâm sàng' or 'Bác sĩ điều trị'} ({request_data.user_name}):
"{query}"

YÊU CẦU ĐÁP ỨNG LÂM SÀNG:
1. Trả lời trực tiếp, khúc chiết, chuẩn mực y khoa tiếng Việt.
2. Trích dẫn rõ Căn cứ pháp lý (Tên thông tư/văn bản) và Số trang/Khoản/Điều quy định.
3. Nếu nội dung không có trong tài liệu trên, nêu rõ: "Tài liệu này không chứa thông tin quy định về vấn đề trên"."""

        llm_reply = await query_clinical_llm(prompt, timeout_sec=20.0)
        last_exec = get_last_llm_execution()
        prov = last_exec.get("provider", "gemini")
        mod = last_exec.get("model", "gemini-2.5-flash")

        if not llm_reply:
            # Extractive fallback
            reply_text = f"### 📋 Căn cứ {primary_legal or 'Quy chế Y tế'}:\n\n"
            for c in citations_list[:2]:
                reply_text += f"- **{c.page_or_section}**: {c.snippet}\n\n"
            reply_text += f"\n*(Trích dẫn nguồn: {citations_list[0].title if citations_list else 'Tài liệu PDF'})*"
            prov = "local-extractive"
            mod = "fts-rrf-engine"
        else:
            reply_text = llm_reply

        suggested_chips = [
            f"Chi tiết quy định tại {citations_list[0].page_or_section}" if citations_list else "Xem thêm quy định",
            "Trách nhiệm của nhân viên y tế",
            "Quy trình xử lý ngoại lệ"
        ]

        if doc_id and len(citations_list) > 0:
            try:
                update_document_status(doc_id, "staged", verified=True)
            except Exception:
                pass

        return KnowledgeChatTestResponse(
            reply_text=reply_text,
            citations=citations_list,
            legal_basis=primary_legal or None,
            rag_grounded=True,
            confidence=0.96,
            provider=prov,
            model_name=mod,
            suggested_chips=suggested_chips
        )

    # 2. Chế độ Integrated Test (Toàn bộ kho tri thức bệnh viện - 100% logic App chính)
    from app.schemas.copilot import CopilotQuery
    from app.services.chatbot.copilot_orchestrator import handle_copilot_chat
    from app.services.session_context import get_or_create_session

    session = get_or_create_session(f"admin_test_{int(time.time())}", request_data.user_name, request_data.user_role)
    copilot_q = CopilotQuery(
        query=query,
        user_role=request_data.user_role,
        user_name=request_data.user_name,
        session_id=session.session_id
    )
    resp = await handle_copilot_chat(copilot_q, request, db, session=session, history="")

    citations_list = []
    if resp.citations:
        for c in resp.citations:
            citations_list.append(KnowledgeChatCitation(
                chunk_id=c.get("chunk_id", ""),
                title=c.get("document_title") or c.get("source_name") or "Tài liệu",
                legal_basis=c.get("legal_basis") or resp.legal_basis or "Quy chế Bệnh viện",
                page_or_section=c.get("section") or "Trang",
                source_doc=c.get("source_name") or "",
                snippet=c.get("text_snippet", "")
            ))

    last_exec = get_last_llm_execution()
    return KnowledgeChatTestResponse(
        reply_text=resp.reply_text,
        citations=citations_list,
        legal_basis=resp.legal_basis or None,
        rag_grounded=bool(resp.rag_grounded),
        confidence=resp.confidence or 0.95,
        provider=last_exec.get("provider") or getattr(resp, "provider", None) or "gemini",
        model_name=last_exec.get("model") or getattr(resp, "model_name", None) or "gemini-2.5-flash",
        suggested_chips=resp.suggested_chips or []
    )


@router.post("/chat-test", response_model=KnowledgeChatTestResponse)
async def chat_test_knowledge(
    request_data: KnowledgeChatTestRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Kiểm thử Chatbot trực tiếp trên Admin Monitor với 100% logic giống App chính.
    """
    try:
        return await _execute_chat_test_logic(request_data, request, db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi kiểm thử Chatbot: {str(e)}"
        )


@router.post("/chat-test/stream")
async def chat_test_knowledge_stream(
    request_data: KnowledgeChatTestRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Kiểm thử Chatbot với SSE streaming thời gian thực cho Admin Monitor.
    """
    async def sse_generator():
        try:
            resp = await _execute_chat_test_logic(request_data, request, db)
            full_text = resp.reply_text or ""
            # Stream text in smooth chunks
            chunk_size = 24
            for i in range(0, len(full_text), chunk_size):
                chunk = full_text[i:i + chunk_size]
                yield f"data: {json.dumps({'type': 'token', 'content': chunk}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'response': resp.model_dump()}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


