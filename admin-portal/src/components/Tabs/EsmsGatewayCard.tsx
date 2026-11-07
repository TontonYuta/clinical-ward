import React, { useState } from 'react';
import { Radio, RefreshCw, Send, CheckCircle2, AlertCircle, Edit3, X, Check } from 'lucide-react';
import { EsmsStatusResponse } from '../../types/admin';
import { pingEsms, updateEsmsConfig } from '../../services/adminApi';

interface EsmsGatewayCardProps {
  esms: EsmsStatusResponse | null;
  onRefresh: () => void;
}

export const EsmsGatewayCard: React.FC<EsmsGatewayCardProps> = ({ esms, onRefresh }) => {
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [brandname, setBrandname] = useState(esms?.brandname || 'BV_LAMSANG');
  const [isSandbox, setIsSandbox] = useState(esms?.is_sandbox ?? true);
  const [isSaving, setIsSaving] = useState(false);

  const handlePing = async () => {
    setIsPinging(true);
    setPingResult(null);
    try {
      const res = await pingEsms();
      setPingResult(res.message);
      onRefresh();
    } catch (e: any) {
      setPingResult(e.message || 'Lỗi kiểm tra eSMS');
    } finally {
      setIsPinging(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateEsmsConfig({
        api_key: apiKey ? apiKey.trim() : undefined,
        secret_key: secretKey ? secretKey.trim() : undefined,
        brandname: brandname.trim(),
        is_sandbox: isSandbox,
      });
      setShowEdit(false);
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
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Cổng Viễn Thông eSMS.vn Brandname</h3>
            <p className="text-2xs text-slate-500">API Viễn thông thật • Số dư: <strong className="text-slate-800 font-mono font-bold">{(esms?.balance_vnd ?? 0).toLocaleString()} VNĐ</strong></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePing}
            disabled={isPinging}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-teal-700' : ''}`} />
            <span>{isPinging ? 'Đang kiểm tra...' : 'Ping Số Dư Thật'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="px-3 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Cấu Hình</span>
          </button>
        </div>
      </div>

      {pingResult && (
        <div className="px-5 py-2.5 bg-teal-50 border-b border-teal-100 text-xs text-teal-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
          <span>{pingResult}</span>
        </div>
      )}

      {/* Thông số khóa cấu hình */}
      <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/60 border-b border-slate-100 text-xs">
        <div>
          <span className="text-2xs text-slate-500 block">eSMS API Key</span>
          <span className="font-mono font-bold text-slate-800">{esms?.api_key_masked}</span>
        </div>
        <div>
          <span className="text-2xs text-slate-500 block">eSMS Secret Key</span>
          <span className="font-mono font-bold text-slate-800">{esms?.secret_key_masked}</span>
        </div>
        <div>
          <span className="text-2xs text-slate-500 block">Brandname</span>
          <span className="font-semibold text-teal-900">{esms?.brandname}</span>
        </div>
        <div>
          <span className="text-2xs text-slate-500 block">Chế Độ Gửi</span>
          <span className="font-semibold text-slate-700">{esms?.is_sandbox ? 'Sandbox (An toàn 0đ)' : 'Live Thương Mại'}</span>
        </div>
      </div>

      {/* Bảng 5 lượt gửi SMS gần nhất */}
      <div className="p-4 sm:p-5">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Nhật Ký Phát Tin Nhắn Gần Nhất (Từ CSDL Thật)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-2xs font-semibold text-slate-500 border-b border-slate-200">
                <th className="pb-2">Mã SMS</th>
                <th className="pb-2">Bệnh Nhân / SĐT</th>
                <th className="pb-2">Thời Gian</th>
                <th className="pb-2">Trạng Thái</th>
                <th className="pb-2">Nội Dung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {esms?.recent_logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 font-mono text-2xs text-slate-600 font-bold">{log.id}</td>
                  <td className="py-2.5 font-semibold text-slate-800">
                    {log.patient_name} <span className="font-mono font-normal text-slate-500">({log.recipient_phone})</span>
                  </td>
                  <td className="py-2.5 text-2xs font-mono text-slate-500">{log.created_at}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded-md text-2xs font-bold uppercase ${log.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-2xs text-slate-600 max-w-xs truncate" title={log.content}>
                    {log.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Cấu hình eSMS */}
      {showEdit && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-sm text-slate-900">Cấu Hình Cổng Viễn Thông eSMS</h4>
              <button type="button" onClick={() => setShowEdit(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">eSMS API Key:</label>
              <input type="text" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Để trống nếu giữ nguyên..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">eSMS Secret Key:</label>
              <input type="password" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} placeholder="Để trống nếu giữ nguyên..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Brandname:</label>
              <input type="text" value={brandname} onChange={(e) => setBrandname(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="esms_sandbox" checked={isSandbox} onChange={(e) => setIsSandbox(e.target.checked)} className="rounded text-teal-700" />
              <label htmlFor="esms_sandbox" className="text-slate-700 font-medium">Bật chế độ Sandbox an toàn (0 VNĐ)</label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setShowEdit(false)} className="px-3 py-1.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 cursor-pointer">Hủy</button>
              <button type="submit" disabled={isSaving} className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl font-semibold cursor-pointer shadow-xs">{isSaving ? 'Đang lưu...' : 'Lưu Cấu Hình'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
