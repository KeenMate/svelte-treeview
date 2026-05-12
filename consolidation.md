# Code Consolidation — In Progress

Working doc tracking the code revision started on branch `feature/core-render-split`.
Scope: `src/lib/**` (skip tests, routes, vendor).

## Guiding principles (set during the work)

1. **Internal vs public surface.** A property/method declared on an exported interface (`Ltree<T>`, `LTreeNode<T>`, `NodeCallbacks<T>`, `TreeControllerProps`, `Tree`'s props) is part of the public API. Removing it is a breaking change even if no internal code references it.
2. **Useless vs not useless.** A public **property** that the library never reads is useless (setting it has no effect). Safe to delete.
3. A public **method** that does observable work (mutates state, triggers events) is **kept** even if no internal caller exists — external consumers may rely on it.
4. **Load-bearing comments.** If a comment says something is kept on purpose (e.g. "no-ops so the callbacks interface stays intact"), respect it. The author left a note to prevent exactly this cleanup.
5. v5 is still in `-rc06`. Breaking semantic fixes (e.g. renames that correct misleading prop names) are acceptable in this window, but they go in deliberately, not as side-effects of cleanup.

## Done

### 1. Dead-code sweep (committed conceptually, not yet a git commit)

**Removed** — all verified non-functional and either internal or so dead they were useless even on a public interface:

| Item | Location | Reason |
|---|---|---|
| `Tuple<T,U>` type | `src/lib/ltree/types.ts:7` | Not re-exported from `index.ts`; truly internal. |
| 5 dead `LTreeNode` properties: `useCallback`, `priority`, `isInsertAllowed`, `isNestAllowed`, `isCheckboxVisible` | `src/lib/ltree/ltree-node.svelte.ts` | Never read anywhere. Useless to consumers — setting them has no effect. |
| `indexingCompleteCallback` field on `Ltree` | `src/lib/ltree/types.ts` | Never read. Real wiring uses `indexer.setCallbacks(...)` instead. |
| Internal `size` closure variable + its single `size++` write inside `insert()` | `src/lib/ltree/ltree.svelte.ts` | Closure-local, not on interface, never read. |
| 2 commented-out lines | `src/lib/ltree/ltree.svelte.ts:174` and inside `createFilteredTree` | Dead comments. |

**Reverted** after user pushback (correctly kept):

- `Ltree.insert(path, data)` — public method that mutates the tree. External callers exist by definition of being on the published interface.
- `Ltree.refreshNode(path)` stub — documented in README, public API even though implementation is `_emitTreeChanged()`.
- `NodeCallbacks` no-op slots (`onNodeDragLeave`, `onTouchDragMove`, `onTouchDragEnd`) + their private no-op handlers (`_onNodeDragLeave`, `_onTouchMove`, `_onTouchEnd`) + public `touchMove`/`touchEnd` proxies + the explanatory comment. The comment explicitly said *"kept as no-ops so the callbacks interface stays intact"* — load-bearing for external custom renderers.

**Skipped** (decided not worth the breakage):

- Redundant `async` on `expandNodes`/`collapseNodes` in `TreeController` + `Tree.svelte`. Removing changes published return type `Promise<void>` → `void`. Not a real bug, just a stylistic wart.

### 2. Bug #1 fixed — `isSelectedMember` was misnamed and miswired

**Problem.** The prop `isSelectedMember` on `Tree.svelte` / `TreeController` was passed to `createLTree`'s position 7 slot named `_isSelectableMember`. That slot writes user data into `node.isSelectable` (controls checkbox visibility and `ltree-clickable` class via `Node.svelte:343,369`). The README documented it as "Property name for selected state" — actively misleading after v5 introduced `selectedPaths` / `highlightedPaths` / `focusedPaths`.

**Decision.** Two separate props (user direction):
- `isSelectableMember` — controls `node.isSelectable` (the existing slot, properly named)
- `isSelectedMember` — controls `node.isSelected` (initial checked state from data)

**Implementation.**
- Added new positional param `_isSelectedMember` to `createLTree` (between `_isSelectableMember` and `_isDraggableMember`).
- Added `shouldCalculateIsSelected` flag and the row-read inside `insertArray` + `insertBranch`: `if (!shouldCalculateIsSelected) node.isSelected = getField(row, _isSelectedMember!);`
- Added `isSelectedMember` to the `Ltree<T>` interface.
- Added `isSelectableMember` prop to `Tree.svelte` and `TreeController` (parallel to `isSelectedMember`). Updated destructure, controller wiring, update() table, and the type union for `updateProps`.
- `TreeController` now passes both props in the correct positional slots.
- After `insertArray`, `TreeController` walks the tree from `root.children` and seeds `selectedPaths` Set from any `node.isSelected === true` flags. Only runs when `isSelectedMember` is provided.
- Updated `ltree-sort.test.ts` with new `undefined` placeholder.

**Migration note for callers.** Anyone using `isSelectedMember` before this change was actually controlling selectability. They need to rename their usage to `isSelectableMember`. v5 is still in -rc, acceptable window for this.

### Verification
- `npm run check` — 0 errors (3 unrelated a11y warnings in `routes/examples/custom-layout`)
- `npm test` — 66/66 passing
- Lint warnings are project-wide Prettier formatting, pre-existing.

## In progress / next

### Bug #2 — `Symbol` (constructor) vs `symbol` (primitive) typing
- `src/lib/ltree/types.ts:77` declares `changeTracker: Symbol | undefined`
- `src/lib/core/TreeController.svelte.ts:440` declares `lastFlatNodesTracker: Symbol | undefined | null`
- Both should be the lowercase primitive `symbol`. Works today because `===` is identity either way, but the type is wrong.
- Pure type-level fix, no behavior change.

### Bug #3 — `applyHighlight` ignores its `containerElement` arg
- `src/lib/core/TreeController.svelte.ts:1689` reads `this.containerElement` instead of the passed argument.
- `scrollToPath` (around line 1574) accepts a `containerElement` option, but the helper hardcodes the instance field.
- Currently dead (no caller passes a different element), but latent bug. Investigate whether to pass through or remove the unused option from the public surface.

## Deferred — broader audit findings (not started)

From the initial audit (~80 findings). Items below are the higher-value ones still on the table.

### Duplications worth extracting
- **6 copies of `dataTransfer` extraction** in `TreeController.svelte.ts` (lines 1349, 1429, 1466, 2382, 2444, 2473, 2788). Extract `_parseDraggedFromDataTransfer(event)`.
- **3 copies of `countDescendants`** in `ltree.svelte.ts` (lines 1025, 1532, 1567) — extract `_countSubtreeNodes(node, includeSelf)`.
- **2 copies of `collectPaths`** in `ltree.svelte.ts` (lines 1543, 1575) — extract `_collectDescendantPaths(node, paths)`.
- **Drop-position calc implemented 3x**: `Node.svelte:111-164`, `TreeController:1522-1564` (near-identical), and `TreeController:2265-2275` (simpler heuristic, likely deletable).
- **Two parallel drag/drop APIs**: public (`dragOver`/`drop`) and private (`_onNodeDragOver`/`_onNodeDrop`) duplicate ~50 lines each. Probably from the recent core/renderer split. Have private delegate to public.
- **`isDropAllowed` cross-tree ternary** repeated 5x — fold into `isDropAllowedByMode(treeId, isCrossTree?)`.
- **`n._rev = (n._rev || 0) + 1` appears 30+ times.** Either a `bumpRev(node)` helper, or — better — drop the per-node visual flags entirely and have `Node.svelte` read membership from the context Sets. The audit (finding 3.15) flagged this dual source of truth.
- **Order-tiebreak logic** duplicated in `moveNode` (`ltree.svelte.ts:931-955`) and `copyNodeWithDescendants` (`1289-1307`) — extract `_calculateMidpointOrder(...)`.
- **`insertArray` row-to-node conversion** is duplicated in `insertBranch` (`ltree.svelte.ts:244-288` and `1391-1428`). The author already left a comment admitting the copy.
- **~30 `as any` casts** for data-field writes in `ltree.svelte.ts`. There's already a `getField` helper at line 19 — add matching `setField(item, member, value)`.

### Architectural overlap
- TreeController has 18 one-line wrappers around `this.tree.*` methods. Either expose `controller.tree` directly or accept the boilerplate.
- 9 mutation wrappers (`moveNode`, `removeNode`, `addNode`, `updateNode`, `applyChanges`, `copyNodeWithDescendants`, `insertBranch`, `replaceBranch`, `deleteBranch`) each repeat `_skipInsertArray = true → call → tick → reset` — extract `_withSkipInsert<R>(fn)`.
- State held twice: `treePathSeparator`, `shouldDisplayDebugInformation`, `treeId` exist on both TreeController and Ltree. Sync state ad-hoc.
- TreeController constructor is 350+ lines (`485-848`) with 9 inline `$effect` blocks. Extract `_initFromProps`, `_setupEffects`, `_buildNodeCallbacks`.
- `updateProps` is 90 lines of `if (... !== undefined)`. `Tree.svelte:721-791` has another 70-line copy of the same pattern.
- `createDefaultNavigation` is 200+ lines inline (`TreeController.svelte.ts:2892-3096`). Extract to `core/default-navigation.ts`.
- `Tree.svelte` has ~50 single-prop `$effect` syncs (`414-499`). Most fragile area; drive from a sync table.

### Performance opportunities
- **`flatNodes.findIndex(n => n.path === currentPath)`** runs O(n) per keystroke in 13 navigation methods. Cache `pathToFlatIndex: Map<string, number>` invalidated on tracker bump.
- `flatTreeNodes.filter` in branch delete (`ltree.svelte.ts:1551, 1598, 1644`) is O(n) per delete. Could be `node→indexerIndex` Map.
- `tree.refresh()` triggers global tracker bump for 8+ call sites where per-node updates would suffice. Per the project's existing `NodeSignal` pattern (see MEMORY.md).

## File-by-file change summary

| File | Lines + | Lines − |
|---|---|---|
| `src/lib/components/Tree.svelte` | +5 | 0 |
| `src/lib/core/TreeController.svelte.ts` | +13 | 0 |
| `src/lib/ltree/ltree-node.svelte.ts` | 0 | −12 |
| `src/lib/ltree/ltree-sort.test.ts` | +1 | 0 |
| `src/lib/ltree/ltree.svelte.ts` | +6 | −8 |
| `src/lib/ltree/types.ts` | +1 | −3 |
| **Total** | **+26** | **−23** |

Net +3 lines; the sweep removed dead code roughly equal in size to the new isSelectableMember/isSelectedMember wiring.
