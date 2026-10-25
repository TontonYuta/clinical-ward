/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Modal Cấu hình AI & Tối ưu hóa chi phí cho Chatbot Lâm Sàng (<=200 LOC)
 */

import React, { useState } from 'react';
import { X, KeyRound, Sparkles, Check, AlertCircle, Eye, EyeOff, Zap, ShieldCheck } from 'lucide-react';
import {
  getGeminiApiKey,
  saveGeminiApiKey,
  PRIMARY_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL
} from '../../services/gemini/config';
import { GoogleGenAI } from '@google/genai';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdated?: () => void;
}

export const ChatSettingsModal: React.FC<Props> = ({ isOpen, onClose, onKeyUpdated }) => {
  const [apiKey, setApiKey] = useState(getGeminiApiKey() || '');
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(
    typeof window !== 'undefined' ? localStorage.getItem('clinical_gemini_model') || PRIMARY_GEMINI_MODEL : PRIMARY_GEMINI_MODEL
  );

  if (!isOpen) return null;

  const handleSave = () => {
    saveGeminiApiKey(apiKey);
    if (typeof window !== 'undefined') {
      localStorage.setItem('clinical_gemini_model', selectedModel);
    }
    setTestResult({ ok: true, message: 'Đã lưu cấu hình AI thành công!' });
    onKeyUpdated?.();
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleTestConnection = async () => {
    const keyToTest = apiKey.trim() || getGeminiApiKey();
    if (!keyToTest) {
      setTestResult({ ok: false, message: 'Vui lòng nhập API Key để kiểm tra.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: keyToTest });
      const res = await ai.models.generateContent({
        model: selectedModel,
        contents: 'Ping',
        config: { maxOutputTokens: 10 }
      });
      if (res?.text) {
        setTestResult({ ok: true, message: `Kết nối thành công tới ${selectedModel}!` });
        saveGeminiApiKey(keyToTest);
        onKeyUpdated?.();
      } else {
        setTestResult({ ok: false, message: 'Máy chủ phản hồi rỗng, vui lòng thử lại.' });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: `Lỗi kết nối: ${err?.message || 'Không thể xác thực'}` });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Cấu hình AI" className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-3.5 bg-white border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-800 text-white flex items-center justify-center shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">Cấu Hình AI &amp; Chi Phí</h3>
              <p className="text-2xs text-slate-500">Google Gemini 3.5 Flash-Lite tối ưu chi phí</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {/* Status badge */}
          <div className="p-3 rounded-xl bg-teal-50 border border-teal-200/80 flex items-start gap-2.5">
            <Zap className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-teal-900 block">Tối ưu chi phí $0.00 (Tier Miễn Phí)</span>
              <p className="text-2xs text-teal-800/90">
                Sử dụng mô hình <strong>Flash-Lite</strong> giúp phản hồi dưới 1 giây, tiết kiệm 95% chi phí token và miễn phí 1.500 lượt/ngày qua Google AI Studio.
              </p>
            </div>
          </div>

          {/* Model selection */}
          <div>
            <label className="font-bold text-slate-700 block mb-1.5">Mô hình AI:</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 transition"
            >
              <option value="gemini-3.5-flash-lite">gemini-3.5-flash-lite (Khuyên dùng - Nhanh &amp; Tiết kiệm nhất)</option>
              <option value="gemini-flash-lite-latest">gemini-flash-lite-latest (Dự phòng ổn định)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Dự phòng mở rộng)</option>
            </select>
          </div>

          {/* API Key Input */}
          <div>
            <label className="font-bold text-slate-700 block mb-1.5 flex items-center justify-between">
              <span>Google Gemini API Key:</span>
              <span className="text-2xs font-normal text-slate-400">Lưu an toàn trong máy (localStorage)</span>
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Dán API Key (AIzaSy... hoặc AQ...)"
                className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-700 transition font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`p-2.5 rounded-xl text-2xs flex items-center gap-2 ${testResult.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
              {testResult.ok ? <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />}
              <span>{testResult.message}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition cursor-pointer disabled:opacity-50 text-center"
            >
              {isTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2 px-3 rounded-xl bg-teal-800 hover:bg-teal-900 text-white font-semibold transition cursor-pointer shadow-xs text-center"
            >
              Lưu cấu hình
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
