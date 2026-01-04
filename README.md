# claude-history

A TUI (Terminal User Interface) viewer for Claude Code conversation history.

## Installation

```bash
bun install
```

## Usage

```bash
bun start
```

## How It Works

Reads conversation history from `~/.claude/projects/`, which contains JSONL files with message data. Each conversation includes:

- User messages
- Assistant responses (with markdown rendering)
- Tool calls (Bash, Read, Write, etc.)
- Thinking blocks

Tool calls and thinking blocks start collapsed by default and can be expanded with `Space`.
