<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';
	import type { CheckboxMode } from '$lib/ltree/types.js';

	// Deterministic e2e fixture for switching checkboxMode at runtime.
	// Regression: a parent left at [-] (indeterminate) in cascade mode used to
	// stay stuck at [-] after switching to independent — the indeterminate DOM
	// property was never rewritten. Rule: on switch to independent, an
	// indeterminate node becomes fully CHECKED. Targeted by e2e/checkbox-mode.spec.ts.

	type Item = { id: number; path: string; name: string };

	const sampleData: Item[] = [
		{ id: 1, path: '1', name: 'Documents' },
		{ id: 2, path: '1.1', name: 'Work' },
		{ id: 3, path: '1.2', name: 'Personal' },
		{ id: 4, path: '2', name: 'Downloads' },
		{ id: 5, path: '2.1', name: 'Software' }
	];

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	let checkboxMode = $state<CheckboxMode>('cascade');
	let selectedPaths = $state(new Set<string>());
</script>

<svelte:head>
	<title>Test — Checkbox Mode Switch Fixture</title>
</svelte:head>

<main>
	<h1>Checkbox Mode Switch Test Fixture</h1>

	<div class="controls">
		<button data-testid="mode-cascade" onclick={() => (checkboxMode = 'cascade')}>
			checkboxMode = cascade
		</button>
		<button data-testid="mode-independent" onclick={() => (checkboxMode = 'independent')}>
			checkboxMode = independent
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
			{checkboxMode}
			bind:selectedPaths
		>
			{#snippet nodeTemplate(node: LTreeNode<Item>)}
				<span>{node.data?.name}</span>
			{/snippet}
		</Tree>
	</div>

	<div class="output">
		<p class="output-label">State</p>
		<pre>checkboxMode: <span data-testid="mode">{checkboxMode}</span>
selectedPaths: <span data-testid="selection">{[...selectedPaths].sort().join(',') || '(empty)'}</span></pre>
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
