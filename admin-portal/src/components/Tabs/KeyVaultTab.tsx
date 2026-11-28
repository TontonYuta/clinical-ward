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

  const handleTestKey = async (keyId: string, provider?: string) => {
    setTestingKeyId(keyId);
    try {
      const res = await testApiKey(keyId, undefined, provider);
      setTestResult((prev) => ({ ...prev, [keyId]: res }));
    } catch (err: any) {
      alert(`Lỗi kiểm tra: ${err.message}`);
    } finally {
      setTestingKeyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-16 right-6 z-50 px-4 py-3 bg-teal-900 text-white rounded-xl shadow-lg border border-teal-700/80 flex items-center gap-2.5 text-xs font-medium animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Toolbar + Integrated Subtle Note */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
        <div className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 tracking-tight">
              Bể khóa API đa tầng (Key Vault)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tự động xoay vòng và chuyển đổi dự phòng khi có khóa chạm ngưỡng giới hạn (429)
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleAutoHeartbeat}
              disabled={isHeartbeating}
              className="h-9 px-3 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 border border-slate-200 whitespace-nowrap"
              title="Tự động kiểm tra độ trễ và trạng thái khả dụng của toàn bộ khóa"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-700 ${isHeartbeating ? 'animate-spin' : ''}`} />
              <span>{isHeartbeating ? 'Đang quét...' : 'Quét trạng thái'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(!isAdding)}
              className="h-9 px-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>{isAdding ? 'Đóng form' : 'Thêm khóa mới'}</span>
            </button>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center gap-2 text-2xs text-slate-600">
          <Info className="w-3.5 h-3.5 text-teal-700 shrink-0" />
          <span>
            Hệ thống duy trì khóa mặc định từ môi trường máy chủ và ưu tiên xoay vòng các khóa dự phòng bạn thêm (chuyển đổi &lt; 50ms).
          </span>
        </div>
      </div>

      {/* Form Thêm Key Mới (Inline Flat) */}
      {isAdding && (
        <form onSubmit={handleAddKey} className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/90 space-y-4 animate-in fade-in">
          <div className="text-sm font-semibold text-slate-900">
            Thêm API Key mới vào bể khóa xoay vòng
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Tên gợi nhớ</label>
              <input
                type="text"
                placeholder="VD: Key Khoa Cấp Cứu 1"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Nhà cung cấp</label>
              <select
                value={newKeyProvider}
                onChange={(e) => setNewKeyProvider(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 focus:border-teal-600 focus:outline-none cursor-pointer"
              >
                <option value="gemini">Google Gemini Cloud (LLM Chính thức)</option>
                <option value="groq">Groq API (Free Tier - gpt-oss-120b)</option>
                <option value="openrouter">OpenRouter API (:free models)</option>
                <option value="mistral">Mistral API (Free Tier)</option>
                <option value="serper">Google Serper API (Tìm kiếm Web Fallback)</option>
                <option value="openai_compatible">OpenAI-Compatible (Ollama / vLLM)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Khóa API (Bảo mật)</label>
              <input
                type="password"
                placeholder="Dán mã khóa API tại đây..."
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white font-mono text-xs text-slate-800 focus:border-teal-600 focus:outline-none"
                required
              />
            </div>
          </div>
          {errorMsg && <div className="text-xs text-rose-600 font-medium">{errorMsg}</div>}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="h-9 px-3.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="h-9 px-4 rounded-xl bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition cursor-pointer"
            >
              Lưu vào bể khóa
            </button>
          </div>
        </form>
      )}

      {/* Bảng Danh Sách Khóa (Desktop Table + Mobile Card List) */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-semibold text-2xs uppercase tracking-wider">
                <th className="py-3 pl-5 sm:pl-6 pr-3">Tên khóa</th>
                <th className="py-3 px-3">Nhà cung cấp</th>
                <th className="py-3 px-3">Khóa che</th>
                <th className="py-3 px-3">Hạn mức</th>
                <th className="py-3 px-3">Sản lượng hôm nay</th>
                <th className="py-3 px-3">Lỗi 429</th>
                <th className="py-3 px-3">Trạng thái</th>
                <th className="py-3 pl-3 pr-5 sm:pr-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
                    Bể khóa API đang trống. Nhấn &quot;Thêm khóa mới&quot; để nạp khóa dự phòng.
                  </td>
                </tr>
              ) : (
                keys.map((k) => {
                  const res = testResult[k.key_id];
                  const isTesting = testingKeyId === k.key_id;
                  const isSysEnv = k.is_system_env || k.key_id.startsWith('sys-env') || k.name.includes('Hệ Thống');

                  return (
                    <React.Fragment key={k.key_id}>
                      <tr className="hover:bg-teal-50/40 transition-colors">
                        <td className="py-3 pl-5 sm:pl-6 pr-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{k.name}</span>
                            {isSysEnv && (
                              <span className="px-1.5 py-0.5 rounded-md text-3xs font-semibold uppercase bg-sky-50 text-sky-700 border border-sky-200/80" title="Khóa cấu hình từ biến môi trường máy chủ">
                                Mặc định
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {k.provider === 'serper' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                              SERPER (SEARCH)
                            </span>
                          ) : k.provider === 'gemini' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              GEMINI (LLM)
                            </span>
                          ) : k.provider === 'groq' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-amber-50 text-amber-800 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              GROQ (LLM)
                            </span>
                          ) : k.provider === 'openrouter' ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-sky-50 text-sky-800 border border-sky-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                              OPENROUTER (FREE)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono uppercase bg-purple-50 text-purple-700 border border-purple-200">
                              {k.provider}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {k.masked_key}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {(() => {
                            const defaultQuota =
                              k.provider === 'serper'
                                ? '2.500 Free Queries / Month'
                                : k.provider === 'groq'
                                  ? '30 RPM · 8.000 TPM · 1.000 RPD'
                                  : k.provider === 'openrouter' || k.provider === 'mistral'
                                    ? 'Free Tier (Multi-Provider Fallback)'
                                    : '15 RPM · 1.000.000 TPM · 1.500 RPD';
                            return (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200"
                                title={`Hạn mức ${k.provider.toUpperCase()}: ${defaultQuota}`}
                              >
                                {k.quota_status || defaultQuota}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-slate-900 font-medium">
                          {k.provider === 'serper' ? (
                            <span className="text-indigo-700 font-bold">
                              {(k.requests_count || 0).toLocaleString('vi-VN')} <span className="text-3xs font-normal text-slate-500">lượt search</span>
                            </span>
                          ) : (
                            <span>
                              {(k.tokens_used_today || 0).toLocaleString('vi-VN')} <span className="text-3xs font-normal text-slate-500">tokens</span>
                            </span>
                          )}
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
                              onClick={() => handleTestKey(k.key_id, k.provider)}
                              disabled={isTesting}
                              className="px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-2xs font-medium inline-flex items-center gap-1 transition disabled:opacity-50"
                              title="Kiểm tra ping latency và kết nối API"
                            >
                              <Play className={`w-3 h-3 ${isTesting ? 'animate-spin text-teal-600' : ''}`} />
                              <span>{isTesting ? 'Ping...' : 'Kiểm tra'}</span>
                            </button>
                            {isSysEnv ? (
                              <span
                                className="p-1.5 rounded-lg text-sky-700 bg-sky-50 border border-sky-200/70 inline-flex items-center"
                                title="Khóa hệ thống mặc định được bảo vệ an toàn từ môi trường máy chủ"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDelete(k.key_id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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
                          <td colSpan={8} className="px-5 py-2 border-t border-slate-100 text-2xs">
                            <div className="flex items-center gap-2 flex-wrap">
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
                              <span className="font-mono text-slate-600 font-semibold">({res.latency_ms} ms)</span>
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

        {/* Mobile Card List (zero clipped text on 390px) */}
        <div className="md:hidden divide-y divide-slate-100">
          {keys.length === 0 ? (
            <div className="py-10 px-4 text-center text-slate-500 text-xs">
              Bể khóa API đang trống. Nhấn &quot;Thêm khóa mới&quot; để nạp khóa dự phòng.
            </div>
          ) : (
            keys.map((k) => {
              const isTesting = testingKeyId === k.key_id;
              const isSysEnv = k.is_system_env || k.key_id.startsWith('sys-env') || k.name.includes('Hệ Thống');
              return (
                <div key={k.key_id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{k.name}</div>
                      <div className="text-2xs font-mono text-slate-500 mt-0.5">{k.masked_key}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-3xs font-mono font-semibold uppercase bg-slate-100 text-slate-700 shrink-0">
                      {k.provider}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-2xs text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${k.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {k.is_active ? 'Đang phục vụ' : 'Dự phòng'}
                    </span>
                    <span className="font-mono">
                      {k.provider === 'serper'
                        ? `${(k.requests_count || 0).toLocaleString('vi-VN')} lượt`
                        : `${(k.tokens_used_today || 0).toLocaleString('vi-VN')} tok`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleTestKey(k.key_id, k.provider)}
                      disabled={isTesting}
                      className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 text-2xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Play className={`w-3 h-3 ${isTesting ? 'animate-spin text-teal-600' : ''}`} />
                      {isTesting ? 'Đang ping...' : 'Kiểm tra'}
                    </button>
                    {!isSysEnv && (
                      <button
                        type="button"
                        onClick={() => handleDelete(k.key_id)}
                        className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                        aria-label="Xóa khóa"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
