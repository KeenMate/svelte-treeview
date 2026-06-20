# Accessibility

`@keenmate/svelte-treeview` follows the [WAI-ARIA Authoring Practices for tree views](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) for keyboard navigation, focus management, and selection semantics.

## Keyboard navigation

The tree is fully navigable from the keyboard. Focus the tree (`Tab` into it), then:

### Movement

| Key | Action |
|-----|--------|
| `ArrowDown` | Move focus to the next visible node |
| `ArrowUp` | Move focus to the previous visible node |
| `ArrowRight` | If collapsed, expand. If expanded, move focus to the first child. |
| `ArrowLeft` | If expanded, collapse. If collapsed, move focus to the parent. |
| `Backspace` | Collapse parent and focus it |
| `Home` | Focus the first visible node |
| `End` | Focus the last visible node |
| `PageDown` | Jump forward ~10 visible nodes |
| `PageUp` | Jump back ~10 visible nodes |

### Activation

| Key | Action |
|-----|--------|
| `Space` | Toggle expand/collapse of the focused node. If `shouldShowCheckboxes={true}` and the node is selectable, toggle its checkbox instead. |
| `Enter` | In `selectionMode='multi'`: toggle highlight on the focused node. In `'single'` mode: no-op (handled by the consumer's `onNodeClicked`). |

### Range highlight (`selectionMode='multi'`)

Hold `Shift` together with any movement key to extend the highlight range from the anchor (last clicked/focused node) to the new position. In `'single'` mode these are no-ops.

| Key | Action |
|-----|--------|
| `Shift+ArrowDown` | Extend highlight to the next visible node |
| `Shift+ArrowUp` | Extend highlight to the previous visible node |
| `Shift+Home` | Extend highlight to the first visible node |
| `Shift+End` | Extend highlight to the last visible node |
| `Shift+PageDown` | Extend highlight forward ~10 visible nodes |
| `Shift+PageUp` | Extend highlight back ~10 visible nodes |

### Pointer modifiers (`selectionMode='multi'`)

| Gesture | Action |
|---------|--------|
| Click | Move focus and replace highlight with the clicked node |
| `Ctrl+Click` | Toggle the clicked node's highlight (additive) |
| `Shift+Click` | Extend highlight from the anchor to the clicked node |

Ctrl/Shift+Click does **not** auto-toggle expand/collapse — modifier clicks are reserved for highlight management so multi-selecting folders doesn't open them.

### Context menu

| Key | Action |
|-----|--------|
| `Escape` | Close the open context menu |
| `<shortcut>` | Activate the menu item whose `shortcut` matches (supports `Ctrl+`, `Shift+`, `Alt+` modifiers) |

## Focus management

- The tree itself is a single tab stop. `Tab` into the tree, then use arrow keys to move between nodes — no per-node tab stop, as recommended by the WAI-ARIA pattern.
- The currently focused node is reflected on `controller.focusedNode` (bindable via the public API on the `TreeController`).
- A visible focus ring is rendered via `--stv-checkbox-focus-ring-*` tokens; override these CSS variables to match your design system's focus style.
- After `scrollToPath(path)`, the target node receives the configured `scrollHighlightClass` for `scrollHighlightTimeout` ms so screen-reader users and sighted users alike can locate the moved focus.

## Custom keydown handler

Override or augment the default keymap with `onTreeKeydown` — return `true` to suppress the built-in handling:

```svelte
<Tree
  {data}
  idMember="path"
  pathMember="path"
  onTreeKeydown={(event, controller) => {
    if (event.key === 'Delete' && controller.focusedNode) {
      controller.removeNode(controller.focusedNode.path);
      return true;  // suppress default
    }
    return false;  // let the tree handle it
  }}
/>
```

## Selection model

The tree exposes a three-level selection model — see [`docs/examples.md`](./examples.md) for a usage cookbook, and the rc09 notes in [`README.md`](../README.md#whats-new-in-v500-rc09) for the rationale:

- **Focus** (`focusedNode`) — the single node with keyboard cursor on it
- **Highlight** (`highlightedPaths: Set<string>`) — multi-selection set (Ctrl/Shift+click, Shift+Arrow)
- **Selection** (`selectedPaths: Set<string>`) — checkbox state when `shouldShowCheckboxes={true}`

When `shouldShowCheckboxes={false}`, highlight is mirrored into `selectedPaths` automatically — consumers always have a single "what's selected" set to read regardless of UI style.

## Screen reader semantics

The tree currently renders semantic HTML (`<ul>` / `<li>` / `<button>`) and relies on default browser semantics. **Explicit `role="tree"` / `role="treeitem"` ARIA wiring is not yet emitted** — if you need full WAI-ARIA tree semantics, wire them through `nodeTemplate` or open an issue for tracking.

## See also

- [WAI-ARIA Treeview pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)
- [`docs/examples.md`](./examples.md) — context menus, multi-select, drag & drop
- Source: keyboard handler — `src/lib/components/Tree.svelte` (`handleTreeKeydown`)
- Source: navigation primitives — `src/lib/core/navigation.ts` (`TreeNavigation` interface)
