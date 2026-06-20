# Clipboard Implementation — Current State

## Package: `@keenmate/svelte-treeview` (core, headless)

### Clipboard Module (`src/lib/core/clipboard.ts`)

Module-level singleton shared across all tree instances on the page (enables cross-tree copy/paste).

**Types:**
- `ClipboardEntry<T>` — `{ sourceTreeId, sourcePath, data: T, descendants: { relativePath, data }[] }`
- `TreeClipboard<T>` — `{ operation: 'copy' | 'cut', entries: ClipboardEntry<T>[], sourceTreeId }`

**Functions:**
- `setClipboard<T>(clip)` — replace clipboard contents
- `getClipboard<T>()` — read clipboard
- `clearClipboard()` — clear
- `hasClipboard()` — boolean check
- `getClipboardOperation()` — `'copy' | 'cut' | null`

All exported from `src/lib/index.ts`.

### TreeController — Clipboard State & Methods

**State:**
```typescript
cutPaths = $state.raw<Set<string>>(new Set());  // paths dimmed during cut
```

**Methods:**

| Method | Signature | Notes |
|--------|-----------|-------|
| `copyNodes` | `(paths?: string[]) => void` | Uses `selectedPaths` if no arg. Clears `cutPaths`. Sets clipboard `operation: 'copy'`. |
| `cutNodes` | `(paths?: string[]) => void` | Uses `selectedPaths` if no arg. Sets `cutPaths` for dimming. Sets clipboard `operation: 'cut'`. Nodes NOT removed yet. |
| `pasteNodes` | `(targetPath: string, transformData: (data: T, index: number, operation: 'copy' \| 'cut') => T, position?: 'child' \| 'before' \| 'after') => { success, count, error? }` | Empty `targetPath` = paste as root. Reconstructs from clipboard snapshot (not live nodes). For cut+same-tree: removes source nodes. Clears clipboard + cutPaths after paste. |
| `cancelCut` | `() => void` | Clears clipboard if operation was 'cut'. Resets `cutPaths`. |
| `hasClipboardContent` | `() => boolean` | Delegates to `hasClipboard()`. |
| `getClipboardOperation` | `() => 'copy' \| 'cut' \| null` | Delegates to module-level function. |

**Private helper:**
- `_collectClipboardEntry(node)` — walks `node.children` recursively, `structuredClone`s all data, collects relative paths for descendants.

### Naming Convention (v5.0.0)

| Category | Prop pattern | Internal storage | Example |
|----------|-------------|-----------------|---------|
| **Event** (fire-and-forget) | `on*` | `on*Handler` | `onNodeClick` → `onNodeClickHandler` |
| **Interceptor** (modify/block) | `before*Callback` | `before*Handler` | `beforeDropCallback` → `beforeDropHandler` |
| **Data provider** (returns data) | `get*Callback` | `get*Handler` | `getContextMenuItemsCallback` → `getContextMenuItemsHandler` |

### TreeController — All Callbacks (renamed)

Stored as plain (non-reactive) properties, set from `TreeControllerProps<T>`:

| Prop (consumer-facing) | Internal storage | Category | Type |
|------------------------|-----------------|----------|------|
| `onNodeClick` | `onNodeClickHandler` | event | `(node) => void` |
| `onSelectionChange` | `onSelectionChangeHandler` | event | `(paths, nodes) => void` |
| `onNodeDragStart` | `onNodeDragStartHandler` | event | `(node, event) => void` |
| `onNodeDragOver` | `onNodeDragOverHandler` | event | `(node, event) => void` |
| `onNodeDrop` | `onNodeDropHandler` | event | `(dropNode, draggedNode, position, event, operation) => void` |
| `onRenderStart` | `onRenderStartHandler` | event | `() => void` |
| `onRenderProgress` | `onRenderProgressHandler` | event | `(stats) => void` |
| `onRenderComplete` | `onRenderCompleteHandler` | event | `(stats) => void` |
| `beforeDropCallback` | `beforeDropHandler` | interceptor | `(dropNode, draggedNode, position, event, operation) => bool/override/void` |
| `beforeCopyCallback` | `beforeCopyHandler` | interceptor | `(paths) => string[] / false / void` |
| `beforeCutCallback` | `beforeCutHandler` | interceptor | `(paths) => string[] / false / void` |
| `beforePasteCallback` | `beforePasteHandler` | interceptor | `(targetPath, operation, entries) => override / false / void` |
| `getContextMenuItemsCallback` | `getContextMenuItemsHandler` | provider | `(node, close, selectedNodes?) => ContextMenuEntry[]` |

