<script lang="ts">
	import { Tree } from '$lib/index.js';
	import type { LTreeNode } from '$lib/ltree/types.js';

	// Deterministic e2e fixture for the perf-test controls surface. Targeted
	// by e2e/performance.spec.ts. Mirrors /examples/performance but strips
	// the localStorage persistence, countries-data loader, expand-timing
	// metrics, "What to Test" docs, and all styling chrome — the spec only
	// asserts on the controls/labels/title pattern listed below.

	type RenderMode = 'recursive' | 'flat' | 'virtual';

	type Item = {
		id: number;
		path: string;
		parentPath: string;
		level: number;
		name: string;
		hasChildren: boolean;
	};

	let renderMode = $state<RenderMode>('flat');
	const useFlatRendering = $derived(renderMode === 'flat' || renderMode === 'virtual');
	const virtualScroll = $derived(renderMode === 'virtual');

	let nodeCountTarget = $state(300);
	let expandLevel = $state(1);

	let treeData = $state.raw<Item[]>([]);
	let treeRef = $state<Tree<Item> | undefined>(undefined);
	let treeKey = $state(0);

	let searchText = $state('');
	let searchInputValue = $state('');
	let searchResults = $state<{ path: string }[]>([]);
	let currentSearchIdx = $state(-1);

	const DEPARTMENTS = [
		'Engineering', 'Sales', 'Marketing', 'Finance', 'HR',
		'Operations', 'Legal', 'Support', 'Product', 'Design'
	];
	const TEAM_PREFIXES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Core', 'Platform', 'Growth', 'Enterprise', 'Mobile', 'Cloud'];
	const TEAM_SUFFIXES = ['Team', 'Squad', 'Group', 'Unit', 'Division'];

	function generateName(level: number, index: number): string {
		if (level === 1) return DEPARTMENTS[index % DEPARTMENTS.length];
		if (level === 2) return `${TEAM_PREFIXES[index % TEAM_PREFIXES.length]} ${TEAM_SUFFIXES[index % TEAM_SUFFIXES.length]}`;
		return `Member ${index + 1}`;
	}

	function generateTreeData(targetCount: number): Item[] {
		const nodes: Item[] = [];
		let id = 1;
		const l1Count = Math.min(10, Math.ceil(targetCount / 100));
		const l2PerL1 = Math.min(15, Math.ceil(targetCount / (l1Count * 10)));
		const l3PerL2 = Math.max(1, Math.floor((targetCount - l1Count - l1Count * l2PerL1) / (l1Count * l2PerL1)));

		outer: for (let i = 0; i < l1Count; i++) {
			const l1Path = String(i + 1);
			nodes.push({ id: id++, path: l1Path, parentPath: '', level: 1, name: generateName(1, i), hasChildren: true });
			for (let j = 0; j < l2PerL1; j++) {
				const l2Path = `${l1Path}.${j + 1}`;
				nodes.push({ id: id++, path: l2Path, parentPath: l1Path, level: 2, name: generateName(2, j), hasChildren: l3PerL2 > 0 });
				for (let k = 0; k < l3PerL2; k++) {
					const l3Path = `${l2Path}.${k + 1}`;
					nodes.push({ id: id++, path: l3Path, parentPath: l2Path, level: 3, name: `${generateName(2, j)} - ${generateName(3, k)}`, hasChildren: false });
					if (nodes.length >= targetCount) break outer;
				}
			}
		}
		return nodes;
	}

	function generateTestData() {
		const data = generateTreeData(nodeCountTarget);
		treeData = data;
		treeKey++;
	}

	function clearData() {
		treeData = [];
		clearSearch();
	}

	function redraw() {
		treeKey++;
	}

	function sortCallback(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name ?? '').localeCompare(b.data?.name ?? ''));
	}

	function expandAll() { treeRef?.expandAll(); }
	function collapseAll() { treeRef?.collapseAll(); }

	function expandOne() {
		const node = treeData.find((n) => n.level === 2 && n.hasChildren) ?? treeData.find((n) => n.level === 1 && n.hasChildren);
		if (node) treeRef?.expandNodes(node.path);
	}

	function collapseOne() {
		const node = treeData.find((n) => n.level === 1 && n.hasChildren);
		if (node) treeRef?.collapseNodes(node.path);
	}

	let searchPollId: ReturnType<typeof setInterval> | null = null;

	function runSearch(query: string) {
		const results = treeRef?.searchNodes(query) ?? [];
		searchResults = results;
		currentSearchIdx = results.length > 0 ? 0 : -1;
		return results.length;
	}

	function onSearchInput() {
		searchText = searchInputValue;
		const query = searchInputValue.trim();
		if (searchPollId) {
			clearInterval(searchPollId);
			searchPollId = null;
		}
		if (!query) {
			searchResults = [];
			currentSearchIdx = -1;
			return;
		}
		// First attempt — fires immediately. If the internal search index is
		// still being built (it runs via requestIdleCallback), this returns
		// empty. Poll for a short window so the counter eventually surfaces
		// matches without the user having to type again.
		if (runSearch(query) > 0) return;
		let attempts = 0;
		searchPollId = setInterval(() => {
			attempts++;
			if (runSearch(query) > 0 || attempts > 40) {
				if (searchPollId) {
					clearInterval(searchPollId);
					searchPollId = null;
				}
			}
		}, 100);
	}

	function clearSearch() {
		searchInputValue = '';
		searchText = '';
		searchResults = [];
		currentSearchIdx = -1;
	}

	function onSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') clearSearch();
	}

	function modeLabel(m: RenderMode): string {
		return m === 'virtual' ? 'Virtual Scroll' : m === 'flat' ? 'Flat Mode' : 'Recursive Mode';
	}
