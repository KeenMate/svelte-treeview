# svelte-treeview context

PACKAGE: @keenmate/svelte-treeview v5.0.0-rc03 | Svelte 5 hierarchical tree component | MIT | KeenMate

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
- selectedNode (bindable)
- insertResult (bindable) - InsertArrayResult<T> with failed nodes info
- clickBehavior: ClickBehavior (default 'expand-and-focus') - 'select' | 'expand' | 'expand-and-focus'
- showCheckboxes: boolean (default false) - renders selection checkboxes per node
- shouldUseInternalSearchIndex: boolean
- shouldDisplayDebugInformation: boolean
- expandLevel: number (default 2)
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

EVENTS:
- onNodeClicked(node)
- onNodeDragStart(node, event)
- onNodeDrop(dropNode, draggedNode, position, event, operation)

DEPENDENCIES:
- peer: svelte ^5.0.0
- optional: flexsearch ^0.8.205
- dev: @sveltejs/kit ^2.22.0, typescript ^5.0.0

STYLING:
- src/lib/styles/main.scss → dist/styles.css
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
- Item features: label, icon, shortcut, isDisabled, isVisible, className (e.g. "danger"), onclick, children (submenus)
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

CANVAS_PACKAGE:
- Canvas rendering (CanvasTree, layouts, themes) is in a separate package: @keenmate/svelte-treeview-canvas
- Located at ../svelte-treeview-canvas
- Peer-depends on this package (@keenmate/svelte-treeview ^5.0.0)
- Canvas examples (org-chart, nhl-playoffs, canvas-dendrogram, layout-modes, json-loader) are in that package

RECENT: v5.0.0-rc05 - clickBehavior prop ('select'|'expand'|'expand-and-focus') replaces shouldToggleOnNodeClick. TreeNavigation, bulk subtree ops, clipboard API. Unified ContextMenuItem types, Svelte context menu components. Core/renderer split. Canvas rendering in @keenmate/svelte-treeview-canvas.