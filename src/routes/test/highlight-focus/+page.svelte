<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';

	// Deterministic e2e fixture for highlight-marker fallback + focused-node
	// styling. Targeted by e2e/highlight-focus.spec.ts.
	//
	// Two behaviours under test:
	//   1. `.stv__node-content--highlighted` is a FALLBACK — Node.svelte only
	//      applies it when `highlightedNodeClass` is unset. Setting a highlight
	//      class must suppress the marker so the two never fight.
	//   2. `.stv__node-content--focused` is a PURE HOOK applied whenever a node
	//      is focused; `focusedNodeClass` is additive and lands on exactly the
	//      one focused row.
	//
	// clickBehavior="select" so a plain click focuses + highlights WITHOUT
	// toggling expand state — keeps node visibility stable across clicks.

	type Item = { id: number; path: string; name: string };

	const sampleData: Item[] = [
		{ id: 1, path: '1', name: 'Documents' },
		{ id: 2, path: '1.1', name: 'Work' },
		{ id: 3, path: '1.2', name: 'Personal' },
		{ id: 4, path: '2', name: 'Downloads' }
	];

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	// '' = unset → fallback marker should appear. Non-empty = custom class wins.
	let highlightedNodeClass = $state('');
	let focusedNodeClass = $state('');

	let focusedNode = $state<LTreeNode<Item> | null>(null);
	let highlightedPaths = $state(new Set<string>());
</script>

<svelte:head>
	<title>Test — Highlight / Focus Fixture</title>
</svelte:head>

<main>
	<h1>Highlight / Focus Test Fixture</h1>

	<div class="controls">
		<label>
			Highlight Class:
			<select bind:value={highlightedNodeClass}>
				<option value="">(none / fallback)</option>
				<option value="stv__node-content--highlight-bold">Bold</option>
				<option value="stv__node-content--highlight-glow">Glow</option>
			</select>
		</label>
		<label>
			Focus Class:
			<select bind:value={focusedNodeClass}>
				<option value="">(none)</option>
				<option value="test-focus">Custom focus</option>
			</select>
		</label>
		<button onclick={() => { highlightedPaths = new Set(); focusedNode = null; }}>Clear</button>
	</div>

	<div class="tree-container">
		<Tree
			data={sampleData}
			idMember="id"
			pathMember="path"
			sortCallback={sortByName}
			isSorted={true}
			expandLevel={2}
			selectionMode="multi"
			clickBehavior="select"
			{highlightedNodeClass}
			{focusedNodeClass}
			bind:focusedNode
			bind:highlightedPaths
		>
			{#snippet nodeTemplate(node: LTreeNode<Item>)}
				<span>{node.data?.name}</span>
			{/snippet}
		</Tree>
	</div>

	<div class="output">
		<p class="output-label">Focused Node</p>
		<pre>{focusedNode ? `${focusedNode.data?.name} (${focusedNode.path})` : '(none)'}</pre>
	</div>
	<div class="output">
		<p class="output-label">Highlighted</p>
		<pre>{highlightedPaths.size > 0 ? [...highlightedPaths].join(', ') : '(none)'}</pre>
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
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
	}
	.tree-container {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		min-height: 80px;
		max-width: 420px;
	}
	.output {
		margin-top: 0.5rem;
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
		font-size: 0.8rem;
	}

	/* Page-scoped custom focus class — only its presence on the DOM is asserted,
	   but give it a real rule so it behaves like a production focusedNodeClass. */
	:global(.test-focus) {
		box-shadow: inset 3px 0 0 0 var(--stv-primary, #0d6efd);
	}
</style>
