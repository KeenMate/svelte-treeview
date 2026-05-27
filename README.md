# @keenmate/svelte-treeview

A high-performance, feature-rich hierarchical tree view component for Svelte 5 with drag & drop support, search functionality, and flexible data structures using LTree.

## Live Demo

Browse interactive code examples and the full API reference at **[svelte-treeview.keenmate.dev](https://svelte-treeview.keenmate.dev)**

## What's New in v5.0.0-rc08

- **`{ silent: true }` on highlight/selection methods**: Update tree state from URL params or other external sources without firing `onNodeClick` / `onHighlightChange` / `onSelectionChange` — perfect for deep links where you don't want the change callback to re-trigger your form loader. Applies to `highlightNode`, `highlightNodes`, `clearHighlight`, and `deselectAll`.
- **Array variants for expand/collapse**: `expandNodes`, `collapseNodes`, `expandAll`, and `collapseAll` now take `string | string[]`. Open or close several places in one call.
- **Exclusive focus mode**: Pass `{ exclusive: true }` to `expandNodes` / `expandAll` to open the target path and collapse everything else in a single pass — no two-step flicker compared to `collapseAll() + expandNodes(path)`.
- **`noEmit` option for batching**: Suppress the change emit on individual expand/collapse calls when chaining several operations; emit once at the end.

## What's New in v5.0.0-rc07

- **`isSelectedMember` prop**: Seed `selectedPaths` directly from your data — point the prop at a boolean field and every node where it's truthy lands pre-checked after `insertArray`.
- **`isSelectableMember` fully wired through `Tree`**: The prop was already on the core types but wasn't reachable via the component. Now end-to-end usable to control checkbox rendering and clickability per node.
- **Fix: filter race during async indexing**: `bind:searchText` no longer hides the entire tree if the FlexSearch index is still being built when the filter is applied. The filter now re-applies itself automatically once indexing completes, regardless of `indexerBatchSize` or dataset size.

## v5.0: Core/Renderer Split + Virtual Scroll

> [!IMPORTANT]
> **In version 5, the tree core (data structure, expand/collapse, search, drag & drop logic) has been completely separated from the renderer.** The architecture is open for you to build your own custom renderers on top of the same core via `TreeProvider` and `TreeController`.

**Key changes in v5:**
- **Core/Renderer split**: Use the built-in HTML `Tree` renderer, or create custom visualizations (Canvas, WebGL, SVG) via `TreeProvider` + `TreeController`
- **Virtual scroll**: Render 50,000+ node trees smoothly with `virtualScroll={true}` — only ~50 DOM nodes at any time
- **Canvas companion**: For canvas rendering, install [`@keenmate/svelte-treeview-canvas`](https://github.com/keenmate/svelte-treeview-canvas)
- **Drop position naming**: `'above'`/`'below'` renamed to `'before'`/`'after'` (CSS classes and events updated accordingly)

### Rendering Modes

| Mode | Props | DOM Nodes | Best For |
|------|-------|-----------|----------|
| Recursive | `useFlatRendering={false}` | All | Small trees (<100 nodes) |
| Flat (default) | `useFlatRendering={true}` | All | Medium trees (100–10K) |
| Virtual | `virtualScroll={true}` | ~50 | Large trees (10K+) |

```svelte
<!-- Virtual scroll for large trees -->
<Tree {data} virtualScroll={true} virtualContainerHeight="500px" />

<!-- Flat mode (default) with progressive batching -->
<Tree {data} progressiveRender={true} initialBatchSize={20} maxBatchSize={500} />
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
import '@keenmate/svelte-treeview/styles.scss';
```

**Svelte component import:**
```svelte
<style>
  @import '@keenmate/svelte-treeview/styles.scss';
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

## Advanced Usage

### With Custom Node Templates

```svelte
<script lang="ts">
  import { Tree } from '@keenmate/svelte-treeview';

  const fileData = [
    { path: '1', name: 'Documents', type: 'folder', icon: '📁' },
    { path: '1.1', name: 'report.pdf', type: 'file', icon: '📄', size: '2.3 MB' },
    { path: '2', name: 'Images', type: 'folder', icon: '🖼️' },
    { path: '2.1', name: 'photo.jpg', type: 'file', icon: '🖼️', size: '1.8 MB' }
  ];
</script>

<Tree
  data={fileData}
  idMember="path"
  pathMember="path"
  selectedNodeClass="ltree-selected-bold"
  onNodeClicked={(node) => console.log('Clicked:', node.data?.name)}
>
  {#snippet nodeTemplate(node)}
    <div class="d-flex align-items-center">
      <span class="me-2">{node.data?.icon}</span>
      <strong>{node.data?.name}</strong>
      {#if node.data?.size}
        <small class="text-muted ms-2">({node.data?.size})</small>
      {/if}
    </div>
  {/snippet}
</Tree>
```

### With Search and Filtering

```svelte
<script lang="ts">
  import { Tree } from '@keenmate/svelte-treeview';

  let searchText = $state('');
  const data = [/* your data */];
</script>

<input
  type="text"
  placeholder="Search..."
  bind:value={searchText}
/>

<Tree
  {data}
  idMember="path"
  pathMember="path"
  shouldUseInternalSearchIndex={true}
  searchValueMember="name"
  bind:searchText
/>
```

### With Advanced Search Options

```svelte
<script lang="ts">
  import { Tree } from '@keenmate/svelte-treeview';
  import type { SearchOptions } from 'flexsearch';

  let treeRef;
  const data = [/* your data */];

  // Programmatic search with FlexSearch options
  function performAdvancedSearch(searchTerm: string) {
    const searchOptions: SearchOptions = {
      suggest: true,        // Enable suggestions for typos
      limit: 10,            // Limit results to 10 items
      bool: "and"           // Use AND logic for multiple terms
    };

    const results = treeRef.searchNodes(searchTerm, searchOptions);
    console.log('Advanced search results:', results);
  }

  // Programmatic filtering with options
  function filterWithOptions(searchTerm: string) {
    const searchOptions: SearchOptions = {
      threshold: 0.8,       // Similarity threshold
      depth: 2              // Search depth
    };

    treeRef.filterNodes(searchTerm, searchOptions);
  }
</script>

<Tree
  bind:this={treeRef}
  {data}
  idMember="path"
  pathMember="path"
  shouldUseInternalSearchIndex={true}
  searchValueMember="name"
/>

<button onclick={() => performAdvancedSearch('document')}>
  Advanced Search
</button>
<button onclick={() => filterWithOptions('project')}>
  Filter with Options
</button>
```

#### FlexSearch Options Reference

The `searchOptions` parameter accepts any options supported by FlexSearch. Common options include:

| Option | Type | Description | Example |
|--------|------|-------------|---------|
| `suggest` | `boolean` | Enable suggestions for typos | `{ suggest: true }` |
| `limit` | `number` | Maximum number of results | `{ limit: 10 }` |
| `threshold` | `number` | Similarity threshold (0-1) | `{ threshold: 0.8 }` |
| `depth` | `number` | Search depth for nested content | `{ depth: 2 }` |
| `bool` | `string` | Boolean logic: "and", "or" | `{ bool: "and" }` |
| `where` | `object` | Filter by field values | `{ where: { type: "folder" } }` |

For complete FlexSearch documentation, visit: [FlexSearch Options](https://github.com/nextapps-de/flexsearch#options)

### With Drag & Drop

**Note:** Drag and drop is disabled by default. Set `dragDropMode` to enable it.

```svelte
<script lang="ts">
  import { Tree } from '@keenmate/svelte-treeview';

  let treeRef: Tree<MyNode>;

  const data = [
    { path: '1', name: 'Folder 1' },
    { path: '1.1', name: 'Item 1' },
    { path: '2', name: 'Folder 2' }
  ];

  function onDragStart(node, event) {
    console.log('Dragging:', node.data?.name);
  }

  // Same-tree moves are auto-handled - this callback is for notification/custom logic
  function onDrop(dropNode, draggedNode, position, event, operation) {
    console.log(`Dropped ${draggedNode.data?.name} ${position} ${dropNode?.data?.name}`);
    // position is 'before', 'after', or 'child'
    // operation is 'move' or 'copy' (Ctrl+drag)
  }
</script>

<Tree
  bind:this={treeRef}
  {data}
  idMember="path"
  pathMember="path"
  dragDropMode="both"
  orderMember="sortOrder"
  dragOverNodeClass="ltree-dragover-highlight"
  onNodeDragStart={onDragStart}
  onNodeDrop={onDrop}
/>
```

#### Drop Position Control

When using `dropZoneMode="floating"`, users can choose where to drop:
- **Before**: Insert as sibling before the target node
- **After**: Insert as sibling after the target node
- **Child**: Insert as child of the target node

#### Per-Node Drop Position Restrictions

You can restrict which drop positions are allowed per node. This is useful for:
- **Trash/Recycle Bin**: Only allow dropping INTO (child), not before/after
- **Files**: Only allow before/after (can't drop INTO a file)
- **Folders**: Allow all positions (default)

```svelte
<script lang="ts">
  import { Tree, type DropPosition, type LTreeNode } from '@keenmate/svelte-treeview';

  // Dynamic callback approach
  function getAllowedDropPositions(node: LTreeNode<MyItem>): DropPosition[] | null {
    if (node.data?.type === 'file') return ['before', 'after'];
    if (node.data?.type === 'trash') return ['child'];
    return undefined; // all positions allowed
  }
</script>

<Tree
  {data}
  getAllowedDropPositionsCallback={getAllowedDropPositions}
/>
```

Or use the member approach for server-side data:
```svelte
<Tree
  {data}
  allowedDropPositionsMember="allowedDropPositions"
/>

<!-- Where data items have: { allowedDropPositions: ['child'] } -->
```

When restrictions are applied:
- **Glow mode**: Snaps to the nearest allowed position
- **Floating mode**: Only renders buttons for allowed positions

#### Async Drop Validation

Use `beforeDropCallback` to validate or modify drops, including async operations like confirmation dialogs:

```svelte
<script lang="ts">
  async function beforeDrop(dropNode, draggedNode, position, event, operation) {
    // Cancel specific drops
    if (draggedNode.data.locked) {
      return false; // Cancel the drop
    }

    // Show confirmation dialog (async)
    if (position === 'child' && !dropNode.data.isFolder) {
      const confirmed = await showConfirmDialog('Drop as sibling instead?');
      if (!confirmed) return false;
      return { position: 'after' }; // Override position
    }

    // Proceed normally
    return true;
  }
</script>

<Tree
  {data}
  beforeDropCallback={beforeDrop}
  onNodeDrop={onDrop}
/>
```

### Tree Editing

The tree provides built-in methods for programmatic editing:

```svelte
<script lang="ts">
  import { Tree } from '@keenmate/svelte-treeview';

  let treeRef: Tree<MyNode>;

  // Add a new node
  function addChild() {
    const result = treeRef.addNode(
      selectedNode?.path || '', // parent path (empty = root)
      { id: Date.now(), path: '', name: 'New Item', sortOrder: 100 }
    );
    if (result.success) {
      console.log('Added:', result.node);
    }
  }

  // Move a node
  function moveUp() {
    const siblings = treeRef.getSiblings(selectedNode.path);
    const index = siblings.findIndex(s => s.path === selectedNode.path);
    if (index > 0) {
      treeRef.moveNode(selectedNode.path, siblings[index - 1].path, 'before');
    }
  }

  // Remove a node
  function remove() {
    treeRef.removeNode(selectedNode.path);
  }
</script>

<Tree
  bind:this={treeRef}
  {data}
  idMember="id"
  pathMember="path"
  orderMember="sortOrder"
/>
```

**Note**: When using `orderMember`, the tree automatically calculates sort order values when moving nodes with 'before' or 'after' positions.

### With Context Menus

The tree supports context menus with two approaches: **callback-based** (imperative, shared with web components) and **snippet + component** (declarative, Svelte-only).

#### Callback-Based Context Menus

```svelte
<script lang="ts">
  import { Tree } from '@keenmate/svelte-treeview';
  import type { ContextMenuEntry } from '@keenmate/svelte-treeview';

  const data = [
    { path: '1', name: 'Documents', type: 'folder', canEdit: true, canDelete: true },
    { path: '1.1', name: 'report.pdf', type: 'file', canEdit: true, canDelete: false },
    { path: '2', name: 'Images', type: 'folder', canEdit: false, canDelete: true }
  ];

  function createContextMenu(node, close: () => void): ContextMenuEntry[] {
    return [
      { label: 'Open', icon: '📂', shortcut: 'O',
        onclick: () => { alert(`Opening ${node.data?.name}`); close(); } },
      { label: 'Edit', icon: '✏️', shortcut: 'E', isVisible: node.data?.canEdit,
        onclick: () => { alert(`Editing ${node.data?.name}`); close(); } },
      { label: 'Export As...', icon: '📤', children: [
          { label: 'JSON', shortcut: 'J', onclick: () => { exportAs(node, 'json'); close(); } },
          { label: 'XML', shortcut: 'X', onclick: () => { exportAs(node, 'xml'); close(); } },
      ]},
      { divider: true, label: 'Danger zone' },
      { label: 'Delete', icon: '🗑️', className: 'danger',
        isDisabled: !node.data?.canDelete,
        onclick: () => { confirm(`Delete?`) && alert('Deleted!'); close(); } },
    ];
  }
</script>

<Tree
  {data}
  idMember="path"
  pathMember="path"
  contextMenuCallback={createContextMenu}
/>
```

#### Snippet + Component Context Menus

```svelte
<script lang="ts">
  import { Tree, ContextMenuItemC, ContextMenuDividerC } from '@keenmate/svelte-treeview';
</script>

<Tree {data} idMember="path" pathMember="path">
  {#snippet contextMenu(node, close)}
    <ContextMenuItemC label="Copy" icon="📋" shortcut="C"
      onclick={() => { copy(node); close(); }} />
    {#if node.data?.type === 'folder'}
      <ContextMenuItemC label="Export As..." icon="📤">
        <ContextMenuItemC label="JSON" shortcut="J"
          onclick={() => { exportAs(node, 'json'); close(); }} />
        <ContextMenuItemC label="XML" shortcut="X"
          onclick={() => { exportAs(node, 'xml'); close(); }} />
      </ContextMenuItemC>
    {/if}
    <ContextMenuDividerC label="Danger zone" />
    <ContextMenuItemC label="Delete" icon="🗑️" className="danger"
      isDisabled={!!node.data?.readonly}
      onclick={() => { del(node); close(); }} />
  {/snippet}
</Tree>
```

#### Context Menu Features

- **Unified types**: `ContextMenuItem`, `ContextMenuDivider`, `ContextMenuEntry` shared across svelte-treeview and canvas-tree
- **Keyboard shortcuts**: `shortcut` field renders a hint and activates on keypress when menu is open (supports `Ctrl+`, `Shift+`, `Alt+` modifiers)
- **Submenus**: `children` array opens nested menus on hover
- **Named dividers**: `{ divider: true, label: 'Section' }` renders as `---- Section ----`
- **Visibility control**: `isVisible: false` hides items (callback approach); snippet approach uses `{#if}`
- **Flexible styling**: `className="danger"` or any custom CSS class
- **Dynamic menus**: Generate items based on node properties
- **Icons and disabled states**: Visual organization and context-sensitive availability
- **Position offset**: `contextMenuXOffset`/`contextMenuYOffset` for cursor clearance
- **Auto-close**: Closes on scroll, click outside, Escape key, or programmatically

## Styling and Customization

The component comes with default styles that provide a clean, modern look. You can customize it extensively:

### CSS Variables

The component uses CSS custom properties for easy theming:

```css
:root {
  --tree-node-indent-per-level: 0.5rem;  /* Controls indentation for each hierarchy level */
  --ltree-primary: #0d6efd;
  --ltree-primary-rgb: 13, 110, 253;
  --ltree-success: #198754;
  --ltree-success-rgb: 25, 135, 84;
  --ltree-danger: #dc3545;
  --ltree-danger-rgb: 220, 53, 69;
  --ltree-light: #f8f9fa;
  --ltree-border: #dee2e6;
  --ltree-body-color: #212529;
}
```

**Note**: The `--tree-node-indent-per-level` variable controls the consistent indentation applied at each hierarchy level. Each nested level receives this fixed indent amount, creating proper visual hierarchy without exponential indentation growth.

### SCSS Variables (if using SCSS)

If you're building the styles from SCSS source, you can override these variables:

```scss
// Import your overrides before the library styles
$tree-node-indent-per-level: 1rem;
$tree-node-font-family: 'Custom Font', sans-serif;
$primary-color: #custom-color;

@import '@keenmate/svelte-treeview/styles.scss';
```

### CSS Classes

- `.ltree-tree` - Main tree container
- `.ltree-node` - Individual node container
- `.ltree-node-content` - Node content area
- `.ltree-toggle-icon` - Expand/collapse icons
- `.ltree-selected-*` - Selected node styles
- `.ltree-dragover-*` - Drag-over node styles
- `.ltree-draggable` - Draggable nodes
- `.ltree-context-menu` - Context menu styling
- `.ltree-drag-over` - Applied during drag operations
- `.ltree-drop-valid` / `.ltree-drop-invalid` - Drop target validation

### Pre-built Selected Node Styles

The component includes several pre-built classes for styling selected nodes:

```svelte
<Tree
  {data}
  idMember="path"
  pathMember="path"
  selectedNodeClass="ltree-selected-bold"
/>
```

**Available Selected Node Classes:**

| Class | Description | Visual Effect |
|-------|-------------|---------------|
| `ltree-selected-bold` | Bold text with primary color | **Bold text** in theme primary color |
| `ltree-selected-border` | Border and background highlight | Solid border with light background |
| `ltree-selected-brackets` | Decorative brackets around text | > **Node Text** < |

**Available Drag-over Node Classes:**

| Class | Description | Visual Effect |
|-------|-------------|---------------|
| `ltree-dragover-highlight` | Dashed border with success color background | Green dashed border with subtle background |
| `ltree-dragover-glow` | Blue glow effect | Glowing shadow effect with primary color theme |

### Custom Icon Classes

```svelte
<Tree
  {data}
  idMember="path"
  pathMember="path"
  expandIconClass="custom-expand-icon"
  collapseIconClass="custom-collapse-icon"
  leafIconClass="custom-leaf-icon"
/>
```

## API Reference

### Tree Component Props

#### Core Properties
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `T[]` | **required** | Array of data objects |
| `idMember` | `string` | **required** | Property name for unique identifiers |
| `pathMember` | `string` | **required** | Property name for hierarchical paths |
| `sortCallback` | `(items: LTreeNode<T>[]) => LTreeNode<T>[]` | `undefined` | Function to sort tree nodes |

#### Data Mapping Properties
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

#### Display & Search Properties
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

**Performance Tuning**:
- `indexerBatchSize` controls how many nodes are processed per idle callback. Lower values (10-25) provide smoother UI performance but slower indexing, while higher values (50-100) index faster but may cause brief UI pauses. Default: 25.
- `indexerTimeout` sets the maximum wait time before forcing indexing when the browser is busy. Lower values (25-50ms) ensure more responsive indexing, while higher values (100-200ms) give more time for genuine idle periods. Default: 50ms.

#### Tree Configuration
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `treeId` | `string \| null` | auto-generated | Unique identifier for the tree |
| `treePathSeparator` | `string \| null` | `"."` | Separator character for hierarchical paths (e.g., "." for "1.2.3" or "/" for "1/2/3") |
| `selectedNode` | `LTreeNode<T>` (bindable) | `undefined` | Currently selected node |
| `insertResult` | `InsertArrayResult<T>` (bindable) | `undefined` | Result of the last data insertion including failed nodes |

#### Behavior Properties
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `expandLevel` | `number \| null` | `2` | Automatically expand nodes up to this level |
| `clickBehavior` | `ClickBehavior` | `'expand-and-focus'` | Node click behavior: `'select'` (click selects, dblclick expands), `'expand'` (click expands only), `'expand-and-focus'` (click selects + expands) |
| `showCheckboxes` | `boolean` | `false` | Show selection checkboxes before each node. Clicking a checkbox toggles the node's selection (same as Ctrl+click). |
| `orderMember` | `string \| null` | `null` | Property name for sort order (enables before/after positioning in drag-drop) |
| `indexerBatchSize` | `number \| null` | `25` | Number of nodes to process per batch during search indexing |
| `indexerTimeout` | `number \| null` | `50` | Maximum time (ms) to wait for idle callback before forcing indexing |
| `isLoading` | `boolean` | `false` | Show loading placeholder instead of tree content |
| `shouldDisplayDebugInformation` | `boolean` | `false` | Show debug information panel with tree statistics and enable console debug logging |
| `shouldDisplayContextMenuInDebugMode` | `boolean` | `false` | Display persistent context menu at fixed position for styling development |

#### Rendering Properties
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `useFlatRendering` | `boolean` | `true` | Use flat rendering mode (faster for large trees) |
| `progressiveRender` | `boolean` | `true` | Progressively render nodes in batches |
| `initialBatchSize` | `number` | `20` | First batch size for progressive rendering |
| `maxBatchSize` | `number` | `500` | Maximum batch size cap |
| `virtualScroll` | `boolean` | `false` | Enable virtual scrolling (flat mode only, renders visible + overscan rows) |
| `virtualRowHeight` | `number` | auto | Explicit row height in px (auto-measured from first row if not set) |
| `virtualOverscan` | `number` | `5` | Extra rows rendered above/below viewport |
| `virtualContainerHeight` | `string` | auto/`'400px'` | CSS height for scroll container (auto-detected from parent if not set) |
| `isRendering` | `boolean` (bindable) | `false` | Whether the tree is currently rendering (useful for progress indicators) |
| `onRenderStart` | `() => void` | `undefined` | Called when progressive rendering begins |
| `onRenderProgress` | `(rendered: number, total: number) => void` | `undefined` | Called after each batch with progress info |
| `onRenderComplete` | `() => void` | `undefined` | Called when progressive rendering finishes |

#### Drag & Drop Properties
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `dragDropMode` | `DragDropMode` | `'none'` | Controls allowed drag operations: `'none'`, `'self'`, `'cross'`, `'both'` |
| `dropZoneMode` | `string` | `'glow'` | Drop indicator style: `'floating'` or `'glow'` |
| `dropZoneLayout` | `string` | `'around'` | Zone arrangement: `'around'`, `'above'`, `'below'`, `'wave'`, `'wave2'` |
| `dropZoneStart` | `number \| string` | `33` | Where zones start horizontally (number=%, string=CSS value) |
| `dropZoneMaxWidth` | `number` | `120` | Max width in pixels for wave layouts |
| `allowCopy` | `boolean` | `false` | Enable Ctrl+drag to copy instead of move |
| `autoHandleCopy` | `boolean` | `true` | Auto-handle same-tree copies (false for external DB/API) |
| `allowedDropPositionsMember` | `string \| null` | `null` | Property name for allowed drop positions array |
| `getAllowedDropPositionsCallback` | `(node) => DropPosition[] \| null` | `undefined` | Callback returning allowed drop positions per node |
| `beforeDropCallback` | `(dropNode, draggedNode, position, event, operation) => ...` | `undefined` | Async-capable callback to validate/modify drops |

#### Event Handler Properties
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onNodeClicked` | `(node) => void` | `undefined` | Node click event handler |
| `onNodeDragStart` | `(node, event) => void` | `undefined` | Drag start event handler |
| `onNodeDragOver` | `(node, event) => void` | `undefined` | Drag over event handler |
| `onNodeDrop` | `(dropNode, draggedNode, position, event, operation) => void` | `undefined` | Drop event handler. `dropNode` can be `null` (e.g., drop on empty tree). Position is `'before'`, `'after'`, or `'child'`. Operation is `'move'` or `'copy'` |

#### Visual Styling Properties
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bodyClass` | `string \| null` | `undefined` | CSS class for tree body |
| `selectedNodeClass` | `string \| null` | `undefined` | CSS class for selected nodes |
| `dragOverNodeClass` | `string \| null` | `undefined` | CSS class for nodes being dragged over |
| `expandIconClass` | `string \| null` | `"ltree-icon-expand"` | CSS class for expand icons |
| `collapseIconClass` | `string \| null` | `"ltree-icon-collapse"` | CSS class for collapse icons |
| `leafIconClass` | `string \| null` | `"ltree-icon-leaf"` | CSS class for leaf node icons |
| `scrollHighlightTimeout` | `number \| null` | `4000` | Duration (ms) for scroll highlight animation |
| `scrollHighlightClass` | `string \| null` | `'ltree-scroll-highlight'` | CSS class to apply for scroll highlight effect |

#### Snippets
| Snippet | Parameters | Description |
|---------|------------|-------------|
| `nodeTemplate` | `(node)` | Custom node template |
| `treeHeader` | | Tree header content |
| `treeFooter` | | Tree footer content |
| `noDataFound` | | Content shown when tree has no data |
| `dropPlaceholder` | | Content shown in empty drop target tree |
| `loadingPlaceholder` | | Content shown while `isLoading` is true |
| `contextMenu` | `(node, closeMenu)` | Context menu template |

#### Public Methods
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

#### ScrollToPath Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `expand` | `boolean` | `true` | Automatically expand parent nodes to make target visible |
| `expandTarget` | `boolean` | `false` | Also expand the target node itself (not just its ancestors) |
| `highlight` | `boolean` | `true` | Apply temporary highlight animation to the target node |
| `scrollOptions` | `ScrollIntoViewOptions` | `{ behavior: 'smooth', block: 'center' }` | Native browser scroll options |
| `containerScroll` | `boolean` | `false` | Scroll only within nearest scrollable ancestor (prevents page scroll) |
| `containerElement` | `HTMLElement` | `undefined` | Explicit scrollable container element to use for scrolling |

**Usage Example:**
```typescript
// Basic usage - scroll to path with default options
await tree.scrollToPath('1.2.3');

// Advanced usage - custom options
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

**Highlight Classes Example:**
```svelte
<!-- Default background highlight -->
<Tree
  {data}
  idMember="path"
  pathMember="path"
  scrollHighlightClass="ltree-scroll-highlight"
  scrollHighlightTimeout={5000}
/>

<!-- Red arrow highlight -->
<Tree
  {data}
  idMember="path"
  pathMember="path"
  scrollHighlightClass="ltree-scroll-highlight-arrow"
  scrollHighlightTimeout={3000}
/>

<!-- Custom highlight class -->
<Tree
  {data}
  idMember="path"
  pathMember="path"
  scrollHighlightClass="my-custom-highlight"
  scrollHighlightTimeout={2000}
/>
```

**Available Built-in Highlight Classes:**
- `ltree-scroll-highlight` - Background glow with blue color (default)
- `ltree-scroll-highlight-arrow` - Red left arrow indicator

#### Statistics
The tree provides real-time statistics about the loaded data:

| Property | Type | Description |
|----------|------|-------------|
| `statistics` | `{ nodeCount: number; maxLevel: number; filteredNodeCount: number; isIndexing: boolean; pendingIndexCount: number }` | Returns current node count, maximum depth level, filtered nodes count, indexing status, and pending index count |

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

#### External Updates (Vanilla JavaScript)

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

// Update data and configuration
treeElement.update({
  data: fetchedData,
  expandLevel: 5,
  selectedNodeClass: 'custom-selected'
});
```

**Updatable Properties:**
All Tree props can be updated except snippets/templates, including:
- Data and state: `data`, `searchText`, `selectedNode`, `expandLevel`
- Members: `idMember`, `pathMember`, `displayValueMember`, `searchValueMember`
- Callbacks: `sortCallback`, `getDisplayValueCallback`, `onNodeClicked`, etc.
- Visual: `bodyClass`, `selectedNodeClass`, `expandIconClass`, etc.
- Context menu: `contextMenuCallback`, `contextMenuXOffset`, `contextMenuYOffset`
- Behavior: `clickBehavior`, `shouldUseInternalSearchIndex`, etc.

### Debug Information

Enable debug information to see real-time tree statistics and console logging:

```svelte
<Tree
  {data}
  idMember="path"
  pathMember="path"
  shouldDisplayDebugInformation={true}
/>
```

#### Debug Panel
The visual debug panel shows:
- Tree ID
- Data array length
- Expand level setting
- Node count
- Maximum depth levels
- Filtered node count (when filtering is active)
- Search indexing progress (when indexing is active)
- Currently dragged node

#### Console Debug Logging
When enabled, the component will log detailed information to the browser console including:

**Tree Operations:**
- Data mapping and sorting performance metrics
- Node filtering and search operations
- Tree structure changes

**Async Search Indexing:**
- Indexer initialization with batch size
- Queue management (items added, queue size)
- Batch processing details (timeout status, items processed, timing)
- Indexing completion and progress updates

This provides valuable insights for performance optimization and troubleshooting, especially when working with large datasets or complex search operations.

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
  virtualScroll={true}
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

## License

MIT License - see LICENSE file for details.

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/keenmate/svelte-treeview/issues)
- **Live demo & docs**: [svelte-treeview.keenmate.dev](https://svelte-treeview.keenmate.dev)

---

Built with ❤️ by [KeenMate](https://github.com/keenmate)
