import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';
import wrapAnsi from 'wrap-ansi';
import { spawn } from 'child_process';
import { loadConversationMessages } from '../lib/history.js';
import { formatMessage, shouldStartCollapsed, Message } from '../lib/formatter.js';

interface ConversationDetailProps {
  conversation: {
    filePath: string;
    sessionId: string;
    projectName: string;
    summary?: string;
  };
  onBack: () => void;
  onResume: (sessionId: string) => void;
}

interface LineInfo {
  text: string;
  messageIndex: number;
}

interface MessageRange {
  start: number;
  end: number;
}

// Header takes up 3 lines (border + content + margin)
const HEADER_LINES = 3;

export function ConversationDetail({ conversation, onBack, onResume }: ConversationDetailProps) {
  const [loading, setLoading] = useState(true);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [collapsedSet, setCollapsedSet] = useState<Set<number>>(new Set());
  const { stdin } = useStdin();

  // Calculate visible height (leave room for header and status bar)
  const visibleHeight = Math.max(5, (process.stdout.rows || 24) - 8);

  // Load messages
  useEffect(() => {
    async function load() {
      try {
        const msgs = await loadConversationMessages(conversation.filePath);
        setMessages(msgs);

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

  // Compute lines from messages based on collapsed state
  // Also pre-compute message ranges for O(1) lookup
  const { allLines, messageRanges } = useMemo(() => {
    const lines: LineInfo[] = [];
    const ranges: MessageRange[] = [];
    const termWidth = process.stdout.columns || 80;
    const maxWidth = termWidth - 6; // Account for padding and selection indicator

    for (let msgIdx = 0; msgIdx < messages.length; msgIdx++) {
      const msg = messages[msgIdx];
      const isCollapsed = collapsedSet.has(msgIdx);
      const formatted = formatMessage(msg, isCollapsed);

      // Use wrap-ansi for ANSI-aware line wrapping
      const wrapped = wrapAnsi(formatted, maxWidth, { hard: true, trim: false });
      const msgLines = wrapped.split('\n');

      const start = lines.length;
      for (const line of msgLines) {
        lines.push({ text: line, messageIndex: msgIdx });
      }
      // Empty line between messages
      lines.push({ text: '', messageIndex: msgIdx });
      ranges.push({ start, end: lines.length - 1 });
    }

    return { allLines: lines, messageRanges: ranges };
  }, [messages, collapsedSet]);

  // Enable mouse tracking
  useEffect(() => {
    if (!stdin) return;

    // Enable SGR mouse mode (better coordinate support)
    process.stdout.write('\x1b[?1000h'); // Enable mouse tracking
    process.stdout.write('\x1b[?1006h'); // Enable SGR extended mode

    const handleData = (data: Buffer) => {
      const str = data.toString();

      // Parse SGR mouse format: \x1b[<button;x;y[Mm]
      const match = str.match(/\x1b\[<(\d+);(\d+);(\d+)([Mm])/);
      if (match) {
        const button = parseInt(match[1], 10);
        const y = parseInt(match[3], 10);
        const isRelease = match[4] === 'm';

        // Only handle left click press (button 0)
        if (button === 0 && !isRelease) {
          // y is 1-indexed, convert to 0-indexed line in our content area
          const contentY = y - 1 - HEADER_LINES;

          if (contentY >= 0 && contentY < visibleHeight) {
            const lineIndex = scrollOffset + contentY;
            if (lineIndex < allLines.length) {
              const clickedMsgIndex = allLines[lineIndex].messageIndex;
              setSelectedMessage(clickedMsgIndex);
            }
          }
        }
      }
    };

    stdin.on('data', handleData);

    return () => {
      // Disable mouse tracking
      process.stdout.write('\x1b[?1006l');
      process.stdout.write('\x1b[?1000l');
      stdin.off('data', handleData);
    };
  }, [stdin, scrollOffset, visibleHeight, allLines]);

  // Auto-scroll to keep selected message visible
  useEffect(() => {
    if (allLines.length === 0 || !messageRanges[selectedMessage]) return;
    const { start, end } = messageRanges[selectedMessage];

    // If message starts above viewport, scroll up
    if (start < scrollOffset) {
      setScrollOffset(start);
    }
    // If message ends below viewport, scroll down
    else if (end >= scrollOffset + visibleHeight) {
      setScrollOffset(Math.max(0, end - visibleHeight + 1));
    }
  }, [selectedMessage, messageRanges]);

  const maxScroll = Math.max(0, allLines.length - visibleHeight);

  const toggleCollapsed = (msgIndex: number) => {
    setCollapsedSet((prev) => {
      const next = new Set(prev);
      if (next.has(msgIndex)) {
        next.delete(msgIndex);
      } else {
        next.add(msgIndex);
      }
      return next;
    });
  };

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      onBack();
      return;
    }

    if (key.return) {
      onResume(conversation.sessionId);
      return;
    }

    // Spacebar toggles collapsed state
    if (input === ' ') {
      toggleCollapsed(selectedMessage);
      return;
    }

    // j/k for message selection
    if (input === 'k') {
      setSelectedMessage((prev) => Math.max(0, prev - 1));
    }
    if (input === 'j') {
      setSelectedMessage((prev) => Math.min(messages.length - 1, prev + 1));
    }

    // Arrow keys for scrolling
    if (key.upArrow) {
      setScrollOffset((prev) => Math.max(0, prev - 1));
    }
    if (key.downArrow) {
      setScrollOffset((prev) => Math.min(maxScroll, prev + 1));
    }

    // Page up/down
    if (key.pageUp) {
      setScrollOffset((prev) => Math.max(0, prev - visibleHeight));
    }
    if (key.pageDown) {
      setScrollOffset((prev) => Math.min(maxScroll, prev + visibleHeight));
    }

    // Ctrl+u/d for half-page (also moves selection to middle of viewport)
    if (key.ctrl && input === 'u') {
      const halfPage = Math.floor(visibleHeight / 2);
      const newOffset = Math.max(0, scrollOffset - halfPage);
      setScrollOffset(newOffset);
      const middleLine = Math.min(newOffset + halfPage, allLines.length - 1);
      if (allLines[middleLine]) {
        setSelectedMessage(allLines[middleLine].messageIndex);
      }
    }
    if (key.ctrl && input === 'd') {
      const halfPage = Math.floor(visibleHeight / 2);
      const newOffset = Math.min(maxScroll, scrollOffset + halfPage);
      setScrollOffset(newOffset);
      const middleLine = Math.min(newOffset + halfPage, allLines.length - 1);
      if (allLines[middleLine]) {
        setSelectedMessage(allLines[middleLine].messageIndex);
      }
    }

    // ! to open JSON file in $EDITOR
    if (input === '!') {
      const editor = process.env.EDITOR || 'vim';
      spawn(editor, [conversation.filePath], { stdio: 'inherit', shell: true });
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Loading conversation...</Text>
      </Box>
    );
  }

  const visibleLines = allLines.slice(scrollOffset, scrollOffset + visibleHeight);
  const isSelectedCollapsed = collapsedSet.has(selectedMessage);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box
        paddingX={1}
        marginBottom={1}
        borderStyle="single"
        borderBottom={true}
        borderTop={false}
        borderLeft={false}
        borderRight={false}
      >
        <Text bold color="green">
          {conversation.projectName}
        </Text>
        <Text dimColor> · </Text>
        <Text dimColor>{conversation.summary ? conversation.summary.slice(0, 60) : 'Conversation'}</Text>
      </Box>

      <Box flexDirection="column" height={visibleHeight} paddingX={1} overflow="hidden">
        {visibleLines.map((lineInfo, i) => {
          const isSelected = lineInfo.messageIndex === selectedMessage;
          return (
            <Box key={scrollOffset + i}>
              <Text color="cyan">{isSelected ? '▌' : ' '}</Text>
              <Text>{lineInfo.text || ' '}</Text>
            </Box>
          );
        })}
      </Box>

      <Box paddingX={1} marginTop={1}>
        <Text dimColor>
          Msg {selectedMessage + 1}/{messages.length}
          {isSelectedCollapsed ? ' [collapsed]' : ''}
          {' · '}Line {scrollOffset + 1}-
          {Math.min(scrollOffset + visibleHeight, allLines.length)}/{allLines.length}
          {maxScroll > 0 && ` (${Math.round((scrollOffset / maxScroll) * 100)}%)`}
        </Text>
      </Box>
    </Box>
  );
}
