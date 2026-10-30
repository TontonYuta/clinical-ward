/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ Giám Sát Chuỗi Lạnh Vắc Xin Chuẩn GSP & WHO PQS (<=200 LOC)
 */

import React, { useState, useMemo, useEffect } from 'react';
import { ColdChainMonitorState, VaccineBatchItem } from '../../../types/clinical';
import { clinicalAudio } from '../../../utils/audio';
import { PrintableFormType } from '../../Modals/PrintableFormModal';
import { INITIAL_VACCINE_INVENTORY } from '../../../data/vaccineInventoryData';
import { ColdChainHeaderRibbon, ColdChainFilterStatus, ColdChainSubTab } from './ColdChain/ColdChainHeaderRibbon';
import { ColdChainTelemetryCards } from './ColdChain/ColdChainTelemetryCards';
import { ColdChainQuarantineBanner } from './ColdChain/ColdChainQuarantineBanner';
import { ColdChainVaccineTable } from './ColdChain/ColdChainVaccineTable';
import { ColdChainVaccineCard } from './ColdChain/ColdChainVaccineCard';
import { ColdChainLogTable } from './ColdChain/ColdChainLogTable';
import { VaccineDetailModal } from '../../Modals/VaccineDetailModal';

interface ColdChainTabProps {
  coldChainState: ColdChainMonitorState;
  onTriggerOutage: () => void;
  onRestorePower: () => void;
  onReleaseQuarantine?: () => void;
  onOpenPrintForm?: (formType: PrintableFormType) => void;
  isAudioMuted: boolean;
}

export const ColdChainTab: React.FC<ColdChainTabProps> = ({
  coldChainState,
  onTriggerOutage,
  onRestorePower,
  onReleaseQuarantine,
  onOpenPrintForm,
  isAudioMuted,
}) => {
  const [searchQuery, setSearchQuery] = useState(() => (typeof window !== 'undefined' ? sessionStorage.getItem('coldchain_search') || '' : ''));
  const [filterStatus, setFilterStatus] = useState<ColdChainFilterStatus>(() => (typeof window !== 'undefined' ? (sessionStorage.getItem('coldchain_filter') as ColdChainFilterStatus) || 'all' : 'all'));
  const [activeSubTab, setActiveSubTab] = useState<ColdChainSubTab>(() => (typeof window !== 'undefined' ? (sessionStorage.getItem('coldchain_subtab') as ColdChainSubTab) || 'inventory' : 'inventory'));
  const [selectedVaccine, setSelectedVaccine] = useState<VaccineBatchItem | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem('coldchain_search', searchQuery);
      sessionStorage.setItem('coldchain_filter', filterStatus);
      sessionStorage.setItem('coldchain_subtab', activeSubTab);
    } catch {}
  }, [searchQuery, filterStatus, activeSubTab]);

  const isAlarm = coldChainState.alarmActive || coldChainState.currentTemp > 8.0;
  const isQuarantined = coldChainState.quarantineStatus === 'quarantined';

  const handleSimulateOutage = () => {
    onTriggerOutage();
  };

  const handleRestore = () => {
    if (!isAudioMuted) {
      clinicalAudio.stopAlarm();
      clinicalAudio.playSuccessChime();
    }
    onRestorePower();
  };

  // Lọc danh mục vắc xin & sinh phẩm theo từ khoá và bộ lọc GSP
  const filteredVaccines = useMemo(() => {
    return INITIAL_VACCINE_INVENTORY.filter((item) => {
      const effectivelyQuarantined = isQuarantined || item.status === 'quarantined';

      if (filterStatus === 'safe' && effectivelyQuarantined) return false;
      if (filterStatus === 'quarantined' && !effectivelyQuarantined) return false;
      if (filterStatus === 'freeze_sensitive' && !item.isFreezeSensitive) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.genericName.toLowerCase().includes(q) ||
          item.batchNumber.toLowerCase().includes(q) ||
          item.manufacturer.toLowerCase().includes(q) ||
          item.country.toLowerCase().includes(q) ||
          item.registrationNumber.toLowerCase().includes(q) ||
          item.nationalCode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [searchQuery, filterStatus, isQuarantined]);

  return (
    <div className="flex flex-col h-full overflow-hidden gap-1.5 w-full">
      {/* 1. Header Ribbon đồng bộ với FEFO & Sổ Nợ */}
      <ColdChainHeaderRibbon
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        totalVaccineCount={INITIAL_VACCINE_INVENTORY.length}
        totalLogsCount={coldChainState.logs.length}
        isAlarm={isAlarm}
        isQuarantined={isQuarantined}
        onRestore={handleRestore}
        onReleaseQuarantine={onReleaseQuarantine}
        onSimulateOutage={handleSimulateOutage}
        onOpenPrintForm={onOpenPrintForm}
      />

      {/* 2. Thẻ chỉ số cảm biến IoT & Đo lường vi khí hậu thời gian thực */}
      <ColdChainTelemetryCards
        coldChainState={coldChainState}
        isAlarm={isAlarm}
        isQuarantined={isQuarantined}
      />

      {/* 3. Banner Biệt Trữ Cách Ly Lô Vắc Xin (TT 36/2018/TT-BYT & WHO PQS) */}
      {isQuarantined && (
        <ColdChainQuarantineBanner
          coldChainState={coldChainState}
          onReleaseQuarantine={onReleaseQuarantine}
        />
      )}

      {/* 4. Nội dung chính: Danh mục vắc xin hoặc Lưới nhật ký IoT */}
      {activeSubTab === 'inventory' ? (
        <>
          {/* Desktop Table View (hidden md:block) */}
          <div className="hidden md:flex flex-col flex-1 min-h-0 overflow-hidden">
            <ColdChainVaccineTable
              vaccines={filteredVaccines}
              isQuarantined={isQuarantined}
              onSelectVaccine={(item) => setSelectedVaccine(item)}
              onOpenPrintForm={onOpenPrintForm}
            />
          </div>

          {/* Mobile Card View (md:hidden) */}
          <div className="md:hidden flex-1 min-h-0 overflow-y-auto px-1 pb-8 space-y-2">
            {filteredVaccines.length === 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-500 text-xs">
                Không tìm thấy vắc xin phù hợp với bộ lọc.
              </div>
            ) : (
              filteredVaccines.map((item, idx) => (
                <ColdChainVaccineCard
                  key={item.id}
                  item={item}
                  index={idx}
                  isQuarantined={isQuarantined}
                  onSelectVaccine={(vax) => setSelectedVaccine(vax)}
                  onOpenPrintForm={onOpenPrintForm}
                />
              ))
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <ColdChainLogTable logs={coldChainState.logs} />
        </div>
      )}

      {/* 5. Modal Chi Tiết Sinh Phẩm & Vắc Xin */}
      <VaccineDetailModal
        isOpen={!!selectedVaccine}
        onClose={() => setSelectedVaccine(null)}
        vaccine={selectedVaccine}
        isQuarantined={isQuarantined}
        onOpenPrintForm={(type) => onOpenPrintForm?.(type)}
      />
    </div>
  );
};
