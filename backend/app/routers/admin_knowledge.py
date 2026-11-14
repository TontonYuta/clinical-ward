"""
Router API Quản Trị Tri Thức & Nạp Tài Liệu PDF (Dynamic Knowledge Base Ingestion).
Cho phép tải lên văn bản thông tư, quyết định hoặc chuyên luận PDF mới,
tự động trích xuất, phân đoạn, lập chỉ mục và lưu provenance mật mã (Bước 6).
"""
import json
from pathlib import Path
from typing import Optional
from urllib.parse import quote
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from app.services.rag.pdf_ingestion_service import ingest_pdf_bytes

router = APIRouter(prefix="/admin/knowledge", tags=["Quản Trị Tri Thức & PDF RAG"])


def _manifest_path() -> Path:
    return Path(__file__).resolve().parents[2] / "data" / "knowledge_base" / "clinical_source_manifest.json"


def _public_pdf_dir() -> Path:
    candidates = (
        Path(__file__).resolve().parents[3] / "public" / "pdf",
        Path(__file__).resolve().parents[2] / "public" / "pdf",
        Path("/app/public/pdf"),
    )
    return next((candidate for candidate in candidates if candidate.is_dir()), candidates[0])


def build_document_catalog(manifest_path: Path, pdf_root: Path) -> list[dict]:
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        manifest = {}

    sources = manifest.get("sources", []) if isinstance(manifest, dict) else []
    by_path: dict[str, dict] = {}
    for source in sources:
        if not isinstance(source, dict):
            continue
        path_value = str(source.get("public_path") or "").replace("\\", "/")
        if path_value:
            by_path[path_value.removeprefix("public/pdf/")] = source
    documents = []
    if not pdf_root.is_dir():
        return documents
    for relative_path, source in sorted(by_path.items(), key=lambda item: item[0].casefold()):
        if not source.get("id") or not source.get("title"):
            continue
        pdf_path = (pdf_root / relative_path).resolve()
        if not pdf_path.is_relative_to(pdf_root.resolve()) or not pdf_path.is_file() or pdf_path.suffix.lower() != ".pdf":
            continue
        documents.append({
            "id": str(source["id"]),
            "title": str(source["title"]),
            "legal_basis": str(source.get("legal_basis") or ""),
            "category": str(source.get("category") or "Văn bản y tế"),
            "edition_year": source.get("edition_year"),
            "filename": pdf_path.name,
            "public_url": f"/api/v1/pdf/{quote(relative_path, safe='/')}",
            "sha256": str(source.get("sha256") or ""),
            "bytes": source.get("bytes") if source.get("bytes") is not None else pdf_path.stat().st_size,
        })
    return documents


@router.get("/documents")
async def list_knowledge_documents():
    """Danh sách PDF đang có trong kho ứng dụng, ghép metadata khi có manifest."""
    return {"documents": build_document_catalog(_manifest_path(), _public_pdf_dir())}


@router.post("/upload-pdf")
async def upload_and_ingest_pdf(
    file: UploadFile = File(..., description="Tệp tài liệu PDF y tế hoặc văn bản quy định"),
    title: str = Form(..., description="Tiêu đề văn bản (VD: Thông tư 26/2025/TT-BYT)"),
    legal_basis: str = Form(..., description="Căn cứ pháp lý (VD: Thông tư 26/2025/TT-BYT Kê đơn điện tử)"),
    category: str = Form("Khác", description="Loại tài liệu do người tải lên xác định"),
    edition_year: int = Form(2026, description="Năm ban hành / hiệu lực"),
    doc_id: Optional[str] = Form(None, description="Mã định danh tài liệu (tùy chọn)"),
):
    """
    Nạp và lập chỉ mục động tài liệu PDF:
    - Trích xuất văn bản từng trang bằng pypdf
    - Phân mảnh ngữ nghĩa kèm chỉ số trang
    - Tính mã băm SHA256 và lưu provenance vào manifest
    - Đưa vào SQLite FTS index sẵn sàng cho câu hỏi người dùng mà không cần sửa code.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Định dạng tệp không hợp lệ. Chỉ chấp nhận tệp có định dạng .pdf."
        )

    try:
        content = await file.read()
        safe_category = category.strip()
        result = ingest_pdf_bytes(
            file_bytes=content,
            filename=file.filename,
            title=title,
            legal_basis=legal_basis,
            edition_year=edition_year,
            doc_id=doc_id,
            category=safe_category,
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi trong quá trình trích xuất và lập chỉ mục PDF: {str(e)}"
        )
