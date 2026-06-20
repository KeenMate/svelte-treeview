# Usage / API reference

Full Props, Methods, Events, and Snippets reference for `@keenmate/svelte-treeview`.

## Tree component props

### Core properties

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `T[]` | **required** | Array of data objects |
| `idMember` | `string` | **required** | Property name for unique identifiers |
| `pathMember` | `string` | **required** | Property name for hierarchical paths |
| `sortCallback` | `(items: LTreeNode<T>[]) => LTreeNode<T>[]` | `undefined` | Function to sort tree nodes |

### Data mapping properties

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `parentPathMember` | `string \| null` | `null` | Property name for parent path references |
| `levelMember` | `string \| null` | `null` | Property name for node level |
| `isExpandedMember` | `string \| null` | `null` | Property name for expanded state |
| `isSelectedMember` | `string \| null` | `null` | Property name for selected state |
| `isDraggableMember` | `string \| null` | `null` | Property name for draggable state |
| `isDropAllowedMember` | `string \| null` | `null` | Property name for drop allowed state |
| `allowedDropPositionsMember` | `string \| null` | `null` | Property name for allowed drop positions array |
| `isCollapsibleMember` | `string \| null` | `null` | Property name for collapsible state |
| `getIsCollapsibleCallback` | `(node) => boolean` | `undefined` | Callback to determine if a node is collapsible |
| `getIsDraggableCallback` | `(node) => boolean` | `undefined` | Callback to determine if a node is draggable |
| `hasChildrenMember` | `string \| null` | `null` | Property name for children existence |
| `isSorted` | `boolean \| null` | `null` | Whether items should be sorted |

### Display & search properties

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `displayValueMember` | `string \| null` | `null` | Property name for display text |
| `getDisplayValueCallback` | `(node) => string` | `undefined` | Function to get display value |
| `searchValueMember` | `string \| null` | `null` | Property name for search indexing |
| `getSearchValueCallback` | `(node) => string` | `undefined` | Function to get search value |
| `shouldUseInternalSearchIndex` | `boolean` | `true` | Enable built-in search functionality |
| `initializeIndexCallback` | `() => Index` | `undefined` | Function to initialize search index |
| `searchText` | `string` (bindable) | `undefined` | Current search text |

**Note**: When `shouldUseInternalSearchIndex` is enabled, node indexing is performed asynchronously using `requestIdleCallback` (with fallback to `setTimeout`). This ensures the tree renders immediately while search indexing happens during browser idle time, providing better performance for large datasets.

**Important**: For internal search indexing to work, you must:
1. Set `shouldUseInternalSearchIndex={true}`
2. Provide either `searchValueMember` (property name) or `getSearchValueCallback` (function)

Without both requirements, no search indexing will occur.

**Performance tuning**:
- `indexerBatchSize` controls how many nodes are processed per idle callback. Lower values (10-25) provide smoother UI performance but slower indexing, while higher values (50-100) index faster but may cause brief UI pauses. Default: 25.
- `indexerTimeout` sets the maximum wait time before forcing indexing when the browser is busy. Lower values (25-50ms) ensure more responsive indexing, while higher values (100-200ms) give more time for genuine idle periods. Default: 50ms.

### Tree configuration

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `treeId` | `string \| null` | auto-generated | Unique identifier for the tree |
| `treePathSeparator` | `string \| null` | `"."` | Separator character for hierarchical paths (e.g., "." for "1.2.3" or "/" for "1/2/3") |
| `selectedNode` | `LTreeNode<T>` (bindable) | `undefined` | Currently selected node |
| `insertResult` | `InsertArrayResult<T>` (bindable) | `undefined` | Result of the last data insertion including failed nodes |

