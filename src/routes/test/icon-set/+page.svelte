<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { IconSet } from '$lib/ltree/types.js';

	// Fixture for the `iconSet` prop + --base-icon-* chaining. Targeted by
	// e2e/icon-set.spec.ts. The disclosure glyph is ONE mask-image read from ONE
	// variable set (--stv-icon-expand / --stv-icon-collapse + rotation), and
	// `iconSet` just re-points those variables (via data-icon-set on .stv__container)
	// — it is NOT four parallel families of CSS classes.

	type Item = { id: number; path: string; name: string };
	const data: Item[] = [
		{ id: 1, path: '1', name: 'Documents' },
		{ id: 2, path: '1.1', name: 'Work' },
		{ id: 3, path: '1.2', name: 'Personal' },
		{ id: 4, path: '2', name: 'Downloads' }
	];

	// Runtime-switch tree: proves data-icon-set updates reactively (the Svelte
	// analog of the web-component attribute reflection).
	let liveSet = $state<IconSet>('chevron');
	let liveSwap = $state(false);
</script>

<h1>iconSet test — one glyph variable set, reconfigured per set</h1>

<!-- Each tree is expandLevel=1 so the root's toggle renders `.expanded`, exposing
	 the resolved ::before mask. -->

<div data-testid="tree-chevron">
	<h2>chevron (default)</h2>
	<Tree {data} idMember="id" pathMember="path" displayValueMember="name" expandLevel={1} />
</div>

<div data-testid="tree-triangle">
	<h2>triangle</h2>
	<Tree {data} idMember="id" pathMember="path" displayValueMember="name" expandLevel={1} iconSet="triangle" />
</div>

<div data-testid="tree-plus-minus">
	<h2>plus-minus</h2>
	<Tree {data} idMember="id" pathMember="path" displayValueMember="name" expandLevel={1} iconSet="plus-minus" />
</div>

<div data-testid="tree-arrow">
	<h2>arrow</h2>
	<Tree {data} idMember="id" pathMember="path" displayValueMember="name" expandLevel={1} iconSet="arrow" />
</div>

<div data-testid="tree-swap">
	<h2>chevron + toggleIconMode="swap"</h2>
	<Tree {data} idMember="id" pathMember="path" displayValueMember="name" expandLevel={1} toggleIconMode="swap" />
</div>

<!-- Overriding the shared base chevron on an ANCESTOR of .stv__container should
	 re-skin the default set's glyph — --stv-icon-expand chains to it. -->
<div data-testid="tree-base-icon" style="--base-icon-chevron: url('http://sentinel.test/chevron.svg')">
	<h2>--base-icon-chevron override</h2>
	<Tree {data} idMember="id" pathMember="path" displayValueMember="name" expandLevel={1} />
</div>

<div data-testid="tree-live">
	<h2>runtime switch</h2>
	<div class="controls">
		{#each ['chevron', 'triangle', 'plus-minus', 'arrow'] as s (s)}
			<button data-testid={`live-${s}`} onclick={() => (liveSet = s as IconSet)} aria-pressed={liveSet === s}
				>{s}</button
			>
		{/each}
		<button data-testid="live-swap" onclick={() => (liveSwap = !liveSwap)} aria-pressed={liveSwap}>swap</button>
	</div>
	<div data-testid="live-readout">iconSet = {liveSet}, swap = {liveSwap}</div>
	<Tree
		{data}
		idMember="id"
		pathMember="path"
		displayValueMember="name"
		expandLevel={1}
		iconSet={liveSet}
		toggleIconMode={liveSwap ? 'swap' : 'rotate'}
	/>
</div>

<style>
	.controls {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 0.4rem;
	}
	[data-testid='live-readout'] {
		font-family: monospace;
		margin-bottom: 0.4rem;
	}
</style>
