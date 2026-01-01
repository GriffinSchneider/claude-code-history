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
}

interface ConversationListProps {
  conversations: Conversation[];
  onSelect: (conv: Conversation) => void;
  onQuit: () => void;
}

const ITEM_HEIGHT = 2;
const HEADER_HEIGHT = 2;

export function ConversationList({ conversations, onSelect, onQuit }: ConversationListProps) {
  const { width: termWidth, height: termHeight } = useTerminalDimensions();
  const availableHeight = termHeight - HEADER_HEIGHT - 2; // header + status bar
  const summaryWidth = Math.max(40, termWidth - 10);

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
    viewportHeight: availableHeight,
    itemHeight: ITEM_HEIGHT,
    onKey: handleKey,
  });

  if (conversations.length === 0) {
    return (
      <box flexDirection="column" flexGrow={1}>
        <box flexDirection="row" height={1}>
          <text fg="#808080">No conversations found</text>
        </box>
      </box>
    );
  }

  const totalHeight = conversations.length * ITEM_HEIGHT;

  return (
    <box flexDirection="column" flexGrow={1}>
      <box paddingLeft={1} paddingRight={1} flexDirection="row" height={1}>
        <text>
          <span fg="#00ff00"><b>Claude Code History</b></span>
          <span fg="#808080"> ({conversations.length} conversations)</span>
        </text>
      </box>
      <box paddingLeft={1} paddingRight={1} flexDirection="row" height={1}>
        <text fg="#808080">{'─'.repeat(Math.max(1, termWidth - 4))}</text>
      </box>

      <box flexDirection="column" flexGrow={1} overflow="hidden">
        <box flexDirection="column" height={totalHeight} marginTop={-scrollY}>
          {conversations.map((conv, i) => {
            const isSelected = i === selectedIndex;
            return (
              <box key={conv.id} flexDirection="column" height={ITEM_HEIGHT}>
                <box flexDirection="row" height={1}>
                  <text>
                    <span bg={isSelected ? '#0000ff' : undefined} fg={isSelected ? '#ffffff' : undefined}>
                      {isSelected ? '>' : ' '}
                    </span>
                    <span> </span>
                    <b>{conv.projectName}</b>
                    <span fg="#808080"> · {formatTimestamp(conv.lastTimestamp)} · {conv.messageCount} msgs</span>
                  </text>
                </box>
                <box flexDirection="row" height={1}>
                  <text fg="#808080">
                    <span bg={isSelected ? '#0000ff' : undefined}> </span>
                    <span>  {truncate(conv.summary, summaryWidth)}</span>
                  </text>
                </box>
              </box>
            );
          })}
        </box>
      </box>
    </box>
  );
}