### Behavior properties

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `expandLevel` | `number \| null` | `2` | Automatically expand nodes up to this level |
| `clickBehavior` | `ClickBehavior` | `'expand-and-focus'` | Node click behavior: `'select'` (click selects, dblclick expands), `'expand'` (click expands only), `'expand-and-focus'` (click selects + expands) |
| `shouldShowCheckboxes` | `boolean` | `false` | Show selection checkboxes before each node. Clicking a checkbox toggles the node's selection (same as Ctrl+click). |
| `orderMember` | `string \| null` | `null` | Property name for sort order (enables before/after positioning in drag-drop) |
| `indexerBatchSize` | `number \| null` | `25` | Number of nodes to process per batch during search indexing |
| `indexerTimeout` | `number \| null` | `50` | Maximum time (ms) to wait for idle callback before forcing indexing |
| `isLoading` | `boolean` | `false` | Show loading placeholder instead of tree content |
| `shouldDisplayDebugInformation` | `boolean` | `false` | Show debug information panel with tree statistics and enable console debug logging |
| `shouldDisplayContextMenuInDebugMode` | `boolean` | `false` | Display persistent context menu at fixed position for styling development |

### Rendering properties

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isFlatRenderingEnabled` | `boolean` | `true` | Use flat rendering mode (faster for large trees) |
| `isProgressiveRender` | `boolean` | `true` | Progressively render nodes in batches |
| `initialBatchSize` | `number` | `20` | First batch size for progressive rendering |
| `maxBatchSize` | `number` | `500` | Maximum batch size cap |
| `isVirtualScrollEnabled` | `boolean` | `false` | Enable virtual scrolling (flat mode only, renders visible + overscan rows) |
| `virtualRowHeight` | `number` | auto | Explicit row height in px (auto-measured from first row if not set) |
| `virtualOverscan` | `number` | `5` | Extra rows rendered above/below viewport |
| `virtualContainerHeight` | `string` | auto/`'400px'` | CSS height for scroll container (auto-detected from parent if not set) |
| `isRendering` | `boolean` (bindable) | `false` | Whether the tree is currently rendering (useful for progress indicators) |
| `onRenderStart` | `() => void` | `undefined` | Called when progressive rendering begins |
| `onRenderProgress` | `(rendered: number, total: number) => void` | `undefined` | Called after each batch with progress info |
| `onRenderComplete` | `() => void` | `undefined` | Called when progressive rendering finishes |

### Drag & drop properties

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `dragDropMode` | `DragDropMode` | `'none'` | Controls allowed drag operations: `'none'`, `'self'`, `'cross'`, `'both'` |
| `dropZoneMode` | `string` | `'glow'` | Drop indicator style: `'floating'` or `'glow'` |
| `dropZoneLayout` | `string` | `'around'` | Zone arrangement: `'around'`, `'above'`, `'below'`, `'wave'`, `'wave2'` |
| `dropZoneStart` | `number \| string` | `33` | Where zones start horizontally (number=%, string=CSS value) |
| `dropZoneMaxWidth` | `number` | `120` | Max width in pixels for wave layouts |
| `isCopyAllowed` | `boolean` | `false` | Enable Ctrl+drag to copy instead of move |
| `shouldAutoHandleCopy` | `boolean` | `true` | Auto-handle same-tree copies (false for external DB/API) |
| `allowedDropPositionsMember` | `string \| null` | `null` | Property name for allowed drop positions array |
| `getAllowedDropPositionsCallback` | `(node) => DropPosition[] \| null` | `undefined` | Callback returning allowed drop positions per node |
| `beforeDropCallback` | `(dropNode, draggedNode, position, event, operation) => ...` | `undefined` | Async-capable callback to validate/modify drops |

### Event handler properties

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onNodeClicked` | `(node) => void` | `undefined` | Node click event handler |
| `onNodeDragStart` | `(node, event) => void` | `undefined` | Drag start event handler |
| `onNodeDragOver` | `(node, event) => void` | `undefined` | Drag over event handler |
| `onNodeDrop` | `(dropNode, draggedNode, position, event, operation) => void` | `undefined` | Drop event handler. `dropNode` can be `null` (e.g., drop on empty tree). Position is `'before'`, `'after'`, or `'child'`. Operation is `'move'` or `'copy'` |