### Renames from pre-v5

| Old prop | New prop | Old internal | New internal |
|----------|----------|-------------|-------------|
| `onNodeClicked` | `onNodeClick` | `onNodeClickedCb` | `onNodeClickHandler` |
| `onSelectionChanged` | `onSelectionChange` | `onSelectionChangedCb` | `onSelectionChangeHandler` |
| `contextMenuCallback` | `getContextMenuItemsCallback` | `contextMenuCallbackCb` | `getContextMenuItemsHandler` |
| — | — | `onNodeDragStartCb` | `onNodeDragStartHandler` |
| — | — | `onNodeDragOverCb` | `onNodeDragOverHandler` |
| — | — | `beforeDropCallbackCb` | `beforeDropHandler` |
| — | — | `onNodeDropCb` | `onNodeDropHandler` |
| — | — | `onRenderStartCb` | `onRenderStartHandler` |
| — | — | `onRenderProgressCb` | `onRenderProgressHandler` |
| — | — | `onRenderCompleteCb` | `onRenderCompleteHandler` |

**No keyboard handling in core** — core is headless, keyboard is the renderer's responsibility.

### Auto-Handle Flags (Database-First Pattern)

For large trees (50k+ nodes), consumers need the "database-first" workflow:
1. User drops/pastes → tree does NOT auto-modify
2. Consumer sends operation to database
3. Database recalculates (paths, names, counts, etc.)
4. Database returns ONLY changed nodes
5. Consumer surgically updates via `updateNode`/`addNode`/`removeNode`

**Flags on `TreeControllerProps<T>`:**

| Prop | Type | Default | Effect when `false` |
|------|------|---------|---------------------|
| `shouldAutoHandleMove` | `boolean` | `true` | Same-tree move: skips `moveNode()`, still fires `onNodeDrop` |
| `shouldAutoHandleCopy` | `boolean` | `true` | Same-tree copy: skips `copyNodeWithDescendants()`, still fires `onNodeDrop` |
| `shouldAutoHandlePaste` | `boolean` | `true` | Paste: skips `addNode`/`removeNode`, fires `onPaste` with clipboard data |

When `shouldAutoHandleMove=false` or `shouldAutoHandleCopy=false`:
- `beforeDropCallback` still fires (validation/blocking)
- `onNodeDrop` fires with full info (source, target, position, operation)
- Consumer handles everything in `onNodeDrop` (async DB call → surgical updates)

When `shouldAutoHandlePaste=false`:
- `beforePasteCallback` still fires (validation/blocking)
- `onPaste` fires with `{ success: true, count, entries, operation, targetPath }` — includes clipboard data
- Consumer handles DB call → surgical updates
- `cutPaths` and clipboard are still cleared

**Consumer example (database-first move):**
```typescript
<Tree
    shouldAutoHandleMove={false}
    onNodeDrop={async (dropNode, draggedNode, position, event, operation) => {
        isLoading = true;

        // 1. Send to database
        const changes = await api.moveNode(draggedNode.data.id, dropNode.data.id, position);

        // 2. Surgical update — only affected nodes
        for (const change of changes) {
            if (change.type === 'update') ctrl.updateNode(change.path, change.data);
            if (change.type === 'add') ctrl.addNode(change.parentPath, change.data);
            if (change.type === 'remove') ctrl.removeNode(change.path);
        }

        isLoading = false;
    }}
/>
```

### Data Sync in `addNode`/`removeNode`/`moveNode`

When auto-handle IS enabled, ltree syncs data object fields back after mutations:

**`addNode`** syncs on new node:
- `data[pathMember]` = new path
- `data[parentPathMember]` = parent path
- `data[levelMember]` = calculated level
- `data[hasChildrenMember]` = false
- Parent's `data[hasChildrenMember]` = true

**`removeNode`** syncs on parent:
- `data[hasChildrenMember]` = false (when parent becomes childless)

