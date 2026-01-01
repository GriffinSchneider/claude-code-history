import { useCallback } from 'react';
import type { KeyEvent } from '@opentui/core';
import { useTerminalDimensions } from '@opentui/react';
import { formatTimestamp, truncate } from '../lib/formatter.js';
import { useSelectableList } from '../hooks/useSelectableList.js';

interface Conversation {
  id: string;
  projectName: string;
  lastTimestamp: string;
  messageCount: number;
  summary: string;
  firstUserMessage: string;
  lastUserMessage: string;
}

// Calculate height of a conversation item (2 or 3 lines)
const getItemHeight = (conv: Conversation) => {
  return (conv.lastUserMessage && conv.lastUserMessage !== conv.firstUserMessage) ? 3 : 2;
};

interface ConversationListProps {
  conversations: Conversation[];
  onSelect: (conv: Conversation) => void;
  onQuit: () => void;
}

export function ConversationList({ conversations, onSelect, onQuit }: ConversationListProps) {
  const { width: terminalWidth, height: terminalHeight } = useTerminalDimensions();
  const availableHeight = terminalHeight - 3; // header + status bar
  // Account for: 2 padding, 1 selection indicator, 3 indentation prefix
  const summaryWidth = Math.max(40, terminalWidth - 10);

  const getItemHeightByIndex = useCallback(
    (index: number) => getItemHeight(conversations[index]),
    [conversations]
  );

  const handleKey = useCallback((key: KeyEvent, { selectedIndex }: { selectedIndex: number }): boolean => {
    if (key.name === 'q') {
      onQuit();
      return true;
    }
    if (key.name === 'return') {
      if (conversations[selectedIndex]) {
        onSelect(conversations[selectedIndex]);
      }
      return true;
    }
    return false;
  }, [conversations, onQuit, onSelect]);

  const { selectedIndex, scrollY } = useSelectableList({
    itemCount: conversations.length,
    getItemHeight: getItemHeightByIndex,
    viewportHeight: availableHeight,
    onKey: handleKey,
  });

  if (conversations.length === 0) {
    return (
      <box flexDirection="column" flexGrow={1}>
        <box paddingLeft={1} paddingRight={1} flexDirection="row">
          <text fg="#808080">No conversations found in ~/.claude/projects</text>
        </box>
      </box>
    );
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      <box paddingLeft={1} paddingRight={1} flexDirection="row" height={1}>
        <text>
          <span fg="#00ff00"><b>Claude Code History</b></span>
          <span fg="#808080"> ({conversations.length} conversations)</span>
        </text>
      </box>
      <box paddingLeft={1} paddingRight={1} flexDirection="row" height={1}>
        <text fg="#808080">{'─'.repeat(Math.max(1, terminalWidth - 4))}</text>
      </box>

      <box flexDirection="column" flexGrow={1} overflow="hidden">
        <box flexDirection="column" marginTop={-scrollY} overflow="hidden">
          {conversations.map((conv: Conversation, i: number) => {
            const isSelected = i === selectedIndex;
            const hasLastMsg = conv.lastUserMessage && conv.lastUserMessage !== conv.firstUserMessage;
            const itemHeight = hasLastMsg ? 3 : 2;
            return (
              <box key={conv.id} paddingLeft={1} paddingRight={1} height={itemHeight} flexDirection="column">
                <text>
                  <span bg={isSelected ? '#0000ff' : undefined} fg={isSelected ? '#ffffff' : undefined}>
                    {isSelected ? '>' : ' '}
                  </span>
                  <span> </span>
                  <b>{conv.projectName}</b>
                  <span fg="#808080"> · {formatTimestamp(conv.lastTimestamp)} · {conv.messageCount} msgs</span>
                </text>
                <text fg="#808080">
                  <span bg={isSelected ? '#0000ff' : undefined}> </span>
                  <span>  {truncate(conv.summary, summaryWidth)}</span>
                </text>
                {hasLastMsg && (
                  <text fg="#808080">
                    <span bg={isSelected ? '#0000ff' : undefined}> </span>
                    <span>  </span>
                    <span fg="#606060">→ </span>
                    <span>{truncate(conv.lastUserMessage, summaryWidth - 2)}</span>
                  </text>
                )}
              </box>
            );
          })}
        </box>
      </box>
    </box>
  );
}
