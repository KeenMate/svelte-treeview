<script lang="ts">
	import { Tree } from '$lib/index.js';
	import ShowcaseSection from '../ShowcaseSection.svelte';
	
	// Sample data
	const sampleData = [
		{ id: '1', path: '1', name: 'Documents', type: 'folder', size: null },
		{ id: '1.1', path: '1.1', name: 'Projects', type: 'folder', size: null },
		{ id: '1.1.1', path: '1.1.1', name: 'Project A', type: 'folder', size: null },
		{ id: '1.1.2', path: '1.1.2', name: 'Project B', type: 'folder', size: null },
		{ id: '1.1.3', path: '1.1.3', name: 'report.pdf', type: 'file', size: '2.3 MB' },
		{ id: '1.2', path: '1.2', name: 'Templates', type: 'folder', size: null },
		{ id: '1.2.1', path: '1.2.1', name: 'invoice.docx', type: 'file', size: '45 KB' },
		{ id: '2', path: '2', name: 'Pictures', type: 'folder', size: null },
		{ id: '2.1', path: '2.1', name: 'Vacation', type: 'folder', size: null },
		{ id: '2.1.1', path: '2.1.1', name: 'beach.jpg', type: 'file', size: '1.8 MB' },
		{ id: '3', path: '3', name: 'Music', type: 'folder', size: null }
	];
	
	// Basic tree configuration
	let data = $state(sampleData);
	let idMember = $state('id');
	let pathMember = $state('path');
	let displayValueMember = $state('name');
	let expandLevel = $state(2);
	let shouldToggleOnNodeClick = $state(true);
	
	// Custom sort callback
	const sortCallback = (items: any[]) => {
		return items.sort((a, b) => {
			// Folders first, then files
			if (a.data.type !== b.data.type) {
				return a.data.type === 'folder' ? -1 : 1;
			}
			// Then by name
			return a.data.name.localeCompare(b.data.name);
		});
	};
</script>

<div class="container">
	<div class="row mb-4">
		<div class="col-12">
			<h1>Basic Tree Display</h1>
			<p class="lead">Learn the fundamental properties and behavior of the Svelte Treeview component.</p>
		</div>
	</div>

	<ShowcaseSection 
		title="Essential Properties" 
		subtitle="The minimum required configuration to display a tree">
		{#snippet demo()}
			<Tree 
				{data}
				{idMember}
				{pathMember}
				{displayValueMember}
				{expandLevel}
				{shouldToggleOnNodeClick}
				{sortCallback}
			/>
		{/snippet}
		
		{#snippet controls()}
			<div class="form-group mb-3">
				<label class="form-label">ID Member</label>
				<input 
					type="text" 
					class="form-control form-control-sm" 
					bind:value={idMember}
					placeholder="Property name for unique IDs"
				/>
			</div>
			
			<div class="form-group mb-3">
				<label class="form-label">Path Member</label>
				<input 
					type="text" 
					class="form-control form-control-sm" 
					bind:value={pathMember}
					placeholder="Property name for hierarchical paths"
				/>
			</div>
			
			<div class="form-group mb-3">
				<label class="form-label">Display Value Member</label>
				<input 
					type="text" 
					class="form-control form-control-sm" 
					bind:value={displayValueMember}
					placeholder="Property to display as node text"
				/>
			</div>
			
			<div class="form-group mb-3">
				<label class="form-label">Expand Level</label>
				<input 
					type="number" 
					class="form-control form-control-sm" 
					bind:value={expandLevel}
					min="0"
					max="5"
				/>
			</div>
			
			<div class="form-check">
				<input 
					class="form-check-input" 
					type="checkbox" 
					bind:checked={shouldToggleOnNodeClick}
					id="toggleCheck"
				/>
				<label class="form-check-label" for="toggleCheck">
					Toggle on Node Click
				</label>
			</div>
		{/snippet}
		
		{#snippet description()}
			<h6>Required Properties</h6>
			<p><code>data</code> - Array of objects with hierarchical structure</p>
			<p><code>idMember</code> - Property name for unique node identification</p>
			<p><code>pathMember</code> - Property defining hierarchical paths (e.g., "1", "1.1", "1.2.3")</p>
			<p><code>sortCallback</code> - Function to sort tree nodes</p>
			
			<h6>Display Properties</h6>
			<p><code>displayValueMember</code> - Which property to show as node text</p>
			<p><code>expandLevel</code> - Auto-expand nodes up to this depth (default: 2)</p>
			
			<h6>Behavior</h6>
			<p><code>shouldToggleOnNodeClick</code> - Click node to expand/collapse</p>
			
			<h6>Path Structure</h6>
			<p>Paths use dot notation: root nodes ("1", "2"), children ("1.1", "1.2"), grandchildren ("1.1.1"), etc.</p>
		{/snippet}
	</ShowcaseSection>

	<ShowcaseSection 
		title="Data Structure Examples" 
		subtitle="Different ways to structure your hierarchical data">
		{#snippet demo()}
			<div class="bg-dark text-light p-3 rounded" style="font-family: 'Courier New', monospace; font-size: 0.85rem;">
				<pre>{JSON.stringify(sampleData.slice(0, 6), null, 2)}</pre>
			</div>
		{/snippet}
		
		{#snippet controls()}
			<div class="form-group">
				<label class="form-label">Sample Data</label>
				<p class="text-muted small">This shows the structure of the data array used in the demo above.</p>
			</div>
		{/snippet}
		
		{#snippet description()}
			<h6>Path-Based Hierarchy</h6>
			<p>The tree uses paths to define relationships, not parent/child references.</p>
			
			<h6>Required Fields</h6>
			<p>Each data object must have properties matching your <code>idMember</code> and <code>pathMember</code> configuration.</p>
			
			<h6>Custom Fields</h6>
			<p>Add any custom properties (name, type, size, etc.) - they're accessible via <code>node.data</code></p>
			
			<h6>Path Examples</h6>
			<ul class="small">
				<li><code>"1"</code> - Root level node</li>
				<li><code>"1.1"</code> - Child of node "1"</li>
				<li><code>"1.1.1"</code> - Grandchild of node "1"</li>
			</ul>
		{/snippet}
	</ShowcaseSection>
</div>