**`moveNode`** syncs on moved node + descendants:
- `data[pathMember]` = new path
- `data[parentPathMember]` = new parent path
- `data[levelMember]` = new level
- Source parent `data[hasChildrenMember]` = false (when childless)
- Target parent `data[hasChildrenMember]` = true

---

## Package: `@keenmate/svelte-treeview-canvas` (renderer)

### CanvasTree — All Event/Callback Props

| Prop | Type | Notes |
|------|------|-------|
| `onNodeClick` | `(node: LTreeNode<T>) => void` | event |
| `onSelectionChange` | `(paths: Set<string>, nodes: LTreeNode<T>[]) => void` | event (was `onSelectionChanged`) |
| `onNodeDrop` | `(source, target, position) => void` | event |
| `onPaste` | `(result: { success, count, error? }) => void` | event |
| `onKeyDown` | `(e: KeyboardEvent, controller) => void` | event (new — raw keyboard interception) |
| `getNodeContextMenuItemsCallback` | `(node, selectedNodes?) => ContextMenuEntry[]` | provider (was `onNodeContextMenu`) |
| `getGroupContextMenuItemsCallback` | `(parentNode, childNodes) => ContextMenuEntry[]` | provider (was `onGroupContextMenu`) |
| `getCanvasContextMenuItemsCallback` | `() => ContextMenuEntry[]` | provider (was `onCanvasContextMenu`) |
| `enableClipboard` | `boolean` (default `false`) | Enables Ctrl+C/X/V handling |
| `transformDataForPaste` | `(data: T, index: number, operation: 'copy' \| 'cut') => T` | Required if `enableClipboard=true` |
| `onPaste` | `(result: { success: boolean; count: number; error?: string }) => void` | Called after paste |

### CanvasTree — Keyboard Handling (`onKeyDown`)

Processing order (first match wins):
1. **Context menu shortcuts** — only when `ctrlRef.contextMenuVisible` is true. Parses `shortcut` strings from menu entries (e.g. `'Ctrl+Shift+C'`), matches against the key event.
2. **Canvas context menu shortcuts** — only when `canvasMenuVisible` is true. Same parsing.
3. **Clipboard shortcuts** — when `enableClipboard` is true and no menu is open:
   - `Ctrl+C` → `ctrlRef.copyNodes()`
   - `Ctrl+X` → `ctrlRef.cutNodes()`
   - `Ctrl+V` → `ctrlRef.pasteNodes(selectedPath ?? '', transformDataForPaste, 'child')`
   - `Escape` → `ctrlRef.cancelCut()` (only if clipboard operation is 'cut')
4. **Navigation** — arrow keys, Enter (toggle expand), etc.

**No `onKeyDown` prop** — consumer cannot intercept or extend keyboard handling.

### CanvasTree — Cut Dimming (draw function)

For each node during rendering:
```typescript
const isCut = ctrlRef ? ctrlRef.cutPaths.has(n.node.path) : false;
// LOD simple: wraps drawNodeSimple with globalAlpha 0.4
// LOD medium/full: ctx.globalAlpha = isDragSrc ? 0.3 : isCut ? 0.4 : isSearchDimmed ? 0.25 : 1
```

### canvas-interaction.ts — Empty Click

`InteractionCallbacks<T>` interface includes:
```typescript
onEmptyClick?: () => void;
```
Fired when click on empty canvas (pan distance < 5px, no node hit, no Ctrl/Shift). CanvasTree wires this to deselect all nodes + clear `selectedPath`.

### Dendrogram Example — Clipboard Usage

```typescript
let enableClipboard = $state(true);
let nextPasteId = $state(10000);

function transformDataForPaste(data: TreeItem, index: number, operation: 'copy' | 'cut'): TreeItem {
  return {
    ...data,
    id: nextPasteId++,
    name: operation === 'copy' ? `${data.name} (copy)` : data.name
  };
}
```

Context menus add Copy/Cut/Paste items (single node, multi-selection, and group).

---

## Design: Extensibility & Custom Shortcuts

### Problem

The consumer cannot:
1. Add custom keyboard shortcuts (e.g. `Shift+Ctrl+C` = "copy whole branch")
2. Modify standard copy/cut/paste behavior (e.g. always expand selection to descendants)
3. Block standard operations under certain conditions

