<script lang="ts">
	import { Tree } from '$lib/index.js';
	import ShowcaseSection from '../ShowcaseSection.svelte';
	
	// Sample data with searchable content
	const searchableData = [
		{ id: '1', path: '1', name: 'Documents', type: 'folder', description: 'All company documents and files' },
		{ id: '1.1', path: '1.1', name: 'Projects', type: 'folder', description: 'Active project files and documentation' },
		{ id: '1.1.1', path: '1.1.1', name: 'Website Redesign', type: 'project', description: 'Complete redesign of company website with modern UI' },
		{ id: '1.1.2', path: '1.1.2', name: 'Mobile App Development', type: 'project', description: 'Native mobile application for iOS and Android' },
		{ id: '1.1.3', path: '1.1.3', name: 'Database Migration', type: 'project', description: 'Migration from MySQL to PostgreSQL database' },
		{ id: '1.2', path: '1.2', name: 'Reports', type: 'folder', description: 'Monthly and quarterly business reports' },
		{ id: '1.2.1', path: '1.2.1', name: 'Q4 Financial Report.pdf', type: 'file', description: 'Fourth quarter financial analysis and projections' },
		{ id: '1.2.2', path: '1.2.2', name: 'User Analytics Dashboard.xlsx', type: 'file', description: 'User behavior analytics and metrics dashboard' },
		{ id: '2', path: '2', name: 'Media Assets', type: 'folder', description: 'Images, videos, and other media files' },
		{ id: '2.1', path: '2.1', name: 'Marketing Images', type: 'folder', description: 'Images for marketing campaigns and social media' },
		{ id: '2.1.1', path: '2.1.1', name: 'Product Screenshots', type: 'folder', description: 'High-resolution product interface screenshots' },
		{ id: '2.1.2', path: '2.1.2', name: 'Logo Variations', type: 'folder', description: 'Company logo in different formats and colors' },
		{ id: '2.2', path: '2.2', name: 'Video Content', type: 'folder', description: 'Promotional and educational video content' },
		{ id: '2.2.1', path: '2.2.1', name: 'Tutorial Videos.mp4', type: 'file', description: 'Step-by-step user tutorials and guides' },
		{ id: '3', path: '3', name: 'Development', type: 'folder', description: 'Source code, documentation, and development resources' },
		{ id: '3.1', path: '3.1', name: 'Frontend Code', type: 'folder', description: 'React, Vue, and Svelte component libraries' },
		{ id: '3.2', path: '3.2', name: 'Backend API', type: 'folder', description: 'REST API endpoints and microservices architecture' },
		{ id: '3.3', path: '3.3', name: 'Documentation', type: 'folder', description: 'Technical documentation and API references' }
	];
	
	// Search configuration
	let searchText = $state('');
	let shouldUseInternalSearchIndex = $state(true);
	let searchValueMember = $state('name');
	let shouldDisplayDebugInformation = $state(true);
	let indexerBatchSize = $state(25);
	let indexerTimeout = $state(50);
	
	// Custom search callback example
	let useCustomCallback = $state(false);
	const getSearchValueCallback = (node: any) => {
		return `${node.data.name} ${node.data.description} ${node.data.type}`.toLowerCase();
	};
	
	// Sort callback
	const sortCallback = (items: any[]) => {
		return items.sort((a, b) => {
			if (a.data.type !== b.data.type) {
				const typeOrder = { folder: 0, project: 1, file: 2 };
				return (typeOrder[a.data.type as keyof typeof typeOrder] || 3) - 
					   (typeOrder[b.data.type as keyof typeof typeOrder] || 3);
			}
			return a.data.name.localeCompare(b.data.name);
		});
	};
</script>

