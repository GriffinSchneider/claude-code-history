import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { PROJECTS_DIR, decodeProjectPath, getProjectDisplayName } from '../utils/paths.js';

/**
 * Load all conversations from ~/.claude/projects
 * Returns array of conversation summaries sorted by most recent
 */
export async function loadConversations() {
  const conversations = [];

  try {
    const projectFolders = await readdir(PROJECTS_DIR);

    for (const folder of projectFolders) {
      const projectDir = join(PROJECTS_DIR, folder);
      const projectPath = decodeProjectPath(folder);
      const projectName = getProjectDisplayName(projectPath);

      try {
        const files = await readdir(projectDir);
        const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'));

        for (const file of jsonlFiles) {
          try {
            const filePath = join(projectDir, file);
            const conversation = await parseConversationFile(filePath, projectPath, projectName);
            if (conversation && conversation.messageCount > 0) {
              conversations.push(conversation);
            }
          } catch (err) {
            // Skip malformed files
          }
        }
      } catch (err) {
        // Skip inaccessible project dirs
      }
    }
  } catch (err) {
    // Projects dir doesn't exist or inaccessible
  }

  // Sort by most recent first
  conversations.sort((a, b) => new Date(b.lastTimestamp) - new Date(a.lastTimestamp));

  return conversations;
}

/**
 * Parse a single conversation JSONL file
 */
async function parseConversationFile(filePath: string, fallbackProjectPath: string, fallbackProjectName: string) {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;
  let sessionId: string | null = null;
  let summary: string | null = null;
  let firstUserMessage: string | null = null;
  let cwd: string | null = null;
  let messageCount = 0;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      // Track timestamps
      if (entry.timestamp) {
        if (!firstTimestamp) firstTimestamp = entry.timestamp;
        lastTimestamp = entry.timestamp;
      }

      // Get session ID
      if (entry.sessionId && !sessionId) {
        sessionId = entry.sessionId;
      }

      // Get actual cwd from entries
      if (entry.cwd && !cwd) {
        cwd = entry.cwd;
      }

      // Look for summary entries
      if (entry.type === 'summary' && entry.summary) {
        summary = entry.summary;
      }

      // Count actual messages
      if (entry.type === 'user' || entry.type === 'assistant') {
        messageCount++;

        // Capture first user message as fallback title
        if (entry.type === 'user' && !firstUserMessage && entry.message?.content) {
          firstUserMessage = extractTextContent(entry.message.content);
        }
      }
    } catch (err) {
      // Skip malformed lines
    }
  }

  // Extract conversation ID from filename
  const conversationId = filePath.split('/').pop()!.replace('.jsonl', '');

  // Use cwd from conversation if available, otherwise fall back to decoded path
  const projectPath = cwd || fallbackProjectPath;
  const projectName = getProjectDisplayName(projectPath);

  return {
    id: conversationId,
    filePath,
    projectPath,
    projectName,
    sessionId: sessionId || conversationId,
    summary: summary || firstUserMessage,
    firstTimestamp,
    lastTimestamp,
    messageCount,
  };
}

/**
 * Load full messages from a conversation file
 */
export async function loadConversationMessages(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  const messages = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      if (entry.type === 'user' && entry.message) {
        messages.push({
          type: 'user',
          content: entry.message.content,
          timestamp: entry.timestamp,
        });
      } else if (entry.type === 'assistant' && entry.message) {
        messages.push({
          type: 'assistant',
          content: entry.message.content,
          timestamp: entry.timestamp,
          model: entry.message.model,
        });
      }
    } catch (err) {
      // Skip malformed lines
    }
  }

  return messages;
}

function extractTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  }
  return String(content);
}
