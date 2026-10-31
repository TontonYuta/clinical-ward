/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Lược bỏ toàn bộ Action Cards trong Chatbot theo yêu cầu người dùng ("xóa hết các card trong chatbot đi, rất rối mắt")
 */

import React from 'react';
import { ChatMessage, DashboardTab } from '../../../types/clinical';
import { AgentActionCard } from '../../../types/chat';

interface ActionCardDispatcherProps {
  msg?: ChatMessage;
  card?: AgentActionCard;
  messageId?: string;
  onExecuteCardAction?: (messageId: string, actionType: string, cardData: any) => void;
  onExecuteAction?: (messageId: string, actionType: string, cardData: any) => void;
  onSelectTab?: (tab: DashboardTab) => void;
  onOpenLegalDocs?: () => void;
}

export const ActionCardDispatcher: React.FC<ActionCardDispatcherProps> = () => {
  return null;
};
