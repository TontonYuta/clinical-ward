import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Save, SlidersHorizontal } from 'lucide-react';
import type { FeatureFlagResponse } from '../../types/admin';
import { updateFeatureFlags } from '../../services/adminApi';

export const FeatureFlagsTab: React.FC<{ data: FeatureFlagResponse | null; onSaved: (data: FeatureFlagResponse) => void }> = ({ data, onSaved }) => {
  const [draft, setDraft] = useState<FeatureFlagResponse | null>(data);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => { setDraft(data); }, [data]);
  if (!draft) return <div className="p-6 bg-white rounded-2xl border border-slate-200">Đang tải cấu hình tab…</div>;
  const save = async () => {
    setSaving(true); setMessage('');
    try { const saved = await updateFeatureFlags(draft); onSaved(saved); setDraft(saved); setMessage('Đã lưu cấu hình tab.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Không thể lưu cấu hình tab.'); }
    finally { setSaving(false); }
  };
  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><SlidersHorizontal className="w-5 h-5 text-teal-700"/>Chức năng Clinical Ward</h2><p className="text-sm text-slate-500 mt-1">Bật hoặc ẩn tab trên app chính. Quyền theo vai trò vẫn được áp dụng riêng.</p></div>
      <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold disabled:opacity-50"><Save className="w-4 h-4"/>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
    </div>
    {message && <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">{message}</div>}
    <div className="grid gap-3">{draft.flags.map((flag) => <div key={flag.key} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4">
      <div><div className="font-semibold text-slate-900">{flag.label}</div><div className="text-sm text-slate-500">{flag.description}</div><div className="text-xs font-mono text-slate-400 mt-1">{flag.key}</div></div>
      <button type="button" disabled={flag.key === 'overview'} onClick={() => setDraft({ ...draft, flags: draft.flags.map((item) => item.key === flag.key ? { ...item, enabled: !item.enabled } : item) })} className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold ${flag.enabled ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'} disabled:cursor-not-allowed`}>{flag.enabled ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}{flag.enabled ? 'Đang hiện' : 'Đang ẩn'}</button>
    </div>)}</div>
  </div>;
};
