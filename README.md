# @keenmate/svelte-treeview

A high-performance, feature-rich hierarchical tree view component for Svelte 5 with drag & drop support, search functionality, and flexible data structures using LTree.

## What is it

`@keenmate/svelte-treeview` is a hierarchical tree-view component for Svelte 5 apps. It renders flat, path-keyed data (`"1"`, `"1.2"`, `"1.2.3"`) into an expandable tree with built-in drag & drop, three-level selection (focus / multi-highlight / checkboxes), context menus, integrated FlexSearch filtering, and virtual scrolling for 50,000+ nodes.

It's aimed at Svelte 5 developers building file browsers, org charts, navigation trees, settings dialogs, or any UI that displays hierarchical data. The core (data structure, expand/collapse, search, drag-and-drop logic) is decoupled from the renderer via `TreeProvider` + `TreeController`, so you can plug in custom HTML, Canvas, or SVG renderers on the same engine.

The component ships standalone with sensible light/dark defaults and integrates cleanly with [Pure Admin](https://pureadmin.io/) and the wider `@keenmate/*` design-token suite via the `--base-*` CSS variable contract.

### How it differs from `@keenmate/web-treeview`

There's a vanilla-TypeScript sibling — [`@keenmate/web-treeview`](https://github.com/KeenMate/web-treeview) — built on the same LTree path-based engine. Same logical tree, different DOM strategy. Neither is "more mature"; they target different priorities.

| | svelte-treeview | web-treeview |
|---|---|---|
| Framework | Svelte 5 | Vanilla TS web component |
| Rendering modes | Recursive (default) + flat | Flat only |
| Children DOM | `.stv__children` wrapper (recursive mode) | None — siblings under `.wtv__tree` |
| Indent math | `level × indent` | `(level − 1) × indent` (root at zero offset) |
| Virtual scroll | Flat mode only | Built-in (three-div spacer / `translateY`) |
| Label markup | `<span class="stv__node-label">` by default — replace via `nodeTemplate` snippet | `<span class="wtv__node-label">` by default — replace via `renderNodeCallback` |
| Checkbox | `<label>` + custom `.stv__checkbox-box` span | Bare native `<input type="checkbox">` |
| Update mechanism | Svelte 5 runes + per-node `_rev` keyed `{#each}` | Imperative reconciler diffing `data-rev` / `data-expanded` attributes |

svelte-treeview is broader (two rendering modes, easier vertical guide lines via `.stv__children`); web-treeview is purpose-built for virtual scrolling over large datasets with a flatter DOM.

## Live Demo

Browse interactive code examples and the full API reference at **[svelte-treeview.keenmate.dev](https://svelte-treeview.keenmate.dev)**

## What's New in v5.0.0-rc11

- **Selection model — three symmetric imperative families (highlight / select / focus)** — The imperative API had drifted into aliases and asymmetries: `selectNode`/`selectNodes` secretly drove the *highlight* set, the highlight set cleared with `clearHighlight()` while checkboxes cleared with `deselectAll()`, and `highlightNodes()` silently replaced rather than added. The surface is now three concerns × one shape — **highlight** (`highlightNode`/`highlightNodes`/`setHighlightedPaths`/`highlightAll`/`clearHighlight`) for the UI multi-select set, **select** (`selectNode`/`selectNodes`/`setSelectedPaths`/`selectAll`/`deselectNode`/`clearSelection`) for the checkbox set, and **focus** (`focusNode`/`clearFocus`) for the single cursor. Two shared types, `HighlightMode` and `TreeMutationOptions { silent? }`, replace the inline literals. Breaking within the RC: `deselectAll` → `clearSelection`, `highlightNodes` is now additive, and `selectNode`/`selectNodes` are now real checkbox setters.
- **CSS — BEM rename (`ltree` → `stv`) and `is*/should*` boolean props** — Every class and variable now follows the BlissFramework BEM rule with the registered `stv` prefix: `--ltree-*` → `--stv-*`, `.ltree-node` → `.stv__node`, state classes as modifiers (`.stv__node-content--drag-over`), and the highlight family folded in (`.stv__node-content--highlight-bold`). Ten ambiguous boolean props were renamed to read as predicates — `showCheckboxes` → `shouldShowCheckboxes`, `virtualScroll` → `isVirtualScrollEnabled`, `allowCopy` → `isCopyAllowed`, and so on. No aliases — within the RC cycle consumers search-and-replace each prop and CSS selector.
- **Theming — dark mode rewritten to Strategy B (`color-scheme` + `light-dark()`)** — `dark-mode.css` collapsed from ~140 lines of per-token redeclaration to ~45 lines that flip `color-scheme` on the framework-theme and per-instance selectors, letting the `light-dark(<light>, <dark>)` fallbacks in `variables.css` resolve the dark branch automatically. Consumer `--base-*` overrides now survive the dark branch instead of being clobbered by hardcoded literals, and adding a new themeable variable no longer means touching every signal block.
- **Highlight & focus styling — marker is a fallback, not a fighter, plus a new glow flavor** — The always-on `.stv__node-content--highlighted` marker used to paint its default background *underneath* any configured `highlightedNodeClass`, so picking "Bold" showed bold text over the marker tint. It's now applied only when no highlight class is set, so a configured class is the sole source of styling — no `!important` needed. `.stv__node-content--focused` became a pure hook (no default outline, honoring the demo's "None" option), and a fifth built-in highlight flavor `--highlight-glow` (a soft accent ring) joined bold/border/brackets/fill.
- **Drag & drop — pinned nodes are respected, copied/added nodes behave** — Three correctness fixes: multi-drag now filters out locked (`isDraggable=false`) nodes that merely happen to be in the highlight set instead of dragging them along; `addNode` (and therefore `copyNodeWithDescendants`) now seeds per-node flags from the `getIs*Callback`/`*Member` props, so nodes dropped into a second tree are no longer frozen non-draggable and drop-rejecting; and desktop drag-drop now honors `node.isDropAllowed` (previously only the touch path did). Covered by new vitest + Playwright regression suites.
- **Context menus — positioning ported to `@floating-ui/dom`** — Root menu and submenus are now placed by `computePosition` + `autoUpdate` with `flip()`/`shift()` instead of raw inline `left/top` and CSS `:hover`, so menus flip above the cursor near the viewport bottom and submenus slide sideways instead of clipping. `contextMenuXOffset`/`contextMenuYOffset` keep their exact semantics.
- **Docs — README cut to ~350 lines with topical docs split out** — The README dropped from 1103 to 347 lines: Advanced Usage, Styling, and API Reference moved into `docs/usage.md`, `docs/theming.md`, `docs/examples.md`, and `docs/accessibility.md`, with a new intro and a Demos & docs link block up top.

## What's New in v5.0.0-rc10

- **Built-in dark mode — all four canonical signals covered** — a `dark-mode.css` partial flips the tree's surface, text, border, and accent palette when any of the canonical signals is active: OS preference (`prefers-color-scheme: dark`), page `<html style="color-scheme: dark">` resolved via `light-dark()`, framework theme classes (`[data-theme="dark"]`, `[data-bs-theme="dark"]`, `.dark`), and the new per-instance `theme` prop. Symmetric `light` selectors let a single tree force light on an otherwise-dark page. Zero JavaScript — pure CSS resolution.
- **`theme` prop on `<Tree>` — per-instance dark/light override** — `'dark' | 'light' | null | undefined`. Forwarded to the root `.stv__container` as `data-theme`, where per-instance CSS selectors take over and beat ambient signals. Leave `undefined` to inherit from the page. (rc10 originally landed this on `.ltree-container`; the BEM rename to `.stv__container` shipped in rc12.)
- **CSS variables rescoped from `:root` to `.stv__container` — subtree theming actually works** — mirrors the `:host`-scoped pattern from sibling `@keenmate/*` components and is the only way `--base-*` theming flows at subtree scope. A wrapper around the tree that sets `--base-accent-color: red` now re-tints the tree (it previously had no effect because the substitution was frozen at `:root`). Multiple trees on the same page can be themed differently via wrapper-scoped `--base-*` overrides. Consumer note: setting `--stv-*` directly on a wrapper no longer cascades — use `--base-*` on the wrapper or target `.stv__container` explicitly.
- **`--stv-bg` — the tree paints its own surface** — `.stv__container` gets a `background: var(--stv-bg)` so consumers don't need to wrap the tree in a colored container for a visible surface. Override to `transparent` to restore the pre-rc10 layered behavior. Companion `--stv-elevated-bg` reads through the `--base-elevated-bg` chain for floating chrome (context menu).
- **CSS file layout aligned with the Bliss web-component guidelines** — all `_xxx.css` partials renamed to `xxx.css`, `main.css` now declares `@layer variables, component, overrides;` and imports each partial into the matching layer. Consumers' unlayered overrides automatically beat every rule in the library — no `!important` needed. Note: if your app ships an unlayered universal CSS reset (`* { padding: 0 }` from normalize / Bootstrap / Tailwind preflight / etc.), wrap it in a low-priority `@layer reset` or the tree's defaults won't apply.
- **`getIsDropAllowedCallback` prop + `getIsDraggableCallback` seeded at insert-time** — callback variant for `isDropAllowedMember`, matching the pattern rc09 introduced for `getIsExpandedCallback` / `getIsSelectableCallback` / `getIsSelectedCallback`. Also, the existing `getIsDraggableCallback` prop is now actually applied during the seed walk — previously it was only consumed lazily in some paths.
- **Bug fixes — virtual scroll + `clickBehavior='select'` double-click** — virtual scroll no longer gets stuck at bottom after a filter shrinks the tree. Double-click to expand in `clickBehavior='select'` mode finally works (the browser's native `dblclick` event couldn't fire because the first click destroyed the row via the focus re-render; the controller now detects the double manually).

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