</script>

<svelte:head>
	<title>Test — Performance Fixture</title>
</svelte:head>

<main>
	<h1>Performance Test</h1>

	<div class="card">
		<h2>Rendering Mode</h2>
		<div class="modes">
			<label>
				<input type="radio" bind:group={renderMode} value="recursive" />
				Recursive
			</label>
			<label>
				<input type="radio" bind:group={renderMode} value="flat" />
				Flat
			</label>
			<label>
				<input type="radio" bind:group={renderMode} value="virtual" />
				Virtual Scroll
			</label>
		</div>
	</div>

	<div class="card">
		<h2>Configuration</h2>
		<div class="controls">
			<label>
				Node Count:
				<input type="number" bind:value={nodeCountTarget} min="100" max="50000" step="100" />
			</label>
			<button onclick={generateTestData}>Generate {nodeCountTarget} Nodes</button>
			<button onclick={redraw} disabled={treeData.length === 0}>Redraw</button>
			<button onclick={clearData} disabled={treeData.length === 0}>Clear</button>
		</div>
	</div>

	<div class="card">
		<h2>Performance Metrics</h2>
		<div class="metrics">
			<div class="metric">
				<span class="value">{treeData.length}</span>
				<span class="label">Nodes</span>
			</div>
		</div>
	</div>

	{#if treeData.length > 0}
		<div class="card">
			<h2>
				Synthetic Data ({treeData.length} nodes) - {modeLabel(renderMode)}
			</h2>
			<div class="tree-controls">
				<button onclick={expandOne}>Expand One</button>
				<button onclick={collapseOne}>Collapse One</button>
				<button onclick={expandAll}>Expand All</button>
				<button onclick={collapseAll}>Collapse All</button>
			</div>
			<div class="search-bar">
				<input
					type="text"
					class="search-input"
					bind:value={searchInputValue}
					oninput={onSearchInput}
					onkeydown={onSearchKeydown}
					placeholder="Filter nodes..."
				/>
				{#if searchResults.length > 0}
					<span class="search-counter">{currentSearchIdx + 1}/{searchResults.length}</span>
				{:else if searchInputValue.trim()}
					<span class="search-counter no-results">0 results</span>
				{/if}
			</div>
			<div class="tree-container">
				{#key treeKey}
					<Tree
						bind:this={treeRef}
						data={treeData}
						idMember="id"
						pathMember="path"
						parentPathMember="parentPath"
						levelMember="level"
						hasChildrenMember="hasChildren"
						displayValueMember="name"
						{sortCallback}
						isSorted={true}
						{expandLevel}
						shouldUseInternalSearchIndex={true}
						searchValueMember="name"
						bind:searchText
						{useFlatRendering}
						{virtualScroll}
						virtualContainerHeight="400px"
						virtualOverscan={5}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.name ?? node.path}</span>
						{/snippet}
					</Tree>
				{/key}
			</div>
		</div>
	{/if}
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
	.modes,
	.controls,
	.tree-controls,
	.search-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
	}
	.controls,
	.tree-controls {
		margin-bottom: 0.5rem;
	}
	.metrics {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.metric {
		min-width: 100px;
		padding: 0.5rem;
		border: 1px solid #e2e8f0;
		border-radius: 4px;
		text-align: center;
	}
	.metric .value {
		display: block;
		font-weight: 600;
		font-size: 1.1rem;
	}
	.metric .label {
		display: block;
		font-size: 0.75rem;
		color: #64748b;
		margin-top: 0.15rem;
	}
	.tree-container {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		min-height: 100px;
	}
	.search-input {
		flex: 0 1 220px;
		padding: 0.25rem 0.4rem;
	}
	.search-counter {
		font-family: monospace;
	}
</style>
