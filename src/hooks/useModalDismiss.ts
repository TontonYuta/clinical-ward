/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Hook xử lý đóng modal mượt mà qua phím Escape và click backdrop
 */

import { useEffect } from 'react';

export function useModalDismiss(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
}
