import React, { useState, useEffect, useMemo } from 'react';
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

export function ConversationDetail({ conversation, onBack, onResume }: ConversationDetailProps) {
  const [loading, setLoading] = useState(true);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [allLines, setAllLines] = useState<string[]>([]);

  // Calculate visible height (leave room for header and status bar)
  const visibleHeight = Math.max(5, (process.stdout.rows || 24) - 8);

  useEffect(() => {
    async function load() {
      try {
        const msgs = await loadConversationMessages(conversation.filePath);

        // Format all messages and split into lines
        const lines: string[] = [];
        for (const msg of msgs) {
          const formatted =
            msg.type === 'user' ? formatUserMessage(msg.content) : formatAssistantMessage(msg.content);

          // Split formatted message into lines, wrapping long lines
          const termWidth = process.stdout.columns || 80;
          const maxWidth = termWidth - 4; // Account for padding
          const msgLines = formatted.split('\n');

          for (const line of msgLines) {
            // Wrap long lines (simple character-based wrap)
            if (line.length <= maxWidth) {
              lines.push(line);
            } else {
              // Split into chunks
              for (let i = 0; i < line.length; i += maxWidth) {
                lines.push(line.slice(i, i + maxWidth));
              }
            }
          }
          lines.push(''); // Empty line between messages
        }

        setAllLines(lines);
      } catch (err: any) {
        setAllLines([`Error loading conversation: ${err.message}`]);
      }
      setLoading(false);
    }
    load();
  }, [conversation.filePath]);

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

    if (key.upArrow || input === 'k') {
      setScrollOffset((prev) => Math.max(0, prev - 1));
    }

    if (key.downArrow || input === 'j') {
      setScrollOffset((prev) => Math.min(maxScroll, prev + 1));
    }

    // Page up/down
    if (key.pageUp) {
      setScrollOffset((prev) => Math.max(0, prev - visibleHeight));
    }
    if (key.pageDown) {
      setScrollOffset((prev) => Math.min(maxScroll, prev + visibleHeight));
    }

    // Home/End
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
        {visibleLines.map((line, i) => (
          <Text key={scrollOffset + i}>{line || ' '}</Text>
        ))}
      </Box>

      <Box paddingX={1} marginTop={1}>
        <Text dimColor>
          Line {scrollOffset + 1}-{Math.min(scrollOffset + visibleHeight, allLines.length)} of {allLines.length}
          {maxScroll > 0 && ` (${Math.round((scrollOffset / maxScroll) * 100)}%)`}
        </Text>
      </Box>
    </Box>
  );
}
