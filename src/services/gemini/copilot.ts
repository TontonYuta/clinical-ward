/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Tra cứu Trợ lý Lâm sàng Gemini AI (<=60 LOC)
 */

import { GoogleGenAI } from '@google/genai';
import {
  getGeminiApiKey,
  CLINICAL_SYSTEM_INSTRUCTION,
  callGeminiWithFallback
} from './config';

export interface ClinicalContextOptions {
  activeDebtsCount?: number;
  pendingAmpoulesCount?: number;
  urgentTicketsCount?: number;
  lowStockBatchesCount?: number;
  coldChainTemp?: number;
  role?: string;
}

export async function askGeminiClinicalCopilot(
  query: string,
  clinicalContext?: ClinicalContextOptions
): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    let contextStr = '';
    if (clinicalContext) {
      contextStr = `\n[Bối cảnh khoa phòng hiện tại: Vai trò: ${clinicalContext.role || 'Điều dưỡng'}, Nợ ca đêm: ${clinicalContext.activeDebtsCount || 0} ca, Nợ vỏ Morphin: ${clinicalContext.pendingAmpoulesCount || 0} vỏ, Sự cố TBYT khẩn: ${clinicalContext.urgentTicketsCount || 0}, Thuốc cạn kho: ${clinicalContext.lowStockBatchesCount || 0}, Nhiệt độ tủ lạnh: ${clinicalContext.coldChainTemp ?? 4.5}°C]`;
    }

    return await callGeminiWithFallback(ai, {
      contents: `${query}${contextStr}`,
      config: {
        systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,
        temperature: 0.2,
        maxOutputTokens: 800
      }
    });
  } catch (error) {
    console.warn('Gemini API call failed, falling back to local clinical rules:', error);
    return null;
  }
}
