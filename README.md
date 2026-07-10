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

## What's New in v5.0.0-rc13

- **Clipboard — paste rebuilt around an immutable snapshot and a per-node transform** — The module-level clipboard is now immutable to consumers: `pasteNodes` deep-copies entries into a per-paste working copy, so the persistent snapshot (a copy can be pasted repeatedly) is never mutated. Per-node derivation moves to `nodeInputTransformationCallback(data, ctx) => T | null` — fresh ids/values/names, or `null` to skip a node (skipping a root skips its subtree). This replaces the old per-call `transformData(data, index, op)` arg and removes a real foot-gun: naming used to be done by mutating clipboard entries in `beforePaste`, which persisted onto the singleton and needed a strip-`" Copy N"` regex so repeats didn't compound into `Copy 1 Copy 1`.
- **Clipboard — two symmetric direction transforms, defined by egress vs ingress** — The copy and paste transforms are unified into one operation-neutral pair, keyed on DIRECTION not on copy/cut: `nodeOutputTransformationCallback` fires as a node LEAVES the source (egress — clean/redact before it travels), `nodeInputTransformationCallback` fires as a duplicate LANDS in a destination (ingress — derive ids/values/names). Both fire for clipboard AND drag: Ctrl+C/X and a copy-drop's capture run output; Ctrl+V and a copy-drop's insert (same- or cross-tree) run input; a plain move fires neither. Both share one symmetric `NodeTransformContext<T>` (`{ operation, phase: 'output'|'input', isRoot, index, position, source, target }`) whose `source`/`target` carry live node references (`{ path, node, parent, siblings }`) — you decide what "collision" means by reading any field off the destination's sibling nodes, so there's no `displayValueMember` requirement. A new exported `uniqueName(base, taken, suffix?)` helper does collision-free `Name Copy N` naming in one line.
- **Copy/move symmetry — `duplicateNodes` batch primitive + cross-tree auto-copy** — `duplicateNodes(paths, targetPath, position, transform?, sourceTree?)` is the copy-side twin of `moveNodes`: a complete manifest in, an omitted descendant simply not copied (a copy has nothing to re-home). Both drag-copy branches route through it, and a cross-tree copy-drop (Ctrl+drag, or forced via `beforeDropCallback` returning `{ operation: 'copy' }`) with `shouldAutoHandleCopy` (default `true`) is now placed BY THE LIBRARY — it reaches the source tree through the clipboard registry and runs `duplicateNodes(sourceTree)`, so the consumer's `onNodeDrop` is a notification, not a placement loop.
- **Clipboard — a clean-on-egress hook and skip-aware pasting** — `nodeOutputTransformationCallback(data, ctx) => T` cleans/redacts data at snapshot time, so transient or sensitive fields never travel on the shared cross-tree clipboard. Pasting is no longer all-or-nothing: the self-paste guard and a `null` from the transform now skip just that entry and paste the rest (selecting a folder plus its own child no longer silently drops everything), with `PasteResult.skipped` reporting the count. And `pasteNodes` honors `getNodeAllowedDropPositions` — a `child` paste onto a leaf/file lands beside it instead of nesting, so one config governs both drag-drop and paste.
- **Interceptors — `beforeCopy` / `beforeCut` / `beforePaste` now pass node-reference context objects** — `beforePasteCallback` takes `{ operation, target: { path, node }, entries }` (the resolved target node means a redirect is `ctx.target.node?.parentPath`, no tree-ref lookup or path-string slicing), and `beforeCopy`/`beforeCut` take `{ operation, paths, nodes }`. This brings the whole interceptor family in line with `beforeDropCallback`. Entries stay readonly immutable snapshots by design — data rewriting belongs in the transform.
- **Drag & drop — the focused node now follows a multi-drag** — After moving a multi-selection, the highlight set followed but the focused node's styling and bound `focusedNode` did not — `moveNode` assumed the held node reference would auto-recover via in-place path mutation, which breaks when a tree rebuild orphans it. Focus is now remapped by path and re-pointed at the live node. Guarded by a new `e2e/drag-drop.spec.ts` case.
- **Demos — cross-tree clipboard, `Copy N` naming, and `Delete` with a guard** — `/examples/drag-drop` gains `Ctrl/Cmd + C / X / V` between its two trees (copy duplicates, cut moves and removes the source) plus collision-aware `Copy N` naming, and a cross-tree copy-drop that the library auto-places (no consumer loop). `/examples/tree-editor` gains a `Delete` key with a "node has subnodes" guard and warning banner, a live `nodeOutputTransformationCallback` redaction demo, and a Clipboard API reference table.

