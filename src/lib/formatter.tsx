import { parseColor, SyntaxStyle, TerminalColors } from '@opentui/core';
import React from 'react';
import { DefinitePalette } from '..';


const theme = {
  name: "GitHub Dark",
  bg: "#0D1117",
  styles: {
    keyword: { fg: parseColor("#FF7B72"), bold: true },
    string: { fg: parseColor("#A5D6FF") },
    comment: { fg: parseColor("#8B949E"), italic: true },
    number: { fg: parseColor("#79C0FF") },
    function: { fg: parseColor("#D2A8FF") },
    type: { fg: parseColor("#FFA657") },
    operator: { fg: parseColor("#FF7B72") },
    variable: { fg: parseColor("#E6EDF3") },
    property: { fg: parseColor("#79C0FF") },
    "punctuation.bracket": { fg: parseColor("#F0F6FC") },
    "punctuation.delimiter": { fg: parseColor("#C9D1D9") },
    "markup.heading": { fg: parseColor("#58A6FF"), bold: true },
    "markup.heading.1": { fg: parseColor("#00FF88"), bold: true, underline: true },
    "markup.heading.2": { fg: parseColor("#00D7FF"), bold: true },
    "markup.heading.3": { fg: parseColor("#FF69B4") },
    "markup.bold": { fg: parseColor("#F0F6FC"), bold: true },
    "markup.strong": { fg: parseColor("#F0F6FC"), bold: true },
    "markup.italic": { fg: parseColor("#F0F6FC"), italic: true },
    "markup.list": { fg: parseColor("#FF7B72") },
    "markup.quote": { fg: parseColor("#8B949E"), italic: true },
    "markup.raw": { fg: parseColor("#A5D6FF"), bg: parseColor("#161B22") },
    "markup.raw.block": { fg: parseColor("#A5D6FF"), bg: parseColor("#161B22") },
    "markup.raw.inline": { fg: parseColor("#A5D6FF"), bg: parseColor("#161B22") },
    "markup.link": { fg: parseColor("#58A6FF"), underline: true },
    "markup.link.label": { fg: parseColor("#A5D6FF"), underline: true },
    "markup.link.url": { fg: parseColor("#58A6FF"), underline: true },
    label: { fg: parseColor("#7EE787") },
    conceal: { fg: parseColor("#6E7681") },
    "punctuation.special": { fg: parseColor("#8B949E") },
    default: { fg: parseColor("#E6EDF3") },
  },
}
const syntaxStyle = SyntaxStyle.fromStyles(theme.styles);


export interface Message {
  type: 'user' | 'assistant';
  content: any;
  timestamp?: string;
}

export interface MessageGroup {
  messages: Message[];
  summary: string;
}

/**
 * Check if a message contains a tool_use block
 */
function hasToolUse(message: Message): boolean {
  if (message.type === 'user') return false;
  if (!Array.isArray(message.content)) return false;
  return message.content.some((b: any) => b.type === 'tool_use');
}

/**
 * Check if a message is thinking-only (no text content, no tools)
 */
function isThinkingOnly(message: Message): boolean {
  if (message.type === 'user') return false;
  if (!Array.isArray(message.content)) return false;
  return message.content.some((b: any) => b.type === 'thinking') &&
         !message.content.some((b: any) => b.type === 'text' || b.type === 'tool_use');
}

/**
 * Group messages according to the spec:
 * - User messages are always solo groups
 * - For consecutive assistant messages:
 *   - Everything through the last tool_use → one group
 *   - Each message after the last tool → solo group
 */
export function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.type === 'user') {
      // User messages are always solo
      groups.push({
        messages: [msg],
        summary: getMessageSummary(msg),
      });
      i++;
    } else {
      // Collect consecutive assistant messages
      const assistantRun: Message[] = [];
      while (i < messages.length && messages[i].type === 'assistant') {
        assistantRun.push(messages[i]);
        i++;
      }

      // Find the last message with a tool_use
      let lastToolIndex = -1;
      for (let j = assistantRun.length - 1; j >= 0; j--) {
        if (hasToolUse(assistantRun[j])) {
          lastToolIndex = j;
          break;
        }
      }

      if (lastToolIndex === -1) {
        // No tools at all - each message is its own group
        for (const m of assistantRun) {
          groups.push({
            messages: [m],
            summary: getMessageSummary(m),
          });
        }
      } else {
        // Extend to include any thinking-only messages after the last tool
        let operatingEndIndex = lastToolIndex;
        for (let j = lastToolIndex + 1; j < assistantRun.length; j++) {
          if (isThinkingOnly(assistantRun[j])) {
            operatingEndIndex = j;
          } else {
            break; // Hit a message with text content, stop
          }
        }

        // Group everything through the operating end
        const toolGroup = assistantRun.slice(0, operatingEndIndex + 1);
        groups.push({
          messages: toolGroup,
          summary: getGroupSummary(toolGroup),
        });

        // Each message after the operating group gets its own group
        for (let j = operatingEndIndex + 1; j < assistantRun.length; j++) {
          groups.push({
            messages: [assistantRun[j]],
            summary: getMessageSummary(assistantRun[j]),
          });
        }
      }
    }
  }

  return groups;
}

