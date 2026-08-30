<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';
	import type { ElementSize, DeviceClass } from '$lib/index.js';

	// Fixture for the responsive container-box signal (signal-only; the tree changes
	// nothing itself). Targeted by e2e/responsive.spec.ts. Drives the tree's own
	// .stv__container width via a wrapper, then asserts BOTH exposure surfaces update:
	//   - bind:containerSize  (declarative $state → $derived isNarrow)
	//   - onContainerResize   (imperative callback, with the window deviceClass)
	// Backed by the shared ResizeObserver in vendor/environment (throttled ~30ms).

	type Item = { id: number; path: string; name: string };
	const data: Item[] = [
		{ id: 1, path: '1', name: 'Root' },
		{ id: 2, path: '1.1', name: 'Child A' },
		{ id: 3, path: '1.2', name: 'Child B' }
	];
	function sortByPath(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => a.path.localeCompare(b.path));
	}

	// Bindable signal (declarative)
	let box = $state<ElementSize>();
	// Callback signal (imperative)
	let cbSize = $state<ElementSize | null>(null);
	let cbDevice = $state<DeviceClass | null>(null);
	let cbCount = $state(0);

	// A pure $derived over the container box — the whole point: a setting driven by space.
	const isNarrow = $derived(!!box && box.width < 400);

	let width = $state(500);

	function onContainerResize(size: ElementSize, deviceClass: DeviceClass) {
		cbSize = size;
		cbDevice = deviceClass;
		cbCount++;
	}
</script>

<h1>Responsive container signal test</h1>

<div class="controls">
	<button data-testid="w-300" onclick={() => (width = 300)}>300px</button>
	<button data-testid="w-500" onclick={() => (width = 500)}>500px</button>
	<button data-testid="w-700" onclick={() => (width = 700)}>700px</button>
</div>

<div
	data-testid="readout"
	data-bind-width={box ? Math.round(box.width) : ''}
	data-bind-height={box ? Math.round(box.height) : ''}
	data-cb-width={cbSize ? Math.round(cbSize.width) : ''}
	data-cb-device={cbDevice ?? ''}
	data-cb-count={cbCount}
	data-narrow={isNarrow}
>
	bind: {box ? Math.round(box.width) : '–'} × {box ? Math.round(box.height) : '–'} · cb:
	{cbSize ? Math.round(cbSize.width) : '–'} ({cbDevice ?? '–'}) · count={cbCount} · narrow={isNarrow}
</div>

<!-- The wrapper is the resize driver; padding/border 0 so box.width == wrapper width. -->
<div class="wrap" style="width: {width}px;" data-testid="wrap">
	<Tree
		{data}
		idMember="id"
		pathMember="path"
		sortCallback={sortByPath}
		isSorted={true}
		displayValueMember="name"
		expandLevel={2}
		bind:containerSize={box}
		{onContainerResize}
	/>
</div>

<style>
	.wrap {
		padding: 0;
		border: 0;
		box-sizing: border-box;
	}
	/* .stv__container is display:block → fills the wrapper; force box-sizing so the
	   reported border-box width tracks the wrapper width exactly. */
	.wrap :global(.stv__container) {
		width: 100%;
		box-sizing: border-box;
	}
	.controls {
		margin-bottom: 0.5rem;
	}
	[data-testid='readout'] {
		font-family: monospace;
		margin-bottom: 0.75rem;
	}
</style>
