import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { formatTimestamp, truncate } from '../lib/formatter.js';

export function ConversationList({ conversations, onSelect, onQuit }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  const terminalWidth = process.stdout.columns || 80;
  const terminalHeight = process.stdout.rows || 24;

  // Each conversation takes 2-3 lines + 1 for spacing. Use 3 as average.
  const linesPerItem = 3;
  // Leave room for header (2 lines) and status bar (1 line)
  const visibleItems = Math.max(3, Math.floor((terminalHeight - 3) / linesPerItem));

  // Summary gets most of the width, minus indent and some padding
  const summaryWidth = Math.max(40, terminalWidth - 6);

  useInput((input, key) => {
    if (input === 'q') {
      onQuit();
      return;
    }

    if (key.return) {
      if (conversations[selectedIndex]) {
        onSelect(conversations[selectedIndex]);
      }
      return;
    }

    if (key.upArrow || input === 'k') {
      setSelectedIndex((prev) => {
        const newIndex = Math.max(0, prev - 1);
        if (newIndex < scrollOffset) {
          setScrollOffset(newIndex);
        }
        return newIndex;
      });
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => {
        const newIndex = Math.min(conversations.length - 1, prev + 1);
        if (newIndex >= scrollOffset + visibleItems) {
          setScrollOffset(newIndex - visibleItems + 1);
        }
        return newIndex;
      });
    }
  });

  if (conversations.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text dimColor>No conversations found in ~/.claude/projects</Text>
      </Box>
    );
  }

  const visibleConversations = conversations.slice(scrollOffset, scrollOffset + visibleItems);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} marginBottom={1}>
        <Text bold color="green">
          Claude Code History
        </Text>
        <Text dimColor> ({conversations.length} conversations)</Text>
      </Box>

      {visibleConversations.map((conv, i) => {
        const actualIndex = scrollOffset + i;
        const isSelected = actualIndex === selectedIndex;

        return (
          <Box key={conv.id} flexDirection="column" marginBottom={1}>
            {/* Line 1: Metadata */}
            <Box paddingX={1}>
              <Text backgroundColor={isSelected ? 'blue' : undefined} color={isSelected ? 'white' : undefined}>
                {isSelected ? '>' : ' '}
              </Text>
              <Text> </Text>
              <Text bold>{conv.projectName}</Text>
              <Text dimColor> · </Text>
              <Text dimColor>{formatTimestamp(conv.lastTimestamp)}</Text>
              <Text dimColor> · </Text>
              <Text dimColor>{conv.messageCount} msgs</Text>
            </Box>
            {/* Line 2: First message (summary) */}
            <Box paddingX={1}>
              <Text backgroundColor={isSelected ? 'blue' : undefined}> </Text>
              <Text color="gray">
                {'  '}
                {truncate(conv.summary, summaryWidth)}
              </Text>
            </Box>
            {/* Line 3: Last user message (only if different from first) */}
            {conv.lastUserMessage && conv.lastUserMessage !== conv.firstUserMessage && (
              <Box paddingX={1}>
                <Text backgroundColor={isSelected ? 'blue' : undefined}> </Text>
                <Text color="gray">
                  {'  '}
                  <Text dimColor>→ </Text>
                  {truncate(conv.lastUserMessage, summaryWidth - 2)}
                </Text>
              </Box>
            )}
          </Box>
        );
      })}

      {conversations.length > visibleItems && (
        <Box paddingX={1}>
          <Text dimColor>
            Showing {scrollOffset + 1}-{Math.min(scrollOffset + visibleItems, conversations.length)} of{' '}
            {conversations.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}
