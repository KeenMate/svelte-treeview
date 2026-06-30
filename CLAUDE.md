# svelte-treeview context

PACKAGE: @keenmate/svelte-treeview v5.0.0-rc12 | Svelte 5 hierarchical tree component | MIT | KeenMate

CORE_FILES:
- src/lib/components/Tree.svelte - main component
- src/lib/components/Node.svelte - node renderer  
- src/lib/ltree/ltree.svelte.ts - LTree factory
- src/lib/ltree/ltree-node.svelte.ts - node interface/factory
- src/lib/ltree/types.ts - interfaces
- src/lib/ltree/indexer.ts - async search indexing
- src/lib/index.ts - public exports

COMMANDS:
- npm run dev (port 17777)
- npm run build 
- npm run check
- npm run lint

ARCHITECTURE:
- Path-based hierarchy: "1", "1.1", "1.2.3" (separator configurable via treePathSeparator)
- Internal segment prefix: 'x' (for object key ordering)
- Async search indexing via requestIdleCallback
- Optional FlexSearch integration
- Change tracking via symbols

CORE_TYPES:
```typescript
interface LTreeNode<T> {
  path: string; pathSegment: string; parentPath: string|null;
  level: number|null; children: Record<string, LTreeNode<T>>;
  data: T|null; isExpanded: boolean; isSelected: boolean;
}

interface Ltree<T> {
  insertArray(data: T[]): void;
  expandNodes(path: string): Ltree<T>;
  collapseNodes(path: string): Ltree<T>;
  getNodeByPath(path: string): LTreeNode<T>|null;
  filterNodes(searchText: string): void;
}

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
  isVisible?: boolean;
  className?: string;
  onclick?: () => void | Promise<void>;
  shouldCloseOnClick?: boolean;  // default true; false = menu stays open, handler closes via close()
  children?: ContextMenuEntry[];
}

type ContextMenuEntry = ContextMenuItem | ContextMenuDivider;
```

TREE_PROPS_REQUIRED:
- data: T[]
- idMember: string  
- pathMember: string
- sortCallback: (items: LTreeNode<T>[]) => LTreeNode<T>[]

TREE_PROPS_KEY:
- searchText (bindable)
- focusedNode (bindable) - single focused node (click/arrow keys)
- highlightedPaths (bindable, Set<string>) - multi-select highlight (Ctrl/Shift+click)
- selectedPaths (bindable, Set<string>) - checkbox data state
- insertResult (bindable) - InsertArrayResult<T> with failed nodes info
- clickBehavior: ClickBehavior (default 'expand-and-focus') - 'select' | 'expand' | 'expand-and-focus'
- shouldShowCheckboxes: boolean (default false) - renders selection checkboxes per node
- checkboxMode: CheckboxMode (default 'independent') - 'independent' | 'cascade'
- shouldUseInternalSearchIndex: boolean
- shouldDisplayDebugInformation: boolean
- expandLevel: number (default 2)
- nodeClass: (node) => string|null|undefined - data-driven class applied to .stv__node (recomputes on node._rev change)
- nodeContentClass: (node) => string|null|undefined - same, applied to .stv__node-content
- treePathSeparator: string (default ".")
- contextMenuCallback: (node: LTreeNode<T>, close: () => void) => ContextMenuEntry[]
- contextMenuXOffset: number (default 8px)
- contextMenuYOffset: number (default 0px)
- shouldDisplayContextMenuInDebugMode: boolean (default false)

PUBLIC_METHODS:
- expandNodes(path), collapseNodes(path), expandAll(), collapseAll()
- searchNodes(searchText) - search nodes using internal index and return matching nodes
- scrollToPath(path, options) - options: { expand?, highlight?, scrollOptions?, containerScroll? }
  - containerScroll: true scrolls only within nearest scrollable ancestor (prevents page scroll)
- update(updates: Partial<Props>) - programmatically update props from vanilla JavaScript

