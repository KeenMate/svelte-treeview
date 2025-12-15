# Tree Manipulation - Deep Analysis

This document provides a comprehensive analysis of all node manipulation features in `@keenmate/svelte-treeview`, including CRUD operations, drag-and-drop pipeline, and how the pieces work together.

## Table of Contents

1. [Overview](#overview)
2. [Node CRUD Operations](#node-crud-operations)
3. [Helper Methods](#helper-methods)
4. [Drag-and-Drop Pipeline](#drag-and-drop-pipeline)
5. [Touch Drag Support](#touch-drag-support)
6. [Empty Tree Drops](#empty-tree-drops)
7. [Auto-handling of Same-Tree Moves](#auto-handling-of-same-tree-moves)
8. [Callback Signatures](#callback-signatures)
9. [Usage Examples](#usage-examples)

---

## Overview

### Architecture

The tree manipulation system consists of two layers:

1. **Core Layer** (`src/lib/ltree/ltree.svelte.ts`) - Pure tree operations
2. **Component Layer** (`src/lib/components/Tree.svelte`) - Wrapper methods + drag-drop handling

### Key Concepts

- **Path-based hierarchy**: Nodes identified by paths like `"1"`, `"1.2"`, `"1.2.3"`
- **Segment prefix**: Internal children keys prefixed with `'x'` for object ordering
- **Change tracking**: Symbol-based reactivity via `changeTracker`
- **Order member**: Optional field for sibling ordering during drag-drop

---

## Node CRUD Operations

### addNode() - Create a New Node

**Location:** `ltree.svelte.ts:905-967`, exposed in `Tree.svelte:270-275`

```typescript
addNode(parentPath: string, data: T, pathSegment?: string):
  { success: boolean; node?: LTreeNode<T>; error?: string }
```

**Parameters:**
- `parentPath` - Path of parent node (`""` for root level)
- `data` - Data object for the new node
- `pathSegment` - Optional; auto-generated if not provided

**What happens when you call addNode():**

1. Retrieves parent node via `getNodeByPath(parentPath)`
2. Returns error if parent doesn't exist (unless root)
3. Auto-generates `pathSegment` if not provided:
   - Uses `idMember` value from data if available
   - Falls back to: `new_${Date.now()}_${random}`
4. Builds full path: `${parentPath}${separator}${pathSegment}`
5. Creates new `LTreeNode<T>` with all properties
6. Updates path in data if `pathMember` defined
7. Adds node to parent's children
8. Updates statistics (`nodeCount`, `maxLevel`)
9. Adds to `flatTreeNodes` for search indexing
10. **Calls `refreshSiblings(parentPath)`** to re-sort
11. Emits tree change via `_emitTreeChanged()`

---

### removeNode() - Delete a Node

**Location:** `ltree.svelte.ts:858-896`, exposed in `Tree.svelte:263-268`

```typescript
removeNode(path: string, includeDescendants: boolean = true):
  { success: boolean; node?: LTreeNode<T>; error?: string }
```

**Parameters:**
- `path` - Path of node to remove
- `includeDescendants` - If true (default), removes all descendants

**What happens when you call removeNode():**

1. Retrieves node via `getNodeByPath(path)`
2. Returns error if not found
3. Gets parent node
4. Removes from parent's children object
5. Updates parent's `hasChildren` flag
6. Updates `nodeCount` (recursive count if `includeDescendants`)
7. Emits tree change

---

### updateNode() - Modify Node Data

**Location:** `ltree.svelte.ts:975-1009`, exposed in `Tree.svelte:277-282`

```typescript
updateNode(path: string, dataUpdates: Partial<T>):
  { success: boolean; node?: LTreeNode<T>; error?: string }
```

**Parameters:**
- `path` - Path of node to update
- `dataUpdates` - Partial object to merge into existing data

**What happens when you call updateNode():**

1. Retrieves node via `getNodeByPath(path)`
2. Returns error if not found or has no data
3. Detects if `orderMember` field is being updated
4. Merges updates: `node.data = { ...node.data, ...dataUpdates }`
5. Re-indexes for search if enabled
6. **If `orderMember` was updated: calls `refreshSiblings()`**
7. Emits tree change

---

### moveNode() - Rearrange Node Position

**Location:** `ltree.svelte.ts:708-824`, exposed in `Tree.svelte:256-261`

```typescript
moveNode(sourcePath: string, targetPath: string, position: 'above' | 'below' | 'child'):
  { success: boolean; error?: string }
```

**Parameters:**
- `sourcePath` - Path of node to move
- `targetPath` - Reference node path
- `position` - Where to place relative to target:
  - `'child'` - As child of target
  - `'above'` - As sibling before target
  - `'below'` - As sibling after target

**What happens when you call moveNode():**

1. **Validation:**
   - Find source and target nodes
   - Prevent moving into itself or descendants

2. **Remove from old location:**
   - Remove from parent's children
   - Update parent's `hasChildren`

3. **Calculate new location:**
   - `'child'`: new parent = target
   - `'above'`/`'below'`: new parent = target's parent

4. **Handle segment collision:**
   - Reuse original segment if possible
   - Try node ID, then timestamp-based name

5. **Update paths:**
   - Update source node's `path`, `parentPath`, `level`
   - **Recursively update ALL descendants** via `_updateDescendantPaths()`

6. **Handle ordering:**
   - Calculate midpoint order value between neighbors
   - Assign to moved node

7. **Finalize:**
   - Insert into new parent's children
   - **Call `refreshSiblings()`** to re-sort
   - Emit tree change

---

### applyChanges() - Batch Operations

**Location:** `ltree.svelte.ts:1016-1073`, exposed in `Tree.svelte:284-289`

```typescript
applyChanges(changes: TreeChange<T>[]): ApplyChangesResult
```

**Types:**
```typescript
type TreeChange<T> =
  | { operation: 'create'; parentPath: string; data: T; pathSegment?: string }
  | { operation: 'update'; path: string; data: Partial<T> }
  | { operation: 'delete'; path: string }

interface ApplyChangesResult {
  successful: number;
  failed: Array<{ index: number; operation: string; path: string; error: string }>
}
```

**What happens:**

1. Iterates through changes array
2. For each change, executes corresponding operation
3. Collects failures with details
4. **Single `_emitTreeChanged()` after all changes** (not per-change)
5. Returns success count and failure details

---

## Helper Methods

### refreshSiblings() - Re-sort Siblings

**Location:** `ltree.svelte.ts:645-688`

```typescript
refreshSiblings(parentPath: string): void
```

**What it does:**

1. Gets parent node (or root if empty path)
2. Gets all children as array
3. Sorts using `sortCallback` or default sort:
   - If `orderMember` defined: compare order values
   - Else: compare display values alphabetically
4. Rebuilds children object in sorted order
5. Emits tree change

**Called automatically by:**
- `addNode()` after insertion
- `moveNode()` after relocation
- `updateNode()` if `orderMember` modified

---

### refreshNode() - Refresh Single Node

**Location:** `ltree.svelte.ts:695-699`

```typescript
refreshNode(path: string): void
```

Triggers `_emitTreeChanged()` to force re-render. Useful after external data modifications.

---

### _updateDescendantPaths() - Cascade Path Updates

**Location:** `ltree.svelte.ts:829-850` (internal)

Recursively updates all descendant paths after a move operation:
- Updates `path`, `parentPath`, `level`
- Updates `data[pathMember]` if defined

---

### Accessor Methods

| Method | Signature | Purpose |
|--------|-----------|---------|
| `getNodeByPath` | `(path: string) => LTreeNode<T> \| null` | Find node by path |
| `getChildren` | `(parentPath: string) => LTreeNode<T>[]` | Get direct children |
| `getSiblings` | `(path: string) => LTreeNode<T>[]` | Get sibling nodes |

---

## Drag-and-Drop Pipeline

### Desktop Drag Flow

```
User drags node
    |
    v
Node.svelte: ondragstart
    - Serializes node to dataTransfer ("application/svelte-treeview")
    - Sets effectAllowed = "move"
    |
    v
Tree.svelte: _onNodeDragStart()
    - Sets draggedNode = node
    - Sets isDragInProgress = true
    |
    v
User drags over target
    |
    v
Tree.svelte: _onNodeDragOver()
    - Validates drop allowed (dragDropMode check)
    - Calculates activeDropPosition (above/below/child)
    - Updates hoveredNodeForDrop
    - Sets currentDropOperation (move/copy based on Ctrl)
    |
    v
User drops
    |
    v
Tree.svelte: _onNodeDrop() or _onZoneDrop()
    - Extracts draggedNode from dataTransfer (cross-tree)
    - Validates drop
    |
    v
Tree.svelte: _handleDrop() [CORE]
    - Determines operation (move/copy)
    - Calls beforeDropCallback (can cancel/override)
    - If same-tree move: AUTO-CALLS moveNode()
    - Calls onNodeDrop (notification or user handling)
    |
    v
Tree.svelte: _onNodeDragEnd()
    - Resets all drag state
```

### Position Calculation

**Location:** `Tree.svelte:570-578`

```typescript
function calculateDropPosition(event, element): DropPosition {
  const rect = element.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const height = rect.height;

  if (y < height * 0.25) return 'above';  // Top 25%
  if (y > height * 0.75) return 'below';  // Bottom 25%
  return 'child';                          // Middle 50%
}
```

### Drop Zone Modes

**Glow Mode** (default): Border glow indicates position
- Classes: `ltree-glow-above`, `ltree-glow-below`, `ltree-glow-child`
- Position calculated continuously during dragover

**Floating Mode**: Explicit zone buttons appear
- Three clickable zones: "Above", "Below", "Child"
- User clicks desired zone to drop

---

## Touch Drag Support

### Touch Flow

```
User long-presses (300ms)
    |
    v
Tree.svelte: _onTouchStart()
    - Starts 300ms timer
    - Stores initial touch position
    |
    v
Timer fires
    |
    v
    - Sets isDragging = true
    - Creates ghost element
    - Haptic feedback (50ms vibration)
    |
    v
User moves finger
    |
    v
Tree.svelte: _onTouchMove()
    - If moved >10px before timer: cancel (allow scroll)
    - Moves ghost element to follow finger
    - Finds drop target via elementFromPoint()
    - Highlights target
    |
    v
User lifts finger
    |
    v
Tree.svelte: _onTouchEnd()
    - Finds final drop target
    - Calls _handleDrop(dropNode, draggedNode, 'child', event)
    - Note: Touch always uses 'child' position
    - Cleanup: remove ghost, clear highlights
```

### Ghost Element

```typescript
function createGhostElement(node, x, y) {
  const ghost = document.createElement('div');
  ghost.className = 'ltree-touch-ghost';
  ghost.textContent = tree.getNodeDisplayValue(node);
  ghost.style.left = `${x}px`;
  ghost.style.top = `${y}px`;
  document.body.appendChild(ghost);
}
```

Customizable via CSS variables:
- `--tree-ghost-bg`
- `--tree-ghost-color`

---

## Empty Tree Drops

When dragging to an empty tree, special handlers activate:

**Location:** `Tree.svelte:952-1020`

```
handleEmptyTreeDragOver()
    - Checks dataTransfer type
    - Sets isDropPlaceholderActive = true
    - Shows drop placeholder

handleEmptyTreeDrop()
    - Extracts node from dataTransfer
    - Calls _handleDrop(null, droppedNode, 'child', event)
    - dropNode = null indicates "root level drop"
```

The `onNodeDrop` callback receives `null` as `dropNode` for empty tree drops.

---

## Auto-handling of Same-Tree Moves

**Location:** `Tree.svelte:628-638`

The library automatically handles same-tree move operations:

```typescript
// Inside _handleDrop()
const isSameTreeDrag = draggedNode.treeId === treeId;
if (isSameTreeDrag && operation === 'move' && dropNode) {
  // Library auto-executes the move
  const result = moveNode(draggedNode.path, dropNode.path, position);

  // Still calls onNodeDrop for notification
  onNodeDrop?.(dropNode, draggedNode, position, event, operation);
  return result.success;
}
```

### Operation Matrix

| Scenario | Ctrl Key | Auto-Handled | Who Handles |
|----------|----------|--------------|-------------|
| Same-tree move | No | YES | Library calls `moveNode()` |
| Same-tree copy | Yes | NO | User in `onNodeDrop` |
| Cross-tree move | No | NO | User in `onNodeDrop` |
| Cross-tree copy | Yes | NO | User in `onNodeDrop` |
| Empty tree drop | Any | NO | User in `onNodeDrop` |

### Controlling Auto-handling

Use `beforeDropCallback` to:
- **Cancel**: Return `false`
- **Override position**: Return `{ position: 'child' }`
- **Override operation**: Return `{ operation: 'copy' }`

---

## Callback Signatures

### beforeDropCallback

```typescript
beforeDropCallback?: (
  dropNode: LTreeNode<T> | null,
  draggedNode: LTreeNode<T>,
  position: DropPosition,          // 'above' | 'below' | 'child'
  event: DragEvent | TouchEvent,
  operation: DropOperation         // 'move' | 'copy'
) => boolean | { position?: DropPosition; operation?: DropOperation } | void;
```

**Return values:**
- `false` - Cancel the drop
- `true` or `undefined` - Proceed normally
- `{ position?, operation? }` - Override values

### onNodeDrop

```typescript
onNodeDrop?: (
  dropNode: LTreeNode<T> | null,   // null = empty tree drop
  draggedNode: LTreeNode<T>,
  position: DropPosition,
  event: DragEvent | TouchEvent,
  operation: DropOperation
) => void;
```

**Called for:**
- Same-tree moves (after auto-move, for notification)
- Same-tree copies (user must implement)
- Cross-tree operations (user must implement)
- Empty tree drops (user must implement)

### Other Drag Callbacks

```typescript
onNodeDragStart?: (node: LTreeNode<T>, event: DragEvent) => void;
onNodeDragOver?: (node: LTreeNode<T>, event: DragEvent) => void;
```

---

## Usage Examples

### Basic CRUD Operations

```typescript
let treeRef: Tree<MyData>;

// Add a new node
const addResult = treeRef.addNode('1', {
  id: 'new1',
  name: 'New Item',
  sortOrder: 15
});
if (addResult.success) {
  console.log('Created:', addResult.node?.path);
}

// Update a node
const updateResult = treeRef.updateNode('1.1', {
  name: 'Updated Name',
  sortOrder: 5  // Will trigger re-sort if orderMember='sortOrder'
});

// Move a node
const moveResult = treeRef.moveNode('1.2', '2', 'child');
// Moves 1.2 to become child of 2

// Remove a node
const removeResult = treeRef.removeNode('1.3', true);
// true = include descendants

// Batch operations
const batchResult = treeRef.applyChanges([
  { operation: 'create', parentPath: '1', data: { id: 'n1', name: 'Item 1' } },
  { operation: 'update', path: '1.1', data: { name: 'Updated' } },
  { operation: 'delete', path: '2.1' }
]);
console.log(`${batchResult.successful} succeeded, ${batchResult.failed.length} failed`);
```

### Drag-Drop with Custom Handling

```svelte
<Tree
  bind:this={treeRef}
  data={myData}
  idMember="id"
  pathMember="path"
  orderMember="sortOrder"
  allowCopy={true}
  beforeDropCallback={(dropNode, draggedNode, position, event, operation) => {
    // Prevent dropping folders into files
    if (dropNode?.data?.type === 'file' && position === 'child') {
      return false;
    }
    // Force all drops to be 'child' for certain nodes
    if (dropNode?.data?.alwaysChild) {
      return { position: 'child' };
    }
    return true;
  }}
  onNodeDrop={(dropNode, draggedNode, position, event, operation) => {
    // Same-tree moves are auto-handled, just log
    if (draggedNode.treeId === 'my-tree' && operation === 'move') {
      console.log(`Moved ${draggedNode.path} ${position} ${dropNode?.path}`);
      return;
    }

    // Handle cross-tree or copy operations
    if (operation === 'copy') {
      const newData = { ...draggedNode.data, id: generateId() };
      treeRef.addNode(dropNode?.path || '', newData);
    }
  }}
/>
```

### Manual Re-sorting

```typescript
// After modifying sortOrder values externally
myData.forEach(item => {
  if (item.path.startsWith('1.')) {
    item.sortOrder = Math.random() * 100;
  }
});

// Force re-sort of that parent's children
treeRef.refreshSiblings('1');
```

---

## Internal State Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `draggedNode` | `LTreeNode \| null` | Currently dragged node |
| `isDragInProgress` | `boolean` | Visual drag indicator |
| `hoveredNodeForDrop` | `LTreeNode \| null` | Node under cursor |
| `activeDropPosition` | `DropPosition \| null` | Calculated position |
| `currentDropOperation` | `DropOperation` | 'move' or 'copy' |
| `isDropPlaceholderActive` | `boolean` | Empty tree drop zone |
| `touchDragState` | `object` | Mobile drag tracking |

---

## Code File Reference

| File | Purpose |
|------|---------|
| `src/lib/ltree/ltree.svelte.ts` | Core tree operations (CRUD, move, refresh) |
| `src/lib/components/Tree.svelte` | Component wrapper, drag-drop handlers |
| `src/lib/components/Node.svelte` | Individual node rendering, drag events |
| `src/lib/ltree/types.ts` | Type definitions |
| `src/lib/styles/main.scss` | Drag-drop visual styles |

---

## Version

This documentation reflects `@keenmate/svelte-treeview` v4.5.0+ with:
- Auto-handling of same-tree moves
- Move vs copy operation support (Ctrl+drag)
- Touch drag support with ghost element
- Glow and floating drop zone modes
