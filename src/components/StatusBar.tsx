import React from 'react';
import { Box, Text } from 'ink';

export function StatusBar({ view, conversationName }) {
  const keys =
    view === 'list'
      ? [
          { key: '↑/↓ or j/k', action: 'Navigate' },
          { key: 'Enter', action: 'View' },
          { key: 'q', action: 'Quit' },
        ]
      : [
          { key: 'j/k', action: 'Select msg' },
          { key: '↑/↓', action: 'Scroll' },
          { key: 'Enter', action: 'Resume' },
          { key: 'q', action: 'Back' },
        ];

  return (
    <Box
      borderStyle="single"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      paddingX={1}
      justifyContent="space-between"
    >
      <Text dimColor>
        {keys.map((k, i) => (
          <Text key={k.key}>
            <Text bold color="cyan">
              {k.key}
            </Text>
            <Text dimColor> {k.action}</Text>
            {i < keys.length - 1 ? '  ' : ''}
          </Text>
        ))}
      </Text>
      {conversationName && (
        <Text dimColor italic>
          {conversationName}
        </Text>
      )}
    </Box>
  );
}
