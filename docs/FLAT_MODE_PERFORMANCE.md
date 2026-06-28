# Flat Mode Performance Optimization

## Overview

Flat mode (`isFlatRenderingEnabled=true`) renders all visible nodes in a single `{#each}` loop instead of recursively nesting Node components. This document explains the performance concepts and optimizations implemented.

## The Core Problem

With 5000+ nodes, two operations are expensive:

1. **Initial render**: Creating 5000+ Node components and DOM elements
2. **Expand/collapse**: Svelte's keyed `{#each}` must diff the entire array to find changes

### Why Svelte's Keyed Each is O(n)

```svelte
{#each flatNodesToRender as node (node.id)}
  <Node {node} />
{/each}
```

When the array changes, Svelte:
1. Builds a Map of old keys → old components
2. Builds a Map of new keys → new items
3. Compares to find: unchanged, added, removed
4. Updates DOM accordingly

Even if only 34 nodes are added, Svelte still iterates all 5500 items to compare keys.

## Solution: Progressive Rendering

### Concept

Instead of rendering all nodes at once, we:
1. Track which node IDs have been "rendered" in `flatRenderedIds`
2. Filter `visibleFlatNodes` to only include rendered IDs
3. Gradually add more IDs in batches

```typescript
const flatNodesToRender = $derived(
  visibleFlatNodes.filter(n => flatRenderedIds.has(n.id))
);
```

### Initial Load (Progressive)

```
Frame 1: flatRenderedIds = 50 nodes  → Svelte diffs 0 → 50 (fast!)
Frame 2: flatRenderedIds = 100 nodes → Svelte diffs 50 → 100 (fast!)
Frame 3: flatRenderedIds = 150 nodes → Svelte diffs 100 → 150 (fast!)
...continues until all nodes rendered
```

Each diff is small because the array grows gradually.

### Expand/Collapse (Large Tree Optimization)

When expanding a node in a tree that's already fully rendered:

```
Before: flatRenderedIds = 5500 nodes
Expand: 34 new nodes need to be added
```

**Problem with batching:**
```
Batch 1: Svelte diffs 5500 → 5520 (expensive! iterates 5500+ items)
Batch 2: Svelte diffs 5520 → 5546 (expensive! iterates 5500+ items)
= 2 expensive diffs
```

**Solution - Add all at once:**
```
Single update: Svelte diffs 5512 → 5546 (one expensive diff)
= 1 expensive diff instead of multiple
```

This is why we have the "large tree optimization":

```typescript
if (renderedSnapshot.size > 1000 && newIds.length < 200) {
  // Add all at once - one diff is faster than multiple diffs
  flatRenderedIds = new Set([...flatRenderedIds, ...newIds]);
}
```

## Context-Based Callbacks

### The Problem: Inline Arrow Functions

```svelte
<!-- BAD: Creates new function reference every render -->
{#each nodes as node}
  <Node onNodeClicked={(n) => handleClick(n)} />
{/each}
```

When `nodes` array changes, Svelte checks if Node props changed. The inline arrow function is a NEW reference every time, so Svelte thinks the prop changed and re-evaluates all components.

### The Solution: Stable Context References

```typescript
// Tree.svelte - defined once
const nodeCallbacks = {
  onNodeClicked: _onNodeClicked,
  onNodeDragStart: _onNodeDragStart,
  // ...
};
setContext('NodeCallbacks', nodeCallbacks);
```

```typescript
// Node.svelte - reads from context
const callbacks = getContext('NodeCallbacks');
// Uses callbacks.onNodeClicked(node) instead of prop
```

Now callbacks have stable references - Svelte doesn't see prop changes.

## Configuration Context

Similar to callbacks, configuration values that are the same for all nodes are moved to context:

```typescript
// Tree.svelte
const nodeConfig = {
  expandIconClass,
  collapseIconClass,
  leafIconClass,
  dropZoneMode,
  // ... other stable config
};
setContext('NodeConfig', nodeConfig);
```

