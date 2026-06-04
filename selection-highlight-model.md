# Selection vs highlight model

> Design discussion for resolving the long-standing tension between
> `highlightedPaths`, `selectedPaths`, and the legacy `ltree-selected-*`
> CSS class names. Status: discussed, not implemented yet.

## The three states we maintain

We track three distinct concepts on every tree instance:

**`focusedNode`** — single node (or `null`). The keyboard / cursor "current"
position. Arrow keys move it; plain click sets it; it is the origin for
keyboard navigation. Windows Explorer renders this as the dotted-outline row.

**`highlightedPaths`** — `Set<string>`. The multi-select set from
Ctrl/Shift+click and Shift+arrow. It is the thing that visually marks what
the user has gathered up across rows. Size: 0..N.

**`selectedPaths`** — `Set<string>`. The checkbox data model. Bound via
`bind:selectedPaths`. This is what a form / persistence layer reads to know
"which items did the user pick". Size: 0..N.

## The collision

In modes *without* checkboxes only two of these exist (focused +
highlighted). To a normal user, "highlighted" *is* "selected" — what they
have clicked, what a delete button or context menu should act on. Windows
Explorer, Finder, VS Code's tree, IDE explorers all use the word "selected"
for this. Our CSS class names (`ltree-selected-bold`, `ltree-selected-border`,
`ltree-selected-highlight`, `ltree-selected-brackets`) come from this world
and were correct when written.

When checkboxes were added the form-picker model needed its own state slot —
and "selected" was the right word for *that* (a checked checkbox is selected;
a highlighted row with no check is not selected from a form's POV). So
`selectedPaths` got bound to the checkbox model and the older mouse-selection
state was renamed to `highlightedPaths`. The CSS classes never moved.

Today:

- The **CSS class names** are correct for no-checkbox mode and misleading
  in checkbox mode.
- The **prop names** are correct for checkbox mode and awkward in
  no-checkbox mode ("highlighted" is an odd word for "the things I selected
  with the mouse" when there is no other selection state competing for the
  name).

## What hinges on this

This is not only cosmetic — concrete behaviour questions depend on which
state is the "real" selection:

1. **What does a context-menu "Delete" act on?** Just the right-clicked
   node? `focusedNode`? `highlightedPaths`? `selectedPaths`?
2. **What does drag-and-drop drag?** Today: the dragged node only.
   Multi-drag of highlighted is a plausible future request — but only if
   highlighted = selected semantically.
3. **What does `Enter` on a focused node do?** Toggle highlight? Toggle
   check? Both? Neither?
4. **External integrations (server / URL state)**: which set roundtrips?
   Today it is `selectedPaths` (bindable, stable). Highlight is implicitly
   transient. Is that right in no-checkbox mode?
5. **A11y / screen reader announcements**: `aria-selected` is the WAI-ARIA
   term. It should map to whichever state behaves like selection in the
   current mode — which is highlighted when no checkboxes and checked when
   there are.

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

## Design knobs

### 1. The mirroring mechanism

(a) **Implicit / derived from `showCheckboxes`** — no new prop. When
`!showCheckboxes`, every change to `highlightedPaths` writes the same set
into `selectedPaths`. Simplest API. Brittle if anyone wants to override
the rule.

(b) **Explicit `selectionFollowsHighlight: boolean | undefined`** prop with
`undefined` (default) deriving from `!showCheckboxes`. Same default, but
escape hatch for unusual cases:

- Checkbox-less trees that *do not* auto-select on highlight (read-only
  browser where click is just navigation).
- Checkboxed trees that *do* mirror (Gmail-style "Shift-click highlights
  *and* checks the range").

**Recommendation: (b).**

### 2. Range-check via Shift+click on checkbox

Only relevant in `showCheckboxes = true`. Today Shift+click on the row only
highlights. We could:

- **Leave it** — highlight ≠ check; user must click each checkbox manually
  after highlighting.
- **Add range-check** — Shift+click on the *checkbox* itself toggles the
  range from anchor → here. Different gesture, different effect, still
  consistent with the rule above.

**Recommendation: defer until users ask for it.**

### 3. CSS class rename

Once mirroring is in:

- `ltree-selected-*` is semantically correct in no-checkbox mode.
- `ltree-selected-*` is misleading in checkbox mode (those classes style
  the highlight, not the real selection).

Options:

- **Single set** — keep `ltree-selected-*`, document the dual meaning.
- **Two sets** — rename existing four to `ltree-highlight-*`; reserve
  `ltree-selected-*` for true-selection rendering in checkbox mode.
  Backward-compat aliases for one release.

**Recommendation: separate decision after (1) lands.**

### 4. Mode transition behaviour

If a consumer flips `showCheckboxes` at runtime:

- Hidden → shown: previously-mirrored `selectedPaths` keeps existing
  entries. Their checkboxes appear pre-checked. No reconciliation needed.
- Shown → hidden: previously-checked `selectedPaths` stays as-is.
  `highlightedPaths` is unchanged. The two sets may diverge until the user
  interacts.

**Recommendation: leave as-is, document that runtime toggling is the
consumer's responsibility to reconcile.**

### 5. Events

Today we fire `onSelectionChange` (for `selectedPaths`) and
`onHighlightChange` (for `highlightedPaths`).

Under mirroring, every highlight change in no-checkbox mode also mutates
`selectedPaths`. Do we fire both events? Or coalesce?

**Recommendation: fire both** — external code may listen to just one and we
do not want it to miss the change.

## The anchor question (related)

The Shift+click "point of origin" — `lastHighlightedPath` on the controller,
visualised as `.ltree-highlight-anchor` — is also affected by this model.

When `highlightedPaths.size <= 1`, the anchor is either the lone highlighted
node or null. The visual marker is then redundant (the highlight style
already marks the same single node).

When `highlightedPaths.size > 1`, the anchor identifies which of the
highlighted nodes a Shift+click would extend the range *from*. The marker
adds information here.

Open questions:

- Should the marker be gated to render only when `size > 1`?
- Should the marker move on Shift+click (to the newly-selected far end), or
  stay on the original Ctrl/plain-click anchor (so further Shift+clicks all
  extend from the same origin)? Current behaviour: it stays.
- Does the marker make sense at all in `showCheckboxes = true` mode, where
  highlight is a transient cursor and the user's selection lives in
  checkboxes? Probably yes — Shift+click still extends the highlight range
  even when that is "just gathering".

The CSS rule (`box-shadow: inset W 0 0 0 C`) is currently commented out in
`src/lib/styles/_states.css` pending A/B testing on `/examples/interaction`.
The flag, helper, and CSS variables remain wired in so re-enabling is a
one-line toggle.

## Open questions

- Should `aria-selected` follow the framing automatically or stay an
  explicit consumer choice?
- Are there integrations (canvas-tree, web-treeview) that already rely on
  the current `highlightedPaths` / `selectedPaths` independence? Audit
  before changing default behaviour.
- Should `focusedNode` also be part of `aria-selected` or is
  `aria-current="true"` the right mapping? Probably the latter.
- What about keyboard `Enter` on a focused node? Currently a no-op for
  selection state. Under the new framing it could:
  - In no-checkbox mode: toggle highlight (= toggle selection).
  - In checkbox mode: toggle the checkbox.
