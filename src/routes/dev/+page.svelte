<script lang="ts">
	import { Tree } from '$lib/index.js';

	// Sample data for development
	const sampleData = [
		{ id: '1', path: '1', name: 'Documents', type: 'folder', description: 'Main documents folder' },
		{ id: '1.1', path: '1.1', name: 'Projects', type: 'folder', description: 'Project files' },
		{ id: '1.1.1', path: '1.1.1', name: 'Project A', type: 'project', description: 'Web application project' },
		{ id: '1.1.2', path: '1.1.2', name: 'Project B', type: 'project', description: 'Mobile app project' },
		{ id: '1.1.3', path: '1.1.3', name: 'report.pdf', type: 'file', description: 'Project status report' },
		{ id: '1.2', path: '1.2', name: 'Templates', type: 'folder', description: 'Document templates' },
		{ id: '1.2.1', path: '1.2.1', name: 'invoice.docx', type: 'file', description: 'Invoice template' },
		{ id: '2', path: '2', name: 'Pictures', type: 'folder', description: 'Image files' },
		{ id: '2.1', path: '2.1', name: 'Vacation', type: 'folder', description: 'Vacation photos' },
		{ id: '2.1.1', path: '2.1.1', name: 'beach.jpg', type: 'file', description: 'Beach photo' },
		{ id: '3', path: '3', name: 'Music', type: 'folder', description: 'Audio files' }
	];

	// Windows file system with real paths
	const fileSystemData = [
		{ id: 'fs1', path: 'C:', name: 'C:', type: 'drive', size: null },
		{ id: 'fs2', path: 'C:\\Users', name: 'Users', type: 'folder', size: null },
		{ id: 'fs3', path: 'C:\\Users\\Bob', name: 'Bob', type: 'folder', size: null },
		{ id: 'fs4', path: 'C:\\Users\\Bob\\Documents', name: 'Documents', type: 'folder', size: null },
		{ id: 'fs5', path: 'C:\\Users\\Bob\\Documents\\Report.pdf', name: 'Report.pdf', type: 'file', size: '2.3 MB' },
		{ id: 'fs6', path: 'C:\\Users\\Bob\\Documents\\Budget.xlsx', name: 'Budget.xlsx', type: 'file', size: '856 KB' },
		{ id: 'fs7', path: 'C:\\Users\\Bob\\Pictures', name: 'Pictures', type: 'folder', size: null },
		{ id: 'fs8', path: 'C:\\Users\\Bob\\Pictures\\Vacation.jpg', name: 'Vacation.jpg', type: 'file', size: '3.2 MB' },
		{ id: 'fs9', path: 'C:\\Users\\Alice', name: 'Alice', type: 'folder', size: null },
		{ id: 'fs10', path: 'C:\\Users\\Alice\\Desktop', name: 'Desktop', type: 'folder', size: null }
	];

	// Generate large dataset for performance testing
	function generateLargeDataset(nodeCount: number = 1000) {
		const data = [];
		let id = 1;

		// Generate hierarchical data: root -> categories -> subcategories -> items
		for (let root = 1; root <= Math.ceil(nodeCount / 100); root++) {
			data.push({
				id: `${id++}`,
				path: `${root}`,
				name: `Category ${root}`,
				type: 'category',
				description: `Root category ${root}`
			});

			for (let cat = 1; cat <= 10 && data.length < nodeCount; cat++) {
				data.push({
					id: `${id++}`,
					path: `${root}.${cat}`,
					name: `Subcategory ${root}.${cat}`,
					type: 'subcategory',
					description: `Subcategory under Category ${root}`
				});

				for (let item = 1; item <= 10 && data.length < nodeCount; item++) {
					data.push({
						id: `${id++}`,
						path: `${root}.${cat}.${item}`,
						name: `Item ${root}.${cat}.${item}`,
						type: 'item',
						description: `Item in subcategory ${root}.${cat}`
					});

					// Add some deeper levels
					for (let sub = 1; sub <= 3 && data.length < nodeCount; sub++) {
						data.push({
							id: `${id++}`,
							path: `${root}.${cat}.${item}.${sub}`,
							name: `Detail ${root}.${cat}.${item}.${sub}`,
							type: 'detail',
							description: `Detail level item`
						});
					}
				}
			}
		}

		return data.slice(0, nodeCount);
	}

	// Tree configuration
	let currentExample = $state('basic'); // 'basic' or 'filesystem' or 'large'
	let data: any[] = $state(sampleData);
	let idMember = $state('id');
	let pathMember = $state('path');
	let displayValueMember = $state('name');
	let expandLevel = $state(2);
	let searchText = $state('');
	let selectedNode = $state(null);
	let treePathSeparator = $state('.');

	// Custom sort callback for basic example
	const sortCallback = (items: any[]) => {
		return items.sort((a, b) => {
			// First, sort by level (calculated from path depth)
			const aLevel = a.path ? a.path.split('.').length : 0;
			const bLevel = b.path ? b.path.split('.').length : 0;
			if (aLevel !== bLevel) {
				return aLevel - bLevel;
			}

			// Then folders first, then files
			if (a.data.type !== b.data.type) {
				if (a.data.type === 'folder') return -1;
				if (b.data.type === 'folder') return 1;
			}
			return a.data.name.localeCompare(b.data.name);
		});
	};

	// File system sort callback
	const sortCallbackFileSystem = (items: any[]) => {
		return items.sort((a, b) => {
			// First, sort by level (calculated from path depth with backslash separator)
			const aLevel = a.path ? a.path.split('\\').length : 0;
			const bLevel = b.path ? b.path.split('\\').length : 0;
			if (aLevel !== bLevel) {
				return aLevel - bLevel;
			}

			// Then drive first, then folders, then files
			const typeOrder: Record<string, number> = { drive: 0, folder: 1, file: 2 };
			const aOrder = typeOrder[a.data.type] ?? 3;
			const bOrder = typeOrder[b.data.type] ?? 3;

			if (aOrder !== bOrder) {
				return aOrder - bOrder;
			}
			return a.data.name.localeCompare(b.data.name);
		});
	};

	// Switch between examples
	function switchExample(example: string) {
		currentExample = example;
		selectedNode = null;
		searchText = '';

		if (example === 'filesystem') {
			treePathSeparator = '\\';        // Set separator FIRST
			expandLevel = 5;
			data = fileSystemData;           // Set data LAST to trigger effect with correct separator
		} else if (example === 'large') {
			treePathSeparator = '.';         // Set separator FIRST
			expandLevel = 2; // Only show levels 1-2 initially
			data = generateLargeDataset(2000); // Set data LAST
		} else {
			treePathSeparator = '.';         // Set separator FIRST
			expandLevel = 2;
			data = sampleData;               // Set data LAST
		}
	}

	function onNodeClick(node: any) {
		console.log('Node clicked:', node);
	}

	// Debug function to test separator values
	function debugSeparator() {
		console.log('=== SEPARATOR DEBUG ===');
		console.log('treePathSeparator value:', treePathSeparator);
		console.log('treePathSeparator length:', treePathSeparator.length);
		console.log('treePathSeparator charCodeAt(0):', treePathSeparator.charCodeAt(0));
		if (treePathSeparator.length > 1) {
			console.log('treePathSeparator charCodeAt(1):', treePathSeparator.charCodeAt(1));
		}
		console.log('JSON.stringify(treePathSeparator):', JSON.stringify(treePathSeparator));
		console.log('=======================');
	}
