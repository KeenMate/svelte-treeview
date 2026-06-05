# Selection vs highlight model

> Decision record for resolving the long-standing tension between
> `highlightedPaths`, `selectedPaths`, and the legacy `ltree-selected-*` CSS
> class names. **Status: decided, not implemented yet.**

## The three states we maintain

We track three distinct concepts on every tree instance:

**`focusedNode`** — single node (or `null`). The keyboard / cursor "current"
position. Arrow keys move it; plain click sets it. **Also serves as the
anchor for Shift-range operations** — there is no separate anchor state.
Useful as a single hook for downstream UI (detail panels, breadcrumbs).

**`highlightedPaths`** — `Set<string>`. The multi-select set from
Ctrl/Shift+click and Shift+arrow. Visually marks what the user has gathered
up. Size: 0..N (capped at 1 in `selectionMode = 'single'`).

**`selectedPaths`** — `Set<string>`. The "real picks". Bound via
`bind:selectedPaths`. What a form / persistence layer reads. The
*mechanism* that puts paths into this set depends on `showCheckboxes`:

- `showCheckboxes = false` → `selectedPaths` is auto-mirrored from
  `highlightedPaths`. Highlighting commits.
- `showCheckboxes = true` → `selectedPaths` is driven *only* by checkbox
  interaction. Highlighting is just gathering; the click on the checkbox
  commits.

## The naming collision (background)

In modes *without* checkboxes only two states exist (focused + highlighted)
and to users "highlighted" *is* "selected" — what they clicked is what a
delete button should act on. Windows Explorer, Finder, VS Code's tree all
use the word "selected" for this. Our CSS class names (`ltree-selected-bold`,
`ltree-selected-border`, `ltree-selected-highlight`, `ltree-selected-brackets`)
come from this world and were correct when written.

