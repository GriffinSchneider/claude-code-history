import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { loadConversations } from '../lib/history.js';
import { ConversationList } from './ConversationList.js';
import { ConversationDetail } from './ConversationDetail.js';
import { StatusBar } from './StatusBar.js';

interface AppProps {
  onResume?: (sessionId: string) => void;
}

export function App({ onResume }: AppProps) {
  const { exit } = useApp();
  const [view, setView] = useState('list'); // 'list' or 'detail'
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const convos = await loadConversations();
      setConversations(convos);
      setLoading(false);
    }
    load();
  }, []);

  const handleSelect = (conversation) => {
    setSelectedConversation(conversation);
    setView('detail');
  };

  const handleBack = () => {
    setView('list');
    setSelectedConversation(null);
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
          <ConversationDetail conversation={selectedConversation} onBack={handleBack} onResume={handleResume} />
        )}
      </Box>
      <StatusBar view={view} conversationName={selectedConversation?.projectName} />
    </Box>
  );
}
