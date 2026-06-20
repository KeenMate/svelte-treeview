# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.0.0-rc13] - 2026-06-20

Sweep driven by the `/validate-web-component` punch list against the BlissFramework `web-components` guidelines (snapshot at `validation_2026-06-19_1955.md`). Most changes are mechanical alignment with the registered prefix + the `is*/should*` naming rule; the dark-mode rewrite is structural and the README split is a documentation reorganization.

### Changed
- **Boolean Props renamed to follow the `is*/should*/has*/can*` rule** (C-NC-3): ten flags that were ambiguous between verb and noun now read unambiguously as predicates. `showCheckboxes` → `shouldShowCheckboxes`, `clickTogglesCheckbox` → `shouldClickToggleCheckbox`, `accordionExpand` → `isAccordionExpand`, `progressiveRender` → `isProgressiveRender`, `useFlatRendering` → `isFlatRenderingEnabled`, `virtualScroll` → `isVirtualScrollEnabled`, `allowCopy` → `isCopyAllowed`, `autoHandleCopy` → `shouldAutoHandleCopy`, `autoHandleMove` → `shouldAutoHandleMove`, `autoHandlePaste` → `shouldAutoHandlePaste`. Six existing flags already followed the rule (`isSorted`, `isLoading`, `isRendering`, `shouldUseInternalSearchIndex`, `shouldDisplayDebugInformation`, `shouldDisplayContextMenuInDebugMode`) and are unchanged. Old names are not aliased — within an RC cycle the API is unstable by definition; consumers on rc12 search-and-replace each prop site. Applied across `src/lib/`, `src/routes/`, `e2e/`, `docs/`, `ai/`, `README.md`, `CHANGELOG.md`, `CLAUDE.md` (~314 occurrences across 36 files). `svelte-check` reports 0 errors after the sweep.
- **`dark-mode.css` migrated to Strategy B (color-scheme flipping)**: the previous file (~140 lines) re-declared every `--stv-*` token inside each conditional signal block (Strategy A). The new file (~45 lines) flips `color-scheme: dark` (or `light`) on the framework-theme + per-instance selectors and lets the `light-dark(<light>, <dark>)` fallbacks already present in `variables.css` resolve the dark branch. Three wins: (a) ~5× shorter file — adding a new themeable variable no longer requires touching every signal block; (b) consumer `--base-*` overrides survive — Strategy A's hardcoded dark literals (e.g. `#1a1a1a`) silently replaced themed values, Strategy B leaves the consumer chain untouched; (c) aligns with what web-treeview is migrating to. Signal precedence is unchanged: per-instance `.stv__container[data-theme]` → framework ancestor class → page `color-scheme` via `light-dark()` → OS preference via `@media`.
- **`component-variables.manifest.json` prefix + variable names refreshed**: top-level `"prefix": "ltree"` → `"prefix": "stv"`, and every `componentVariables[].name` renamed `ltree-X` → `stv-X` (the rc12 BEM rename touched the code but left the manifest out of sync — theme-designer and any consumer reading the manifest saw names that no longer existed in the CSS). All five auto-script "name declared but not defined" warnings (`ltree-rem`, `ltree-primary`, `ltree-success`, `ltree-danger`, `ltree-light`) resolve cleanly after the rename. `--base-*` usage strings updated to reference `--stv-*` where they cross-link.
- **`--stv-light` dark fallback tuned from `#1a1a1a` to `#2b2b2b`**: `--stv-light` doubles as the context-menu hover surface and the elevated chip background, so a dark value identical to `--stv-bg` (`#1a1a1a`) flattened the elevated surface against the main bg in dark mode. The new value matches `--stv-elevated-bg` and keeps the surface distinguishable. Affects `variables.css:51` only.
- **`.stv__container` declares `display: block` explicitly** (C-TC-7): the host `<div>` defaults to block already, but the rule requires the declaration to be explicit so the cascade is reasoned-about, and matches web-treeview's container. Single line in `base.css`.
- **README cut from 1103 → 347 lines** (C-RS-2): three long sections — `## Advanced Usage`, `## Styling and Customization`, `## API Reference` — extracted to topical docs under `docs/`. The README now opens with a new `## What is it` intro (value proposition + audience) and routes readers to deeper material via a `## Demos & docs` link block. What's-New bullets reformatted to the canonical `**lead phrase — short headline** — prose body` form with a real em-dash (U+2014) between the bold lead and the prose (C-RS-16). Historical `.ltree-container` / `--ltree-*` references in the rc10 and rc09 bullets renamed to `.stv__container` / `--stv-*` with a parenthetical note that the BEM rename shipped in rc12.

