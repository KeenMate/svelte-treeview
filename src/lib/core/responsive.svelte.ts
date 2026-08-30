/**
 * Svelte 5 (runes) bridge over the framework-agnostic device/viewport/container
 * primitives in `../vendor/environment`. Those primitives are imperative — a
 * `subscribe(cb) → unsubscribe` shape — because they're transferred 1:1 from
 * `@keenmate/web-components-core` (a vanilla web-component lib). This module is
 * the ONLY place that knows about runes; it turns each subscription into live
 * `$state` so components read the signal declaratively (`$derived`, template)
 * with no manual listener/teardown code.
 *
 * The load-bearing detail is that `observeElementSize`/`observeEnvironment`
 * return their unsubscribe, and a Svelte `$effect` treats a returned function as
 * its cleanup — so the subscription's lifetime is the effect's lifetime, and a
 * changed target simply re-subscribes. Every helper here MUST be called during
 * component initialisation (that's the `$effect` rule).
 */
import { observeElementSize, type ElementSize } from '../vendor/environment/element-size.js';
import {
	observeEnvironment,
	getEnvironment,
	classifyDevice,
	type EnvironmentSnapshot,
	type DeviceClass
} from '../vendor/environment/environment.js';

/** A live, reactive container-box size. `.width`/`.height` are getters over `$state`. */
export interface ReactiveSize {
	readonly width: number;
	readonly height: number;
	/** The current border-box, as a plain snapshot (handy to hand to a callback). */
	readonly current: ElementSize;
}

/**
 * Track one element's border-box size reactively. `getEl` is a GETTER (not the
 * element itself) so it can start `null` and attach once the `bind:this` target
 * lands — the `$effect` re-runs when the returned element changes. Fires
 * immediately with the current box, then on resize (shared `ResizeObserver`,
 * throttled ~30 ms). Call during component init.
 */
export function containerSize(getEl: () => Element | null | undefined): ReactiveSize {
	// $state.raw (not deep $state): the box is REPLACED wholesale each change, never
	// mutated field-by-field, so deep proxying buys nothing — and it would be actively
	// harmful. A deep proxy handed out through `.current` and assigned into a consumer's
	// `bind:containerSize` would alias the same proxy across child+parent; the binding
	// write-back then re-notifies this state and spins the consumer's effect forever.
	// Raw plain objects make `.current` a safe, inert snapshot to pass around.
	let current = $state.raw<ElementSize>({ width: 0, height: 0 });

	$effect(() => {
		const el = getEl();
		if (!el) return;
		// The unsubscribe becomes the effect cleanup: torn down on destroy AND before
		// a re-run when `el` changes, so we never leak a subscription on a stale node.
		return observeElementSize(el, (size) => {
			// Dedup at the reactive boundary. observeElementSize's immediate fire runs on
			// EVERY (re)subscribe regardless of its own dedup, so a consumer that reacts to
			// this signal by mutating layout could otherwise churn subscribe→fire→write in a
			// feedback loop. Only publish a genuinely-changed box, so `current` (and any
			// $derived over it) settles.
			if (size.width === current.width && size.height === current.height) return;
			current = size;
		});
	});

	return {
		get width() {
			return current.width;
		},
		get height() {
			return current.height;
		},
		get current() {
			return current;
		}
	};
}

/** A live, reactive device/viewport snapshot plus its derived {@link DeviceClass}. */
export interface ReactiveEnvironment {
	readonly snapshot: EnvironmentSnapshot;
	/** `classifyDevice(snapshot)` — 'mobile' | 'tablet' | 'desktop' (capability, not width). */
	readonly deviceClass: DeviceClass;
}

/**
 * Track the device/viewport environment reactively — the window-level companion
 * to {@link containerSize}. Fires immediately, then only on DISCRETE flips
 * (breakpoint / orientation / pointer / hover), not on every resize frame (use
 * `observeViewport` directly if you need continuous width). Call during component
 * init.
 */
export function environmentState(): ReactiveEnvironment {
	// Seeded on the immediate fire of observeEnvironment (synchronous on subscribe).
	let snapshot = $state<EnvironmentSnapshot | null>(null);

	$effect(() =>
		observeEnvironment((env) => {
			snapshot = env;
		})
	);

	return {
		get snapshot() {
			// Non-null after the synchronous immediate fire; the fallback (a fresh
			// listener-free read) only guards the impossible pre-subscribe read and SSR.
			return snapshot ?? getEnvironment();
		},
		get deviceClass() {
			return classifyDevice(this.snapshot);
		}
	};
}