SELECTION_API (three symmetric families; opts = TreeMutationOptions { silent? }):
- HIGHLIGHT (UI multi — highlightedPaths): highlightNode(path, mode?, opts?), highlightNodes(paths, opts?) [additive], setHighlightedPaths(paths, opts?) [replace], highlightAll(opts?), clearHighlight(paths?, opts?)
- SELECTION (checkbox — selectedPaths): selectNode(path, opts?), selectNodes(paths, opts?) [additive], setSelectedPaths(paths, opts?) [replace], selectAll(opts?), deselectNode(path, opts?), clearSelection(paths?, opts?)
- FOCUS (single — focusedNode): focusNode(path, opts?), clearFocus(opts?)
- mode = HighlightMode 'replace'|'toggle'|'range' (plain/Ctrl/Shift click). NOTE: select* = checkbox set; highlight* = UI set. clearSelection replaces the old deselectAll.

EVENTS:
- onNodeClick(node)
- onNodeDoubleClick(node) - fires for every clickBehavior; detection is manual on the controller (native dblclick is unreliable in flat mode where focus bumps _rev → row recreated); select mode also toggles expand/collapse on double
- onNodeDragStart(node, event)
- onNodeDrop(dropNode, draggedNode, position, event, operation)

DEPENDENCIES:
- peer: svelte ^5.0.0
- optional: flexsearch ^0.8.205
- dev: @sveltejs/kit ^2.22.0, typescript ^5.0.0

