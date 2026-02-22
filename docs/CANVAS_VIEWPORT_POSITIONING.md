# CanvasTree Viewport Positioning

## Overview

When a `CanvasTree` first renders or changes its `growthDirection`, the component must decide which part of the (potentially very large) tree layout to show in the viewport at zoom=1. Two props control this: `growthDirection` and `initialViewport`.

## Coordinate System

The tree layout always occupies a rectangle from `(0, 0)` to `(layoutWidth, layoutHeight)`. The **root node** position within that rectangle depends on `growthDirection`:

| `growthDirection` | Root position        | Leaves position      |
|-------------------|----------------------|----------------------|
| `'right'`         | Left edge, V-center  | Right edge           |
| `'left'`          | Right edge, V-center | Left edge            |
| `'down'`          | Top edge, H-center   | Bottom edge          |
| `'up'`            | Bottom edge, H-center| Top edge             |

The "origin" `(0, 0)` is always the top-left corner of the layout — where the first leaf nodes are drawn.

## Props

### `growthDirection`

Type: `'right' | 'left' | 'down' | 'up'` (default: `'right'`)

Controls the direction the tree grows from root to leaves. This determines both the layout algorithm and where the root ends up in the layout rectangle.

### `initialViewport`

Type: `'root' | 'origin'` (default: `'root'`)

Controls which part of the tree the camera starts at:

- **`'root'`** — Pan so the root node is centered in the viewport. The root is at the edge determined by `growthDirection`, and the viewport centers on it along the cross-axis (e.g., vertically centered for `left`/`right` directions).
- **`'origin'`** — Pan to the top-left corner `(pad, pad)`. This shows the leaves (the "origin" of the tree layout). Useful for bracket-style views where you want to start from the first round.

## How Positioning Works

The internal `panForDirection(dir)` function computes the initial `(x, y)` pan:

```
pad = 40px (margin from edge)

if initialViewport === 'origin':
    → pan = (pad, pad)                    // top-left corner, same for all directions

if initialViewport === 'root':
    centerY = (containerHeight - layoutHeight) / 2
    centerX = (containerWidth - layoutWidth) / 2

    right → pan = (pad, centerY)           // left edge, vertically centered
    left  → pan = (cw - layoutWidth - pad, centerY)  // right edge, vertically centered
    down  → pan = (centerX, pad)           // top edge, horizontally centered
    up    → pan = (centerX, ch - layoutHeight - pad)  // bottom edge, horizontally centered
```

The cross-axis centering ensures the root node appears in the middle of the viewport, even when the tree is much taller (or wider) than the viewport.

## When Positioning Applies

The pan/zoom computed by `panForDirection` is applied in two situations:

1. **On initial render** — when the tree first mounts and the layout is computed.
2. **On direction change** — when `growthDirection` changes (via binding or `setGrowthDirection()`), an internal `$effect` re-runs the layout and resets pan/zoom.

### Important: The $effect race condition

When changing direction, CanvasTree has an internal `$effect` that watches the `growthDirection` binding:

```javascript
$effect(() => {
    const dir = growthDirection;
    if (prevDirection !== null && prevDirection !== dir) {
        doLayout();
        const { x, y } = panForDirection(dir);
        interaction.setPan(x, y);
        interaction.setZoom(1);
        requestRedraw();
    }
    prevDirection = dir;
});
```

This `$effect` runs **asynchronously** after the current microtask. If you call `setGrowthDirection()` and then immediately call `zoomToFit()`, the `$effect` will fire **after** `zoomToFit()` and overwrite it with zoom=1 positioning.

**Solution**: Use Svelte's `tick()` to defer `zoomToFit()` until after the `$effect` settles:

```javascript
canvasTreeRef?.setGrowthDirection('right');
tick().then(() => canvasTreeRef?.zoomToFit());
```

## Zoom-to-Fit vs Initial Viewport

For small trees (layout fits in the viewport at zoom=1), `initialViewport='root'` works well — you see the root and most/all of the tree.

For large trees (layout much bigger than the viewport), `initialViewport` at zoom=1 only shows a small slice. In these cases, consider calling `zoomToFit()` after mount to scale the entire tree to fit:

```javascript
let initialFitDone = false;
$effect(() => {
    if (canvasTreeRef && totalCount > 1 && !initialFitDone) {
        initialFitDone = true;
        tick().then(() => canvasTreeRef?.zoomToFit());
    }
});
```

## Combination Matrix

| `initialViewport` | `growthDirection` | You see at zoom=1 |
|---|---|---|
| `'origin'` | `'right'` | Leaves (top-left) — tree extends right |
| `'origin'` | `'left'` | Leaves (top-left) — tree extends right, root at far right |
| `'origin'` | `'down'` | Leaves (top-left) — tree extends down |
| `'origin'` | `'up'` | Leaves (top-left) — tree extends down, root at far bottom |
| `'root'` | `'right'` | Root (left edge, vertically centered) |
| `'root'` | `'left'` | Root (right edge, vertically centered) |
| `'root'` | `'down'` | Root (top edge, horizontally centered) |
| `'root'` | `'up'` | Root (bottom edge, horizontally centered) |
