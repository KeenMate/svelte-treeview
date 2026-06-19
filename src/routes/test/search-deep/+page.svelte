<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';

	// Deterministic fixture for e2e/search-deep.spec.ts.
	//
	// 10 groups × 10 subs × 10 leaves = 1000 leaves (1110 total nodes), 3 levels.
	// expandLevel=1 leaves levels 2 and 3 collapsed so a navigate-to-result hit
	// in a deep branch must (a) expand its ancestors and (b) scroll the
	// fixed-height container down to the row.
	//
	// Most rows use generic names; one leaf at "9.7.3" carries a globally unique
	// distinctive name ("ZZTARGETUNIQUE") so the e2e search returns exactly one
	// match regardless of how flexsearch tokenizes the index.

	type Item = { id: number; path: string; name: string };

	function buildData(): Item[] {
		const out: Item[] = [];
		let id = 1;
		for (let g = 1; g <= 10; g++) {
			out.push({ id: id++, path: `${g}`, name: `Group-${g}` });
			for (let s = 1; s <= 10; s++) {
				out.push({ id: id++, path: `${g}.${s}`, name: `Sub-${g}-${s}` });
				for (let l = 1; l <= 10; l++) {
					let name = `Leaf-${g}-${s}-${l}`;
					// Target leaves placed at high `l` so they fall past the initial
					// progressive-render batch (initialBatchSize=5) — reproduces the
					// "scrollToPath misses just-expanded deferred rows" bug.
					if (g === 9 && s === 7 && l === 10) name = 'ZZTARGETUNIQUE';
					else if (g === 2 && s === 3 && l === 10) name = 'AATARGETUNIQUE';
					out.push({ id: id++, path: `${g}.${s}.${l}`, name });
				}
			}
		}
		return out;
	}

	const data: Item[] = buildData();

	let treeRef: Tree<Item>;
	let searchInputValue = $state('');
	let searchResults = $state<LTreeNode<Item>[]>([]);
	let currentResultIndex = $state(-1);

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	function navigateToResult(idx: number) {
		if (searchResults.length === 0) return;
		currentResultIndex = idx;
		const node = searchResults[idx];
		if (node?.path) {
			treeRef?.scrollToPath(node.path, {
				expand: true,
				highlight: true,
				scrollOptions: { behavior: 'smooth', block: 'center' },
				containerScroll: true
			});
		}
	}

	function onSearchInput() {
		const results = treeRef?.searchNodes(searchInputValue.trim()) ?? [];
		searchResults = results;
		if (results.length > 0) {
			currentResultIndex = 0;
			navigateToResult(0);
		} else {
			currentResultIndex = -1;
		}
	}
</script>

<svelte:head>
	<title>Test — Search Deep Tree</title>
</svelte:head>

<main>
	<h1>Search Deep Tree Fixture</h1>
	<p class="hint">10×10×10 = 1000 leaves, expandLevel=1.</p>

	<div class="search-bar">
		<input
			type="text"
			data-testid="search-input"
			bind:value={searchInputValue}
			oninput={onSearchInput}
			placeholder="e.g. Leaf-7-5-3"
		/>
		<span data-testid="result-count">{searchResults.length}</span>
	</div>

	<div class="tree-scroll" data-testid="scroll-container">
		<Tree
			bind:this={treeRef}
			{data}
			idMember="id"
			pathMember="path"
			sortCallback={sortByName}
			isSorted={true}
			expandLevel={1}
			shouldUseInternalSearchIndex={true}
			searchValueMember="name"
			useFlatRendering={true}
			progressiveRender={true}
			initialBatchSize={5}
			maxBatchSize={500}
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
	.hint {
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
		color: #64748b;
	}
	.search-bar {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.5rem;
	}
	.search-bar input {
		padding: 0.25rem 0.4rem;
		flex: 0 1 240px;
	}
	.tree-scroll {
		height: 240px;
		overflow: auto;
		border: 1px solid #cbd5e1;
		padding: 0.5rem;
	}
</style>
