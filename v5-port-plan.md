# v4.8.0 → v5.0.0 Port Plan

## What was done in v4.8.0 (prod branch)

### Features
| Feature | Status on v5 branch | Action needed |
|---------|---------------------|---------------|
| **Virtual Scroll mode** (`virtualScroll`, `virtualRowHeight`, `virtualOverscan`, `virtualContainerHeight`) | ✅ Ported | None |
| **Search result navigation** (dual-mode filter/search, result counter, prev/next Enter/Shift+Enter, round-robin) | ✅ Ported | None |
| **`searchNodes()` public method** | ✅ Present | None |
| **`scrollToPath` retry logic for virtual scroll** | ✅ Ported | None |

### Bug Fixes
| Fix | Status on v5 branch | Action needed |
|-----|---------------------|---------------|
| **`copyNodeWithDescendants` wrapper missing `siblingPath`/`position`** | ✅ Fixed | None |
| **`treeId` becoming undefined on prop changes** | ✅ Fixed | None |
| **Empty tree drop placeholder ignoring `dragDropMode`** | ✅ Fixed | None |
| **Sort order mismatch in `visibleFlatNodes`** | ✅ Fixed | None |
| **`updateNode` not triggering re-render in flat mode** | ✅ Fixed (`_rev` tracking) | None |
| **`bodyClass` prop not applying custom class** (#24) | ✅ Fixed | None |
| **Sort test `createTestLTree` misaligned args** | ✅ Different on v5 | None |
| **Floating zones clipped by overflow:hidden** | ✅ Fixed (moved to Tree.svelte with position:fixed) | None |
| **Glow+floating showing simultaneously in flat mode** | ✅ Fixed (`$derived` for dropZoneMode) | None |
| **"After" drop placing node at end of root** | ✅ Fixed (parentPath `''` vs `null` inconsistency) | None |

### CSS / Styling
| Change | Status on v5 branch | Action needed |
|--------|---------------------|---------------|
| **Floating zone auto-expand** (`:not(:has())` rules) | ✅ Ported (v5 naming: `ltree-drop-before/after`) | None |
| **Unified indentation across render modes** (`--tree-node-indent-per-level` shared) | ✅ Ported | None |
| **Flat mode gap matching** (`flatGap` prop) | ✅ Ported | None |
| **`dropZoneStart` controls glow mode child threshold** | ✅ Fixed | None |
| **Removed `will-change: transform` from virtual scroll container** | ✅ Done | None |

### Flat Rendering Rework (v4.8 changes NOT on v5)
✅ **All items ported:**
1. ✅ Removed `flatIndentSize` prop — both modes use `--tree-node-indent-per-level`
2. ✅ Node.svelte flat indent uses CSS variable
3. ✅ `flatGap` boolean prop added
4. ✅ Removed blanket `margin-top` CSS
5. ✅ `RenderModeSwitch` component on all example pages
6. ✅ Shared render mode state persisted to localStorage

### Examples
| Change | Status on v5 branch | Action needed |
|--------|---------------------|---------------|
| **3-way render mode toggle** (Recursive/Progressive/Virtual) | ✅ Ported | None |
| **Search bar with navigation** on example pages | ✅ Ported | None |
| **`dragDropMode` set on all example trees** | ✅ Done (explicit on all trees) | None |
| **Search example filter/search mode toggle** | ✅ Ported | None |
| **Drag-drop code examples updated** | ✅ Done (v5 signatures, correct defaults) | None |

### Docs / Config
| Change | Status on v5 branch | Action needed |
|--------|---------------------|---------------|
| **CHANGELOG updated** | ✅ Done | None |
| **README updated** | ✅ Done | None |
| **`ai/` docs updated** | ✅ Done | All position names updated to `'before'`/`'after'` across 6 files |

## Key Differences: v4.8 (prod) vs v5.0 (feature/core-render-split)

### Architecture
- **v4.8**: All logic in `Tree.svelte` (monolith)
- **v5.0**: `TreeController.svelte.ts` holds all logic, `Tree.svelte` is a thin wrapper that delegates to controller

### Naming
- **v4.8**: `DropPosition = 'above' | 'below' | 'child'`
- **v5.0**: `DropPosition = 'before' | 'after' | 'child'`
- CSS classes: `ltree-drop-above/below` → `ltree-drop-before/after`, `ltree-glow-above/below` → `ltree-glow-before/after`
- SCSS variables: `$drop-zone-above-*` → `$drop-zone-before-*`, `$drop-zone-below-*` → `$drop-zone-after-*`

### Floating zones
- **v4.8**: Floating zone overlay rendered in `Tree.svelte` (fixed position container)
- **v5.0**: ✅ Now also rendered in `Tree.svelte` with `position: fixed; z-index: 10000` (ported from prod). Handler methods on `TreeController`.

### New in v5 not in v4.8
- `TreeController` / `TreeProvider` / custom renderer architecture
- `isCollapsibleMember` / `getIsCollapsibleCallback`
- `getIsDraggableCallback`
- `applyChanges()` batch method
- `_rev` change tracking on nodes
- Canvas rendering extracted to `@keenmate/svelte-treeview-canvas`

## Port Status

### ✅ Phase 1: Flat rendering unification — DONE
### ✅ Phase 2: CSS zone auto-expand — DONE
### ✅ Phase 3: Virtual scroll — DONE
### ✅ Phase 4: Search navigation UX — DONE
### ✅ Phase 5: Verify & fix remaining bugs — DONE
### ✅ Phase 6: Docs & changelog — DONE
- ✅ CHANGELOG updated
- ✅ README updated
- ✅ `ai/drag-drop.txt` — updated `'above'`/`'below'` → `'before'`/`'after'`
- ✅ `ai/events-callbacks.txt` — updated position names + callback signatures
- ✅ `ai/tree-editing.txt` — updated position names in moveNode examples
- ✅ `ai/typescript-types.txt` — updated DropPosition type
- ✅ `ai/import-patterns.txt` — updated DropPosition comment
- ✅ `ai/data-handling.txt` — updated allowedDropPositions examples
- ✅ `CLAUDE.md` — updated DropPosition type + onNodeDrop signature