This reduces props from ~25 to ~11 per Node component.

## Flat Mode Node Optimizations

In flat mode, Node components skip unnecessary work:

```typescript
// Skip children computation - Tree handles it
const childrenArray = $derived(!flatMode ? Object.values(node?.children || []) : []);

// Skip progressive rendering effect
$effect(() => {
  if (flatMode) return; // Early exit
  // ... recursive mode logic
});
```

## Double-Click Detection (and why not native `dblclick`)

The `onNodeDoubleClick` event and the built-in expand-on-double (in `clickBehavior="select"`) both use **manual detection on the controller**, not the browser's native `dblclick` event. This is a direct consequence of the granular re-render described above — not an oversight.

### Why native `dblclick` doesn't work here

The browser only fires `dblclick` when **both** clicks land on the **same DOM element**. But in this tree, the first click mutates node state (focus, and usually highlight/selection), which bumps `node._rev`. The `_rev`-keyed render then **destroys and recreates the node's content element**. So the second click of a physical double-click lands on a *freshly created* element, the browser can't pair the two clicks, and no `dblclick` is ever synthesized.

This is fundamental, not fixable by one tweak:

- It's not only focus — highlight and selection changes bump `_rev` too, so *any* normal click re-renders the row.
- "Click mutates the node → node re-renders" **is** the granular-update model (the same one that turns 15–90s renders into milliseconds). Making first-click state changes update without recreating the element would mean rebuilding that performance-critical path.
- So native `dblclick` is inherently fragile in a granular-rerender tree, regardless of how the listener is attached.

### Why manual detection is the right call

```typescript
// TreeController._onNodeClicked — runs on every (UI) single click
if (options?.uiClick && !modifiers?.ctrl && !modifiers?.shift) {
  const now = Date.now();
  const isDouble = this._lastClickPath === node.path && now - this._lastClickTime < 400;
  if (isDouble) {
    this.onNodeDoubleClickHandler?.(node);
    if (this.clickBehavior === 'select') { /* toggle expand/collapse */ }
    return; // consume the 2nd click → the gesture is one "open", not a re-toggle
  }
  this._lastClickPath = node.path;
  this._lastClickTime = now;
}
```

- **Survives any re-render strategy** — it tracks `(path, timestamp)` on the controller, which outlives the recreated DOM element. It ignores DOM identity entirely, so future rendering optimizations can't silently break it.
- **Identical in flat and recursive modes** — both route clicks through the same controller method.
- **Gated to genuine UI clicks** (`uiClick`), so programmatic `highlightNode` / `selectNode` calls are never mistaken for a double-click.
- **Threshold is a hardcoded 400ms** — slightly tighter than Windows' 500ms default to avoid coupling unrelated clicks. (It does *not* read the OS double-click interval; switching to a configurable threshold would be the realistic path if native-like timing is ever needed.)

A double-click therefore fires `onNodeClick` once (the first click) plus `onNodeDoubleClick` once; the second click is consumed.

## Performance Summary

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| Initial render (5500 nodes) | ~300ms | ~25ms | 12x faster |
| Expand one node | ~150ms | ~100ms | 1.5x faster |
| No-change update | ~15ms | ~9ms | 1.7x faster |

## Key Insights

1. **Progressive rendering helps initial load** because the array grows gradually (small diffs)

2. **Progressive batching hurts expand/collapse** because we already have 5000+ rendered nodes (each batch = expensive full diff)

3. **Stable function references** prevent Svelte from thinking props changed

4. **Context > Props** for values shared across all nodes

5. **The fundamental limit** is Svelte's O(n) array diffing. To go faster would require:
   - Virtual scrolling (only render viewport)
   - Framework-level optimizations for array inserts

## Future Improvements

1. **Virtual Scrolling**: Only render nodes visible in viewport (~50-100 nodes)
2. **Simplified FlatNode Component**: Minimal component specifically for flat mode
3. **Smarter Collapse**: When collapsing, immediately remove nodes from `flatRenderedIds` to reduce diff size
