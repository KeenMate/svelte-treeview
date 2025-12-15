<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types';

	type FileItem = {
		id: number;
		path: string;
		name: string;
		description: string;
		icon: string;
	};

	const sampleData: FileItem[] = [
		{ id: 1, path: '1', name: 'Components', description: 'UI components', icon: '📦' },
		{ id: 2, path: '1.1', name: 'Button', description: 'Click actions', icon: '🔘' },
		{ id: 3, path: '1.2', name: 'Input', description: 'Text input fields', icon: '📝' },
		{ id: 4, path: '1.3', name: 'Modal', description: 'Dialog popups', icon: '💬' },
		{ id: 5, path: '1.4', name: 'Dropdown', description: 'Select menus', icon: '📋' },
		{ id: 6, path: '2', name: 'Utilities', description: 'Helper functions', icon: '🔧' },
		{ id: 7, path: '2.1', name: 'formatDate', description: 'Date formatting', icon: '📅' },
		{ id: 8, path: '2.2', name: 'parseJSON', description: 'JSON parsing', icon: '📄' },
		{ id: 9, path: '2.3', name: 'debounce', description: 'Rate limiting', icon: '⏱️' },
		{ id: 10, path: '3', name: 'Services', description: 'API services', icon: '🌐' },
		{ id: 11, path: '3.1', name: 'AuthService', description: 'Authentication', icon: '🔐' },
		{ id: 12, path: '3.2', name: 'ApiClient', description: 'HTTP requests', icon: '📡' },
		{ id: 13, path: '3.3', name: 'StorageService', description: 'Local storage', icon: '💾' }
	];

	// Filter example
	let filterSearchText = $state('');
	let filterTreeRef: Tree<FileItem>;

	// Search example
	let searchText = $state('');
	let searchTreeRef: Tree<FileItem>;
	let searchResults = $state<LTreeNode<FileItem>[]>([]);

	function sortByName(items: LTreeNode<FileItem>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	function handleSearch() {
		if (searchTreeRef && searchText.trim()) {
			searchResults = searchTreeRef.searchNodes(searchText) || [];
		} else {
			searchResults = [];
		}
	}

	// Reactive search - automatically search when searchText changes
	$effect(() => {
		if (searchText !== undefined) {
			handleSearch();
		}
	});

	function scrollToResult(path: string) {
		searchTreeRef?.scrollToPath(path, { behavior: 'smooth', block: 'center' });
	}
</script>

<svelte:head>
	<title>Search & Filter Examples - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>🔍 Search & Filter Examples</h1>
		<p class="subtitle">Internal search index, filtering, and FlexSearch integration</p>
	</header>

	<!-- Filter Nodes -->
	<div class="card">
		<h2>Filter Nodes (Live)</h2>
		<p class="description">Use the <code>searchText</code> prop to filter the tree in real-time. Only matching nodes and their parents are shown.</p>

		<div class="controls">
			<input
				type="text"
				bind:value={filterSearchText}
				placeholder="Type to filter..."
				style="width: 300px"
			/>
		</div>

		<div class="tree-container tree-container-tall">
			<Tree
				bind:this={filterTreeRef}
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={3}
				shouldUseInternalSearchIndex={true}
				searchValueMember="name"
				bind:searchText={filterSearchText}
			>
				{#snippet nodeTemplate(node)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>

		<div class="code-block">
			<pre>{`<Tree
  data={data}
  idMember="id"
  pathMember="path"
  sortCallback={sortByName}
  shouldUseInternalSearchIndex={true}
  searchValueMember="name"
  bind:searchText={filterSearchText}
/>`}</pre>
		</div>
	</div>

	<!-- Search Nodes -->
	<div class="card">
		<h2>Search Nodes (Query)</h2>
		<p class="description">Use <code>searchNodes()</code> to query the tree without filtering. Returns matching nodes that you can process or display separately.</p>

		<div class="controls">
			<input
				type="text"
				bind:value={searchText}
				placeholder="Search... (try 'auth' or 'date')"
				style="width: 300px"
				onkeydown={(e) => e.key === 'Enter' && handleSearch()}
			/>
			<button class="btn" onclick={handleSearch}>Search</button>
		</div>

		<div class="note" style="margin-bottom: 1rem;">
			<p class="note-title">Note</p>
			<p>The search index is built asynchronously after page load. If no results appear, wait a moment and try again.</p>
		</div>

		<div class="grid-2">
			<div>
				<h3>Tree</h3>
				<div class="tree-container tree-container-tall">
					<Tree
						bind:this={searchTreeRef}
						data={sampleData}
						idMember="id"
						pathMember="path"
						sortCallback={sortByName}
						isSorted={true}
						expandLevel={3}
						shouldUseInternalSearchIndex={true}
						searchValueMember="name"
						shouldDisplayDebugInformation={true}
					>
						{#snippet nodeTemplate(node)}
							<span>{node.data?.icon} {node.data?.name}</span>
						{/snippet}
					</Tree>
				</div>
			</div>

			<div>
				<h3>Search Results ({searchResults.length})</h3>
				<div class="tree-container tree-container-tall" style="overflow-y: auto;">
					{#if searchResults.length > 0}
						<ul style="list-style: none; padding: 0;">
							{#each searchResults as result}
								<li style="padding: 8px; border-bottom: 1px solid #e2e8f0; cursor: pointer;" onclick={() => scrollToResult(result.path)}>
									<span>{result.data?.icon} {result.data?.name}</span>
									<small style="color: #718096; display: block;">Path: {result.path}</small>
								</li>
							{/each}
						</ul>
					{:else}
						<p style="color: #718096; text-align: center; padding: 2rem;">
							{searchText ? 'No results found' : 'Enter a search term and click Search'}
						</p>
					{/if}
				</div>
			</div>
		</div>

		<div class="code-block">
			<pre>{`// Get search results without filtering the tree
const results = treeRef.searchNodes('auth');

// Process results
results.forEach(node => {
  console.log(node.data?.name, node.path);
});

// Optionally scroll to a result
treeRef.scrollToPath(results[0].path);`}</pre>
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
					<td><code>searchValueCallback</code></td>
					<td><code>(item: T) =&gt; string</code></td>
					<td>Custom function to extract search value from item</td>
				</tr>
				<tr>
					<td><code>searchText</code></td>
					<td><code>string</code></td>
					<td>Bindable prop for filtering the tree</td>
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

// Using searchValueCallback (custom)
<Tree
  shouldUseInternalSearchIndex={true}
  searchValueCallback={(item) => \`\${item.name} \${item.description}\`}
  ...
/>`}</pre>
		</div>
	</div>

	<!-- Search Methods -->
	<div class="card">
		<h2>Search Methods</h2>
		<p class="description">Two ways to search the tree.</p>

		<div class="grid-2">
			<div>
				<h3><code>searchText</code> (Prop)</h3>
				<ul>
					<li>Filters the tree visually</li>
					<li>Hides non-matching nodes</li>
					<li>Shows parents of matching nodes</li>
					<li>Real-time as you type</li>
					<li>Best for interactive filtering</li>
				</ul>
			</div>

			<div>
				<h3><code>searchNodes()</code> (Method)</h3>
				<ul>
					<li>Returns array of matching nodes</li>
					<li>Does not modify tree display</li>
					<li>Use for custom result handling</li>
					<li>Combine with scrollToPath()</li>
					<li>Best for search-and-navigate UX</li>
				</ul>
			</div>
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
	li {
		padding: 0.25rem 0;
	}
</style>
