import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, XCircle, Play, RefreshCw, ShieldCheck, Info } from 'lucide-react';
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
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-18 right-6 z-50 p-3.5 bg-teal-900 text-white rounded-lg shadow-lg border border-teal-700/80 flex items-center gap-2.5 text-xs font-medium animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:px-4 sm:py-3 bg-white rounded-lg border border-slate-200/90">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            Bể Khóa API Đa Tầng (Key Vault)
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
            className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 border border-slate-300 whitespace-nowrap"
            title="Tự động kiểm tra latency và khả dụng của toàn bộ danh sách key"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-700 ${isHeartbeating ? 'animate-spin' : ''}`} />
            <span>{isHeartbeating ? 'Đang quét...' : 'Quét trạng thái key'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="px-3 py-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap active:scale-98"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAdding ? 'Đóng form' : 'Thêm khóa mới'}</span>
          </button>
        </div>
      </div>

      {/* Form Thêm Key Mới (Inline Flat) */}
      {isAdding && (
        <form onSubmit={handleAddKey} className="p-3 sm:px-4 sm:py-3.5 bg-white rounded-lg border border-slate-200/90 space-y-3 animate-in fade-in">
          <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Thêm API Key Mới Vào Bể Khóa Xoay Vòng
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Tên Gợi Nhớ</label>
              <input
                type="text"
                placeholder="VD: Key Khoa Cấp Cứu 1"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-full h-8 px-2.5 rounded-md border border-slate-300 bg-white text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Nhà Cung Cấp</label>
              <select
                value={newKeyProvider}
                onChange={(e) => setNewKeyProvider(e.target.value)}
                className="w-full h-8 px-2.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none cursor-pointer"
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
                className="w-full h-8 px-2.5 rounded-md border border-slate-300 bg-white font-mono text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
                required
              />
            </div>
          </div>
          {errorMsg && <div className="text-xs text-rose-600 font-medium">{errorMsg}</div>}
          <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-2.5 py-1 rounded-md border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-3.5 py-1 rounded-md bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition"
            >
              Lưu Vào Bể Khóa
            </button>
          </div>
        </form>
      )}

      {/* Banner thông tin cơ chế bể khóa & tính minh bạch */}
      <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg flex items-start gap-2.5 text-xs text-blue-900">
        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-blue-950">Cơ chế quản lý Bể khóa Đa tầng:</span> Hệ thống luôn tự động hiển thị và duy trì <strong>Khóa Mặc Định Hệ Thống</strong> được cấu hình sẵn từ máy chủ Render. Khi bạn bấm <em>"Thêm khóa mới"</em> để nạp các khóa dự phòng, hệ thống sẽ ưu tiên sử dụng các khóa này và tự động xoay vòng dự phòng (Failover &lt; 50ms) nếu một khóa chạm ngưỡng hạn mức 15 RPM.
        </div>
      </div>

      {/* Bảng Danh Sách Khóa Phẳng (Seamless Table) */}
      <div className="bg-white border border-slate-200/90 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-semibold text-2xs uppercase tracking-wider">
                <th className="py-2.5 px-3">Tên Khóa</th>
                <th className="py-2.5 px-3">Nhà Cung Cấp</th>
                <th className="py-2.5 px-3">Khóa Che (Masked)</th>
                <th className="py-2.5 px-3">Hạn Mức (Quota)</th>
                <th className="py-2.5 px-3">Tokens Hôm Nay</th>
                <th className="py-2.5 px-3">Lỗi 429</th>
                <th className="py-2.5 px-3">Trạng Thái</th>
                <th className="py-2.5 px-3 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Bể khóa API đang trống. Vui lòng bấm "Thêm khóa mới" để nạp khóa.
                  </td>
                </tr>
              ) : (
                keys.map((k) => {
                  const res = testResult[k.key_id];
                  const isTesting = testingKeyId === k.key_id;
                  const isSysEnv = k.is_system_env || k.key_id.startsWith('sys-env') || k.name.includes('Hệ Thống');

                  return (
                    <React.Fragment key={k.key_id}>
                      <tr className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{k.name}</span>
                            {isSysEnv && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200" title="Khóa cấu hình từ biến môi trường máy chủ Render">
                                Mặc định
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-2xs font-mono text-slate-500 uppercase">
                            {k.provider}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {k.masked_key}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200"
                            title="Hạn mức tiêu chuẩn Google AI Studio: 15 RPM (Lượt gọi/phút), 1M TPM (Token/phút), 1.500 RPD (Lượt gọi/ngày)"
                          >
                            {k.quota_status || '15 RPM · 1.000.000 TPM · 1.500 RPD'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-900 font-medium">
                          {(k.tokens_used_today || 0).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">
                          <span className={(k.error_429_count || 0) > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                            {k.error_429_count || 0}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {k.is_active ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Đang phục vụ
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                              Dự phòng
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleTestKey(k.key_id)}
                              disabled={isTesting}
                              className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-2xs font-medium inline-flex items-center gap-1 transition disabled:opacity-50"
                              title="Kiểm tra ping latency và kết nối Google API"
                            >
                              <Play className={`w-3 h-3 ${isTesting ? 'animate-spin text-teal-600' : ''}`} />
                              <span>{isTesting ? 'Ping...' : 'Kiểm tra'}</span>
                            </button>
                            {isSysEnv ? (
                              <span
                                className="p-1 rounded text-blue-600 bg-blue-50/70 border border-blue-200/60 inline-flex items-center"
                                title="Khóa hệ thống mặc định được bảo vệ an toàn (quản lý qua Render Cloud)"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDelete(k.key_id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Xóa khóa khỏi bể xoay vòng"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Dòng hiển thị kết quả kiểm tra Ping nếu có */}
                      {res && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={8} className="px-3 py-1.5 border-t border-slate-100 text-2xs">
                            <div className="flex items-center gap-2">
                              {res.success ? (
                                <span className="font-semibold text-emerald-800 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>{res.message}</span>
                                </span>
                              ) : (
                                <span className="font-semibold text-rose-700 flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                  <span>{res.message}</span>
                                </span>
                              )}
                              <span className="font-mono text-slate-600 font-bold">({res.latency_ms} ms)</span>
                              {res.available_models.length > 0 && (
                                <span className="text-slate-500 font-mono">
                                  · Models: {res.available_models.join(', ')}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
