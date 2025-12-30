import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { loadConversationMessages } from '../lib/history.js';
import { formatUserMessage, formatAssistantMessage } from '../lib/formatter.js';

export function ConversationDetail({ conversation, onBack, onResume }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [formattedMessages, setFormattedMessages] = useState([]);

  // Calculate visible height
  const visibleHeight = Math.max(5, (process.stdout.rows || 24) - 6);

  useEffect(() => {
    async function load() {
      try {
        const msgs = await loadConversationMessages(conversation.filePath);
        setMessages(msgs);

        // Pre-format all messages
        const formatted = msgs.map((msg) => {
          if (msg.type === 'user') {
            return formatUserMessage(msg.content);
          } else {
            return formatAssistantMessage(msg.content);
          }
        });
        setFormattedMessages(formatted);
      } catch (err) {
        setFormattedMessages([`Error loading conversation: ${err.message}`]);
      }
      setLoading(false);
    }
    load();
  }, [conversation.filePath]);

  useInput((input, key) => {
    if (input === 'q' || key.escape) {
      onBack();
      return;
    }

    if (key.return) {
      onResume(conversation.sessionId);
      return;
    }

    if (key.upArrow || input === 'k') {
      setScrollOffset((prev) => Math.max(0, prev - 1));
    }

    if (key.downArrow || input === 'j') {
      setScrollOffset((prev) => Math.min(Math.max(0, formattedMessages.length - visibleHeight), prev + 1));
    }

    // Page up/down
    if (key.pageUp) {
      setScrollOffset((prev) => Math.max(0, prev - visibleHeight));
    }
    if (key.pageDown) {
      setScrollOffset((prev) => Math.min(Math.max(0, formattedMessages.length - visibleHeight), prev + visibleHeight));
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Loading conversation...</Text>
      </Box>
    );
  }

  const visibleMessages = formattedMessages.slice(scrollOffset, scrollOffset + visibleHeight);

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box paddingX={1} marginBottom={1} borderStyle="single" borderBottom={true} borderTop={false} borderLeft={false} borderRight={false}>
        <Text bold color="green">
          {conversation.projectName}
        </Text>
        <Text dimColor> · </Text>
        <Text dimColor>{conversation.summary ? conversation.summary.slice(0, 60) : 'Conversation'}</Text>
      </Box>

      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {visibleMessages.map((msg, i) => (
          <Box key={scrollOffset + i} marginBottom={1}>
            <Text>{msg}</Text>
          </Box>
        ))}
      </Box>

      {formattedMessages.length > visibleHeight && (
        <Box paddingX={1}>
          <Text dimColor>
            Message {scrollOffset + 1}-{Math.min(scrollOffset + visibleHeight, formattedMessages.length)} of{' '}
            {formattedMessages.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}
