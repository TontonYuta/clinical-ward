import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUTPUT_PDF_PATH = path.join('/home/tontonyuta/Downloads/DoAn2', 'BAO_CAO_NANG_CAP_CHATBOT_RAG.pdf');
const ARTIFACT_PDF_PATH = path.join('/home/tontonyuta/.gemini/antigravity-cli/brain/4039af10-628e-47df-bee0-0357f9f93312', 'BAO_CAO_NANG_CAP_CHATBOT_RAG.pdf');

const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Báo Cáo Kỹ Thuật: Nâng Cấp Chatbot Lâm Sàng Bệnh Viện Bằng Kỹ Thuật Pure RAG & SOTA Agentic Reasoning</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

    @page {
      size: A4;
      margin: 15mm 14mm 16mm 14mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
      line-height: 1.48;
      font-size: 8.8pt;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }

    .cover-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }

    .institution {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
    }

    .sub-institution {
      font-size: 7.5pt;
      color: #64748b;
      margin-top: 1px;
    }

    .doc-title {
      font-size: 16pt;
      font-weight: 800;
      line-height: 1.25;
      color: #0f172a;
      margin: 10px 0 6px 0;
      letter-spacing: -0.02em;
    }

    .doc-subtitle {
      font-size: 9.5pt;
      font-weight: 600;
      color: #0d9488;
      line-height: 1.35;
      margin-bottom: 10px;
    }

    .metadata-box {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 12px;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #334155;
      margin-bottom: 14px;
    }

    .metadata-item strong {
      color: #0f172a;
    }

    h2 {
      font-size: 11pt;
      font-weight: 800;
      color: #0f172a;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 3px;
      margin-top: 16px;
      margin-bottom: 8px;
      letter-spacing: -0.01em;
      display: flex;
      align-items: center;
      page-break-after: avoid;
    }

    h2 .sec-num {
      color: #0d9488;
      margin-right: 5px;
      font-family: 'JetBrains Mono', monospace;
    }

    h3 {
      font-size: 9.5pt;
      font-weight: 700;
      color: #1e293b;
      margin-top: 10px;
      margin-bottom: 4px;
      page-break-after: avoid;
    }

    p {
      margin-top: 0;
      margin-bottom: 6px;
      text-align: justify;
    }

    ul, ol {
      margin-top: 0;
      margin-bottom: 6px;
      padding-left: 16px;
    }

    li {
      margin-bottom: 3px;
      text-align: justify;
    }

    code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 8pt;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 1px 3.5px;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
    }

    pre {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7.5pt;
      background-color: #0f172a;
      color: #f8fafc;
      padding: 8px 10px;
      border-radius: 5px;
      line-height: 1.4;
      overflow-x: auto;
      margin: 6px 0;
      page-break-inside: avoid;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
      margin: 8px 0 12px 0;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #cbd5e1;
      padding: 5px 7px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background-color: #f8fafc;
      color: #0f172a;
      font-weight: 700;
    }

    tr:nth-child(even) {
      background-color: #fbfcfd;
    }

    .badge {
      display: inline-block;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 7pt;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }

    .badge-teal { background-color: #ccfbf1; color: #0f766e; border: 1px solid #99f6e4; }
    .badge-blue { background-color: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
    .badge-rose { background-color: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }
    .badge-amber { background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a; }

    .callout {
      border-left: 3px solid #0d9488;
      background-color: #f0fdfa;
      padding: 6px 10px;
      border-radius: 0 4px 4px 0;
      margin: 8px 0;
      font-size: 8.5pt;
      page-break-inside: avoid;
    }

    .callout-title {
      font-weight: 700;
      color: #0f766e;
      margin-bottom: 2px;
    }

    .callout-warning {
      border-left-color: #e11d48;
      background-color: #fff1f2;
    }
    .callout-warning .callout-title { color: #be123c; }

    /* Modern HTML/CSS Flowchart Cards */
    .flow-step {
      background-color: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 7px 10px;
      margin-bottom: 6px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
      page-break-inside: avoid;
    }

    .flow-step-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 3px;
      margin-bottom: 4px;
    }

    .flow-step-title {
      font-size: 8.5pt;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .flow-step-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7pt;
      font-weight: 600;
      color: #0d9488;
      background-color: #f0fdfa;
      padding: 1px 4px;
      border-radius: 3px;
    }

    .flow-step-desc {
      font-size: 7.8pt;
      color: #334155;
      line-height: 1.4;
    }

    .flow-connector {
      text-align: center;
      font-size: 9pt;
      color: #94a3b8;
      line-height: 1;
      margin: 2px 0 4px 0;
      font-weight: bold;
    }

    .page-break {
      page-break-before: always;
    }

    .reference-item {
      font-size: 7.8pt;
      margin-bottom: 4px;
      text-align: left;
      line-height: 1.4;
    }
  </style>
</head>
<body>

  <!-- COVER HEADER -->
  <div class="cover-header">
    <div class="institution">Hệ Thống Trợ Lý Trí Tuệ Nhân Tạo Lâm Sàng (Clinical AI Copilot)</div>
    <div class="sub-institution">Kho Y Tế Lâm Sàng • Trung Tâm Nghiên Cứu &amp; Phát Triển Công Nghệ Y Tế Thông Minh</div>
    <h1 class="doc-title">BÁO CÁO NGHIÊN CỨU &amp; THIẾT KẾ KIẾN TRÚC<br>NÂNG CẤP CHATBOT LÂM SÀNG BẰNG KỸ THUẬT PURE RAG</h1>
    <div class="doc-subtitle">Chuyển đổi từ mô hình Rule-Based / Keyword Matching sang Kiến trúc Retrieval-Augmented Generation Đa Tầng, Grounded Knowledge Graph và Safe Abstention</div>
  </div>

  <div class="metadata-box">
    <div class="metadata-item"><strong>Tác giả:</strong> Clinical AI Architecture Team (Antigravity)</div>
    <div class="metadata-item"><strong>Căn cứ:</strong> TT 20/2017, TT 51/2017, TT 26/2025, QĐ 3445, QĐ 5948/BYT</div>
    <div class="metadata-item"><strong>Phiên bản:</strong> 2.0 (SOTA Production Design)</div>
    <div class="metadata-item"><strong>Ngày phát hành:</strong> 31/10/2026</div>
  </div>

  <!-- SECTION 1 -->
  <h2><span class="sec-num">01.</span> TỔNG QUAN &amp; SỰ CẦN THIẾT CỦA VIỆC CHUYỂN ĐỔI</h2>
  
  <h3>1.1. Hiện trạng kiến trúc Chatbot hiện tại</h3>
  <p>
    Hiện tại, chatbot của phân hệ lâm sàng đang sử dụng phương pháp <strong>phân loại ý định dựa trên từ khóa (Keyword-based / Regex Matching)</strong> kết hợp với tìm kiếm danh mục cục bộ (Catalog Lookup) và chuyển tiếp chuỗi văn bản tĩnh sang Google Gemini API. Cụ thể:
  </p>
  <ul>
    <li>Các câu lệnh được bóc tách bằng chuỗi điều kiện <code>any(w in lower_query for w in ["dặn dò", "kê đơn", "trả vỏ", ...])</code>.</li>
    <li>Dữ liệu tri thức lâm sàng (Dược thư Quốc gia, Tương tác thuốc QĐ 5948/BYT, Phác đồ sốc phản vệ TT 51/2017) được tổ chức dưới dạng các file Markdown tĩnh và chỉ được nạp cố định một phần vào context.</li>
    <li>CSDL Cục Quản lý Dược (DAV) gồm <strong>54.885 số đăng ký thuốc</strong> và tồn kho bệnh viện được tra cứu qua các câu lệnh SQL đơn giản, chưa được nhúng ngữ nghĩa (Semantic Embedding).</li>
  </ul>

  <h3>1.2. Hạn chế cốt tử trong môi trường lâm sàng</h3>
  <div class="callout callout-warning">
    <div class="callout-title">Rủi ro trong thực hành điều trị bệnh viện:</div>
    <ul>
      <li><strong>Ảo giác y khoa (Hallucination):</strong> Khi gặp hoạt chất lạ hoặc câu hỏi kết hợp nhiều bệnh nền, mô hình LLM có xu hướng tự "suy diễn" liều dùng không có trong Dược thư.</li>
      <li><strong>Thất bại trước câu hỏi suy luận đa bước (Multi-hop Queries):</strong> Ví dụ câu hỏi: <em>"Bệnh nhân 65 tuổi suy thận eGFR 35 mL/phút đang dùng Ceftriaxon và Morphin thì có tương tác gì và có phải giảm liều không?"</em> đòi hỏi liên kết đồng thời 4 nguồn tri thức: Hồ sơ bệnh nhân (eGFR) &rarr; Dược thư (Quy định chỉnh liều) &rarr; QĐ 5948 (Tương tác Ceftriaxon) &rarr; TT 20 (Quy chế Opioid). Tìm kiếm từ khóa hoàn toàn bất lực.</li>
      <li><strong>Thiếu trích dẫn số trang chính xác:</strong> Bác sĩ và dược sĩ lâm sàng bắt buộc phải biết rõ khuyến cáo nằm ở trang nào của Dược Thư Quốc Gia Việt Nam hoặc Điều mấy của Thông tư Bộ Y Tế.</li>
    </ul>
  </div>

  <!-- SECTION 2 -->
  <h2><span class="sec-num">02.</span> KHẢO SÁT CÁC FRAMEWORK RAG HÀNG ĐẦU (EVIDENCE &amp; SOTA REPOS)</h2>
  <p>
    Theo nguyên tắc <em>Evidence-Grounded Engineering</em>, toàn bộ các giải pháp đề xuất bắt buộc phải kế thừa từ các công trình nghiên cứu uy tín (Nature, ACL, EMNLP, ICLR) và các kho mã nguồn mở có tỷ lệ đánh giá và stars cao nhất thế giới (Github Repos &ge; 5.000 &ndash; 150.000+ stars):
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Framework &amp; GitHub Repo</th>
        <th style="width: 14%;">Stars &amp; Đơn vị</th>
        <th style="width: 28%;">Bài Báo Khoa Học / Hội Nghị</th>
        <th style="width: 36%;">Vai Trò Trong Kiến Trúc Mới</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>LlamaIndex</strong><br><code>run-llama/llama_index</code></td>
        <td><span class="badge badge-teal">~46.000 ⭐</span><br>LlamaIndex Inc.</td>
        <td><em>LlamaIndex: A Data Framework for Connecting Data Sources to LLMs</em> (Liu et al., 2023)</td>
        <td><strong>Xương sống Ingestion &amp; Hybrid Indexing:</strong> Quản lý node parser, text chunking theo cấu trúc y tế, tích hợp Sparse BM25 + Dense Vector Search.</td>
      </tr>
      <tr>
        <td><strong>PaperQA2</strong><br><code>Future-House/paper-qa</code></td>
        <td><span class="badge badge-blue">~5.500 ⭐</span><br>Future House</td>
        <td><em>Superhuman scientific question answering with PaperQA2</em> (Skarlinski et al., <strong>Nature / arXiv:2409.01374</strong>, 2024)</td>
        <td><strong>Cơ chế Khử Ảo Giác &amp; Trích Dẫn Cấp Trang:</strong> Đảm bảo 100% câu trả lời gắn chính xác số trang PDF Dược Thư QG và Điều khoản Thông tư.</td>
      </tr>
      <tr>
        <td><strong>LightRAG</strong><br><code>HKUDS/LightRAG</code></td>
        <td><span class="badge badge-teal">~20.000 ⭐</span><br>Hong Kong University</td>
        <td><em>LightRAG: Simple and Fast Knowledge Graph RAG</em> (Guo et al., <strong>EMNLP 2025</strong> / arXiv:2410.05779)</td>
        <td><strong>Đồ Thị Tri Thức Hai Tầng (Dual-Level Graph):</strong> Kết nối mạng lưới thực thể y khoa (Thuốc &harr; Hoạt chất &harr; Bệnh nền &harr; Tương tác DDI) siêu nhẹ, chạy trực tiếp trên SQLite.</td>
      </tr>
      <tr>
        <td><strong>Ragas</strong><br><code>explodinggradients/ragas</code></td>
        <td><span class="badge badge-amber">~16.000 ⭐</span><br>Vibrant Labs</td>
        <td><em>Ragas: Automated Evaluation of Retrieval Augmented Generation</em> (Es et al., <strong>EACL 2024</strong>)</td>
        <td><strong>Bộ Đo Lường Độc Lập RAG Triad:</strong> Tự động tính toán điểm <em>Faithfulness</em> (Độ trung thực), <em>Answer Relevance</em>, <em>Context Precision</em> trên 69 kịch bản kiểm thử.</td>
      </tr>
      <tr>
        <td><strong>NVIDIA NeMo Guardrails</strong><br><code>NVIDIA/NeMo-Guardrails</code></td>
        <td><span class="badge badge-rose">~5.500 ⭐</span><br>NVIDIA AI</td>
        <td><em>NeMo Guardrails: A System for Programmable Guardrails</em> (Rebedea et al., NVIDIA, 2023)</td>
        <td><strong>Rào Chắn An Toàn Lâm Sàng &amp; Cách Ly Dữ Liệu:</strong> Chống Prompt Injection, ngăn chặn đổi nhân cách (Jailbreak), cấm xuất mã HTML ngoài chuyên môn y tế.</td>
      </tr>
    </tbody>
  </table>

  <!-- SECTION 3 -->
  <h2><span class="sec-num">03.</span> CHI TIẾT 6 KỸ THUẬT SOTA CỐT LÕI SẼ ÁP DỤNG</h2>

  <h3>3.1. Kỹ thuật 1: Hybrid Retrieval &amp; Reciprocal Rank Fusion (RRF)</h3>
  <p>
    Trong y tế, một truy vấn lâm sàng luôn chứa hai loại thông tin đối lập: <strong>thực thể cứng</strong> (Tên biệt dược chính xác: <em>Rocephin, Hadunalin</em>; Số đăng ký: <em>VN-18456-14</em>; Hoạt chất) và <strong>mô tả ngữ nghĩa mềm</strong> (<em>"bệnh nhân sốc khó thở sau tiêm", "chỉnh liều suy thận"</em>). Nếu chỉ dùng Vector Search thuần túy, mô hình thường trả về thuốc có embedding gần nghĩa nhưng sai lệch hoạt chất gây nguy hiểm tính mạng.
  </p>
  <div class="callout">
    <div class="callout-title">Nguyên lý kết hợp RRF (Cormack et al., SIGIR):</div>
    Hệ thống chạy song song hai luồng tìm kiếm và hòa trộn thứ hạng theo công thức chuẩn:
    <br>
    <code>RRF_Score(d) = (1 / (k + Rank_BM25(d))) + (1 / (k + Rank_Dense(d)))</code> với hằng số <code>k = 60</code>.
    <br>
    Đảm bảo thuốc đúng chính xác tên hoặc hoạt chất luôn được đẩy lên top đầu, đồng thời ngữ cảnh phác đồ lâm sàng vẫn được khai thác trọn vẹn.
  </div>

  <h3>3.2. Kỹ thuật 2: Dual-Level Knowledge Graph RAG (Kế thừa từ HKUDS LightRAG)</h3>
  <p>
    Khác với RAG truyền thống chia nhỏ văn bản thành các chunks độc lập, <strong>LightRAG (EMNLP 2025)</strong> xây dựng đồ thị tri thức y khoa hai tầng:
  </p>
  <ul>
    <li><strong>Tầng cục bộ (Low-Level Entity Graph):</strong> Trích xuất các thực thể cụ thể: <code>[Paracetamol] &mdash;(Liều tối đa)&rarr; [4g/ngày]</code>; <code>[Morphin] &mdash;(Thuộc nhóm)&rarr; [Opioid TT 20]</code>; <code>[Ceftriaxon] &mdash;(Tương tác)&rarr; [Canxi clorid &rarr; Kết tủa phổi]</code>.</li>
    <li><strong>Tầng toàn cục (High-Level Topic Graph):</strong> Tóm tắt các chuyên đề lớn: <em>"Quy trình xử trí sốc phản vệ 4 độ theo Thông tư 51/2017"</em>, <em>"Quy chuẩn kiểm soát kê đơn ngoại trú theo Thông tư 26/2025"</em>.</li>
  </ul>
  <p>
    Nhờ cấu trúc này, khi bác sĩ đặt câu hỏi liên quan đến nhiều thuốc cùng lúc, hệ thống chỉ cần duyệt các cạnh (edges) trong đồ thị tri thức để tìm ra điểm xung đột/chống chỉ định trong mili-giây mà không cần đọc lại toàn bộ tài liệu.
  </p>

  <h3>3.3. Kỹ thuật 3: Corrective RAG (CRAG) &amp; Self-RAG Reflection</h3>
  <p>
    Dựa trên nghiên cứu <em>Self-RAG (ICLR 2024)</em> và <em>Corrective RAG (Yan et al., 2024)</em>, chatbot không bao giờ tin tưởng mù quáng vào kết quả truy xuất đầu tiên. Hệ thống tự động kích hoạt bộ tự phản xạ:
  </p>
  <ul>
    <li><strong>Đoạn trích có độ tin cậy cao (Score &ge; 0.85):</strong> Trực tiếp đưa vào Context sinh câu trả lời lâm sàng chuẩn y văn.</li>
    <li><strong>Đoạn trích mơ hồ (0.50 &le; Score &lt; 0.85):</strong> Kích hoạt bộ <em>Query Rewriter</em> mở rộng từ đồng nghĩa y khoa và truy xuất bổ sung.</li>
    <li><strong>Đoạn trích sai lệch hoặc không tồn tại (Score &lt; 0.50):</strong> Kích hoạt <em>Safe Abstention (MedAbstain)</em> để từ chối an toàn, thông báo rõ thuốc chưa được định danh trong CSDL.</li>
  </ul>

  <h3>3.4. Kỹ thuật 4: Claim-Level Citation Tracing (Kế thừa PaperQA2 - Nature 2024)</h3>
  <p>
    Để đạt chuẩn pháp lý y tế, mỗi câu trả lời của Chatbot phải trải qua bước <strong>Attribution Verification</strong>. Hệ thống phân rã câu trả lời thành từng mệnh đề khẳng định (Atomic Claims) và đối soát với đoạn trích nguồn:
  </p>
  <ul>
    <li>Mệnh đề: <em>"Liều Adrenalin tiêm bắp ban đầu cho người lớn sốc phản vệ độ II là 0.5 &ndash; 1 ống 1mg."</em> &rarr; <code>[Dẫn chứng: Thông tư 51/2017/TT-BYT, Phụ lục II, Mục 2]</code>.</li>
    <li>Mệnh đề: <em>"Bắt buộc thu hồi vỏ ống Morphin đã sử dụng trước khi lĩnh cơ số mới."</em> &rarr; <code>[Dẫn chứng: Thông tư 20/2017/TT-BYT, Điều 7, Khoản 3]</code>.</li>
    <li>Mệnh đề: <em>"Paracetamol chuyển hóa qua gan, tối đa 4g/ngày ở người bình thường."</em> &rarr; <code>[Dẫn chứng: Dược Thư Quốc Gia Việt Nam 2015, Trang 1118]</code>.</li>
  </ul>

  <h3>3.5. Kỹ thuật 5: Clinical Guardrails &amp; Anti-Jailbreak (NVIDIA NeMo)</h3>
  <p>
    Áp dụng kiến trúc bảo vệ hai lớp (Input Guardrails &amp; Output Guardrails):
  </p>
  <ul>
    <li><strong>Input Boundary:</strong> Cách ly truy vấn của người dùng trong khối thẻ có cấu trúc <code>&lt;user_query&gt;...&lt;/user_query&gt;</code>, vô hiệu hóa hoàn toàn các kỹ thuật Prompt Injection cố tình yêu cầu đổi nhân cách (DAN Mode, Developer Mode, Ignore Instructions).</li>
    <li><strong>Output Policy:</strong> Bắt buộc mọi phản hồi phải tuân thủ định dạng Markdown y khoa; cấm tuyệt đối phát sinh mã nguồn website (HTML, CSS, JS) hoặc kịch bản thực thi.</li>
  </ul>

  <h3>3.6. Kỹ thuật 6: Automated Evaluation Suite (Ragas Triad Metric)</h3>
  <p>
    Tích hợp thư viện <strong>Ragas (EACL 2024)</strong> vào hệ thống kiểm thử tự động CI/CD để giám sát liên tục 4 chỉ số chất lượng:
  </p>
  <ul>
    <li><strong>Faithfulness (&ge; 0.95):</strong> Tỷ lệ các luận điểm trong câu trả lời có bằng chứng trực tiếp trong tài liệu trích xuất (đo lường mức độ sạch ảo giác).</li>
    <li><strong>Answer Relevance (&ge; 0.90):</strong> Mức độ giải quyết đúng trọng tâm câu hỏi của bác sĩ/điều dưỡng.</li>
    <li><strong>Context Precision (&ge; 0.88):</strong> Độ chính xác của các đoạn văn bản Dược thư/Thông tư được đưa vào context.</li>
  </ul>

  <!-- SECTION 4 -->
  <h2><span class="sec-num">04.</span> KIẾN TRÚC TOÀN DIỆN HỆ THỐNG RAG LÂM SÀNG (PIPELINE ARCHITECTURE)</h2>
  
  <p>Toàn bộ kiến trúc được triển khai đồng bộ giữa FastAPI Backend và TypeScript Frontend theo sơ đồ luồng dữ liệu chuẩn hóa:</p>

  <!-- HTML/CSS DIAGRAM CARDS -->
  <div style="margin: 10px 0;">
    <div class="flow-step">
      <div class="flow-step-header">
        <span class="flow-step-title">Bước 1: Input Guardrail &amp; Query Preprocessor</span>
        <span class="flow-step-badge">NeMo Guardrails &amp; CRAG</span>
      </div>
      <div class="flow-step-desc">
        Cách ly câu hỏi trong <code>&lt;user_query&gt;</code> chống Prompt Injection (OWASP LLM01). Chuẩn hóa tiếng Việt, ánh xạ biệt dược &harr; hoạt chất, bóc tách câu hỏi phức thành các sub-queries độc lập.
      </div>
    </div>

    <div class="flow-connector">&darr;</div>

    <div class="flow-step">
      <div class="flow-step-header">
        <span class="flow-step-title">Bước 2: Dual Hybrid Retrieval &amp; Rank Fusion (RRF)</span>
        <span class="flow-step-badge">LlamaIndex &amp; SQLite FTS5</span>
      </div>
      <div class="flow-step-desc">
        Chạy song song: <strong>Sparse BM25</strong> (54.885 thuốc DAV, mã ICD-10, SĐK) và <strong>Dense Vector Embedding</strong> (Dược thư QG, TT 51, TT 20, TT 22). Hòa trộn thứ hạng bằng thuật toán Reciprocal Rank Fusion (k=60) &amp; Re-ranking lấy Top-5 đoạn trích tối ưu.
      </div>
    </div>

    <div class="flow-connector">&darr;</div>

    <div class="flow-step">
      <div class="flow-step-header">
        <span class="flow-step-title">Bước 3: Clinical Graph Context Expansion</span>
        <span class="flow-step-badge">LightRAG / MedGraphRAG</span>
      </div>
      <div class="flow-step-desc">
        Mở rộng ngữ cảnh lâm sàng đa tầng: Bệnh nhân &rarr; Chức năng thận eGFR &rarr; Tiền sử dị ứng &rarr; Quét ma trận tương tác thuốc (QĐ 5948/BYT) &rarr; Kiểm tra giới hạn liều Dược thư (QĐ 3445) &rarr; Kiểm tra điều kiện chuỗi lạnh vắc xin (TT 36).
      </div>
    </div>

    <div class="flow-connector">&darr;</div>

    <div class="flow-step">
      <div class="flow-step-header">
        <span class="flow-step-title">Bước 4: Grounded Generation &amp; Citation Attribution</span>
        <span class="flow-step-badge">PaperQA2 &amp; MedAbstain</span>
      </div>
      <div class="flow-step-desc">
        Ghép ngữ cảnh có gắn mã nguồn vào Prompt. Sinh câu trả lời qua Gemini API. Phân rã mệnh đề khẳng định để đối soát nguồn. Tự động gắn thẻ số trang PDF Dược Thư và Điều/Khoản Thông tư. Kích hoạt Safe Abstention nếu dữ liệu không chắc chắn.
      </div>
    </div>

    <div class="flow-connector">&darr;</div>

    <div class="flow-step">
      <div class="flow-step-header">
        <span class="flow-step-title">Bước 5: Response Dispatch &amp; Metric Monitoring</span>
        <span class="flow-step-badge">Ragas Triad &amp; Audit Trail</span>
      </div>
      <div class="flow-step-desc">
        Trả kết quả Markdown y khoa qua SSE/JSON kèm Interactive Action Chips (Phiếu mượn thuốc, Lập đơn CPOE, Báo hỏng TBYT). Giám sát liên tục điểm Faithfulness &ge; 0.95 và ghi nhật ký kiểm toán lâm sàng.
      </div>
    </div>
  </div>

  <!-- SECTION 5 -->
  <h2><span class="sec-num">05.</span> KẾ HOẠCH TRIỂN KHAI MÃ NGUỒN (IMPLEMENTATION ROADMAP)</h2>

  <h3>5.1. Cấu trúc thư mục module RAG mới trong Backend</h3>
  <pre><code>backend/app/services/rag/
├── __init__.py
├── clinical_indexer.py         # Đọc &amp; Index tài liệu Dược thư, TT BYT thành chunks có metadata số trang
├── hybrid_retriever.py         # Kết hợp BM25 (FTS5) và Dense Vector Embeddings qua thuật toán RRF
├── clinical_knowledge_graph.py    # Xây dựng &amp; duyệt đồ thị thực thể y tế (LightRAG pattern)
├── corrective_rag.py           # Đánh giá độ tin cậy trích xuất &amp; Query Rewriter (CRAG)
├── citation_grounder.py        # Đối soát và gán nhãn trích dẫn số trang PDF (PaperQA2 pattern)
└── rag_orchestrator.py         # Pipeline điều phối chính thay thế cho router copilot cũ</code></pre>

  <h3>5.2. Các giai đoạn triển khai chi tiết</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 18%;">Giai đoạn</th>
        <th style="width: 32%;">Nội dung công việc cốt lõi</th>
        <th style="width: 32%;">Tiêu chí nghiệm thu (Deliverables)</th>
        <th style="width: 18%;">Tiến độ</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Phase 1: Ingestion &amp; Hybrid Indexing</strong></td>
        <td>Xây dựng module <code>clinical_indexer.py</code> và <code>hybrid_retriever.py</code>; phân đoạn tài liệu Dược thư và Thông tư BYT kèm metadata số trang PDF.</td>
        <td>Hit rate &ge; 98% khi tra cứu tên biệt dược trong 54.885 thuốc DAV; thời gian truy xuất &lt; 50ms.</td>
        <td>Milestone 1</td>
      </tr>
      <tr>
        <td><strong>Phase 2: Graph Context &amp; CRAG</strong></td>
        <td>Tích hợp <code>clinical_knowledge_graph.py</code> mô hình hóa quan hệ Thuốc &ndash; Dị ứng &ndash; Tương tác QĐ 5948; triển khai bộ chấm điểm tin cậy và Query Rewriter.</td>
        <td>Giải quyết chính xác 100% các câu hỏi lâm sàng đa bước kết hợp bệnh nền và chức năng thận.</td>
        <td>Milestone 2</td>
      </tr>
      <tr>
        <td><strong>Phase 3: Citation Grounding &amp; Guardrails</strong></td>
        <td>Tích hợp <code>citation_grounder.py</code> (PaperQA2) ép buộc dẫn chứng số trang; hoàn thiện NeMo Guardrails ngăn chặn injection và cấm sinh HTML.</td>
        <td>100% các khuyến cáo điều trị có gắn nhãn nguồn kiểm chứng; 0% trường hợp jailbreak thành công.</td>
        <td>Milestone 3</td>
      </tr>
      <tr>
        <td><strong>Phase 4: Ragas Evaluation &amp; Benchmarking</strong></td>
        <td>Viết bộ test tự động <code>test_rag_eval.py</code>; chạy đối soát toàn bộ 69 test cases hiện có kết hợp benchmark độ sạch ảo giác.</td>
        <td>Đạt chỉ số <em>Faithfulness &ge; 0.95</em> và <em>Answer Relevance &ge; 0.90</em> trên toàn bộ kịch bản kiểm thử.</td>
        <td>Milestone 4</td>
      </tr>
    </tbody>
  </table>

  <!-- SECTION 6 -->
  <h2><span class="sec-num">06.</span> TÀI LIỆU THAM KHẢO &amp; DẪN CHỨNG KHOA HỌC (SOTA CITATIONS)</h2>
  <div class="reference-item">1. <strong>PaperQA2:</strong> Skarlinski et al. (2024). <em>"Superhuman scientific question answering with PaperQA2"</em>. Nature / arXiv:2409.01374. GitHub: <code>Future-House/paper-qa</code>.</div>
  <div class="reference-item">2. <strong>LightRAG:</strong> Guo, Z. et al. (2025). <em>"LightRAG: Simple and Fast Knowledge Graph Retrieval-Augmented Generation"</em>. Accepted at EMNLP 2025. arXiv:2410.05779. GitHub: <code>HKUDS/LightRAG</code>.</div>
  <div class="reference-item">3. <strong>Corrective RAG (CRAG):</strong> Yan, S. et al. (2024). <em>"Corrective Retrieval Augmented Generation"</em>. arXiv:2401.15884. GitHub: <code>HuskyThinker/CRAG</code>.</div>
  <div class="reference-item">4. <strong>Self-RAG:</strong> Asai, A. et al. (2024). <em>"Self-RAG: Learning to Retrieve, Generate, and Critique through Self-Reflection"</em>. International Conference on Learning Representations (ICLR 2024). arXiv:2310.11511.</div>
  <div class="reference-item">5. <strong>Medical Graph RAG:</strong> ImprintLab (2025). <em>"Medical Graph RAG: Towards Safe Medical Large Language Model via Graph Retrieval-Augmented Generation"</em>. Accepted at ACL 2025. arXiv:2408.04187.</div>
  <div class="reference-item">6. <strong>Ragas Framework:</strong> Es, S. et al. (2024). <em>"Ragas: Automated Evaluation of Retrieval Augmented Generation"</em>. European Chapter of the Association for Computational Linguistics (EACL 2024). GitHub: <code>explodinggradients/ragas</code>.</div>
  <div class="reference-item">7. <strong>LlamaIndex Core:</strong> Liu, J. (2023). <em>"LlamaIndex: A Data Framework for LLM Applications"</em>. GitHub: <code>run-llama/llama_index</code>.</div>
  <div class="reference-item">8. <strong>NeMo Guardrails:</strong> Rebedea, T. et al. (2023). <em>"NeMo Guardrails: A System for Controllable and Safe LLM Applications"</em>. NVIDIA. GitHub: <code>NVIDIA/NeMo-Guardrails</code>.</div>
  <div class="reference-item">9. <strong>Bộ Y Tế Việt Nam:</strong> Quyết định 3445/QĐ-BYT (Dược Thư Quốc Gia Việt Nam), Quyết định 5948/QĐ-BYT (Tương tác thuốc chống chỉ định), Thông tư 51/2017/TT-BYT (Phác đồ phản vệ), Thông tư 20/2017/TT-BYT (Thuốc gây nghiện), Thông tư 26/2025/TT-BYT (Đơn thuốc điện tử quốc gia).</div>

</body>
</html>`;

async function generatePdf() {
  console.log('🚀 Re-rendering High-Quality PDF Report with Compact Flowchart Layout...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.setContent(htmlContent, { waitUntil: 'networkidle' });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '16mm',
      bottom: '16mm',
      left: '14mm',
      right: '14mm'
    },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: `
      <div style="font-family: 'Inter', sans-serif; font-size: 7.5pt; color: #64748b; width: 100%; padding: 0 14mm; display: flex; justify-content: space-between; align-items: center;">
        <span>Báo Cáo Nghiên Cứu: Nâng Cấp Chatbot Lâm Sàng Bằng Kỹ Thuật Pure RAG (SOTA 2026)</span>
        <span>Trang <span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>
    `
  });

  fs.writeFileSync(OUTPUT_PDF_PATH, pdfBuffer);
  console.log(`✅ Saved project PDF to: ${OUTPUT_PDF_PATH}`);

  fs.writeFileSync(ARTIFACT_PDF_PATH, pdfBuffer);
  console.log(`✅ Copied PDF to artifacts directory: ${ARTIFACT_PDF_PATH}`);

  await browser.close();
  console.log('🎉 RE-RENDERED PDF SUCCESSFULLY!');
}

generatePdf().catch((err) => {
  console.error('❌ Failed to generate PDF:', err);
  process.exit(1);
});
