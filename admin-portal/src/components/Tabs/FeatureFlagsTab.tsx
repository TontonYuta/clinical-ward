import React, { useEffect, useState } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import type { FeatureFlagResponse } from '../../types/admin';
import { fetchFeatureFlags, updateFeatureFlags, AdminApiError } from '../../services/adminApi';
import { rebaseFeatureFlagDraft } from '../../utils/featureFlagMerge';

export const FeatureFlagsTab: React.FC<{ data: FeatureFlagResponse | null; onSaved: (data: FeatureFlagResponse) => void }> = ({ data, onSaved }) => {
  const [draft, setDraft] = useState<FeatureFlagResponse | null>(data);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { setDraft(data); }, [data]);

  if (!draft) {
    return (
      <div className="p-4 bg-white rounded-lg border border-slate-200 text-xs text-slate-500 animate-pulse">
        Đang tải cấu hình chức năng app…
      </div>
    );
  }

  const save = async (attempt = 0, currentDraft = draft) => {
    if (!currentDraft) return;
    setSaving(true);
    setMessage('');
    try {
      const saved = await updateFeatureFlags(currentDraft);
      onSaved(saved);
      setDraft(saved);
      setMessage('Đã lưu cấu hình chức năng thành công vào CSDL.');
      setTimeout(() => setMessage(''), 3500);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 409 && attempt === 0) {
        try {
          const latest = await fetchFeatureFlags();
          const rebased = rebaseFeatureFlagDraft(data || latest, currentDraft, latest);
          setDraft(rebased);
          await save(1, rebased);
          return;
        } catch (retryError) {
          setMessage(retryError instanceof Error ? retryError.message : 'Không thể đồng bộ cấu hình tab.');
          return;
        }
      }
      setMessage(error instanceof Error ? error.message : 'Không thể lưu cấu hình tab.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">
            Cấu hình bật / ẩn chức năng Clinical Ward
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Bật hoặc ẩn từng phân hệ hiển thị trên Cổng Bác sĩ &amp; Điều dưỡng. Phân quyền theo vai trò vẫn được áp dụng riêng.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="h-9 inline-flex items-center gap-1.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50 active:scale-[0.98] self-start sm:self-auto shrink-0"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</span>
        </button>
      </div>

      {message && (
        <div className="px-5 py-3.5 rounded-2xl bg-teal-50 border border-teal-200 text-xs text-teal-900 font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Full-Width 3-Column Capability Toggle Cards (matching Main App OverviewCapabilities) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
        {draft.flags.map((flag) => {
          const isFixed = flag.key === 'overview';

          return (
            <div
              key={flag.key}
              className={`rounded-2xl border p-5 sm:p-6 shadow-2xs flex flex-col justify-between min-h-[156px] transition ${
                flag.enabled
                  ? 'bg-white border-slate-200 hover:border-teal-400'
                  : 'bg-slate-50/80 border-slate-200/80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-2xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {flag.key}
                  </span>
                  {isFixed ? (
                    <span className="text-2xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      Cố định
                    </span>
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={flag.enabled}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          flags: draft.flags.map((item) =>
                            item.key === flag.key ? { ...item, enabled: !item.enabled } : item
                          ),
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                        flag.enabled ? 'bg-teal-700' : 'bg-slate-300'
                      }`}
                      title={flag.enabled ? 'Tắt hiển thị phân hệ này' : 'Bật hiển thị phân hệ này'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                          flag.enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  )}
                </div>

                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {flag.label}
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {flag.description}
                </p>
              </div>

              <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-xs font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${flag.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className={flag.enabled ? 'text-teal-800 font-semibold' : 'text-slate-500'}>
                    {flag.enabled ? 'Đang hiển thị trên App chính' : 'Đang ẩn khỏi App chính'}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
