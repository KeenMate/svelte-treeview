<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';

	// Deterministic e2e fixture for search/filter features. Targeted by
	// e2e/search.spec.ts. Mirrors /examples/search but with a tiny dataset
	// chosen so search assertions stay stable:
	//   - 'london'         → 2 matches (UK + Canada)
	//   - 'tokyo'          → 1 match
	//   - 'xxx_no_match'   → 0 results

	type LocationItem = {
		id: number;
		path: string;
		name: string;
		population?: string;
	};

	const sampleData: LocationItem[] = [
		{ id: 1, path: '1', name: 'United States', population: '331M' },
		{ id: 2, path: '2', name: 'Germany', population: '83M' },
		{ id: 3, path: '3', name: 'Japan', population: '126M' },
		{ id: 31, path: '3.1', name: 'Tokyo', population: '13.9M' },
		{ id: 4, path: '4', name: 'United Kingdom', population: '67M' },
		{ id: 41, path: '4.1', name: 'London', population: '8.9M' },
		{ id: 5, path: '5', name: 'Canada', population: '38M' },
		{ id: 51, path: '5.1', name: 'London', population: '383K' }
	];

	type SearchMode = 'filter' | 'search';
	let searchMode = $state<SearchMode>('filter');
	let searchInputValue = $state('');
	let searchText = $state('');
	let treeRef: Tree<LocationItem>;
	let searchResults = $state<LTreeNode<LocationItem>[]>([]);
	let currentResultIndex = $state(-1);
	let useContainerScroll = $state(true);

	function sortByName(items: LTreeNode<LocationItem>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	function toggleSearchMode() {
		clearSearch();
		searchMode = searchMode === 'filter' ? 'search' : 'filter';
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
				containerScroll: useContainerScroll
			});
		}
	}

	function onSearchInput() {
		if (searchMode === 'filter') {
			searchText = searchInputValue;
		}
		const results = treeRef?.searchNodes(searchInputValue.trim()) ?? [];
		searchResults = results;
		if (results.length > 0) {
			currentResultIndex = 0;
			navigateToResult(0);
		} else {
			currentResultIndex = -1;
		}
	}

	function searchNext() {
		if (searchResults.length === 0) return;
		const next = (currentResultIndex + 1) % searchResults.length;
		navigateToResult(next);
	}

	function searchPrev() {
		if (searchResults.length === 0) return;
		const prev = (currentResultIndex - 1 + searchResults.length) % searchResults.length;
		navigateToResult(prev);
	}

	function clearSearch() {
		searchInputValue = '';
		searchText = '';
		searchResults = [];
		currentResultIndex = -1;
	}

	function onSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (e.shiftKey) {
				searchPrev();
			} else {
				searchNext();
			}
		} else if (e.key === 'Escape') {
			clearSearch();
		}
	}
</script>

<svelte:head>
	<title>Test — Search Fixture</title>
</svelte:head>

<main>
	<h1>Search Test Fixture</h1>

	<div class="card">
		<h2>Search &amp; Navigate</h2>

		<div class="search-bar">
			<button class="search-mode-btn" onclick={toggleSearchMode} title="Toggle filter/search mode">
				{searchMode === 'filter' ? 'F' : 'S'}
			</button>
			<span class="search-mode-label">{searchMode === 'filter' ? 'Filter' : 'Search'}</span>

			<input
				type="text"
				bind:value={searchInputValue}
				oninput={onSearchInput}
				onkeydown={onSearchKeydown}
				placeholder="Search..."
				class="search-input"
			/>

			{#if searchResults.length > 0}
				<span class="search-counter">{currentResultIndex + 1}/{searchResults.length}</span>
				<button class="search-nav-btn" title="Previous (Shift+Enter)" aria-label="Previous result" onclick={searchPrev}>‹</button>
				<button class="search-nav-btn" title="Next (Enter)" aria-label="Next result" onclick={searchNext}>›</button>
			{:else if searchInputValue.trim()}
				<span class="search-counter no-results">0 results</span>
			{/if}

			{#if searchInputValue}
				<button class="search-nav-btn" title="Clear (Esc)" aria-label="Clear search" onclick={clearSearch}>×</button>
			{/if}

			<label class="scroll-option">
				<input type="checkbox" bind:checked={useContainerScroll} />
				Container scroll
			</label>
		</div>

		<div class="panes">
			<div class="tree-container">
				<Tree
					bind:this={treeRef}
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={3}
					shouldUseInternalSearchIndex={true}
					searchValueMember="name"
					bind:searchText
				>
					{#snippet nodeTemplate(node: LTreeNode<LocationItem>)}
						<span class="location-node">
							<span class="location-name">{node.data?.name}</span>
						</span>
					{/snippet}
				</Tree>
			</div>

			<div class="tree-container">
				{#if searchResults.length > 0}
					<ul>
						{#each searchResults as result, i}
							<li class:active={i === currentResultIndex}>
								<span class="result-name">{result.data?.name}</span>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty-state">{searchInputValue.trim() ? 'No results found' : 'Type to search'}</p>
				{/if}
			</div>
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
	.search-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
	}
	.search-mode-btn,
	.search-nav-btn {
		min-width: 24px;
		padding: 0.15rem 0.4rem;
	}
	.search-input {
		flex: 0 1 240px;
		padding: 0.25rem 0.4rem;
	}
	.search-counter {
		font-family: monospace;
	}
	.search-counter.no-results {
		color: #b91c1c;
	}
	.panes {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.tree-container {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		min-height: 100px;
	}
	ul {
		margin: 0;
		padding-left: 1rem;
	}
	li.active {
		font-weight: 600;
	}
	.empty-state {
		margin: 0;
		color: #64748b;
		font-size: 0.85rem;
	}
</style>