### Added
- **`docs/usage.md`, `docs/theming.md`, `docs/examples.md`, `docs/accessibility.md`** at the package root: usage carries the full Props / Methods / Events / Snippets reference; theming carries the `--base-*` / `--stv-*` contract, the cascade-layer footgun warning, dark-mode signal precedence, and the BEM class reference; examples carries the drag-drop / multi-select / context-menu / search / tree-edit cookbook; accessibility carries the keyboard navigation table (derived from `Tree.svelte` `handleTreeKeydown`) and the three-level selection model. All four are linked from the README's `## Demos & docs` section.
- **`## About` and `## Built with BlissFramework` sections in the README** (C-RS-14 / C-RS-15): About credits KeenMate, frames the Pure Admin / `@keenmate/theme-designer` integration as opt-in via the `--base-*` taxonomy, and clarifies that there's no runtime dependency on Pure Admin. BlissFramework links to the live guidelines.
- **`VALIDATION-NOTES.md` at the package root**: register for accepted deviations from the BlissFramework component guidelines that the team has decided are correct outcomes for this component. Initial entries cover C-CST-4 (namespace-style Logic class split across `src/lib/core/` + `src/lib/ltree/`), C-NC-6 (six structural `*Member` props without paired `getXCallback` — `id`, `path`, `parentPath`, `level`, `hasChildren`, `order` — because no consumer would want a per-node computed override for "what is this node's id"), C-NC-8 / C-CSS-7 (framework-theme `.dark` / `.light` ancestor qualifiers in `dark-mode.css` are not classes the component emits — they're conventions the component honors), and C-CS-5 (dark-mode fixture lives at SvelteKit routes/, not `docs/test/`, because this is a SvelteKit app). Future `/validate-web-component` runs read this file and downgrade matching flags from ❌ Fail to ⚠️ Exception.
- **Dynamic Theme Switching demo at the bottom of `/examples/theming`**: ported from `@keenmate/web-daterangepicker`'s `examples-theming.html` "Dynamic Theme Switching" section. A single demo tree with two button rows underneath — seven brand buttons (Default / Material / Neon / Sharp / Soft / Forest / Glass, each rendered in the accent color of the theme it switches to so the row reads as a swatch picker) that hot-swap a class on the wrapper, and three color-scheme buttons (Inherit / Light / Dark) that drive the per-instance `theme` prop on `<Tree>`. Reuses the existing `.playground-wrapper.brand-*` CSS so all seven brand themes work with zero new theme CSS. A live code block under the buttons shows the JS equivalent for both swaps.

### Fixed
- **`collapseNodes`, `collapseAll`, and `expandAll` now refresh the toggle UI of every affected node**: same class of bug as the rc12 `expandNodes({exclusive:true})` fix, but in three sibling code paths that were missed. `collapseNodes` (the path that handles dblclick-to-collapse in `clickBehavior='select'`), `collapseAll`'s `collapseRecursive`, and `expandAll`'s `setExpandedRecursive` + exclusive-mode `trim` helper all flipped `node.isExpanded` without bumping `node._rev`. The flat-mode keyed `{#each}` then reused the existing Node component, leaving `class:expanded={node.isExpanded}` on the toggle icon stale — visually the chevron stayed rotated-down on collapsed parents (and rotated-right on just-expanded ones) until something else forced a re-render. Children-visibility worked correctly because `visibleFlatNodes` re-derives from `changeTracker`. Each site now bumps `_rev` after flipping `isExpanded`, guarded by an "actually changed" check so already-correct rows don't churn. The same gap existed in web-treeview's ltree — mirrored there for parity, though its DOM-diff renderer reads `data-expanded` directly and masked the user-visible symptom.
- **`get*Callback` seed-time props now see `node.data` populated**: `insertArray` and `insertBranch` evaluated `getIsExpandedCallback`, `getIsSelectableCallback`, `getIsSelectedCallback`, `getIsDraggableCallback`, and `getIsDropAllowedCallback` *before* assigning `node.data = row`. Consumer callbacks of the shape `(node) => node.data?.X !== false` therefore saw `undefined` and returned their default branch — typically `true` — so every per-node opt-out silently failed. Manifested in `/examples/drag-drop`: File C carrying `isDraggable: false` in its data was still draggable. Fix moves `node.data = row` above the callback block at both sites. Regression coverage: new `src/lib/ltree/seed-callbacks.test.ts` (vitest, 7 cases, runs in 4ms) exercises all five callbacks reading from `node.data?.X` in both `insertArray` and `insertBranch` — 4 of 7 tests fail against the pre-fix code.
- **Desktop drag-drop now honors `node.isDropAllowed`**: the `isDropAllowedMember` / `getIsDropAllowedCallback` props seed `node.isDropAllowed`, but only the touch path consulted it (`TreeController.svelte.ts` lines 3110 + 3199); the desktop `_onNodeDragOver`, `_onNodeDrop`, public `dragOver` / `drop`, and the glow-mode `_onZoneDrop` all skipped it. Net result: setting `isDropAllowed: false` muted touch drops but desktop drag-and-drop went through anyway — surprising given the prop's name. All five sites now gate on `node.isDropAllowed`. The dragover gate suppresses the hover highlight (visual feedback that the target won't accept), and the drop-side gate is the real enforcement (Node.svelte's ondragover calls `event.preventDefault()` itself before forwarding to the controller, so the drop event fires regardless of the dragover gate — the drop handlers must filter). Backwards-compat: every existing fixture and example already opts in via `getIsDropAllowedCallback={() => true}`, so no consumer of the in-tree code is affected.

### Added
- **`/test/callbacks` fixture + `e2e/callbacks.spec.ts` (9 tests)**: closes the e2e gap that let the seed-callback bug ship. The existing `/test/drag-drop` fixture covers `allowedDropPositionsMember` (data-field form) but never used `getIsDraggableCallback`, `getAllowedDropPositionsCallback`, or `getIsDropAllowedCallback`, so none of the per-node callback opt-outs had a failing test. The new fixture wires all three callbacks reading from `node.data` and exposes drop state via `data-testid` spans. Spec asserts: `draggable="false"` on a pinned row + no `onNodeDrop` fires when dragging it; drops on a `['child']`-only target snap to child even when aimed at "before"; drops on a `['before','after']` target snap to before/after when aimed at "child"; and drops onto a row with `isDropAllowed: false` don't fire `onNodeDrop` at all. Two `isDraggable` tests and the `isDropAllowed` test all fail against the pre-fix code.

## [5.0.0-rc12] - 2026-06-19

### Changed
- **CSS prefix rename, BEM class shape**: every CSS class and variable now follows the BlissFramework `naming-conventions.md` BEM rule (`<prefix>__element--modifier`, two underscore levels max), with the registered prefix changing from `ltree` to `stv`. Mechanical part: `--ltree-*` → `--stv-*` (every variable; consumer overrides need to swap the prefix). BEM part: every `.ltree-X` class is rewritten — elements as `.stv__X` (e.g. `.ltree-node` → `.stv__node`, `.ltree-node-content` → `.stv__node-content`, `.ltree-context-menu-item` → `.stv__context-menu-item`), state classes as modifiers (e.g. `.ltree-drag-over` → `.stv__node-content--drag-over`, `.ltree-context-menu-item-disabled` → `.stv__context-menu-item--disabled`, `.ltree-icon-expand` → `.stv__toggle-icon--expand`, `.ltree-drop-zones-around` → `.stv__drop-zones--around`). Semantic rename folded in: `.ltree-selected-{bold,border,brackets}` → `.stv__node-content--highlight-{bold,border,brackets}` and `.ltree-selected-highlight` → `.stv__node-content--highlight-fill`. One non-BEM utility kept: `.stv__clickable` (was `.ltree-clickable`) — applied to both the toggle-icon span and the node-content div as a plain `cursor: pointer` marker; promoting it to a modifier of one or the other would force a duplicate class. `BlissFramework/guidelines` reservation table now lists `stv` (svelte-treeview) and `wtv` (web-treeview) instead of the legacy `ltree` exception. Internal directory names (`src/lib/ltree/`, `ltree-node.svelte.ts`, `ltree-helpers.ts`) and their imports are untouched — those refer to the LTree data structure, not the CSS prefix. The full rename was applied by `scripts/rename-css-prefix.mjs`, kept in-tree.

### Added
- **`.stv__node-content--highlighted` and `.stv__node-content--focused` always-on marker classes**: wired into `Node.svelte` via `class:` directives so any node with `node.isHighlighted === true` automatically gets a subtle bg + outline, and any focused node gets a stronger outline. Both rules read through opt-in custom-property hooks (`--stv-highlighted-bg`, `--stv-highlighted-outline`, `--stv-focused-outline`) with `color-mix` fallbacks against `--stv-primary` — set them on `.stv__container` (or any ancestor) to retint without touching the marker classes themselves. The pre-existing `highlightedNodeClass` / `focusedNodeClass` props still work for layering louder styles on top.



### Changed
- **Context menu positioning ported to `@floating-ui/dom`**: The root menu and every submenu are now placed by `computePosition` + `autoUpdate` instead of raw `left/top` inline styles and CSS `:hover` show/hide. Root menu uses a virtual reference at `(contextMenuX + contextMenuXOffset, contextMenuY + contextMenuYOffset)` with `bottom-start` placement + `flip()` + `shift({padding:8})` so the menu now flips above the cursor near the viewport bottom and slides sideways instead of clipping. Submenus use `right-start` with a `left-start` fallback. `contextMenuXOffset` / `contextMenuYOffset` props keep their existing semantics — the menu's top-left still lands exactly at `(cursor + offsets)`; the `offset` middleware is set to `0` so no extra gap is introduced. Internally: the recursive context-menu snippet in `Tree.svelte` was extracted into a new `ContextMenuLevel.svelte` component, and `ContextMenuItem.svelte` (the public snippet-based component) was updated to mount its submenu on hover (150ms hide grace) instead of relying on CSS `:hover`. CSS `:hover > .ltree-context-submenu` rules and `position: absolute; left: 100%` removed from `context-menu.css`.

### Added
- **`@floating-ui/dom` runtime dependency** (`^1.7.6`): Required by the context menu positioning above. Matches the version pinned in `@keenmate/web-treeview`.

### Fixed
- **`expandNodes(path, { exclusive: true })` now updates the toggle UI of collapsed siblings**: The `exclusive` option trims off-spine branches by setting `child.isExpanded = false`, and the expand walk sets `node.isExpanded = true`. Both mutations were missing a `_rev` bump, so the flat-mode keyed `{#each}` reused the existing Node component for the affected rows. The reused component left the toggle icon's `class:expanded` modifier stale — visually the branch looked still-expanded (chevron rotated, even though children were gone) and the just-expanded target's toggle still looked collapsed (even though its children were now visible). The children-visibility side reacted correctly because `visibleFlatNodes` re-derives from `changeTracker`. The fix bumps `_rev` on every mutation in both phases (matching the pattern `Node.svelte`'s accordion-collapse already used). Covered by `e2e/exclusive-expand.spec.ts` against `/test/exclusive-expand`. (web-treeview is unaffected: its `expandNodes` doesn't support `exclusive`, so there's no off-spine trim path to fix.)
- **`scrollToPath` reliably scrolls to targets in just-expanded deep branches**: With `isFlatRenderingEnabled` + `isProgressiveRender` (the default), `expandNodes` reveals new rows in rAF-deferred batches sized `initialBatchSize` (default 20) and doubling. Previously, `scrollToPath` queried the DOM after one `tick()` — only the immediate batch was rendered, so any target row past that batch produced a `console.warn("DOM element not found")` and the function returned `false` without scrolling or highlighting. Symptom: in long deep trees, search-result navigation appeared to do nothing for hits in collapsed branches with many siblings. Fix: the non-virtual branch of `scrollToPath` now retries the DOM lookup for up to ~6 additional frames (each `await rAF + tick`) before giving up, matching the retry pattern already used by the virtual-scroll branch's highlight step. Covered by `e2e/search-deep.spec.ts` against `/test/search-deep` (1000 leaves over 3 levels, `initialBatchSize=5`, targets at the 10th sibling position so they fall in the deferred batch). Same fix applied to `@keenmate/web-treeview` (identical progressive-render logic, identical bug).
- **Esc-cancelling a drag no longer leaves the source node "stuck" selected**: `_onNodeDragStart` schedules a rAF that replaces `highlightedPaths` with the dragged node (OS-convention selection sync so multi-drag visually shows what's moving). Previously, if the user then pressed Esc, the browser fired `dragend` with `dropEffect = 'none'` and the controller still left the dragged node highlighted, applying `.ltree-selected-bold` (bold + primary color) to the source row even though the user had cancelled. Two-part fix: (1) the rAF now snapshots the prior `highlightedPaths` before mutating, and `_onNodeDragEnd` rolls the highlight back when `dropEffect === 'none'`; (2) `_onNodeDragStart` now also attaches the `dragend` listener directly to the source element instead of relying solely on the `.ltree-container` listener — the rAF's `tree.refresh()` detaches the source row from the document, so the subsequent `dragend` couldn't bubble to the container and the handler never ran. Direct-element listeners still fire after detachment. Successful drops behave as before — the new highlight stays. Covered by `e2e/drag-esc-cancel.spec.ts`. (web-treeview is unaffected: it has no OS-convention highlight sync on drag start, and already attaches `dragend` at both `bodyEl` and `document` levels.)

## [5.0.0-rc10] - 2026-06-10

### Changed
- **CSS custom properties rescoped from `:root` to `.ltree-container`**: All `--ltree-*` declarations now live on the tree's root element instead of the document root. This mirrors the `:host`-scoped pattern from `@keenmate/web-multiselect` / `web-daterangepicker` and is the only way `--base-*` theming actually works at subtree scope. Previously, a wrapper around the tree that set `--base-accent-color: red` had no effect because `--ltree-primary`'s `var(--base-accent-color, ...)` substitution was frozen at `:root`. With the new scope, the substitution recomputes on `.ltree-container` (a descendant of the wrapper), and `--base-*` set on any ancestor flows through correctly. Multiple trees on the same page can now be themed differently via subtree wrappers.

  **Consumer migration**: setting `--ltree-*` on a wrapper element (e.g., `.my-theme { --ltree-primary: red }`) no longer cascades into the tree, because `.ltree-container` has its own direct rule for every `--ltree-*` token. To theme a subtree, prefer `--base-accent-color` (and the rest of the `--base-*` taxonomy) on the wrapper — every primary-derived tint follows via the existing `color-mix()` chains. To override an `--ltree-*` directly, target `.ltree-container`: `.my-wrap .ltree-container { --ltree-primary: red }`.

### Added
- **`--ltree-bg` CSS variable**: The tree's `.ltree-container` now paints its own default background (`var(--base-main-bg, light-dark(#ffffff, #1a1a1a))`) so consumers don't need to wrap the tree in a colored container for a visible surface. The dark-mode CSS flips `--ltree-bg` alongside the other surface tokens. Set `--ltree-bg: transparent` to restore the pre-rc10 layered behavior.
- **Built-in dark mode with belt-and-suspenders coverage**: New `dark-mode.css` partial in an `@layer overrides;` cascade catches all four signals — OS preference via `@media (prefers-color-scheme: dark)`, framework theme classes (`[data-theme="dark"]`, `[data-bs-theme="dark"]`, `.dark`), per-instance opt-in via the new `theme` prop on `<Tree>`, and symmetric `light` selectors so a single tree can be forced back to light on a dark page. Every `--ltree-*` color variable's fallback now uses `light-dark(<light>, <dark>)` so consumers who declare `html { color-scheme: light dark }` get OS-aware behavior automatically with zero JavaScript.
- **`theme` prop on `<Tree>`**: `'dark' | 'light' | null | undefined`. Forwards to the root `.ltree-container` as `data-theme`, where the stylesheet's per-instance selectors (`.ltree-container[data-theme="dark"]`) take over. Leave `undefined` to inherit from the page (OS, framework class, etc.).
- **`--ltree-elevated-bg`, `--tree-ghost-shadow` CSS variables**: `elevated-bg` reads through the canonical `--base-elevated-bg` chain for surfaces above the main background (currently feeds the context-menu chain); `tree-ghost-shadow` replaces a hardcoded `rgba(0,0,0,0.3)` literal in the touch drag ghost so consumers can recolor or remove the shadow.
- **`getIsDropAllowedCallback` prop + `getNodeIsDropAllowed(node)` method**: Callback variant for the existing `isDropAllowedMember` data-field prop, matching the pattern rc09 introduced for `getIsExpandedCallback` / `getIsSelectableCallback` / `getIsSelectedCallback`. Seeded at `insertArray` time. Precedence: callback > member > default. Additionally, `getIsDraggableCallback` is now actually applied during the seed walk (the prop existed in rc09 but inert at insert-time — only consumed lazily in some paths). Precedence: callback > member > default for both.

### Changed
- **CSS file layout aligned with the Bliss web-component guidelines**: All `_<partial>.css` renamed to `<partial>.css` (the underscore was a legacy SASS convention and these are plain CSS modules). `main.css` now declares `@layer variables, component, overrides;` and wraps every `@import` in `layer(...)` — consumers' unlayered overrides automatically beat every rule in the library, no `!important` needed. New canonical Tier-2 stubs (`controls.css`, `floating.css`, `animations.css`) added even where empty, so the file set is identical across the KeenMate component suite. `@keyframes bounce` and `@keyframes ltree-spin` moved into `animations.css`.
- **Loading overlay background adapts to theme**: `--ltree-loading-bg` no longer hardcodes `rgba(255, 255, 255, 0.8)`; it now composes 80% of `--base-main-bg` against the page so the semi-transparent overlay reads correctly on both light and dark surfaces.
- **`component-variables.manifest.json` extended**: `base-elevated-bg` added to the `baseVariables` list; `ltree-elevated-bg` and `tree-ghost-shadow` added to `componentVariables`. The manifest now stays in sync with the new variable surface.

### Fixed
- **Virtual scroll stuck at bottom after filter shrinks the tree**: When the user scrolled down and then typed a search filter, `visibleFlatNodes` collapsed and `vsTotalHeight` shrank below the previous scroll position. The browser silently clamped the container's actual `scrollTop`, but the controller's `vsScrollTop` state kept its stale large value — so `vsStartIndex` fell out of range, `flatNodesToRender` was empty, and the scrollbar appeared frozen near the bottom with no content rendered. A new `$effect` now reacts to `vsTotalHeight` and clamps both `vsScrollTop` and the container's `scrollTop` to the new max whenever content shrinks below the current scroll position.
- **Double-click expand silently broken in `clickBehavior='select'` mode**: The browser's native `dblclick` event never fired because the first click triggered focus → `_setFocusedNode` bumped `node._rev` → the flat-mode `{#each}` destroyed and recreated the row, so the second click landed on a different DOM element and the browser refused to synthesize a `dblclick`. The controller now detects double-clicks manually (`_lastSelectClickPath` / `_lastSelectClickTime`, 400 ms threshold) so a rapid second click on the same node toggles its expand state regardless of re-render. Node-level `_onNodeDblClicked` removed (it could double-toggle if the browser ever did fire `dblclick`).

## [5.0.0-rc09] - 2026-06-07

### Added
- **`selectionMode: 'single' | 'multi'` prop** (default `'single'`): Decides how highlight cardinality and modifier keys behave. In `'single'`, plain click sets highlight to one node and Ctrl/Shift+click degrade to plain click; Shift+Arrow and Enter are no-ops. In `'multi'`, Ctrl+click toggles, Shift+click extends a range from the focused node, Shift+Arrow extends one step, and Enter toggles highlight on the focused node. Matches the [selection-highlight-model.md](selection-highlight-model.md) decision record.
- **Implicit highlight → selection mirroring when `shouldShowCheckboxes` is false**: Every change to `highlightedPaths` is mirrored into `selectedPaths`, and `onSelectionChange` fires alongside `onHighlightChange`. When checkboxes are visible the two sets stay decoupled — highlight is the cursor / range cursor, checkbox state is the form selection. No new toggle prop; the rule follows `shouldShowCheckboxes` directly. Programmatic API (`highlightNode`, `highlightNodes`, `clearHighlight`) mirrors too and respects `{ silent: true }`.
- **`shouldClickToggleCheckbox` prop**: Boolean (default `false`). When `true` AND `shouldShowCheckboxes` is on AND the node is selectable, a plain click on the node label runs the checkbox-toggle path instead of focusing/highlighting — `focusedNode` and `highlightedPaths` stay untouched. Expand-on-click still fires when `clickBehavior` is `'expand'` or `'expand-and-focus'`. Modified clicks (Ctrl/Shift) fall through to the normal multi-highlight path so range/toggle selection still works.
- **`getIsExpandedCallback`, `getIsSelectableCallback`, `getIsSelectedCallback` props**: Callback variants for the existing `isExpandedMember` / `isSelectableMember` / `isSelectedMember` data-field props, matching the same pattern as `getIsDraggableCallback` and `getIsCollapsibleCallback`. All three are seed-only — invoked once per node during `insertArray` — so subsequent user mutations (checkbox clicks, expand button) aren't overridden by the callback. Precedence: callback > member > default. The post-insert `selectedPaths` seeding walk now also triggers when `getIsSelectedCallback` is set, not just when `isSelectedMember` is set.
- **Lucide SVG toggle icons**: All built-in `ltree-icon-*` classes (default chevron, alt filled-triangle, plus/minus, arrow, leaf) now render Lucide SVGs via `mask-image` + `background-color: currentColor` instead of UTF-8 glyph characters (`▶ ▼ ⯈ ⯆ + − → ↓ •`). Icons inherit text color automatically, render cleanly at any size, and don't depend on font fallback. Zero added DOM nodes — still a single `::before` pseudo-element per toggle.
- **`--ltree-toggle-icon-size` / `--ltree-toggle-icon-width` / `--ltree-toggle-icon-color` CSS variables**: Runtime overrides for the toggle column's icon size (default `16px`, was `12px`), column width (`20px`), and color (`#6c757d`). The SCSS variables (`$tree-toggle-icon-*`) still drive the build-time defaults; the CSS vars are bridged via `var(--…, #{$…})` so users can scale icons live without recompiling SCSS.
- **Toggle icon live demo on `/examples/theming`**: A new card with radio controls for the four built-in icon sets and the `toggleIconMode` (`rotate` / `swap`) prop, wired to a live `<Tree>`. A code snippet under the controls reflects the current selection so users can copy-paste the props they see.
- **Full CSS-variable theming surface (`--ltree-*` with `--base-*` chain)**: Every styling value is exposed as a CSS custom property at `:root`. The resolution chain is end-user override → `--base-*` token (shared with other `@keenmate/*` web components) → hardcoded default. Roughly fifty new variables covering typography, node layout, toggle icon, checkbox, selection / highlight / drag states, drop zones (pastel + glow modes), context menu, debug info, scroll highlight, and loading overlay. Pattern matches `@keenmate/web-multiselect` and `@keenmate/web-daterangepicker`.

### Changed
- **`!isSelectable` now also gates highlight (and therefore the mirrored selection in no-checkbox mode), not just the checkbox render**: Click handlers and Shift+arrow range expansion skip non-selectable nodes when building the highlight set. Focus and arrow navigation are NOT gated — the focused row can still land on `!isSelectable` nodes so consumers can show external detail panels (sidebars, breadcrumbs, etc.).
- **Right-click no longer moves focus or highlight**: `_onNodeRightClicked` only opens the context menu at the right-clicked node. Consumers reading the focused/highlighted set inside `getContextMenuItemsCallback` should now use the `node` argument that the callback receives, since right-click no longer rewrites `focusedNode` / `highlightedPaths`. The selected-nodes argument continues to reflect whatever multi-highlight the user had before opening the menu.
- **Drag and drop now moves the whole highlight set when the dragged node is in `highlightedPaths`** (same-tree, `operation: 'move'`, `shouldAutoHandleMove: true`): the algorithm picks the **top-level selected** subset — highlighted paths whose nearest highlighted ancestor is NOT in the set — and moves each one's full subtree. Selected descendants of a top-level node are absorbed (they ride along inside their ancestor's subtree, not separately extracted). Cross-tree multi-drag still moves the single dragged node (the cross-tree payload only carries one node).
- **Multi-drag now chains subsequent moves 'after' the previously moved subtree** (was: subsequent moves landed as children of `dropNode` regardless of the requested position). Dropping selection {A, B, C} 'after D' now produces `[D, A, B, C]` as siblings (previously: `[D]` at root with A/B/C as children of D). 'before D' produces `[A, B, C, D]`. 'child of D' produces D with children `[A, B, C]`. Source order is preserved within the moved set.
- **Dragging a non-highlighted node now replaces the highlight with that single node before the drag begins**: Matches the Windows Explorer / macOS Finder convention where mousedown on an unselected item selects it. Previously, the prior highlight stayed visible (the `click` event never fired because the user dragged instead of releasing) while the drag silently carried only the single grabbed node — making it impossible to tell what would actually move. The replacement runs in `_onNodeDragStart` and fires `onHighlightChange` / mirrors to `selectedPaths` like a plain click. Skipped if the dragged node is already in the highlight set (multi-drag) or is not selectable.
- **Keyboard: Enter toggles focused highlight in multi mode (was: always expand/collapse)**. In single mode Enter is now a no-op (falls through to the host). Space falls back to expand/collapse when no checkboxes are shown, but toggles the focused node's checkbox when `shouldShowCheckboxes` is on.
- **Ctrl/Shift+click on a node no longer toggles expand/collapse**: The modifier-click gesture is reserved for highlight management (toggle / range). Previously, in the default `clickBehavior='expand-and-focus'` mode, modified clicks both updated the highlight set AND expanded/collapsed the row, which made it impossible to multi-select folders without their contents flickering open. Plain click still expands as before. Matches OS file explorer conventions.
- **Stylesheet ported from SCSS to pure CSS**: `src/lib/styles/main.scss` (1095 lines, one file) split into eleven partials under `src/lib/styles/` (`_variables.css`, `_base.css`, `_node.css`, `_toggle-icons.css`, `_checkbox.css`, `_states.css`, `_drag-drop.css`, `_drop-zones.css`, `_context-menu.css`, `_debug.css`, `_loading.css`) plus a `main.css` entry point that chains them via CSS `@import`. SCSS `@mixin` constructs replaced with shared base-class boilerplate. Build now uses `lightningcss-cli` (one devDep) to bundle the imports into `dist/styles.css`; `sass` removed from devDependencies. Pattern matches the file layout in `@keenmate/web-multiselect` and `@keenmate/web-daterangepicker`.
- **`--ltree-rem` base sizing unit**: New CSS variable (default `10px`) drives every dimension via `calc(N * var(--ltree-rem))` — font sizes, paddings, margins, widths, radii, spinner size, etc. Set `--ltree-rem` once to scale the whole component proportionally (e.g., `--ltree-rem: 12px` for 20% larger). Set it to `1rem` to scale with document font-size (Pure Admin pattern). Default rendering is visually identical to the previous absolute-px output. Hairline borders (`1.5px` checkbox, `3px` glow) and animation timings stay absolute. Matches the `--ms-rem` / `--drp-rem` pattern in the sibling packages.
- **`component-variables.manifest.json` published at the package root**: Mirrors the schema used by `@keenmate/web-multiselect` and `@keenmate/web-daterangepicker`. Lists every `--base-*` token the component reads (with `required: true/false` flags) and every `--ltree-*` variable the component publishes (categorized: `color`, `sizing`, `spacing`, `border`, `surface`, `typography`, `state`, `drop-zone`, `context-menu`, `icon`, `animation`). Intended for IDE auto-completion, Storybook integration, and theme-designer tooling. Exported via the `./component-variables.manifest.json` package entry.
- **Hover background follows `--ltree-primary` by default**: `--ltree-node-hover-bg` default changed from solid `#f8f9fa` to `color-mix(in srgb, var(--ltree-primary) 8%, transparent)`. Themes that set only `--ltree-primary` now get a matching hover tint automatically; the explicit `--base-hover-bg` token override still wins over the derived default. Visually similar to the previous gray at default primary `#0d6efd`.
- **`--ltree-checkbox-focus-ring` split into tunable parts**: `--ltree-checkbox-focus-ring-width` (default `2px`) and `--ltree-checkbox-focus-ring-color` (default `color-mix(--ltree-primary 25%)`) — the composed `--ltree-checkbox-focus-ring` shorthand still works and now references both. Set just one part to widen the ring or recolor it without redeclaring the full box-shadow.

### Breaking
- **Default `selectionMode = 'single'` changes click semantics for existing multi-select users**: Previously Ctrl/Shift+click always built a multi-highlight regardless of any prop. Now the default is single-select — to keep the old behaviour, opt in with `selectionMode='multi'`. Plain click + Arrow nav are unchanged.
- **`selectedPaths` becomes populated in no-checkbox trees** because highlight is mirrored into selection. Consumers reading `selectedPaths` from no-checkbox `<Tree>` instances will now see values that previously stayed empty. To keep the old empty-`selectedPaths` behaviour, render checkboxes (and ignore them with CSS) or keep your own derived "real selection" set.
- **`lastHighlightedPath` (private), `isHighlightAnchor` (public on `LTreeNode`), `.ltree-highlight-anchor` (CSS class), `--ltree-highlight-anchor-width` / `--ltree-highlight-anchor-color` (CSS vars), and the matching `component-variables.manifest.json` entries removed**: The focused node now serves as the anchor for Shift+range operations. Internal Shift+Arrow uses a hidden `_shiftCursor` field — consumers never see it.
- **`./styles.scss` package export removed.** Consumers using `import '@keenmate/svelte-treeview/styles.scss'` must switch to `import '@keenmate/svelte-treeview/styles.css'` (the canonical export, unchanged). For per-section theming, individual partials are now available under `./styles/_<section>.css`.
- **`--ltree-primary-rgb` / `--ltree-success-rgb` / `--ltree-danger-rgb` removed** (along with `--base-accent-color-rgb` / `--base-success-color-rgb` / `--base-danger-color-rgb` from the `--base-*` chain). Tinted variants are now derived from the parent color via `color-mix(in srgb, var(--ltree-x) N%, transparent)` — so setting `--ltree-primary: red` automatically tints the multi-select background, dragover background, drop placeholder, focus ring, scroll highlight, debug panel, and danger context-menu hover without needing a companion `-rgb` variable. Matches the `@keenmate/web-multiselect` pattern. Minimum browser baseline: Chrome 111 / Safari 16.4 / Firefox 113 (all from March-May 2023).
- **Indent scaling semantics**: `--ltree-node-indent-per-level` was previously `0.5rem` (document-relative — followed `html { font-size }`). It is now `calc(0.8 * var(--ltree-rem))` — same visual default (8 px), but scales with `--ltree-rem` instead of document `rem`. To restore the old document-relative behavior, set `--ltree-rem: 1rem`.
- **SCSS variable overrides (`$tree-*`, `$drop-*`, `$primary-*`) no longer supported.** Migrate to CSS custom properties at runtime: `--ltree-node-font-size: 16px` instead of `@use '@keenmate/svelte-treeview/styles.scss' with ($tree-node-font-size: 16px)`. The full variable surface is documented at `/examples/theming`.

### Fixed
- **Stale `dragOverNodeClass` highlights piling up across rows during drag**: Each `Node` tracked its own local `isDraggedOver` flag, toggled by the row's own `ondragover` / `ondragleave`. HTML5 `dragleave` is unreliable when crossing between sibling rows fast (it can fire with cursor coordinates still inside the leaving row's rect, or skip altogether when `dragenter` on the next row beats it) — so the dashed-green dragover highlight got stuck on rows the cursor had already left, leaking one stale highlight per missed leave. The class is now applied via direct `classList.add/remove` on the previous-and-new DOM nodes from a controller `$effect` that watches the centralized `hoveredNodeForDrop`, matching the existing touch-drag pattern. This guarantees exactly one highlighted row at a time and the cost stays O(1) per node-crossing regardless of tree size — no per-Node prop propagation. The dead per-node `isDraggedOver` state was removed.
- **`ltree-selected-brackets` invisible when checkboxes are enabled**: The adjacent-sibling rule that hides the `❯ ❮` pseudo-elements (because the checkbox already signals selection) left the class with zero visual effect — highlighted nodes looked identical to unhighlighted ones. The suppressed selector now also applies `font-weight: bold` and `color: var(--ltree-primary)` as a fallback so the highlight is always visible.
- **Independent checkbox mode auto-checking parents**: In `checkboxMode="independent"`, the post-toggle ancestor walk still ran and propagated `isSelected = true` up to parents when all descendants happened to be selected — making parent checkboxes auto-check themselves despite the "independent" promise. The walk is now gated to cascade mode only; independent mode leaves parents fully alone.
- **`Node.svelte` stale icon/highlight classes after `tree.update()`**: `expandIconClass`, `collapseIconClass`, `leafIconClass`, `highlightedNodeClass`, `focusedNodeClass`, `dragOverNodeClass`, and `isCopyAllowed` were destructured from the shared `NodeConfig` `$state` proxy as primitive snapshots, so once Node mounted they never updated. Replaced with `$derived(config.x)` so runtime updates (including the new icon-set radios in the theming demo) actually propagate.

## [5.0.0-rc08] - 2026-05-27

### Added
- **`{ silent: true }` option on highlight/selection methods**: `highlightNode`, `highlightNodes`, `clearHighlight`, `deselectAll` (and deprecated `selectNode`/`selectNodes`) now accept `{ silent: true }` to update state without firing `onNodeClick` / `onHighlightChange` / `onSelectionChange`. Intended for URL-restore flows (deep links loading form data from query params) where firing the change callback would re-trigger form loaders and clobber the data the URL just supplied. Silent mode also skips focusing the tree container so it doesn't steal focus from whatever the user is interacting with.
- **Array variants on expand/collapse methods**: `expandNodes`, `collapseNodes`, `expandAll`, and `collapseAll` now accept `string | string[]`. Single emit per call regardless of array length.
- **`{ exclusive: true }` option on `expandNodes` and `expandAll`**: Opens the target path(s) and collapses anything currently expanded that isn't on the union-of-spines (and, for `expandAll`, not under a target subtree). Equivalent to `collapseAll() + expandNodes(path)` but in a single pass with one emit — downstream listeners (transition animations, URL sync, virtualized renderers) don't see the intermediate fully-collapsed state. Non-collapsible nodes (`isCollapsible === false`) are never touched.
- **`{ noEmit: true }` option on all four expand/collapse methods**: Skips the change emit, enabling batching multiple operations and emitting once at the end via `tree.refresh()`.
- **`/examples/silent-highlight` demo page**: URL-restore scenario with loud vs. silent toggle showing how form data is preserved in silent mode.
- **`/examples/expand-collapse` demo page**: Demonstrates array variants and exclusive focus mode.

## [5.0.0-rc07] - 2026-05-23

### Added
- **`isSelectedMember` prop**: Data field name that seeds `node.isSelected` at `insertArray` time. The controller walks the tree after insert and pre-populates the bindable `selectedPaths` Set with every path where the field is truthy — independent of `isSelectableMember`, so non-selectable nodes can still ship checked.
- **`isSelectableMember` prop now publicly wired**: Previously declared on the core types but not exposed through `Tree.svelte`'s prop/update interface. Now end-to-end usable. Controls whether a node renders a checkbox and carries the `ltree-clickable` class.

### Fixed
- **Filter race with async indexing**: A `bind:searchText` change that landed while the FlexSearch index was still being built (via `requestIdleCallback` batches) saw an empty index, hid the entire tree, and never recovered — no mechanism re-applied the filter once indexing completed. `filterNodes` now remembers the active query and the indexer's `onComplete` callback re-runs it, so the visible filter catches up automatically regardless of `indexerBatchSize`, dataset size, or how fast the user types.

## [5.0.0-rc06] - 2026-03-31

### Added
- **`shouldShowCheckboxes` prop**: Renders a checkbox before each selectable node with custom styling and indeterminate support.
- **`checkboxMode` prop** (`'independent'` | `'cascade'`): Controls whether checking a parent cascades to all descendants. Indeterminate state shown when partial.
- **`beforeCheckboxToggleCallback` interceptor**: Cancel or override checkbox toggles.
- **Three-level selection model**: Separated into `focusedNode` (single node, click/arrows), `highlightedPaths` (multi-select, Ctrl/Shift+click), and `selectedPaths` (checkbox data state). Highlight and checkbox state are independent — build a highlight selection, then check/uncheck all highlighted nodes with one checkbox click.
- **`onHighlightChange` event**: Fires when highlighted paths change (Ctrl+click, Shift+click, etc.).
- **Bulk checkbox via highlight**: When multiple nodes are highlighted and a checkbox in the highlight is clicked, all highlighted nodes toggle together.
- **Shift+Arrow/Home/End keyboard highlight**: Shift+ArrowDown/Up extends highlight range by one sibling, Shift+Home/End extends to first/last visible node.
- **PageUp/PageDown navigation**: Jumps 10 visible nodes forward/back. Shift+PageUp/PageDown extends highlight by 10 nodes.
- **`ltree-selected-highlight` CSS class**: Explorer-style blue background highlight. Customizable via `--ltree-highlight-bg` and `--ltree-highlight-color`.
- **Interaction example page** (`/examples/interaction`): Interactive demos for click behavior, checkboxes, multi-select, and keyboard navigation. All settings persisted to localStorage.

### Fixed
- **Keyboard navigation not working after node click**: Clicking a node now auto-focuses the tree container, so arrow keys work immediately without having to click the container separately.
- **Svelte proxy equality warning on checkbox toggle**: `_setFocusedNode` now compares by path instead of object identity to avoid `state_proxy_equality_mismatch`.

### Breaking
- **`selectedNode` → `focusedNode`**: Renamed prop and bindable. The single focused node (last clicked / arrow-keyed to).
- **`selectedPaths` repurposed**: Now represents checkbox-only data state. For click/highlight multi-select, use `highlightedPaths`.
- **`highlightedPaths` (new)**: Replaces old `selectedPaths` for Ctrl+click / Shift+click UI highlight.
- **`selectedNodeClass` → `highlightedNodeClass`**: CSS class applied to highlighted nodes.
- **`focusedNodeClass` (new)**: CSS class applied to the single focused node.
- **`onSelectionChange` repurposed**: Now fires on checkbox selection changes only. Use `onHighlightChange` for highlight changes.
- **`selectNode()` / `selectNodes()` deprecated**: Use `highlightNode()` / `highlightNodes()` instead.

## [5.0.0-rc05] - 2026-03-26

### Added
- **`clickBehavior` prop** (`'select'` | `'expand'` | `'expand-and-focus'`, default `'expand-and-focus'`): Controls what happens on node click. Replaces the boolean `shouldToggleOnNodeClick` prop. Matches canvas package's `ClickBehavior` type.

### Breaking
- **`shouldToggleOnNodeClick` removed**: Replace `shouldToggleOnNodeClick={true}` with `clickBehavior="expand-and-focus"` (default) and `shouldToggleOnNodeClick={false}` with `clickBehavior="select"`.

## [5.0.0-rc04] - 2026-03-12

### Added
- **`TreeNavigation<T>` interface**: Pluggable keyboard navigation per renderer. Each renderer (HTML, Canvas) provides its own spatial implementation. Users can override individual methods via `TreeNavigationOverrides<T>`.
- **Bulk subtree operations**: `insertBranch(parentPath, nodes)`, `replaceBranch(path, nodes)`, `deleteBranch(path)` on TreeController — perform subtree-level add/replace/remove with a single tree emission.
- **Clipboard API on TreeController**: `copyNodes(paths?)`, `cutNodes(paths?)`, `pasteNodes(targetPath, position, options?)`, `cancelCut()`, `hasClipboard()`, `getClipboardOperation()`. Cut nodes are dimmed via `cutPaths` set. Supports `shouldAutoHandlePaste` (default) and manual mode for server-driven workflows.
- **Branch-operations example** (`/examples/branch-operations`): Server-simulated cut/paste workflow demonstrating `deleteBranch` + `insertBranch` with clipboard integration.

### Fixed
- **`.ltree-container` missing `outline: none`**: Container div now suppresses browser focus outline.

## [5.0.0-rc03] - 2026-03-08

### Added
- **Multi-select**: Ctrl+click (Cmd on Mac) toggles individual nodes in/out of selection. Shift+click selects a range from the last-clicked anchor to the current node. Plain click clears selection and selects one node.
- **`selectedPaths` bindable prop**: `Set<string>` of all selected node paths. Two-way binding for external control.
- **`rangeSelectionMode` prop**: `'visual'` (default) selects only visible/expanded nodes between anchor and target; `'logical'` selects all nodes in depth-first tree order including collapsed children.
- **`onSelectionChanged` event**: `(paths: Set<string>, nodes: LTreeNode<T>[]) => void` fires when selection changes.
- **`contextMenuCallback` 3rd parameter**: Now receives `selectedNodes?: LTreeNode<T>[]` — enables selection-aware context menus.
- **Public multi-select API on TreeController**: `selectNode(path, mode)`, `selectNodes(paths)`, `deselectAll()`, `getSelectedNodes()`, `isNodeSelected(path)`.
- **`SelectionModifiers` type export**: `{ ctrl: boolean; shift: boolean }` for modifier-aware click handling.
- **`.ltree-multi-selected` CSS class**: Styling for nodes in a multi-selection.
- **Unified Context Menu types** (`ContextMenuItem`, `ContextMenuDivider`, `ContextMenuEntry`): Shared type system across svelte-treeview and canvas-tree. Breaking change from old API: `title` → `label`, `callback` → `onclick`, `isDivider` flag replaced by separate `ContextMenuDivider` type with `divider: true` discriminator.
  - **Named dividers**: `{ divider: true, label: 'Section' }` renders as `──── Section ────`
  - **Keyboard shortcuts**: `shortcut` field renders right-aligned hint and activates on keypress when menu is open
  - **Submenus**: `children: ContextMenuEntry[]` opens nested menu on hover
  - **Visibility control**: `isVisible: false` hides items in callback approach (snippet approach uses `{#if}`)
  - **Flexible styling**: `className` replaces dedicated `danger` boolean — use `className="danger"` or any custom class
  - **Async onclick**: `onclick` supports `Promise<void>` return with try/catch error handling
- **`ContextMenuItemC` / `ContextMenuDividerC` Svelte components**: Declarative context menu building inside the `contextMenu` snippet. Supports nested children slot for submenus.
- **Context menu keyboard shortcuts**: When context menu is open, pressing a shortcut key (e.g. `C`, `Shift+N`, `F2`) triggers the matching item's `onclick`. Supports modifier keys (Ctrl, Shift, Alt). Escape closes the menu.
- **`isAccordionExpand` prop**: Per-parent accordion behavior — expanding a node automatically collapses its siblings (children of the same parent). Opt-in via `isAccordionExpand={true}`. Respects `isCollapsibleMember`/`getIsCollapsibleCallback` — non-collapsible siblings are not force-collapsed. Programmatic methods (`expandAll`, `expandNodes`) remain unconstrained.
- **`toggleIconMode` prop** (`'rotate'` | `'swap'`, default `'rotate'`): Controls how expand/collapse icons behave. `'rotate'` mode (new default) always uses `expandIconClass` (▶) and rotates it 90° via CSS when expanded — smooth animated transition. `'swap'` mode switches between `expandIconClass` (▶) and `collapseIconClass` (▼) classes (previous behavior). Ported from `@keenmate/web-treeview`.

### Fixed
- **Expand/collapse icon not updating in flat rendering mode**: `toggleExpanded()` now bumps `node._rev` so the flat-mode `{#each}` key changes and Svelte re-renders the node with the correct icon state.
- **`.expanded` CSS transform was a no-op**: `.ltree-toggle-icon.expanded` had `rotate(0deg)` (no effect). Fixed to `rotate(90deg)` for the new `rotate` toggle icon mode.

## [5.0.0-rc02] - 2026-03-05

### Architecture (Breaking)
- **Core/Renderer split**: Tree logic (`TreeController`) fully separated from rendering. `Tree.svelte` is now a thin wrapper delegating to `TreeController`. New `TreeProvider` component enables custom renderers (Canvas, WebGL, SVG) on the same core.
- **Drop position naming**: `'above'`/`'below'` renamed to `'before'`/`'after'` throughout (`DropPosition` type, CSS classes, events). `'child'` unchanged.
- **Canvas rendering extracted**: Canvas-based rendering (`CanvasTree`, layouts, themes) moved to separate package `@keenmate/svelte-treeview-canvas`.

### Added
- **Render mode switch for examples**: Shared `RenderModeSwitch` component across all example pages. Three-button segmented control (Recursive / Progressive / Virtual) with localStorage persistence. All example `<Tree>` instances receive mode props via `{...getTreeProps()}`.
- **Virtual scroll mode** (`isVirtualScrollEnabled`, `virtualRowHeight`, `virtualOverscan`, `virtualContainerHeight`): Only renders visible nodes + overscan rows in a fixed-height scrollable container. Enables smooth scrolling through trees with 50,000+ nodes while maintaining ~50 DOM nodes. rAF-throttled scroll handler, auto-measures row height if not explicitly set.
- **Virtual scroll `scrollToPath`**: Index-based scrolling that centers the target node in the viewport, waits for rAF-throttled scroll + re-render, applies highlight with retry logic.
- **Search navigation UX**: Filter/search mode toggle on the search example page. Filter mode hides non-matching nodes, search mode keeps tree visible and navigates to highlighted results. Includes result counter, prev/next chevron buttons, Enter/Shift+Enter keyboard navigation (round-robin), Escape to clear.
- **CSS zone auto-expand**: Floating drop zones auto-expand when positions are hidden (via `allowedDropPositions`). Uses `:not(:has())` CSS rules for "around", "above", "below" layouts.
- **Unified flat rendering indentation**: Both flat and recursive modes use `--tree-node-indent-per-level` CSS variable. Added `flatGap` logic for parent-to-first-child gap matching.
- **`overscroll-behavior: contain`** on `.ltree-virtual-scroll` container.
- **`isCollapsibleMember` / `getIsCollapsibleCallback`**: Per-node collapsibility control.
- **`getIsDraggableCallback`**: Dynamic per-node draggability.
- **`applyChanges()` batch method**: Apply multiple tree edits in a single operation.
- **`_rev` change tracking** on nodes for efficient keyed rendering.

### Fixed
- **Floating drop zones clipped by scrollable containers**: Moved floating drop zone rendering from `Node.svelte` (absolute positioning inside each node) to `Tree.svelte` (fixed positioning at tree level with `z-index: 10000`). Zones now escape `overflow: hidden` containers. Handler methods (`isFloatingPositionAllowed`, `handleFloatingZoneDragOver`, `handleFloatingZoneDragLeave`, `handleFloatingZoneDrop`) added to `TreeController`.
- **Glow and floating drop zones showing simultaneously**: In flat rendering mode, `dropZoneMode` destructured from `NodeConfig` context was a stale snapshot (nodes aren't recreated). Changed to `$derived(config.dropZoneMode)` so it reads through the reactive proxy on each evaluation.
- **"After" drop position placing node at end instead of between siblings**: `moveNode` and `addNode` converted root nodes' `parentPath` from `''` to `null` via `|| null`, while `insertArray` used `getParentPath()` which returns `''`. This mismatch caused `sortCallback` to skip the `sortOrder` comparison (`'' !== null` → entered parentPath branch → returned 0), preserving insertion order instead of respecting sort order.
- **Empty tree drop placeholder ignoring `dragDropMode`**: `handleEmptyTreeDragOver/Drop/TouchEnd` now check `dragDropMode !== 'none'` before activating the drop placeholder.
- **`treeId` not synced on prop changes**: Added `$effect` in `Tree.svelte` to sync `treeId` prop to controller after mount.
- **`dropZoneStart` not used in glow mode**: `calculateGlowPosition` now uses `dropZoneStart` to compute the child zone threshold instead of hardcoded `width/2`.
- **Sort order mismatch between recursive and flat modes**: `visibleFlatNodes` applied `sortCallback` during traversal while recursive mode relied on insertion-order `Object.values()`. Removed runtime sort from flat traversal to match recursive mode — both now use insertion-time sorting from `insertArray()`.
- **Critical `$state()` vs `$state.raw()` performance regression**: TreeController's `data` property deep-proxied user data, causing **5,500x slowdown** with 8,000+ nodes. Changed `data`, `selectedNode`, `insertResult`, `contextMenuNode`, `hoveredNodeForDrop`, `touchDragState`, `flatRenderedIds`, `flatRenderQueue` to `$state.raw()`.

### Changed
- **Custom Layout Example — Explicit Drop Zones**: Replaced invisible spatial detection with visible drop zone pills (Before / After / Child) on dendrograms.

## [4.7.2] - 2026-02-17

### Fixed
- **`bodyClass` prop not working** ([#24](https://github.com/keenmate/svelte-treeview/issues/24)): `class:bodyClass` was toggling a literal CSS class named `"bodyClass"` instead of applying the user's custom class value. Changed to `class={bodyClass}`.

## [4.7.1] - 2026-02-17

### Changed
- **Drag and Drop Disabled by Default**: `dragDropMode` now defaults to `'none'` instead of `'both'`
  - Most trees are read-only, so this is a safer default
  - To enable drag and drop, explicitly set `dragDropMode="both"` (or `"self"` / `"cross"`)

### Fixed
- Removed development `console.log` statements from `Tree.svelte` and `ltree.svelte.ts`

## [4.7.0] - 2026-02-11

### Added
- **Per-Node Drop Position Restrictions**: New feature to control which drop positions are allowed per node
  - `allowedDropPositionsMember` - Property name mapping for static data (e.g., from server)
  - `getAllowedDropPositionsCallback` - Callback for dynamic position logic based on node type
  - `DropPosition` type exported: `'above' | 'below' | 'child'`
  - Example use cases:
    - Trash folder: `['child']` only (can drop INTO, not above/below)
    - Files: `['above', 'below']` only (can't drop INTO a file)
    - Folders: `undefined` or `[]` (all positions allowed - default)
  - Works with both glow mode (snaps to nearest allowed position) and floating mode (only shows allowed zones)
  - Backwards compatible: `undefined`/empty array = all positions allowed

### Example Usage
```typescript
// Callback approach (dynamic logic)
function getAllowedDropPositionsCallback(node: LTreeNode<T>): DropPosition[] | null {
  if (node.data?.type === 'file') return ['above', 'below'];
  if (node.data?.type === 'trash') return ['child'];
  return undefined; // all positions allowed
}

// Member approach (server data)
const data = [
  { path: '1', name: 'Trash', allowedDropPositions: ['child'] },
  { path: '2', name: 'Document.pdf', allowedDropPositions: ['above', 'below'] },
  { path: '3', name: 'Projects' }, // all positions (default)
];
```

## [4.6.0] - 2026-02-11

### Added
- **Flat Rendering Mode**: New `isFlatRenderingEnabled` prop (default: `true`) for significantly faster rendering
  - Renders all visible nodes in a single `{#each}` loop instead of recursive components
  - Initial render ~12x faster (300ms → 25ms for 5500 nodes)
  - Progressive rendering batches initial load to prevent UI freeze
  - Documentation: `docs/FLAT_MODE_PERFORMANCE.md`
- **Context-Based Node Configuration**: Moved stable callbacks and config to Svelte context
  - `NodeCallbacks<T>` interface for all event handlers (click, drag, drop, touch)
  - `NodeConfig` interface for stable configuration (icons, classes, drop zone settings)
  - Eliminates inline arrow function re-renders (5500 nodes no longer re-evaluate on array changes)
  - Exported types: `NodeCallbacks`, `NodeConfig` from package index
- **Async beforeDropCallback**: `beforeDropCallback` now supports async/Promise return values
  - Enables showing confirmation dialogs before completing a drop
  - Can await user input to decide whether to cancel, proceed, or modify the drop
  - Example: `async (dropNode, draggedNode, position) => { return await showDialog(); }`

### Enhanced
- **Exponential Batch Sizing**: Progressive rendering now uses exponential batching (20 → 40 → 80 → 160...)
  - First batch (20 nodes) renders instantly for immediate visual feedback
  - Batch size doubles each frame up to `maxBatchSize` (default 500)
  - New props: `initialBatchSize` (default 20), `maxBatchSize` (default 500)
  - Replaces fixed `renderBatchSize` prop
  - Expand/collapse on large trees (>1000 nodes): Immediate add to minimize diffs
- **Tree Editor Example**: Enhanced with async drop validation dialog
  - Demonstrates async `beforeDropCallback` with native confirm dialog
  - Shows warning when drop position is modified

### Fixed
- **Scroll Highlight Stacking**: Fixed multiple nodes staying highlighted when rapidly clicking prev/next
  - Previous highlight now immediately cleared when navigating to new node
  - Timeout properly cancelled to prevent stale highlight removal
- **Flat Mode Node Updates After Move**: Fixed nodes not re-rendering after `moveNode()` in flat mode
  - Keyed each now uses `node.id + path + hasChildren` to detect moved nodes
  - Moved nodes now correctly update their indentation level
  - Parent nodes correctly update toggle icon when children are moved away

### Changed
- **Default Rendering Mode**: `isFlatRenderingEnabled` now defaults to `true` (was `false`)
- **Default Progressive Render**: `isProgressiveRender` now defaults to `true` (was `false`)

## [4.5.0] - 2026-02-09

### Added
- **Drop Zone Layout Configuration**: New props to customize drop zone appearance and positioning
  - `dropZoneLayout` - Controls zone arrangement with 5 layout options:
    - `'around'` (default) - Above zone on top, Below/Child zones on bottom
    - `'above'` - All 3 zones in a horizontal row above the node
    - `'below'` - All 3 zones in a horizontal row below the node
    - `'wave'` - Zones stacked vertically (above/child/below) with fixed width
    - `'wave2'` - Diagonal wave pattern with Above/Below offset 7% to the left
  - `dropZoneStart` - Number (0-100) controlling where zones start horizontally (default: 33%)
  - `dropZoneMaxWidth` - Max width in pixels for wave layouts (default: 120px)
- **New TypeScript Type**: `DropZoneLayout` type exported from `types.ts`
- **Mobile Touch Drag and Drop**: Full touch support for drag and drop on mobile devices
  - Long-press (300ms) to initiate drag - distinguishes from tap and scroll
  - Visual ghost element follows finger during drag showing the dragged node
  - Drop target highlighting using existing `dragOverNodeClass` prop
  - Haptic feedback via `navigator.vibrate()` when drag starts (on supported devices)
  - Automatic cancellation if finger moves >10px before long-press completes (allows normal scrolling)
  - Works alongside existing desktop HTML5 drag and drop - same `onNodeDrop` callback for both
- **Drop Placeholder for Empty Trees**: When dragging nodes to an empty tree, a drop zone placeholder appears
  - Shows visual drop target in empty trees during drag operations
  - Works with both desktop (HTML5 DnD) and touch drag
  - Customizable via `dropPlaceholder` snippet prop for custom content
  - `onNodeDrop` callback receives `null` as `dropNode` for root-level drops into empty trees
- **Drop Position Indicators**: Visual indicators showing exactly where dropped items will be placed
  - Three drop positions per node: `'above'` (sibling before), `'child'` (as child), `'below'` (sibling after)
  - Absolutely positioned indicators on right half of node to prevent layout shifts
  - Position calculated from mouse Y: top 25% = above, middle 50% = child, bottom 25% = below
  - New CSS classes: `.ltree-drop-indicators`, `.ltree-drop-above`, `.ltree-drop-child`, `.ltree-drop-below`
- **Root Drop Zone**: Drop zone that appears at bottom of non-empty trees during drag
  - Allows dropping items as root-level nodes in trees that already have content
  - New CSS class: `.ltree-root-drop-zone`
- **Drag Drop Mode Control**: New `dragDropMode` prop to control allowed drag operations
  - `'none'` - Drag and drop disabled
  - `'self'` - Only within same tree
  - `'cross'` - Only between different trees
  - `'both'` - Both self and cross-tree (default)
- **Sibling Order Support**: New `orderMember` prop for explicit sibling ordering
  - Specifies which field in user data contains the sort order value
  - Used by default sort to order siblings within the same parent
  - Required for proper above/below positioning in drag-drop tree editors
  - Example: `orderMember="sortOrder"` with data like `{ path: '1.1', name: 'A', sortOrder: 10 }`
- **Tree Editor Helper Methods**: New methods for building tree editors
  - `getChildren(parentPath)` - Get direct children of a node
  - `getSiblings(path)` - Get all siblings of a node (including itself)
  - `getNodeByPath(path)` - Get a node by its path
  - `refreshSiblings(parentPath)` - Re-sort children of a parent using orderMember
  - `refreshNode(path)` - Trigger re-render for a specific node
- **Tree Editor Mutation Methods**: New methods for modifying tree structure
  - `addNode(parentPath, data, pathSegment?)` - Add a new node to the tree
  - `moveNode(sourcePath, targetPath, position)` - Move a node with full subtree to a new location
    - Supports 'above', 'below', and 'child' positions
    - Automatically updates paths of all descendants
    - Calculates order values when orderMember is set
  - `removeNode(path, includeDescendants?)` - Remove a node from the tree
- **Example Pages**: New `/examples` route with interactive demos (same look-and-feel as web-multiselect)
  - Landing page with feature cards linking to 7 example sections
  - Basic Examples: tree rendering, expand level control, scroll to path, programmatic expand/collapse
  - Drag & Drop: two-tree drag demo, touch drag instructions, drop placeholder customization
  - Context Menu: callback-based menus, dynamic items, icons, disabled states, dividers
  - Search & Filter: live filtering with `searchText`, `searchNodes()` query method
  - Theming: CSS variable reference, theme examples (default, purple, dark, green)
  - Data Structures: path-based hierarchy, custom separators, insert result validation
  - Tree Editor: add/move/remove nodes with drag-drop and orderMember support
- **Drop Indicator Arrows**: Visual arrow indicators for glow-mode drop zones
  - Arrows positioned at 66% of row width, centered vertically
  - Uses Lucide SVG icons as data URIs: `arrow-big-up`, `arrow-big-down`, `arrow-big-right-dash`
  - Child arrow rotated 45° for diagonal pointing effect
  - Fully customizable via SCSS variables
- **Ctrl+Drag Copy Operation**: Full support for copying nodes via Ctrl+drag
  - `isCopyAllowed` prop enables Ctrl+drag to copy instead of move
  - `shouldAutoHandleCopy` prop (default: true) controls whether Tree auto-handles same-tree copies
    - `true`: Tree creates copy with generated ID (`{id}_copy_{timestamp}`) - good for batch/offline mode
    - `false`: User callback handles copy (for DB/API integration) - good for online/live mode
  - Copy operations respect drop position (above/below/child) just like moves
  - Visual feedback: `.ltree-drop-copy` class applied during copy operations
- **Position Support for copyNodeWithDescendants**: Enhanced copy method now supports sibling positioning
  - New optional parameters: `siblingPath` and `position` ('above' | 'below')
  - Copies can be placed at specific positions relative to siblings
  - Uses same `orderMember` logic as `moveNode` for consistent ordering
- **Logging Infrastructure**: Categorized logging using vendored loglevel library
  - Six log categories: `LTREE:INIT`, `LTREE:DATA`, `LTREE:RENDER`, `LTREE:INDEX`, `LTREE:DRAG`, `LTREE:UI`
  - Color-coded console output with timestamps for easy debugging
  - Disabled by default (silent mode) for production
  - Exported utilities: `enableLogging()`, `disableLogging()`, `setLogLevel()`, `setCategoryLevel()`
  - UI logging: node clicks, expand/collapse, selection changes, context menu
  - Drag logging: drag start/end, drop operations, touch drag events
  - Render logging: progressive rendering frame stats
  - Index logging: async search indexing progress
  - New `/dev/logging` demo page for testing log levels and categories
- **Performance Logging**: Dedicated performance measurement utilities
  - Measures key operations: `insertArray` (conversion/sort/insert phases), `filterNodes`, `expandAll`, `collapseAll`
  - Output includes duration, item count, per-item time, and items/sec throughput
  - Summary view showing breakdown by phase with percentages
  - Configurable threshold to only log operations slower than X ms
  - Exported utilities: `enablePerfLogging()`, `disablePerfLogging()`, `setPerfThreshold(ms)`
  - Browser console access: `window.components['svelte-treeview'].perf.enable()`
  - Purple color-coded output for easy identification
- **Global Runtime API**: `window.components['svelte-treeview']` for browser console access
  - `config` - Package info (name, version, author, license, repository, homepage) read from package.json at build time
  - `version()` - Returns current version string
  - `logging.enableLogging()` / `logging.disableLogging()` - Toggle all logging
  - `logging.setLogLevel(level)` - Set level for all categories
  - `logging.setCategoryLevel(category, level)` - Set level for specific category
  - `logging.getCategories()` - List available log categories
- **Container-Scoped Scrolling**: New `containerScroll` option for `scrollToPath()`
  - `scrollToPath(path, { containerScroll: true })` scrolls only within the nearest scrollable ancestor
  - Prevents page-level scrolling when tree is inside a scrollable container
  - Automatically finds the scrollable parent element (overflow: auto/scroll)
  - Useful for search result navigation without disrupting page position

### Enhanced
- **Drop Zone Styling**: Improved visual feedback during drag operations
  - Semi-transparent zones (0.25 opacity) that become solid (0.85) when hovered
  - Modern pastel color palette: sage green for Above, peach/coral for Below, lavender for Child
  - Interactive controls in `/examples/drag-drop` to test all layout configurations
- **Drop Zone SCSS Variables**: Full customization of drop zone appearance via SCSS variables
  - `$drop-zone-border-radius` - Border radius for all zones (default: 0)
  - Per-zone variables for backgrounds, colors, and shadows in both inactive and active states:
    - Above: `$drop-zone-above-bg`, `$drop-zone-above-color`, `$drop-zone-above-active-bg`, `$drop-zone-above-active-color`, `$drop-zone-above-active-shadow`
    - Below: `$drop-zone-below-bg`, `$drop-zone-below-color`, `$drop-zone-below-active-bg`, `$drop-zone-below-active-color`, `$drop-zone-below-active-shadow`
    - Child: `$drop-zone-child-bg`, `$drop-zone-child-color`, `$drop-zone-child-active-bg`, `$drop-zone-child-active-color`, `$drop-zone-child-active-shadow`
- **Drop Zone Positioning**: Moved drop zones from inside `.ltree-node-content` to `.ltree-node-row` level
  - Eliminates padding-related gaps that made zones hard to reach
  - More predictable positioning relative to the full row width
- **Wave2 Layout Overlap**: Added 10% overlap for Above/Below zones in wave2 layout
  - Ensures first node's Above zone and last node's Below zone are always reachable
  - Child zone shrunk to 80% height to accommodate overlap without zone collision
- **dropZoneStart Flexibility**: Now accepts both number (percentage) and string (any CSS value)
  - Number: treated as percentage (e.g., `33` → `33%`)
  - String: used as-is (e.g., `"33%"`, `"50px"`, `"3rem"`)
- **Touch UX**: Added CSS properties to prevent text selection during touch drag
  - `-webkit-user-select: none` and `-webkit-touch-callout: none` on node content
- **Ghost Element Styling**: New `.ltree-touch-ghost` CSS class with customizable CSS variables
  - `--tree-ghost-bg`: Background color (default: rgba(59, 130, 246, 0.9))
  - `--tree-ghost-color`: Text color (default: white)
- **Drop Placeholder Styling**: New `.ltree-drop-placeholder` and `.ltree-drop-placeholder-content` CSS classes
- **Drop Indicator Arrow SCSS Variables**: Full customization of arrow indicators via SCSS variables
  - `$drop-arrow-above`, `$drop-arrow-below`, `$drop-arrow-child` - SVG data URIs for each direction
  - `$drop-arrow-size` - Arrow size (default: 24px)
  - `$drop-arrow-position` - Horizontal position within row (default: 66%)
  - `$drop-arrow-above-rotation`, `$drop-arrow-below-rotation`, `$drop-arrow-child-rotation` - Rotation angles
- **Search Example Page Redesign**: Merged filter and search cards into unified search experience
  - Single search input with live filtering and result navigation
  - Prev/Next buttons to traverse search results with wrap-around
  - Result counter showing "X of Y" position indicator
  - Keyboard navigation: Enter = next result, Shift+Enter = previous
  - Clickable result list with active item highlighting
  - Auto-scroll to first result when searching

### Fixed
- **Empty Tree Drop Placeholder**: Fixed drop placeholder not appearing when dragging to empty trees
  - Added missing `ondragenter` handler to empty state divs
  - Added `min-height: 60px` to `.ltree-empty-state` to ensure drop target is always reachable
- **Drag-Drop Demo ID/Path Mismatch**: Fixed bug where second node drop to first node didn't work on first try
  - Root cause: `nextId++` post-increment caused id and path to use different values
  - Fixed by extracting `const itemId = nextId++` before using in object properties
- **Tree Data Reset**: Fixed `insertArray` not clearing existing tree data when called with new/empty data
  - Previously, setting `data = []` would not clear the tree - existing nodes remained visible
  - Now `insertArray` properly resets root children, nodeCount, and maxLevel before inserting
- **Example Pages Data Insertion**: Added `isSorted={true}` to all example page Tree components
  - Prevents "Could not find parent node" errors caused by `sortCallback` sorting data before insertion
  - When `sortCallback` alphabetizes data, children could be inserted before parents (e.g., "AuthService" before "Services")
  - `isSorted={true}` tells the tree to skip pre-sorting and only use `sortCallback` for display ordering
- **Search Example Async Index**: Added note explaining that search index is built asynchronously
  - Added Enter key support for better UX when retrying searches
  - Users are now informed to wait a moment if no results appear immediately after page load
- **Search Example Reactivity**: Made "Search Nodes (Query)" input reactive
  - Added `$effect` to automatically trigger search when input changes
- **Glow Mode Border Radius**: Fixed border-radius appearing on glow drop indicators during drag
  - Changed `$tree-node-content-border-radius` default from `4px` to `0`
- **Search Example Documentation**: Fixed incorrect prop name in search configuration table
  - Changed `searchValueCallback` → `getSearchValueCallback` (correct prop name)
  - Fixed callback signature from `(item: T) => string` to `(node: LTreeNode<T>) => string`
- **LTreeNode Type Export**: Added `LTreeNode` re-export from `types.ts`
  - Fixes import errors when using `import type { LTreeNode } from '$lib/ltree/types'`
- **Search Example Endless Loop**: Fixed `$effect` causing infinite loop on search
  - Used Svelte's `untrack()` to prevent reactive state updates from re-triggering the effect
  - Effect now only reacts to `searchText` changes, not internal state mutations
- **Search Example Container Scroll**: Fixed prev/next navigation scrolling the entire page
  - Now uses `scrollToPath(path, { containerScroll: true })` for container-scoped scrolling
- **Critical Performance Bug in insertArray**: Fixed O(n²) algorithm causing 85+ second load times
  - Progressive render check was iterating all remaining nodes for every node at expandLevel
  - With 17,000 nodes this caused ~145 million iterations instead of ~34,000
  - Fix: Pre-compute last expandLevel index once, then use simple index comparison
  - Result: Load time reduced from 85+ seconds to under 1 second
- **Global API Constants**: Fixed `__PACKAGE_NAME__ is not defined` error when using library in other projects
  - Vite `define` constants only work during dev, not when library is built with `svelte-package`
  - Added `scripts/generate-constants.js` to bake package.json values into `constants.generated.ts`

### Important - Svelte 5 Performance

**Use `$state.raw()` for large datasets passed to Tree component**

When passing large arrays (1000+ items) to the Tree component, use `$state.raw()` instead of `$state()` to avoid severe performance degradation:

```typescript
// SLOW - Svelte deeply proxies all 8000+ objects, causing 5000x slowdown
let treeNodes = $state<TreeNode[]>([])
treeNodes = response.data  // Each item becomes a Proxy

// FAST - Array is reactive but items remain plain objects
let treeNodes = $state.raw<TreeNode[]>([])
treeNodes = response.data  // Items stay as plain objects
```

**Why this matters:**
- `$state()` creates deep proxies - every nested object becomes a Proxy
- Tree's `insertArray()` accesses multiple properties on each data item
- With 8000 items × ~10 property accesses = 80,000 proxy operations
- Proxy overhead: ~2.2ms per item vs ~0.0004ms for plain objects (5,500x slower)

**Symptoms of this issue:**
- Tree takes 15-90+ seconds to render with thousands of items
- Console shows `[Violation] 'message' handler took XXXXms`
- Same data loads instantly in isolated test environment

**The fix does NOT affect reactivity** - changes to `treeNodes` array itself still trigger updates. Only the individual items inside lose deep reactivity, which Tree doesn't need.
  - Build now runs `npm run generate-constants` before `svelte-package`
- **Glow Mode Border Radius**: Added `!important` to `border-radius: 0` on glow classes to ensure override
  - Removed `border-radius: 4px !important` from `.ltree-dragover-glow` class
  - Removed `border-radius` from `.ltree-node-content` transition to prevent animation glitch
- **Glow Mode Drop Validation**: Fixed glow showing on invalid drop targets
  - When `dragDropMode='cross'` prevents drops, glow no longer appears on hover
  - Cleared `hoveredNodeForDrop` state when drop validation fails
  - Debug logging for drop rejection now gated behind `shouldDisplayDebugInformation`
- **Glow Mode Border Radius Transition**: Fixed double border artifact on node hover during drag
  - Added `border-radius` to transition property for smooth animation
  - Eliminates visual conflict between base rounded corners and glow's straight corners
- **Ctrl+Drag dropEffect Timing**: Fixed copy operation failing with `dropEffect: none`
  - Root cause: Node's `ondragover` read stale `dropOperation` prop before Tree updated it
  - Fix: Node now reads `event.ctrlKey` directly to calculate dropEffect immediately
  - Also added dropEffect confirmation in `ondrop` handlers for spec compliance
- **Missing isCopyAllowed Prop in Recursive Node**: Fixed `isCopyAllowed` not being passed to child nodes
  - Caused Ctrl+drag to fail on non-root nodes since they defaulted to `isCopyAllowed=false`
  - Added `{isCopyAllowed}` to recursive Node component call

### Changed
- **BREAKING: onNodeDrop Signature**: Callback signature updated to include drop position
  - Before: `onNodeDrop?: (dropNode, draggedNode, event) => void`
  - After: `onNodeDrop?: (dropNode, draggedNode, position, event) => void`
  - `position` is `'above'`, `'below'`, or `'child'` indicating where item should be placed
  - `dropNode` can be `null` when dropping into empty tree or root drop zone

## [4.4.0] - 2025-10-02

### Added
- **External Update Method**: New `update()` method for programmatic prop updates from vanilla JavaScript
  - Allows external code to update component props without Svelte reactivity
  - Accepts partial object with any Tree props (excluding snippets/templates)
  - Useful for HTML/JavaScript integration and dynamic configuration
  - Example: `tree.update({ searchText: 'query', expandLevel: 3, data: newData })`

### Fixed
- **Search Functionality**: Fixed search filtering in context-menu dev page
  - Added missing `searchValueMember="name"` prop to enable proper search indexing
  - Search now correctly filters nodes by name instead of filtering everything out

### Changed
- **Code Cleanup**: Renamed internal "trie" references to "tree" for consistency
  - Updated variable names in Tree.svelte, Node.svelte, and ltree-demo.ts
  - Removed "trie" from package.json keywords
  - Improved code readability and naming consistency throughout codebase

## [4.3.1] - 2025-09-25

### Enhanced
- **Async Callback Support**: Context menu callbacks now fully support async operations
  - Updated `callback: () => void | Promise<void>` signature in `ContextMenuItem` interface
  - Added automatic error handling for async callbacks with try/catch wrapper
  - Menu item clicks properly await async operations before completing
  - Errors in async callbacks are logged to console for debugging
- **Robust Error Handling**: Async callback failures don't break menu functionality
  - Failed async operations are caught and logged automatically
  - Developers can implement custom error handling within their callbacks
  - Menu stays open on errors, allowing users to retry actions
- **Enhanced Dev Examples**: Added comprehensive async callback demonstrations
  - Copy action with simulated network delay
  - New folder creation with error simulation (20% failure rate)
  - Database backup with long-running operation simulation
  - Shows patterns for success/failure handling and conditional menu closing

### Documentation
- **Async Patterns**: Examples showing proper async callback implementation
- **Error Handling**: Best practices for managing async operation failures
- **Menu Control**: Demonstrated conditional closing based on operation success/failure

## [4.3.0] - 2025-09-25

### Added
- **Enhanced Context Menu Control**: Context menu callback now receives `closeMenuCallback` parameter for programmatic menu control
  - `contextMenuCallback?: (node: LTreeNode<T>, closeMenuCallback: () => void) => ContextMenuItem[]`
  - Developers can now control when/if context menu closes after menu item actions
  - Enables conditional closing patterns (e.g., don't close on cancel, only on success)
  - Public `closeContextMenu()` method exported for external control
- **Context Menu Item Styling**: New `className?: string` property in `ContextMenuItem` interface
  - Apply custom CSS classes to individual menu items for styling
  - Supports multiple classes (space-separated strings)
  - Example: `className: 'text-danger fw-bold'` for destructive actions
- **Enhanced Dev Examples**: Updated context menu examples to demonstrate new features
  - Conditional menu closing patterns for different action types
  - CSS class styling demonstrations with Bootstrap classes
  - Improved UX patterns showing when to close vs keep menu open

### Enhanced
- **Flexible Menu Behavior**: Context menu now supports various interaction patterns
  - Immediate close after action completion
  - Conditional close based on user confirmation
  - Persistent menu for multi-step operations
  - Custom styling per menu item type

## [4.2.1] - 2025-09-24

### Enhanced
- **Debug Context Menu Positioning**: Improved debug context menu to position relative to tree element instead of viewport
  - Debug menu now appears 200px right and 100px down from each tree's top-left corner
  - Supports multiple trees on same page with individual positioning
  - Enhanced debug logging to include tree ID and calculated position coordinates
  - Better for CSS development when tree is not at top-left of viewport
- **Debug Context Menu Robustness**: Enhanced debug mode to work with single-node trees
  - Uses second node when available, falls back to first node for single-node trees
  - More flexible node selection for debug menu display
  - Improved reliability for development scenarios

### Fixed
- **Debug Mode State Management**: Fixed context menu interference between debug mode and normal right-click menus
  - Added `isDebugMenuActive` state tracking to prevent debug logic from hiding user-triggered menus
  - Normal right-click context menus now work properly when debug mode is disabled
  - Proper cleanup of debug state when switching between modes
- **Debug Mode Requirements**: Relaxed debug context menu requirements to support edge cases
  - Changed minimum tree length requirement from `> 1` to `> 0` for better compatibility
  - Debug mode now works with any non-empty tree structure

## [4.2.0] - 2025-09-24

### Added
- **Context Menu System**: Comprehensive context menu functionality with two implementation approaches
  - **Callback-based Context Menus**: New `contextMenuCallback` prop that accepts a function `(node: LTreeNode<T>) => ContextMenuItem[]`
  - **ContextMenuItem Interface**: New interface with `icon`, `title`, `isDisabled`, `callback`, and `isDivider` properties
  - **Position Offset Configuration**: New `contextMenuXOffset` (default: 8px) and `contextMenuYOffset` (default: 0px) props for cursor clearance
  - **Debug Mode**: New `shouldDisplayContextMenuInDebugMode` prop for persistent context menu display at fixed position (200px, 100px)
  - **Snippet-based Support**: Maintains backward compatibility with existing `{#snippet contextMenu(node, closeMenu)}` approach
- **Enhanced Context Menu UX**:
  - Auto-close on scroll events (mouse wheel, scrollbar, touch, programmatic)
  - Auto-close on outside clicks
  - Support for disabled menu items with visual feedback
  - Support for menu dividers for visual organization
  - Rich icon support for menu items
- **Development Tools**: New `/dev/context-menu` page with comprehensive examples
  - Basic file system context menu example with conditional actions
  - Advanced server management example with status-based and type-specific menus
  - Real-time offset configuration testing
  - Interactive demonstration of all context menu features
  - Debug context menu mode with `shouldDisplayContextMenuInDebugMode` for easy styling development
  - Navigation link added to main layout for easy access

### Enhanced
- **CSS Styling**: Added comprehensive context menu styles in `main.scss`
  - `.ltree-context-menu`, `.ltree-context-menu-item`, `.ltree-context-menu-icon`, `.ltree-context-menu-divider` classes
  - Support for disabled states with `.ltree-context-menu-item-disabled`
  - Flexible layout with proper hover effects and visual hierarchy
- **Type Safety**: Full TypeScript support for all context menu features
- **Documentation**: Comprehensive README and CLAUDE.md updates covering both implementation approaches

### Fixed
- **Context Menu Scroll Behavior**: Fixed issue where context menu remained visible when scrolling
  - Added scroll event listeners with capture phase to catch all scroll events
  - Added wheel event listeners for mouse wheel scrolling
  - Context menu now properly closes on any scroll interaction

## [4.1.1] - 2025-09-23

### Fixed
- **TreePathSeparator Default Value**: Fixed `treePathSeparator` parameter to properly default to '.' when not provided to Tree.svelte
  - Previously, when `treePathSeparator` was undefined, the reactive effect would override the ltree's internal default
  - Now defaults to '.' in the parameter destructuring, ensuring consistent behavior

## [4.1.0] - 2025-09-23

### Fixed
- **Critical Sorting Bug**: Fixed default sort method to sort by level first, ensuring proper hierarchical tree construction
  - Previously sorted by parent path first, causing level 3 nodes to be inserted before level 2 nodes
  - Now sorts by level (depth) first, then parent path, then display value
  - Eliminates "Could not find parent node" errors when nodes are inserted out of level order
- **Progressive Rendering**: Fixed progressive rendering feature to work correctly with proper level-based sorting
  - Progressive rendering now displays levels 1-2 immediately while deeper levels continue processing
  - Improves perceived performance for large datasets by showing initial tree structure quickly
- **TreePathSeparator Reactivity**: Fixed Tree component to properly update internal separator when `treePathSeparator` prop changes
  - Added reactive effect to update ltree's separator property when prop changes
  - Prevents race conditions where data is processed with wrong separator
  - Fixes filesystem demo and other custom separator use cases
- **Sort Functions in Examples**: Updated all demo sort functions to calculate level from path depth during sorting
  - Home page, dev page, and filesystem examples now use path-based level calculation
  - Ensures consistent level-first sorting across all demos and examples
  - Prevents insertion failures in example applications

### Enhanced
- **Test Coverage**: Added comprehensive test suite for sorting functionality
  - Tests verify level-first sorting behavior with various hierarchical data structures
  - Validates progressive rendering scenarios and sort correctness
  - Uses Vitest framework for fast, reliable testing

### Changed
- **Default Sort Algorithm**: Updated `_defaultSort` method to prioritize level over parent path for hierarchical correctness
- **Example Sort Functions**: All demo applications now use level-first sorting for consistent behavior

## [4.0.1] - 2025-01-23

### Fixed
- **treePathSeparator Propagation**: Fixed helper functions (`getParentPath`, `getRelativePath`, `getPathSegments`) to properly use the configured `treePathSeparator` instead of hardcoded "." separator
  - All path manipulation functions now respect the custom separator setting
  - Ensures consistent path handling throughout the tree operations when using custom separators like "/"
  - Fixed `getRelativePath` to use `pathSeparator.length` instead of assuming single character
  - Fixed `getLevel` to properly count segments with multi-character separators

### Added
- **Test Suite**: Added comprehensive test coverage for ltree helper functions
  - 24 test cases covering single-character, multi-character, and edge case separators
  - Vitest testing framework integration with `npm run test` and `make test` commands
  - Tests validate proper handling of separators like `"::"`, `"->>"`, `"<|>"` and complex edge cases

## [4.0.0] - 2025-01-09

### Added
- **Complete Showcase Site Redesign**: Comprehensive overhaul of the documentation and demo site
  - **API Reference Page**: Complete tabbed reference with properties, methods, events, and templates tables
  - **Professional Navigation**: Fixed-top navbar with burger menu, GitHub link, and responsive sidebar
  - **Ocean Color Scheme**: Beautiful blue-themed design using Coolors.co palette (#00171F, #003459, #007EA7, #00A7E1, #FFFFFF)
  - **Responsive Layout**: Mobile-first design with collapsible sidebar and backdrop overlay
  - **Enhanced Examples**: Four comprehensive code examples with descriptions in tabbed interface
- **Docker Production Setup**: Complete containerization for static site deployment
  - **Multi-stage Dockerfile**: Optimized build with Node.js builder and nginx production stage
  - **Static Site Generation**: SvelteKit configuration for pre-rendered HTML pages
  - **Make Commands**: Docker build, run, and management commands with custom registry support
  - **Nginx Configuration**: Optimized serving with gzip, caching, and SPA routing support

### Changed
- **Layout Architecture**: Moved from nested Bootstrap containers to clean, consistent structure
  - **Fixed Navigation**: Top navbar with brand, burger menu, and GitHub link
  - **Sidebar Design**: Fixed-width (280px) sidebar with consistent icon spacing
  - **Footer Integration**: Professional footer with KeenMate branding
- **SvelteKit Configuration**: Updated for optimal static generation
  - **Static Adapter**: Switched from adapter-auto to adapter-static for reliable builds
  - **Prerendering**: Enabled SSR and prerender for all showcase pages
  - **Build Output**: Optimized for nginx serving with proper fallback handling
- **Page Structure Consistency**: Standardized header structure across all showcase pages
  - **Removed Redundant Containers**: Eliminated nested container-fluid wrappers
  - **Clean Headers**: Direct h1 and description elements without Bootstrap grid overhead

### Enhanced
- **Visual Design**: Professional styling throughout the showcase site
  - **Fixed Icon Alignment**: Consistent 1.5rem width for sidebar navigation icons
  - **Gradient Backgrounds**: Sophisticated color gradients across navbar, sidebar, and footer
  - **Interactive Elements**: Hover effects, focus states, and smooth transitions
  - **Typography**: Clear hierarchy with proper contrast and accessibility
- **User Experience**: Improved navigation and usability
  - **Always-Visible Burger Menu**: Toggle sidebar on any screen size for flexible layout
  - **Responsive Behavior**: Automatic sidebar hiding on mobile with backdrop close
  - **Tab Navigation**: Full-width code examples with clean tab interface
  - **Mobile Optimization**: Touch-friendly interactions and responsive text sizing

### Fixed
- **Container Structure**: Resolved double-container issues causing layout inconsistencies
- **Sidebar Toggle**: Fixed burger menu functionality to work across all screen sizes
- **Static Generation**: Proper SvelteKit configuration for nginx-compatible static builds
- **Icon Spacing**: Consistent navigation icon width preventing text misalignment

### Documentation
- **API Reference**: Complete tables for all component properties, methods, events, and templates
- **Usage Examples**: Real-world code examples including organization tree configuration
- **Docker Documentation**: Make commands and containerization setup
- **Responsive Design**: Mobile-first approach with professional styling

## [4.0.0-rc.08] - 2025-01-08

### Added
- **searchNodes() Method**: New public method `searchNodes(searchText)` that returns an array of matching nodes without filtering the tree display
  - Programmatically search nodes using the internal search index
  - Returns `LTreeNode<T>[]` array of matching nodes
  - Useful for building custom search interfaces, suggestions, and result summaries
- **Configurable Path Separators**: New `treePathSeparator` property allows custom hierarchical path separators
  - Default remains `"."` for backward compatibility (e.g., "1.2.3")
  - Support for custom separators like `"/"` for file system style paths (e.g., "1/src/components")
  - All path operations throughout the component respect the custom separator
- **Data Structure Showcase Page**: New comprehensive `/data-structure` showcase page with four detailed sections:
  - **LTree Path Structure**: Understanding path-based hierarchical data model
  - **Optimized Data Structure**: Precomputed values for better performance
  - **Custom Path Separators**: Live demo with file system style paths using "/" separator
  - **External Search & Data Management**: Managing search outside the tree component
  - **Invalid Data Structures**: Common mistakes and unsupported patterns
- **Enhanced Search Showcase**: Added new `searchNodes()` method demonstration section to `/search` page
  - Interactive search interface showing difference between `searchNodes()` and `filterNodes()`
  - Live examples with result display and usage patterns
- **Insert Result Information**: New `insertResult` bindable property provides detailed information about data insertion
  - `InsertArrayResult<T>` interface with successful count and failed nodes array
  - Each failed node includes original data, processed node, and error message
  - Useful for data validation, debugging, and handling incomplete datasets
- **Drag-over Visual Feedback**: New `dragOverNodeClass` property for highlighting nodes during drag operations
  - Two built-in classes: `ltree-dragover-highlight` (dashed border) and `ltree-dragover-glow` (shadow effect)
  - Automatic state management with proper drag event handling
  - Provides clear visual feedback for drop targets during drag-and-drop operations

### Changed
- **Documentation Updates**: Updated README.md, CLAUDE.md, and showcase pages with new features
  - Added `searchNodes` to public methods documentation
  - Added `treePathSeparator` to Tree Configuration properties table
  - Updated architecture description to reflect configurable separators
  - Fixed path requirements documentation to clarify separator flexibility
- **Navigation Enhancement**: Added "Data Structure" page to sidebar navigation with 🗂️ icon

### Enhanced
- **Type System**: Updated `Ltree<T>` interface to include `searchNodes` method signature
- **Internal Architecture**: Enhanced `createLTree` function to accept configurable `treePathSeparator` parameter
- **Component Integration**: Updated `Tree.svelte` component to pass through `treePathSeparator` property

### Fixed
- **Node Indentation**: Fixed `Node.svelte` indent style to use consistent per-level indentation instead of cumulative indentation
  - Previously: Each level had exponentially increasing indent (level * indent-per-level)
  - Now: Each level uses fixed CSS variable `--tree-node-indent-per-level` allowing proper CSS-based indentation control
- **Search Index Accuracy**: Fixed `insertArray` to only add successfully inserted nodes to `flatTreeNodes` array
  - Prevents search index from returning incorrect node indices for nodes that failed to insert
  - Failed nodes are no longer included in search operations, ensuring search results match visible tree structure
- **Error Message Clarity**: Improved `insertTreeNode` error messages to include the failing node's path
  - Error format: `"Node: {path} - Could not find parent node: {parentPath}"`
  - Makes debugging hierarchical data issues much clearer

### Documentation
- **Comprehensive Examples**: Added working code examples for both basic and advanced use cases
- **Path Separator Flexibility**: Clarified that paths don't need to be dot-separated, can use any consistent separator
- **External Data Management**: Detailed examples of filtering data outside the tree component
- **Performance Optimization**: Guidelines for when to use precomputed values vs automatic calculations

## [4.0.0-rc.07] - 2025-01-06

### Added
- **Customizable Scroll Highlight**: New `scrollHighlightClass` property allows users to define custom CSS classes for scroll highlight effects
- **Built-in Highlight Options**: Added pre-built highlight classes:
  - `ltree-scroll-highlight` - Background glow with blue color (default)  
  - `ltree-scroll-highlight-arrow` - Red arrow indicator positioned to the right of the node
- **Scroll Highlight Timeout Control**: New `scrollHighlightTimeout` property (default: 4000ms) controls duration of highlight effect
- **Enhanced scrollToPath Method**: Improved scroll highlighting with proper element targeting and CSS class management
- **Debug Logging Control for Indexer**: Added `shouldDisplayDebugInformation` property to Indexer class for consistent debug logging control

### Changed
- **Removed CSS Animation Dependencies**: Scroll highlighting now uses pure CSS classes instead of CSS animations for better timeout control
- **Improved Element Targeting**: `scrollToPath` now targets `.ltree-node-content` specifically for more precise highlighting
- **Enhanced Documentation**: Updated README with comprehensive examples for highlight customization
- **Consistent Debug Logging**: All indexer console.log messages now respect the `shouldDisplayDebugInformation` flag for unified logging control

### Fixed
- **Scroll Highlight Duration**: Fixed issue where CSS animations overrode JavaScript timeout values
- **Element Selection**: Improved DOM element selection for scroll highlighting functionality
- **LTree Path Traversal**: Fixed `expandNodes` and `collapseNodes` methods by correctly prefixing path segments with 'x' prefix to match internal tree structure storage

## [4.0.0-rc.05] - 2025-09-05

### Added
- **Optimized Async Search Indexing**: Improved indexing implementation that processes entire queue at once during idle time instead of small batches
- **Enhanced Indexing Performance**: Increased batch size from 100 to 1000 nodes and streamlined queue processing
- **Better Debug Logging**: Added conditional debug logging for indexing operations when `shouldDisplayDebugInformation` is enabled

### Changed
- **Indexing Architecture**: Refactored async indexing to process all queued nodes in a single idle callback rather than batched processing
- **Queue Management**: Simplified indexing queue processing with more efficient completion handling
- **TypeScript Support**: Added `Tuple<T, U>` type import for enhanced type safety

### Performance
- **Faster Indexing**: Single-pass indexing of entire queue reduces overhead and callback scheduling
- **Reduced Idle Callbacks**: Less frequent but more efficient use of `requestIdleCallback`
- **Improved Memory Usage**: More efficient queue management with immediate processing

## [4.0.0] - 2025-09-01

### Added
- **Asynchronous Search Indexing**: Search indexing now uses `requestIdleCallback` for non-blocking performance
- **Statistics Tracking**: New `statistics` getter provides real-time data:
  - `nodeCount`: Total number of nodes in the tree
  - `maxLevel`: Maximum depth level of the tree
  - `filteredNodeCount`: Number of nodes currently visible when filtering
  - `isIndexing`: Boolean indicating if search indexing is in progress
  - `pendingIndexCount`: Number of nodes pending indexing
- **Expand Level Control**: New `expandLevel` property (default: 2) automatically expands nodes up to specified depth
- **Drag & Drop Properties**: Added `isDraggableMember` and `isDropAllowedMember` for fine-grained drag & drop control
- **Debug Information Panel**: Enhanced debug display with collapsible interface showing tree statistics and indexing progress

### Changed
- **Breaking**: Renamed internal references from "Trie" to "LTree" for consistency
- **Breaking**: `trieId` property renamed to `treeId`
- **Search Performance**: Tree now renders immediately while search indexing happens asynchronously
- **Debug Styling**: Updated debug panel styling to use `em` units with reduced padding

### Performance
- **Non-blocking UI**: Tree renders immediately while search indexing occurs during browser idle time
- **Improved Large Dataset Handling**: Async indexing prevents UI freezing with large data sets
- **Batch Processing**: Search indexing processes nodes in batches during idle periods
- **Graceful Degradation**: Falls back to `setTimeout` on browsers without `requestIdleCallback` support

### Documentation
- Added comprehensive documentation for async search indexing
- Added warning about search indexing requirements
- Enhanced API documentation with new properties and statistics
- Updated performance section highlighting async capabilities
