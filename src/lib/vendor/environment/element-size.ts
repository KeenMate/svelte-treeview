/**
 * Per-element size reactivity (SPEC §12.9) — the element-box companion to the
 * window-level {@link observeViewport}. `observeViewport` answers "how wide is the
 * *window*"; this answers "how wide is *this element's box*", which is what a
 * component actually needs to reflow within a device class (e.g. a picker in a
 * narrow sidebar on a wide monitor). Backed by a **single, shared, lazily-created
 * `ResizeObserver`** for the whole page — one observer watches every subscribed
 * element and fans out per target — so a page of N pickers pays for one observer,
 * not N.
 *
 * Tier note: prefer CSS **container queries** (`container-type: inline-size` +
 * `@container`) when the reflow is purely presentational — they're native,
 * cheaper, and fire before paint. Reach for this hook only when the reflow is
 * *structural* (a different DOM / a JS decision, not just restyling).
 *
 * Semantics mirror the environment observable: fires once immediately with the
 * current box (unless `immediate: false`), then on box changes, throttled to
 * ~30 ms (leading + trailing) so a drag-resize reflows a bounded number of times
 * and never re-enters the `ResizeObserver` loop. Identical consecutive sizes are
 * deduped. SSR-safe: with no `ResizeObserver` it fires once (a `0×0` measure) and
 * returns a no-op unsubscribe. Zero runtime deps.
 */

/** An element's border-box size in CSS px (matches `getBoundingClientRect()`). */
export interface ElementSize {
  /** Border-box width in CSS px. */
  readonly width: number;
  /** Border-box height in CSS px. */
  readonly height: number;
}

/** A subscriber notified with the observed element's size (and the element itself). */
export type ElementSizeListener = (size: ElementSize, el: Element) => void;

/** Options for {@link observeElementSize}. */
export interface ObserveElementSizeOptions {
  /** Fire the listener synchronously with the current box on subscribe. Default `true`. */
  immediate?: boolean;
  /** Throttle window in ms (leading + trailing). Default `30`; `0` disables throttling. */
  throttleMs?: number;
}

/** Default throttle window for the element-size channel — matches the viewport channel. */
const DEFAULT_ELEMENT_THROTTLE_MS = 30;

/** One live subscription; each carries its own throttle state so listeners are independent. */
interface Subscription {
  readonly el: Element;
  readonly cb: ElementSizeListener;
  readonly throttleMs: number;
  timer?: ReturnType<typeof setTimeout>;
  lastNotify: number;
  pendingSize?: ElementSize;
  lastFired?: ElementSize;
}

/** The single shared observer, created on the first subscribe and dropped when the last leaves. */
let ro: ResizeObserver | null = null;
/** Live subscriptions per target element. */
const targets = new WeakMap<Element, Set<Subscription>>();
/** Count of distinct observed elements (WeakMap isn't countable) — the ref-count for `ro`. */
let observedCount = 0;

function canObserve(): boolean {
  return typeof ResizeObserver !== 'undefined';
}

/** Border-box read; SSR-safe (`0×0` when there's no layout). Same source for immediate + RO fires. */
function measure(el: Element): ElementSize {
  if (typeof el.getBoundingClientRect !== 'function') return { width: 0, height: 0 };
  const r = el.getBoundingClientRect();
  return { width: r.width, height: r.height };
}

function sizesEqual(a: ElementSize | undefined, b: ElementSize): boolean {
  return !!a && a.width === b.width && a.height === b.height;
}

/** Deliver `size` to one subscription, applying its leading + trailing throttle and dedup. */
function dispatch(sub: Subscription, size: ElementSize): void {
  if (sizesEqual(sub.lastFired, size)) return; // no change since last fire — skip
  sub.pendingSize = size;
  if (sub.timer !== undefined) return; // trailing edge already pending; it'll read pendingSize
  const elapsed = Date.now() - sub.lastNotify;
  if (elapsed >= sub.throttleMs) {
    sub.lastNotify = Date.now();
    fire(sub);
  } else {
    sub.timer = setTimeout(() => {
      sub.timer = undefined;
      sub.lastNotify = Date.now();
      fire(sub);
    }, sub.throttleMs - elapsed);
  }
}

function fire(sub: Subscription): void {
  const size = sub.pendingSize;
  if (!size) return;
  sub.lastFired = size;
  sub.cb(size, sub.el);
}

/** The shared observer's callback — fan out each entry to its target's subscriptions. */
function onResize(entries: ResizeObserverEntry[]): void {
  for (const entry of entries) {
    const subs = targets.get(entry.target);
    if (!subs) continue;
    // Read the border box via getBoundingClientRect for identical semantics with the
    // immediate fire (and to sidestep writing-mode axis ambiguity in entry sizes).
    const size = measure(entry.target);
    for (const sub of [...subs]) dispatch(sub, size);
  }
}

function ensureObserver(): ResizeObserver | null {
  if (!canObserve()) return null;
  if (!ro) ro = new ResizeObserver(onResize);
  return ro;
}

/**
 * Observe one element's border-box size. The listener fires immediately with the
 * current box (unless `immediate: false`), then on size changes, throttled to
 * {@link ObserveElementSizeOptions.throttleMs} (default 30 ms, leading + trailing);
 * identical consecutive sizes are deduped. All subscriptions share one page-wide
 * `ResizeObserver`. Returns an unsubscribe; the shared observer is torn down when
 * its last target leaves. No-op-safe during SSR (fires once, returns a working
 * unsubscribe). Components normally consume this via `BlissElement`'s `resized()`
 * hook rather than subscribing directly.
 */
export function observeElementSize(
  el: Element,
  cb: ElementSizeListener,
  opts: ObserveElementSizeOptions = {},
): () => void {
  const sub: Subscription = {
    el,
    cb,
    throttleMs: opts.throttleMs ?? DEFAULT_ELEMENT_THROTTLE_MS,
    lastNotify: 0,
  };

  if (opts.immediate !== false) {
    const size = measure(el);
    sub.lastFired = size;
    sub.lastNotify = Date.now();
    cb(size, el);
  }

  const observer = ensureObserver();
  if (observer) {
    let subs = targets.get(el);
    if (!subs) {
      targets.set(el, (subs = new Set()));
      observedCount++;
      observer.observe(el);
    }
    subs.add(sub);
  }

  let live = true;
  return () => {
    if (!live) return;
    live = false;
    if (sub.timer !== undefined) {
      clearTimeout(sub.timer);
      sub.timer = undefined;
    }
    const subs = targets.get(el);
    if (!subs) return;
    subs.delete(sub);
    if (subs.size === 0) {
      targets.delete(el);
      ro?.unobserve(el);
      observedCount--;
      if (observedCount === 0 && ro) {
        ro.disconnect();
        ro = null;
      }
    }
  };
}

/** Test-only: disconnect the shared observer and drop all subscriptions. */
export function __resetElementSizeObservers(): void {
  if (ro) {
    ro.disconnect();
    ro = null;
  }
  observedCount = 0;
}
