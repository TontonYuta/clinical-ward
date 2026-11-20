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
    <div className="space-y-4">
      {/* Flat Header Toolbar */}
      <div className="bg-white border border-slate-200/90 rounded-lg p-3 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            Cấu Hình Bật / Ẩn Chức Năng Clinical Ward
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bật hoặc ẩn tab hiển thị trên Cổng Bác sĩ &amp; Điều dưỡng. Phân quyền theo vai trò vẫn được áp dụng riêng.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-2xs transition disabled:opacity-50 active:scale-98 self-start sm:self-auto shrink-0"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Đang lưu…' : 'Lưu Thay Đổi'}</span>
        </button>
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900 font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Flat Settings List (Seamless Table / List) */}
      <div className="bg-white border border-slate-200/90 rounded-lg overflow-hidden divide-y divide-slate-100">
        <div className="hidden sm:grid sm:grid-cols-12 px-4 py-2 bg-slate-50/60 text-2xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
          <div className="sm:col-span-4">Chức Năng Phân Hệ</div>
          <div className="sm:col-span-6">Mục Tiêu Lâm Sàng &amp; Pháp Lý</div>
          <div className="sm:col-span-2 text-right">Trạng Thái</div>
        </div>

        {draft.flags.map((flag) => {
          const isFixed = flag.key === 'overview';

          return (
            <div
              key={flag.key}
              className={`p-3 sm:px-4 sm:py-3 flex flex-col sm:grid sm:grid-cols-12 items-start sm:items-center gap-2 sm:gap-4 hover:bg-slate-50/70 transition ${
                flag.enabled ? '' : 'bg-slate-50/30'
              }`}
            >
              {/* Cột 1: Tên chức năng & Key */}
              <div className="sm:col-span-4 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-xs sm:text-sm text-slate-900">
                    {flag.label}
                  </span>
                  {isFixed && (
                    <span className="text-3xs font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                      Cố định
                    </span>
                  )}
                </div>
                <span className="text-3xs font-mono text-slate-400">
                  key: {flag.key}
                </span>
              </div>

              {/* Cột 2: Mô tả lâm sàng */}
              <div className="sm:col-span-6 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {flag.description}
              </div>

              {/* Cột 3: Nút Bật / Tắt */}
              <div className="sm:col-span-2 sm:text-right w-full sm:w-auto flex justify-end">
                <button
                  type="button"
                  disabled={isFixed}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      flags: draft.flags.map((item) =>
                        item.key === flag.key ? { ...item, enabled: !item.enabled } : item
                      ),
                    })
                  }
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition cursor-pointer ${
                    flag.enabled
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${flag.enabled ? 'bg-emerald-600' : 'bg-slate-400'}`}></span>
                  <span>{flag.enabled ? 'Đang hiện' : 'Đang ẩn'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
