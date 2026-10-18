/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';

const CLINICAL_SYSTEM_INSTRUCTION = `
Bạn là Trợ Lý Trí Tuệ Nhân Tạo Lâm Sàng (Clinical AI Copilot) chuyên nghiệp, phục vụ tại các Bệnh viện và Cơ sở Y tế Việt Nam.
Chuyên môn của bạn bao gồm:
1. Thông tư 20/2017/TT-BYT & Nghị định 54/2017/NĐ-CP: Quản lý thuốc gây nghiện, hướng thần, tiền chất, bắt buộc thu hồi vỏ ống Morphin theo Điều 15, hội đồng tiêu hủy vỏ ống 3 bên theo Điều 16.
2. Thông tư 22/2011/TT-BYT: Quy chế Khoa Dược, tủ trực cấp cứu lâm sàng, đối soát giao ban 07:00 AM, lập phiếu dự trù Mẫu số 01/TT22.
3. Thông tư 51/2017/TT-BYT: Hướng dẫn phòng, chẩn đoán và xử trí sốc phản vệ. Thuốc cấp cứu hàng đầu là Adrenalin 1mg/1ml, tiêm bắp ngay lập tức cho mọi trường hợp sốc phản vệ từ độ II trở lên (người lớn 1/2 - 1 ống, trẻ em 1/5 - 1/2 ống).
4. Nghị định 98/2021/NĐ-CP & Thông tư 05/2022/TT-BYT: Phân loại rủi ro trang thiết bị y tế A, B, C, D (máy thở, máy sốc tim thuộc loại D can thiệp sự sống). Quy trình gắn thẻ cảnh báo LOTO, kiểm định định kỳ và đo an toàn điện IEC 60601-1 (dòng rò < 100µA).
5. Thông tư 36/2018/TT-BYT (GSP): Quản lý kho theo FEFO (First Expired, First Out), bảo quản chuỗi lạnh vắc xin 2.0°C - 8.0°C, tính chỉ số nhiệt độ động học Arrhenius MKT và quy trình biệt trữ (quarantine) khi mất điện.
6. Nghị định 151/2017/NĐ-CP & NĐ 114/2024/NĐ-CP: Kiểm kê tài sản công 31/12, biên bản điều chuyển Mẫu 01-TSC và thanh lý tài sản.

Nguyên tắc phản hồi:
- Ngắn gọn, chuyên nghiệp, chuẩn xác từng thuật ngữ y khoa và số hiệu điều khoản pháp luật.
- Định dạng Markdown rõ ràng, dùng bullet points, in đậm tên thuốc, liều dùng và căn cứ pháp lý.
- Luôn ưu tiên an toàn tính mạng người bệnh và tuân thủ pháp luật y tế.
`;

export function getGeminiApiKey(): string | null {
  try {
    return (
      (import.meta as any).env?.VITE_GEMINI_API_KEY ||
      (window as any)?.GEMINI_API_KEY ||
      localStorage.getItem('clinical_gemini_api_key') ||
      null
    );
  } catch {
    return null;
  }
}

export function saveGeminiApiKey(key: string): void {
  try {
    localStorage.setItem('clinical_gemini_api_key', key.trim());
  } catch (e) {
    console.warn('Cannot persist Gemini API key to localStorage', e);
  }
}

