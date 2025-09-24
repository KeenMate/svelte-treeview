# svelte-treeview context

PACKAGE: @keenmate/svelte-treeview v4.2.1 | Svelte 5 hierarchical tree component | MIT | KeenMate

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

interface ContextMenuItem {
  icon?: string;
  title: string;
  isDisabled?: boolean;
  callback: () => void;
  isDivider?: boolean;
}
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
- shouldUseInternalSearchIndex: boolean
- shouldDisplayDebugInformation: boolean
- expandLevel: number (default 2)
- treePathSeparator: string (default ".")
- contextMenuCallback: (node: LTreeNode<T>) => ContextMenuItem[]
- contextMenuXOffset: number (default 8px)
- contextMenuYOffset: number (default 0px)
- shouldDisplayContextMenuInDebugMode: boolean (default false)

PUBLIC_METHODS:
- expandNodes(path), collapseNodes(path), expandAll(), collapseAll()
- searchNodes(searchText) - search nodes using internal index and return matching nodes
- scrollToPath(path, options)

EVENTS: 
- onNodeClicked(node)
- onNodeDragStart(node, event) 
- onNodeDrop(dropNode, draggedNode, event)

DEPENDENCIES:
- peer: svelte ^5.0.0
- optional: flexsearch ^0.8.205
- dev: @sveltejs/kit ^2.22.0, typescript ^5.0.0

STYLING:
- src/lib/styles/main.scss → dist/styles.css
- CSS variables for theming
- Classes: ltree-selected-bold, ltree-selected-border, ltree-scroll-highlight
- Drag-over classes: ltree-dragover-highlight, ltree-dragover-glow
- Context menu classes: ltree-context-menu, ltree-context-menu-item, ltree-context-menu-divider

CONSTRAINTS:
- Svelte 5 only (uses runes)
- Path-based data structure required
- Search needs shouldUseInternalSearchIndex + searchValueMember/callback
- Segments internally prefixed 'x' for ordering

CONTEXT_MENU:
- Two approaches: snippet-based and callback-based
- Callback: contextMenuCallback(node) returns ContextMenuItem[]
- Position offset: contextMenuXOffset/YOffset for cursor clearance
- Debug mode: shouldDisplayContextMenuInDebugMode shows menu at tree-relative position (200px right, 100px down)
- Auto-close: closes on scroll, click outside, or programmatically
- Features: icons, disabled states, dividers, conditional menus
- Dev page: /dev/context-menu with examples and debug controls

RECENT: v4.2.1 with enhanced context menu system - tree-relative debug positioning, improved state management, and comprehensive dev examples