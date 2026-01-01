import React from 'react';

export interface Message {
  type: 'user' | 'assistant';
  content: any;
  timestamp?: string;
  model?: string;
}

export interface IndexedMessage {
  index: number;
  message: Message;
}

/**
 * A group of messages that are displayed together.
 * Single-message groups render at top level.
 * Multi-message groups render as collapsible.
 */
export type MessageGroup = IndexedMessage[];

/**
 * Check if an assistant message has substantive text content (not just tool use/thinking)
 */
export function hasTextContent(message: Message): boolean {
  if (message.type === 'user') return true;
  if (typeof message.content === 'string') return message.content.trim().length > 0;
  if (!Array.isArray(message.content)) return false;
  return message.content.some((block: any) => block.type === 'text' && block.text?.trim());
}

/**
 * Group messages for display:
 * - User messages → solo groups
 * - Assistant "working" chain (tool→text→tool→text...) → grouped up through the last tool
 * - Final assistant texts (after last tool) → each gets solo group
 */
export function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let assistantRun: IndexedMessage[] = [];

  const flushAssistantRun = () => {
    if (assistantRun.length === 0) return;

    // Find the last tool-only message (no text content)
    let lastToolIdx = -1;
    for (let i = 0; i < assistantRun.length; i++) {
      if (!hasTextContent(assistantRun[i].message)) {
        lastToolIdx = i;
      }
    }

    if (lastToolIdx >= 0) {
      // Group everything up to and including the last tool
      groups.push(assistantRun.slice(0, lastToolIdx + 1));
      // Each message after the last tool is solo
      for (let i = lastToolIdx + 1; i < assistantRun.length; i++) {
        groups.push([assistantRun[i]]);
      }
    } else {
      // No tools - each message is solo
      for (const msg of assistantRun) {
        groups.push([msg]);
      }
    }

    assistantRun = [];
  };

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];

    if (msg.type === 'user') {
      flushAssistantRun();
      groups.push([{ index: i, message: msg }]);
    } else if (msg.type === 'assistant') {
      assistantRun.push({ index: i, message: msg });
    }
  }

  flushAssistantRun();
  return groups;
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
function formatUserMessage(content: any, collapsed: boolean): React.ReactNode {
  const text = typeof content === 'string' ? content : extractTextContent(content);
  if (collapsed) {
    return (
      <text>
        <span fg="#00ffff"><b>You: </b></span>
        <span fg="#00ffff">{truncate(text, 60)}</span>
      </text>
    );
  }
  return (
    <text>
      <span fg="#00ffff"><b>You: </b></span>
      <span fg="#00ffff">{text}</span>
    </text>
  );
}

/**
 * Format an assistant message for display
 */
function formatAssistantMessage(content: any, collapsed: boolean): React.ReactNode {
  if (typeof content === 'string') {
    if (collapsed) {
      return <text>{truncate(content, 60)}</text>;
    }
    // Punting on markdown for now - just render as plain text
    return <text>{content}</text>;
  }

  // Handle array of content blocks
  const parts: React.ReactNode[] = [];
  for (let i = 0; i < content.length; i++) {
    const block = content[i];
    if (block.type === 'text') {
      if (collapsed) {
        parts.push(<text key={i}>{truncate(block.text, 60)}</text>);
      } else {
        // Punting on markdown - just render plain text
        parts.push(<text key={i}>{block.text}</text>);
      }
    } else if (block.type === 'thinking') {
      if (collapsed) {
        parts.push(
          <text key={i} fg="#808080">
            <i>[Thinking...]</i>
          </text>
        );
      } else {
        parts.push(
          <box key={i} flexDirection="column">
            <text fg="#808080"><i>--- Thinking ---</i></text>
            <text fg="#808080">{block.thinking}</text>
            <text fg="#808080"><i>--- End Thinking ---</i></text>
          </box>
        );
      }
    } else if (block.type === 'tool_use') {
      if (collapsed) {
        parts.push(<React.Fragment key={i}>{formatToolUseCollapsed(block)}</React.Fragment>);
      } else {
        parts.push(<React.Fragment key={i}>{formatToolUseExpanded(block)}</React.Fragment>);
      }
    }
    // Skip tool_result blocks
  }

  return <box flexDirection="column">{parts}</box>;
}

/**
 * Format a tool_use block as collapsed (abbreviated)
 */
function formatToolUseCollapsed(block: any): React.ReactNode {
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

  return (
    <text>
      <span fg="#ffff00">[Tool: {name}] </span>
      <span fg="#808080">{truncate(input, 60)}</span>
    </text>
  );
}

/**
 * Format a tool_use block as expanded (full details)
 */
function formatToolUseExpanded(block: any): React.ReactNode {
  const name = block.name || 'unknown';
  const inputStr = block.input
    ? typeof block.input === 'string'
      ? block.input
      : JSON.stringify(block.input, null, 2)
    : '';

  return (
    <box flexDirection="column">
      <text fg="#ffff00"><b>--- Tool: {name} ---</b></text>
      <text fg="#808080">{inputStr}</text>
      <text fg="#ffff00"><b>--- End Tool ---</b></text>
    </box>
  );
}

/**
 * Format a message with collapsed state - returns a React element
 */
export function formatMessage(message: Message, collapsed: boolean): React.ReactNode {
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
