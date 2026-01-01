# Agent Notes

## OpenTUI Layout Gotchas

### Loading State Structure Must Match Main Render Structure

When a component has a loading state that returns early with a different JSX structure, the terminal rendering can leave artifacts when transitioning to the main render.

**Bad:**
```tsx
if (loading) {
  return (
    <box flexDirection="column" padding={1}>
      <text>Loading...</text>
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

The `padding={1}` in loading state adds top padding. When transitioning to the main render (which has no top padding), the terminal may not properly clear that space, leaving a blank line at the top.

**Good:**
```tsx
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

Match the outer structure between loading and main states to avoid rendering artifacts.

### flexGrow Can Crush Siblings Without Explicit Heights

When using `flexGrow={1}` on a content container, sibling elements (like headers) may get crushed to zero height unless they have explicit `height` values or the parent constrains the layout properly.

### flexDirection="row" May Be Required for Text to Render

A `<box>` containing `<text>` may need `flexDirection="row"` for the text to render properly. Without it, the text might not appear.
