import React, { useState } from 'react';
import { KeyRound, Plus, Trash2, CheckCircle2, AlertTriangle, XCircle, Play, Sparkles, RefreshCw, Zap, Clock } from 'lucide-react';
import { ApiKeyItem, TestKeyResponse } from '../../types/admin';
import { addApiKey, deleteApiKey, testApiKey, triggerAutoHeartbeat } from '../../services/adminApi';

interface KeyVaultTabProps {
  keys: ApiKeyItem[];
  onRefresh: () => void;
}

export const KeyVaultTab: React.FC<KeyVaultTabProps> = ({ keys, onRefresh }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyProvider, setNewKeyProvider] = useState('gemini');
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [isHeartbeating, setIsHeartbeating] = useState(false);
  const [testResult, setTestResult] = useState<{ [keyId: string]: TestKeyResponse }>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleAutoHeartbeat = async () => {
    setIsHeartbeating(true);
    try {
      await triggerAutoHeartbeat();
      notify('Đã hoàn tất quét trạng thái toàn bộ bể khóa API!');
      onRefresh();
    } catch (err: any) {
      notify(`Lỗi tự động kiểm tra: ${err.message}`);
    } finally {
      setIsHeartbeating(false);
    }
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || !newKeyValue.trim()) return;
    try {
      await addApiKey(newKeyName.trim(), newKeyValue.trim(), newKeyProvider);
      setNewKeyName('');
      setNewKeyValue('');
      setIsAdding(false);
      notify('Đã thêm thành công API Key mới vào bể khóa!');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi thêm API Key');
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa API Key này khỏi bể khóa xoay vòng?')) return;
    try {
      await deleteApiKey(keyId);
      notify('Đã xóa API Key khỏi bể khóa thành công.');
      onRefresh();
    } catch (err: any) {
      notify(err.message || 'Lỗi xóa API Key');
    }
  };

  const handleTestKey = async (keyId: string) => {
    setTestingKeyId(keyId);
    try {
      const res = await testApiKey(keyId);
      setTestResult((prev) => ({ ...prev, [keyId]: res }));
    } catch (err: any) {
      alert(`Lỗi kiểm tra: ${err.message}`);
    } finally {
      setTestingKeyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-18 right-6 z-50 p-3.5 bg-teal-900 text-white rounded-xl shadow-lg border border-teal-700/80 flex items-center gap-2.5 text-xs font-medium animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header khu vực */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 tracking-tight">
            <KeyRound className="w-5 h-5 text-teal-700 shrink-0" />
            Bể Khóa API Đa Tầng
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tự động chia tải và chuyển đổi dự phòng (failover) khi có key chạm rate-limit (429)
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleAutoHeartbeat}
            disabled={isHeartbeating}
            className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 border border-slate-200 shadow-2xs whitespace-nowrap"
            title="Tự động kiểm tra latency và khả dụng của toàn bộ danh sách key"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-700 ${isHeartbeating ? 'animate-spin' : ''}`} />
            <span>{isHeartbeating ? 'Đang quét...' : 'Quét trạng thái key'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition cursor-pointer whitespace-nowrap active:scale-98"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAdding ? 'Đóng form' : 'Thêm khóa mới'}</span>
          </button>
        </div>
      </div>

      {/* Form Thêm Key Mới */}
      {isAdding && (
        <form onSubmit={handleAddKey} className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-3.5 animate-in fade-in">
          <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-teal-700" />
            <span>Thêm API Key Mới Vào Bể Khóa Xoay Vòng</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Tên Gợi Nhớ</label>
              <input
                type="text"
                placeholder="VD: Key Khoa Cấp Cứu 1"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Nhà Cung Cấp</label>
              <select
                value={newKeyProvider}
                onChange={(e) => setNewKeyProvider(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none cursor-pointer"
              >
                <option value="gemini">Google Gemini Cloud (Chính thức)</option>
                <option value="openai_compatible">OpenAI-Compatible (Ollama / vLLM)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Khóa API (Bảo Mật)</label>
              <input
                type="password"
                placeholder="Dán mã khóa API tại đây..."
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white font-mono text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
                required
              />
            </div>
          </div>
          {errorMsg && <div className="text-xs text-rose-600 font-medium">{errorMsg}</div>}
          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 shadow-2xs transition"
            >
              Lưu Vào Bể Khóa
            </button>
          </div>
        </form>
      )}

      {/* Danh Sách Khóa Trong Bể */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        {keys.map((k) => {
          const res = testResult[k.key_id];
          const isTesting = testingKeyId === k.key_id;
          return (
            <div key={k.key_id} className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-3.5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">{k.name}</h3>
                    {k.is_active ? (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Đang Phục Vụ
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        Dự Phòng Standby
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-mono text-sm text-slate-600 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                      {k.masked_key}
                    </span>
                    <span className="text-xs font-bold text-teal-800 uppercase bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200/80">
                      {k.provider}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(k.key_id)}
                  className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition cursor-pointer"
                  title="Xóa khóa khỏi bể xoay vòng"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* Strip Chỉ Số Vận Hành Từng Khóa (Per-Key Telemetry) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Tokens Hôm Nay</span>
                  <span className="font-mono font-bold text-slate-900 text-sm sm:text-base">
                    {(k.tokens_used_today || 0).toLocaleString('vi-VN')}
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Lượt Gọi</span>
                  <span className="font-mono font-bold text-teal-800 text-sm sm:text-base">
                    {k.requests_count || 0} reqs
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Lỗi 429</span>
                  <span className={`font-mono font-bold text-sm sm:text-base ${(k.error_429_count || 0) > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {k.error_429_count || 0} lần
                  </span>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Lần Dùng Cuối</span>
                  <span className="font-mono text-xs font-medium text-slate-700 block truncate" title={k.last_used_at || 'Chưa gọi'}>
                    {k.last_used_at || 'Chưa gọi'}
                  </span>
                </div>
              </div>

              {/* Kết quả Test Ping nếu có */}
              {res && (
                <div className={`p-3.5 rounded-xl text-sm space-y-1.5 border ${
                  res.success ? 'bg-emerald-50 text-emerald-950 border-emerald-200' : 'bg-rose-50 text-rose-950 border-rose-200'
                }`}>
                  <div className="flex items-center gap-2 font-semibold">
                    {res.success ? <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" /> : <XCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />}
                    <span>{res.message}</span>
                    <span className="ml-auto font-mono text-xs font-bold bg-white px-2 py-0.5 rounded border border-emerald-300 shrink-0">{res.latency_ms} ms</span>
                  </div>
                  {res.available_models.length > 0 && (
                    <div className="text-xs text-slate-600 pt-0.5">
                      Model khả dụng: {res.available_models.join(', ')}
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">
                  Hạn mức: <strong className="text-slate-800 font-mono">{k.quota_status}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleTestKey(k.key_id)}
                  disabled={isTesting}
                  className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 border border-slate-200"
                >
                  <Play className={`w-3 h-3 ${isTesting ? 'animate-spin text-teal-600' : ''}`} />
                  <span>{isTesting ? 'Đang ping...' : 'Kiểm Tra Ping'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
