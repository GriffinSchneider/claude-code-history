import { useTerminalDimensions } from '@opentui/react';

interface StatusBarProps {
  view: string;
}

export function StatusBar({ view }: StatusBarProps) {
  const { width: termWidth } = useTerminalDimensions();

  const keys = view === 'list'
    ? [
        { key: 'j/k', action: 'Navigate' },
        { key: 'Enter', action: 'View' },
        { key: 'q', action: 'Quit' },
      ]
    : [
        { key: 'j/k', action: 'Navigate' },
        { key: 'Enter', action: 'Resume' },
        { key: 'q', action: 'Back' },
      ];

  return (
    <box flexDirection="column" height={2}>
      <box flexDirection="row" height={1}>
        <text fg="#808080">{'─'.repeat(Math.max(1, termWidth - 2))}</text>
      </box>
      <box paddingLeft={1} flexDirection="row" height={1}>
        <text fg="#808080">
          {keys.map((k, i) => (
            <span key={k.key}>
              <span fg="#00ffff"><b>{k.key}</b></span>
              <span> {k.action}</span>
              {i < keys.length - 1 ? '  ' : ''}
            </span>
          ))}
        </text>
      </box>
    </box>
  );
}