function getMessageSummary(message: Message): string {
  if (message.type === 'user') {
    const text = typeof message.content === 'string'
      ? message.content
      : extractTextContent(message.content);
    return `You: ${truncate(text, 60)}`;
  }
  return truncate(getContentSummary(message.content), 70);
}

function getGroupSummary(messages: Message[]): string {
  const toolCount = messages.filter(hasToolUse).length;
  if (toolCount > 0) {
    // Find first tool name
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        const tool = msg.content.find((b: any) => b.type === 'tool_use');
        if (tool) {
          return `[${toolCount} tool${toolCount > 1 ? 's' : ''}: ${tool.name}${toolCount > 1 ? ', ...' : ''}]`;
        }
      }
    }
  }
  return `[${messages.length} messages]`;
}

/**
 * Format a group - collapsed shows summary, expanded shows all messages
 */
export function formatGroup(group: MessageGroup, collapsed: boolean, palette: DefinitePalette): React.ReactNode {
  if (collapsed) {
    // Show summary line
    const isUser = group.messages[0]?.type === 'user';
    return (
      <text fg={isUser ? palette.brightCyan : palette.brightBlack}>
        {group.summary}
      </text>
    );
  }

  // Expanded: show all messages
  if (group.messages.length === 1) {
    return formatMessage(group.messages[0], false, palette);
  }

  // Multiple messages in group
  return (
    <box flexDirection="column">
      {group.messages.map((msg, i) => (
        <box key={i} flexDirection="column" paddingBottom={i < group.messages.length - 1 ? 1 : 0}>
          {formatMessage(msg, false, palette)}
        </box>
      ))}
    </box>
  );
}

/**
 * Format a single message - for use within groups
 */
export function formatMessage(message: Message, collapsed: boolean, palette: DefinitePalette): React.ReactNode {
  if (message.type === 'user') {
    return formatUserMessage(message.content, collapsed, palette);
  } else {
    return formatAssistantMessage(message.content, collapsed, palette);
  }
}

function formatUserMessage(content: any, collapsed: boolean, palette: DefinitePalette): React.ReactNode {
  const text = typeof content === 'string' ? content : extractTextContent(content);
  if (collapsed) {
    return <text fg={palette.brightCyan}><b>You:</b> {truncate(text, 70)}</text>;
  }
  return (
    <box flexDirection="column" backgroundColor="#222222">
      <text fg={palette.brightCyan}><b>You:</b></text>
      <markdown syntaxStyle={syntaxStyle} content={text} />
    </box>
  );
}

function formatAssistantMessage(content: any, collapsed: boolean, palette: DefinitePalette): React.ReactNode {
  if (typeof content === 'string') {
    if (collapsed) {
      return <text>{truncate(content, 70)}</text>;
    }
    return <markdown syntaxStyle={syntaxStyle}>{content}</markdown>;
  }

  if (!Array.isArray(content)) {
    const str = String(content);
    if (collapsed) {
      return <text>{truncate(str, 70)}</text>;
    }
    return <markdown syntaxStyle={syntaxStyle}>{str}</markdown>;
  }

  // For collapsed, show a one-line summary
  if (collapsed) {
    const summary = getContentSummary(content);
    return <text>{truncate(summary, 70)}</text>;
  }

  // Expanded: show full content
  const parts: React.ReactNode[] = [];

  for (let i = 0; i < content.length; i++) {
    const block = content[i];

    if (block.type === 'text' && block.text) {
      parts.push(<markdown key={i} content={block.text} syntaxStyle={syntaxStyle}></markdown>);
    } else if (block.type === 'thinking') {
      const summary = truncate(block.thinking, 100);
      parts.push(
        <text key={i} fg={palette.brightBlack}><i>[Thinking: {summary}]</i></text>
      );
    } else if (block.type === 'tool_use') {
      const inputSummary = summarizeToolInput(block.input);
      parts.push(
        <box key={i} flexDirection="column">
          <text fg={palette.brightYellow}><b>Tool: {block.name || 'unknown'}</b></text>
          <text fg={palette.brightBlack}>{inputSummary}</text>
        </box>
      );
    }
  }

  return <box flexDirection="column">{parts}</box>;
}

function getContentSummary(content: any[]): string {
  const textBlocks = content.filter(b => b.type === 'text' && b.text);
  const toolBlocks = content.filter(b => b.type === 'tool_use');

  if (textBlocks.length > 0) {
    return textBlocks[0].text;
  }
  if (toolBlocks.length > 0) {
    return `[Tool: ${toolBlocks[0].name}]`;
  }
  return '[...]';
}

function summarizeToolInput(input: any): string {
  if (!input) return '';
  if (typeof input === 'string') return truncate(input, 200);
  if (input.command) return truncate(input.command, 200);
  if (input.file_path) return input.file_path;
  if (input.pattern) return input.pattern;
  if (input.query) return truncate(input.query, 200);
  return truncate(JSON.stringify(input, null, 2), 200);
}

/**
 * Extract text content from a content array or string
 */
export function extractTextContent(content: any): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textParts: string[] = [];
    for (const block of content) {
      if (block.type === 'text' && block.text) {
        textParts.push(block.text);
      }
    }
    return textParts.join(' ');
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