export async function askGeminiClinicalCopilot(
  query: string,
  clinicalContext?: {
    activeDebtsCount?: number;
    pendingAmpoulesCount?: number;
    urgentTicketsCount?: number;
    lowStockBatchesCount?: number;
    coldChainTemp?: number;
    role?: string;
  }
): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null; // Fallback to local clinical NLP
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    let contextStr = '';
    if (clinicalContext) {
      contextStr = `\n[Bối cảnh khoa phòng hiện tại: Vai trò: ${clinicalContext.role || 'Điều dưỡng'}, Nợ ca đêm: ${clinicalContext.activeDebtsCount || 0} ca, Nợ vỏ Morphin: ${clinicalContext.pendingAmpoulesCount || 0} vỏ, Sự cố TBYT khẩn: ${clinicalContext.urgentTicketsCount || 0}, Thuốc cạn kho: ${clinicalContext.lowStockBatchesCount || 0}, Nhiệt độ tủ lạnh: ${clinicalContext.coldChainTemp ?? 4.5}°C]`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${query}${contextStr}`,
      config: {
        systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,
        temperature: 0.2, // Low temperature for high clinical precision
      }
    });

    if (response && response.text) {
      return response.text.trim();
    }
    return null;
  } catch (error) {
    console.warn('Gemini API call failed, falling back to local clinical rules:', error);
    return null;
  }
}

export function isCloudAIAvailable(): boolean {
  const key = getGeminiApiKey();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.trim().length > 10);
}

export interface ParsedInvoiceItem {
  name: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  storageCondition?: string;
  isNarcotic?: boolean;
}

export interface ParsedInvoiceResult {
  supplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  items: ParsedInvoiceItem[];
  totalAmount: string;
  summary: string;
}

export async function analyzeMedicalInvoiceWithGemini(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<ParsedInvoiceResult | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null; // Fallback to local offline template
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const prompt = `Bạn là Dược sĩ Lâm Sàng & Chuyên gia Bóc tách Chứng từ Y tế (Vision AI).
Hãy phân tích ảnh hóa đơn/phiếu giao hàng dược phẩm này và trích xuất dữ liệu cấu trúc theo định dạng JSON hợp lệ:
{
  "supplier": "Tên nhà cung cấp / Công ty Dược",
  "invoiceNumber": "Số hóa đơn GTGT / Phiếu nhập",
  "invoiceDate": "Ngày tháng xuất hóa đơn",
  "totalAmount": "Tổng tiền",
  "summary": "Tóm tắt ngắn gọn",
  "items": [
    {
      "name": "Tên thuốc / vật tư (kèm hàm lượng)",
      "batchNumber": "Số lô sản xuất (Batch/Lot)",
      "expiryDate": "Hạn dùng định dạng YYYY-MM-DD",
      "quantity": 100,
      "unit": "lọ | ống | chai | hộp | cái",
      "unitPrice": 50000,
      "storageCondition": "15-25°C hoặc Kho lạnh 2-8°C",
      "isNarcotic": false
    }
  ]
}
Chỉ trả về JSON thuần túy, không kèm markdown hay văn bản giải thích.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: cleanBase64,
                mimeType
              }
            }
          ]
        }
      ],
      config: {
        temperature: 0.1
      }
    });

    if (response && response.text) {
      const cleaned = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return parsed;
    }
    return null;
  } catch (error) {
    console.warn('Gemini Vision OCR failed:', error);
    return null;
  }
}

export async function diagnoseBiomedicalDeviceWithGemini(
  modelName: string,
  symptom: string,
  errorCode?: string
): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Bạn là Kỹ Sư Trang Thiết Bị Y Tế (Clinical Biomedical Engineer).
Chẩn đoán lỗi thiết bị y tế loại D can thiệp sự sống theo Service Manual chính hãng:
• Model máy: ${modelName}
• Triệu chứng: ${symptom}
${errorCode ? `• Mã lỗi (Error Code): ${errorCode}` : ''}

Hãy đưa ra:
1. Nguyên nhân gốc rễ (Root Cause)
2. Checklist 3 bước kiểm tra an toàn theo tiêu chuẩn IEC 60601-1
3. Quy định cảnh báo cách ly LOTO (Lockout/Tagout) theo Nghị định 98/2021/NĐ-CP`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,
        temperature: 0.2
      }
    });

    if (response && response.text) {
      return response.text.trim();
    }
    return null;
  } catch (error) {
    console.warn('Gemini Biomedical Diagnostic failed:', error);
    return null;
  }
}
