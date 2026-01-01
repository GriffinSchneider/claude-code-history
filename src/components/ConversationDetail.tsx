import { useState, useEffect, useCallback } from 'react';
import type { KeyEvent } from '@opentui/core';
import { useTerminalDimensions } from '@opentui/react';
import { spawn } from 'child_process';
import { loadConversationMessages } from '../lib/history.js';
import { formatMessage, shouldStartCollapsed, Message, extractTextContent } from '../lib/formatter.js';
import { useSelectableList } from '../hooks/useSelectableList.js';

/**
 * Estimate how many terminal lines a piece of text will take when wrapped
 */
function estimateWrappedLines(text: string, width: number): number {
  if (!text || width <= 0) return 1;
  let lines = 0;
  for (const line of text.split('\n')) {
    lines += Math.max(1, Math.ceil(line.length / width));
  }
  return lines;
}

/**
 * Estimate the height (in terminal lines) of a message
 */
function getMessageHeight(msg: Message, isCollapsed: boolean, contentWidth: number): number {
  if (isCollapsed) {
    // Collapsed messages are always 1 line (truncated) + 1 margin
    return 2;
  }

  if (msg.type === 'user') {
    const text = typeof msg.content === 'string' ? msg.content : extractTextContent(msg.content);
    // "You: " prefix + wrapped text + 1 margin
    return estimateWrappedLines(text, contentWidth - 5) + 1;
  }

  // Assistant message - count all content blocks
  if (typeof msg.content === 'string') {
    return estimateWrappedLines(msg.content, contentWidth) + 1;
  }

  let height = 0;
  for (const block of msg.content) {
    if (block.type === 'text') {
      height += estimateWrappedLines(block.text || '', contentWidth);
    } else if (block.type === 'thinking') {
      // Header + content + footer
      height += 2 + estimateWrappedLines(block.thinking || '', contentWidth);
    } else if (block.type === 'tool_use') {
      const inputStr = block.input
        ? typeof block.input === 'string'
          ? block.input
          : JSON.stringify(block.input, null, 2)
        : '';
      // Header + content + footer
      height += 2 + estimateWrappedLines(inputStr, contentWidth);
    }
  }
  return Math.max(1, height) + 1; // +1 for margin
}

interface ConversationDetailProps {
  conversation: {
    filePath: string;
    sessionId: string;
    projectName: string;
    summary?: string | null;
  };
  /** Saved scroll/selection state to restore */
  savedState?: { scrollY: number; selectedMessage: number };
  onBack: () => void;
  onResume: (sessionId: string) => void;
  onOpenSidechain: (agentId: string, currentState: { scrollY: number; selectedMessage: number }) => void;
  onSelectedAgentChange: (hasAgent: boolean) => void;
  isInSidechain: boolean;
}


