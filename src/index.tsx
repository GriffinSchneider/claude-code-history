#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { App } from './components/App.js';
import { resumeSession } from './lib/claude.js';

// Enter alternate screen buffer - this keeps all our rendering out of scrollback
// and restores the terminal to its previous state when we exit
process.stdout.write('\x1b[?1049h');

// Make sure we always exit alt screen on unexpected termination
const cleanup = () => {
  process.stdout.write('\x1b[?1006l'); // Disable SGR mouse mode
  process.stdout.write('\x1b[?1000l'); // Disable mouse tracking
  process.stdout.write('\x1b[?1049l'); // Exit alt screen
};
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

// Track if we're resuming a session after exit
let resumeSessionId: string | null = null;

const { waitUntilExit } = render(
  <App onResume={(sessionId) => { resumeSessionId = sessionId; }} />
);

// Wait for Ink to fully unmount, then spawn claude if resuming
await waitUntilExit();
cleanup();

if (resumeSessionId) {
  // Fully release stdin before spawning so there's no contention
  // (Ink's cleanup doesn't fully release the underlying stream)
  process.stdin.pause();
  process.stdin.removeAllListeners();
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    process.stdin.setRawMode(false);
  }
  process.stdin.destroy();

  resumeSession(resumeSessionId);
}
