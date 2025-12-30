import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { loadConversations } from '../lib/history.js';
import { resumeSession } from '../lib/claude.js';
import { ConversationList } from './ConversationList.js';
import { ConversationDetail } from './ConversationDetail.js';
import { StatusBar } from './StatusBar.js';

export function App() {
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

  const handleResume = (sessionId) => {
    // Exit ink and launch claude
    exit();
    setTimeout(() => {
      resumeSession(sessionId);
    }, 100);
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
