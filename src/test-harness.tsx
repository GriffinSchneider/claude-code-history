/**
 * Visual testing harness for the Claude History TUI.
 *
 * Uses OpenTUI's built-in test utilities for headless rendering and input simulation.
 *
 * Usage (programmatic):
 *   const harness = await createHarness({ width: 80, height: 24 });
 *   await harness.pressKey('j');
 *   await harness.pressKey('j');
 *   await harness.pressKey('RETURN');
 *   const screen = harness.capture();
 *   await harness.screenshot('test-output.txt');
 *   harness.destroy();
 *
 * Usage (CLI):
 *   bun src/test-harness.ts -k "jj" -k RETURN -o screenshot.txt
 */

import { testRender } from "@opentui/react/test-utils";
import { KeyCodes, type MockInput } from "@opentui/core/testing";
import { writeFile } from "fs/promises";
import { App } from "./components/App";
import type { DefinitePalette } from "./index";

export { KeyCodes };

/** Default palette for testing (basic terminal colors) */
const DEFAULT_PALETTE: DefinitePalette = {
  defaultForeground: '#FFFFFF',
  defaultBackground: '#000000',
  cursorColor: '#FFFFFF',
  mouseForeground: '#FFFFFF',
  mouseBackground: '#000000',
  tekForeground: '#FFFFFF',
  tekBackground: '#000000',
  highlightBackground: '#000000',
  highlightForeground: '#FFFFFF',
  black: '#000000',
  red: '#CC0000',
  green: '#00CC00',
  yellow: '#CCCC00',
  blue: '#0000CC',
  magenta: '#CC00CC',
  cyan: '#00CCCC',
  white: '#CCCCCC',
  brightBlack: '#666666',
  brightRed: '#FF0000',
  brightGreen: '#00FF00',
  brightYellow: '#FFFF00',
  brightBlue: '#0000FF',
  brightMagenta: '#FF00FF',
  brightCyan: '#00FFFF',
  brightWhite: '#FFFFFF',
};

export interface HarnessOptions {
  /** Terminal width (default: 80) */
  width?: number;
  /** Terminal height (default: 24) */
  height?: number;
  /** Milliseconds to wait after actions for screen to settle (default: 50) */
  settleTime?: number;
}

export interface Harness {
  /** Send a key press. Use KeyCodes.* for special keys or single chars for letters. */
  pressKey: (key: string) => Promise<void>;
  /** Send multiple key presses in sequence */
  pressKeys: (keys: string[]) => Promise<void>;
  /** Capture current screen as plain text */
  capture: () => string;
  /** Capture and save to file */
  screenshot: (filePath: string) => Promise<void>;
  /** Resize the terminal */
  resize: (width: number, height: number) => void;
  /** Clean up */
  destroy: () => void;
  /** The raw mockInput for advanced usage */
  mockInput: MockInput;
}

export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
  const width = options.width ?? 80;
  const height = options.height ?? 24;
  const settleTime = options.settleTime ?? 50;

  const testSetup = await testRender(<App palette={DEFAULT_PALETTE} />, {
    width,
    height,
  });

  const { mockInput, captureCharFrame, resize, renderer } = testSetup;

  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, settleTime));

  // Do initial render
  await testSetup.renderOnce();
  await settle();

  return {
    async pressKey(key: string) {
      // Check if it's a KeyCodes constant name
      if (key in KeyCodes) {
        mockInput.pressKey(key as keyof typeof KeyCodes);
      } else {
        // Single character
        mockInput.pressKey(key);
      }
      await testSetup.renderOnce();
      await settle();
    },

    async pressKeys(keys: string[]) {
      for (const key of keys) {
        if (key in KeyCodes) {
          mockInput.pressKey(key as keyof typeof KeyCodes);
        } else {
          mockInput.pressKey(key);
        }
      }
      await testSetup.renderOnce();
      await settle();
    },

    capture() {
      return captureCharFrame();
    },

    async screenshot(filePath: string) {
      const content = captureCharFrame();
      await writeFile(filePath, content + "\n", "utf-8");
    },

    resize(w: number, h: number) {
      resize(w, h);
    },

    destroy() {
      renderer.destroy();
    },

    mockInput,
  };
}

// ============ CLI ============

async function runCli() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
visual-test - Capture TUI screenshots for testing

Usage:
  bun src/test-harness.ts [options]

Options:
  -k, --key <key>       Key to press (can be used multiple times)
                        Use KeyCode names for special keys: RETURN, ESCAPE,
                        ARROW_UP, ARROW_DOWN, TAB, BACKSPACE, etc.
  -o, --output <file>   Output file for screenshot (default: stdout)
  -w, --width <n>       Terminal width (default: 80)
  -h, --height <n>      Terminal height (default: 24)
  --settle <ms>         Settle time in ms (default: 50)
  --help                Show this help

Available KeyCode names:
  RETURN, LINEFEED, TAB, BACKSPACE, DELETE, HOME, END, ESCAPE
  ARROW_UP, ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT
  F1-F12

Examples:
  # Capture initial screen
  bun src/test-harness.ts -o initial.txt

  # Navigate down 3 items and press enter
  bun src/test-harness.ts -k j -k j -k j -k RETURN -o after-nav.txt

  # Just print to stdout
  bun src/test-harness.ts -k j -k j
`);
    process.exit(0);
  }

  // Collect all -k/--key arguments
  const keys: string[] = [];
  let output: string | undefined;
  let width = 80;
  let height = 24;
  let settleTime = 50;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    if ((arg === "-k" || arg === "--key") && next) {
      keys.push(next);
      i++;
    } else if ((arg === "-o" || arg === "--output") && next) {
      output = next;
      i++;
    } else if ((arg === "-w" || arg === "--width") && next) {
      width = parseInt(next, 10);
      i++;
    } else if (arg === "--height" && next) {
      height = parseInt(next, 10);
      i++;
    } else if (arg === "--settle" && next) {
      settleTime = parseInt(next, 10);
      i++;
    }
  }

  const harness = await createHarness({ width, height, settleTime });

  try {
    // Press each key
    for (const key of keys) {
      await harness.pressKey(key);
    }

    const screenshot = harness.capture();

    if (output) {
      await harness.screenshot(output);
      console.log(`Screenshot saved to ${output}`);
    } else {
      console.log(screenshot);
    }
  } finally {
    harness.destroy();
  }
}

// Run CLI if this is the main module
const isMain = import.meta.url === `file://${process.argv[1]}` ||
               process.argv[1]?.endsWith("test-harness.tsx");

if (isMain) {
  runCli().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
}
