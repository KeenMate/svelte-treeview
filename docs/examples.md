# Examples / cookbook

Recipes for the most common features. Each recipe is self-contained — paste into a Svelte file and adapt.

For the full Props / Methods reference, see [`docs/usage.md`](./usage.md).
For live demos, see [svelte-treeview.keenmate.dev](https://svelte-treeview.keenmate.dev).

## Custom node templates

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
  selectedNodeClass="stv__selected--bold"
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

## Search and filtering

```svelte
<script lang="ts">
  import { Tree } from '@keenmate/svelte-treeview';

  let searchText = $state('');
  const data = [/* your data */];
</script>

<input type="text" placeholder="Search..." bind:value={searchText} />

<Tree
  {data}
  idMember="path"
  pathMember="path"
  shouldUseInternalSearchIndex={true}
  searchValueMember="name"
  bind:searchText
/>
```

### Advanced search options

```svelte
<script lang="ts">
  import { Tree } from '@keenmate/svelte-treeview';
  import type { SearchOptions } from 'flexsearch';

  let treeRef;
  const data = [/* your data */];

  function performAdvancedSearch(searchTerm: string) {
    const searchOptions: SearchOptions = {
      suggest: true,        // Enable suggestions for typos
      limit: 10,            // Limit results to 10 items
      bool: "and"           // Use AND logic for multiple terms
    };
    const results = treeRef.searchNodes(searchTerm, searchOptions);
    console.log('Advanced search results:', results);
  }

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

<button onclick={() => performAdvancedSearch('document')}>Advanced Search</button>
<button onclick={() => filterWithOptions('project')}>Filter with Options</button>
```

#### FlexSearch options reference

`searchOptions` accepts any FlexSearch option. Common ones:

| Option | Type | Description | Example |
|--------|------|-------------|---------|
| `suggest` | `boolean` | Enable suggestions for typos | `{ suggest: true }` |
| `limit` | `number` | Maximum number of results | `{ limit: 10 }` |
| `threshold` | `number` | Similarity threshold (0-1) | `{ threshold: 0.8 }` |
| `depth` | `number` | Search depth for nested content | `{ depth: 2 }` |
| `bool` | `string` | Boolean logic: "and", "or" | `{ bool: "and" }` |
| `where` | `object` | Filter by field values | `{ where: { type: "folder" } }` |

Full reference: [FlexSearch options](https://github.com/nextapps-de/flexsearch#options).

## Drag & drop

**Note**: drag and drop is disabled by default. Set `dragDropMode` to enable it.

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

  // Same-tree moves are auto-handled — this callback is for notification/custom logic
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
  dragOverNodeClass="stv__dragover--highlight"
  onNodeDragStart={onDragStart}
  onNodeDrop={onDrop}
/>
```

### Drop position control

When `dropZoneMode="floating"`, users can pick where to drop:

- **Before** — insert as sibling before the target node
- **After** — insert as sibling after the target node
- **Child** — insert as child of the target node

### Per-node drop position restrictions

Restrict which positions a node accepts:

- **Trash / recycle bin** — only allow dropping INTO (`['child']`)
- **Files** — only allow before/after (`['before', 'after']`) — can't drop into a file
- **Folders** — allow all positions (default)

```svelte
<script lang="ts">
  import { Tree, type DropPosition, type LTreeNode } from '@keenmate/svelte-treeview';

  function getAllowedDropPositions(node: LTreeNode<MyItem>): DropPosition[] | null {
    if (node.data?.type === 'file') return ['before', 'after'];
    if (node.data?.type === 'trash') return ['child'];
    return undefined; // all positions allowed
  }
</script>

<Tree {data} getAllowedDropPositionsCallback={getAllowedDropPositions} />
```

Or the member-based form for server-side data:

```svelte
<Tree {data} allowedDropPositionsMember="allowedDropPositions" />
<!-- Where data items have: { allowedDropPositions: ['child'] } -->
```

Behavior under restrictions:
- **Glow mode** — snaps to the nearest allowed position
- **Floating mode** — only renders buttons for allowed positions

### Async drop validation

Use `beforeDropCallback` to validate or modify drops, including async confirmation dialogs:

```svelte
<script lang="ts">
  async function beforeDrop(dropNode, draggedNode, position, event, operation) {
    if (draggedNode.data.locked) return false;  // cancel the drop

    if (position === 'child' && !dropNode.data.isFolder) {
      const confirmed = await showConfirmDialog('Drop as sibling instead?');
      if (!confirmed) return false;
      return { position: 'after' };  // override position
    }

    return true;
  }
</script>

<Tree {data} beforeDropCallback={beforeDrop} onNodeDrop={onDrop} />
```

## Tree editing

The tree exposes methods for programmatic editing:

```svelte
<script lang="ts">
  import { Tree } from '@keenmate/svelte-treeview';

  let treeRef: Tree<MyNode>;

  function addChild() {
    const result = treeRef.addNode(
      selectedNode?.path || '', // parent path (empty = root)
      { id: Date.now(), path: '', name: 'New Item', sortOrder: 100 }
    );
    if (result.success) console.log('Added:', result.node);
  }

  function moveUp() {
    const siblings = treeRef.getSiblings(selectedNode.path);
    const index = siblings.findIndex(s => s.path === selectedNode.path);
    if (index > 0) {
      treeRef.moveNode(selectedNode.path, siblings[index - 1].path, 'before');
    }
  }

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

**Note**: when using `orderMember`, the tree automatically calculates sort order values when moving nodes with `'before'` or `'after'` positions.

## Context menus

The tree supports two context-menu styles: **callback-based** (imperative, shared with web components) and **snippet + component** (declarative, Svelte-only).

### Callback-based

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

### Snippet + component

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

### Context menu features

- **Unified types** — `ContextMenuItem`, `ContextMenuDivider`, `ContextMenuEntry` shared across svelte-treeview and canvas-tree
- **Keyboard shortcuts** — `shortcut` field renders a hint and activates on keypress when menu is open (supports `Ctrl+`, `Shift+`, `Alt+` modifiers)
- **Submenus** — `children` array opens nested menus on hover
- **Named dividers** — `{ divider: true, label: 'Section' }` renders as `---- Section ----`
- **Visibility control** — `isVisible: false` hides items (callback approach); snippet approach uses `{#if}`
- **Flexible styling** — `className="danger"` or any custom CSS class
- **Dynamic menus** — generate items based on node properties
- **Icons and disabled states** — visual organization and context-sensitive availability
- **Position offset** — `contextMenuXOffset` / `contextMenuYOffset` for cursor clearance
- **Auto-close** — closes after activating an item, and on scroll, click outside, Escape key, or programmatically. Calling the `close` callback in your handler is optional (the menu closes itself); set `shouldCloseOnClick: false` on an item to keep the menu open for incremental actions (a toggle, a counter) and dismiss it yourself via `close` when done
