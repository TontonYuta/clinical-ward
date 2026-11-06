import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ClinicalAuthModal } from '../../src/components/Modals/ClinicalAuthModal';

export function mountAuth(mode: 'reject' | 'cancel' | 'witness') {
  const container = document.createElement('div');
  document.body.replaceChildren(container);
  (window as any).authCalls = 0;
  function Harness() {
    const [open, setOpen] = useState(true);
    const [request] = useState(() => ({
      actionType: 'DISPATCH_FEFO' as const, title: 'Audit test', description: 'Test', targetItem: 'Test', legalBasis: 'Demo',
      requiredRoles: ['pharmacist' as const], requiresDualWitness: mode === 'witness', dualWitnessRoles: ['doctor' as const],
      onConfirm: async () => {
        (window as any).authCalls++;
        if (mode === 'reject') throw new Error('API refused operation');
      },
    }));
    return <ClinicalAuthModal isOpen={open} request={request} currentUserRole="pharmacist" onClose={() => setOpen(false)} isAudioMuted />;
  }
  createRoot(container).render(<Harness />);
}
