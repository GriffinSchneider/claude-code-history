import { useCallback, useRef, useEffect } from 'react';
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
  lastUserMessage?: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  onSelect: (conv: Conversation, listState: { selectedIndex: number; scrollY: number }) => void;
  onQuit: () => void;
  initialSelectedIndex?: number;
  initialScrollY?: number;
}

const BASE_ITEM_HEIGHT = 2;
const HEADER_HEIGHT = 2;

/**
 * Check if lastUserMessage is meaningfully different from summary
 */
function hasDistinctLastMessage(conv: Conversation): boolean {
  if (!conv.lastUserMessage || !conv.summary) return false;
  // Normalize for comparison (trim, lowercase, collapse whitespace)
  const normLast = conv.lastUserMessage.trim().toLowerCase().replace(/\s+/g, ' ');
  const normSummary = conv.summary.trim().toLowerCase().replace(/\s+/g, ' ');
  // Check if one starts with the other (since summary might be truncated)
  return !normSummary.startsWith(normLast) && !normLast.startsWith(normSummary);
}

function getItemHeight(conv: Conversation): number {
  return hasDistinctLastMessage(conv) ? 3 : 2;
}

export function ConversationList({ conversations, onSelect, onQuit, initialSelectedIndex, initialScrollY }: ConversationListProps) {
  const { width: termWidth, height: termHeight } = useTerminalDimensions();
  const availableHeight = termHeight - HEADER_HEIGHT - 2; // header + status bar
  const summaryWidth = Math.max(40, termWidth - 10);

  // Use ref to track scrollY for the callback (avoids circular dependency)
  const scrollYRef = useRef(initialScrollY ?? 0);

  const { selectedIndex, scrollY, totalHeight, getItemRef } = useSelectableList({
    itemCount: conversations.length,
    viewportHeight: availableHeight,
    defaultItemHeight: BASE_ITEM_HEIGHT,
    initialSelectedIndex,
    initialScrollY,
    onKey: useCallback((key: KeyEvent, { selectedIndex: idx }: { selectedIndex: number }): boolean => {
      if (key.name === 'q') {
        onQuit();
        return true;
      }
      if (key.name === 'return') {
        if (conversations[idx]) {
          onSelect(conversations[idx], { selectedIndex: idx, scrollY: scrollYRef.current });
        }
        return true;
      }
      return false;
    }, [conversations, onQuit, onSelect]),
  });

  // Keep the ref in sync with the current scrollY
  useEffect(() => {
    scrollYRef.current = scrollY;
  }, [scrollY]);

  if (conversations.length === 0) {
    return (
      <box flexDirection="column" flexGrow={1}>
        <box flexDirection="row" height={1}>
          <text fg="#808080">No conversations found</text>
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
        <text fg="#808080">{'─'.repeat(Math.max(1, termWidth - 4))}</text>
      </box>

      <box flexDirection="column" flexGrow={1} overflow="hidden">
        <box flexDirection="column" height={Math.max(10000, totalHeight)} marginTop={-scrollY}>
          {conversations.map((conv, i) => {
            const isSelected = i === selectedIndex;
            const showLastMessage = hasDistinctLastMessage(conv);
            const itemHeight = getItemHeight(conv);
            return (
              <box key={conv.id} ref={getItemRef(i)} flexDirection="column" height={itemHeight}>
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
                {showLastMessage && (
                  <box flexDirection="row" height={1}>
                    <text fg="#666666">
                      <span bg={isSelected ? '#0000ff' : undefined}> </span>
                      <span>  ↳ {truncate(conv.lastUserMessage!, summaryWidth - 2)}</span>
                    </text>
                  </box>
                )}
              </box>
            );
          })}
        </box>
      </box>
    </box>
  );
}
