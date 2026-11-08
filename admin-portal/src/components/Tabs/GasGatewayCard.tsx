import React, { useState } from 'react';
import { Send, RefreshCw, CheckCircle2, AlertCircle, Edit3, Check, Globe } from 'lucide-react';
import { GasStatusResponse } from '../../types/admin';
import { pingGas, updateGasConfig } from '../../services/adminApi';

interface GasGatewayCardProps {
  gas: GasStatusResponse | null;
  onRefresh: () => void;
}

export const GasGatewayCard: React.FC<GasGatewayCardProps> = ({ gas, onRefresh }) => {
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ isSuccess: boolean; message: string } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(gas?.raw_webhook_url || '');
  const [isSaving, setIsSaving] = useState(false);

  const handlePing = async () => {
    setIsPinging(true);
    setPingResult(null);
    try {
      const res = await pingGas(gas?.raw_webhook_url || webhookUrl || undefined);
      const isSuccess = res.status === 'healthy' || res.status_code === 200;
      setPingResult({ isSuccess, message: res.message });
      onRefresh();
    } catch (e: any) {
      setPingResult({ isSuccess: false, message: e.message || 'Lỗi ping Webhook' });
    } finally {
      setIsPinging(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;
    setIsSaving(true);
    try {
      await updateGasConfig(webhookUrl.trim());
      setIsEditing(false);
      onRefresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xs overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-800 text-white flex items-center justify-center shadow-xs">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Cổng Google Apps Script (Email Dặn Dò Lâm Sàng)</h3>
            <p className="text-2xs text-slate-500">Tự động gửi email dặn dò uống thuốc & cảnh báo tương tác theo TT 26/2025/TT-BYT</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePing}
            disabled={isPinging || !gas?.configured}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-teal-700' : ''}`} />
            <span>{isPinging ? 'Đang ping...' : 'Ping Webhook'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="px-3 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditing ? 'Đóng' : 'Sửa Webhook'}</span>
          </button>
        </div>
      </div>

      {pingResult && (
        <div className={`px-5 py-2.5 border-b text-xs flex items-center gap-2 ${
          pingResult.isSuccess ? 'bg-teal-50 border-teal-100 text-teal-900' : 'bg-rose-50 border-rose-100 text-rose-900'
        }`}>
          {pingResult.isSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{pingResult.message}</span>
        </div>
      )}

      {/* Form sửa Webhook URL */}
      {isEditing && (
        <form onSubmit={handleSave} className="p-4 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Globe className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/AKfycb.../exec"
            className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-teal-700"
          />
          <button type="submit" disabled={isSaving} className="px-3 py-1.5 bg-teal-800 text-white font-semibold text-xs rounded-xl cursor-pointer hover:bg-teal-900 shadow-2xs">
            {isSaving ? 'Lưu...' : 'Lưu URL'}
          </button>
        </form>
      )}

      {/* Chi tiết cấu hình Webhook */}
      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/60 border-b border-slate-100 text-xs">
        <div className="sm:col-span-2">
          <span className="text-2xs text-slate-500 block">Webhook Web App URL</span>
          <span className="font-mono font-bold text-slate-800 break-all">{gas?.webhook_url_masked}</span>
        </div>
        <div>
          <span className="text-2xs text-slate-500 block">Trạng Thái Sẵn Sàng</span>
          <span className={`px-2 py-0.5 rounded-md font-semibold text-2xs inline-block mt-0.5 ${gas?.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            {gas?.configured ? 'Sẵn Sàng Gửi Email' : 'Chưa Thiết Lập Webhook'}
          </span>
        </div>
      </div>

      {/* Bảng nhật ký dặn dò từ CSDL thật */}
      <div className="p-4 sm:p-5">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Lịch Sử Dặn Dò & Gửi Email Nhắc Uống Thuốc (CSDL Thật)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-2xs font-semibold text-slate-500 border-b border-slate-200">
                <th className="pb-2">Mã Dặn Dò</th>
                <th className="pb-2">Bệnh Nhân / Email</th>
                <th className="pb-2">Chẩn Đoán</th>
                <th className="pb-2">Thời Gian Gửi</th>
                <th className="pb-2">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gas?.recent_logs.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 font-mono text-2xs text-slate-600 font-bold">{item.id}</td>
                  <td className="py-2.5 font-semibold text-slate-800">
                    {item.patient_name} <span className="font-mono font-normal text-slate-500">({item.patient_email})</span>
                  </td>
                  <td className="py-2.5 text-2xs text-slate-600 max-w-xs truncate" title={item.diagnosis || ''}>
                    {item.diagnosis || 'Dặn dò điều trị ngoại trú'}
                  </td>
                  <td className="py-2.5 text-2xs font-mono text-slate-500">{item.created_at}</td>
                  <td className="py-2.5">
                    <span className="px-2 py-0.5 rounded-md text-2xs font-bold uppercase bg-emerald-100 text-emerald-800">
                      {item.notification_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
