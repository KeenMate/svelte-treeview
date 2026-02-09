# @keenmate/svelte-treeview

A high-performance, feature-rich hierarchical tree view component for Svelte 5 with drag & drop support, search functionality, and flexible data structures using LTree.

> [!IMPORTANT]
> **Looking for a framework-agnostic solution?** There's also a web component version that can be used standalone or in other frameworks at https://github.com/KeenMate/web-treeview/

## 🚀 Features

- **Svelte 5 Native**: Built specifically for Svelte 5 with full support for runes and modern Svelte patterns
- **High Performance**: Uses LTree data structure for efficient hierarchical data management
- **Drag & Drop**: Built-in drag and drop support with validation and visual feedback
- **Search & Filter**: Integrated FlexSearch for fast, full-text search capabilities
- **Flexible Data Sources**: Works with any hierarchical data structure
- **Context Menus**: Dynamic right-click menus with callback-based generation, icons, disabled states
- **Visual Customization**: Extensive styling options and icon customization
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions
- **Accessibility**: Built with accessibility in mind

## 📦 Installation

```bash
npm install @keenmate/svelte-treeview
```

## 🔨 Development Setup

For developers working on the project, you can use either standard npm commands or the provided Makefile (which provides a unified interface for all contributors):

```bash
# Using Makefile (recommended for consistency)
make setup      # or make install
make dev

# Or using standard npm commands
npm install
npm run dev
```

## 🎨 Importing Styles

The component requires CSS to display correctly. Import the styles in your app:

### Option 1: Import SCSS in your main app file
```javascript
// In your main.js or main.ts
import '@keenmate/svelte-treeview/styles.scss';
```

### Option 2: Import in your Svelte component
```svelte
<style>
  @import '@keenmate/svelte-treeview/styles.scss';
</style>
```

### Option 3: Use with your build system
If using Vite, Webpack, or similar, you can import the SCSS:
```javascript
import '@keenmate/svelte-treeview/styles.scss';
```

## ⚠️ Performance Warning: Use `$state.raw()` for Large Datasets

> [!WARNING]
> **When passing large arrays (1000+ items) to the Tree component, use `$state.raw()` instead of `$state()` to avoid severe performance issues.**

Svelte 5's `$state()` creates deep proxies for all nested objects. With thousands of items, this causes massive overhead during tree operations.

```typescript
// ❌ SLOW - Each item becomes a Proxy (5000x slower with large datasets)
let treeData = $state<TreeNode[]>([])

// ✅ FAST - Items remain plain objects
let treeData = $state.raw<TreeNode[]>([])
```

**Symptoms of this issue:**
- Tree takes 15-90+ seconds to render with thousands of items
- Console shows `[Violation] 'message' handler took XXXXms`
- Same data loads instantly in isolated test

