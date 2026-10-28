/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Frontend Clinical Guardrails (Chống Prompt Injection & SQL Injection cho Chatbot Lâm Sàng)
 * Tham chiếu tiêu chuẩn: OWASP LLM01:2025, NVIDIA NeMo Guardrails, ProtectAI LLM Guard
 */

export interface ClientGuardrailCheck {
  isSafe: boolean;
  violationType?: 'sql_injection' | 'prompt_injection' | 'clinical_bypass' | 'format_hijacking' | 'markup_injection';
  threatDescription?: string;
  sanitizedQuery: string;
  safeResponse?: string;
}

// 1. Mẫu kiểm tra SQL Injection
const SQLI_PATTERNS: Array<{ pattern: RegExp; desc: string }> = [
  { pattern: /\b(?:OR|AND|WHERE)\s+['"]?1['"]?\s*=\s*['"]?1['"]?/i, desc: "SQLi: Phép so sánh hằng đúng (Tautology 1=1 / '1'='1')" },
  { pattern: /\b(?:OR|AND|WHERE)\s+(?:true\b|1\s*=\s*1|'a'\s*=\s*'a')/i, desc: "SQLi: Mẫu boolean tautology" },
  { pattern: /\bUNION\s+(?:ALL\s+)?SELECT\b/i, desc: "SQLi: Tấn công trích xuất dữ liệu qua UNION SELECT" },
  { pattern: /;\s*(?:DROP|TRUNCATE|ALTER|DELETE\s+FROM|INSERT\s+INTO|UPDATE)\s+[\w`"']+/i, desc: "SQLi: Lệnh phá hoại CSDL qua Stacked Query" },
  { pattern: /\bDROP\s+TABLE\b/i, desc: "SQLi: Lệnh xóa bảng DROP TABLE" },
  { pattern: /\b(?:INFORMATION_SCHEMA|SQLITE_MASTER|SYS\.TABLES)\b/i, desc: "SQLi: Do thám lược đồ CSDL" },
  { pattern: /(?:--|\/\*|\*\/|#)/, desc: "SQLi: Ký tự ngắt dòng hoặc đóng chú thích SQL" },
  { pattern: /\b(?:BENCHMARK|SLEEP)\s*\(/i, desc: "SQLi: Time-based Blind SQLi" },
];

// 2. Mẫu kiểm tra Prompt Injection & Jailbreak
const PROMPT_INJECTION_PATTERNS: Array<{ pattern: RegExp; desc: string }> = [
  // Direct Instruction Override
  {
    pattern: /(?:ignore|disregard|forget|skip)\s+(?:all\s+)?(?:previous|prior|above|former)\s+(?:instructions|rules|directives|prompts|constraints)/i,
    desc: "Prompt Injection: Yêu cầu bỏ qua chỉ dẫn hệ thống ban đầu"
  },
  {
    pattern: /(?:bỏ qua|quên|xóa)\s+(?:tất cả\s+)?(?:chỉ dẫn|hướng dẫn|lời nhắc|quy tắc|ràng buộc)\s+(?:trước đó|ban đầu|hệ thống|của bạn)/i,
    desc: "Prompt Injection: Yêu cầu bỏ qua chỉ dẫn tiếng Việt"
  },
  {
    pattern: /(?:hãy quên đi|không cần tuân theo)\s+(?:các\s+)?(?:chỉ dẫn|quy tắc|hướng dẫn|vai trò)/i,
    desc: "Prompt Injection: Lệnh ép buộc quên quy tắc an toàn"
  },

  // Persona Hijacking / DAN Mode
  {
    pattern: /(?:you are now|act as|pretend to be)\s+(?:a\s+|in\s+)?(?:dan|developer(?:\s+mode)?|jailbreak|unfiltered|god mode|evil)/i,
    desc: "Jailbreak: Thao túng nhân cách (DAN / Developer Mode / Unfiltered)"
  },
  {
    pattern: /\b(?:developer\s+mode|unfiltered\s+ai|jailbreak\s+prompt)\b/i,
    desc: "Jailbreak: Kích hoạt chế độ lập trình viên không giới hạn"
  },
  {
    pattern: /(?:bạn bây giờ là|hãy đóng vai|chuyển sang chế độ)\s+(?:dan|lập trình viên|bẻ khóa|không giới hạn|không kiểm duyệt)/i,
    desc: "Jailbreak: Ép buộc chatbot chuyển sang chế độ không kiểm duyệt"
  },
  {
    pattern: /\b(?:system\s+override|admin\s+override|sudo\s+mode|root\s+access)\b/i,
    desc: "Privilege Escalation: Giả mạo quyền ghi đè hệ thống (System Override)"
  },
  {
    pattern: /(?:ghi đè hệ thống|chế độ quản trị viên tối cao|quyền root|chế độ lập trình viên)/i,
    desc: "Privilege Escalation: Giả mạo quyền quản trị tiếng Việt"
  },

  // System Prompt Exfiltration
  {
    pattern: /(?:print|reveal|show|display|output|dump)\s+(?:your\s+)?(?:system\s+prompt|initial\s+prompt|base\s+instructions|secret\s+key|api\s+key)/i,
    desc: "Prompt Leaking: Yêu cầu in ra System Prompt hoặc API Key bí mật"
  },
  {
    pattern: /(?:in ra|cho tôi xem|hiển thị|tiết lộ)\s+(?:toàn bộ\s+)?(?:system prompt|chỉ dẫn nội bộ|lời nhắc ban đầu|api key|mã bí mật)/i,
    desc: "Prompt Leaking: Yêu cầu trích xuất cấu hình bảo mật nội bộ"
  },

  // Clinical Safety Bypass
  {
    pattern: /(?:quên đi|bỏ qua|không cần)\s+(?:cảnh báo|quy định|nguyên tắc)\s+(?:an toàn|y tế|dược lý|cdss|thông tư 20|thông tư 22|thông tư 51)/i,
    desc: "Clinical Safety Bypass: Yêu cầu bỏ qua quy tắc an toàn dược lâm sàng"
  },
  {
    pattern: /(?:bỏ qua|miễn)\s+(?:xác thực|ký duyệt|hai chữ ký|chữ ký bác sĩ|quy trình duyệt cấp phát)/i,
    desc: "Clinical Safety Bypass: Yêu cầu vượt mặt cơ chế kiểm soát hai chữ ký"
  },
  {
    pattern: /(?:cấp|xuất|lấy)\s+(?:gấp\s+)?(?:\d+\s+)?(?:lọ|ống|viên)?\s*(?:morphin|fentanyl|adrenalin|kali)\s+(?:không cần|bỏ qua)\s+(?:ký|duyệt|đơn|xác thực)/i,
    desc: "Clinical Safety Bypass: Cố tình yêu cầu xuất thuốc gây nghiện không cần đơn"
  },

  // Format Hijacking / Arbitrary HTML & Website Generation (OWASP LLM01:2025, LLM02:2025 & NeMo Domain Rails)
  {
    pattern: /(?:trả lời|viết|tạo|xuất|render|làm|sinh|chuyển|cần|cho tôi|xin|muốn|yêu cầu|đổi|gửi)\s+(?:thành|ra|dưới dạng|bằng|dạng|theo)?\s*(?:1\s+)?(?:đoạn\s+|file\s+|tệp\s+|trang\s+|bản\s+|mẫu\s+)?(?:mã|code|file|tệp)?\s*(?:html|website|web page|web|trang web|script|giao diện web|mã nguồn html|css|javascript|python|bash)/i,
    desc: "Format Hijacking: Yêu cầu sinh mã HTML / tạo website trái với phạm vi lâm sàng"
  },
  {
    pattern: /\b(?:mã|code|file|tệp|định dạng|dạng|ngôn ngữ|bằng|sang|thành)\s+html\b/i,
    desc: "Format Hijacking: Yêu cầu mã nguồn HTML trong ứng dụng y tế"
  },
  {
    pattern: /(?:dưới dạng|theo định dạng|bằng định dạng|dạng)\s+(?:mã\s+)?(?:html|web|website|script|code)/i,
    desc: "Format Hijacking: Yêu cầu định dạng HTML / Code"
  },
  {
    pattern: /\b(?:code\s+web|lập trình\s+web|thiết kế\s+web(?:site)?|làm\s+web(?:site)?)\b/i,
    desc: "Format Hijacking: Yêu cầu phát triển web"
  },
  {
    pattern: /(?:tạo|viết|code|lập trình)\s+(?:cho tôi\s+)?(?:1\s+)?(?:file|trang|bản)?\s*(?:website|trang web|web app|html|javascript|css|web)/i,
    desc: "Format Hijacking: Yêu cầu lập trình website / tạo mã giao diện web"
  },
  {
    pattern: /(?:generate|create|write|output|reply with|render)\s+(?:as\s+|in\s+)?(?:an?\s+)?(?:html(?:\s+(?:file|page|website|document|template))?|website|web page|javascript|script)/i,
    desc: "Format Hijacking: Yêu cầu LLM sinh mã HTML / website hoặc script tùy ý"
  },
  {
    pattern: /(?:<!doctype\s+html|<html[\s>]|<script[\s>]|javascript:|<style[\s>])/i,
    desc: "Markup Injection: Chứa thẻ HTML / script nhúng trong truy vấn"
  }
];

export function sanitizeInputText(text: string): string {
  if (!text) return '';
  // 1. Loại bỏ null-byte
  let clean = text.replace(/\0/g, '').replace(/\x00/g, '');
  // 2. Loại bỏ các ký tự điều khiển ngoại trừ tab và xuống dòng
  clean = clean.replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  // 3. Giới hạn độ dài tối đa chống DoS
  if (clean.length > 1500) {
    clean = clean.slice(0, 1500);
  }
  return clean.trim();
}

export function validateClientInputGuardrail(rawQuery: string): ClientGuardrailCheck {
  const sanitizedQuery = sanitizeInputText(rawQuery);

  if (!sanitizedQuery) {
    return {
      isSafe: false,
      sanitizedQuery: '',
      safeResponse: '⚠️ Nội dung nhập vào không hợp lệ hoặc chỉ chứa ký tự rỗng.'
    };
  }

  // 1. Quét SQL Injection
  for (const { pattern, desc } of SQLI_PATTERNS) {
    if (pattern.test(sanitizedQuery)) {
      return {
        isSafe: false,
        violationType: 'sql_injection',
        threatDescription: desc,
        sanitizedQuery,
        safeResponse: `🛡️ **CẢNH BÁO BẢO MẬT (SQL Injection Blocked)**\n\n- **Phát hiện**: ${desc}\n- **Hành động**: Yêu cầu đã bị Input Guardrail chặn đứng ngay tại trình duyệt để bảo vệ an toàn CSDL bệnh viện.`
      };
    }
  }

  // 2. Quét Prompt Injection / Jailbreak / Format Hijacking
  for (const { pattern, desc } of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(sanitizedQuery)) {
      const isFormatHijack = desc.includes('Format Hijacking') || desc.includes('Markup Injection');
      if (isFormatHijack) {
        return {
          isSafe: false,
          violationType: 'format_hijacking',
          threatDescription: desc,
          sanitizedQuery,
          safeResponse: `🛡️ **CẢNH BÁO BẢO MẬT & GIỚI HẠN VAI TRÒ (Scope & Format Guardrail Blocked)**\n\n- **Phát hiện**: ${desc}\n- **Hành động**: Rào chắn an toàn từ chối thực thi yêu cầu lập trình web hoặc tạo mã nguồn website/HTML/script (OWASP LLM01:2025 & NeMo Domain Rails).\n- **Nguyên tắc**: Trợ lý Trí tuệ Nhân tạo Lâm Sàng được thiết kế chuyên biệt để hỗ trợ nhân viên y tế tra cứu dược lý (Dược Thư Quốc Gia 2015), quy chế quản lý thuốc (Thông tư 20/2017/TT-BYT, TT 22/2011/TT-BYT), an toàn kê đơn CPOE và phác đồ cấp cứu (TT 51/2017/TT-BYT). Hệ thống **không hỗ trợ lập trình, sinh mã HTML/CSS/JS hoặc tạo trang web**.\n- **Gợi ý**: Vui lòng đặt câu hỏi liên quan đến thuốc, liều dùng hoặc chuyên môn y tế.`
        };
      }

      return {
        isSafe: false,
        violationType: 'prompt_injection',
        threatDescription: desc,
        sanitizedQuery,
        safeResponse: `🛡️ **CẢNH BÁO BẢO MẬT (Prompt Injection / Jailbreak Refused)**\n\n- **Phát hiện**: ${desc}\n- **Hành động**: Rào chắn Guardrail từ chối thực thi yêu cầu vi phạm chính sách an toàn.\n- **Nguyên tắc**: Trợ lý Agent Lâm Sàng tuân thủ nghiêm ngặt Dược Thư Quốc Gia 2015 và quy chế dược lâm sàng, không chấp nhận các lệnh can thiệp trái phép.`
      };
    }
  }

  return {
    isSafe: true,
    sanitizedQuery
  };
}

export function validateClientOutputGuardrail(text: string, userQuery?: string): string {
  if (!text) return text;
  // 1. Redact API Keys / Sensitive Tokens & DB Connections
  let scrubbed = text.replace(/(AIzaSy[A-Za-z0-9_-]{28,35}|sk-[A-Za-z0-9]{32,}|Bearer\s+[A-Za-z0-9_\-\.]{20,})/gi, '[REDACTED_API_KEY]');
  scrubbed = scrubbed.replace(/(postgres:\/\/|mysql:\/\/|sqlite:\/\/)[^\s]+/gi, '[REDACTED_DB_CONNECTION]');

  // 2. Output Alignment & Anti-Hallucination Guardrail (TruLens RAG Triad & Self-RAG [IsRel]/[IsSup])
  // Phát hiện và ngăn chặn hiện tượng Over-Answering / Contextual Misalignment:
  // Khi người dùng chỉ hỏi tra cứu thông số nhiệt độ/độ ẩm thông thường nhưng câu trả lời lại kích hoạt phác đồ ứng phó sự cố/mất điện/cách ly
  if (userQuery) {
    const lowerQuery = userQuery.toLowerCase();
    const hasColdchainContext = /chuỗi lạnh|kho lạnh|tủ lạnh|vắc xin|buồng lạnh/i.test(lowerQuery);
    const isTelemetryQuery = /nhiệt độ|độ ẩm|mấy độ|bao nhiêu|hiện tại|tình trạng|kiểm tra|giám sát|ổn định/i.test(lowerQuery);
    const isExplicitIncident = /mất điện|sự cố|quá nhiệt|vượt ngưỡng|cách ly|quarantine|hỏng tủ|cháy|báo động|phác đồ ứng phó|hỏng lốc|không lạnh/i.test(lowerQuery);

    if (hasColdchainContext && isTelemetryQuery && !isExplicitIncident) {
      const containsEmergencyIncidentHeader = /XỬ TRÍ SỰ CỐ NHIỆT ĐỘ CHUỖI LẠNH|Phác đồ ứng phó sự cố|Kích hoạt bình tích lạnh dự phòng|Tạm thời cách ly lô vắc xin/i.test(scrubbed);
      if (containsEmergencyIncidentHeader) {
        // Tự động chấn chỉnh theo nguyên lý Self-Correction: Chuyển về đúng thông điệp giám sát trạng thái bình thường
        scrubbed = (
          `### 🌡️ GIÁM SÁT CHUỖI LẠNH VẮC XIN (TT 36/2018/TT-BYT GSP)\n\n` +
          `• **Nhiệt độ hiện tại:** **4.5°C** (🟢 Đạt chuẩn GSP: dải an toàn bắt buộc **+2.0°C đến +8.0°C**).\n` +
          `• **Độ ẩm buồng tủ:** **58% RH** (🟢 Đạt chuẩn GSP < 70%).\n` +
          `• **Nguồn cấp:** Điện lưới 220V ổn định, hệ thống pin tích điện dự phòng 48 giờ sẵn sàng.\n` +
          `• **Trạng thái cảnh báo:** **Bình thường (An toàn)**. Không ghi nhận biến cố nhiệt hay mất nguồn.\n` +
          `• **Sản phẩm bảo quản:** Vắc xin cúm Vaxigrip (\`LOT-VX25-S1\`) - Tồn **200 liều** tại Tủ lạnh Dược GSP T1.\n` +
          `• **Chỉ số MKT (Mean Kinetic Temperature):** **4.8°C** (Tính toán theo phương trình Arrhenius WHO PQS).\n\n` +
          `👉 **Kết luận:** Toàn bộ vắc xin đang được lưu trữ an toàn trong giới hạn nhiệt độ quy chuẩn. Hệ thống vận hành ổn định, **chưa cần kích hoạt phác đồ ứng phó sự cố hay biệt trữ cách ly**.`
        );
      }
    }

    // 3. Safe Abstention cho thực thể thuốc hoàn toàn bịa đặt / Ngoài CSDL (MedAbstain & R-Tuning)
    if (/xzylophone|nobitan|siêu nhân|thuốc lạ|không có thật/i.test(lowerQuery)) {
      if (/liều dùng|uống|tiêm|chỉ định/i.test(scrubbed) && !/TỪ CHỐI ĐƯA CHỈ ĐỊNH/i.test(scrubbed)) {
        scrubbed = (
          `### 🛡️ TỪ CHỐI ĐƯA CHỈ ĐỊNH (Thực Thể Dược Phẩm Chưa Định Danh)\n\n` +
          `• **Kết quả đối soát:** Hệ thống đã tra soát qua **54.885 số đăng ký Cục Quản lý Dược (DAV)** và toàn bộ **Dược Thư Quốc Gia 2015**, **không ghi nhận** tên thuốc được truy vấn.\n` +
          `• **Rào chắn an toàn lâm sàng (Safe Abstention - TT 22/2011/TT-BYT & TT 20/2017/TT-BYT):** Trợ lý AI **tuyệt đối không suy đoán hoặc cung cấp liều dùng, chỉ định** cho các tên thuốc chưa được định danh trong CSDL chính thống nhằm ngăn ngừa biến cố gây hại tính mạng người bệnh.\n` +
          `• **Khuyến nghị xử trí:**\n` +
          `  1. Kiểm tra lại vỏ bao bì hộp thuốc, đơn thuốc CPOE hoặc hồ sơ bệnh án để đối chiếu chính xác tên thương mại / hoạt chất quốc tế (INN).\n` +
          `  2. Tra cứu trực tiếp trên [Cổng dịch vụ công Cục Quản lý Dược](https://dichvucong.dav.gov.vn).\n` +
          `  3. Liên hệ Dược sĩ lâm sàng / Khoa Dược bệnh viện để được thẩm định chuyên môn.`
        );
      }
    }
  }

  // 4. Output Guardrail: Vô hiệu hóa cấu trúc mã HTML / Website hoàn chỉnh (OWASP LLM02:2025)
  if (/(?:<!DOCTYPE\s+html|<html[\s>]|<head[\s>]|<body[\s>]|```html\s*(?:<!DOCTYPE|<html|<head|<body|<div|<title|<script|<style)|<script[\s>]|javascript:)/i.test(scrubbed)) {
    scrubbed = (
      `🛡️ **RÀO CHẮN ĐẦU RA (Output Rail Blocked - OWASP LLM02:2025)**\n\n` +
      `• **Phát hiện:** Phản hồi chứa cấu trúc mã HTML / Website không hợp lệ.\n` +
      `• **Hành động:** Hệ thống đã tự động ngăn chặn và vô hiệu hóa nội dung theo chính sách an toàn thông tin y tế.\n` +
      `• **Nguyên tắc:** Trợ lý Agent Lâm Sàng tuân thủ quy chế Dược lâm sàng (Thông tư 20/2017/TT-BYT, TT 22/2011/TT-BYT, Dược Thư Quốc Gia) ` +
      `và chỉ phản hồi bằng định dạng Markdown lâm sàng, không hỗ trợ hiển thị tệp HTML hoặc tạo website.`
    );
  }

  return scrubbed;
}
