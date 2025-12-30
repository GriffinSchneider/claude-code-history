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

export interface Message {
  type: 'user' | 'assistant';
  content: any;
  timestamp?: string;
  model?: string;
}

/**
 * Check if a message should start collapsed by default
 * (only if it ONLY contains collapsible content, no text)
 */
export function shouldStartCollapsed(message: Message): boolean {
  if (message.type === 'user') return false;
  if (typeof message.content === 'string') return false;
  if (!Array.isArray(message.content)) return false;

  const hasText = message.content.some((block: any) => block.type === 'text' && block.text?.trim());
  const hasCollapsible = message.content.some(
    (block: any) => block.type === 'thinking' || block.type === 'tool_use'
  );

  // Start collapsed if it has collapsible content but no text
  return hasCollapsible && !hasText;
}

/**
 * Format a user message for display
 */
function formatUserMessage(content: any, collapsed: boolean): string {
  const text = typeof content === 'string' ? content : extractTextContent(content);
  if (collapsed) {
    return chalk.cyan.bold('You: ') + chalk.cyan(truncate(text, 60));
  }
  return chalk.cyan.bold('You: ') + chalk.cyan(text);
}

/**
 * Format an assistant message for display
 */
function formatAssistantMessage(content: any, collapsed: boolean): string {
  if (typeof content === 'string') {
    if (collapsed) {
      return chalk.white(truncate(content, 60));
    }
    return chalk.white(marked(content).trim());
  }

  // Handle array of content blocks
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text') {
      if (collapsed) {
        parts.push(truncate(block.text, 60));
      } else {
        parts.push(marked(block.text).trim());
      }
    } else if (block.type === 'thinking') {
      if (collapsed) {
        parts.push(chalk.dim.italic('[Thinking...]'));
      } else {
        parts.push(chalk.dim.italic('--- Thinking ---'));
        parts.push(chalk.dim(block.thinking));
        parts.push(chalk.dim.italic('--- End Thinking ---'));
      }
    } else if (block.type === 'tool_use') {
      if (collapsed) {
        parts.push(formatToolUseCollapsed(block));
      } else {
        parts.push(formatToolUseExpanded(block));
      }
    } else if (block.type === 'tool_result') {
      // Skip tool results
    }
  }

  return parts.join('\n');
}

/**
 * Format a tool_use block as collapsed (abbreviated)
 */
function formatToolUseCollapsed(block: any): string {
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

  return chalk.yellow(`[Tool: ${name}] `) + chalk.dim(truncate(input, 60));
}

/**
 * Format a tool_use block as expanded (full details)
 */
function formatToolUseExpanded(block: any): string {
  const name = block.name || 'unknown';
  const lines: string[] = [];

  lines.push(chalk.yellow.bold(`--- Tool: ${name} ---`));

  if (block.input) {
    const inputStr = typeof block.input === 'string'
      ? block.input
      : JSON.stringify(block.input, null, 2);
    lines.push(chalk.dim(inputStr));
  }

  lines.push(chalk.yellow.bold(`--- End Tool ---`));

  return lines.join('\n');
}

/**
 * Format a message with collapsed state
 */
export function formatMessage(message: Message, collapsed: boolean): string {
  if (message.type === 'user') {
    return formatUserMessage(message.content, collapsed);
  } else {
    return formatAssistantMessage(message.content, collapsed);
  }
}

/**
 * Extract text content from a content array
 */
export function extractTextContent(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');
  }
  return String(content);
}

/**
 * Format a timestamp as a relative or absolute date
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
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
export function truncate(text: string | undefined, maxLen = 50): string {
  if (!text) return '';
  const singleLine = text.replace(/\n/g, ' ').trim();
  if (singleLine.length <= maxLen) return singleLine;
  return singleLine.slice(0, maxLen - 3) + '...';
}
