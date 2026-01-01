import { useState, useEffect, useCallback, useMemo } from 'react';
import type { KeyEvent } from '@opentui/core';
import { useTerminalDimensions } from '@opentui/react';
import { spawn } from 'child_process';
import { loadConversationMessages } from '../lib/history.js';
import { formatMessage, shouldStartCollapsed, Message, extractTextContent, groupMessages, MessageGroup } from '../lib/formatter.js';
import { useSelectableList } from '../hooks/useSelectableList.js';

/**
 * A selectable row in the list - either a message or a group header
 */
type ListItem =
  | { type: 'user'; groupIndex: number; messageIndex: number; message: Message }
  | { type: 'group-header'; groupIndex: number; count: number; expanded: boolean }
  | { type: 'intermediate'; groupIndex: number; messageIndex: number; message: Message }
  | { type: 'final'; groupIndex: number; messageIndex: number; message: Message };

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
  const [groups, setGroups] = useState<MessageGroup[]>([]);
  // Which groups have their intermediate section expanded
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  // Which individual messages are collapsed (for their internal content)
  const [collapsedMessages, setCollapsedMessages] = useState<Set<number>>(new Set());
  const [messageAgentIds, setMessageAgentIds] = useState<Map<number, string>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Available height for messages (subtract header, divider, status bar)
  const availableHeight = termHeight - 3;
  // Content width (subtract padding and selection indicators)
  const contentWidth = termWidth - 6;

  // Build list items from groups + expansion state
  const listItems = useMemo((): ListItem[] => {
    const items: ListItem[] = [];
    groups.forEach((group, groupIndex) => {
      // User message
      if (group.userIndex >= 0) {
        items.push({
          type: 'user',
          groupIndex,
          messageIndex: group.userIndex,
          message: group.userMessage,
        });
      }

      // If there's only 1 intermediate, show it directly (no group header)
      if (group.intermediates.length === 1) {
        items.push({
          type: 'intermediate',
          groupIndex,
          messageIndex: group.intermediates[0].index,
          message: group.intermediates[0].message,
        });
      } else if (group.intermediates.length > 1) {
        // Multiple intermediates - show group header
        const isExpanded = expandedGroups.has(groupIndex);
        items.push({
          type: 'group-header',
          groupIndex,
          count: group.intermediates.length,
          expanded: isExpanded,
        });

        // If expanded, show intermediate messages
        if (isExpanded) {
          for (const inter of group.intermediates) {
            items.push({
              type: 'intermediate',
              groupIndex,
              messageIndex: inter.index,
              message: inter.message,
            });
          }
        }
      }

      // Final message (if exists)
      if (group.final) {
        items.push({
          type: 'final',
          groupIndex,
          messageIndex: group.final.index,
          message: group.final.message,
        });
      }
    });
    return items;
  }, [groups, expandedGroups]);

  // Get height of a list item
  const getItemHeight = useCallback(
    (idx: number): number => {
      const item = listItems[idx];
      if (!item) return 1;

      if (item.type === 'group-header') {
        return 2; // 1 line + 1 margin
      }

      const isCollapsed = collapsedMessages.has(item.messageIndex);
      return getMessageHeight(item.message, isCollapsed, contentWidth);
    },
    [listItems, collapsedMessages, contentWidth]
  );

  // Toggle group expansion
  const toggleGroupExpanded = useCallback((groupIndex: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupIndex)) {
        next.delete(groupIndex);
      } else {
        next.add(groupIndex);
      }
      return next;
    });
  }, []);

  // Toggle individual message collapse
  const toggleMessageCollapsed = useCallback((msgIndex: number) => {
    setCollapsedMessages((prev) => {
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

    const item = listItems[selectedIndex];

    // Spacebar toggles collapsed/expanded state
    if (key.name === 'space' && item) {
      if (item.type === 'group-header') {
        toggleGroupExpanded(item.groupIndex);
      } else {
        toggleMessageCollapsed(item.messageIndex);
      }
      return true;
    }

    // ! to copy JSONL file path to clipboard (for debugging)
    if (key.name === '!') {
      const proc = spawn('pbcopy', [], { stdio: 'pipe' });
      proc.stdin?.write(conversation.filePath);
      proc.stdin?.end();
      return true;
    }

    // s to open sidechain for current message (if it has one)
    if (key.name === 's' && item && item.type !== 'group-header') {
      const agentId = messageAgentIds.get(item.messageIndex);
      if (agentId) {
        onOpenSidechain(agentId, { scrollY, selectedMessage: selectedIndex });
        return true;
      }
    }

    return false;
  }, [onBack, onResume, conversation.sessionId, conversation.filePath, listItems, toggleGroupExpanded, toggleMessageCollapsed, messageAgentIds, onOpenSidechain]);

  const {
    selectedIndex,
    scrollY,
    totalHeight,
    setSelectedIndex,
    setScrollY,
  } = useSelectableList({
    itemCount: listItems.length,
    getItemHeight,
    viewportHeight: availableHeight,
    initialSelected: savedState?.selectedMessage ?? 0,
    initialScrollY: savedState?.scrollY ?? 0,
    onKey: handleKey,
  });

  // Reset or restore state when conversation changes
  useEffect(() => {
    if (savedState) {
      setScrollY(savedState.scrollY);
      setSelectedIndex(savedState.selectedMessage);
    } else {
      setScrollY(0);
      setSelectedIndex(0);
    }
  }, [conversation.filePath, savedState, setScrollY, setSelectedIndex]);

  // Check if the currently selected item has an associated sidechain
  const selectedItem = listItems[selectedIndex];
  const selectedAgentId = selectedItem && selectedItem.type !== 'group-header'
    ? messageAgentIds.get(selectedItem.messageIndex)
    : undefined;

  // Notify parent when selected message's agent status changes
  useEffect(() => {
    onSelectedAgentChange(!!selectedAgentId);
  }, [selectedAgentId, onSelectedAgentChange]);

  // Compute which items should have extended highlight (for group headers)
  const highlightRange = useMemo((): { start: number; end: number } | null => {
    const item = listItems[selectedIndex];
    if (!item || item.type !== 'group-header') return null;
    if (!item.expanded) return null;

    // Find the range of items that belong to this group's intermediates
    const start = selectedIndex;
    let end = selectedIndex;

    // Count forward through intermediate items of the same group
    for (let i = selectedIndex + 1; i < listItems.length; i++) {
      const nextItem = listItems[i];
      if (nextItem.type === 'intermediate' && nextItem.groupIndex === item.groupIndex) {
        end = i;
      } else {
        break;
      }
    }

    return { start, end };
  }, [listItems, selectedIndex]);

  // Load messages
  useEffect(() => {
    async function load() {
      try {
        const { messages: msgs, messageAgentIds: agentIds } = await loadConversationMessages(
          conversation.filePath
        );
        setMessageAgentIds(agentIds);

        // Group the messages
        const msgGroups = groupMessages(msgs);
        setGroups(msgGroups);

        // Initialize message collapsed state - messages with only collapsible content start collapsed
        const initialCollapsed = new Set<number>();
        msgs.forEach((msg, idx) => {
          if (shouldStartCollapsed(msg)) {
            initialCollapsed.add(idx);
          }
        });
        setCollapsedMessages(initialCollapsed);

        // Groups start collapsed (intermediates hidden)
        // expandedGroups starts as empty Set, which means all collapsed
        setError(null);
      } catch (err: any) {
        setError(`Error loading: ${err.message}`);
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

  if (error) {
    return (
      <box flexDirection="column" flexGrow={1}>
        <box paddingLeft={1} paddingRight={1} flexDirection="row">
          <text fg="#ff0000">{error}</text>
        </box>
      </box>
    );
  }

  // Helper to render a single list item
  const renderItem = (item: ListItem, idx: number) => {
    const isSelected = idx === selectedIndex;
    // Check if this item is within the highlight range (extended selection for group header)
    const isInHighlightRange = highlightRange && idx >= highlightRange.start && idx <= highlightRange.end;
    const showHighlight = isSelected || isInHighlightRange;

    const itemHeight = getItemHeight(idx);
    const highlightBg = showHighlight ? '#0000ff' : undefined;
    const highlightFg = showHighlight ? '#ffffff' : undefined;

    // Build the highlight column - spans content height (itemHeight includes 1 line margin)
    // When in a highlight range, include the margin to make it continuous (except for last item)
    const isLastInRange = !highlightRange || idx === highlightRange.end;
    const highlightHeight = showHighlight && !isLastInRange
      ? itemHeight  // Include margin for continuity
      : itemHeight - 1;  // Exclude margin
    const highlightCol = (
      <box flexDirection="column" width={1}>
        {Array.from({ length: highlightHeight }, (_, i) => (
          <text key={i} bg={highlightBg} fg={highlightFg}>
            {i === 0 && isSelected ? '>' : ' '}
          </text>
        ))}
      </box>
    );

    if (item.type === 'group-header') {
      const arrowChar = item.expanded ? '▼' : '▶';
      return (
        <box key={`header-${item.groupIndex}`} height={itemHeight} flexDirection="column">
          <box flexDirection="row" flexGrow={1}>
            {highlightCol}
            <text> </text>
            <box flexDirection="column" flexGrow={1}>
              <text fg="#808080">
                <span>{arrowChar} </span>
                <span fg="#666666">[{item.count} message{item.count !== 1 ? 's' : ''}]</span>
              </text>
            </box>
          </box>
        </box>
      );
    }

    // It's a message item (user, intermediate, or final)
    const hasAgent = messageAgentIds.has(item.messageIndex);
    const isCollapsed = collapsedMessages.has(item.messageIndex);

    return (
      <box key={`msg-${item.messageIndex}`} height={itemHeight} flexDirection="column">
        <box flexDirection="row" flexGrow={1}>
          {highlightCol}
          <text fg="#ff00ff">{hasAgent ? '◆' : ' '}</text>
          <box flexDirection="column" flexGrow={1}>
            {formatMessage(item.message, isCollapsed)}
          </box>
        </box>
      </box>
    );
  };

  // Get status text for selected item
  const getStatusText = () => {
    const item = selectedItem;
    if (!item) return '';

    if (item.type === 'group-header') {
      return item.expanded ? '[expanded - space to collapse]' : '[space to expand]';
    }

    const isCollapsed = collapsedMessages.has(item.messageIndex);
    return isCollapsed ? '[collapsed]' : '';
  };

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
          {listItems.map((item, i) => renderItem(item, i))}
        </box>
      </box>

      <box height={1}>
        <text fg="#808080">
          {isInSidechain && <span fg="#ffff00">[Sidechain] </span>}
          Item {selectedIndex + 1}/{listItems.length}
          {getStatusText() && ` ${getStatusText()}`}
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
