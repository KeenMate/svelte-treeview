# v4.8.0 → v5.0.0 Port Plan

## What was done in v4.8.0 (prod branch)

### Features
| Feature | Status on v5 branch | Action needed |
|---------|---------------------|---------------|
| **Virtual Scroll mode** (`virtualScroll`, `virtualRowHeight`, `virtualOverscan`, `virtualContainerHeight`) | NOT present | Port — major feature, new rendering mode |
| **Search result navigation** (dual-mode filter/search, result counter, prev/next Enter/Shift+Enter, round-robin) | NOT present | Port — new search UX on performance example page |
| **`searchNodes()` public method** | Already present | None |
| **`scrollToPath` retry logic for virtual scroll** | NOT present | Port alongside virtual scroll |

### Bug Fixes
| Fix | Status on v5 branch | Action needed |
|-----|---------------------|---------------|
| **`copyNodeWithDescendants` wrapper missing `siblingPath`/`position`** | Already fixed (TreeController has all 5 params, Tree.svelte delegates correctly) | None |
| **`treeId` becoming undefined on prop changes** | Likely already handled (TreeController architecture) | Verify |
| **Empty tree drop placeholder ignoring `dragDropMode`** | Needs checking | Verify — if not fixed, port |
| **Sort order mismatch in `visibleFlatNodes`** | Needs checking | Verify |
| **`updateNode` not triggering re-render in flat mode** | Needs checking | Verify |
| **`bodyClass` prop not applying custom class** (#24) | Already fixed (shared ancestor commit `338d239`) | None |
| **Sort test `createTestLTree` misaligned args** | Already different on v5 (uses `createLTreeNode`, different param order) | Verify tests pass |

### CSS / Styling
| Change | Status on v5 branch | Action needed |
|--------|---------------------|---------------|
| **Floating zone auto-expand** (`:not(:has())` rules) | NOT present | Port — adapt class names: `ltree-drop-above` → `ltree-drop-before`, `ltree-drop-below` → `ltree-drop-after` |
| **Unified indentation across render modes** (`--tree-node-indent-per-level` shared, `flatIndentSize` removed) | NOT done — v5 still uses `flatIndentSize` string prop with hardcoded `calc()` in Node.svelte | Port — replace `flatIndentSize` with shared CSS var |
| **Flat mode gap matching** (`flatGap` prop for parent→first-child 2px gap only) | NOT done — v5 has no gap logic, flat mode has blanket margin or none | Port — add `flatGap` logic to Node.svelte |
| **`dropZoneStart` controls glow mode child threshold** | Needs checking | Verify in Node.svelte |
| **Removed `will-change: transform` from virtual scroll container** | N/A (no virtual scroll yet) | Will come with virtual scroll port |

### Flat Rendering Rework (v4.8 changes NOT on v5)
**This is significant** — v4.8 unified how flat and recursive modes render nodes:

1. **Removed `flatIndentSize` prop** — both modes now use `--tree-node-indent-per-level` CSS variable
2. **Node.svelte flat indent**: Changed from `calc(level * flatIndentSize)` to `calc(level * var(--tree-node-indent-per-level))`
3. **Added `flatGap` boolean prop** — in flat mode, only adds `margin-top: 2px` at parent→first-child boundaries (matching recursive mode's `.ltree-children` gap), instead of blanket margin on all nodes
4. **Removed blanket `margin-top` CSS** on flat mode nodes that caused height mismatch between modes
5. **`RenderModeSwitch` component** added to all example pages for easy A/B comparison
6. **Shared render mode state** persisted to localStorage across example pages

### Examples
| Change | Status on v5 branch | Action needed |
|--------|---------------------|---------------|
| **3-way render mode toggle** (Recursive/Flat/Virtual on performance page) | NOT present | Port alongside virtual scroll |
| **Search bar with navigation** on example pages | NOT present | Port |
| **`dragDropMode="both"` added to all example trees** | Needs checking | Verify |
| **Search example filter/search mode toggle** | NOT present | Port |
| **Tree-editor example `type` field** | NOT present | Port |
| **Shared CSS** (`examples-shared.css` consolidation) | Needs checking | Verify |

### Docs / Config
| Change | Status on v5 branch | Action needed |
|--------|---------------------|---------------|
| **CHANGELOG consolidated to 4.8.0** | v5 has its own changelog entries | Update v5 changelog with ported items |
| **README "New in v4.8" section** | v5 README has "v5.0: Core/Renderer Split" | Update with virtual scroll + other features |
| **`ai/` docs updated** (performance.txt, INDEX.txt, drag-drop.txt) | Stale on v5 (still says "no virtual scroll") | Update after porting |

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
- **v5.0**: Floating zones rendered inline in `Node.svelte` (absolute position within node row)

### New in v5 not in v4.8
- `TreeController` / `TreeProvider` / custom renderer architecture
- `isCollapsibleMember` / `getIsCollapsibleCallback`
- `getIsDraggableCallback`
- `applyChanges()` batch method
- `_rev` change tracking on nodes
- Canvas rendering extracted to `@keenmate/svelte-treeview-canvas`

## Port Order (recommended)

### Phase 1: Flat rendering unification (foundational — other features depend on this)
1. Remove `flatIndentSize` prop from Node.svelte, TreeController, Tree.svelte
2. Change flat mode indent in Node.svelte from `calc(level * flatIndentSize)` to `calc(level * var(--tree-node-indent-per-level))`
3. Add `flatGap` boolean prop to Node.svelte — only adds `margin-top: 2px` at parent→first-child boundaries
4. Remove blanket margin-top CSS on `.ltree-flat-mode` nodes
5. Wire `flatGap` computation in Tree.svelte's flat `{#each}` loop (compare current node's parentPath to previous node)
6. Add `RenderModeSwitch.svelte` component + shared `render-mode.svelte.ts` state to example pages
7. Test: all three render modes should produce visually identical output

### Phase 2: CSS zone auto-expand (quick win)
1. Add `@mixin zone-horizontal-expansion` to `main.scss` — use `ltree-drop-before/after` class names (v5 naming)
2. Add `:not(:has())` rules to "around", "above", "below" layout blocks
3. Test with restricted drop positions example

### Phase 3: Virtual scroll (major feature)
1. Add `virtualScroll`, `virtualRowHeight`, `virtualOverscan`, `virtualContainerHeight` props to TreeController
2. Add virtual scroll rendering path in Tree.svelte (scrollable container, index-based visible range)
3. Add `scrollToPath` virtual scroll support with index-based scrolling + retry logic
4. Port 3-way render mode toggle to performance example
5. Remove `will-change: transform` if present

### Phase 4: Search navigation UX
1. Port search bar with result counter, prev/next navigation to example pages
2. Port filter/search mode toggle to search example
3. Port `overscroll-behavior: contain` to tree containers

### Phase 5: Verify & fix remaining bugs
1. Run tests — verify sort test passes with v5 `createLTree` signature
2. Verify `dragDropMode` is respected on empty tree placeholder
3. Verify `treeId` stability
4. Verify `updateNode` triggers re-render in flat mode
5. Verify `dropZoneStart` controls glow mode child threshold in Node.svelte

### Phase 6: Docs & changelog
1. Update `ai/performance.txt` — add virtual scroll section, rendering mode table
2. Update `ai/INDEX.txt` — add virtual scroll keywords
3. Update `ai/drag-drop.txt` — note zone auto-expand behavior
4. Update CHANGELOG with ported items
5. Update README with virtual scroll + unified rendering
