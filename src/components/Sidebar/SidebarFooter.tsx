/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown, UserRound, Settings2 } from 'lucide-react';
import { UserRole } from '../../types/clinical';
import type { AppFontScale } from '../../utils/storage/appStatePersistence';
import { SettingsModal } from '../Settings/SettingsModal';
import { USER_PROFILES } from '../../data/initialData';

interface SidebarFooterProps {
  isCollapsed: boolean;
  currentUserRole: UserRole;
  onSelectUserRole?: (role: UserRole) => void;
  onLogout?: () => Promise<void>;
  isAuthenticated: boolean;
  username?: string;
  fontScale: AppFontScale;
  onFontScaleChange: (scale: AppFontScale) => void;
  onCloseMobile?: () => void;
}

const ROLE_OPTIONS: UserRole[] = ['nurse', 'pharmacist', 'doctor', 'biomedical_engineer', 'director'];

export const SidebarFooter: React.FC<SidebarFooterProps> = ({
  isCollapsed, currentUserRole, onSelectUserRole, onLogout, isAuthenticated, username, fontScale, onFontScaleChange, onCloseMobile,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const profile = USER_PROFILES[currentUserRole] || USER_PROFILES.nurse;
  return (
    <div className="sidebar-account relative shrink-0">
      {isOpen && onSelectUserRole && (
        <div role="menu" aria-label="Chọn vai trò" className={`absolute bottom-full mb-2 ${isCollapsed ? 'left-14 w-64' : 'left-2 right-2'} rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 max-h-[70vh] overflow-y-auto`}>
          {ROLE_OPTIONS.map((role) => {
            const item = USER_PROFILES[role];
            return <button key={role} type="button" role="menuitem" onClick={() => { onSelectUserRole(role); setIsOpen(false); onCloseMobile?.(); }} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-slate-50 ${role === currentUserRole ? 'bg-slate-50 font-semibold text-slate-900' : 'text-slate-700'}`}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">{item.name.split(' ').slice(-2).map((p) => p[0]).join('')}</span><span className="min-w-0 flex-1 truncate">{item.name}</span></button>;
          })}
        </div>
      )}
      <button type="button" aria-haspopup="menu" aria-expanded={isOpen} onClick={() => setIsOpen((v) => !v)} className={`account-trigger ${isCollapsed ? 'justify-center' : ''}`} title={`${isAuthenticated && username ? username : profile.name} · ${profile.roleName}`}>
        <span className="account-avatar"><UserRound className="h-4 w-4" /></span>
        {!isCollapsed && <><span className="min-w-0 flex-1"><span className="sidebar-account-name">{isAuthenticated && username ? username : profile.name}</span><span className="sidebar-account-role">{profile.roleName}</span></span><ChevronDown className="h-4 w-4 text-slate-500" /></>}
      </button>
      <button type="button" onClick={() => setIsSettingsOpen(true)} aria-label="Cài đặt" title="Cài đặt" className={'sidebar-settings ' + (isCollapsed ? 'justify-center' : '')}><Settings2 className="h-4 w-4" />{!isCollapsed && 'Cài đặt'}</button>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} fontScale={fontScale} onFontScaleChange={onFontScaleChange} isAuthenticated={isAuthenticated} username={username} roleLabel={profile.roleName} onLogout={onLogout} />
    </div>
  );
};
