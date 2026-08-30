# vendor/environment

Device / viewport / container-size detection, **transferred 1:1** from
[`@keenmate/web-components-core`](../../../../web-components-core) `src/environment/`
(v1.0.0-rc09). Kept byte-for-byte (only the two `*.test.ts` files gained a
`// @vitest-environment jsdom` docblock, since this repo's default vitest
environment is `node`) so a future extraction into a shared
`@keenmate/svelte-components-core` is a move, not a rewrite.

- `environment.ts` — the shared, ref-counted `matchMedia` + `resize` observable
  (`observeEnvironment` / `observeViewport` / `classifyDevice` / …). Capability,
  not width: see the file header.
- `element-size.ts` — per-element border-box reactivity via one shared
  `ResizeObserver` (`observeElementSize`). This is the **container** signal the
  tree keys its own responsiveness off.

Do NOT hand-edit to fit this repo. If a fix is needed, make it upstream in
web-components-core and re-copy, so the two copies don't diverge before the
extraction. The Svelte/runes bridge over these primitives lives in
`src/lib/core/responsive.svelte.ts` — that's the repo-specific glue, not this.

The `overlay/` tier (presentation / scroll-lock / keyboard-inset) was
deliberately NOT transferred: the tree renders inline and never pops out to a
fullscreen sheet, so it needs the signal but none of the overlay machinery.