<div class="container">
	<div class="row mb-4">
		<div class="col-12">
			<h1>Search & Filter</h1>
			<p class="lead">Explore async search indexing, filtering capabilities, and FlexSearch integration.</p>
		</div>
	</div>

	<ShowcaseSection 
		title="Async Search Indexing" 
		subtitle="Non-blocking search index building with requestIdleCallback">
		{#snippet demo()}
			<div class="mb-3">
				<input 
					type="text" 
					class="form-control" 
					placeholder="Search nodes..." 
					bind:value={searchText}
				/>
				{#if searchText}
					<small class="text-muted">Searching for: "{searchText}"</small>
				{/if}
			</div>
			
			<Tree 
				data={searchableData}
				idMember="id"
				pathMember="path"
				displayValueMember="name"
				searchValueMember={useCustomCallback ? null : searchValueMember}
				getSearchValueCallback={useCustomCallback ? getSearchValueCallback : undefined}
				bind:searchText
				shouldUseInternalSearchIndex={shouldUseInternalSearchIndex}
				shouldDisplayDebugInformation={shouldDisplayDebugInformation}
				indexerBatchSize={indexerBatchSize}
				indexerTimeout={indexerTimeout}
				expandLevel={2}
				sortCallback={sortCallback}
			>
				{#snippet nodeTemplate(node)}
					<div class="d-flex align-items-start">
						<span class="me-2">
							{#if node.data.type === 'folder'}📁
							{:else if node.data.type === 'project'}💼
							{:else if node.data.type === 'file'}📄
							{:else}📄{/if}
						</span>
						<div>
							<div class="fw-semibold">{node.data.name}</div>
							<small class="text-muted">{node.data.description}</small>
						</div>
					</div>
				{/snippet}
			</Tree>
		{/snippet}
		
		{#snippet controls()}
			<div class="form-check mb-3">
				<input 
					class="form-check-input" 
					type="checkbox" 
					bind:checked={shouldUseInternalSearchIndex}
					id="enableSearch"
				/>
				<label class="form-check-label" for="enableSearch">
					Enable Internal Search Index
				</label>
			</div>
			
			<div class="form-check mb-3">
				<input 
					class="form-check-input" 
					type="checkbox" 
					bind:checked={shouldDisplayDebugInformation}
					id="showDebug"
				/>
				<label class="form-check-label" for="showDebug">
					Show Debug Information
				</label>
			</div>
			
			<div class="form-group mb-3">
				<label class="form-label">Batch Size</label>
				<input 
					type="number" 
					class="form-control form-control-sm" 
					bind:value={indexerBatchSize}
					min="10"
					max="100"
				/>
				<small class="text-muted">Nodes processed per idle callback</small>
			</div>
			
			<div class="form-group mb-3">
				<label class="form-label">Indexer Timeout (ms)</label>
				<input 
					type="number" 
					class="form-control form-control-sm" 
					bind:value={indexerTimeout}
					min="25"
					max="200"
				/>
				<small class="text-muted">Max wait time for idle callback</small>
			</div>
		{/snippet}
		
		{#snippet description()}
			<h6>Async Search Indexing</h6>
			<p>Uses <code>requestIdleCallback</code> to build search index without blocking UI rendering.</p>
			
			<h6>Performance Benefits</h6>
			<p>Tree renders immediately while search indexing happens during browser idle time, preventing UI freezes with large datasets.</p>
			
			<h6>Required Configuration</h6>
			<p>Set <code>shouldUseInternalSearchIndex={true}</code> and provide either:</p>
			<ul class="small">
				<li><code>searchValueMember</code> - property name to index</li>
				<li><code>getSearchValueCallback</code> - custom search value function</li>
			</ul>
			
			<h6>Batch Processing</h6>
			<p><code>indexerBatchSize</code> controls processing speed vs UI responsiveness trade-off.</p>
		{/snippet}
	</ShowcaseSection>

	<ShowcaseSection 
		title="Search Value Configuration" 
		subtitle="Different approaches to define searchable content">
		{#snippet demo()}
			<div class="mb-3">
				<div class="form-check">
					<input 
						class="form-check-input" 
						type="radio" 
						bind:group={useCustomCallback}
						value={false}
						id="useProperty"
					/>
					<label class="form-check-label" for="useProperty">
						Search by Property: <code>searchValueMember</code>
					</label>
				</div>
				<div class="form-check">
					<input 
						class="form-check-input" 
						type="radio" 
						bind:group={useCustomCallback}
						value={true}
						id="useCallback"
					/>
					<label class="form-check-label" for="useCallback">
						Search by Callback: <code>getSearchValueCallback</code>
					</label>
				</div>
			</div>
			
			{#if !useCustomCallback}
				<div class="form-group mb-3">
					<label class="form-label">Search Value Member</label>
					<select class="form-select form-select-sm" bind:value={searchValueMember}>
						<option value="name">name</option>
						<option value="description">description</option>
						<option value="type">type</option>
					</select>
				</div>
			{/if}
			
			<div class="bg-light p-3 rounded">
				<h6>Current Configuration:</h6>
				{#if useCustomCallback}
					<code>getSearchValueCallback = (node) => `${node.data.name} ${node.data.description} ${node.data.type}`</code>
				{:else}
					<code>searchValueMember = "{searchValueMember}"</code>
				{/if}
			</div>
		{/snippet}
		
		{#snippet controls()}
			<div class="alert alert-info">
				<small>
					<strong>Try searching for:</strong><br>
					• "website" (name match)<br>
					• "financial" (description match)<br>
					• "folder" (type match)<br>
					• "tutorial" (description match)
				</small>
			</div>
		{/snippet}
		
		{#snippet description()}
			<h6>Property-Based Search</h6>
			<p><code>searchValueMember</code> - Index a specific property of each node's data.</p>
			
			<h6>Callback-Based Search</h6>
			<p><code>getSearchValueCallback</code> - Custom function to combine multiple fields or transform data before indexing.</p>
			
			<h6>Use Cases</h6>
			<ul class="small">
				<li><strong>Simple</strong>: Single property search (names, titles)</li>
				<li><strong>Complex</strong>: Multi-field search (name + description + tags)</li>
				<li><strong>Transformed</strong>: Search preprocessed data (normalized, concatenated)</li>
			</ul>
			
			<h6>FlexSearch Integration</h6>
			<p>Internally uses FlexSearch for fast, fuzzy matching with stemming and phonetic search capabilities.</p>
		{/snippet}
	</ShowcaseSection>
</div>