export function ConversationDetail({
  conversation,
  savedState,
  onBack,
  onResume,
  onOpenSidechain,
  onSelectedAgentChange,
  isInSidechain,
}: ConversationDetailProps) {
  const { width: termWidth, height: termHeight } = useTerminalDimensions();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [collapsedSet, setCollapsedSet] = useState<Set<number>>(new Set());
  const [messageAgentIds, setMessageAgentIds] = useState<Map<number, string>>(new Map());

  // Available height for messages (subtract header, divider, status bar)
  const availableHeight = termHeight - 3;
  // Content width (subtract padding and selection indicators)
  const contentWidth = termWidth - 6;

  // Helper to get height of a specific message
  const getMsgHeight = useCallback(
    (idx: number) => getMessageHeight(messages[idx], collapsedSet.has(idx), contentWidth),
    [messages, collapsedSet, contentWidth]
  );

  const toggleCollapsed = useCallback((msgIndex: number) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(msgIndex)) {
        next.delete(msgIndex);
      } else {
        next.add(msgIndex);
      }
      return next;
    });
  }, []);

  const handleKey = useCallback((key: KeyEvent, { selectedIndex, scrollY }: { selectedIndex: number; scrollY: number }): boolean => {
    if (key.name === 'q' || key.name === 'escape') {
      onBack();
      return true;
    }

    if (key.name === 'return') {
      onResume(conversation.sessionId);
      return true;
    }

    // Spacebar toggles collapsed state
    if (key.name === 'space') {
      toggleCollapsed(selectedIndex);
      return true;
    }

    // ! to open JSON file in $EDITOR
    if (key.shift && key.name === '1') {
      const editor = process.env.EDITOR || 'vim';
      spawn(editor, [conversation.filePath], { stdio: 'inherit', shell: true });
      return true;
    }

    // s to open sidechain for current message (if it has one)
    const agentId = messageAgentIds.get(selectedIndex);
    if (key.name === 's' && agentId) {
      onOpenSidechain(agentId, { scrollY, selectedMessage: selectedIndex });
      return true;
    }

    return false;
  }, [onBack, onResume, conversation.sessionId, conversation.filePath, toggleCollapsed, messageAgentIds, onOpenSidechain]);

  const {
    selectedIndex: selectedMessage,
    scrollY,
    totalHeight,
    setSelectedIndex: setSelectedMessage,
    setScrollY,
  } = useSelectableList({
    itemCount: messages.length,
    getItemHeight: getMsgHeight,
    viewportHeight: availableHeight,
    initialSelected: savedState?.selectedMessage ?? 0,
    initialScrollY: savedState?.scrollY ?? 0,
    onKey: handleKey,
  });

  // Reset or restore state when conversation changes
  useEffect(() => {
    if (savedState) {
      setScrollY(savedState.scrollY);
      setSelectedMessage(savedState.selectedMessage);
    } else {
      setScrollY(0);
      setSelectedMessage(0);
    }
  }, [conversation.filePath, savedState, setScrollY, setSelectedMessage]);

  // Check if the currently selected message has an associated sidechain
  const selectedAgentId = messageAgentIds.get(selectedMessage);

  // Notify parent when selected message's agent status changes
  useEffect(() => {
    onSelectedAgentChange(!!selectedAgentId);
  }, [selectedAgentId, onSelectedAgentChange]);

  // Load messages
  useEffect(() => {
    async function load() {
      try {
        const { messages: msgs, messageAgentIds: agentIds } = await loadConversationMessages(
          conversation.filePath
        );
        setMessages(msgs);
        setMessageAgentIds(agentIds);

        // Initialize collapsed state - messages with only collapsible content start collapsed
        const initialCollapsed = new Set<number>();
        msgs.forEach((msg, idx) => {
          if (shouldStartCollapsed(msg)) {
            initialCollapsed.add(idx);
          }
        });
        setCollapsedSet(initialCollapsed);
      } catch (err: any) {
        setMessages([{ type: 'assistant', content: `Error loading: ${err.message}` }]);
      }
      setLoading(false);
    }
    load();
  }, [conversation.filePath]);

  const maxScrollY = Math.max(0, totalHeight - availableHeight);

  if (loading) {
    return (
      <box flexDirection="column" flexGrow={1}>
        <box paddingLeft={1} paddingRight={1} flexDirection="row">
          <text>Loading conversation...</text>
        </box>
      </box>
    );
  }

  const isSelectedCollapsed = collapsedSet.has(selectedMessage);

  return (
    <box flexDirection="column" flexGrow={1}>
      <box paddingLeft={1} paddingRight={1} marginTop={0} flexDirection="row" height={1}>
        <text>
          <span fg="#00ff00"><b>{conversation.projectName}</b></span>
          <span fg="#808080"> · </span>
          <span fg="#808080">{conversation.summary ? conversation.summary.slice(0, 60) : 'Conversation'}</span>
        </text>
      </box>
      <box paddingLeft={1} paddingRight={1} flexDirection="row" height={1}>
        <text fg="#808080">{'─'.repeat(Math.max(1, termWidth - 4))}</text>
      </box>

      <box flexDirection="column" flexGrow={1} overflow='hidden'>
        <box flexDirection="column" marginTop={-scrollY}>
          {messages.map((msg, i) => {
            const isSelected = i === selectedMessage;
            const hasAgent = messageAgentIds.has(i);
            const isCollapsed = collapsedSet.has(i);
            const msgHeight = getMsgHeight(i);
            return (
              <box key={i} height={msgHeight} flexDirection="column">
                <box flexDirection="row" flexGrow={1}>
                  <text bg={isSelected ? '#0000ff' : undefined} fg={isSelected ? '#ffffff' : undefined}>
                    {isSelected ? '>' : ' '}
                  </text>
                  <text fg="#ff00ff">{hasAgent ? '◆' : ' '}</text>
                  <box flexDirection="column" flexGrow={1}>
                    {formatMessage(msg, isCollapsed)}
                  </box>
                </box>
              </box>
            );
          })}
        </box>
      </box>

      <box height={1}>
        <text fg="#808080">
          {isInSidechain && <span fg="#ffff00">[Sidechain] </span>}
          Msg {selectedMessage + 1}/{messages.length}
          {isSelectedCollapsed ? ' [collapsed]' : ''}
          {maxScrollY > 0 && ` (${Math.round((scrollY / maxScrollY) * 100)}%)`}
          {selectedAgentId && (
            <span>
              {' · '}
              <span fg="#ff00ff">◆ has agent (s)</span>
            </span>
          )}
        </text>
      </box>
    </box>
  );
}
