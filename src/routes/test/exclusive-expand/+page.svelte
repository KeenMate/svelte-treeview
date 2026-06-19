<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';

	// Deterministic fixture for e2e/exclusive-expand.spec.ts.
	//
	// Three top-level branches (A1, A2, A3), each with two children. expandLevel=0
	// so all branches start collapsed. The spec manually expands A3 (via the
	// toggle), then triggers an API call to expandNodes('2', { exclusive: true }).
	// The assertion is that A3's toggle UI flips back to the collapsed state —
	// the API mutation must propagate to the toggle icon, not just the data.

	type Item = { id: number; path: string; name: string };

	const data: Item[] = [
		{ id: 1, path: '1', name: 'A1' },
		{ id: 11, path: '1.1', name: 'A1.1' },
		{ id: 12, path: '1.2', name: 'A1.2' },
		{ id: 2, path: '2', name: 'A2' },
		{ id: 21, path: '2.1', name: 'A2.1' },
		{ id: 22, path: '2.2', name: 'A2.2' },
		{ id: 3, path: '3', name: 'A3' },
		{ id: 31, path: '3.1', name: 'A3.1' },
		{ id: 32, path: '3.2', name: 'A3.2' }
	];

	let treeRef: Tree<Item>;

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	function exclusiveExpandA2() {
		treeRef?.expandNodes('2', { exclusive: true });
	}
</script>

<svelte:head>
	<title>Test — Exclusive Expand</title>
</svelte:head>

<main>
	<h1>Exclusive Expand Fixture</h1>

	<button data-testid="exclusive-expand-a2" onclick={exclusiveExpandA2}>
		Exclusive expand A2
	</button>

	<div class="tree-wrap">
		<Tree
			bind:this={treeRef}
			{data}
			idMember="id"
			pathMember="path"
			sortCallback={sortByName}
			isSorted={true}
			expandLevel={0}
		>
			{#snippet nodeTemplate(node: LTreeNode<Item>)}
				<span class="node-name">{node.data?.name}</span>
			{/snippet}
		</Tree>
	</div>
</main>

<style>
	main {
		padding: 1rem;
		font-family: sans-serif;
	}
	h1 {
		margin: 0 0 0.5rem;
		font-size: 1.1rem;
	}
	button {
		margin-bottom: 0.5rem;
		padding: 0.25rem 0.6rem;
	}
	.tree-wrap {
		border: 1px solid #cbd5e1;
		padding: 0.5rem;
	}
</style>
