# Theming contract

`@keenmate/svelte-treeview` ships with a clean light/dark default theme and exposes its full styling surface through CSS custom properties. There are two layers you'll touch most often:

1. **`--base-*` design tokens** — shared with every `@keenmate/*` component. Setting these on any ancestor of the tree (or on `:root`) themes the whole `@keenmate/*` suite consistently.
2. **`--stv-*` component variables** — the tree's own knobs. Override these to change something specific to the tree without affecting other components.

## Where variables live

All `--stv-*` declarations are scoped to **`.stv__container`** (the tree's root element), not `:root`. This mirrors web-multiselect's `:host`-scoped pattern: `var()` substitution happens AT the tree's own element, so an ancestor that sets a `--base-*` token actually re-tints the tree. A wrapper around the tree that sets `--base-accent-color: red` re-tints **that** tree (multiple trees on the same page can be themed independently via wrapper-scoped `--base-*` overrides).

Setting `--stv-*` directly on a wrapper does NOT cascade (because `.stv__container` has its own direct rule for every `--stv-*` token). To theme a subtree, prefer `--base-*` on the wrapper, or write `.wrapper .stv__container { --stv-* }`.

## Quick examples

```css
/* Override --base-* tokens to re-tint every @keenmate/* component on the page */
:root {
  --base-accent-color: #6366f1;
  --base-font-family: 'Inter', system-ui, sans-serif;
  --base-border-radius-sm: 0.4;  /* unitless multiplier (× --stv-rem) */
}

/* Override a single --stv-* token to change only this component */
.stv__container {
  --stv-primary: #0d6efd;
  --stv-node-indent-per-level: calc(1.2 * var(--stv-rem));
}

/* Scale everything 20% larger */
.my-bigger-tree .stv__container {
  --stv-rem: 12px;
}
```

**Note**: all dimensions are `calc(N × var(--stv-rem))`. Set `--stv-rem` once (default `10px`) to scale every size proportionally, or set it to `1rem` to make the component follow document font-size.

For the full variable inventory, see [`component-variables.manifest.json`](../component-variables.manifest.json) at the package root, or browse [`/examples/theming`](https://svelte-treeview.keenmate.dev/examples/theming) for a live demo.

## Common `--stv-*` tokens

```css
.stv__container {
  --stv-rem: 10px;                              /* Base sizing unit — scale all dimensions */
  --stv-node-indent-per-level: calc(0.8 * var(--stv-rem));  /* Indent per nesting level */
  --stv-primary: #0d6efd;                       /* Tints (multi-select, dragover) derived
                                                       automatically via color-mix() */
  --stv-success: #198754;
  --stv-danger: #dc3545;
  --stv-light: #f8f9fa;
  --stv-border: #dee2e6;
  --stv-body-color: #212529;
}
```

## Cascade-layer contract

`main.css` declares:

```css
@layer variables, component, overrides;
```

and imports each partial into the matching layer (`variables.css` into `variables`; `base.css`, `controls.css`, feature files into `component`; `dark-mode.css` into `overrides`). The consumer override contract:

- Any **unlayered** consumer rule beats every rule in the library — no `!important` needed.
- Any `:root` `--base-*` or `--stv-*` declaration beats the variables layer.

### ⚠️ The unlayered-reset footgun

If your app ships an **unlayered universal CSS reset** (`* { padding: 0 }` from normalize / Bootstrap / Tailwind preflight / etc.), that reset is unlayered and therefore beats every library rule — including the tree's defaults. Wrap such resets in a low-priority `@layer reset`:

```css
@layer reset {
  /* your reset rules here */
}
```

or the tree's defaults won't apply.

## Dark mode

The tree supports four canonical signals:

1. **OS preference** (`prefers-color-scheme: dark`) — resolved automatically via `light-dark()` in `variables.css` when the consumer's `<html>` declares `color-scheme: light dark`.
2. **Page-level `color-scheme: dark`** — same resolution path.
3. **Framework theme classes** — `[data-theme="dark"]`, `[data-bs-theme="dark"]`, `.dark` on an ancestor flip the tree to dark mode.
4. **Per-instance `theme` prop on `<Tree>`** — `'dark' | 'light' | null | undefined`. Forwarded to `.stv__container` as `data-theme`, beating ambient signals.

Symmetric `light` selectors (`[data-theme="light"]`, `[data-bs-theme="light"]`, `.light`, per-instance `theme="light"`) let a single tree force light on an otherwise-dark page.

```svelte
<!-- One dark tree on an otherwise-light page -->
<Tree theme="dark" {data} idMember="path" pathMember="path" />
```

Resolution precedence (highest specificity wins):

```
per-instance .stv__container[data-theme]
  → framework ancestor class
    → page color-scheme via light-dark() in variables.css
      → OS preference via @media
```

The implementation uses **Strategy B**: every visible color in `variables.css` uses `light-dark(<light>, <dark>)` for its fallback. `dark-mode.css` flips `color-scheme: dark` (or `light`) on the conditional selectors and lets `light-dark()` resolve the dark branch. Consumer `--base-*` overrides survive (a Strategy-A literal like `#1a1a1a` would silently replace a consumer's themed value).

## CSS classes (BEM)

The tree emits BEM-style classes (`stv__<element>` / `stv__<element>--<modifier>`):

- `.stv__container` — tree root; carries `--stv-*` declarations and `data-theme`
- `.stv__tree` — main tree container
- `.stv__node` — individual node container
- `.stv__node-content` — node content area
- `.stv__toggle-icon` — expand/collapse icons
- `.stv__context-menu` — context menu

### Pre-built selected node styles

| Class | Description | Visual effect |
|-------|-------------|---------------|
| `stv__selected--bold` | Bold text with primary color | **Bold text** in theme primary color |
| `stv__selected--border` | Border and background highlight | Solid border with light background |
| `stv__selected--brackets` | Decorative brackets around text | > **Node Text** < |

### Drag-over node classes

| Class | Description | Visual effect |
|-------|-------------|---------------|
| `stv__dragover--highlight` | Dashed border with success color background | Dashed border with subtle background |
| `stv__dragover--glow` | Glow effect | Glowing shadow effect with primary color theme |

```svelte
<Tree
  {data}
  idMember="path"
  pathMember="path"
  selectedNodeClass="stv__selected--bold"
  dragOverNodeClass="stv__dragover--highlight"
/>
```

### Custom icon classes

```svelte
<Tree
  {data}
  idMember="path"
  pathMember="path"
  expandIconClass="custom-expand-icon"
  collapseIconClass="custom-collapse-icon"
  leafIconClass="custom-leaf-icon"
/>
```

## See also

- [Live theming demo](https://svelte-treeview.keenmate.dev/examples/theming)
- [`component-variables.manifest.json`](../component-variables.manifest.json) — the full --stv-* inventory machine-readable
- [`/examples/theming`](../src/routes/examples/theming/) — wrapper `--base-*` themes, per-instance `theme` prop, `--stv-*` overrides
