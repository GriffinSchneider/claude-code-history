import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { loadConversations, loadSidechainConversation } from '../lib/history.js';
import { ConversationList } from './ConversationList.js';
import { ConversationDetail } from './ConversationDetail.js';
import { StatusBar } from './StatusBar.js';

interface AppProps {
  onResume?: (sessionId: string) => void;
}

interface StackEntry {
  conversation: any;
  savedState?: { scrollOffset: number; selectedMessage: number };
}

export function App({ onResume }: AppProps) {
  const { exit } = useApp();
  const [view, setView] = useState('list'); // 'list' or 'detail'
  const [conversations, setConversations] = useState([]);
  // Stack of conversations - allows navigating into sidechains and back
  const [conversationStack, setConversationStack] = useState<StackEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const currentEntry = conversationStack[conversationStack.length - 1];
  const selectedConversation = currentEntry?.conversation || null;
  const [selectedHasAgent, setSelectedHasAgent] = useState(false);

  useEffect(() => {
    async function load() {
      const convos = await loadConversations();
      setConversations(convos);
      setLoading(false);
    }
    load();
  }, []);

  const handleSelect = (conversation) => {
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
    currentState: { scrollOffset: number; selectedMessage: number }
  ) => {
    if (!selectedConversation) return;
    const sidechain = await loadSidechainConversation(selectedConversation.filePath, agentId);
    if (sidechain) {
      setConversationStack((prev) => {
        // Save the current state on the parent entry before pushing
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], savedState: currentState };
        return [...updated, { conversation: sidechain }];
      });
    }
  };

  const handleResume = (sessionId: string) => {
    // Signal to outer scope that we want to resume this session
    onResume?.(sessionId);
    // Exit Ink - cleanup and spawn happens after waitUntilExit() resolves
    exit();
  };

  const handleQuit = () => {
    exit();
  };

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Loading conversations from ~/.claude/projects...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={process.stdout.rows || 24}>
      <Box flexGrow={1} flexDirection="column">
        {view === 'list' ? (
          <ConversationList conversations={conversations} onSelect={handleSelect} onQuit={handleQuit} />
        ) : (
          <ConversationDetail
            conversation={selectedConversation}
            savedState={currentEntry?.savedState}
            onBack={handleBack}
            onResume={handleResume}
            onOpenSidechain={handleOpenSidechain}
            onSelectedAgentChange={setSelectedHasAgent}
            isInSidechain={conversationStack.length > 1}
          />
        )}
      </Box>
      <StatusBar
        view={view}
        conversationName={selectedConversation?.projectName}
        isInSidechain={conversationStack.length > 1}
        selectedHasAgent={selectedHasAgent}
      />
    </Box>
  );
}
