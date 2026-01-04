# Agent Notes



## Visual Testing Harness

`src/test-harness.tsx` provides headless rendering and screenshot capture for the TUI. Use this to verify UI changes without manually running the app.

### CLI Usage

```bash
# Capture initial list view (use --settle to wait for async data loading)
bun src/test-harness.tsx --settle 500 -o list.txt

# Navigate down 2 items and enter detail view
bun src/test-harness.tsx --settle 500 -k j -k j -k RETURN -o detail.txt

# Print to stdout instead of file
bun src/test-harness.tsx --settle 500 -k j -k j
```

### Key Names

Use these for special keys: `RETURN`, `ESCAPE`, `TAB`, `BACKSPACE`, `DELETE`, `HOME`, `END`, `ARROW_UP`, `ARROW_DOWN`, `ARROW_LEFT`, `ARROW_RIGHT`, `F1`-`F12`

Regular characters work as-is: `-k j`, `-k q`, `-k /`

### Programmatic API

```typescript
import { createHarness } from './test-harness';

const harness = await createHarness({ width: 80, height: 24, settleTime: 500 });
await harness.pressKey('j');
await harness.pressKey('RETURN');
const screen = harness.capture();  // plain text, no ANSI
await harness.screenshot('out.txt');
harness.destroy();
```

### Notes

- `--settle` time needs to be long enough for conversation data to load (~500ms)
- Output is plain text matching what would appear on screen



## OpenTUI Layout Gotchas

### Loading State Structure Must Match Main Render

Match outer JSX structure between loading and main states to avoid rendering artifacts:

```tsx
// Both states should have the same outer structure
if (loading) {
  return (
    <box flexDirection="column" flexGrow={1}>
      <box paddingLeft={1} paddingRight={1} flexDirection="row">
        <text>Loading...</text>
      </box>
    </box>
  );
}

return (
  <box flexDirection="column" flexGrow={1}>
    <box paddingLeft={1} paddingRight={1} flexDirection="row">
      <text>Title</text>
    </box>
    ...
  </box>
);
```

### flexGrow Can Crush Siblings

When using `flexGrow={1}`, sibling elements may get crushed to zero height unless they have explicit `height` values.

### flexDirection="row" May Be Required for Text

A `<box>` containing `<text>` may need `flexDirection="row"` for the text to render.

### Scrolling with Variable-Height Items

```tsx
const LARGE_HEIGHT = 10000;

// Store node refs, read .height live (don't cache - see below)
const itemRefs = useRef<Map<number, { height: number }>>(new Map());
const refCallbacks = useRef<Map<number, (node: any) => void>>(new Map());

const getRef = useCallback((index: number) => {
  let callback = refCallbacks.current.get(index);
  if (!callback) {
    callback = (node: { height: number } | null) => {
      if (node) itemRefs.current.set(index, node);
      else itemRefs.current.delete(index);
    };
    refCallbacks.current.set(index, callback);
  }
  return callback;
}, []);

const getItemHeight = (index: number) => itemRefs.current.get(index)?.height ?? 1;
const getItemY = (index: number) => {
  let y = 0;
  for (let i = 0; i < index; i++) y += getItemHeight(i);
  return y;
};

return (
  <box flexDirection="column" flexGrow={1} overflow="hidden">
    <box flexDirection="column" height={Math.max(LARGE_HEIGHT, getItemY(items.length))} marginTop={-scrollY}>
      {items.map((item, i) => (
        <box key={`${i}-${item.collapsed}`} ref={getRef(i)} flexDirection="row">
          {/* content */}
        </box>
      ))}
    </box>
  </box>
);
```

**Key points:**
- Inner container needs large `height` so Yoga can compute natural heights
- Store node refs, read `.height` live - **don't cache heights** (see next section)
- Change `key` when content changes to force remount/remeasure
- Clear `refCallbacks.current.delete(index)` on content change

### Don't Cache Heights from Ref Callbacks

When ref callbacks run, Yoga hasn't finished layout - `node.height` is 0. If you cache it, you get zeros forever.

```tsx
// BAD - captures 0
const [heights, setHeights] = useState<Map<number, number>>(new Map());
const getRef = (i: number) => (node) => {
  if (node) setHeights(prev => new Map(prev).set(i, node.height));
};

// GOOD - read live
const itemRefs = useRef<Map<number, { height: number }>>(new Map());
const getRef = (i: number) => (node) => {
  if (node) itemRefs.current.set(i, node);
};
const getHeight = (i: number) => itemRefs.current.get(i)?.height ?? 1;
```

The node's `.height` property is live - store the node, not the height.

### Debugging Layout Issues

If content collapses onto one line:
1. **Not enough height on scroll container** - Yoga needs room to compute natural heights
2. **Malformed content** - check JSX/data structure
3. **Race condition** - async data + layout timing

Create a minimal reproduction with static data to isolate layout vs data issues.

### Text Height May Be Off-by-One

Markdown/text blocks may report height 1 line short. Use `paddingBottom={1}` on items to compensate.
