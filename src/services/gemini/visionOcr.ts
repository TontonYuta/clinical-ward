/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from './config';

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
    return null;
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
      return JSON.parse(cleaned);
    }
    return null;
  } catch (error) {
    console.warn('Gemini Vision OCR failed:', error);
    return null;
  }
}
