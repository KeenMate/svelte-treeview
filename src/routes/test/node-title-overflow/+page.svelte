<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';
	import type { NodeTitleOverflow } from '$lib/index.js';

	// Fixture for the nodeTitleOverflow prop (wrap | ellipsis | info). Targeted by
	// e2e/node-title-overflow.spec.ts. A deliberately narrow container so the long label
	// clips; a short label stays un-clipped (so the info affordance is row-specific).

	type Item = { id: number; path: string; name: string };
	const data: Item[] = [
		{ id: 1, path: '1', name: 'Root folder' },
		{
			id: 2,
			path: '1.1',
			name: 'This is an extremely long node label that will definitely not fit inside a narrow container and has to be clipped'
		},
		{ id: 3, path: '1.2', name: 'Short' }
	];
	function sortByPath(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => a.path.localeCompare(b.path));
	}

	let mode = $state<NodeTitleOverflow>('wrap');
	const modes: NodeTitleOverflow[] = ['wrap', 'ellipsis', 'info'];
</script>

<h1>nodeTitleOverflow test</h1>

<div class="controls">
	{#each modes as m (m)}
		<button data-testid={`mode-${m}`} onclick={() => (mode = m)} aria-pressed={mode === m}>{m}</button>
	{/each}
</div>
<div data-testid="mode-readout">mode = {mode}</div>

<div class="narrow" style="width: 240px;">
	<Tree
		{data}
		idMember="id"
		pathMember="path"
		sortCallback={sortByPath}
		isSorted={true}
		displayValueMember="name"
		expandLevel={2}
		nodeTitleOverflow={mode}
	/>
</div>

<style>
	.narrow {
		border: 1px solid #ccc;
	}
	.controls {
		margin-bottom: 0.5rem;
		display: flex;
		gap: 0.4rem;
	}
	[data-testid='mode-readout'] {
		font-family: monospace;
		margin-bottom: 0.5rem;
	}
</style>