STYLING:
- Pure CSS: src/lib/styles/*.css → bundled via lightningcss to dist/styles.css
- main.css declares `@layer variables, component, overrides;` and wraps every @import in `layer(...)`
- Tier 1 (skeleton): variables.css, base.css, dark-mode.css (overrides layer)
- Tier 2 (canonical): controls.css, floating.css, states.css, animations.css (stubs where not needed)
- Tier 3 (features): node.css, toggle-icons.css, checkbox.css, drag-drop.css, drop-zones.css, context-menu.css, debug.css, loading.css
- No underscore prefix on file names (legacy SASS convention removed)
- lightningcss-cli resolves @import at build time
- Dark mode: light-dark() in color fallbacks + dark-mode.css with @media (prefers-color-scheme: dark), framework classes ([data-theme], [data-bs-theme], .dark), and per-instance `<Tree theme="dark"|"light"/>` prop (forwarded as data-theme on .ltree-container)
- CSS variables for theming
- Classes: ltree-selected-bold, ltree-selected-border, ltree-scroll-highlight
- Drag-over classes: ltree-dragover-highlight, ltree-dragover-glow
- Touch ghost class: ltree-touch-ghost (customizable via --tree-ghost-bg, --tree-ghost-color)
- Context menu classes: ltree-context-menu, ltree-context-menu-item, ltree-context-menu-divider, ltree-context-menu-label, ltree-context-menu-shortcut, ltree-context-menu-arrow, ltree-context-submenu, ltree-context-menu-divider-label

CONSTRAINTS:
- Svelte 5 only (uses runes)
- Path-based data structure required
- Search needs shouldUseInternalSearchIndex + searchValueMember/callback
- Segments internally prefixed 'x' for ordering

CONTEXT_MENU:
- Unified types: ContextMenuItem, ContextMenuDivider, ContextMenuEntry (shared with canvas-tree)
- Two approaches: snippet-based (ContextMenuItemC/ContextMenuDividerC components) and callback-based
- Callback: contextMenuCallback(node, close) returns ContextMenuEntry[]
- Divider type: { divider: true, label?: string } — named dividers render as ──── [label] ────
- Item features: label, icon, shortcut, isDisabled, isVisible, className (e.g. "danger"), onclick, shouldCloseOnClick (default true; false keeps menu open), children (submenus)
- Submenus: children[] opens nested menu on hover (CSS position: absolute; left: 100%)
- Position offset: contextMenuXOffset/YOffset for cursor clearance
- Debug mode: shouldDisplayContextMenuInDebugMode shows menu at tree-relative position (200px right, 100px down)
- Auto-close: closes on scroll, click outside, or programmatically
- Dev page: /dev/context-menu with examples and debug controls
- Spec document: context-menu-spec.md (migration guide for web-treeview)

EXTERNAL_UPDATE:
- update() method for vanilla JS integration
- Accepts partial Props object (excluding snippets)
- Example: tree.update({ searchText: 'query', data: newData, expandLevel: 3 })
- All props updatable: data, searchText, callbacks, members, visuals, behavior

TOUCH_DRAG_DROP:
- Mobile touch support for drag and drop (enabled by default)
- Long-press (300ms) initiates drag, distinguishes from tap/scroll
- Ghost element follows finger showing dragged node
- Uses same onNodeDrop callback as desktop drag and drop
- Haptic feedback on drag start (navigator.vibrate)
- Move >10px before long-press cancels drag (allows scrolling)

EXAMPLES:
- Route: /examples (landing page with feature cards)
- src/routes/examples/+layout.svelte - shared layout/CSS (purple gradient, cards)
- src/routes/examples/+page.svelte - landing page
- src/routes/examples/basic/ - tree rendering, expand level, scroll to path, programmatic control
- src/routes/examples/drag-drop/ - two-tree drag, touch drag, drop placeholder
- src/routes/examples/context-menu/ - callback menus, dynamic items, icons, dividers
- src/routes/examples/search/ - searchText filtering, searchNodes() query
- src/routes/examples/theming/ - CSS variables, theme examples
- src/routes/examples/data/ - path structure, separators, insert results
- Snippet name: nodeTemplate (not nodeContent)

DRAG_DROP_POSITIONS:
- DropPosition type: 'before' | 'after' | 'child'
- allowedDropPositionsMember: string property mapping for server data
- getAllowedDropPositionsCallback: (node) => DropPosition[] | null for dynamic logic
- Glow mode: snaps to nearest allowed position
- Floating mode: only shows allowed position buttons
- undefined/empty = all positions allowed (default)
- pasteNodes honors the same resolver: a 'child' paste onto a node that disallows 'child' (e.g. a leaf/file) is redirected to paste beside it (in its parent). One allowed-positions config governs both drag-drop and clipboard paste; default (no restriction) still nests as a child.

CLIPBOARD (copyNodes/cutNodes/pasteNodes + module-level shared singleton):
- The clipboard snapshot is IMMUTABLE to consumers. pasteNodes works on a per-paste deep copy; the persistent singleton (a copy can be pasted repeatedly) is never mutated.
- Interceptor family (all take a context object w/ node refs, mirroring beforeDrop which already took dropNode/draggedNode):
  - beforeCopyCallback / beforeCutCallback(ctx: BeforeCopyContext<T>) → return new path[] to rewrite the set, false to block. ctx = { operation, paths, nodes (resolved) }.
- Two roles, two hooks (don't mutate data in beforePaste — it only sees a readonly copy):
  - beforePasteCallback(ctx: BeforePasteContext<T>) → BATCH POLICY only: redirect target/position, or return false to block. ctx = { targetPath, targetNode (resolved node, null at root), operation, entries (readonly snapshots) }. Use ctx.targetNode.parentPath etc. — no getNodeByPath needed.
  - copyNodeTransformationCallback(data, ctx: CopyNodeTransformContext) → per-node at snapshot time (copy/cut): clean/redact fields before they hit the shared clipboard.
  - pasteNodeTransformationCallback(data, ctx: PasteNodeTransformContext) => T | null → per-node at insert: derive ids/values/names; return null to SKIP a node (skipping a root skips its subtree). Pure (reads pristine snapshot).
- pasteNodes(targetPath, transform?, position?): transform arg is optional and overrides the prop; falls back to pasteNodeTransformationCallback. Old (data,index,op) signature replaced by (data, ctx).
- PasteNodeTransformContext<T>: { operation, isRoot, index, sourcePath, sourceNode, targetParent, siblings }. Passes LIVE node references (no display-name assumption): sourceNode = original node (same-tree) or null; targetParent = destination parent node (null at root); siblings = destination's existing children (LTreeNode[], batch-aware — includes nodes added earlier this paste). Consumer derives collisions, e.g. uniqueName(data.name, siblings.map(s => s.data?.name)). No displayValueMember needed.
- uniqueName(base, taken, suffix?) exported helper: collision-free name (default `${base} Copy ${n}`); no strip-regex needed since base is always pristine. Use inside pasteNodeTransformationCallback: name: uniqueName(data.name, ctx.siblings.map(s => s.data?.name)).
- Per-entry skip: self-paste guard (paste into self/descendant) and transform-null now skip just that entry and paste the rest — no silent all-or-nothing. PasteResult gains `skipped: number`.
- Demo /examples/tree-editor: renaming lives in pasteTransform (not beforePaste); beforePaste only redirects duplicate-in-place; cross-folder multi-paste fans out per-parent in the keydown handler. Test fixture /test/clipboard intentionally keeps the legacy beforePaste-mutation style (now safe on the working copy).
- E2E: e2e/clipboard.spec.ts (legacy fixture /test/clipboard) + e2e/clipboard-transform.spec.ts (new fixture /test/clipboard-transform — copy redaction, paste-transform null-skip + skipped count, leaf-aware paste, parent+child no-silent-fail, Delete + subnode guard). Multi-drag focus-follows guard lives in e2e/drag-drop.spec.ts ("focused node follows a multi-drag").

CANVAS_PACKAGE:
- Canvas rendering (CanvasTree, layouts, themes) is in a separate package: @keenmate/svelte-treeview-canvas
- Located at ../svelte-treeview-canvas
- Peer-depends on this package (@keenmate/svelte-treeview ^5.0.0)
- Canvas examples (org-chart, nhl-playoffs, canvas-dendrogram, layout-modes, json-loader) are in that package

COMPARISON_WITH_WEB_TREEVIEW (sibling package @keenmate/web-treeview at ../web-treeview):
- Same logical tree, different DOM strategy. Reference when porting features or debugging visual diffs.
- Rendering modes: svelte-treeview = recursive (default) + flat; web-treeview = flat only.
- Children DOM: svelte-treeview wraps in `.stv__children` (recursive mode); web-treeview has no wrapper — siblings under `.wtv__tree`.
- Indent math: svelte-treeview `level × indent`; web-treeview `(level − 1) × indent` (root at zero offset).
- Virtual scroll: svelte-treeview flat mode only; web-treeview has built-in three-div spacer/translateY structure.
- Label markup: both wrap the default display value in a `.<prefix>__node-label` span (`.stv__node-label` / `.wtv__node-label`). Replace via `nodeTemplate` snippet (svelte) or `renderNodeCallback` (web).
- Checkbox: svelte-treeview `<label>` + custom `.stv__checkbox-box` span; web-treeview bare native `<input>`.
- `draggable` attr: svelte-treeview on `.stv__node-content` (inner); web-treeview on `.wtv__node` (outer).
- Dataset attrs: svelte-treeview only `data-tree-path`; web-treeview also `data-rev` + `data-expanded` (for diff-based reconciler).
- Update mechanism: svelte-treeview Svelte 5 runes + per-node `_rev` keyed `{#each}`; web-treeview imperative reconciler diffing `data-rev`/`data-expanded`.
- Highlight padding: svelte-treeview symmetric ~8px; web-treeview `padding-left: 0` hardcoded → highlight hugs label.
- Neither is "more mature" — svelte-treeview is broader (two rendering modes, easier vertical guide lines via `.stv__children`); web-treeview is purpose-built for virtual scrolling over large datasets.

RECENT: v5.0.0-rc12 - context-menu auto-close, per-node class hooks (nodeClass/nodeContentClass), onNodeDoubleClick event, clipboard + theming fixes, Windows Explorer demo. (rc11: selection API normalization into three symmetric families, ltree→stv BEM rename, drag-drop & highlight-marker fixes. rc06: three-level selection focusedNode/highlightedPaths/selectedPaths, shouldShowCheckboxes + checkboxMode cascade/independent, Shift+Arrow/Home/End/PageUp/PageDown keyboard highlight, clickBehavior prop, core/renderer split. Canvas rendering in @keenmate/svelte-treeview-canvas.)