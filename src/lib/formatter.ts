import chalk from 'chalk';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

// Configure marked with terminal renderer
marked.setOptions({
  renderer: new TerminalRenderer({
    reflowText: true,
    width: process.stdout.columns - 4 || 80,
  }),
});

/**
 * Format a user message for display
 */
export function formatUserMessage(content) {
  const text = typeof content === 'string' ? content : extractTextContent(content);
  return chalk.cyan.bold('You: ') + chalk.cyan(text);
}

/**
 * Format an assistant message for display
 */
export function formatAssistantMessage(content) {
  if (typeof content === 'string') {
    return chalk.white(marked(content).trim());
  }

  // Handle array of content blocks
  const parts = [];
  for (const block of content) {
    if (block.type === 'text') {
      parts.push(marked(block.text).trim());
    } else if (block.type === 'thinking') {
      parts.push(chalk.dim.italic('[Thinking...]'));
    } else if (block.type === 'tool_use') {
      parts.push(formatToolUse(block));
    } else if (block.type === 'tool_result') {
      // Skip tool results in abbreviated view
    }
  }

  return parts.join('\n');
}

/**
 * Format a tool_use block as abbreviated
 */
function formatToolUse(block) {
  const name = block.name || 'unknown';
  let input = '';

  if (block.input) {
    if (typeof block.input === 'string') {
      input = block.input;
    } else if (block.input.command) {
      input = block.input.command;
    } else if (block.input.file_path) {
      input = block.input.file_path;
    } else if (block.input.pattern) {
      input = block.input.pattern;
    } else if (block.input.query) {
      input = block.input.query;
    } else {
      input = JSON.stringify(block.input);
    }
  }

  // Truncate long inputs
  const maxLen = 60;
  if (input.length > maxLen) {
    input = input.slice(0, maxLen) + '...';
  }

  return chalk.yellow(`[Tool: ${name}] `) + chalk.dim(input);
}

/**
 * Extract text content from a content array
 */
function extractTextContent(content) {
  if (Array.isArray(content)) {
    return content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  }
  return String(content);
}

/**
 * Format a timestamp as a relative or absolute date
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Truncate text to a max length
 */
export function truncate(text, maxLen = 50) {
  if (!text) return '';
  const singleLine = text.replace(/\n/g, ' ').trim();
  if (singleLine.length <= maxLen) return singleLine;
  return singleLine.slice(0, maxLen - 3) + '...';
}
