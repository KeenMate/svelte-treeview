# Validation notes — accepted deviations

This file records deviations from the BlissFramework component guidelines
that the team has accepted as the correct outcome for this component.
Each entry explains *why the deviation is correct here*; future
`/validate-web-component` runs read this file and downgrade matching
flags from ❌ Fail to ⚠️ Exception (or ✅ Pass), removing them from
the punch-list.

Deferrals ("we'll fix this later") are **not** valid entries — they get
re-promoted to Fails on every run by design. Only architectural
decisions belong here.

## C-CST-4 — Namespace-style Logic class split

The Logic class is organized across folder-scoped subsystems
(`src/lib/core/`, `src/lib/ltree/`) rather than a flat single file.
Within `core/`: `TreeController.svelte.ts` is the main class;
`createTreeController.ts`, `clipboard.ts`, `navigation.ts` are
namespace-style collaborators delegated to via wrapper methods.
Within `ltree/`: `ltree.svelte.ts` composes `flex.ts`, `indexer.ts`,
`ltree-node.svelte.ts` as pure data-structure helpers (Side-layer).
Not independent Service classes; one Logic class spread across files
for readability. PASS with note; the C-CST-4 auto-script's
import-pair regex flags these as service-to-service but they're
single-Logic-class subsystem internals.

## C-NC-6 — D-NC-7 = C member-only structural extractors

Six `*Member` fields ship without paired `get<Name>Callback`:
`idMember`, `pathMember`, `parentPathMember`, `levelMember`,
`hasChildrenMember`, `orderMember`. These are structural / auto-derived
fields (path-based tree identity) — no consumer would want a per-node
computed override for "what is this node's id". The `is*Member`
extractors (`isSelectable`, `isSelected`, `isDraggable`,
`isCollapsible`, `isDropAllowed`) all follow the canonical
`is<Name>Member` + `getIs<Name>Callback` pair (Tree.svelte:38-47).
PASS with note; D-NC-7 = C member-only is documented for the
structural fields.

## C-NC-8 / C-CSS-7 — Ancestor framework class selectors are not BEM

`.dark` and `.light` flagged as non-BEM are **ancestor framework-theme
selectors** in `src/lib/styles/dark-mode.css` — e.g.
`.dark .stv__container { color-scheme: dark; }` matches a consumer's
Tailwind `.dark` class on an ancestor. They are NOT classes the
component emits on its own elements; they're the framework conventions
the component honors. The BEM rule applies to classes the component
emits, not to ancestor-class qualifiers in conditional selectors.
PASS with note.

(`.danger` and `.expanded`, if flagged by the same check, are genuine
component-emitted modifier classes — `.stv__context-menu-item.danger`
and `.stv__toggle-icon.expanded` — and are tracked as outstanding BEM
debt rather than waived here. They should migrate to the canonical
`--modifier` form in a follow-up; this note does not cover them.)

## C-CS-5 — Dark-mode fixture lives at SvelteKit routes/

The canonical location for the dark-mode contrast fixture is
`docs/test/dark-mode.html`. This component is a SvelteKit app, so
fixtures live as routes: `src/routes/test/theming/+page.svelte` (test
fixture) and `src/routes/examples/theming/+page.svelte` (showcase).
Both cover the full dark-mode signals matrix and are driven by the
same dev-server (`npm run dev` → `http://localhost:17777/test/theming`).
The Playwright spec `e2e/theming.spec.ts` exercises them. PASS with
note; SvelteKit projects use `src/routes/` for fixtures, not
`docs/test/`.
