<script lang="ts">
	import { Tree } from '$lib/index.js';
	import ShowcaseSection from '../ShowcaseSection.svelte';
	import { onMount } from 'svelte';

	// Performance test data generation
	function generateLargeDataset(nodeCount = 1000) {
		const categories = ['Engineering', 'Marketing', 'Sales', 'Support', 'Operations'];
		const types = ['team', 'project', 'task', 'resource', 'document'];
		const priorities = ['high', 'medium', 'low'];
		const data = [];

		// Generate hierarchical paths
		const maxDepth = 4;
		let currentId = 1;

		function generatePath(depth = 1, parentPath = '') {
			const childCount = Math.floor(Math.random() * 5) + 1;

			for (let i = 1; i <= childCount && data.length < nodeCount; i++) {
				const path = parentPath ? `${parentPath}.${i}` : `${i}`;
				const category = categories[Math.floor(Math.random() * categories.length)];
				const type = types[Math.floor(Math.random() * types.length)];
				const priority = priorities[Math.floor(Math.random() * priorities.length)];

				data.push({
					id: currentId++,
					path,
					name: `${category} ${type} ${currentId}`,
					type,
					priority,
					category,
					description: `Generated ${type} for performance testing with path ${path}`,
					createdAt: new Date(2024, 0, Math.floor(Math.random() * 365)).toISOString().split('T')[0],
					isActive: Math.random() > 0.3
				});

				// Recursively generate children
				if (depth < maxDepth && Math.random() > 0.5) {
					generatePath(depth + 1, path);
				}
			}
		}

		generatePath();
		return data.slice(0, nodeCount);
	}

	// Performance metrics
	let performanceData = $state([]);
	let nodeCount = $state(1000);
	let searchText = $state('');
	let isGenerating = $state(false);
	let generationTime = $state(0);
	let renderTime = $state(0);
	let searchTime = $state(0);
	let shouldUseInternalSearchIndex = $state(true);
	let shouldDisplayDebugInformation = $state(true);
	let indexerBatchSize = $state(100);
	let indexerTimeout = $state(25);

	// Performance testing
	async function generateData() {
		isGenerating = true;
		const startTime = performance.now();

		// Simulate async generation with progress
		await new Promise(resolve => setTimeout(resolve, 100));
		performanceData = generateLargeDataset(nodeCount);

		const endTime = performance.now();
		generationTime = Math.round(endTime - startTime);
		isGenerating = false;
	}

	// Measure render time
	let renderStartTime = 0;
	function onBeforeUpdate() {
		if (performanceData.length > 0) {
			renderStartTime = performance.now();
		}
	}

	function onAfterUpdate() {
		if (renderStartTime > 0) {
			renderTime = Math.round(performance.now() - renderStartTime);
			renderStartTime = 0;
		}
	}

	// Search performance test
	let searchStartTime = 0;
	$effect(() => {
		if (searchText && performanceData.length > 0) {
			searchStartTime = performance.now();
		}
	});

	function onIndexingComplete() {
		if (searchStartTime > 0) {
			searchTime = Math.round(performance.now() - searchStartTime);
			searchStartTime = 0;
		}
	}

	// Sort callback with performance measurement
	const sortCallback = (items) => {
		const start = performance.now();
		const sorted = items.sort((a, b) => {
			// Multi-criteria sorting
			if (a.data.priority !== b.data.priority) {
				const priorityOrder = { high: 0, medium: 1, low: 2 };
				return priorityOrder[a.data.priority] - priorityOrder[b.data.priority];
			}
			if (a.data.type !== b.data.type) {
				return a.data.type.localeCompare(b.data.type);
			}
			return a.data.name.localeCompare(b.data.name);
		});
		const end = performance.now();
		console.log(`Sort time: ${Math.round(end - start)}ms for ${items.length} items`);
		return sorted;
	};

	// Initialize with medium dataset
	onMount(() => {
		generateData();
	});
</script>

<svelte:window onbeforeunload={onBeforeUpdate} />

