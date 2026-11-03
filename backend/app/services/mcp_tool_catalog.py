"""
MCP Tool Catalog & JSON Schema Definitions (<=195 LOC)
Chuẩn Model Context Protocol (Anthropic & Linux Foundation 2024-2026)
"""
from app.schemas.mcp import McpToolDefinition

MCP_TOOLS: list[McpToolDefinition] = [
    McpToolDefinition(
        name="mcp_lookup_dav_drug",
        description="Tra cứu 54.885 thuốc chính thức Cục Quản lý Dược (DAV). Tìm theo biệt dược, hoạt chất hoặc số đăng ký (SĐK). Trả về nồng độ, hàm lượng, dạng dùng, nhà SX và chuyên luận lâm sàng.",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Tên biệt dược, hoạt chất hoặc số đăng ký"},
                "limit": {"type": "integer", "description": "Số lượng thuốc tối đa trả về (1-20)", "default": 5}
            },
            "required": ["query"]
        }
    ),
    McpToolDefinition(
        name="mcp_check_ddi",
        description="Kiểm tra tương tác thuốc - thuốc (DDI) chuẩn QĐ 5948/QĐ-BYT & Dược Thư QG. Nhận diện Chống chỉ định (CONTRAINDICATED), Tương tác nghiêm trọng (MAJOR), Thận trọng (MODERATE), cơ chế và xử trí.",
        inputSchema={
            "type": "object",
            "properties": {
                "drug_a": {"type": "string", "description": "Tên thuốc hoặc hoạt chất thứ nhất"},
                "drug_b": {"type": "string", "description": "Tên thuốc hoặc hoạt chất thứ hai"},
                "egfr": {"type": "number", "description": "Độ lọc cầu thận eGFR (mL/min/1.73m2)"},
                "is_pregnant": {"type": "boolean", "description": "Người bệnh đang mang thai", "default": False},
                "has_hepatic_impairment": {"type": "boolean", "description": "Suy giảm chức năng gan", "default": False}
            },
            "required": ["drug_a", "drug_b"]
        }
    ),
    McpToolDefinition(
        name="mcp_get_inventory",
        description="Tra cứu tồn kho thực tế, số lô, hạn dùng tại tủ trực/kho dược viện theo chuẩn FEFO (First Expired, First Out - TT 36/2018/TT-BYT & TT 22/2011/TT-BYT).",
        inputSchema={
            "type": "object",
            "properties": {
                "medication_name": {"type": "string", "description": "Tên thuốc hoặc hoạt chất cần kiểm tra"},
                "location": {"type": "string", "description": "Vị trí kho/tủ trực (ví dụ: Tủ trực cấp cứu A)"},
                "near_expiry_only": {"type": "boolean", "description": "Chỉ lấy các lô cận hạn (<= 90 ngày)", "default": False}
            },
            "required": ["medication_name"]
        }
    ),
    McpToolDefinition(
        name="mcp_calculate_renal_dose",
        description="Đánh giá chức năng thận theo phân tầng KDIGO và tính toán khuyến cáo hiệu chỉnh liều suy thận theo Dược Thư Quốc Gia Việt Nam 2015 & hướng dẫn KDIGO 2024.",
        inputSchema={
            "type": "object",
            "properties": {
                "drug_name": {"type": "string", "description": "Tên thuốc hoặc hoạt chất (Metformin, Ciprofloxacin, Enoxaparin...)"},
                "egfr": {"type": "number", "description": "Độ lọc cầu thận eGFR hoặc CrCl (mL/min/1.73m2)"},
                "serum_creatinine": {"type": "number", "description": "Creatinine huyết thanh (umol/L)"},
                "indication": {"type": "string", "description": "Chỉ định điều trị"}
            },
            "required": ["drug_name", "egfr"]
        }
    )
]
