/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Phân hệ Giám Sát Chuỗi Lạnh Vắc Xin Chuẩn GSP & WHO PQS (<=200 LOC)
 */

import React from 'react';
import { ColdChainMonitorState } from '../../../types/clinical';
import { clinicalAudio } from '../../../utils/audio';
import { PrintableFormType } from '../../Modals/PrintableFormModal';
import { ColdChainHeader } from './ColdChain/ColdChainHeader';
import { ColdChainGaugeBanner } from './ColdChain/ColdChainGaugeBanner';
import { ColdChainQuarantineBanner } from './ColdChain/ColdChainQuarantineBanner';
import { ColdChainLogGrid } from './ColdChain/ColdChainLogGrid';
import { ColdChainInventoryList } from './ColdChain/ColdChainInventoryList';

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

  return (
    <div className="h-full flex flex-col overflow-hidden space-y-2.5 w-full">
      {/* 1. Slim Integrated Action Bar */}
      <ColdChainHeader
        isAlarm={isAlarm}
        isQuarantined={isQuarantined}
        onOpenPrintForm={onOpenPrintForm}
        onRestore={handleRestore}
        onReleaseQuarantine={onReleaseQuarantine}
        onSimulateOutage={handleSimulateOutage}
      />

      {/* 2. Sleek Compact Instrument Banner */}
      <ColdChainGaugeBanner coldChainState={coldChainState} isAlarm={isAlarm} />

      {/* 3. Isolated Scrollable Area */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3 pb-8">
        {/* Quarantine Assessment Banner (GSP TT 36/2018 & WHO PQS) */}
        {isQuarantined && (
          <ColdChainQuarantineBanner
            coldChainState={coldChainState}
            onReleaseQuarantine={onReleaseQuarantine}
          />
        )}

        {/* 24h Temperature Log Grid */}
        <ColdChainLogGrid logs={coldChainState.logs} />

        {/* Vaccine Inventory Breakdown Card */}
        <ColdChainInventoryList
          isQuarantined={isQuarantined}
          totalDoses={coldChainState.totalVaccineDoses}
        />
      </div>
    </div>
  );
};
