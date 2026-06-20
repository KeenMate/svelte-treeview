# @keenmate/svelte-treeview

A high-performance, feature-rich hierarchical tree view component for Svelte 5 with drag & drop support, search functionality, and flexible data structures using LTree.

## What is it

`@keenmate/svelte-treeview` is a hierarchical tree-view component for Svelte 5 apps. It renders flat, path-keyed data (`"1"`, `"1.2"`, `"1.2.3"`) into an expandable tree with built-in drag & drop, three-level selection (focus / multi-highlight / checkboxes), context menus, integrated FlexSearch filtering, and virtual scrolling for 50,000+ nodes.

It's aimed at Svelte 5 developers building file browsers, org charts, navigation trees, settings dialogs, or any UI that displays hierarchical data. The core (data structure, expand/collapse, search, drag-and-drop logic) is decoupled from the renderer via `TreeProvider` + `TreeController`, so you can plug in custom HTML, Canvas, or SVG renderers on the same engine.

The component ships standalone with sensible light/dark defaults and integrates cleanly with [Pure Admin](https://pureadmin.io/) and the wider `@keenmate/*` design-token suite via the `--base-*` CSS variable contract.

## Live Demo

Browse interactive code examples and the full API reference at **[svelte-treeview.keenmate.dev](https://svelte-treeview.keenmate.dev)**

## What's New in v5.0.0-rc10

- **Built-in dark mode — all four canonical signals covered** — a `dark-mode.css` partial flips the tree's surface, text, border, and accent palette when any of the canonical signals is active: OS preference (`prefers-color-scheme: dark`), page `<html style="color-scheme: dark">` resolved via `light-dark()`, framework theme classes (`[data-theme="dark"]`, `[data-bs-theme="dark"]`, `.dark`), and the new per-instance `theme` prop. Symmetric `light` selectors let a single tree force light on an otherwise-dark page. Zero JavaScript — pure CSS resolution.
- **`theme` prop on `<Tree>` — per-instance dark/light override** — `'dark' | 'light' | null | undefined`. Forwarded to the root `.stv__container` as `data-theme`, where per-instance CSS selectors take over and beat ambient signals. Leave `undefined` to inherit from the page. (rc10 originally landed this on `.ltree-container`; the BEM rename to `.stv__container` shipped in rc12.)
- **CSS variables rescoped from `:root` to `.stv__container` — subtree theming actually works** — mirrors the `:host`-scoped pattern from sibling `@keenmate/*` components and is the only way `--base-*` theming flows at subtree scope. A wrapper around the tree that sets `--base-accent-color: red` now re-tints the tree (it previously had no effect because the substitution was frozen at `:root`). Multiple trees on the same page can be themed differently via wrapper-scoped `--base-*` overrides. Consumer note: setting `--stv-*` directly on a wrapper no longer cascades — use `--base-*` on the wrapper or target `.stv__container` explicitly.
- **`--stv-bg` — the tree paints its own surface** — `.stv__container` gets a `background: var(--stv-bg)` so consumers don't need to wrap the tree in a colored container for a visible surface. Override to `transparent` to restore the pre-rc10 layered behavior. Companion `--stv-elevated-bg` reads through the `--base-elevated-bg` chain for floating chrome (context menu).
- **CSS file layout aligned with the Bliss web-component guidelines** — all `_xxx.css` partials renamed to `xxx.css`, `main.css` now declares `@layer variables, component, overrides;` and imports each partial into the matching layer. Consumers' unlayered overrides automatically beat every rule in the library — no `!important` needed. Note: if your app ships an unlayered universal CSS reset (`* { padding: 0 }` from normalize / Bootstrap / Tailwind preflight / etc.), wrap it in a low-priority `@layer reset` or the tree's defaults won't apply.
- **`getIsDropAllowedCallback` prop + `getIsDraggableCallback` seeded at insert-time** — callback variant for `isDropAllowedMember`, matching the pattern rc09 introduced for `getIsExpandedCallback` / `getIsSelectableCallback` / `getIsSelectedCallback`. Also, the existing `getIsDraggableCallback` prop is now actually applied during the seed walk — previously it was only consumed lazily in some paths.
- **Bug fixes — virtual scroll + `clickBehavior='select'` double-click** — virtual scroll no longer gets stuck at bottom after a filter shrinks the tree. Double-click to expand in `clickBehavior='select'` mode finally works (the browser's native `dblclick` event couldn't fire because the first click destroyed the row via the focus re-render; the controller now detects the double manually).

## What's New in v5.0.0-rc09

- **Three-level selection model — focus / highlight / select** — new `selectionMode: 'single' | 'multi'` prop (default `'single'`) cleanly separates the **focused** node (cursor), the **highlighted** set (Ctrl/Shift+click range), and **selected** checkboxes. When `shouldShowCheckboxes` is off, highlight mirrors into `selectedPaths` automatically — so consumers always have a single "what's selected" set to read regardless of UI style. Programmatic `highlightNode` / `highlightNodes` / `clearHighlight` respect `{ silent: true }`.
- **Multi-drag — the whole highlight set moves together** — with `selectionMode='multi'`, Ctrl/Shift+click several rows and drag any one of them: the entire top-level-selected subset moves together. Descendants of highlighted ancestors ride along inside their subtree (not extracted). The set lands as siblings after/before/under `dropNode` in source order.
- **OS-explorer drag-start sync** — grabbing a non-highlighted node now replaces the highlight with just that node before the drag begins, matching Windows Explorer / macOS Finder. Previously the prior highlight stayed visually stuck while the drag silently carried only the grabbed node.
- **Keyboard convention reshuffle — Enter / Space / modifier clicks** — **Enter** now toggles highlight on the focused node (in `multi` mode); **Space** is the universal expand/collapse toggle (when no checkbox). Ctrl/Shift+click no longer auto-toggles expand/collapse — modifier clicks are reserved for highlight management so multi-selecting folders doesn't open them.
- **`shouldClickToggleCheckbox` prop — checkbox-first row click** — opt-in flag that makes a plain row click toggle the checkbox instead of focusing/highlighting, for checkbox-first UIs. Modified clicks still build the multi-highlight.
- **Full CSS-variable theming surface — `--stv-*` token chain on `--base-*`** — ~50 new `--stv-*` variables (typography, layout, toggle/checkbox/selection/drag-zone/context-menu state) on a `--base-*` token chain shared with other `@keenmate/*` web components. Set `--stv-primary` once and the hover tint, drag-zone background, focus ring, and danger menu hover all derive from it via `color-mix()`. New `--stv-rem` scales the whole component proportionally. Lucide SVG toggle icons replace the UTF-8 glyphs. (Originally shipped as `--ltree-*`; renamed to `--stv-*` in rc12.)
- **SCSS → pure CSS** — `main.scss` (1095 lines) split into eleven `_*.css` partials bundled by `lightningcss-cli` into `dist/styles.css`. `sass` removed from devDependencies. `./styles.scss` package export removed — switch to `./styles.css`.

> **Breaking changes** in this release include the `selectionMode='single'` default (Ctrl/Shift+click no longer auto-multi-selects without opt-in), `selectedPaths` becoming populated in no-checkbox trees (mirrored from highlight), removal of `lastHighlightedPath` / `isHighlightAnchor` / `--stv-*-rgb` (originally shipped as `--ltree-*-rgb`) / SCSS variable overrides, and `--stv-node-indent-per-level` now scaling with `--stv-rem` instead of document `rem`. See CHANGELOG for migration notes.

## v5.0: Core/Renderer Split + Virtual Scroll

> [!IMPORTANT]
> **In version 5, the tree core (data structure, expand/collapse, search, drag & drop logic) has been completely separated from the renderer.** The architecture is open for you to build your own custom renderers on top of the same core via `TreeProvider` and `TreeController`.

**Key changes in v5:**
- **Core/Renderer split**: Use the built-in HTML `Tree` renderer, or create custom visualizations (Canvas, WebGL, SVG) via `TreeProvider` + `TreeController`
- **Virtual scroll**: Render 50,000+ node trees smoothly with `isVirtualScrollEnabled={true}` — only ~50 DOM nodes at any time
- **Canvas companion**: For canvas rendering, install [`@keenmate/svelte-treeview-canvas`](https://github.com/keenmate/svelte-treeview-canvas)
- **Drop position naming**: `'above'`/`'below'` renamed to `'before'`/`'after'` (CSS classes and events updated accordingly)

### Rendering Modes

| Mode | Props | DOM Nodes | Best For |
|------|-------|-----------|----------|
| Recursive | `isFlatRenderingEnabled={false}` | All | Small trees (<100 nodes) |
| Flat (default) | `isFlatRenderingEnabled={true}` | All | Medium trees (100–10K) |
| Virtual | `isVirtualScrollEnabled={true}` | ~50 | Large trees (10K+) |

```svelte
<!-- Virtual scroll for large trees -->
<Tree {data} isVirtualScrollEnabled={true} virtualContainerHeight="500px" />

<!-- Flat mode (default) with progressive batching -->
<Tree {data} isProgressiveRender={true} initialBatchSize={20} maxBatchSize={500} />
```

## Features

- **Svelte 5 Native**: Built specifically for Svelte 5 with full support for runes and modern Svelte patterns
- **High Performance**: Flat rendering with progressive loading, virtual scroll for 50,000+ nodes
- **Drag & Drop**: Built-in drag and drop with position control (before/after/child), touch support, and async validation
- **Tree Editing**: Built-in methods for add, move, remove operations with automatic path management
- **Search & Filter**: Integrated FlexSearch for fast, full-text search capabilities
- **Flexible Data Sources**: Works with any hierarchical data structure
- **Multi-Select**: Ctrl+click toggle, Shift+click range select (visual or logical mode), `selectedPaths` bindable, selection-aware context menus
- **Context Menus**: Dynamic right-click menus with shortcuts, submenus, named dividers, and two API approaches (callback or Svelte components)
- **Visual Customization**: Extensive styling options and icon customization
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions
- **Accessibility**: Built with accessibility in mind

## Installation

```bash
npm install @keenmate/svelte-treeview
```

### Importing Styles

The component requires CSS to display correctly. Import the styles in your app:

**JavaScript import** (in your main.js/main.ts or Vite/Webpack entry):
```javascript
import '@keenmate/svelte-treeview/styles.css';
```

**Svelte component import:**
```svelte
<style>
  @import '@keenmate/svelte-treeview/styles.css';
</style>
```

## Quick Start

```svelte
<script lang="ts">
  import { Tree } from '@keenmate/svelte-treeview';

  const data = [
    { path: '1', name: 'Documents', type: 'folder' },
    { path: '1.1', name: 'Projects', type: 'folder' },
    { path: '1.1.1', name: 'Project A', type: 'folder' },
    { path: '1.1.2', name: 'Project B', type: 'folder' },
    { path: '2', name: 'Pictures', type: 'folder' },
    { path: '2.1', name: 'Vacation', type: 'folder' }
  ];
</script>

<Tree
  {data}
  idMember="path"
  pathMember="path"
  displayValueMember="name"
/>
```

> [!TIP]
> **Performance tip:** When passing large arrays (1000+ items) to the Tree component, use `$state.raw()` instead of `$state()` to avoid severe performance issues. Svelte 5's `$state()` creates deep proxies — with thousands of items this causes up to 5,000x slowdown. The array itself remains reactive; only individual items lose deep reactivity (which Tree doesn't need).
> ```typescript
> // BAD - Each item becomes a Proxy
> let treeData = $state<TreeNode[]>([])
>
> // GOOD - Items remain plain objects
> let treeData = $state.raw<TreeNode[]>([])
> ```

## Demos & docs

- 🚀 [Live demo](https://svelte-treeview.keenmate.dev) — interactive examples and the full feature gallery
- 📘 [Usage / API reference](./docs/usage.md) — every Prop, Method, Event, and Snippet
- 🎨 [Theming contract](./docs/theming.md) — `--base-*` tokens, `--stv-*` variables, dark mode, cascade layers
- 📚 [Examples / cookbook](./docs/examples.md) — node templates, search, drag & drop, tree editing, context menus
- ♿ [Accessibility](./docs/accessibility.md) — keyboard navigation, focus management, selection model
- 📒 [Release history](./CHANGELOG.md)

## Data Structure

The component expects hierarchical data with path-based organization:

```typescript
interface NodeData {
  path: string;          // e.g., "1.2.3" for hierarchical positioning
  // ... your custom properties
}
```

### Path Examples

- Root level: `"1"`, `"2"`, `"3"`
- Second level: `"1.1"`, `"1.2"`, `"2.1"`
- Third level: `"1.1.1"`, `"1.2.1"`, `"2.1.1"`

### Sorting Requirements

**Important:** For proper tree construction, your `sortCallback` must sort by **level first** to ensure parent nodes are inserted before their children:

```typescript
const sortCallback = (items: LTreeNode<T>[]) => {
  return items.sort((a, b) => {
    // First, sort by level (shallower levels first)
    const aLevel = a.path.split('.').length;
    const bLevel = b.path.split('.').length;
    if (aLevel !== bLevel) {
      return aLevel - bLevel;
    }

    // Then sort by your custom criteria
    return (a.data?.name ?? '').localeCompare(b.data?.name ?? '');
  });
};
```

**Why this matters:** If deeper level nodes are processed before their parents, you'll get "Could not find parent node" errors during tree construction. Level-first sorting ensures hierarchical integrity and enables progressive rendering for large datasets.

### Insert Result Information

The tree provides detailed information about data insertion through the `insertResult` bindable property:

```typescript
interface InsertArrayResult<T> {
  successful: number;     // Number of nodes successfully inserted
  failed: Array<{        // Nodes that failed to insert
    node: LTreeNode<T>;  // The processed tree node
    originalData: T;     // The original data object
    error: string;       // Error message (usually "Could not find parent...")
  }>;
  total: number;         // Total number of nodes processed
}
```

#### Usage Example

```svelte
<script lang="ts">
  import { Tree } from '@keenmate/svelte-treeview';

  let insertResult = $state();

  const data = [
    { id: '1', path: '1', name: 'Root' },
    { id: '1.2', path: '1.2', name: 'Child' },    // Missing parent "1.1"
    { id: '1.1.1', path: '1.1.1', name: 'Deep' } // Missing parent "1.1"
  ];

  // Check results after tree processes data
  $effect(() => {
    if (insertResult) {
      console.log(`${insertResult.successful} nodes inserted successfully`);
      console.log(`${insertResult.failed.length} nodes failed to insert`);

      insertResult.failed.forEach(failure => {
        console.log(`Failed: ${failure.originalData.name} - ${failure.error}`);
      });
    }
  });
</script>

<Tree
  {data}
  idMember="id"
  pathMember="path"
  displayValueMember="name"
  bind:insertResult
/>
```

#### Benefits

- **Data Validation**: Identify missing parent nodes in hierarchical data
- **Debugging**: Clear error messages with node paths like "Node: 1.1.1 - Could not find parent node: 1.1"
- **Data Integrity**: Handle incomplete datasets gracefully
- **Search Accuracy**: Failed nodes are excluded from search index, ensuring search results match visible tree
- **User Feedback**: Inform users about data issues with detailed failure information

## Performance

The component is optimized for large datasets:

- **Virtual Scroll**: Renders only visible rows (~50 DOM nodes) for trees with 50,000+ nodes
- **Flat Rendering Mode**: Single `{#each}` loop instead of recursive components (default, ~12x faster initial render)
- **Progressive Rendering**: Batched rendering prevents UI freeze during initial load
- **Async Search Indexing**: Uses `requestIdleCallback` for non-blocking search index building
- **LTree**: Efficient hierarchical data structure with FlexSearch integration

### Performance Benchmarks (5500 nodes)

| Operation | Time |
|-----------|------|
| Initial render (flat) | ~25ms |
| Initial render (virtual) | ~5ms |
| Expand/collapse | ~100-150ms |
| Search filtering | <50ms |
| insertArray | <100ms |

### Virtual Scroll

For trees with 10,000+ nodes, enable virtual scroll to keep DOM size constant:

```svelte
<Tree
  {data}
  isVirtualScrollEnabled={true}
  virtualContainerHeight="500px"
  virtualOverscan={5}
/>
```

Virtual scroll auto-measures row height from the first rendered node. Override with `virtualRowHeight={32}` if needed. Requires flat rendering mode (the default).

### Performance Logging

Built-in performance measurement for debugging:
```typescript
import { enablePerfLogging } from '@keenmate/svelte-treeview';
enablePerfLogging();

// Or from browser console:
window.components['svelte-treeview'].perf.enable()
```

**Important**: See the [$state.raw() tip](#quick-start) above - using `$state()` instead of `$state.raw()` for tree data can cause 5,000x slowdown!

## CanvasTree (Canvas-Based Rendering)

Canvas rendering is available as a separate companion package: [`@keenmate/svelte-treeview-canvas`](https://github.com/keenmate/svelte-treeview-canvas)

It renders trees on HTML5 Canvas for high-performance visualization with multiple layout modes (tree, balanced, fishbone, radial, box), keyboard navigation, drag & drop, and custom node rendering. Install it separately:

```bash
npm install @keenmate/svelte-treeview-canvas
```

## Development Setup & Contributing

For developers working on the project, you can use either standard npm commands or the provided Makefile:

```bash
# Using Makefile (recommended for consistency)
make setup      # or make install
make dev

# Or using standard npm commands
npm install
npm run dev
```

We welcome contributions! Please see our contributing guidelines for details.

> **For AI Agents / LLMs**: Comprehensive documentation is available in the `ai/` folder with topic-specific files (basic-setup.txt, drag-drop.txt, performance.txt, etc.). Start with `ai/INDEX.txt` for navigation.

## About

Authored and maintained by [KeenMate](https://keenmate.com/).
The component ships standalone with sensible light/dark defaults;
when mounted inside [Pure Admin](https://pureadmin.io/) — or any
host that publishes the `--base-*` taxonomy via
[`@keenmate/theme-designer`](https://www.npmjs.com/package/@keenmate/theme-designer) — it adopts the host's colors,
typography, and sizing automatically. There is no runtime
dependency on Pure Admin; the integration is opt-in via CSS
variables.

## Built with BlissFramework

Follows the [BlissFramework component guidelines](https://blissframework.dev/)
for structure, theming, color-scheme, and accessibility.

## License

MIT License - see LICENSE file for details.

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/keenmate/svelte-treeview/issues)
- **Live demo & docs**: [svelte-treeview.keenmate.dev](https://svelte-treeview.keenmate.dev)

---

Built with ❤️ by [KeenMate](https://github.com/keenmate)
