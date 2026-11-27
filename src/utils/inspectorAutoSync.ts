import type { ChatMessage, RagCitationItem } from '../types/chat';
import type { ActiveSourceDocument } from '../components/LeftPane/NotebookSourceInspector';

export function citationToActiveSourceDoc(
  cit: RagCitationItem,
  fallbackTitle = 'Tài liệu y văn'
): ActiveSourceDocument {
  return {
    title: cit.source || cit.title || cit.legal_basis || fallbackTitle,
    url: cit.url,
    page: cit.page,
    excerpt: cit.excerpt,
    legal_basis: cit.legal_basis,
    section: cit.section,
    document_id: cit.document_id,
    domain: cit.domain,
    credibility_tier: cit.credibility_tier,
    drug_anchor: cit.drug_anchor,
  };
}

export interface AutoSyncInput {
  messages: ChatMessage[];
  activeSessionId?: string;
  isInspectorOpen: boolean;
  isNotebookMode: boolean;
  lastSyncedMsgId: string | null;
  lastSessionId?: string;
}

export interface AutoSyncDecision {
  shouldUpdate: boolean;
  inspectedMessageId?: string | null;
  activeDocument?: ActiveSourceDocument | null;
  nextSyncedMsgId: string | null;
  nextSessionId?: string;
}

/**
 * Pure state-transition helper for auto-switching the right-hand PDF/Source
 * inspector when a new cited AI answer finishes streaming or session changes.
 */
export function resolveAutoSyncedInspectorState(input: AutoSyncInput): AutoSyncDecision {
  const {
    messages,
    activeSessionId,
    isInspectorOpen,
    isNotebookMode,
    lastSyncedMsgId,
    lastSessionId,
  } = input;

  const latestCited = [...messages]
    .reverse()
    .find((m) => m.sender === 'agent' && (m.citations?.length || 0) > 0);

  const sessionChanged = activeSessionId !== lastSessionId;

  if (!isNotebookMode || !isInspectorOpen) {
    return {
      shouldUpdate: false,
      nextSyncedMsgId: latestCited && !latestCited.isStreaming ? latestCited.id : (sessionChanged ? null : lastSyncedMsgId),
      nextSessionId: activeSessionId,
    };
  }

  if (sessionChanged) {
    if (latestCited && !latestCited.isStreaming && latestCited.citations?.[0]) {
      return {
        shouldUpdate: true,
        inspectedMessageId: latestCited.id,
        activeDocument: citationToActiveSourceDoc(latestCited.citations[0]),
        nextSyncedMsgId: latestCited.id,
        nextSessionId: activeSessionId,
      };
    }
    return {
      shouldUpdate: true,
      inspectedMessageId: null,
      activeDocument: null,
      nextSyncedMsgId: null,
      nextSessionId: activeSessionId,
    };
  }

  if (
    latestCited &&
    !latestCited.isStreaming &&
    latestCited.id !== lastSyncedMsgId &&
    latestCited.citations?.[0]
  ) {
    return {
      shouldUpdate: true,
      inspectedMessageId: latestCited.id,
      activeDocument: citationToActiveSourceDoc(latestCited.citations[0]),
      nextSyncedMsgId: latestCited.id,
      nextSessionId: activeSessionId,
    };
  }

  return {
    shouldUpdate: false,
    nextSyncedMsgId: lastSyncedMsgId,
    nextSessionId: activeSessionId,
  };
}