When checkboxes were added the form-picker model needed its own state slot
— "selected" was the right word for *that* (a checked checkbox is selected;
a highlighted row with no check is not selected from a form's POV). So
`selectedPaths` got bound to the checkbox model and the older mouse-selection
state was renamed to `highlightedPaths`. The CSS classes never moved.

Under the model below, the CSS class names become semantically correct in
no-checkbox mode (highlight = selection, so `ltree-selected-*` is honest)
and remain misleading in checkbox mode (the classes style the highlight,
not the real selection). The rename is deferred — see Decision 7.

## The chosen framing

**The semantics of "highlighted" depend on whether checkboxes are visible.**

| | `showCheckboxes = false` | `showCheckboxes = true` |
|---|---|---|
| Click / Ctrl-click / Shift-click | Highlights AND selects (mirrored) | Highlights only (transient cursor) |
| Click on checkbox | n/a | Toggles selection on that node |
| Visual marker | Highlight style = "this is selected" | Highlight = "this is the cursor target"; checkbox checked = "selected" |
| `aria-selected` maps to | Highlighted set | Checked set |
| CSS class semantics | `ltree-selected-*` is correct | `ltree-selected-*` is misleading |

In English: without checkboxes, highlighting commits; with checkboxes,
highlighting is just gathering, and the click on the checkbox commits.

## Decisions

### 1. Mirroring mechanism — implicit, derived from `showCheckboxes`

No new toggle prop. When `!showCheckboxes`, every change to
`highlightedPaths` writes the same set into `selectedPaths`. When
`showCheckboxes`, the two are decoupled.

### 2. New prop: `selectionMode: 'single' | 'multi'`, default `'single'`

Controls highlight cardinality and modifier-key behaviour.

| | `'single'` (default) | `'multi'` |
|---|---|---|
| `highlightedPaths.size` | always 0 or 1 | 0..N |
| Plain click | focus → X, highlight = {X} | focus → X, highlight = {X} |
| Ctrl+click | **no-op** (acts as plain click) | focus → X, highlight toggles X |
| Shift+click | **no-op** (acts as plain click) | focus stays, highlight extends from focus to clicked |
| Plain Arrow | focus → neighbour, highlight = {neighbour} | focus → neighbour, highlight = {neighbour} |
| Shift+Arrow | n/a (no-op) | focus stays, highlight extends one step from focus |
| `Enter` | **no-op** | toggles focused node in highlight |
| `Space` (with checkboxes) | toggles focused node's checkbox | toggles focused node's checkbox |

Open detail: in `'single'` mode + `showCheckboxes = true`, should checking
a second box clear the first (radio-group style) or allow multi-check? The
literal reading of "single selection mode" suggests radio-group — confirm
during implementation.

### 3. `isSelectable` — selection gate, not focus gate

`!isSelectable` blocks: highlight, selected (so also blocks the mirror in
no-checkbox mode), checkbox render. **Does not** block focus or arrow
navigation — the focused node can still land on `!isSelectable` rows so
consumers can show external detail (a side panel, breadcrumb, etc.).

Already implemented as `isSelectableMember` + `getIsSelectableCallback`
props resolving into `node.isSelectable`. Today `node.isSelectable` only
gates the checkbox render and the `ltree-clickable` class — needs to be
extended to also block highlight in click handlers and arrow nav.

### 4. Shift+Arrow extension — hidden internal cursor

Internal `_shiftCursor` field on the controller, not exposed via props.
Set on first Shift+Arrow / Shift+click; advances on subsequent
Shift+Arrows; cleared on any non-Shift navigation. Consumers never see it
— they read `focusedNode` (anchor) and `highlightedPaths` (the range).

### 5. Focus and the anchor are the same

The `focusedNode` IS the anchor. Drop `lastHighlightedPath`,
`isHighlightAnchor` flag, `_setHighlightAnchor` helper, the
`.ltree-highlight-anchor` CSS rule, the two CSS variables, and the
matching manifest entries.

### 6. Drag-and-drop of multi-selection

When a node that's in `highlightedPaths` is dragged, drag the whole
highlight set. The algorithm:

1. Compute **top-level selected** = highlighted nodes whose nearest
   highlighted ancestor is not in the set.
2. For each top-level selected node, drag its **whole subtree** to the
   drop target. Selected descendants are **absorbed** — they ride along
   inside the subtree and are not extracted separately.
3. Non-highlighted siblings of dragged nodes stay where they are; only
   the highlighted top-level nodes (and their subtrees) move.

**Worked examples:**

- *Siblings* A, B, C; highlight A and C: top-level = {A, C}; drop both at
  target → both at target root.
- *Chain* A→B→C; highlight all three: top-level = {A} (B's nearest
  highlighted ancestor is A, C's is B); drop A's subtree → A→B→C preserved.
- *Chain* A→B→C; highlight A and C only (skip B): top-level = {A} (C's
  nearest highlighted ancestor is A, which IS in the set). C is absorbed
  under A's subtree. Drop A's subtree → A→B→C lands at target (B comes
  along because it's in A's subtree, even though it wasn't highlighted).
  **C does not also appear at target root.**

### 7. CSS class rename — deferred

Once mirroring is in, `ltree-selected-*` is honest in no-checkbox mode and
misleading in checkbox mode. The rename to `ltree-highlight-*` (with
backward-compat aliases for one release) is a separate decision, taken
after the model lands.

### 8. Mode transition

If a consumer toggles `showCheckboxes` at runtime: leave both sets as-is.
No reconciliation. The checkboxes that appear/disappear reflect the
current `selectedPaths`. Documented as consumer's responsibility to
reconcile if they want different behaviour.

### 9. Events

`onHighlightChange` and `onSelectionChange` both keep their existing
signature `(paths: Set<string>, nodes: LTreeNode<T>[]) => void`. Fire with
the full new set, not per-node.

Under mirroring (no checkboxes), every highlight change *also* fires
`onSelectionChange` with the same payload. Both events fire in the same
tick. Listeners pick whichever they care about; no coalescing.

### 10. Programmatic API mirrors

`highlightNode`, `highlightNodes`, `clearHighlight` (and the deprecated
`selectNode`/`selectNodes`) mirror into `selectedPaths` when
`!showCheckboxes`, emitting `onSelectionChange` alongside
`onHighlightChange`. The existing `{ silent: true }` option still
suppresses both.

### 11. Cascade + `isSelectable`

When `checkboxMode = 'cascade'` and a parent has children of which some
are `!isSelectable`, checking the parent should cascade only to
selectable descendants. This is the existing intended behaviour — verify
during implementation that the cascade walk respects `isSelectable`.

### 12. Right-click

Right-click does NOT move focus or highlight. Only opens the context
menu at the right-clicked node. (Today `_onNodeRightClicked` does move
focus — change.)

### 13. Checkbox click does NOT move focus

The checkbox is treated as an orthogonal control. Clicking a checkbox
only mutates `selectedPaths`; focus stays where it was. (Already the
case — confirm no regression.)

## Implementation surface

Files / areas that change:

- `src/lib/components/Tree.svelte` — new prop `selectionMode`; thread to
  controller. Drop the `hoveredNodeForDropPath` analogue if any leftover.
- `src/lib/core/TreeController.svelte.ts`:
  - Add `selectionMode` state and prop wiring.
  - Add internal `_shiftCursor`.
  - Add mirror logic: after every highlight change, if `!showCheckboxes`
    write the same set into `selectedPaths` and emit `onSelectionChange`.
  - Gate click/arrow handlers on `selectionMode === 'multi'` for
    Ctrl/Shift behaviour.
  - Gate highlight + mirror updates on `node.isSelectable`.
  - Remove `lastHighlightedPath`, `_setHighlightAnchor`, all call sites.
  - Change `_onNodeRightClicked` to not move focus.
  - Implement multi-drag set computation (top-level absorption).
- `src/lib/ltree/ltree-node.svelte.ts` — remove `isHighlightAnchor` field.
- `src/lib/components/Node.svelte` — remove `isHighlightAnchor` class
  binding; ensure click handlers respect `selectionMode` (for Ctrl/Shift
  no-op in single mode).
- `src/lib/styles/_states.css` — remove the commented-out
  `.ltree-highlight-anchor` block.
- `src/lib/styles/_variables.css` — remove `--ltree-highlight-anchor-*`.
- `component-variables.manifest.json` — remove the two anchor entries.
- `CHANGELOG.md` — Breaking entry for `selectionMode` default `'single'`
  changing today's implicit multi behaviour; Changed entry for mirror
  semantics; Removed entry for anchor infra.

## Breaking changes summary

- Default `selectionMode = 'single'` is a behavioural break: existing
  multi-select users must opt in with `selectionMode='multi'`.
- `selectedPaths` becomes non-empty in no-checkbox mode (previously stayed
  empty unless populated programmatically). Consumers reading
  `selectedPaths` in no-checkbox trees will see new values.
- `lastHighlightedPath` (private), `isHighlightAnchor` (public on
  `LTreeNode`), `.ltree-highlight-anchor` (CSS), `--ltree-highlight-anchor-*`
  (CSS vars) removed.
- Right-click no longer moves focus.

## Open implementation questions

- `selectionMode='single'` + `showCheckboxes=true`: radio-group behaviour
  (checking unchecks the previous) or allow multi-check? Confirm during
  implementation.
- Should arrow nav stop at `!isSelectable` nodes (skip) or land on them
  (current default)? Decision text says "still land on it" — confirm
  during implementation.
- `aria-selected` mapping: follow framing automatically? Probably yes —
  apply to highlighted in no-checkbox mode, to checked in checkbox mode.
- Audit other packages (canvas-tree, web-treeview) that depend on
  current independence of `highlightedPaths` / `selectedPaths` before
  shipping the mirror.
