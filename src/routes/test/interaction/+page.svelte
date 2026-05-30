<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode, ClickBehavior, CheckboxMode } from '$lib/ltree/types.js';

	// Deterministic e2e fixture for interaction features (click behavior,
	// checkboxes, multi-select, keyboard navigation). Targeted by
	// e2e/interaction.spec.ts. Mirrors /examples/interaction but trimmed to
	// the paths the spec asserts on; no localStorage persistence, no
	// tutorial copy or code-block panels.

	type Item = { id: number; path: string; name: string; icon: string };

	const sampleData: Item[] = [
		{ id: 1, path: '1', name: 'Documents', icon: '📁' },
		{ id: 2, path: '1.1', name: 'Work', icon: '💼' },
		{ id: 3, path: '1.2', name: 'Personal', icon: '🏠' },
		{ id: 4, path: '2', name: 'Downloads', icon: '⬇️' },
		{ id: 5, path: '2.1', name: 'Software', icon: '💿' },
		{ id: 6, path: '3', name: 'Projects', icon: '🚀' },
		{ id: 7, path: '3.1', name: 'Web App', icon: '🌐' }
	];

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	// ── Click Behavior card ─────────────────────────────────────────────
	let clickBehavior = $state<ClickBehavior>('expand-and-focus');
	let showCheckboxes = $state(false);
	let checkboxMode = $state<CheckboxMode>('independent');
	let clickTogglesCheckbox = $state(false);
	let focusedNode1 = $state<LTreeNode<Item> | null>(null);
	let highlightedPaths1 = $state(new Set<string>());
	let selectedPaths1 = $state(new Set<string>());

	// ── Multi-Select card ───────────────────────────────────────────────
	let focusedNode2 = $state<LTreeNode<Item> | null>(null);
	let highlightedPaths2 = $state(new Set<string>());
	let selectedPaths2 = $state(new Set<string>());

	// ── Keyboard Navigation card ────────────────────────────────────────
	let navFocusedNode = $state<LTreeNode<Item> | null>(null);
	let navLog = $state<string[]>([]);

	function onNavNodeClick(node: LTreeNode<Item>) {
		navLog = [`Navigated to: ${node.data?.name} (${node.path})`, ...navLog.slice(0, 9)];
	}
</script>

<svelte:head>
	<title>Test — Interaction Fixture</title>
</svelte:head>

<main>
	<h1>Interaction Test Fixture</h1>

	<div class="card">
		<h2>Click Behavior</h2>
		<div class="controls">
			<label>
				Click Behavior:
				<select bind:value={clickBehavior}>
					<option value="expand-and-focus">expand-and-focus</option>
					<option value="select">select</option>
					<option value="expand">expand</option>
				</select>
			</label>
			<label>
				<input type="checkbox" bind:checked={showCheckboxes} />
				Show Checkboxes
			</label>
			{#if showCheckboxes}
				<label>
					Checkbox Mode:
					<select bind:value={checkboxMode}>
						<option value="independent">independent</option>
						<option value="cascade">cascade</option>
					</select>
				</label>
				<label>
					<input type="checkbox" bind:checked={clickTogglesCheckbox} />
					Click row toggles checkbox
				</label>
			{/if}
			<button onclick={() => { highlightedPaths1 = new Set(); selectedPaths1 = new Set(); }}>Clear All</button>
		</div>

		<div class="tree-container">
			<Tree
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={2}
				{clickBehavior}
				{showCheckboxes}
				{checkboxMode}
				{clickTogglesCheckbox}
				bind:focusedNode={focusedNode1}
				bind:highlightedPaths={highlightedPaths1}
				bind:selectedPaths={selectedPaths1}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>

		<div class="output">
			<p class="output-label">Focused Node</p>
			<pre>{focusedNode1 ? `${focusedNode1.data?.icon} ${focusedNode1.data?.name} (${focusedNode1.path})` : '(none)'}</pre>
		</div>
		<div class="output">
			<p class="output-label">Highlighted</p>
			<pre>{highlightedPaths1.size > 0 ? [...highlightedPaths1].join(', ') : '(none)'}</pre>
		</div>
		<div class="output">
			<p class="output-label">Selected / Checked</p>
			<pre>{selectedPaths1.size > 0 ? [...selectedPaths1].join(', ') : '(none)'}</pre>
		</div>
	</div>

	<div class="card">
		<h2>Multi-Select</h2>
		<div class="controls">
			<button onclick={() => { highlightedPaths2 = new Set(); selectedPaths2 = new Set(); }}>Clear All</button>
		</div>

		<div class="tree-container">
			<Tree
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={3}
				bind:focusedNode={focusedNode2}
				bind:highlightedPaths={highlightedPaths2}
				bind:selectedPaths={selectedPaths2}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>

		<div class="output">
			<p class="output-label">Focused Node</p>
			<pre>{focusedNode2 ? `${focusedNode2.data?.icon} ${focusedNode2.data?.name} (${focusedNode2.path})` : '(none)'}</pre>
		</div>
		<div class="output">
			<p class="output-label">Highlighted</p>
			<pre>{highlightedPaths2.size > 0 ? [...highlightedPaths2].join(', ') : '(none)'}</pre>
		</div>
	</div>

	<div class="card">
		<h2>Keyboard Navigation</h2>
		<div class="tree-container">
			<Tree
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={2}
				bind:focusedNode={navFocusedNode}
				onNodeClick={onNavNodeClick}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>

		{#if navFocusedNode}
			<div class="output">
				<p class="output-label">Focused Node</p>
				<pre>{navFocusedNode.data?.icon} {navFocusedNode.data?.name} ({navFocusedNode.path})</pre>
			</div>
		{/if}
		{#if navLog.length > 0}
			<div class="output">
				<p class="output-label">Navigation Log</p>
				<pre>{navLog.join('\n')}</pre>
			</div>
		{/if}
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
