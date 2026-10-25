/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import {
  getGeminiApiKey,
  CLINICAL_SYSTEM_INSTRUCTION,
  callGeminiWithFallback
} from './config';

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

    return await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,
        temperature: 0.2
      }
    });
  } catch (error) {
    console.warn('Gemini Biomedical Diagnostic failed:', error);
    return null;
  }
}
