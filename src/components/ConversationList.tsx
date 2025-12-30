import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { formatTimestamp, truncate } from '../lib/formatter.js';

export function ConversationList({ conversations, onSelect, onQuit }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Calculate visible height (leave room for header and status bar)
  const visibleHeight = Math.max(5, (process.stdout.rows || 24) - 6);

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
        // Adjust scroll if needed
        if (newIndex < scrollOffset) {
          setScrollOffset(newIndex);
        }
        return newIndex;
      });
    }

    if (key.downArrow || input === 'j') {
      setSelectedIndex((prev) => {
        const newIndex = Math.min(conversations.length - 1, prev + 1);
        // Adjust scroll if needed
        if (newIndex >= scrollOffset + visibleHeight) {
          setScrollOffset(newIndex - visibleHeight + 1);
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

  const visibleConversations = conversations.slice(scrollOffset, scrollOffset + visibleHeight);

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
          <Box key={conv.id} paddingX={1}>
            <Text backgroundColor={isSelected ? 'blue' : undefined} color={isSelected ? 'white' : undefined}>
              {isSelected ? '▶ ' : '  '}
              <Text bold>{conv.projectName}</Text>
              <Text dimColor> · </Text>
              <Text dimColor>{formatTimestamp(conv.lastTimestamp)}</Text>
              <Text dimColor> · </Text>
              <Text>{truncate(conv.summary, 50)}</Text>
              <Text dimColor> ({conv.messageCount} msgs)</Text>
            </Text>
          </Box>
        );
      })}

      {conversations.length > visibleHeight && (
        <Box paddingX={1} marginTop={1}>
          <Text dimColor>
            Showing {scrollOffset + 1}-{Math.min(scrollOffset + visibleHeight, conversations.length)} of{' '}
            {conversations.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}
