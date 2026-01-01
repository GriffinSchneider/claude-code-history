import React from 'react';
import { useTerminalDimensions } from '@opentui/react';

interface StatusBarProps {
  view: string;
  conversationName?: string;
  isInSidechain?: boolean;
  selectedHasAgent?: boolean;
}

export function StatusBar({ view, conversationName, isInSidechain, selectedHasAgent }: StatusBarProps) {
  const { width: termWidth } = useTerminalDimensions();
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
    <box flexDirection="column" height={2}>
      <text fg="#808080" height={1}>{'─'.repeat(Math.max(1, termWidth - 2))}</text>
      <box paddingLeft={1} paddingRight={1} flexDirection="row" justifyContent="space-between">
        <text fg="#808080">
          {keys.map((k, i) => (
            <span key={k.key}>
              <span fg="#00ffff"><b>{k.key}</b></span>
              <span> {k.action}</span>
              {i < keys.length - 1 ? '  ' : ''}
            </span>
          ))}
        </text>
        {conversationName && (
          <text fg="#808080"><i>{conversationName}</i></text>
        )}
      </box>
    </box>
  );
}
