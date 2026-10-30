/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Thanh điều khiển bộ lọc & tác vụ chuỗi lạnh GSP (<=200 LOC)
 */

import React from 'react';
import { Search, X, Layers, Clock } from 'lucide-react';
import { PrintableFormType } from '../../../Modals/PrintableFormModal';
import { ColdChainActions } from './ColdChainActions';

export type ColdChainFilterStatus = 'all' | 'safe' | 'quarantined' | 'freeze_sensitive';
export type ColdChainSubTab = 'inventory' | 'datalogger';

interface ColdChainHeaderRibbonProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterStatus: ColdChainFilterStatus;
  setFilterStatus: (f: ColdChainFilterStatus) => void;
  activeSubTab: ColdChainSubTab;
  setActiveSubTab: (t: ColdChainSubTab) => void;
  totalVaccineCount: number;
  totalLogsCount: number;
  isAlarm: boolean;
  isQuarantined: boolean;
  onRestore: () => void;
  onReleaseQuarantine?: () => void;
  onSimulateOutage: () => void;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
}

export const ColdChainHeaderRibbon: React.FC<ColdChainHeaderRibbonProps> = ({
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  activeSubTab,
  setActiveSubTab,
  totalVaccineCount,
  totalLogsCount,
  isAlarm,
  isQuarantined,
  onRestore,
  onReleaseQuarantine,
  onSimulateOutage,
  onOpenPrintForm,
}) => {
  return (
    <div className="shrink-0">
      {/* Mobile Layout (md:hidden) */}
      <div className="flex md:hidden flex-col gap-2 bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
        {/* Row 1: Search Input */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm vắc xin, số lô, hoạt chất..."
            aria-label="Tìm kiếm vắc xin"
            className="w-full min-h-9 pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:border-teal-700 focus:bg-white text-slate-900 placeholder-slate-400 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Row 2: Sub-tabs & Actions */}
        <div className="flex items-center justify-between gap-1.5 overflow-x-auto thin-scrollbar">
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-2xs shrink-0">
            <button
              type="button"
              data-testid="subtab-inventory-mobile"
              onClick={() => setActiveSubTab('inventory')}
              className={`px-2 py-1 rounded font-semibold transition cursor-pointer flex items-center gap-1 ${
                activeSubTab === 'inventory' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3 h-3 text-teal-600" />
              <span>Vắc xin ({totalVaccineCount})</span>
            </button>
            <button
              type="button"
              data-testid="subtab-datalogger-mobile"
              onClick={() => setActiveSubTab('datalogger')}
              className={`px-2 py-1 rounded font-semibold transition cursor-pointer flex items-center gap-1 ${
                activeSubTab === 'datalogger' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3 h-3 text-slate-500" />
              <span>IoT 24h ({totalLogsCount})</span>
            </button>
          </div>

          <ColdChainActions
            isAlarm={isAlarm}
            isQuarantined={isQuarantined}
            onRestore={onRestore}
            onReleaseQuarantine={onReleaseQuarantine}
            onSimulateOutage={onSimulateOutage}
            onOpenPrintForm={onOpenPrintForm}
            size="sm"
          />
        </div>
      </div>

      {/* Desktop Layout (hidden md:block) */}
      <div className="hidden md:block overflow-x-auto thin-scrollbar">
        <div className="flex min-w-max items-center justify-between gap-3 bg-white p-1.5 rounded-lg border border-slate-200 shadow-2xs">
          {/* Left: Search & Filter Mode */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative w-64 lg:w-72 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên vắc xin, số lô, hoạt chất..."
                aria-label="Tìm trong kho lạnh"
                className="w-full pl-9 pr-7 py-1.5 text-xs lg:text-sm bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:border-teal-700 focus:bg-white text-slate-900 placeholder-slate-400 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as ColdChainFilterStatus)}
              aria-label="Bộ lọc bảo quản"
              className="min-h-8.5 px-2.5 py-1 text-xs lg:text-sm font-medium bg-slate-50 border border-slate-200 rounded-md text-slate-800 focus:outline-hidden focus:border-teal-700 transition cursor-pointer shrink-0"
            >
              <option value="all">Tất cả quy cách ({totalVaccineCount})</option>
              <option value="safe">Đạt chuẩn GSP (2°C - 8°C)</option>
              <option value="quarantined">Đang biệt trữ (TT 36)</option>
              <option value="freeze_sensitive">Nhạy cảm nhiệt đông</option>
            </select>

            {/* Sub-tab pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md text-xs shrink-0">
              <button
                type="button"
                data-testid="subtab-inventory-desktop"
                onClick={() => setActiveSubTab('inventory')}
                className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === 'inventory' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-teal-600" />
                <span>Danh mục Vắc xin ({totalVaccineCount})</span>
              </button>
              <button
                type="button"
                data-testid="subtab-datalogger-desktop"
                onClick={() => setActiveSubTab('datalogger')}
                className={`px-2.5 py-1 rounded font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeSubTab === 'datalogger' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Nhật ký IoT 24h ({totalLogsCount})</span>
              </button>
            </div>
          </div>

          {/* Right: Actions */}
          <ColdChainActions
            isAlarm={isAlarm}
            isQuarantined={isQuarantined}
            onRestore={onRestore}
            onReleaseQuarantine={onReleaseQuarantine}
            onSimulateOutage={onSimulateOutage}
            onOpenPrintForm={onOpenPrintForm}
            size="md"
          />
        </div>
      </div>
    </div>
  );
};
