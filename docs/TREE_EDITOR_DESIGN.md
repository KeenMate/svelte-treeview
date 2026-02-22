# Tree Editor API Design

This document outlines the design for enhanced tree editing capabilities including drag-and-drop reordering with above/below/child positioning.

## Use Case: In-Browser Tree Editor

User builds/edits a tree structure in browser, then saves to backend:

1. Load existing nodes (have DB ids)
2. Add new nodes via [+] buttons (no DB id yet, just path)
3. Drag/drop to reorganize (paths change)
4. Save entire structure to backend

## Key Design Decisions

### 1. What does dragging a node represent?

- Single node only?
- Node + all descendants (subtree)?
- Should ask user via callback?

**Current approach:** `draggedNode.children` contains full subtree, but it's up to app to decide what to do.

### 2. Who handles data manipulation?

- **Option A:** App handles (current) - tree fires callback, app updates data
- **Option B:** Tree handles internally - built-in move/copy/add methods
- **Option C:** Both - helper methods available but optional

**Recommendation:** Option C - provide helper methods but don't require them.

## Proposed Tree Editor API

```typescript
// Add new node as child of parent
tree.addNode(parentPath: string, data: T): LTreeNode<T>

// Move node to new location
tree.moveNode(sourcePath: string, targetPath: string, position: 'above'|'below'|'child'): boolean

// Remove node (and descendants?)
tree.removeNode(path: string, includeDescendants?: boolean): boolean

// Export current state with updated paths
tree.getData(): T[]

// Optional: get nodes that changed since last getData()
tree.getChanges(): { added: T[], moved: T[], removed: T[] }
```

## Path Management

When nodes move, paths must update:

- The moved node gets new path
- All descendants get new paths (parent path changed)
- Siblings may need reordering for 'above'/'below'

## Sibling Ordering

### The Problem

Path alone can't express "insert between A and B":

- Path `1.1`, `1.2`, `1.3` gives natural order
- Can't create `1.1.5` to insert between

### The Solution: Explicit `order` Field

For above/below positioning to work, user's data model needs an order field:

```typescript
// User's data model
interface MyNode {
  id: number;
  path: string;
  name: string;
  order: number;  // Required for above/below positioning
}

// Example data
{ path: '1.1', name: 'A', order: 10 }
{ path: '1.2', name: 'B', order: 20 }
{ path: '1.3', name: 'C', order: 30 }

// sortCallback respects order within same parent
sortCallback: (nodes) => nodes.sort((a, b) => {
  // First by parent path, then by order
  if (a.parentPath !== b.parentPath) {
    return (a.parentPath || '').localeCompare(b.parentPath || '');
  }
  return (a.data?.order ?? 0) - (b.data?.order ?? 0);
})
```

### Insert "above" B Example

- New node gets `path: '1.{nextId}'` (sibling of B)
- New node gets `order: 15` (between A's 10 and B's 20)
- sortCallback places it correctly in display

### Implications

- above/below features REQUIRE user to have order field
- Tree component doesn't manage order - app does
- Tree just provides position info in callback
- New `orderMember` prop tells tree which field contains order

## Order Recalculation & Partial Refresh

### New Prop

```typescript
orderMember?: string;  // e.g., "sortOrder" - which field contains order value
```

### Who Recalculates Order After Move?

**Option A - Tree handles:**

```typescript
// Tree provides automatic reordering
tree.reorderSiblings(parentPath: string): void
// Sets order values: 10, 20, 30... for all children of parentPath
// Updates user's data via orderMember
```

**Option B - App handles:**

```typescript
// App calculates new order values
// Then triggers partial refresh
tree.refreshNode(path: string): void      // Single node + descendants
tree.refreshSiblings(parentPath: string): void  // All children of parent
```

### Partial Refresh is Critical

- Full tree rebuild on every move = poor UX
- Only update affected branch/siblings
- Keep rest of tree intact (expanded states, etc.)

### Implementation Consideration

- Current `insertArray` rebuilds entire tree
- Need new method that updates in-place
- Or: track which nodes changed, re-render only those

## New vs Existing Nodes

- **Existing:** have DB `id`
- **New:** `id` is null/undefined or has temp client ID
- **On save:** backend creates new nodes, updates existing

## Implementation Phases

### Phase 1: Add `orderMember` Prop
- Add prop to Tree.svelte and pass to Ltree
- Store order value on LTreeNode
- Use in default sort if provided

### Phase 2: Partial Refresh
- Add `tree.refreshSiblings(parentPath)` method
- Update only affected nodes, preserve rest

### Phase 3: Move Node API
- Add `tree.moveNode(sourcePath, targetPath, position)`
- Handle path updates for node + descendants
- Recalculate order values

### Phase 4: Full Editor Example
- Create `/examples/tree-editor` page
- Demonstrate add/move/remove/save flow
