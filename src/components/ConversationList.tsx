import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { formatTimestamp, truncate } from '../lib/formatter.js';

// Calculate height of a conversation item (2 or 3 lines)
const getItemHeight = (conv) => {
  return (conv.lastUserMessage && conv.lastUserMessage !== conv.firstUserMessage) ? 3 : 2;
};

export function ConversationList({ conversations, onSelect, onQuit }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0); // index of first visible item

  const terminalWidth = process.stdout.columns || 80;
  const terminalHeight = process.stdout.rows || 24;
  const availableHeight = terminalHeight - 3; // header + status bar
  const summaryWidth = Math.max(40, terminalWidth - 6);

  // Find which items fit in the viewport starting from scrollOffset
  const endIndex = useMemo(() => {
    let usedHeight = 0;
    let idx = scrollOffset;
    while (idx < conversations.length) {
      const h = getItemHeight(conversations[idx]);
      if (usedHeight + h > availableHeight && idx > scrollOffset) break;
      usedHeight += h;
      idx++;
    }
    return idx;
  }, [scrollOffset, conversations, availableHeight]);

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
        // Check if newIndex is beyond current visible range
        if (newIndex >= endIndex) {
          // Scroll so newIndex is the last fully visible item
          let newOffset = scrollOffset;
          while (newOffset < newIndex) {
            let h = 0;
            for (let i = newOffset; i <= newIndex; i++) {
              h += getItemHeight(conversations[i]);
            }
            if (h <= availableHeight) break;
            newOffset++;
          }
          setScrollOffset(newOffset);
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

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} marginBottom={1}>
        <Text bold color="green">
          Claude Code History
        </Text>
        <Text dimColor> ({conversations.length} conversations)</Text>
      </Box>

      {conversations.slice(scrollOffset, endIndex).map((conv, i) => {
        const actualIndex = scrollOffset + i;
        const isSelected = actualIndex === selectedIndex;
        return (
          <Box key={conv.id} flexDirection="column">
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
            <Box paddingX={1}>
              <Text backgroundColor={isSelected ? 'blue' : undefined}> </Text>
              <Text color="gray">
                {'  '}
                {truncate(conv.summary, summaryWidth)}
              </Text>
            </Box>
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

      {endIndex < conversations.length && (
        <Box paddingX={1}>
          <Text dimColor>
            Showing {scrollOffset + 1}-{endIndex} of {conversations.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}
