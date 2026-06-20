<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';

	// Deterministic e2e fixture for the basic-rendering feature set.
	// Targeted by e2e/basic.spec.ts. Mirrors /examples/basic but strips
	// tutorial copy, render-mode switch, and code-block panels.

	type Item = { id: number; path: string; name: string; icon: string };

	const sampleData: Item[] = [
		{ id: 1, path: '1', name: 'Documents', icon: '📁' },
		{ id: 2, path: '1.1', name: 'Work', icon: '💼' },
		{ id: 3, path: '1.1.1', name: 'Reports', icon: '📊' },
		{ id: 4, path: '1.1.2', name: 'Presentations', icon: '📽️' },
		{ id: 5, path: '1.2', name: 'Personal', icon: '🏠' },
		{ id: 6, path: '1.2.1', name: 'Photos', icon: '📷' },
		{ id: 7, path: '1.2.2', name: 'Music', icon: '🎵' },
		{ id: 8, path: '2', name: 'Downloads', icon: '⬇️' },
		{ id: 9, path: '2.1', name: 'Software', icon: '💿' },
		{ id: 10, path: '2.2', name: 'Media', icon: '🎬' },
		{ id: 11, path: '3', name: 'Projects', icon: '🚀' },
		{ id: 12, path: '3.1', name: 'Web App', icon: '🌐' },
		{ id: 13, path: '3.1.1', name: 'Frontend', icon: '🎨' },
		{ id: 14, path: '3.1.2', name: 'Backend', icon: '⚙️' },
		{ id: 15, path: '3.2', name: 'Mobile App', icon: '📱' }
	];

	let expandLevel = $state(2);
	let isAccordionExpand = $state(false);
	let selectedNode = $state<LTreeNode<Item> | null>(null);
	let scrollPath = $state('1.2.1');
	let scrollTreeRef: Tree<Item>;
	let expandCollapseTreeRef: Tree<Item>;
	let clickedNode = $state<string | null>(null);

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	function handleNodeClick(node: LTreeNode<Item>) {
		clickedNode = `${node.data?.name} (path: ${node.path})`;
	}

	function scrollToPath() {
		scrollTreeRef?.scrollToPath(scrollPath, { scrollOptions: { behavior: 'smooth', block: 'center' } });
	}
</script>

<svelte:head>
	<title>Test — Basic Fixture</title>
</svelte:head>

<main>
	<h1>Basic Test Fixture</h1>

	<div class="card">
		<h2>Simple Tree</h2>
		<div class="tree-container">
			<Tree
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={2}
				bind:focusedNode={selectedNode}
				onNodeClick={handleNodeClick}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>

		{#if selectedNode}
			<div class="output">
				<p class="output-label">Selected Node:</p>
				<pre>{JSON.stringify({ path: selectedNode.path, name: selectedNode.data?.name }, null, 2)}</pre>
			</div>
		{/if}

		{#if clickedNode}
			<div class="output">
				<p class="output-label">Last Clicked:</p>
				<pre>{clickedNode}</pre>
			</div>
		{/if}
	</div>

	<div class="card">
		<h2>Expand Controls</h2>
		<div class="controls">
			<label>
				Expand Level:
				<input type="number" bind:value={expandLevel} min="0" max="5" />
			</label>
			<label>
				<input type="checkbox" bind:checked={isAccordionExpand} />
				Accordion Expand
			</label>
		</div>

		<div class="tree-container">
			{#key expandLevel}
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					{expandLevel}
					{isAccordionExpand}
				>
					{#snippet nodeTemplate(node: LTreeNode<Item>)}
						<span>{node.data?.icon} {node.data?.name}</span>
					{/snippet}
				</Tree>
			{/key}
		</div>
	</div>

	<div class="card">
		<h2>Scroll to Path</h2>
		<div class="controls">
			<input type="text" bind:value={scrollPath} placeholder="Enter path" />
			<button onclick={scrollToPath}>Scroll to Path</button>
		</div>

		<div class="tree-container">
			<Tree
				bind:this={scrollTreeRef}
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={3}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
	</div>

	<div class="card">
		<h2>Programmatic Expand/Collapse</h2>
		<div class="controls">
			<button onclick={() => expandCollapseTreeRef?.expandAll()}>Expand All</button>
			<button onclick={() => expandCollapseTreeRef?.collapseAll()}>Collapse All</button>
			<button onclick={() => expandCollapseTreeRef?.expandNodes('1')}>Expand "Documents" (1)</button>
			<button onclick={() => expandCollapseTreeRef?.collapseNodes('1')}>Collapse "Documents" (1)</button>
		</div>

		<div class="tree-container">
			<Tree
				bind:this={expandCollapseTreeRef}
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={1}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
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
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}
	.card {
		border: 1px solid #ccc;
		padding: 0.75rem;
		margin-bottom: 0.75rem;
		border-radius: 4px;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
	}
	.controls input[type='number'] {
		width: 60px;
	}
	.tree-container {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		min-height: 80px;
		max-width: 520px;
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
		white-space: pre-wrap;
	}
</style>
