import React, { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Save,
  SlidersHorizontal,
  Activity,
  Stethoscope,
  ClipboardList,
  Wrench,
  Package,
  ThermometerSnowflake,
  Boxes,
  FileCheck2,
  BookOpen,
  CheckCircle2
} from 'lucide-react';
import type { FeatureFlagResponse, ClinicalFeatureKey } from '../../types/admin';
import { fetchFeatureFlags, updateFeatureFlags, AdminApiError } from '../../services/adminApi';
import { rebaseFeatureFlagDraft } from '../../utils/featureFlagMerge';

const FEATURE_ICONS: Record<ClinicalFeatureKey, React.ComponentType<{ className?: string }>> = {
  overview: Activity,
  cpoe: Stethoscope,
  debt: ClipboardList,
  equipment: Wrench,
  fefo: Package,
  coldchain: ThermometerSnowflake,
  asset_audit: Boxes,
  bhyt_audit: FileCheck2,
  documents: BookOpen,
};

export const FeatureFlagsTab: React.FC<{ data: FeatureFlagResponse | null; onSaved: (data: FeatureFlagResponse) => void }> = ({ data, onSaved }) => {
  const [draft, setDraft] = useState<FeatureFlagResponse | null>(data);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { setDraft(data); }, [data]);

  if (!draft) {
    return (
      <div className="p-6 bg-white rounded-xl border border-slate-200 text-xs text-slate-500 animate-pulse">
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
      {/* Header */}
      <div className="p-4 sm:p-5 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 tracking-tight">
            <SlidersHorizontal className="w-5 h-5 text-teal-700" />
            Cấu Hình Bật / Ẩn Chức Năng Clinical Ward
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bật hoặc ẩn tab hiển thị trên Cổng Bác sĩ &amp; Điều dưỡng. Phân quyền theo vai trò vẫn được áp dụng riêng.
          </p>
        </div>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-2xs transition disabled:opacity-50 active:scale-98 self-start sm:self-auto shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Đang lưu…' : 'Lưu Thay Đổi'}</span>
        </button>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-900 font-medium flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Grid Danh sách chức năng */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {draft.flags.map((flag) => {
          const Icon = FEATURE_ICONS[flag.key] || Activity;
          const isFixed = flag.key === 'overview';

          return (
            <div
              key={flag.key}
              className={`bg-white border rounded-xl p-4 flex items-center justify-between gap-4 transition shadow-2xs ${
                flag.enabled ? 'border-slate-200/90' : 'border-slate-200/60 opacity-80'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition ${
                    flag.enabled ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                      {flag.label}
                    </span>
                    {isFixed && (
                      <span className="text-3xs font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                        Cố định
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-slate-500 mt-0.5 line-clamp-2">
                    {flag.description}
                  </p>
                  <span className="text-3xs font-mono text-slate-400 mt-1 inline-block">
                    key: {flag.key}
                  </span>
                </div>
              </div>

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
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                  flag.enabled
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {flag.enabled ? <Eye className="w-3.5 h-3.5 text-emerald-700" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                <span>{flag.enabled ? 'Đang hiện' : 'Đang ẩn'}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
