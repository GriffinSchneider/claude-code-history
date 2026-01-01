import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { KeyEvent } from '@opentui/core';
import { DefinitePalette } from '../index.js';
import { useTerminalDimensions, useKeyboard } from '@opentui/react';
import { loadConversationMessages } from '../lib/history.js';
import { groupMessages, formatGroup, Message, MessageGroup } from '../lib/formatter.js';

interface ConversationDetailProps {
  palette: DefinitePalette;
  conversation: {
    filePath: string;
    sessionId: string;
    projectName: string;
    summary?: string | null;
  };
  onBack: () => void;
  onResume: (sessionId: string) => void;
}

interface Measurable {
  height: number;
}

const HEADER_HEIGHT = 2;
const SCROLL_CONTAINER_HEIGHT = 10000;

export function ConversationDetail({
  palette,
  conversation,
  onBack,
  onResume,
}: ConversationDetailProps) {
  const { width: termWidth, height: termHeight } = useTerminalDimensions();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const itemRefs = useRef<Map<number, Measurable>>(new Map());
  const refCallbacks = useRef<Map<number, (node: Measurable | null) => void>>(new Map());

  const availableHeight = termHeight - HEADER_HEIGHT - 2;

  // Group messages
  const groups = useMemo(() => groupMessages(messages), [messages]);

  // Toggle collapsed state for an item
  const toggleCollapsed = useCallback((index: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
    // Clear ref callback so it gets re-created for the new content
    refCallbacks.current.delete(index);
  }, []);

  // Ref callback - just stores the node reference
  const getRef = useCallback((index: number) => {
    let callback = refCallbacks.current.get(index);
    if (!callback) {
      callback = (node: Measurable | null) => {
        if (node) {
          itemRefs.current.set(index, node);
        } else {
          itemRefs.current.delete(index);
        }
      };
      refCallbacks.current.set(index, callback);
    }
    return callback;
  }, []);

  // Read heights directly from stored node refs (live values)
  const getItemHeight = (index: number): number => {
    return itemRefs.current.get(index)?.height ?? 1;
  };

  const getItemY = (index: number): number => {
    let y = 0;
    for (let i = 0; i < index; i++) {
      y += getItemHeight(i);
    }
    return y;
  };

  const totalHeight = getItemY(groups.length);

  // Auto-scroll to keep selected item visible
  useEffect(() => {
    if (groups.length === 0) return;
    if (selectedIndex < 0 || selectedIndex >= groups.length) return;

    const itemY = getItemY(selectedIndex);
    const itemH = getItemHeight(selectedIndex);
    const itemBottom = itemY + itemH;

    if (itemY < scrollY) {
      setScrollY(itemY);
    } else if (itemBottom > scrollY + availableHeight) {
      setScrollY(Math.max(0, itemBottom - availableHeight));
    }
  }, [selectedIndex, scrollY, groups.length, availableHeight]);

  // Keyboard handling
  useKeyboard((key: KeyEvent) => {
    if (key.name === 'q' || key.name === 'escape') {
      onBack();
      return;
    }
    if (key.name === 'return') {
      onResume(conversation.sessionId);
      return;
    }
    if (key.name === 'space') {
      toggleCollapsed(selectedIndex);
      return;
    }
    if (key.name === 'k' || key.name === 'up') {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    }
    if (key.name === 'j' || key.name === 'down') {
      setSelectedIndex(Math.min(groups.length - 1, selectedIndex + 1));
    }
  });

  // Load messages
  useEffect(() => {
    async function load() {
      try {
        const { messages: msgs } = await loadConversationMessages(conversation.filePath);
        setMessages(msgs);
        itemRefs.current = new Map();
        refCallbacks.current = new Map();
        setCollapsed(new Set()); // Start with everything expanded
        setSelectedIndex(0);
        setScrollY(0);
        setError(null);
      } catch (err: any) {
        setError(`Error loading: ${err.message}`);
      }
      setLoading(false);
    }
    load();
  }, [conversation.filePath]);

  if (loading) {
    return (
      <box flexDirection="column" flexGrow={1}>
        <box flexDirection="row" height={1}>
          <text>Loading conversation...</text>
        </box>
      </box>
    );
  }

  if (error) {
    return (
      <box flexDirection="column" flexGrow={1}>
        <box flexDirection="row" height={1}>
          <text fg="#ff0000">{error}</text>
        </box>
      </box>
    );
  }

  return (
    <box flexDirection="column" flexGrow={1}>
      <box paddingLeft={1} paddingRight={1} flexDirection="row" height={1}>
        <text>
          <span fg={palette.brightGreen}><b>{conversation.projectName}</b></span>
          <span fg={palette.brightBlack}> · {groups.length} groups ({messages.length} messages)</span>
        </text>
      </box>
      <box paddingLeft={1} paddingRight={1} flexDirection="row" height={1}>
        <text fg={palette.brightBlack}>{'─'.repeat(termWidth - 2)}</text>
      </box>

      <box flexDirection="column" flexGrow={1} overflow="hidden">
        <box flexDirection="column" height={Math.max(SCROLL_CONTAINER_HEIGHT, totalHeight)} marginTop={-scrollY}>
          {groups.map((group, i) => {
            const isSelected = i === selectedIndex;
            const isCollapsed = collapsed.has(i);
            return (
              <box key={`${i}-${isCollapsed}`} ref={getRef(i)} flexDirection="row" paddingBottom={1}>
                <box width={1} backgroundColor={isSelected ? 'blue' : undefined}>
                  <text fg={isSelected ? palette.brightWhite : undefined}>{isSelected ? '>' : ' '}</text>
                </box>
                <box flexDirection="column" flexGrow={1}>
                  {formatGroup(group, isCollapsed, palette)}
                </box>
              </box>
            );
          })}
        </box>
      </box>
    </box>
  );
}
