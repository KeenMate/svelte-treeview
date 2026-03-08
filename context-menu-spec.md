# Unified Context Menu Specification

Shared type definitions for context menus across `@keenmate/svelte-treeview`, `@keenmate/svelte-treeview-canvas`, and `@keenmate/web-treeview`.

## Type Definitions

```typescript
interface ContextMenuDivider {
  divider: true;
  label?: string;  // named divider: ──── [label] ────
}

interface ContextMenuItem {
  id?: string;
  label: string;
  icon?: string;
  shortcut?: string;
  isDisabled?: boolean;
  isVisible?: boolean;       // false = skip rendering
  className?: string;        // e.g. "danger" for red styling
  onclick?: () => void | Promise<void>;
  children?: ContextMenuEntry[];  // nested submenus
}

type ContextMenuEntry = ContextMenuItem | ContextMenuDivider;
```

## Field Specification

### ContextMenuItem

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string?` | — | Optional identifier for the item |
| `label` | `string` | *required* | Display text |
| `icon` | `string?` | — | Emoji or text icon shown before label |
| `shortcut` | `string?` | — | Keyboard shortcut hint (right-aligned, muted) |
| `isDisabled` | `boolean?` | `false` | Grayed out, not clickable |
| `isVisible` | `boolean?` | `true` | `false` = skip rendering entirely |
| `className` | `string?` | — | CSS class applied to item (e.g. `"danger"`) |
| `onclick` | `() => void \| Promise<void>` | — | Click handler. Optional for parent items with `children` |
| `children` | `ContextMenuEntry[]?` | — | Nested submenu entries |

### ContextMenuDivider

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `divider` | `true` | *required* | Type discriminator |
| `label` | `string?` | — | Named divider: renders as `──── [label] ────` |

### Type Discrimination

Use `'divider' in entry` to distinguish dividers from items:

```typescript
if ('divider' in entry) {
  // ContextMenuDivider
} else {
  // ContextMenuItem
}
```

## Design Decisions

- **`divider: true` discriminator** instead of `type` field — less verbose, cleaner API
- **No dynamic callbacks on items** (e.g. `isDisabledCallback`) — the `contextMenuCallback(node)` function handles dynamic computation per-invocation
- **`className` replaces `danger` boolean** — more flexible, supports any CSS class
- **`isVisible` for callback approach** — Svelte snippet approach uses `{#if}` instead
- **`onclick` optional** — parent items with `children` may have no action
- **`label` instead of `title`** — matches web-treeview convention, more standard

## Migration Guide: web-treeview

| web-treeview (current) | Unified (new) | Notes |
|------------------------|---------------|-------|
| `label` | `label` | No change |
| `onclick` | `onclick` | No change |
| `disabled` | `isDisabled` | Renamed for consistency with svelte-treeview |
| `visible` | `isVisible` | Renamed for consistency |
| `danger` | `className="danger"` | More flexible — any CSS class |
| `dividerBefore: true` | Separate `{ divider: true }` entry | Explicit divider entry before the item |
| `children` | `children` | No change |
| `shortcut` | `shortcut` | No change |
| `icon` | `icon` | No change |
| `renderContextMenuItemCallback` | — | Web-component-specific, not part of unified spec |

### Example migration

**Before (web-treeview):**
```javascript
{
  label: 'Delete',
  icon: '🗑️',
  danger: true,
  disabled: item.readonly,
  dividerBefore: true,
  onclick: () => deleteItem(item)
}
```

**After (unified):**
```javascript
{ divider: true },  // explicit divider
{
  label: 'Delete',
  icon: '🗑️',
  className: 'danger',
  isDisabled: item.readonly,
  onclick: () => deleteItem(item)
}
```

Or with a named divider:
```javascript
{ divider: true, label: 'Danger zone' },
{
  label: 'Delete',
  icon: '🗑️',
  className: 'danger',
  isDisabled: item.readonly,
  onclick: () => deleteItem(item)
}
```

## Callback Signature

### svelte-treeview (callback approach)

```typescript
contextMenuCallback?: (
  node: LTreeNode<T>,
  closeMenuCallback: () => void
) => ContextMenuEntry[];
```

The `close` function is provided so items can close the menu after their action.

### canvas-tree

```typescript
onNodeContextMenu?: (node: LTreeNode<T>) => ContextMenuEntry[];
```

Canvas tree auto-closes on click, so `close` is not passed.

### web-treeview (future)

```javascript
treeview.contextMenuCallback = (node) => [/* ContextMenuEntry[] */];
```

Web component auto-closes on click. The `renderContextMenuItemCallback` for custom HTML rendering remains web-component-specific.

## CSS Classes

### svelte-treeview (HTML)

| Class | Description |
|-------|-------------|
| `.ltree-context-menu` | Menu container |
| `.ltree-context-menu-item` | Item row |
| `.ltree-context-menu-item-disabled` | Disabled state |
| `.ltree-context-menu-has-children` | Item with submenu |
| `.ltree-context-menu-icon` | Icon span |
| `.ltree-context-menu-label` | Label span |
| `.ltree-context-menu-shortcut` | Shortcut span (right-aligned) |
| `.ltree-context-menu-arrow` | Submenu arrow (▸) |
| `.ltree-context-menu-divider` | Divider container |
| `.ltree-context-menu-divider-label` | Named divider text |
| `.ltree-context-submenu` | Nested submenu container |
| `.danger` | Red-styled item |

### canvas-tree

Prefixed with `.canvas-tree-ctx-menu-*` following existing convention.

## Svelte Component API

For Svelte users, two exported components allow declarative context menus inside a snippet:

```svelte
<script>
  import { ContextMenuItemC, ContextMenuDividerC } from '@keenmate/svelte-treeview';
</script>

<Tree {data} ...>
  {#snippet contextMenu(node, close)}
    <ContextMenuItemC label="Copy" icon="📋" shortcut="C"
      onclick={() => { copy(node); close(); }} />
    <ContextMenuItemC label="Export As..." icon="📤">
      <ContextMenuItemC label="JSON" onclick={() => { exportAs(node, 'json'); close(); }} />
      <ContextMenuItemC label="XML" onclick={() => { exportAs(node, 'xml'); close(); }} />
    </ContextMenuItemC>
    <ContextMenuDividerC label="Danger zone" />
    <ContextMenuItemC label="Delete" className="danger"
      onclick={() => { del(node); close(); }} />
  {/snippet}
</Tree>
```

The `C` suffix distinguishes the Svelte component from the TypeScript interface of the same name. Users importing the type use `import type { ContextMenuItem }` while the component uses `import { ContextMenuItemC }`.