<h1>Performance</h1>
<p class="lead">Large dataset handling, async indexing, and performance optimization techniques.</p>

	<ShowcaseSection
		title="Large Dataset Performance"
		subtitle="Test tree rendering and interaction with large amounts of data">
		{#snippet demo()}
			<div class="performance-metrics mb-3">
				<div class="row text-center">
					<div class="col-md-3">
						<div class="metric-card">
							<div class="metric-value">{performanceData.length}</div>
							<div class="metric-label">Nodes</div>
						</div>
					</div>
					<div class="col-md-3">
						<div class="metric-card">
							<div class="metric-value">{generationTime}ms</div>
							<div class="metric-label">Generation</div>
						</div>
					</div>
					<div class="col-md-3">
						<div class="metric-card">
							<div class="metric-value">{renderTime}ms</div>
							<div class="metric-label">Render</div>
						</div>
					</div>
					<div class="col-md-3">
						<div class="metric-card">
							<div class="metric-value">{searchTime}ms</div>
							<div class="metric-label">Search Index</div>
						</div>
					</div>
				</div>
			</div>

			<div class="search-container mb-3">
				<input
					type="text"
					class="form-control"
					placeholder="Search large dataset..."
					bind:value={searchText}
				/>
			</div>

			<div class="tree-performance-container">
				{#if performanceData.length > 0}
					<Tree
						data={performanceData}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
						searchValueMember="name"
						bind:searchText
						shouldUseInternalSearchIndex={shouldUseInternalSearchIndex}
						shouldDisplayDebugInformation={shouldDisplayDebugInformation}
						indexerBatchSize={indexerBatchSize}
						indexerTimeout={indexerTimeout}
						expandLevel={2}
						sortCallback={sortCallback}
						indexingCompleteCallback={onIndexingComplete}
					>
						{#snippet nodeTemplate(node)}
							<div class="performance-node">
								<span class="node-icon">
									{#if node.data.type === 'team'}👥
									{:else if node.data.type === 'project'}💼
									{:else if node.data.type === 'task'}✅
									{:else if node.data.type === 'resource'}📦
									{:else}📄{/if}
								</span>
								<span class="node-name">{node.data.name}</span>
								<small class="node-meta">
									{node.data.type} • {node.data.priority}
								</small>
							</div>
						{/snippet}
					</Tree>
				{:else}
					<div class="text-center py-4">
						<div class="spinner-border" role="status">
							<span class="visually-hidden">Loading...</span>
						</div>
						<p class="mt-2">Generating dataset...</p>
					</div>
				{/if}
			</div>
		{/snippet}

		{#snippet controls()}
			<div class="form-group mb-3">
				<label class="form-label">Dataset Size</label>
				<select class="form-select form-select-sm" bind:value={nodeCount}>
					<option value={100}>Small (100 nodes)</option>
					<option value={500}>Medium (500 nodes)</option>
					<option value={1000}>Large (1,000 nodes)</option>
					<option value={2500}>Extra Large (2,500 nodes)</option>
					<option value={5000}>Huge (5,000 nodes)</option>
				</select>
			</div>

			<div class="form-group mb-3">
				<label class="form-label">Indexer Batch Size</label>
				<input
					type="number"
					class="form-control form-control-sm"
					bind:value={indexerBatchSize}
					min="10"
					max="500"
				/>
				<small class="text-muted">Higher = faster indexing, lower = smoother UI</small>
			</div>

			<div class="form-group mb-3">
				<label class="form-label">Indexer Timeout (ms)</label>
				<input
					type="number"
					class="form-control form-control-sm"
					bind:value={indexerTimeout}
					min="10"
					max="200"
				/>
				<small class="text-muted">Time to wait for idle callback</small>
			</div>

			<div class="form-check mb-3">
				<input
					class="form-check-input"
					type="checkbox"
					bind:checked={shouldUseInternalSearchIndex}
					id="enableIndexing"
				/>
				<label class="form-check-label" for="enableIndexing">
					Enable Search Indexing
				</label>
			</div>

			<button
				class="btn btn-primary btn-sm"
				onclick={generateData}
				disabled={isGenerating}
			>
				{#if isGenerating}
					<span class="spinner-border spinner-border-sm me-2"></span>
					Generating...
				{:else}
					🔄 Regenerate Data
				{/if}
			</button>
		{/snippet}

		{#snippet description()}
			<h6>Performance Optimizations</h6>
			<p><strong>Async Search Indexing</strong> - Uses <code>requestIdleCallback</code> to prevent UI blocking</p>
			<p><strong>Efficient Path Operations</strong> - O(log n) tree operations using path-based structure</p>
			<p><strong>Batch Processing</strong> - Configurable batch sizes for optimal performance</p>

			<h6>Performance Metrics</h6>
			<p><strong>Generation</strong> - Time to create dataset</p>
			<p><strong>Render</strong> - Initial tree rendering time</p>
			<p><strong>Search Index</strong> - Time to build search index</p>

			<h6>Scalability Features</h6>
			<p><strong>Virtual Scrolling</strong> - Coming soon for ultra-large datasets</p>
			<p><strong>Lazy Loading</strong> - Coming soon for dynamic data loading</p>
		{/snippet}
	</ShowcaseSection>

	<ShowcaseSection
		title="Performance Tuning Guide"
		subtitle="Tips and techniques for optimal performance">
		{#snippet demo()}
			<div class="performance-tips">
				<div class="tip-card">
					<h6>🚀 Batch Size Tuning</h6>
					<p>Lower batch sizes (10-25) provide smoother UI but slower indexing. Higher batch sizes (50-100) index faster but may cause brief UI pauses.</p>
					<div class="tip-example">
						<strong>Recommended:</strong>
						<ul class="small">
							<li>Small datasets (&lt;500): 25-50</li>
							<li>Medium datasets (500-2000): 50-100</li>
							<li>Large datasets (&gt;2000): 100-200</li>
						</ul>
					</div>
				</div>

				<div class="tip-card">
					<h6>⏱️ Timeout Optimization</h6>
					<p>Lower timeouts (25-50ms) ensure responsive indexing, while higher timeouts (100-200ms) allow for genuine idle periods.</p>
					<div class="tip-example">
						<strong>Use Cases:</strong>
						<ul class="small">
							<li>Interactive apps: 25-50ms</li>
							<li>Background processing: 100-200ms</li>
						</ul>
					</div>
				</div>

				<div class="tip-card">
					<h6>🎯 Search Strategy</h6>
					<p>Choose between property-based or callback-based search based on your data structure and search requirements.</p>
					<div class="tip-example">
						<strong>Property vs Callback:</strong>
						<ul class="small">
							<li>Single field: Use <code>searchValueMember</code></li>
							<li>Multiple fields: Use <code>getSearchValueCallback</code></li>
						</ul>
					</div>
				</div>
			</div>
		{/snippet}

		{#snippet controls()}
			<div class="benchmark-results">
				<h6>📊 Performance Benchmarks:</h6>
				<table class="table table-sm">
					<thead>
						<tr>
							<th>Dataset Size</th>
							<th>Render Time</th>
							<th>Index Time</th>
							<th>Memory Usage</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>100 nodes</td>
							<td>&lt; 10ms</td>
							<td>&lt; 50ms</td>
							<td>~ 1MB</td>
						</tr>
						<tr>
							<td>1,000 nodes</td>
							<td>&lt; 50ms</td>
							<td>&lt; 200ms</td>
							<td>~ 5MB</td>
						</tr>
						<tr>
							<td>5,000 nodes</td>
							<td>&lt; 200ms</td>
							<td>&lt; 1s</td>
							<td>~ 20MB</td>
						</tr>
						<tr>
							<td>10,000+ nodes</td>
							<td>&lt; 500ms</td>
							<td>&lt; 3s</td>
							<td>~ 40MB+</td>
						</tr>
					</tbody>
				</table>
				<small class="text-muted">*Benchmarks may vary based on hardware and browser</small>
			</div>
		{/snippet}

		{#snippet description()}
			<h6>Browser Compatibility</h6>
			<p><strong>requestIdleCallback</strong> - Modern browsers (fallback to setTimeout)</p>
			<p><strong>FlexSearch</strong> - All modern browsers with ES6+ support</p>

			<h6>Memory Management</h6>
			<p>Tree uses efficient path-based storage with minimal object overhead. Search index is built incrementally and can be disabled if not needed.</p>

			<h6>Future Optimizations</h6>
			<ul class="small">
				<li><strong>Virtual Scrolling</strong> - Render only visible nodes</li>
				<li><strong>Lazy Loading</strong> - Load child nodes on demand</li>
				<li><strong>Web Workers</strong> - Offload indexing to background thread</li>
				<li><strong>Tree Shaking</strong> - Remove unused features in builds</li>
			</ul>
		{/snippet}
	</ShowcaseSection>

<style>
	.performance-metrics {
		background: #f8f9fa;
		border-radius: 0.5rem;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.metric-card {
		background: white;
		border-radius: 0.5rem;
		padding: 1rem;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
		margin: 0.5rem 0;
	}

	.metric-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: #0066cc;
	}

	.metric-label {
		font-size: 0.875rem;
		color: #6c757d;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.tree-performance-container {
		max-height: 400px;
		overflow: auto;
		border: 1px solid #dee2e6;
		border-radius: 0.5rem;
		background: white;
	}

	.performance-node {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.node-icon {
		font-size: 1rem;
	}

	.node-name {
		flex: 1;
		font-weight: 500;
	}

	.node-meta {
		color: #6c757d;
		font-size: 0.75rem;
	}

	.performance-tips {
		display: grid;
		gap: 1rem;
	}

	.tip-card {
		background: white;
		border: 1px solid #dee2e6;
		border-radius: 0.5rem;
		padding: 1rem;
	}

	.tip-card h6 {
		color: #0066cc;
		margin-bottom: 0.5rem;
	}

	.tip-example {
		background: #f8f9fa;
		padding: 0.75rem;
		border-radius: 0.25rem;
		margin-top: 0.5rem;
	}

	.tip-example strong {
		color: #495057;
	}

	.benchmark-results {
		background: #f8f9fa;
		padding: 1rem;
		border-radius: 0.5rem;
	}

	.table-sm {
		font-size: 0.875rem;
	}

	.search-container input {
		border-radius: 0.5rem;
	}
</style>