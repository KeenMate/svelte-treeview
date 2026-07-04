<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';
	import { untrack } from 'svelte';
	import RenderModeSwitch from '../RenderModeSwitch.svelte';
	import { getTreeProps } from '../render-mode.svelte.js';

	type LocationItem = {
		id: number;
		path: string;
		name: string;
		population?: string;
	};

	// Countries with major cities
	const sampleData: LocationItem[] = [
		// USA
		{ id: 1, path: '1', name: 'United States', population: '331M' },
		{ id: 101, path: '1.1', name: 'New York', population: '8.3M' },
		{ id: 102, path: '1.2', name: 'Los Angeles', population: '3.9M' },
		{ id: 103, path: '1.3', name: 'Chicago', population: '2.7M' },
		{ id: 104, path: '1.4', name: 'Houston', population: '2.3M' },
		{ id: 105, path: '1.5', name: 'Phoenix', population: '1.6M' },
		{ id: 106, path: '1.6', name: 'Philadelphia', population: '1.6M' },
		{ id: 107, path: '1.7', name: 'San Antonio', population: '1.5M' },
		{ id: 108, path: '1.8', name: 'San Diego', population: '1.4M' },
		{ id: 109, path: '1.9', name: 'Dallas', population: '1.3M' },
		{ id: 110, path: '1.10', name: 'San Jose', population: '1.0M' },
		{ id: 111, path: '1.11', name: 'Austin', population: '978K' },
		{ id: 112, path: '1.12', name: 'Jacksonville', population: '911K' },
		{ id: 113, path: '1.13', name: 'Fort Worth', population: '909K' },
		{ id: 114, path: '1.14', name: 'Columbus', population: '905K' },
		{ id: 115, path: '1.15', name: 'Charlotte', population: '879K' },
		{ id: 116, path: '1.16', name: 'San Francisco', population: '874K' },
		{ id: 117, path: '1.17', name: 'Indianapolis', population: '867K' },
		{ id: 118, path: '1.18', name: 'Seattle', population: '753K' },
		{ id: 119, path: '1.19', name: 'Denver', population: '727K' },
		{ id: 120, path: '1.20', name: 'Washington DC', population: '689K' },

		// Germany
		{ id: 2, path: '2', name: 'Germany', population: '83M' },
		{ id: 201, path: '2.1', name: 'Berlin', population: '3.6M' },
		{ id: 202, path: '2.2', name: 'Hamburg', population: '1.9M' },
		{ id: 203, path: '2.3', name: 'Munich', population: '1.5M' },
		{ id: 204, path: '2.4', name: 'Cologne', population: '1.1M' },
		{ id: 205, path: '2.5', name: 'Frankfurt', population: '753K' },
		{ id: 206, path: '2.6', name: 'Stuttgart', population: '634K' },
		{ id: 207, path: '2.7', name: 'Dusseldorf', population: '619K' },
		{ id: 208, path: '2.8', name: 'Leipzig', population: '587K' },
		{ id: 209, path: '2.9', name: 'Dortmund', population: '586K' },
		{ id: 210, path: '2.10', name: 'Essen', population: '582K' },
		{ id: 211, path: '2.11', name: 'Bremen', population: '566K' },
		{ id: 212, path: '2.12', name: 'Dresden', population: '556K' },
		{ id: 213, path: '2.13', name: 'Hanover', population: '535K' },
		{ id: 214, path: '2.14', name: 'Nuremberg', population: '518K' },
		{ id: 215, path: '2.15', name: 'Duisburg', population: '498K' },
		{ id: 216, path: '2.16', name: 'Bochum', population: '364K' },
		{ id: 217, path: '2.17', name: 'Wuppertal', population: '354K' },
		{ id: 218, path: '2.18', name: 'Bielefeld', population: '333K' },
		{ id: 219, path: '2.19', name: 'Bonn', population: '329K' },
		{ id: 220, path: '2.20', name: 'Mannheim', population: '309K' },

		// Japan
		{ id: 3, path: '3', name: 'Japan', population: '126M' },
		{ id: 301, path: '3.1', name: 'Tokyo', population: '13.9M' },
		{ id: 302, path: '3.2', name: 'Yokohama', population: '3.7M' },
		{ id: 303, path: '3.3', name: 'Osaka', population: '2.7M' },
		{ id: 304, path: '3.4', name: 'Nagoya', population: '2.3M' },
		{ id: 305, path: '3.5', name: 'Sapporo', population: '2.0M' },
		{ id: 306, path: '3.6', name: 'Fukuoka', population: '1.6M' },
		{ id: 307, path: '3.7', name: 'Kobe', population: '1.5M' },
		{ id: 308, path: '3.8', name: 'Kawasaki', population: '1.5M' },
		{ id: 309, path: '3.9', name: 'Kyoto', population: '1.5M' },
		{ id: 310, path: '3.10', name: 'Saitama', population: '1.3M' },
		{ id: 311, path: '3.11', name: 'Hiroshima', population: '1.2M' },
		{ id: 312, path: '3.12', name: 'Sendai', population: '1.1M' },
		{ id: 313, path: '3.13', name: 'Chiba', population: '978K' },
		{ id: 314, path: '3.14', name: 'Kitakyushu', population: '940K' },
		{ id: 315, path: '3.15', name: 'Sakai', population: '826K' },
		{ id: 316, path: '3.16', name: 'Niigata', population: '789K' },
		{ id: 317, path: '3.17', name: 'Hamamatsu', population: '791K' },
		{ id: 318, path: '3.18', name: 'Shizuoka', population: '693K' },
		{ id: 319, path: '3.19', name: 'Okayama', population: '725K' },
		{ id: 320, path: '3.20', name: 'Kumamoto', population: '738K' },

		// Brazil
		{ id: 4, path: '4', name: 'Brazil', population: '212M' },
		{ id: 401, path: '4.1', name: 'Sao Paulo', population: '12.3M' },
		{ id: 402, path: '4.2', name: 'Rio de Janeiro', population: '6.7M' },
		{ id: 403, path: '4.3', name: 'Brasilia', population: '3.0M' },
		{ id: 404, path: '4.4', name: 'Salvador', population: '2.9M' },
		{ id: 405, path: '4.5', name: 'Fortaleza', population: '2.7M' },
		{ id: 406, path: '4.6', name: 'Belo Horizonte', population: '2.5M' },
		{ id: 407, path: '4.7', name: 'Manaus', population: '2.2M' },
		{ id: 408, path: '4.8', name: 'Curitiba', population: '1.9M' },
		{ id: 409, path: '4.9', name: 'Recife', population: '1.6M' },
		{ id: 410, path: '4.10', name: 'Porto Alegre', population: '1.5M' },
		{ id: 411, path: '4.11', name: 'Belem', population: '1.5M' },
		{ id: 412, path: '4.12', name: 'Goiania', population: '1.5M' },
		{ id: 413, path: '4.13', name: 'Guarulhos', population: '1.4M' },
		{ id: 414, path: '4.14', name: 'Campinas', population: '1.2M' },
		{ id: 415, path: '4.15', name: 'Sao Luis', population: '1.1M' },
		{ id: 416, path: '4.16', name: 'Maceio', population: '1.0M' },
		{ id: 417, path: '4.17', name: 'Duque de Caxias', population: '924K' },
		{ id: 418, path: '4.18', name: 'Natal', population: '890K' },
		{ id: 419, path: '4.19', name: 'Campo Grande', population: '895K' },
		{ id: 420, path: '4.20', name: 'Teresina', population: '868K' },

		// United Kingdom
		{ id: 5, path: '5', name: 'United Kingdom', population: '67M' },
		{ id: 501, path: '5.1', name: 'London', population: '8.9M' },
		{ id: 502, path: '5.2', name: 'Birmingham', population: '1.1M' },
		{ id: 503, path: '5.3', name: 'Manchester', population: '547K' },
		{ id: 504, path: '5.4', name: 'Leeds', population: '793K' },
		{ id: 505, path: '5.5', name: 'Glasgow', population: '633K' },
		{ id: 506, path: '5.6', name: 'Liverpool', population: '498K' },
		{ id: 507, path: '5.7', name: 'Bristol', population: '463K' },
		{ id: 508, path: '5.8', name: 'Sheffield', population: '584K' },
		{ id: 509, path: '5.9', name: 'Edinburgh', population: '527K' },
		{ id: 510, path: '5.10', name: 'Leicester', population: '354K' },
		{ id: 511, path: '5.11', name: 'Coventry', population: '371K' },
		{ id: 512, path: '5.12', name: 'Bradford', population: '537K' },
		{ id: 513, path: '5.13', name: 'Cardiff', population: '362K' },
		{ id: 514, path: '5.14', name: 'Belfast', population: '343K' },
		{ id: 515, path: '5.15', name: 'Nottingham', population: '332K' },
		{ id: 516, path: '5.16', name: 'Newcastle', population: '302K' },
		{ id: 517, path: '5.17', name: 'Southampton', population: '252K' },
		{ id: 518, path: '5.18', name: 'Portsmouth', population: '238K' },
		{ id: 519, path: '5.19', name: 'Brighton', population: '229K' },
		{ id: 520, path: '5.20', name: 'Plymouth', population: '263K' },

		// France
		{ id: 6, path: '6', name: 'France', population: '67M' },
		{ id: 601, path: '6.1', name: 'Paris', population: '2.2M' },
		{ id: 602, path: '6.2', name: 'Marseille', population: '870K' },
		{ id: 603, path: '6.3', name: 'Lyon', population: '516K' },
		{ id: 604, path: '6.4', name: 'Toulouse', population: '479K' },
		{ id: 605, path: '6.5', name: 'Nice', population: '342K' },
		{ id: 606, path: '6.6', name: 'Nantes', population: '314K' },
		{ id: 607, path: '6.7', name: 'Strasbourg', population: '284K' },
		{ id: 608, path: '6.8', name: 'Montpellier', population: '285K' },
		{ id: 609, path: '6.9', name: 'Bordeaux', population: '257K' },
		{ id: 610, path: '6.10', name: 'Lille', population: '233K' },
		{ id: 611, path: '6.11', name: 'Rennes', population: '216K' },
		{ id: 612, path: '6.12', name: 'Reims', population: '182K' },
		{ id: 613, path: '6.13', name: 'Saint-Etienne', population: '173K' },
		{ id: 614, path: '6.14', name: 'Toulon', population: '171K' },
		{ id: 615, path: '6.15', name: 'Le Havre', population: '170K' },
		{ id: 616, path: '6.16', name: 'Grenoble', population: '158K' },
		{ id: 617, path: '6.17', name: 'Dijon', population: '156K' },
		{ id: 618, path: '6.18', name: 'Angers', population: '152K' },
		{ id: 619, path: '6.19', name: 'Nimes', population: '151K' },
		{ id: 620, path: '6.20', name: 'Villeurbanne', population: '150K' },

		// Australia
		{ id: 7, path: '7', name: 'Australia', population: '26M' },
		{ id: 701, path: '7.1', name: 'Sydney', population: '5.3M' },
		{ id: 702, path: '7.2', name: 'Melbourne', population: '5.0M' },
		{ id: 703, path: '7.3', name: 'Brisbane', population: '2.5M' },
		{ id: 704, path: '7.4', name: 'Perth', population: '2.1M' },
		{ id: 705, path: '7.5', name: 'Adelaide', population: '1.4M' },
		{ id: 706, path: '7.6', name: 'Gold Coast', population: '699K' },
		{ id: 707, path: '7.7', name: 'Newcastle', population: '322K' },
		{ id: 708, path: '7.8', name: 'Canberra', population: '453K' },
		{ id: 709, path: '7.9', name: 'Sunshine Coast', population: '348K' },
		{ id: 710, path: '7.10', name: 'Wollongong', population: '306K' },
		{ id: 711, path: '7.11', name: 'Hobart', population: '238K' },
		{ id: 712, path: '7.12', name: 'Geelong', population: '264K' },
		{ id: 713, path: '7.13', name: 'Townsville', population: '180K' },
		{ id: 714, path: '7.14', name: 'Cairns', population: '153K' },
		{ id: 715, path: '7.15', name: 'Darwin', population: '139K' },
		{ id: 716, path: '7.16', name: 'Toowoomba', population: '136K' },
		{ id: 717, path: '7.17', name: 'Ballarat', population: '110K' },
		{ id: 718, path: '7.18', name: 'Bendigo', population: '100K' },
		{ id: 719, path: '7.19', name: 'Launceston', population: '87K' },
		{ id: 720, path: '7.20', name: 'Mackay', population: '80K' },

		// Canada
		{ id: 8, path: '8', name: 'Canada', population: '38M' },
		{ id: 801, path: '8.1', name: 'Toronto', population: '2.9M' },
		{ id: 802, path: '8.2', name: 'Montreal', population: '1.8M' },
		{ id: 803, path: '8.3', name: 'Calgary', population: '1.3M' },
		{ id: 804, path: '8.4', name: 'Ottawa', population: '1.0M' },
		{ id: 805, path: '8.5', name: 'Edmonton', population: '1.0M' },
		{ id: 806, path: '8.6', name: 'Mississauga', population: '721K' },
		{ id: 807, path: '8.7', name: 'Winnipeg', population: '749K' },
		{ id: 808, path: '8.8', name: 'Vancouver', population: '662K' },
		{ id: 809, path: '8.9', name: 'Brampton', population: '656K' },
		{ id: 810, path: '8.10', name: 'Hamilton', population: '569K' },
		{ id: 811, path: '8.11', name: 'Quebec City', population: '549K' },
		{ id: 812, path: '8.12', name: 'Surrey', population: '568K' },
		{ id: 813, path: '8.13', name: 'Laval', population: '438K' },
		{ id: 814, path: '8.14', name: 'Halifax', population: '403K' },
		{ id: 815, path: '8.15', name: 'London', population: '383K' },
		{ id: 816, path: '8.16', name: 'Markham', population: '338K' },
		{ id: 817, path: '8.17', name: 'Vaughan', population: '323K' },
		{ id: 818, path: '8.18', name: 'Gatineau', population: '291K' },
		{ id: 819, path: '8.19', name: 'Saskatoon', population: '273K' },
		{ id: 820, path: '8.20', name: 'Kitchener', population: '256K' },
	];

	// Search state
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
		searchMode = searchMode === 'filter' ? 'search' : 'filter';
		// Keep the typed query when switching modes — just re-apply it in the new
		// mode. Search mode doesn't filter the tree, so drop any filter text first;
		// onSearchInput() then re-runs the query (and in filter mode re-sets searchText).
		if (searchMode === 'search') {
			searchText = '';
		}
		onSearchInput();
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

	function scrollToResult(index: number) {
		navigateToResult(index);
	}
