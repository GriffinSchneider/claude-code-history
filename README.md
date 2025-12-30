# claude-history

A TUI (Terminal User Interface) viewer for Claude Code conversation history.

![Built with Ink](https://img.shields.io/badge/built%20with-Ink-blue)

## Features

- Browse all Claude Code conversations across projects
- View full conversation history with syntax-highlighted markdown
- Expand/collapse tool calls and thinking blocks
- Resume any conversation directly in Claude Code
- Mouse support for clicking to select messages

## Installation

```bash
yarn install
```

## Usage

```bash
yarn start
```

Or link globally:

```bash
yarn link
claude-history
```

## Keybindings

### Conversation List

| Key | Action |
|-----|--------|
| `↑/↓` or `j/k` | Navigate conversations |
| `Enter` | View selected conversation |
| `q` | Quit |

### Conversation Detail

| Key | Action |
|-----|--------|
| `j/k` | Select previous/next message |
| `Space` | Toggle expand/collapse on selected message |
| `↑/↓` | Scroll viewport |
| `Ctrl+u/d` | Scroll half page up/down |
| `Page Up/Down` | Scroll full page |
| `Enter` | Resume conversation in Claude Code |
| `q` or `Esc` | Go back to list |
| Mouse click | Select clicked message |

## How It Works

Reads conversation history from `~/.claude/projects/`, which contains JSONL files with message data. Each conversation includes:

- User messages
- Assistant responses (with markdown rendering)
- Tool calls (Bash, Read, Write, etc.)
- Thinking blocks

Tool calls and thinking blocks start collapsed by default and can be expanded with `Space`.

## Tech Stack

- [Ink](https://github.com/vadimdemedes/ink) - React for CLI
- [marked](https://github.com/markedjs/marked) + [marked-terminal](https://github.com/mikaelbr/marked-terminal) - Markdown rendering
- [chalk](https://github.com/chalk/chalk) - Terminal colors
- [wrap-ansi](https://github.com/chalk/wrap-ansi) - ANSI-aware text wrapping
- [tsx](https://github.com/privatenumber/tsx) - TypeScript execution

## License

MIT