The array itself remains reactive - only individual items lose deep reactivity (which Tree doesn't need).

## 🎯 Quick Start

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

## 🔧 Advanced Usage

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
  onNodeClicked={(node) => console.log('Clicked:', node.data.name)}
>
  {#snippet nodeTemplate(node)}
    <div class="d-flex align-items-center">
      <span class="me-2">{node.data.icon}</span>
      <strong>{node.data.name}</strong>
      {#if node.data.size}
        <small class="text-muted ms-2">({node.data.size})</small>
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

```svelte
<script lang="ts">
  import { Tree } from '@keenmate/svelte-treeview';
  
  const sourceData = [
    { path: '1', name: 'Item 1', isDraggable: true },
    { path: '2', name: 'Item 2', isDraggable: true }
  ];
  
  const targetData = [
    { path: 'zone1', name: 'Drop Zone 1' },
    { path: 'zone2', name: 'Drop Zone 2' }
  ];
  
  function onDragStart(node, event) {
    console.log('Dragging:', node.data.name);
  }
  
  function onDrop(dropNode, draggedNode, event) {
    console.log(`Dropped ${draggedNode.data.name} onto ${dropNode.data.name}`);
    // Handle the drop logic here
  }
</script>

<div class="row">
  <div class="col-6">
    <Tree
      data={sourceData}
      idMember="path"
      pathMember="path"
      onNodeDragStart={onDragStart}
    />
  </div>
  
  <div class="col-6">
    <Tree
      data={targetData}
      idMember="path"
      pathMember="path"
      dragOverNodeClass="ltree-dragover-highlight"
      onNodeDrop={onDrop}
    />
  </div>
</div>
```

### With Context Menus

The tree supports context menus with two approaches: callback-based (recommended) and snippet-based.

#### Callback-Based Context Menus

```svelte
<script lang="ts">
  import { Tree } from '@keenmate/svelte-treeview';
  import type { ContextMenuItem } from '@keenmate/svelte-treeview';

  const data = [
    { path: '1', name: 'Documents', type: 'folder', canEdit: true, canDelete: true },
    { path: '1.1', name: 'report.pdf', type: 'file', canEdit: true, canDelete: false },
    { path: '2', name: 'Images', type: 'folder', canEdit: false, canDelete: true }
  ];

  function createContextMenu(node): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    // Always available
    items.push({
      icon: '📂',
      title: 'Open',
      callback: () => alert(`Opening ${node.data.name}`)
    });

    // Conditional actions based on node data
    if (node.data.canEdit) {
      items.push({
        icon: '✏️',
        title: 'Edit',
        callback: () => alert(`Editing ${node.data.name}`)
      });
    }

    if (node.data.canDelete) {
      items.push({
        icon: '🗑️',
        title: 'Delete',
        callback: () => confirm(`Delete ${node.data.name}?`) && alert('Deleted!')
      });
    }

    // Divider
    items.push({ isDivider: true });

    // Disabled item example
    items.push({
      icon: '🔒',
      title: 'Restricted Action',
      isDisabled: true,
      callback: () => {}
    });

    return items;
  }
</script>

<Tree
  {data}
  idMember="path"
  pathMember="path"
  contextMenuCallback={createContextMenu}
  contextMenuXOffset={8}
  contextMenuYOffset={0}
/>
```

#### Snippet-Based Context Menus

```svelte
<Tree
  {data}
  idMember="path"
  pathMember="path"
>
  {#snippet contextMenu(node, closeMenu)}
    <div class="context-menu-item" onclick={() => { alert(`Open ${node.data.name}`); closeMenu(); }}>
      📂 Open
    </div>
    <div class="context-menu-divider"></div>
    <div class="context-menu-item" onclick={() => { alert(`Delete ${node.data.name}`); closeMenu(); }}>
      🗑️ Delete
    </div>
  {/snippet}
</Tree>
```

#### Context Menu Features

- **Dynamic menus**: Generate menu items based on node properties
- **Icons and dividers**: Visual organization and identification
- **Disabled states**: Context-sensitive menu availability
- **Position offset**: `contextMenuXOffset`/`contextMenuYOffset` for cursor clearance
- **Auto-close**: Closes on scroll, click outside, or programmatically
- **Type safety**: Full TypeScript support with `ContextMenuItem` interface

## 🎨 Styling and Customization

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
| `ltree-selected-brackets` | Decorative brackets around text | ❯ **Node Text** ❮ |

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

## 📚 API Reference

### Tree Component Props

#### Core Required Properties
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `T[]` | ✅ | Array of data objects |
| `idMember` | `string` | ✅ | Property name for unique identifiers |
| `pathMember` | `string` | ✅ | Property name for hierarchical paths |
| `sortCallback` | `(items: T[]) => T[]` | ✅ | Function to sort items |

#### Data Mapping Properties
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `treeId` | `string \| null` | `null` | Unique identifier for the tree |
| `parentPathMember` | `string \| null` | `null` | Property name for parent path references |
| `levelMember` | `string \| null` | `null` | Property name for node level |
| `isExpandedMember` | `string \| null` | `null` | Property name for expanded state |
| `isSelectedMember` | `string \| null` | `null` | Property name for selected state |
| `isDraggableMember` | `string \| null` | `null` | Property name for draggable state |
| `isDropAllowedMember` | `string \| null` | `null` | Property name for drop allowed state |
| `hasChildrenMember` | `string \| null` | `null` | Property name for children existence |
| `isSorted` | `boolean \| null` | `null` | Whether items should be sorted |

#### Display & Search Properties
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `displayValueMember` | `string \| null` | `null` | Property name for display text |
| `getDisplayValueCallback` | `(node) => string` | `undefined` | Function to get display value |
| `searchValueMember` | `string \| null` | `null` | Property name for search indexing |
| `getSearchValueCallback` | `(node) => string` | `undefined` | Function to get search value |
| `shouldUseInternalSearchIndex` | `boolean` | `false` | Enable built-in search functionality |
| `initializeIndexCallback` | `() => Index` | `undefined` | Function to initialize search index |
| `searchText` | `string` (bindable) | `undefined` | Current search text |

**Note**: When `shouldUseInternalSearchIndex` is enabled, node indexing is performed asynchronously using `requestIdleCallback` (with fallback to `setTimeout`). This ensures the tree renders immediately while search indexing happens during browser idle time, providing better performance for large datasets.

**⚠️ Important**: For internal search indexing to work, you must:
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
| `shouldToggleOnNodeClick` | `boolean` | `true` | Toggle expansion on node click |
| `indexerBatchSize` | `number \| null` | `25` | Number of nodes to process per batch during search indexing |
| `indexerTimeout` | `number \| null` | `50` | Maximum time (ms) to wait for idle callback before forcing indexing |
| `shouldDisplayDebugInformation` | `boolean` | `false` | Show debug information panel with tree statistics and enable console debug logging for tree operations and async search indexing |
| `shouldDisplayContextMenuInDebugMode` | `boolean` | `false` | Display persistent context menu at fixed position for styling development |

#### Event Handler Properties
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onNodeClicked` | `(node) => void` | `undefined` | Node click event handler |
| `onNodeDragStart` | `(node, event) => void` | `undefined` | Drag start event handler |
| `onNodeDragOver` | `(node, event) => void` | `undefined` | Drag over event handler |
| `onNodeDrop` | `(dropNode, draggedNode, event) => void` | `undefined` | Drop event handler |

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

#### Available Slots
| Slot | Description |
|------|-------------|
| `nodeTemplate` | Custom node template |
| `treeHeader` | Tree header content |
| `treeBody` | Tree body content |
| `treeFooter` | Tree footer content |
| `noDataFound` | No data template |
| `contextMenu` | Context menu template |

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

#### ScrollToPath Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `expand` | `boolean` | `true` | Automatically expand parent nodes to make target visible |
| `highlight` | `boolean` | `true` | Apply temporary highlight animation to the target node |
| `scrollOptions` | `ScrollIntoViewOptions` | `{ behavior: 'smooth', block: 'center' }` | Native browser scroll options |

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
- Behavior: `shouldToggleOnNodeClick`, `shouldUseInternalSearchIndex`, etc.

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

### Events

#### onNodeClicked(node)
Triggered when a node is clicked.

#### onNodeDragStart(node, event)
Triggered when drag operation starts.

#### onNodeDragOver(node, event)
Triggered when dragging over a potential drop target.

#### onNodeDrop(dropNode, draggedNode, event)
Triggered when a node is dropped onto another node.

### Slots

#### nodeTemplate
Custom template for rendering node content.

```svelte
{#snippet nodeTemplate(node)}
  <!-- Your custom node content -->
{/snippet}
```

#### contextMenu
Custom context menu template (snippet-based approach).

```svelte
{#snippet contextMenu(node, closeMenu)}
  <button onclick={() => { /* action */ closeMenu(); }}>
    Action
  </button>
{/snippet}
```

### Context Menu Properties

#### contextMenuCallback
Function that generates context menu items dynamically.

```typescript
contextMenuCallback: (node: LTreeNode<T>) => ContextMenuItem[]
```

Where `ContextMenuItem` is:
```typescript
interface ContextMenuItem {
  icon?: string;        // Optional icon (emoji or text)
  title: string;        // Menu item text
  isDisabled?: boolean; // Whether item is disabled
  callback: () => void; // Action to perform
  isDivider?: boolean;  // Render as divider instead of item
}
```

#### contextMenuXOffset
Horizontal offset from cursor position (default: 8px).

#### contextMenuYOffset
Vertical offset from cursor position (default: 0px).

#### shouldDisplayContextMenuInDebugMode
When enabled, displays a persistent context menu at a fixed position for styling development (default: false).

```svelte
<Tree
  {data}
  contextMenuCallback={createContextMenu}
  shouldDisplayContextMenuInDebugMode={true}
  shouldDisplayDebugInformation={true}
  contextMenuXOffset={10}
  contextMenuYOffset={5}
/>
```

**Debug Mode Features:**
- Shows context menu for the second node (or first if only one exists)
- Positions menu 200px right and 100px down from tree's top-left corner
- Persistent display - no need to right-click repeatedly
- Perfect for CSS styling and position testing
- Works with both callback-based and snippet-based context menus

## 🏗️ Data Structure

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
    return a.data.name.localeCompare(b.data.name);
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
      console.log(`✅ ${insertResult.successful} nodes inserted successfully`);
      console.log(`❌ ${insertResult.failed.length} nodes failed to insert`);
      
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

## 🚀 Performance

The component is optimized for large datasets:

- **LTree**: Efficient hierarchical data structure
- **Async Search Indexing**: Uses `requestIdleCallback` for non-blocking search index building
- **Accurate Search Results**: Search index only includes successfully inserted nodes, ensuring results match visible tree structure
- **Consistent Visual Hierarchy**: Optimized CSS-based indentation prevents exponential spacing growth
- **Search Indexing**: Uses FlexSearch for fast search operations

### v4.5 Performance Improvements

**Optimized `insertArray` algorithm** - Fixed O(n²) bottleneck that caused 85+ second load times with large datasets. Now loads 17,000+ nodes in under 100ms.

**Performance Logging** - Built-in performance measurement for debugging:
```typescript
import { enablePerfLogging } from '@keenmate/svelte-treeview';
enablePerfLogging();

// Or from browser console:
window.components['svelte-treeview'].perf.enable()
```

**Important**: See the [$state.raw() warning](#%EF%B8%8F-performance-warning-use-stateraw-for-large-datasets) above - using `$state()` instead of `$state.raw()` for tree data can cause 5,000x slowdown!

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for details.

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/keenmate/svelte-treeview/issues)
- **Documentation**: [Full documentation](https://github.com/keenmate/svelte-treeview#readme)

---

Built with ❤️ by [KeenMate](https://github.com/keenmate)
