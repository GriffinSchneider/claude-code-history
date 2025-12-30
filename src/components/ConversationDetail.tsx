import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadConversationMessages } from '../lib/history.js';
import { formatUserMessage, formatAssistantMessage } from '../lib/formatter.js';

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

export function ConversationDetail({ conversation, onBack, onResume }: ConversationDetailProps) {
  const [loading, setLoading] = useState(true);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState(0);
  const [allLines, setAllLines] = useState<LineInfo[]>([]);
  const [messageCount, setMessageCount] = useState(0);

  // Calculate visible height (leave room for header and status bar)
  const visibleHeight = Math.max(5, (process.stdout.rows || 24) - 8);

  useEffect(() => {
    async function load() {
      try {
        const msgs = await loadConversationMessages(conversation.filePath);
        setMessageCount(msgs.length);

        // Format all messages and split into lines, tracking which message each line belongs to
        const lines: LineInfo[] = [];
        const termWidth = process.stdout.columns || 80;
        const maxWidth = termWidth - 6; // Account for padding and selection indicator

        for (let msgIdx = 0; msgIdx < msgs.length; msgIdx++) {
          const msg = msgs[msgIdx];
          const formatted =
            msg.type === 'user' ? formatUserMessage(msg.content) : formatAssistantMessage(msg.content);

          const msgLines = formatted.split('\n');

          for (const line of msgLines) {
            // Wrap long lines
            if (line.length <= maxWidth) {
              lines.push({ text: line, messageIndex: msgIdx });
            } else {
              for (let i = 0; i < line.length; i += maxWidth) {
                lines.push({ text: line.slice(i, i + maxWidth), messageIndex: msgIdx });
              }
            }
          }
          // Empty line between messages (belongs to current message for highlighting)
          lines.push({ text: '', messageIndex: msgIdx });
        }

        setAllLines(lines);
      } catch (err: any) {
        setAllLines([{ text: `Error loading conversation: ${err.message}`, messageIndex: 0 }]);
        setMessageCount(1);
      }
      setLoading(false);
    }
    load();
  }, [conversation.filePath]);

  // Find the line range for a given message
  const getMessageLineRange = (msgIndex: number): { start: number; end: number } => {
    let start = -1;
    let end = -1;
    for (let i = 0; i < allLines.length; i++) {
      if (allLines[i].messageIndex === msgIndex) {
        if (start === -1) start = i;
        end = i;
      }
    }
    return { start, end };
  };

  // Auto-scroll to keep selected message visible
  useEffect(() => {
    if (allLines.length === 0) return;
    const { start, end } = getMessageLineRange(selectedMessage);
    if (start === -1) return;

    // If message starts above viewport, scroll up
    if (start < scrollOffset) {
      setScrollOffset(start);
    }
    // If message ends below viewport, scroll down
    else if (end >= scrollOffset + visibleHeight) {
      setScrollOffset(Math.max(0, end - visibleHeight + 1));
    }
  }, [selectedMessage, allLines.length]);

  const maxScroll = Math.max(0, allLines.length - visibleHeight);

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      onBack();
      return;
    }

    if (key.return) {
      onResume(conversation.sessionId);
      return;
    }

    // j/k for message selection
    if (input === 'k') {
      setSelectedMessage((prev) => Math.max(0, prev - 1));
    }
    if (input === 'j') {
      setSelectedMessage((prev) => Math.min(messageCount - 1, prev + 1));
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

    // Ctrl+u/d for half-page
    if (key.ctrl && input === 'u') {
      setScrollOffset((prev) => Math.max(0, prev - Math.floor(visibleHeight / 2)));
    }
    if (key.ctrl && input === 'd') {
      setScrollOffset((prev) => Math.min(maxScroll, prev + Math.floor(visibleHeight / 2)));
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
              <Text color={isSelected ? 'cyan' : undefined}>
                {isSelected ? '▌' : ' '}
              </Text>
              <Text inverse={isSelected}>{lineInfo.text || ' '}</Text>
            </Box>
          );
        })}
      </Box>

      <Box paddingX={1} marginTop={1}>
        <Text dimColor>
          Msg {selectedMessage + 1}/{messageCount} · Line {scrollOffset + 1}-
          {Math.min(scrollOffset + visibleHeight, allLines.length)}/{allLines.length}
          {maxScroll > 0 && ` (${Math.round((scrollOffset / maxScroll) * 100)}%)`}
        </Text>
      </Box>
    </Box>
  );
}
