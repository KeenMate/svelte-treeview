<script lang="ts">
	import { Tree } from '$lib';

	// Simple development data
	let sampleData = [
		{ id: '1', path: '1', name: 'Root Item 1' },
		{ id: '2', path: '1.1', name: 'Child 1.1' },
		{ id: '3', path: '1.2', name: 'Child 1.2' },
		{ id: '4', path: '1.1.1', name: 'Grandchild 1.1.1' },
		{ id: '5', path: '2', name: 'Root Item 2' },
		{ id: '6', path: '2.1', name: 'Child 2.1' }
	];

	let selectedNode = $state(null);
	let searchText = $state('');

	function sortCallback(items: any[]) {
		return items.sort((a, b) => {
			// First, sort by level (calculated from path depth)
			const aLevel = a.path ? a.path.split('.').length : 0;
			const bLevel = b.path ? b.path.split('.').length : 0;
			if (aLevel !== bLevel) {
				return aLevel - bLevel;
			}

			// Then sort alphabetically by name
			return a.data.name.localeCompare(b.data.name);
		});
	}
</script>

<div class="container-fluid p-4">
	<h1>Svelte Treeview Development</h1>
	<p class="text-muted">Simple development page for testing the treeview component.</p>

	<div class="row mt-4">
		<div class="col-md-6">
			<h3>Tree Component</h3>
			<div class="border p-3 rounded">
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					{sortCallback}
					bind:selectedNode
					bind:searchText
					expandLevel={2}
					shouldUseInternalSearchIndex={true}
					shouldDisplayDebugInformation={false}
				>
					{#snippet nodeTemplate(node)}
						<div class="d-flex align-items-center">
							<span>{node.data.name}</span>
						</div>
					{/snippet}
				</Tree>
			</div>
		</div>

		<div class="col-md-6">
			<h3>Controls</h3>

			<div class="mb-3">
				<label class="form-label">Search</label>
				<input
					type="text"
					class="form-control"
					bind:value={searchText}
					placeholder="Search nodes..."
				>
			</div>

			<div class="mb-3">
				<h5>Selected Node</h5>
				{#if selectedNode}
					<pre class="bg-light p-2 rounded"><code>{JSON.stringify(selectedNode, null, 2)}</code></pre>
				{:else}
					<p class="text-muted">No node selected</p>
				{/if}
			</div>

			<div class="mb-3">
				<h5>Sample Data Structure</h5>
				<pre class="bg-light p-2 rounded small"><code>{JSON.stringify(sampleData, null, 2)}</code></pre>
			</div>
		</div>
	</div>
</div>