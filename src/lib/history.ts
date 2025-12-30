import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { PROJECTS_DIR, decodeProjectPath, getProjectDisplayName } from '../utils/paths.js';
import { extractTextContent, type Message } from './formatter.js';

/**
 * Extract the actual user message from text that may contain system-generated prefixes
 * Returns null if there's no real user content
 */
function extractUserMessage(text: string): string | null {
  let result = text;

  // Strip "Caveat: ... local commands." prefix
  const caveatMatch = result.match(/^Caveat:.*?unless the user explicitly asks you to\./s);
  if (caveatMatch) {
    result = result.slice(caveatMatch[0].length);
  }

  // Strip XML-like system tags and their contents
  result = result.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '');
  result = result.replace(/<command-name>[\s\S]*?<\/command-name>/g, '');
  result = result.replace(/<command-message>[\s\S]*?<\/command-message>/g, '');
  result = result.replace(/<command-args>[\s\S]*?<\/command-args>/g, '');
  result = result.replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, '');

  result = result.trim();
  return result.length > 0 ? result : null;
}

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
            const conversation = await parseConversationFile(filePath, projectPath);
            if (conversation && conversation.messageCount > 0) {
              // Skip warmup-only conversations (just "Warmup" + one response)
              const isWarmupOnly =
                conversation.firstUserMessage?.toLowerCase() === 'warmup' &&
                conversation.messageCount <= 2;
              if (!isWarmupOnly) {
                conversations.push(conversation);
              }
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
 * Returns null for sidechain conversations (they're accessed via parent)
 */
async function parseConversationFile(filePath: string, fallbackProjectPath: string) {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;
  let sessionId: string | null = null;
  let summary: string | null = null;
  let firstUserMessage: string | null = null;
  let lastUserMessage: string | null = null;
  let cwd: string | null = null;
  let messageCount = 0;
  let isSidechain = false;
  const agentIds: string[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      // Check if this is a sidechain conversation
      if (entry.isSidechain) {
        isSidechain = true;
      }

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

      // Collect agentIds from tool results (links to sidechain conversations)
      if (entry.toolUseResult?.agentId) {
        agentIds.push(entry.toolUseResult.agentId);
      }

      // Count actual messages
      if (entry.type === 'user' || entry.type === 'assistant') {
        messageCount++;

        // Capture first and last user messages
        // Strip system-generated prefixes (Caveat, system-reminder, etc.)
        if (entry.type === 'user' && entry.message?.content) {
          const rawText = extractTextContent(entry.message.content);
          const cleanText = extractUserMessage(rawText);
          if (cleanText) {
            if (!firstUserMessage) {
              firstUserMessage = cleanText;
            }
            lastUserMessage = cleanText;
          }
        }
      }
    } catch (err) {
      // Skip malformed lines
    }
  }

  // Skip sidechain conversations - they're accessed via their parent
  if (isSidechain) {
    return null;
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
    firstUserMessage,
    lastUserMessage,
    firstTimestamp,
    lastTimestamp,
    messageCount,
    agentIds,
  };
}

/**
 * Commands to hide from conversation details (noisy/uninteresting)
 */
const HIDDEN_COMMANDS = ['/release-notes', '/clear', '/new'];

/**
 * Check if a message is a hidden command or its response
 */
function isHiddenCommandMessage(textContent: string): boolean {
  // Check for any hidden command
  for (const cmd of HIDDEN_COMMANDS) {
    if (textContent.includes(`<command-name>${cmd}</command-name>`)) return true;
  }
  // The release-notes response (wrapped in local-command-stdout, contains version entries)
  if (textContent.includes('<local-command-stdout>') && textContent.includes('Version ')) return true;
  return false;
}

/**
 * Load a sidechain conversation by agentId
 * Searches the same project directory for agent-{agentId}.jsonl
 */
export async function loadSidechainConversation(parentFilePath: string, agentId: string) {
  const projectDir = parentFilePath.split('/').slice(0, -1).join('/');
  const sidechainPath = join(projectDir, `agent-${agentId}.jsonl`);

  try {
    const content = await readFile(sidechainPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    // Get basic info from first entry
    const firstEntry = JSON.parse(lines[0]);
    const projectPath = firstEntry.cwd || '';
    const projectName = getProjectDisplayName(projectPath);

    // Count messages
    let messageCount = 0;
    let firstUserMessage: string | null = null;
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === 'user' || entry.type === 'assistant') {
          messageCount++;
          if (entry.type === 'user' && entry.message?.content && !firstUserMessage) {
            firstUserMessage = extractTextContent(entry.message.content);
          }
        }
      } catch {
        // skip
      }
    }

    return {
      id: `agent-${agentId}`,
      filePath: sidechainPath,
      projectPath,
      projectName: `[Agent] ${projectName}`,
      sessionId: firstEntry.sessionId || agentId,
      summary: firstUserMessage,
      agentId,
      messageCount,
      agentIds: [], // Sidechains don't have nested sidechains (for now)
    };
  } catch {
    return null;
  }
}

export interface LoadedConversation {
  messages: Message[];
  /** Maps message index to agentId for messages that spawned subagents */
  messageAgentIds: Map<number, string>;
}

/**
 * Load full messages from a conversation file
 */
export async function loadConversationMessages(filePath: string): Promise<LoadedConversation> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);

  const messages: Message[] = [];
  const messageAgentIds = new Map<number, string>();
  let skipNextAssistant = false;
  let lastAssistantIndex = -1;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);

      if (entry.type === 'user' && entry.message) {
        // Skip meta messages (e.g., Caveat messages that precede local commands)
        if (entry.isMeta) continue;

        // Check for tool result with agentId - associate with last assistant message
        if (entry.toolUseResult?.agentId && lastAssistantIndex >= 0) {
          messageAgentIds.set(lastAssistantIndex, entry.toolUseResult.agentId);
        }

        // Skip empty user messages (tool approvals, etc.)
        const textContent = extractTextContent(entry.message.content);
        if (textContent.trim()) {
          // Skip hidden commands and their responses
          if (isHiddenCommandMessage(textContent)) {
            skipNextAssistant = true;
            continue;
          }
          messages.push({
            type: 'user',
            content: entry.message.content,
            timestamp: entry.timestamp,
          });
        }
      } else if (entry.type === 'assistant' && entry.message) {
        if (skipNextAssistant) {
          skipNextAssistant = false;
          continue;
        }
        messages.push({
          type: 'assistant',
          content: entry.message.content,
          timestamp: entry.timestamp,
          model: entry.message.model,
        });
        lastAssistantIndex = messages.length - 1;
      }
    } catch (err) {
      // Skip malformed lines
    }
  }

  return { messages, messageAgentIds };
}