</script>

<svelte:head>
	<title>Search & Filter - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>🔍 Search & Filter</h1>
		<p class="subtitle">Internal search index with result navigation</p>
		<RenderModeSwitch />
	</header>

	<!-- Unified Search Card -->
	<div class="card">
		<h2>Search & Navigate</h2>
		<p class="description">
			Type to search the tree. <strong>Filter</strong> mode hides non-matching nodes.
			<strong>Search</strong> mode keeps the tree visible and navigates to results.
			Use <kbd>Enter</kbd> for next, <kbd>Shift+Enter</kbd> for previous, <kbd>Esc</kbd> to clear.
		</p>

		<div class="search-bar">
			<button class="search-mode-btn" onclick={toggleSearchMode} title="Toggle filter/search mode">
				{#if searchMode === 'filter'}
					<!-- Funnel icon -->
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<path d="M1.5 1.5h13l-5 6v5l-3 2v-7z"/>
					</svg>
				{:else}
					<!-- Magnifying glass icon -->
					<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
						<circle cx="6.5" cy="6.5" r="5" fill="none" stroke="currentColor" stroke-width="2"/>
						<line x1="10" y1="10" x2="15" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
					</svg>
				{/if}
			</button>
			<span class="search-mode-label">{searchMode === 'filter' ? 'Filter' : 'Search'}</span>

			<input
				type="text"
				bind:value={searchInputValue}
				oninput={onSearchInput}
				onkeydown={onSearchKeydown}
				placeholder="Search... (try 'london' or 'san')"
				class="search-input"
			/>

			{#if searchResults.length > 0}
				<span class="search-counter">{currentResultIndex + 1}/{searchResults.length}</span>
				<button class="search-nav-btn" title="Previous (Shift+Enter)" aria-label="Previous result" onclick={searchPrev}>
					<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M6 2L1 7h10z"/></svg>
				</button>
				<button class="search-nav-btn" title="Next (Enter)" aria-label="Next result" onclick={searchNext}>
					<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M6 10L1 5h10z"/></svg>
				</button>
			{:else if searchInputValue.trim()}
				<span class="search-counter no-results">0 results</span>
			{/if}

			{#if searchInputValue}
				<button class="search-nav-btn" title="Clear (Esc)" aria-label="Clear search" onclick={clearSearch}>
					<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>
				</button>
			{/if}

			<label class="scroll-option" title="When enabled, scrolls only within the tree container. When disabled, scrolls the entire page.">
				<input type="checkbox" bind:checked={useContainerScroll} />
				Container scroll
			</label>
		</div>

		<div class="grid-2">
			<div>
				<h3>Tree (filtered)</h3>
				<div class="tree-container tree-container-tall">
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
						bind:searchText={searchText}
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
							<span class="location-node">
								<span class="location-name">{node.data?.name}</span>
								{#if node.data?.population}
									<span class="location-pop">{node.data.population}</span>
								{/if}
							</span>
						{/snippet}
					</Tree>
				</div>
			</div>

			<div>
				<h3>Results ({searchResults.length})</h3>
				<div class="tree-container tree-container-tall results-list">
					{#if searchResults.length > 0}
						<ul>
							{#each searchResults as result, i}
								<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
								<li
									class:active={i === currentResultIndex}
									onclick={() => scrollToResult(i)}
									onkeydown={(e) => { if (e.key === "Enter") scrollToResult(i); }}
									role="option"
									aria-selected={i === currentResultIndex}
									tabindex="0"
								>
									<span class="result-name">{result.data?.name}</span>
									<small class="result-path">{result.data?.population} - {result.level === 1 ? 'Country' : 'City'}</small>
								</li>
							{/each}
						</ul>
					{:else}
						<p class="empty-state">
							{searchText.trim() ? 'No results found' : 'Type to search'}
						</p>
					{/if}
				</div>
			</div>
		</div>

		<div class="note" style="margin-top: 1rem;">
			<p class="note-title">Note</p>
			<p>The search index is built asynchronously after page load. If no results appear immediately, wait a moment.</p>
		</div>

		<div class="code-block">
			<pre>{`${"<"}script>
  let searchInputValue = $state('');
  let searchText = $state('');
  let searchMode = $state('filter'); // 'filter' | 'search'
  let treeRef;
  let results = $state([]);
  let currentIndex = $state(-1);

  function onSearchInput() {
    if (searchMode === 'filter') searchText = searchInputValue;
    results = treeRef?.searchNodes(searchInputValue.trim()) ?? [];
    if (results.length > 0) {
      currentIndex = 0;
      treeRef.scrollToPath(results[0].path, {
        expand: true, highlight: true
      });
    }
  }

  function searchNext() {
    const next = (currentIndex + 1) % results.length;
    currentIndex = next;
    treeRef.scrollToPath(results[next].path, {
      expand: true, highlight: true
    });
  }
${"<"}/script>

<input bind:value={searchInputValue} oninput={onSearchInput} />
<span>{currentIndex + 1}/{results.length}</span>
<button onclick={searchNext}>Next</button>

<Tree
  bind:this={treeRef}
  bind:searchText
  shouldUseInternalSearchIndex={true}
  searchValueMember="name"
  ...
/>`}</pre>
		</div>
	</div>

	<!-- Search Configuration -->
	<div class="card">
		<h2>Search Configuration</h2>
		<p class="description">Configure how the search index is built and queried.</p>

		<table>
			<thead>
				<tr>
					<th>Prop</th>
					<th>Type</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td><code>shouldUseInternalSearchIndex</code></td>
					<td><code>boolean</code></td>
					<td>Enable the internal search index (required for search/filter)</td>
				</tr>
				<tr>
					<td><code>searchValueMember</code></td>
					<td><code>string</code></td>
					<td>Property name to index for searching (e.g., "name")</td>
				</tr>
				<tr>
					<td><code>getSearchValueCallback</code></td>
					<td><code>(node: LTreeNode&lt;T&gt;) =&gt; string</code></td>
					<td>Custom function to extract search value from node</td>
				</tr>
				<tr>
					<td><code>searchText</code></td>
					<td><code>string</code></td>
					<td>Bindable prop for filtering the tree visually</td>
				</tr>
			</tbody>
		</table>

		<h3 style="margin-top: 1.5rem;">Methods</h3>
		<table>
			<thead>
				<tr>
					<th>Method</th>
					<th>Returns</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td><code>searchNodes(text)</code></td>
					<td><code>LTreeNode&lt;T&gt;[]</code></td>
					<td>Query the index without filtering - returns matching nodes</td>
				</tr>
				<tr>
					<td><code>scrollToPath(path, options)</code></td>
					<td><code>void</code></td>
					<td>Scroll tree to make a node visible (expands parents automatically)</td>
				</tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`// Using searchValueMember (simple)
<Tree
  shouldUseInternalSearchIndex={true}
  searchValueMember="name"
  ...
/>

// Using getSearchValueCallback (custom - search multiple fields)
<Tree
  shouldUseInternalSearchIndex={true}
  getSearchValueCallback={(node) => \`\${node.data?.name} \${node.data?.description}\`}
  ...
/>`}</pre>
		</div>
	</div>

	<!-- FlexSearch Integration -->
	<div class="card">
		<h2>FlexSearch Integration</h2>
		<p class="description">For advanced full-text search, integrate with FlexSearch (optional peer dependency).</p>

		<div class="note">
			<p class="note-title">Installation</p>
			<pre style="margin-top: 0.5rem;">npm install flexsearch</pre>
		</div>

		<div class="code-block">
			<pre>{`// FlexSearch provides advanced features:
// - Fuzzy matching
// - Phonetic search
// - Language-specific tokenization
// - Scoring and relevance ranking

// The tree component can work with FlexSearch
// by providing a custom search callback`}</pre>
		</div>
	</div>

	<footer>
		<p><a href="/">&larr; Back to Examples</a></p>
	</footer>
</div>

<style>
	.search-bar {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		flex-wrap: wrap;
		padding: 0.5rem;
		background: #f7fafc;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
	}

	.search-mode-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: 1px solid #cbd5e0;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		color: #667eea;
		transition: background-color 0.15s;
	}

	.search-mode-btn:hover {
		background: #edf2f7;
	}

	.search-mode-label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #667eea;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		min-width: 40px;
	}

	.search-input {
		flex: 1;
		min-width: 200px;
		padding: 0.4rem 0.75rem;
		border: 1px solid #cbd5e0;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.search-input:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.2);
	}

	.search-counter {
		font-size: 0.85rem;
		font-weight: 500;
		color: #4a5568;
		min-width: 50px;
		text-align: center;
	}

	.search-counter.no-results {
		color: #e53e3e;
	}

	.search-nav-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: 1px solid #cbd5e0;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		color: #4a5568;
		transition: background-color 0.15s;
	}

	.search-nav-btn:hover {
		background: #edf2f7;
	}

	.results-list {
		overflow-y: auto;
	}

	.results-list ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.results-list li {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #e2e8f0;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.results-list li:hover {
		background-color: #f7fafc;
	}

	.results-list li.active {
		background-color: #ebf4ff;
		border-left: 3px solid #667eea;
	}

	.result-name {
		display: block;
		font-weight: 500;
	}

	.result-path {
		color: #718096;
		font-size: 0.85em;
	}

	.empty-state {
		color: #718096;
		text-align: center;
		padding: 2rem;
	}

	kbd {
		background: #edf2f7;
		color: #2d3748;
		border: 1px solid #cbd5e0;
		border-radius: 3px;
		padding: 0.1em 0.4em;
		font-size: 0.9em;
		font-family: inherit;
	}

	.scroll-option {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.875rem;
		color: #4a5568;
		cursor: pointer;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		background: #f7fafc;
		border: 1px solid #e2e8f0;
	}

	.scroll-option:hover {
		background: #edf2f7;
	}

	.scroll-option input {
		margin: 0;
	}

	.location-node {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.location-name {
		font-weight: 500;
	}

	.location-pop {
		font-size: 0.8em;
		color: #718096;
		background: #edf2f7;
		padding: 0.1em 0.4em;
		border-radius: 3px;
	}
</style>