### Visual styling properties

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bodyClass` | `string \| null` | `undefined` | CSS class for tree body |
| `selectedNodeClass` | `string \| null` | `undefined` | CSS class for selected nodes |
| `dragOverNodeClass` | `string \| null` | `undefined` | CSS class for nodes being dragged over |
| `expandIconClass` | `string \| null` | `"stv__toggle-icon--expand"` | CSS class for expand icons |
| `collapseIconClass` | `string \| null` | `"stv__toggle-icon--collapse"` | CSS class for collapse icons |
| `leafIconClass` | `string \| null` | `"stv__toggle-icon--leaf"` | CSS class for leaf node icons |
| `scrollHighlightTimeout` | `number \| null` | `4000` | Duration (ms) for scroll highlight animation |
| `scrollHighlightClass` | `string \| null` | `'stv__scroll-highlight'` | CSS class to apply for scroll highlight effect |

### Snippets

| Snippet | Parameters | Description |
|---------|------------|-------------|
| `nodeTemplate` | `(node)` | Custom node template |
| `treeHeader` | | Tree header content |
| `treeFooter` | | Tree footer content |
| `noDataFound` | | Content shown when tree has no data |
| `dropPlaceholder` | | Content shown in empty drop target tree |
| `loadingPlaceholder` | | Content shown while `isLoading` is true |
| `contextMenu` | `(node, closeMenu)` | Context menu template |

## Public methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `expandNodes` | `nodePath: string` | Expand nodes at specified path |
| `collapseNodes` | `nodePath: string` | Collapse nodes at specified path |
| `expandAll` | `nodePath?: string` | Expand all nodes or nodes under path |
| `collapseAll` | `nodePath?: string` | Collapse all nodes or nodes under path |
| `filterNodes` | `searchText: string, searchOptions?: SearchOptions` | Filter the tree display using internal search index with optional FlexSearch options |
| `searchNodes` | `searchText: string \| null \| undefined, searchOptions?: SearchOptions` | Search nodes using internal search index and return matching nodes with optional FlexSearch options |
| `scrollToPath` | `path: string, options?: ScrollToPathOptions` | Scroll to and highlight a specific node |
| `update` | `updates: Partial<Props>` | Programmatically update component props from external JavaScript |
| `addNode` | `parentPath: string, data: T, pathSegment?: string` | Add a new node under the specified parent |
| `moveNode` | `sourcePath: string, targetPath: string, position: 'before' \| 'after' \| 'child'` | Move a node to a new location |
| `removeNode` | `path: string, includeDescendants?: boolean` | Remove a node (and optionally its descendants) |
| `getNodeByPath` | `path: string` | Get a node by its path |
| `getChildren` | `parentPath: string` | Get direct children of a node |
| `getSiblings` | `path: string` | Get siblings of a node (including itself) |
| `updateNode` | `path: string, data: Partial<T>` | Update a node's data properties |
| `copyNodeWithDescendants` | `sourcePath: string, targetPath: string, position: DropPosition` | Copy a node and its subtree to a new location |
| `refreshNode` | `path: string` | Force re-render of a specific node |
| `refreshSiblings` | `path: string` | Force re-render of a node's siblings |
| `getExpandedPaths` | | Get array of all currently expanded node paths |
| `setExpandedPaths` | `paths: string[]` | Restore expanded state from saved paths |
| `getAllData` | | Get all tree data as a flat array |
| `applyChanges` | | Apply pending changes and refresh the tree |
| `closeContextMenu` | | Programmatically close the context menu |

### ScrollToPath options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `expand` | `boolean` | `true` | Automatically expand parent nodes to make target visible |
| `expandTarget` | `boolean` | `false` | Also expand the target node itself (not just its ancestors) |
| `highlight` | `boolean` | `true` | Apply temporary highlight animation to the target node |
| `scrollOptions` | `ScrollIntoViewOptions` | `{ behavior: 'smooth', block: 'center' }` | Native browser scroll options |
| `containerScroll` | `boolean` | `false` | Scroll only within nearest scrollable ancestor (prevents page scroll) |
| `containerElement` | `HTMLElement` | `undefined` | Explicit scrollable container element to use for scrolling |

```typescript
// Basic usage — scroll to path with default options
await tree.scrollToPath('1.2.3');

