#!/usr/bin/env node

import React from 'react';
import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { App } from './components/App.js';
import { resumeSession } from './lib/claude.js';

// Track if we're resuming a session after exit
let resumeSessionId: string | null = null;

async function main() {
  const renderer = await createCliRenderer({
    useAlternateScreen: true,
  });

  const root = createRoot(renderer);

  root.render(
    <App
      onResume={(sessionId) => {
        resumeSessionId = sessionId;
        root.unmount();
        renderer.destroy();
      }}
      onQuit={() => {
        root.unmount();
        renderer.destroy();
      }}
    />
  );

  // Handle cleanup on process exit
  const cleanup = () => {
    root.unmount();
    renderer.destroy();
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  // Wait for renderer to be destroyed (either via quit or resume)
  await new Promise<void>((resolve) => {
    const checkDestroyed = setInterval(() => {
      if (!renderer.isRunning) {
        clearInterval(checkDestroyed);
        resolve();
      }
    }, 100);
  });

  if (resumeSessionId) {
    // Fully release stdin before spawning so there's no contention
    process.stdin.pause();
    process.stdin.removeAllListeners();
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }

    resumeSession(resumeSessionId);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