</script>

<div class="container-fluid p-4">
	<h1>Development Page</h1>
	<p class="text-muted">Development and testing page for the svelte-treeview component.</p>

	<div class="mb-4">
		<span class="me-2">Other dev pages:</span>
		<a href="/dev/context-menu" class="btn btn-sm btn-outline-secondary me-1">Context Menu</a>
		<a href="/dev/logging" class="btn btn-sm btn-outline-secondary me-1">Logging</a>
	</div>

	<div class="row mt-4">
		<div class="col-md-8">
			<div class="card">
				<div class="card-header">
					<h3 class="card-title mb-0">Tree Component</h3>
				</div>
				<div class="card-body">
					<Tree
						{data}
						{idMember}
						{pathMember}
						{displayValueMember}
						sortCallback={currentExample === 'filesystem' ? sortCallbackFileSystem : sortCallback}
						{expandLevel}
						{treePathSeparator}
						isSorted={false}
						bind:selectedNode
						bind:searchText
						shouldUseInternalSearchIndex={true}
						shouldDisplayDebugInformation={true}
						clickBehavior="expand-and-focus"
						{onNodeClick}
					>
						{#snippet nodeTemplate(node: any)}
							<div class="d-flex align-items-center">
								<span class="me-2">
									{#if node.data.type === 'drive'}💿
									{:else if node.data.type === 'folder'}📁
									{:else if node.data.type === 'project'}💼
									{:else if node.data.type === 'file'}📄
									{:else}📄{/if}
								</span>
								<div>
									<div class="fw-medium">{node.data.name}</div>
									{#if currentExample === 'basic' && node.data.description}
										<small class="text-muted">{node.data.description}</small>
									{:else if currentExample === 'filesystem' && node.data.size}
										<small class="text-muted">{node.data.size}</small>
									{/if}
								</div>
							</div>
						{/snippet}
					</Tree>
				</div>
			</div>
		</div>

		<div class="col-md-4">
			<div class="card mb-3">
				<div class="card-header">
					<h5 class="card-title mb-0">Controls</h5>
				</div>
				<div class="card-body">
					<div class="mb-3">
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="form-label">Example</label>
						<div class="btn-group w-100" role="group">
							<button
								type="button"
								class="btn btn-sm"
								class:btn-primary={currentExample === 'basic'}
								class:btn-outline-primary={currentExample !== 'basic'}
								onclick={() => switchExample('basic')}
							>
								Basic Tree
							</button>
							<button
								type="button"
								class="btn btn-sm"
								class:btn-primary={currentExample === 'filesystem'}
								class:btn-outline-primary={currentExample !== 'filesystem'}
								onclick={() => switchExample('filesystem')}
							>
								File System
							</button>
							<button
								type="button"
								class="btn btn-sm"
								class:btn-primary={currentExample === 'large'}
								class:btn-outline-primary={currentExample !== 'large'}
								onclick={() => switchExample('large')}
							>
								Large Dataset
							</button>
						</div>
					</div>

					<div class="mb-3">
						<label class="form-label" for="dev-search">Search</label>
						<input
							id="dev-search"
							type="text"
							class="form-control form-control-sm"
							bind:value={searchText}
							placeholder="Search nodes..."
						>
					</div>

					<div class="mb-3">
						<label class="form-label" for="dev-separator">Path Separator</label>
						<select id="dev-separator" class="form-select form-select-sm" bind:value={treePathSeparator}>
							<option value=".">Dot (.)</option>
							<option value="/">Slash (/)</option>
							<option value="\\">Backslash (\)</option>
							<option value="::">Double Colon (::)</option>
						</select>
					</div>

					<div class="mb-3">
						<label class="form-label" for="dev-expand-level">Expand Level</label>
						<input
							id="dev-expand-level"
							type="number"
							class="form-control form-control-sm"
							bind:value={expandLevel}
							min="0"
							max="5"
						>
					</div>

					<div class="mb-3">
						<button
							type="button"
							class="btn btn-sm btn-outline-info w-100"
							onclick={debugSeparator}
						>
							Debug Separator
						</button>
					</div>
				</div>
			</div>

			<div class="card">
				<div class="card-header">
					<h5 class="card-title mb-0">Selected Node</h5>
				</div>
				<div class="card-body">
					{#if selectedNode}
						<pre class="bg-light p-2 rounded small"><code>{JSON.stringify(selectedNode, null, 2)}</code></pre>
					{:else}
						<p class="text-muted small">No node selected</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>