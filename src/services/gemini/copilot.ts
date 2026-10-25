/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Tra cứu Trợ lý Lâm sàng Gemini AI với LRU/TTL Response Cache (<=80 LOC)
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

interface CachedResponse {
  answer: string;
  expiresAt: number;
}
const COPILOT_RESPONSE_CACHE = new Map<string, CachedResponse>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour TTL
const MAX_CACHE_ENTRIES = 100;

export async function askGeminiClinicalCopilot(
  query: string,
  clinicalContext?: ClinicalContextOptions
): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }

  let contextStr = '';
  const isShiftQuery = /ca trực|giao ban|đối soát|tồn đọng|khoa phòng|bàn giao|tổng quan/i.test(query);
  if (clinicalContext && isShiftQuery) {
    contextStr = `\n[Bối cảnh ca trực hiện tại: Vai trò: ${clinicalContext.role || 'Điều dưỡng'}, Nợ ca đêm: ${clinicalContext.activeDebtsCount || 0} ca, Nợ vỏ Morphin: ${clinicalContext.pendingAmpoulesCount || 0} vỏ, Sự cố TBYT khẩn: ${clinicalContext.urgentTicketsCount || 0}, Thuốc cạn kho: ${clinicalContext.lowStockBatchesCount || 0}, Nhiệt độ tủ lạnh: ${clinicalContext.coldChainTemp ?? 4.5}°C]`;
  }

  const cacheKey = `${query.trim().toLowerCase()}_${contextStr}`;
  const cached = COPILOT_RESPONSE_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.answer;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const reply = await callGeminiWithFallback(ai, {
      contents: `${query}${contextStr}`,
      config: {
        systemInstruction: CLINICAL_SYSTEM_INSTRUCTION,
        temperature: 0.2,
        maxOutputTokens: 800
      }
    });

    if (reply) {
      if (COPILOT_RESPONSE_CACHE.size >= MAX_CACHE_ENTRIES) {
        const oldestKey = COPILOT_RESPONSE_CACHE.keys().next().value;
        if (oldestKey) COPILOT_RESPONSE_CACHE.delete(oldestKey);
      }
      COPILOT_RESPONSE_CACHE.set(cacheKey, { answer: reply, expiresAt: Date.now() + CACHE_TTL_MS });
    }
    return reply;
  } catch (error) {
    console.warn('Gemini API call failed, falling back to local clinical rules:', error);
    return null;
  }
}
