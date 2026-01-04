#!/usr/bin/env node

import { createCliRenderer, TerminalColors } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { App } from './components/App.js';
import { resumeSession } from './lib/claude.js';

export interface DefinitePalette {
  defaultForeground: string;
  defaultBackground: string;
  cursorColor: string;
  mouseForeground: string;
  mouseBackground: string;
  tekForeground: string;
  tekBackground: string;
  highlightBackground: string;
  highlightForeground: string;

  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;

  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

function paletteToDefinitePalette(palette: TerminalColors): DefinitePalette {
  return {
    defaultForeground: palette.defaultForeground ?? '#FFFFFF',
    defaultBackground: palette.defaultBackground ?? '#000000',
    cursorColor: palette.cursorColor ?? '#FFFFFF',
    mouseForeground: palette.mouseForeground ?? '#FFFFFF',
    mouseBackground: palette.mouseBackground ?? '#000000',
    tekForeground: palette.tekForeground ?? '#FFFFFF',
    tekBackground: palette.tekBackground ?? '#000000',
    highlightBackground: palette.highlightBackground ?? '#000000',
    highlightForeground: palette.highlightForeground ?? '#FFFFFF',

    black: palette.palette[0] ?? 'black',
    red: palette.palette[1] ?? 'red',
    green: palette.palette[2] ?? 'green',
    yellow: palette.palette[3] ?? 'yellow',
    blue: palette.palette[4] ?? 'blue',
    magenta: palette.palette[5] ?? 'magenta',
    cyan: palette.palette[6] ?? 'cyan',
    white: palette.palette[7] ?? 'white',

    brightBlack: palette.palette[8] ?? 'brightblack',
    brightRed: palette.palette[9] ?? 'brightred',
    brightGreen: palette.palette[10] ?? 'brightgreen',
    brightYellow: palette.palette[11] ?? 'brightyellow',
    brightBlue: palette.palette[12] ?? 'brightblue',
    brightMagenta: palette.palette[13] ?? 'brightmagenta',
    brightCyan: palette.palette[14] ?? 'brightcyan',
    brightWhite: palette.palette[15] ?? 'brightwhite',
  };
}

async function main() {
  const renderer = await createCliRenderer({
    useAlternateScreen: true,
  });
  
  const root = createRoot(renderer);

  const _palette = await renderer.getPalette();
  const palette = paletteToDefinitePalette(_palette);

  root.render(
    <App
      palette={palette}
      onResume={(sessionId) => {
        renderer.destroy();
        resumeSession(sessionId);
      }}
      onQuit={() => {
        renderer.destroy();
      }}
    />
  );

  process.on('SIGINT', () => {
    renderer.destroy();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    renderer.destroy();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