### Solution: Two Layers

#### Layer 1: `onKeyDown` prop (CanvasTree)

Raw keyboard interception. Fires **before** all built-in handling. Consumer calls `e.preventDefault()` to suppress built-in behavior.

```typescript
// CanvasTree prop
onKeyDown?: (e: KeyboardEvent, controller: TreeController<T>) => void;
```

**Processing order in CanvasTree's internal handler:**
1. Skip if target is input/textarea
2. **`onKeyDown` callback** — consumer gets first shot, can `preventDefault()`
3. Context menu shortcuts (when menu is open)
4. Clipboard shortcuts (Ctrl+C/X/V)
5. Navigation (arrows, Enter, etc.)

**Consumer example — custom shortcut:**
```typescript
function handleKeyDown(e: KeyboardEvent, ctrl: TreeController<TreeItem>) {
    // Shift+Ctrl+C: copy node + all descendants
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        const selected = [...ctrl.selectedPaths];
        const allPaths = new Set(selected);
        for (const p of selected) {
            collectDescendantPaths(ctrl, p, allPaths);
        }
        ctrl.copyNodes([...allPaths]);
        e.preventDefault(); // suppress built-in Ctrl+C
    }
}
```

#### Layer 2: `beforeCopyCallback` / `beforeCutCallback` / `beforePasteCallback` (TreeController)

Intercept standard operations to modify or block them. Lives on TreeController (headless) so both HTML and Canvas renderers benefit.

```typescript
// TreeControllerProps<T>
beforeCopyCallback?: (paths: string[]) => string[] | false | void;
beforeCutCallback?: (paths: string[]) => string[] | false | void;
beforePasteCallback?: (
    targetPath: string,
    operation: 'copy' | 'cut',
    entries: ClipboardEntry<T>[]
) => { targetPath?: string; position?: 'child' | 'before' | 'after' } | false | void;
```

**Return values:**
- `void` / `undefined` — proceed with standard behavior, no changes
- `false` — block the operation entirely
- `string[]` (copy/cut) — replace the paths to operate on (e.g. expand to include descendants)
- `object` (paste) — override target path or position

**Consumer examples:**

```typescript
// Always copy whole branches (modify)
beforeCopyCallback: (paths) => {
    const allPaths = new Set(paths);
    for (const p of paths) {
        collectDescendantPaths(ctrl, p, allPaths);
    }
    return [...allPaths];
}

// Block cut on root-level nodes (block)
beforeCutCallback: (paths) => {
    if (paths.some(p => !p.includes('.'))) return false;
}

// Block paste into level 3+ nodes (block)
beforePasteCallback: (targetPath, operation, entries) => {
    const node = ctrl.getNodeByPath(targetPath);
    if (node && (node.level ?? 0) >= 3) return false;
}

// Redirect paste to parent (modify)
beforePasteCallback: (targetPath, operation, entries) => {
    const node = ctrl.getNodeByPath(targetPath);
    if (node?.parentPath) {
        return { targetPath: node.parentPath, position: 'after' };
    }
}
```

### Full Pipeline

```
Keyboard event
  │
  ├─► onKeyDown callback (consumer intercepts raw key, can preventDefault)
  │     ↓ (if not prevented)
  ├─► Built-in shortcut matching (Ctrl+C → copyNodes, etc.)
  │     ↓
  ├─► beforeCopyCallback / beforeCutCallback / beforePasteCallback
  │     ↓ (if not blocked, with possibly modified args)
  ├─► Standard operation (copyNodes / cutNodes / pasteNodes)
  │     ↓
  └─► onPaste callback (result notification, paste only)
```

Mirrors the existing drag & drop pipeline: keyboard event → `beforeDropCallback` → `handleDrop` → `onNodeDrop`.

### Where Each Piece Lives

| What | Where | Why |
|------|-------|-----|
| `beforeCopyCallback` | TreeController (core) | Headless — works for any renderer |
| `beforeCutCallback` | TreeController (core) | Headless — works for any renderer |
| `beforePasteCallback` | TreeController (core) | Headless — works for any renderer |
| `onKeyDown` | CanvasTree prop (canvas) | Keyboard is renderer-specific |
| `onPaste` | CanvasTree prop (canvas) | Already exists, renderer-level notification |
