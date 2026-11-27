import assert from 'node:assert/strict';
import type { ChatMessage } from '../src/types/chat';
import { resolveAutoSyncedInspectorState } from '../src/utils/inspectorAutoSync';

const makeAgentMsg = (id: string, page: number, isStreaming = false): ChatMessage => ({
  id,
  sender: 'agent',
  text: `Answer ${id}`,
  timestamp: new Date().toISOString(),
  isStreaming,
  citations: [
    {
      index: 1,
      title: `Dược thư QG Trang ${page}`,
      source: 'Dược thư Quốc gia Việt Nam',
      legal_basis: 'QĐ 2033/QĐ-BYT',
      page,
      excerpt: 'Chỉ định: ...',
    },
  ],
});

// 1. Auto-syncs when inspector is open and new AI message finishes streaming
{
  const decision = resolveAutoSyncedInspectorState({
    messages: [makeAgentMsg('m1', 955), makeAgentMsg('m2', 190, false)],
    activeSessionId: 's1',
    isInspectorOpen: true,
    isNotebookMode: true,
    lastSyncedMsgId: 'm1',
    lastSessionId: 's1',
  });
  assert.equal(decision.shouldUpdate, true);
  assert.equal(decision.inspectedMessageId, 'm2');
  assert.equal(decision.activeDocument?.page, 190);
  assert.equal(decision.nextSyncedMsgId, 'm2');
}

// 2. Does NOT sync while AI message is still streaming
{
  const decision = resolveAutoSyncedInspectorState({
    messages: [makeAgentMsg('m1', 955), makeAgentMsg('m2', 190, true)],
    activeSessionId: 's1',
    isInspectorOpen: true,
    isNotebookMode: true,
    lastSyncedMsgId: 'm1',
    lastSessionId: 's1',
  });
  assert.equal(decision.shouldUpdate, false);
}

// 3. Does NOT override manual user selection when no new message arrived
{
  const decision = resolveAutoSyncedInspectorState({
    messages: [makeAgentMsg('m1', 955), makeAgentMsg('m2', 190, false)],
    activeSessionId: 's1',
    isInspectorOpen: true,
    isNotebookMode: true,
    lastSyncedMsgId: 'm2',
    lastSessionId: 's1',
  });
  assert.equal(decision.shouldUpdate, false);
}

// 4. Does NOT auto-open/sync when inspector is closed
{
  const decision = resolveAutoSyncedInspectorState({
    messages: [makeAgentMsg('m2', 190, false)],
    activeSessionId: 's1',
    isInspectorOpen: false,
    isNotebookMode: true,
    lastSyncedMsgId: 'm1',
    lastSessionId: 's1',
  });
  assert.equal(decision.shouldUpdate, false);
  assert.equal(decision.nextSyncedMsgId, 'm2');
}

// 5. Switches/resets cleanly on session change while inspector is open
{
  const decision = resolveAutoSyncedInspectorState({
    messages: [],
    activeSessionId: 's2',
    isInspectorOpen: true,
    isNotebookMode: true,
    lastSyncedMsgId: 'm1',
    lastSessionId: 's1',
  });
  assert.equal(decision.shouldUpdate, true);
  assert.equal(decision.activeDocument, null);
  assert.equal(decision.nextSessionId, 's2');
}

console.log('test_inspector_auto_sync passed');
