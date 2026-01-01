import { useState, useEffect } from 'react';
import { useTerminalDimensions } from '@opentui/react';
import { loadConversations, loadSidechainConversation } from '../lib/history.js';
import { ConversationList } from './ConversationList.js';
import { ConversationDetail } from './ConversationDetail.js';
import { StatusBar } from './StatusBar.js';

interface AppProps {
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
  firstUserMessage: string | null;
  lastUserMessage: string | null;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  messageCount: number;
  agentIds: string[];
}

interface StackEntry {
  conversation: Conversation;
  savedState?: { scrollY: number; selectedMessage: number };
}

export function App({ onResume, onQuit }: AppProps) {
  const { height } = useTerminalDimensions();
  const [view, setView] = useState('list'); // 'list' or 'detail'
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // Stack of conversations - allows navigating into sidechains and back
  const [conversationStack, setConversationStack] = useState<StackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const currentEntry = conversationStack[conversationStack.length - 1];
  const selectedConversation = currentEntry?.conversation || null;
  const [selectedHasAgent, setSelectedHasAgent] = useState(false);

  useEffect(() => {
    async function load() {
      const convos = await loadConversations();
      setConversations(convos as Conversation[]);
      setLoading(false);
    }
    load();
  }, []);

  const handleSelect = (conversation: Conversation) => {
    setConversationStack([{ conversation }]);
    setView('detail');
  };

  const handleBack = () => {
    if (conversationStack.length > 1) {
      // Pop from stack to go back to parent conversation
      setConversationStack((prev) => prev.slice(0, -1));
    } else {
      setView('list');
      setConversationStack([]);
    }
  };

  const handleOpenSidechain = async (
    agentId: string,
    currentState: { scrollY: number; selectedMessage: number }
  ) => {
    if (!selectedConversation) return;
    const sidechain = await loadSidechainConversation(selectedConversation.filePath, agentId);
    if (sidechain) {
      setConversationStack((prev) => {
        // Save the current state on the parent entry before pushing
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], savedState: currentState };
        return [...updated, { conversation: sidechain as unknown as Conversation }];
      });
    }
  };

  const handleResume = (sessionId: string) => {
    // Signal to outer scope that we want to resume this session
    onResume?.(sessionId);
  };

  const handleQuit = () => {
    onQuit?.();
  };

  if (loading) {
    return (
      <box flexDirection="column" height={height}>
        <box flexGrow={1} flexDirection="column" overflow="hidden">
          <box paddingLeft={1} paddingRight={1} flexDirection="row">
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
          <ConversationList conversations={conversations as any} onSelect={handleSelect as any} onQuit={handleQuit} />
        ) : (
          <ConversationDetail
            conversation={selectedConversation!}
            savedState={currentEntry?.savedState}
            onBack={handleBack}
            onResume={handleResume}
            onOpenSidechain={handleOpenSidechain}
            onSelectedAgentChange={setSelectedHasAgent}
            isInSidechain={conversationStack.length > 1}
          />
        )}
      </box>
      <StatusBar
        view={view}
        conversationName={selectedConversation?.projectName}
        isInSidechain={conversationStack.length > 1}
        selectedHasAgent={selectedHasAgent}
      />
    </box>
  );
}
