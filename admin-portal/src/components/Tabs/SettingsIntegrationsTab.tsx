import React, { useState } from 'react';
import { KeyRound, Radio, SlidersHorizontal } from 'lucide-react';
import { ApiKeyItem, FeatureFlagResponse } from '../../types/admin';
import { KeyVaultTab } from './KeyVaultTab';
import { IntegrationsTab } from './IntegrationsTab';
import { FeatureFlagsTab } from './FeatureFlagsTab';

interface SettingsIntegrationsTabProps {
  keys: ApiKeyItem[];
  onRefresh: () => void;
  featureFlags: FeatureFlagResponse | null;
  onFeatureFlagsSaved: (data: FeatureFlagResponse) => void;
  initialSubTab?: 'keys' | 'telecom' | 'flags';
}

export const SettingsIntegrationsTab: React.FC<SettingsIntegrationsTabProps> = ({
  keys,
  onRefresh,
  featureFlags,
  onFeatureFlagsSaved,
  initialSubTab = 'keys',
}) => {
  const [subTab, setSubTab] = useState<'keys' | 'telecom' | 'flags'>(initialSubTab);

  return (
    <div className="space-y-4">
      {/* Subtab Segmented Switcher */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setSubTab('keys')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
            subTab === 'keys'
              ? 'bg-slate-900 text-white font-semibold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>Kho khóa API</span>
          <span className="text-2xs font-mono opacity-70">({keys.filter((k) => k.is_active).length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('telecom')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
            subTab === 'telecom'
              ? 'bg-slate-900 text-white font-semibold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Cổng viễn thông (SMS &amp; Email)</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('flags')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
            subTab === 'flags'
              ? 'bg-slate-900 text-white font-semibold'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Chức năng app Clinical Ward</span>
        </button>
      </div>

      {/* Subtab Content */}
      {subTab === 'keys' && <KeyVaultTab keys={keys} onRefresh={onRefresh} />}
      {subTab === 'telecom' && <IntegrationsTab onRefreshData={onRefresh} />}
      {subTab === 'flags' && <FeatureFlagsTab data={featureFlags} onSaved={onFeatureFlagsSaved} />}
    </div>
  );
};
