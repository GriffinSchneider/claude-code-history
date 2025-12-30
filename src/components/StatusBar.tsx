import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  view: string;
  conversationName?: string;
  isInSidechain?: boolean;
  selectedHasAgent?: boolean;
}

export function StatusBar({ view, conversationName, isInSidechain, selectedHasAgent }: StatusBarProps) {
  const keys =
    view === 'list'
      ? [
          { key: '↑/↓ or j/k', action: 'Navigate' },
          { key: 'Enter', action: 'View' },
          { key: 'q', action: 'Quit' },
        ]
      : [
          { key: 'j/k', action: 'Select' },
          { key: 'Space', action: 'Expand/Collapse' },
          { key: '↑/↓', action: 'Scroll' },
          ...(selectedHasAgent ? [{ key: 's', action: 'Agent (◆)' }] : []),
          { key: 'Enter', action: 'Resume' },
          { key: 'q', action: isInSidechain ? 'Parent' : 'Back' },
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
