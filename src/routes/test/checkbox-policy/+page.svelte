<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';
	import type { CascadeSelectPolicy } from '$lib/ltree/types.js';

	// Deterministic e2e fixture for cascadeSelectPolicy (the value policy that
	// controls WHICH paths the checkbox selection emits in cascade mode).
	// Targeted by e2e/checkbox-policy.spec.ts.
	//
	// Scenario the spec builds: check Fruits (1) fully + Carrot (2.1) only.
	// Canonical checked set = {1, 1.1, 1.2, 2.1}. Emitted selectedPaths per policy:
	//   rolled-up → 1, 2.1   (full subtree collapses to root; partial branch emits its bits)
	//   leaves    → 1.1, 1.2, 2.1
	//   all       → 1, 1.1, 1.2, 2.1

	type Item = { id: number; path: string; name: string };

	const sampleData: Item[] = [
		{ id: 1, path: '1', name: 'Fruits' },
		{ id: 2, path: '1.1', name: 'Apple' },
		{ id: 3, path: '1.2', name: 'Banana' },
		{ id: 4, path: '2', name: 'Vegetables' },
		{ id: 5, path: '2.1', name: 'Carrot' },
		{ id: 6, path: '2.2', name: 'Potato' }
	];

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	let cascadeSelectPolicy = $state<CascadeSelectPolicy>('rolled-up');
	let selectedPaths = $state(new Set<string>());
</script>

<svelte:head>
	<title>Test — Cascade Select Policy Fixture</title>
</svelte:head>

<main>
	<h1>Cascade Select Policy Test Fixture</h1>

	<div class="controls">
		<button data-testid="policy-rolled-up" onclick={() => (cascadeSelectPolicy = 'rolled-up')}>
			policy = rolled-up
		</button>
		<button data-testid="policy-leaves" onclick={() => (cascadeSelectPolicy = 'leaves')}>
			policy = leaves
		</button>
		<button data-testid="policy-all" onclick={() => (cascadeSelectPolicy = 'all')}>
			policy = all
		</button>
	</div>

	<div class="tree-container">
		<Tree
			data={sampleData}
			idMember="id"
			pathMember="path"
			sortCallback={sortByName}
			isSorted={true}
			expandLevel={3}
			shouldShowCheckboxes={true}
			checkboxMode="cascade"
			{cascadeSelectPolicy}
			bind:selectedPaths
		>
			{#snippet nodeTemplate(node: LTreeNode<Item>)}
				<span>{node.data?.name}</span>
			{/snippet}
		</Tree>
	</div>

	<div class="output">
		<p class="output-label">State</p>
		<pre>policy: <span data-testid="policy">{cascadeSelectPolicy}</span>
selectedPaths: <span data-testid="selection"
				>{[...selectedPaths].sort().join(',') || '(empty)'}</span
			></pre>
	</div>
</main>

<style>
	main {
		padding: 1rem;
		font-family: sans-serif;
	}
	h1 {
		margin: 0 0 1rem;
		font-size: 1.2rem;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.tree-container {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		max-width: 520px;
		margin-bottom: 0.75rem;
	}
	.output {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 3px;
		padding: 0.5rem;
	}
	.output-label {
		margin: 0 0 0.25rem;
		font-size: 0.8rem;
		font-weight: 600;
	}
	.output pre {
		margin: 0;
		font-size: 0.85rem;
		white-space: pre-wrap;
	}
</style>