## What's New in v5.0.0-rc12

- **Context menus — items auto-close on click, with a `shouldCloseOnClick` opt-out, plus a reposition fix** — Activating a leaf item in a `getContextMenuItemsCallback` menu now dismisses the menu in a `finally`, so handlers no longer need to call the provided `close()` themselves (the test/demo callbacks were doing it 15×); calling it anyway is harmless. Items that act incrementally — a toggle, a counter, a multi-step action — opt out with the new `ContextMenuItem.shouldCloseOnClick: false` (default `true`, named per the `should*` convention) and keep the menu open, dismissing it via the captured `close` when finished. Also fixed: re-opening the menu on a *different* node no longer leaves it stuck at the first node's coordinates — the Floating-UI positioning effect now tracks the menu's X/Y/node, not just its visibility — and a `binding_property_non_reactive` warning is gone.
- **Per-node class hooks — `nodeClass` and `nodeContentClass` callbacks** — Two new data-driven callbacks let you tag a row from its own data (`is-folder`/`is-file`, a status color, a grid class) without reaching into `[data-tree-path="…"]` selectors. They run per node, return class(es) applied to `.stv__node` and `.stv__node-content` respectively, and recompute on the node's `_rev` bump like the rest of the render. Plumbed through `NodeConfig` so they don't defeat flat-mode diffing, and wired end-to-end on `<Tree>` (prop → `$effect` sync → `update()` passthrough) and on `createTreeController`.
- **Double-click — a real `onNodeDoubleClick` event, reliable in flat rendering** — There was previously no way to react to a node double-click; the native `dblclick` is unreliable in flat mode because the first click bumps `_rev` and recreates the row out from under the browser. The controller's existing manual detection (last-path + timestamp, 400ms window) is now generalized to *every* `clickBehavior` and fires the new `onNodeDoubleClick`; `select` mode still toggles expand/collapse on a double. Detection is gated to genuine UI clicks, so programmatic `highlightNode`/`selectNode` can never be mistaken for a double.
- **Clipboard events — `onCopy` / `onCut` / `onPaste` on `<Tree>`** — Post-operation notifications symmetric with the `beforeCopy/Cut/Paste` interceptors complete the clipboard surface (`before*Callback` to rewrite or block, `on*` to react). `onPaste` existed on the controller but `<Tree>` never forwarded it and there were no copy/cut equivalents; all three are now controller events forwarded as `<Tree>` props with the usual sync + `update()` passthrough. `/examples/tree-editor` gains multi-select and keyboard Ctrl/Cmd+C/X/V wired through the documented `onTreeKeydown` hook.
- **Clipboard correctness — a copy now survives repeated pastes, and `$state` data no longer throws** — `pasteNodes` used to clear the clipboard after *every* paste, making a copy single-use (contradicting Finder/Explorer/VS Code); it now clears only on `cut` (a move is one-shot), so a copy can be pasted repeatedly. Separately, copy/cut threw `DataCloneError` on the common default `$state` data because `structuredClone` can't clone a Svelte reactive proxy — both clone sites now use `$state.snapshot(...)`, which deproxies reactive state and passes plain data through unchanged. Both fixed with new Playwright coverage.
- **New demo — Windows File Explorer, where both panes are `<Tree>` instances** — A near-complete dual-pane Explorer clone at `/examples/custom-layout`: a hierarchical nav `<Tree>` on the left and a *flat* `<Tree>` rendering the details list as a 4-column CSS grid on the right, with selection, keyboard nav, right-click menu, double-click-to-open, and per-row folder/file classes all driven from the library — replacing the earlier hand-rolled list and bespoke menu. It dogfoods this release's new surfaces (`nodeClass`, `onNodeDoubleClick`, the context-menu auto-close) and stays in sync through the public `expandNodes()` / `focusNode()` API.
- **Theming — brand themes keep their surface in per-instance light mode** — In the `/examples/theming` "Dark Mode Playground", the demo's generic `:has()` surface rules (specificity `(0,3,0)`) outranked each brand theme's base rule `(0,2,0)`, so picking `theme="light"` reverted the wrapper to plain gray — and Glass, which forces white text, rendered white-on-white with the labels vanishing. The four generic surface-flip rules are now scoped to `.brand-default` only; every real brand theme already covers all three modes. New `e2e/theming-brand.spec.ts` (6 cases) guards each gradient brand across inherit/dark/light.

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