// Advanced usage — custom options
await tree.scrollToPath('1.2.3', {
  expand: false,           // Don't auto-expand parent nodes
  highlight: false,        // Skip highlight animation
  scrollOptions: {         // Custom scroll behavior
    behavior: 'instant',
    block: 'start'
  }
});

// Scroll within a scrollable container (prevents page scroll)
await tree.scrollToPath('1.2.3', { containerScroll: true });
```

```svelte
<!-- Default background highlight -->
<Tree
  {data}
  idMember="path"
  pathMember="path"
  scrollHighlightClass="stv__scroll-highlight"
  scrollHighlightTimeout={5000}
/>

<!-- Red arrow highlight -->
<Tree
  {data}
  idMember="path"
  pathMember="path"
  scrollHighlightClass="stv__scroll-highlight--arrow"
  scrollHighlightTimeout={3000}
/>
```

**Available built-in highlight classes:**
- `stv__scroll-highlight` — background glow with primary color (default)
- `stv__scroll-highlight--arrow` — red left arrow indicator

## Statistics

The tree provides real-time statistics about the loaded data:

| Property | Type | Description |
|----------|------|-------------|
| `statistics` | `{ nodeCount: number; maxLevel: number; filteredNodeCount: number; isIndexing: boolean; pendingIndexCount: number }` | Current node count, maximum depth level, filtered nodes count, indexing status, and pending index count |

```typescript
const { nodeCount, maxLevel, filteredNodeCount, isIndexing, pendingIndexCount } = tree.statistics;
console.log(`Tree has ${nodeCount} nodes with maximum depth of ${maxLevel} levels`);
if (filteredNodeCount > 0) {
  console.log(`Currently showing ${filteredNodeCount} filtered nodes`);
}
if (isIndexing) {
  console.log(`Search indexing in progress: ${pendingIndexCount} nodes pending`);
}
```

## External updates (vanilla JavaScript)

The `update()` method allows you to programmatically update component props from external JavaScript code (outside of Svelte's reactivity system). This is particularly useful for HTML/JavaScript integration or dynamic configuration from non-Svelte code.

```javascript
// Get reference to the tree component
const treeElement = document.querySelector('#my-tree');

// Update multiple props at once
treeElement.update({
  searchText: 'Production',
  expandLevel: 3,
  shouldDisplayDebugInformation: true,
  data: newDataArray,
  contextMenuXOffset: 10
});

// Update single prop
treeElement.update({ searchText: 'new search' });
```

**Updatable properties** — all Tree props can be updated except snippets/templates, including:
- Data and state: `data`, `searchText`, `selectedNode`, `expandLevel`
- Members: `idMember`, `pathMember`, `displayValueMember`, `searchValueMember`
- Callbacks: `sortCallback`, `getDisplayValueCallback`, `onNodeClicked`, etc.
- Visual: `bodyClass`, `selectedNodeClass`, `expandIconClass`, etc.
- Context menu: `contextMenuCallback`, `contextMenuXOffset`, `contextMenuYOffset`
- Behavior: `clickBehavior`, `shouldUseInternalSearchIndex`, etc.

## Debug information

Enable debug information to see real-time tree statistics and console logging:

```svelte
<Tree
  {data}
  idMember="path"
  pathMember="path"
  shouldDisplayDebugInformation={true}
/>
```

The visual debug panel shows tree ID, data array length, expand level, node count, maximum depth, filtered node count (when filtering is active), search indexing progress (when indexing is active), and currently dragged node.

When enabled, the component logs detailed information to the browser console including data mapping and sorting metrics, node filtering and search operations, tree structure changes, indexer initialization and progress, and batch processing details.
