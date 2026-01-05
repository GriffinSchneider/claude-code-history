import { useState, useEffect } from 'react';
import { useTerminalDimensions } from '@opentui/react';
import { loadConversations } from '../lib/history.js';
import { ConversationList } from './ConversationList.js';
import { ConversationDetail } from './ConversationDetail.js';
import { StatusBar } from './StatusBar.js';
import { DefinitePalette } from '../index.js';

interface AppProps {
  palette: DefinitePalette;
  onResume?: (sessionId: string) => void;
  onQuit?: () => void;
}

interface Conversation {
  id: string;
  filePath: string;
  projectPath: string;
  projectName: string;
  sessionId: string;
  summary: string | null;
  lastTimestamp: string | null;
  messageCount: number;
}

export function App({ palette, onResume, onQuit }: AppProps) {
  const { height } = useTerminalDimensions();
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [listState, setListState] = useState<{ selectedIndex: number; scrollY: number }>({ selectedIndex: 0, scrollY: 0 });

  useEffect(() => {
    async function load() {
      const convos = (await loadConversations())
        .filter((conv) => conv.summary);
      setConversations(convos);
      setLoading(false);
    }
    load();
  }, []);

  const handleSelect = (conversation: Conversation, state: { selectedIndex: number; scrollY: number }) => {
    setListState(state);
    setSelectedConversation(conversation);
    setView('detail');
  };

  const handleBack = () => {
    setView('list');
    setSelectedConversation(null);
  };

  const handleResume = (sessionId: string) => {
    onResume?.(sessionId);
  };

  const handleQuit = () => {
    onQuit?.();
  };

  if (loading) {
    return (
      <box flexDirection="column" height={height}>
        <box flexGrow={1} flexDirection="column" overflow="hidden">
          <box paddingLeft={1} paddingRight={1} flexDirection="row" height={1}>
            <text>Loading conversations from ~/.claude/projects...</text>
          </box>
        </box>
      </box>
    );
  }

  return (
    <box flexDirection="column" height={height}>
      <box flexGrow={1} flexDirection="column" overflow="hidden">
        {view === 'list' ? (
          <ConversationList
            conversations={conversations as any}
            onSelect={handleSelect as any}
            onQuit={handleQuit}
            initialSelectedIndex={listState.selectedIndex}
            initialScrollY={listState.scrollY}
          />
        ) : (
          <ConversationDetail
            conversation={selectedConversation!}
            onBack={handleBack}
            onResume={handleResume}
            palette={palette}
          />
        )}
      </box>
      <StatusBar view={view} />
    </box>
  );
}
