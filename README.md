# @keenmate/svelte-treeview

A high-performance, feature-rich hierarchical tree view component for Svelte 5 with drag & drop support, search functionality, and flexible data structures using LTree Trie.

## 🚀 Features

- **Svelte 5 Native**: Built specifically for Svelte 5 with full support for runes and modern Svelte patterns
- **High Performance**: Uses LTree Trie data structure for efficient hierarchical data management
- **Drag & Drop**: Built-in drag and drop support with validation and visual feedback
- **Search & Filter**: Integrated FlexSearch for fast, full-text search capabilities
- **Flexible Data Sources**: Works with any hierarchical data structure
- **Context Menus**: Right-click context menus with customizable actions
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
      onNodeDrop={onDrop}
    />
  </div>
</div>
```

## 🎨 Styling and Customization

The component comes with default styles that provide a clean, modern look. You can customize it extensively:

### CSS Variables

The component uses CSS custom properties for easy theming:

```css
:root {
  --tree-node-indent-per-level: 0.5rem;
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
- `.ltree-draggable` - Draggable nodes
- `.ltree-context-menu` - Context menu styling
- `.ltree-drag-over` - Applied during drag operations
- `.ltree-drop-valid` / `.ltree-drop-invalid` - Drop target validation

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
| `trieId` | `string \| null` | `null` | Unique identifier for the trie |
| `parentPathMember` | `string \| null` | `null` | Property name for parent path references |
| `levelMember` | `string \| null` | `null` | Property name for node level |
| `isExpandedMember` | `string \| null` | `null` | Property name for expanded state |
| `isSelectedMember` | `string \| null` | `null` | Property name for selected state |
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

#### Tree Configuration
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `treeId` | `string \| null` | auto-generated | Unique identifier for the tree |
| `selectedNode` | `LTreeNode<T>` (bindable) | `undefined` | Currently selected node |

#### Behavior Properties
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `shouldToggleOnNodeClick` | `boolean` | `true` | Toggle expansion on node click |

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
| `expandIconClass` | `string \| null` | `"ltree-icon-expand"` | CSS class for expand icons |
| `collapseIconClass` | `string \| null` | `"ltree-icon-collapse"` | CSS class for collapse icons |
| `leafIconClass` | `string \| null` | `"ltree-icon-leaf"` | CSS class for leaf node icons |

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
Custom context menu template.

```svelte
{#snippet contextMenu(node, closeMenu)}
  <button onclick={() => { /* action */ closeMenu(); }}>
    Action
  </button>
{/snippet}
```

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

## 🚀 Performance

The component is optimized for large datasets:

- **LTree Trie**: Efficient hierarchical data structure
- **Virtual Scrolling**: (Coming soon)
- **Lazy Loading**: (Coming soon)
- **Search Indexing**: Uses FlexSearch for fast search operations

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for details.

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/keenmate/svelte-treeview/issues)
- **Documentation**: [Full documentation](https://github.com/keenmate/svelte-treeview#readme)

---

Built with ❤️ by [KeenMate](https://github.com/keenmate)