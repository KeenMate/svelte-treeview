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
- checkboxMode: CheckboxMode (default 'independent') - 'independent' | 'cascade'. Changing it at runtime re-derives every node's visualState + re-renders (controller `checkboxMode` is a getter/setter → `_reconcileVisualStatesForMode`): switching to 'independent' PROMOTES an indeterminate [-] node to fully checked (isSelected=true); switching to 'cascade' recomputes parent dashes from descendants. Without this the [-] dash stuck (indeterminate is an imperative DOM prop, needs a re-render). Guarded by e2e/checkbox-mode.spec.ts.
- cascadeSelectPolicy: CascadeSelectPolicy (default 'rolled-up') - 'rolled-up' | 'leaves' | 'all'. The SECOND orthogonal checkbox knob: checkboxMode controls cascade BEHAVIOUR, this controls which paths the selection EMITS. ONLY applies in cascade mode (independent emits the raw checked set). The controller keeps the CANONICAL checked set on `#selectedPaths` (every fully-checked node — leaves + fully-checked branches; never an indeterminate branch) and derives an EMITTED projection `#emittedPaths` via `_projectSelection`: rolled-up = minimal cover (a fully-checked selectable subtree collapses to its root, a partial branch descends to emit its checked bits); leaves = only checked leaf nodes; all = the canonical set unchanged. The bindable `selectedPaths` PROP + `onSelectionChange` now expose `#emittedPaths` (via `controller.emittedPaths`); `controller.selectedPaths` getter still returns the canonical set for internal/back-compat reads. A parent SET of the prop is treated as a projection and expanded back into canonical via `setSelectedPaths` (cascade-down). Live policy/mode switches re-project (both setters reassign `#emittedPaths`). NOTE: default 'rolled-up' changes what cascade consumers previously read from selectedPaths (was the full 'all' set). Guarded by e2e/checkbox-policy.spec.ts + fixture /test/checkbox-policy.
- shouldUseInternalSearchIndex: boolean
- shouldDisplayDebugInformation: boolean
- expandLevel: number (default 2)
- nodeClass: (node) => string|null|undefined - data-driven class applied to .stv__node (recomputes on node._rev change)
- nodeContentClass: (node) => string|null|undefined - same, applied to .stv__node-content
- treePathSeparator: string (default ".")
- getContextMenuItemsCallback: (node: LTreeNode<T>, closeMenuCallback: () => void, selectedNodes?: LTreeNode<T>[]) => ContextMenuEntry[]
- contextMenuXOffset: number (default 8px)
- contextMenuYOffset: number (default 0px)
- shouldDisplayContextMenuInDebugMode: boolean (default false)
- shouldShowDropPlaceholderWhenEmpty: boolean (default false) - keep the dropPlaceholder visible whenever the tree is empty (not just mid-drag) AND focus the tabbable .stv__container on hover + pointerdown, so a Ctrl/Cmd+V (routed via onTreeKeydown) pastes into an empty tree whether the user hovers or clicks the zone first. All four empty-state render sites share one `emptyDropState` snippet.
- shouldEnableTreeDropZone: boolean (default false) - make the WHOLE populated tree one drop target: a drop anywhere lands with target=null (route via beforeDropCallback → DropGroup[]), regardless of per-node getIsDropAllowedCallback. Wired as ondragover/ondrop on the always-present .stv__container (only when on); container ondragover preventDefaults so a drop is accepted even when every node rejects it. A drop ON a node is stopPropagation()'d by Node.svelte, so it can't bubble — instead _onNodeDrop/_onZoneDrop FORWARD their reject path to handleTreeZoneDrop (guarded by controller.shouldEnableTreeDropZone, mirrored from the prop via $effect); drops on empty container area hit handleTreeZoneDrop directly. Visual: .stv__container gets .stv__tree-drop-zone--active (outline) while a drag hovers. Use for "drop a basket, auto-sort into category nodes". Guarded by e2e/drag-drop.spec.ts "tree drop zone + DropGroup routing" + fixture /test/drag-drop section-tree-zone.
- noData: snippet - content for an empty tree (renamed from noDataFound). Falls back to noDataText.
- noDataText: string (default "No data") - fallback text for an empty tree when no noData snippet is given (renders .stv__empty-state-content). dropPlaceholder branch wins when shouldShowDropPlaceholderWhenEmpty or a drag is active.
- shouldHandleKeyboardShortcuts: boolean (default false) - opt into built-in Ctrl/Cmd+C/X/V + Delete + Esc(cancel-cut) + classic CUA aliases Ctrl+Insert(copy)/Shift+Insert(paste)/Shift+Delete(cut, wins over plain Delete). Note: Insert key is absent on most Mac keyboards; Mac uses Cmd+C/X/V. Logic on the controller (handleShortcutKeydown(event), deleteNodes(paths?)) so canvas can reuse it; Tree.svelte calls it AFTER the consumer onTreeKeydown (which can override/suppress) and BEFORE the empty-tree return (so paste works into empty). Paste targets focusedNode (root if none) via nodeInputTransformationCallback.
- FOCUS-SCOPED SHORTCUTS: both the built-in shortcuts and onTreeKeydown are bound to .stv__container (tabindex=0) via onkeydown (Tree.svelte:1241), so they ONLY fire when focus is inside the tree. A user who touches a control OUTSIDE the tree first (toolbar button, checkbox, search box, dropdown) — or on first load before clicking any node — then presses Ctrl+C/X/V/Delete gets NOTHING; the key never reaches the tree. This is the normal DOM keyboard model (component-scoped, no OS-clipboard fallback since it's a synthetic keydown handler), NOT a bug. Mitigations for focus-independent shortcuts: (1) call containerEl.focus() after the external control's handler; (2) auto-focus on hover/pointerdown — shipped for the empty-tree case via shouldShowDropPlaceholderWhenEmpty; (3) a document/window-level keydown in the app forwarding to controller.copyNodes/pasteNodes/deleteNodes (then the app owns "is this key for the tree right now?"). NOTE for e2e: toggling a checkbox/radio steals focus — re-.focus() the container before the next key press.
- beforeDeleteCallback: (ctx: {paths, nodes}) => string[]|false|void - narrow or block the built-in Delete set. onDelete(paths) event fires after removal.
- Cross-tree cut auto-removes source: module-level controller registry in clipboard.ts (registerClipboardTree/unregisterClipboardTree/getClipboardTree, keyed by treeId); pasteNodes reaches back to clipboard.sourceTreeId's tree. Same-tree path unchanged.

PUBLIC_METHODS:
- expandNodes(path), collapseNodes(path), expandAll(), collapseAll()
- searchNodes(searchText) - search nodes using internal index and return matching nodes
- scrollToPath(path, options) - options: { expand?, highlight?, scrollOptions?, containerScroll? }
  - containerScroll: true scrolls only within nearest scrollable ancestor (prevents page scroll)
- update(updates: Partial<Props>) - programmatically update props from vanilla JavaScript
- moveNode(sourcePath, targetPath, position) - relocate one subtree; remaps highlight/selection/focus
- moveNodes(paths, targetPath, position) => { success, movedNodes, leftBehind } - BATCH move of a COMPLETE manifest. Resolves all nodes to live refs up front (no stale paths — this replaces the discard-dedup the old multi-drag loop needed), moves the roots (manifest entries whose parent isn't in the manifest) chained in order, and treats any real descendant ABSENT from the manifest as a HOLE — left behind by re-homing it to its moved root's OLD parent (option ii: it physically stays where the subtree was). A complete (unfiltered) manifest has no holes → whole subtrees move. Cross-tree nodes (treeId mismatch) are skipped. The multi-drag drop path and `_executeDropGroups` both delegate to it (internal callers `_completeManifest()` their set so no accidental holes). Guarded by e2e/drag-drop.spec.ts "moveNodes" + fixture /test/drag-drop section-move-nodes.
- duplicateNodes(paths, targetPath, position, transform?, sourceTree?) => { success, copiedNodes, skipped } - BATCH COPY primitive, the copy-side twin of moveNodes (NOT `copyNodes` — that name is the clipboard "copy to clipboard" op). Takes a COMPLETE manifest; a descendant ABSENT from it is a hole, but unlike a move (which re-homes the omitted node so it stays) a copy has nothing to re-home, so the hole is simply NOT copied. Roots (manifest entries whose parent isn't in the manifest) chain in source order under the target; each node's data flows through `transform` (the INPUT transform, `(data, ctx: NodeTransformContext) => T | null`). `sourceTree` defaults to this tree; pass another tree's Ltree to copy its live nodes into this one (cross-tree). BOTH drag-copy branches of `_handleDrop` route through it. Guarded by e2e/drag-drop.spec.ts "duplicateNodes" + fixture /test/drag-drop section-duplicate-nodes.
- copyNodeWithDescendants(sourceNode, targetParentPath, transformData, siblingPath?, position?) - copy ONE subtree; transformData is `(data: T, node: LTreeNode<T>) => T | null` (the live source node is the 2nd arg so batch callers gate on a manifest) — returning null/undefined SKIPS that node AND its subtree. duplicateNodes is built on top of it per root. Guarded by e2e/drag-drop.spec.ts "copyNodeWithDescendants null-skip" + fixture /test/drag-drop section-copy-skip.
- CROSS-TREE AUTO-COPY: a cross-tree drop with operation 'copy' (Ctrl, or forced via beforeDropCallback returning `{operation:'copy'}`) + shouldAutoHandleCopy (default true) is now placed BY THE LIBRARY — it reaches the source tree via the clipboard registry and runs duplicateNodes(sourceTree). No consumer loop. The source publishes its placement manifest (curated beforeDragStart override with holes, or completed subtrees) BOTH on the module-level dragSet AND in the drop dataTransfer (`application/svelte-treeview-manifest`) — the latter survives the source's dragend firing before the target's drop under synthetic DnD. Guarded by e2e/drag-drop.spec.ts "cross-tree AUTO-copy" + fixture /test/drag-drop section-xtree-copy. The /examples/drag-drop Drag-Set Guard uses exactly this (beforeDropCallback forces copy, nodeInputTransformationCallback mints ids, onGuardDrop only logs ctx.dropped) — no imperative placement.

SELECTION_API (three symmetric families; opts = TreeMutationOptions { silent? }):
- HIGHLIGHT (UI multi — highlightedPaths): highlightNode(path, mode?, opts?), highlightNodes(paths, opts?) [additive], setHighlightedPaths(paths, opts?) [replace], highlightAll(opts?), clearHighlight(paths?, opts?)
- SELECTION (checkbox — selectedPaths): selectNode(path, opts?), selectNodes(paths, opts?) [additive], setSelectedPaths(paths, opts?) [replace], selectAll(opts?), deselectNode(path, opts?), clearSelection(paths?, opts?)
- FOCUS (single — focusedNode): focusNode(path, opts?), clearFocus(opts?)
- mode = HighlightMode 'replace'|'toggle'|'range' (plain/Ctrl/Shift click). NOTE: select* = checkbox set; highlight* = UI set. clearSelection replaces the old deselectAll.

EVENTS (on* = fire-and-forget notifications; each takes ONE context object mirroring the clipboard callbacks — return value ignored except onTreeKeydown which is an interceptor):
- SHARED SHAPE: NodeRef<T> = { path, node, parent, siblings } — the node the event is about plus the relational context the tree already knows (live parent node + siblings = children of parent, includes node). Exported; also used as NodeTransformContext's source/target. Built by controller.nodeRef(node|path). Saves consumers a getNodeByPath(node.parentPath) round-trip. node/parent/siblings are null/[] when unreachable (cross-tree, or a node a cut removed).
- onNodeClick(ctx: NodeRef<T>) - ctx.node = the clicked node
- onNodeDoubleClick(ctx: NodeRef<T>) - fires for every clickBehavior; detection is manual on the controller (native dblclick unreliable in flat mode where focus bumps _rev → row recreated); select mode also toggles expand/collapse on double
- onNodeDragStart(ctx: NodeDragContext<T>) - NodeRef of the grabbed node + { event, dragged }
- onNodeDragOver(ctx: NodeDragContext<T>) - NodeRef of the HOVERED node + { event, dragged } (ctx.node = hover target, dragged = in-flight set)
- onNodeDrop(ctx: NodeDropContext<T>) - { source: NodeRef (lead dragged node), target: NodeRef|null (drop node; null = empty/root/tree-zone), dragged: NodeRef[] (full top-level dragged set — a drop fires ONCE even for multi-drag, so this is how you see the whole set; source is its lead), dropped: NodeRef[]|null (nodes the LIBRARY placed — move: moved nodes; copy: the fresh copies; grouped routing: all moved nodes; NULL for cross-tree or shouldAutoHandle*=false where the consumer inserts), position, operation, event }. Symmetric with NodeTransformContext. Shared by desktop + touch drag. (Twin beforeDropCallback is NOW a context object too — see below.)
- beforeDropCallback(ctx: BeforeDropContext<T> = { target: NodeRef|null, dragged: NodeRef[], position, operation, event }) => false | { position?, operation? } | DropGroup[] | void | Promise<…> — the drop interceptor (migrated rc13 from its old 5-arg positional (dropNode, draggedNode, position, event, operation) — was the last positional holdout; now symmetric with NodeDropContext). `false` blocks the whole drop; `{ position?, operation? }` redirects it; `void` proceeds; async-capable (await a confirm dialog). NEW: return a DropGroup[] (`{ targetPath, position?, paths }[]`) for CONTENT-ADDRESSED routing — fan ONE drop out to several destinations (e.g. fruits→node A, vegetables→node B). The library auto-executes groups for SAME-TREE nodes (moves them, first lands at targetPath/position then the rest chain 'after'; resolves all target+source nodes to live refs up front so per-move path reassignment can't stale them — see controller._executeDropGroups); cross-tree nodes can't be auto-moved (not in this tree) so the consumer places those in onNodeDrop. A path in no group isn't placed (per-item reject).
- MULTI-DRAG: a drag is single-origin at the DOM level, so onNodeDragStart/DragOver/Drop each fire ONCE. ctx.dragged carries the full top-level set (multi-selection, else [grabbed node]) on ALL of dragStart/dragOver/drop, same-tree AND cross-tree. Built by controller._draggedRefs BEFORE any move: same-tree resolves live nodes off the highlight set (_draggedTopLevel); cross-tree the target can't see the source's highlight, so the source PUBLISHES the top-level paths on drag start (setDragSet in clipboard.ts) and the target reads them back (getDragSet) as path-only refs (node/parent null cross-tree). Cross-tree multi-drag still only AUTO-PLACES the lead node — the consumer fans out the rest, but now via ctx.dragged (see /examples/drag-drop) instead of reaching into highlightedPaths.
- beforeDragStartCallback(ctx: DragStartContext<T> = { lead: NodeRef, dragged: NodeRef[], event: DragEvent|TouchEvent }) => string[] | false | void — set-level PRE-drag interceptor (the WRITE twin of the read-only ctx.dragged; on* events can't prune the set, this can). Fires ONCE at drag start, before onNodeDragStart + before the cross-tree publish. This is the ONLY hook that can veto/rewrite the whole dragged set (getIsDraggableCallback is per-node only and can't see the combination, nor protect a locked descendant carried inside a dragged parent). ctx.dragged here is the COMPLETE FLATTENED set — the grabbed subtree(s) + EVERY descendant (built by controller._completeDraggedRefs, rc13 Stage-2; distinct from the on* events' top-level dragged) — SO the callback can filter descendants. Return `string[]` = AUTHORITATIVE MANIFEST in landing order: a KEPT node moves; a descendant of a moved node that you OMIT becomes a HOLE the library leaves behind (moveNodes re-homes it to the moved root's OLD parent — it physically stays put, e.g. drag Documents, drop secret.key from the manifest, secret.key stays). Because the default ctx.dragged is complete, omission is always deliberate: return it unchanged → whole subtrees move (no holes). You may also force-add paths not in ctx.dragged (even ones getIsDraggableCallback rejects). `false` = cancel (mouse: preventDefault+unwind; touch: abort long-press; onNodeDragStart does NOT fire); `void` = keep default. Normalized by _normalizeDragManifest (dedupe + guarantee the lead stays; descendants are KEPT — moveNodes resolves refs up front, so the OLD descendant-drop that made holes impossible is gone). Stored as _dragSetOverride, consulted by _draggedRefs (→ ctx.dragged on the on* EVENTS + setDragSet publish) AND both the multi-drag MOVE (→ moveNodes) and the copy-drop (→ duplicateNodes): a CURATED override is passed AS-IS so its holes survive (move re-homes them, copy just doesn't duplicate them), a plain set is _completeManifest'd = no holes. The override is ALSO published as the cross-tree PLACEMENT manifest (module dragSet + drop dataTransfer), so a cross-tree AUTO-copy honours the same holes without any consumer code. SYNC only. Both mouse (_onNodeDragStart) + touch (_onTouchStart timer). Guarded by e2e/drag-drop.spec.ts "beforeDragStartCallback" (prune/augment/veto, flat) + "drag leaves a locked descendant behind" (folder hole) + fixtures /test/drag-drop section-before-drag & section-drag-hole.
- onHighlightChange(ctx: SelectionChangeContext<T>) - { paths: Set<string>, nodes } for the UI multi-select set (highlightedPaths); suppressed by { silent: true } mutations
- onSelectionChange(ctx: SelectionChangeContext<T>) - same shape for the checkbox set (selectedPaths); suppressed by { silent: true }
- onCopy(ctx: ClipboardEventContext<T>) - { operation:'copy', paths, nodes }; fires AFTER copy; nodes live
- onCut(ctx: ClipboardEventContext<T>) - { operation:'cut', paths, nodes }; fires AFTER cut; nodes still live (cut only dims until paste)
- onPaste(result: PasteResult<T>) - unchanged; PasteResult = { success, count, skipped, error?, entries?, operation? }; entries/operation only when shouldAutoHandlePaste=false
- onDelete(ctx: ClipboardEventContext<T>) - { paths, nodes } (no operation); fires after built-in Delete (or deleteNodes()); nodes are PRE-REMOVAL snapshots (captured before removeNode, since the tree no longer holds them)
- onTreeKeydown(ctx: { event, focusedNode, highlightedNodes, controller }) - interceptor; return true to suppress default + built-in shortcuts; runs before handleShortcutKeydown; focus-scoped to .stv__container
- Context types exported from index: NodeRef, NodeEventContext (=NodeRef), NodeDragContext (NodeRef + event + dragged), NodeDropContext, ClipboardEventContext, SelectionChangeContext
- NAMING: on* = fire-and-forget; before*Callback = intercept (modify/block); get*/*TransformationCallback = provide data

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
- Dark mode: light-dark() in color fallbacks + dark-mode.css with @media (prefers-color-scheme: dark), framework classes ([data-theme], [data-bs-theme], .dark), and per-instance `<Tree theme="dark"|"light"/>` prop (forwarded as data-theme on .stv__container)
- CSS variables for theming
- Classes (stv__ BEM, rc11 rename — NO ltree-* classes remain): highlight states .stv__node-content--highlight-bold, --highlight-border, --highlight-brackets, --highlight-fill, --highlight-glow, --scroll-highlight
- Drag-over classes: .stv__node-content--dragover-highlight, --dragover-glow (plus --glow-before/-after/-child for snap zones)
- Touch ghost class: .stv__touch-ghost (customizable via --tree-ghost-bg, --tree-ghost-color)
- Context menu classes: .stv__context-menu, .stv__context-menu-item (--disabled, --has-children), .stv__context-menu-divider, .stv__context-menu-divider-label, .stv__context-menu-label, .stv__context-menu-shortcut, .stv__context-menu-icon, .stv__context-menu-arrow, .stv__context-submenu

CONSTRAINTS:
- Svelte 5 only (uses runes)
- Path-based data structure required
- Search needs shouldUseInternalSearchIndex + searchValueMember/callback
- Segments internally prefixed 'x' for ordering

CONTEXT_MENU:
- Unified types: ContextMenuItem, ContextMenuDivider, ContextMenuEntry (shared with canvas-tree)
- Two approaches: snippet-based (ContextMenuItemC/ContextMenuDividerC components) and callback-based
- Callback: getContextMenuItemsCallback(node, closeMenuCallback, selectedNodes?) returns ContextMenuEntry[]
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
- Landing page: src/routes/+page.svelte (route `/`) — feature cards from an `examples` registry array; examples/+page.svelte redirects here.
- Shared CSS: static/examples-shared.css (loaded via root +layout.svelte). Holds ALL reusable example vocabulary — header gradient, .card, .controls, .output, .note, .code-block, .grid, .btn, plus extracted building blocks (.reference-table, .log-panel/.log-entry, .subsection, .badge.new, .muted, kbd, .metric(s), .tabs/.tab, .control-row, .unsaved-badge, .demo-card, .card-grid) and the .chapter-nav* family. Normalize per-page CSS onto these; keep only genuinely-unique visuals local (e.g. custom-layout iOS/dendrogram, theming brand vars, basic indentation demo).
- Chapter nav: src/routes/ChapterNav.svelte — floating "on this page" jump navigator (Floating UI). Mounted in examples/+layout.svelte (auto-scans `<h2>` in .container + scroll-spy, re-scans on afterNavigate); landing page uses `<ChapterNav items={...} />` for a cross-page jump list. Ported from web-multiselect.
- Coded section headings: every example page prefixes its section `<h2>`s with a per-page code (`BU01 · …`, `IN02 · …`) so the chapter nav reads as an ordered outline. h1s have no emoji.
- Example pages (post-merge): basic (Basic Usage: render/expand/scroll/programmatic + array & exclusive-focus, code BU), interaction (click/multi-select/keyboard/cascade + silent restore, IN), drag-drop (DD), context-menu (CM), search (Search & Filter, SF), data (Data Structures: paths/separators/validation + branch ops, DS), tree-editor (Tree Editor: interactive editor + clipboard + business-scenario DB workflows, TE), performance (PF), custom-layout (CL), theming (TH). Logging lives at /dev/logging.
- MERGES (rc15): expand-collapse→basic, silent-highlight→interaction, branch-operations→data, scenarios→tree-editor. Those four routes are deleted; ExampleHeader.svelte removed (inline headers now).
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
  - beforePasteCallback(ctx: BeforePasteContext<T>) → BATCH POLICY only: redirect target/position, or return false to block. ctx = { operation, target: { path, node (resolved, null at root) }, entries (readonly snapshots) }. Use ctx.target.node.parentPath etc. — no getNodeByPath needed. (Return shape is still { targetPath?, position? } — a directive, not the context.)
  - beforeDeleteCallback(ctx: BeforeDeleteContext<T>) → narrow (return path[]) or block (false) the built-in Delete set. ctx = { paths, nodes } (mirrors BeforeCopyContext; delete has no operation).
- TWO DIRECTION TRANSFORMS (renamed rc13 — operation-neutral, fire for BOTH clipboard AND drag). Defined by DIRECTION, not by operation: OUTPUT = a node LEAVES the source (egress), INPUT = a duplicate LANDS in a destination (ingress). Ctrl+C/X fire output at snapshot; Ctrl+V paste fires input at insert; a copy-DROP fires output at capture THEN input at insert (both moments, back-to-back); a plain MOVE fires NEITHER (nothing is duplicated).
- CONTEXT VOCABULARY: both transforms take ONE type, NodeTransformContext<T> = { operation: 'copy'|'cut', phase: 'output'|'input', isRoot, index, position: 'child'|'before'|'after'|null, source: { path, node, parent, siblings }, target: { path, node, parent, siblings } | null }. source and target are SYMMETRIC — same field, same meaning: `node` is the node in question (source = the node leaving; target = the node you aimed at, null at tree root), `parent` its parent, `siblings` its neighbours (children of parent), all LIVE + batch-aware. target and position are null during phase 'output' (no destination chosen). source.* LIVE when reachable (same-tree) and null/[] cross-tree or after a cut. position (mirrors DropPosition) says how roots land relative to target.node.
  - nodeOutputTransformationCallback(data, ctx: NodeTransformContext<T>) => T → OUTPUT/egress (phase 'output', target+position null): clean/redact fields before the data travels. (was copyNodeTransformationCallback.)
  - nodeInputTransformationCallback(data, ctx: NodeTransformContext<T>) => T | null → INPUT/ingress (phase 'input'): derive ids/values/names; return null to SKIP a node (skipping a root skips its subtree). Pure (reads pristine snapshot). Fires on paste AND the insert side of a copy-drop (same- or cross-tree). (was pasteNodeTransformationCallback.)
- pasteNodes(targetPath, transform?, position?): transform arg is optional and overrides the prop; falls back to nodeInputTransformationCallback. Signature is (data, ctx: NodeTransformContext<T>).
- Collision naming (position-aware): the roots' landing neighbours are target.node's children for a 'child' paste, else target.siblings (the anchor's siblings; = top-level nodes when target.node is null at root). e.g. `const landing = ctx.position === 'child' && ctx.target?.node ? Object.values(ctx.target.node.children) : (ctx.target?.siblings ?? []); uniqueName(data.name, landing.map(s => s.data?.name))`. All LIVE + batch-aware (include nodes added earlier this paste). No displayValueMember needed.
- uniqueName(base, taken, suffix?) exported helper: collision-free name (default `${base} Copy ${n}`); no strip-regex needed since base is always pristine. Use inside nodeInputTransformationCallback with the position-aware `landing` set above.
- onTreeKeydown(ctx: { event, focusedNode, highlightedNodes, controller }) => boolean|void — CONTEXT-OBJECT signature (rc13; was (event, controller)). Return true to suppress default + built-in handling. Carries both selections because a keydown is tree-level (no single anchor node); controller stays for imperative actions (addNode, copyNodes, …). Runs BEFORE handleShortcutKeydown.
- Per-entry skip: self-paste guard (paste into self/descendant) and transform-null now skip just that entry and paste the rest — no silent all-or-nothing. PasteResult gains `skipped: number`.
- Demo /examples/tree-editor: renaming lives in pasteTransform (not beforePaste); beforePaste only redirects duplicate-in-place; cross-folder multi-paste fans out per-parent in the keydown handler. Test fixture /test/clipboard intentionally keeps the legacy beforePaste-mutation style (now safe on the working copy).
- E2E: e2e/clipboard.spec.ts (legacy fixture /test/clipboard) + e2e/clipboard-transform.spec.ts (new fixture /test/clipboard-transform — copy redaction, paste-transform null-skip + skipped count, leaf-aware paste, parent+child no-silent-fail, Delete + subnode guard). Multi-drag focus-follows guard lives in e2e/drag-drop.spec.ts ("focused node follows a multi-drag").
- E2E context-contract fixtures (assert the EXACT ctx each hook receives): /test/clipboard-context + e2e/clipboard-context.spec.ts (clipboard CALLBACKS — symmetric source/target, position-aware landing, cross-tree null refs, beforeDelete, onTreeKeydown) and /test/event-context + e2e/event-context.spec.ts (on* EVENTS — NodeRef parent/siblings resolution on click, NodeDropContext source/target/dragged/dropped, single-origin multi-drag via dispatched dragstart, cross-tree dropped=null, copy/cut/delete/highlight/selection ctx). NOTE: synthetic multi-source HTML5 DnD drops don't land reliably in Chromium (dragstart fires but drop hangs), so event-context asserts multi-drag via a directly-dispatched dragstart('dragstart', { dataTransfer }); the drop path is covered by drag-drop.spec.ts.

CANVAS_PACKAGE:
- Canvas rendering (CanvasTree, layouts, themes) is in a separate package: @keenmate/svelte-treeview-canvas
- Located at ../svelte-treeview-canvas
- Peer-depends on this package (@keenmate/svelte-treeview ^5.0.0)
- Canvas examples (org-chart, nhl-playoffs, canvas-dendrogram, layout-modes, json-loader) are in that package

COMPARISON_WITH_WEB_TREEVIEW (sibling package @keenmate/web-treeview at ../web-treeview):
- Same logical tree, different DOM strategy. Reference when porting features or debugging visual diffs.
- Rendering modes: svelte-treeview = recursive (default) + flat; web-treeview = flat only.
- Children DOM: svelte-treeview wraps in `.stv__children` (recursive mode); web-treeview has no wrapper — siblings under `.wtv__tree`.
- Indent math: both now `(level − 1) × indent` (root at zero offset). svelte-treeview recursive mode gives level-1 nodes margin-left 0 and every deeper node one indent (compounds); flat mode multiplies `(level − 1) × indent` explicitly.
- Virtual scroll: svelte-treeview flat mode only; web-treeview has built-in three-div spacer/translateY structure.
- Label markup: both wrap the default display value in a `.<prefix>__node-label` span (`.stv__node-label` / `.wtv__node-label`). Replace via `nodeTemplate` snippet (svelte) or `renderNodeCallback` (web).
- Checkbox: svelte-treeview `<label>` + custom `.stv__checkbox-box` span; web-treeview bare native `<input>`.
- `draggable` attr: svelte-treeview on `.stv__node-content` (inner); web-treeview on `.wtv__node` (outer).
- Dataset attrs: svelte-treeview only `data-tree-path`; web-treeview also `data-rev` + `data-expanded` (for diff-based reconciler).
- Update mechanism: svelte-treeview Svelte 5 runes + per-node `_rev` keyed `{#each}`; web-treeview imperative reconciler diffing `data-rev`/`data-expanded`.
- Highlight padding: svelte-treeview symmetric ~8px; web-treeview `padding-left: 0` hardcoded → highlight hugs label.
- Neither is "more mature" — svelte-treeview is broader (two rendering modes, easier vertical guide lines via `.stv__children`); web-treeview is purpose-built for virtual scrolling over large datasets.

RECENT: v5.0.0-rc12 - context-menu auto-close, per-node class hooks (nodeClass/nodeContentClass), onNodeDoubleClick event, clipboard + theming fixes, Windows Explorer demo. (rc11: selection API normalization into three symmetric families, ltree→stv BEM rename, drag-drop & highlight-marker fixes. rc06: three-level selection focusedNode/highlightedPaths/selectedPaths, shouldShowCheckboxes + checkboxMode cascade/independent, Shift+Arrow/Home/End/PageUp/PageDown keyboard highlight, clickBehavior prop, core/renderer split. Canvas rendering in @keenmate/svelte-treeview-canvas.)