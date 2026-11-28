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
    <div className="space-y-6">
      {/* Subtab Underline Switcher (Main App airy scale, consistent Teal accent) */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setSubTab('keys')}
          className={`px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap border-b-2 -mb-px ${
            subTab === 'keys'
              ? 'border-teal-700 text-teal-800 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Kho khóa API</span>
          <span className="text-2xs font-mono px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
            {keys.filter((k) => k.is_active).length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('telecom')}
          className={`px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap border-b-2 -mb-px ${
            subTab === 'telecom'
              ? 'border-teal-700 text-teal-800 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Cổng viễn thông (SMS &amp; Email)</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('flags')}
          className={`px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer inline-flex items-center gap-2 whitespace-nowrap border-b-2 -mb-px ${
            subTab === 'flags'
              ? 'border-teal-700 text-teal-800 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
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
