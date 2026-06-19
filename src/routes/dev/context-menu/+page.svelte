<script lang="ts">
	import { Tree } from '$lib/index.js';
	import type { ContextMenuEntry } from '$lib/ltree/types.js';

	// Sample data for context menu testing
	const contextMenuData = [
		{ id: '1', path: '1', name: 'Projects', type: 'folder', canEdit: true, canDelete: true },
		{ id: '1.1', path: '1.1', name: 'Web App', type: 'project', canEdit: true, canDelete: false },
		{ id: '1.1.1', path: '1.1.1', name: 'src', type: 'folder', canEdit: false, canDelete: false },
		{ id: '1.1.1.1', path: '1.1.1.1', name: 'main.js', type: 'file', canEdit: true, canDelete: true },
		{ id: '1.1.1.2', path: '1.1.1.2', name: 'style.css', type: 'file', canEdit: true, canDelete: true },
		{ id: '1.1.2', path: '1.1.2', name: 'package.json', type: 'file', canEdit: false, canDelete: false },
		{ id: '1.2', path: '1.2', name: 'Mobile App', type: 'project', canEdit: true, canDelete: true },
		{ id: '2', path: '2', name: 'Documents', type: 'folder', canEdit: true, canDelete: true },
		{ id: '2.1', path: '2.1', name: 'README.md', type: 'file', canEdit: true, canDelete: true },
		{ id: '2.2', path: '2.2', name: 'LICENSE', type: 'file', canEdit: false, canDelete: false }
	];

	// Tree configuration
	let selectedNode = $state(null);
	let searchText = $state('');
	let contextMenuXOffset = $state(8);
	let contextMenuYOffset = $state(0);
	let debugContextMenu = $state(false);

	// Second example data - more complex menu scenarios
	const advancedContextMenuData = [
		{ id: 'srv1', path: 'srv1', name: 'Production Server', type: 'server', status: 'running', canStart: false, canStop: true, canRestart: true },
		{ id: 'srv1.1', path: 'srv1.1', name: 'Web Service', type: 'service', status: 'running', canStart: false, canStop: true, canRestart: true },
		{ id: 'srv1.2', path: 'srv1.2', name: 'Database', type: 'database', status: 'running', canStart: false, canStop: false, canRestart: false, isReadOnly: true },
		{ id: 'srv1.3', path: 'srv1.3', name: 'Cache', type: 'service', status: 'stopped', canStart: true, canStop: false, canRestart: false },
		{ id: 'srv2', path: 'srv2', name: 'Development Server', type: 'server', status: 'stopped', canStart: true, canStop: false, canRestart: false },
		{ id: 'srv2.1', path: 'srv2.1', name: 'Test Service', type: 'service', status: 'stopped', canStart: true, canStop: false, canRestart: false },
	];

	// Advanced example configuration
	let selectedNode2 = $state(null);
	let searchText2 = $state('');
	let debugContextMenu2 = $state(false);


	// Sort callback
	const sortCallback = (items: any[]) => {
		return items.sort((a, b) => {
			// First, sort by level
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

	function onNodeClick(node: any) {
		console.log('Node clicked:', node);
	}

	function createContextMenu(node: any, closeMenuCallback: () => void): ContextMenuEntry[] {
		const menuItems: ContextMenuEntry[] = [];

		// Open action - always available
		menuItems.push({
			icon: '📂',
			label: 'Open',
			onclick: () => {
				alert(`Opening: ${node.data.name}`);
				closeMenuCallback(); // Close menu after action
			}
		});

		// Edit action - conditional
		if (node.data.canEdit) {
			menuItems.push({
				icon: '✏️',
				label: 'Edit',
				onclick: () => {
					alert(`Editing: ${node.data.name}`);
					closeMenuCallback();
				}
			});
		}

		// Delete action - conditional
		if (node.data.canDelete) {
			menuItems.push({
				icon: '🗑️',
				label: 'Delete',
				className: 'danger',
				onclick: () => {
					if (confirm(`Delete "${node.data.name}"?`)) {
						alert(`Deleted: ${node.data.name}`);
						closeMenuCallback(); // Close after successful action
					}
					// Note: Don't close if user cancelled - let them try again or click elsewhere
				}
			});
		}

		// Divider
		menuItems.push({ divider: true });

		// Copy action - always available (async example)
		menuItems.push({
			icon: '📋',
			label: 'Copy',
			onclick: async () => {
				// Simulate async operation
				await new Promise(resolve => setTimeout(resolve, 1000));
				alert(`Copied: ${node.data.name}`);
				closeMenuCallback(); // Close after async operation completes
			}
		});

		// New folder/file actions - only for folders and projects
		if (node.data.type === 'folder' || node.data.type === 'project') {
			menuItems.push({ divider: true });

			menuItems.push({
				icon: '📁',
				label: 'New Folder',
				onclick: async () => {
					const name = prompt('New folder name:');
					if (name) {
						try {
							// Simulate async API call
							await new Promise((resolve, reject) => {
								setTimeout(() => {
									// Simulate occasional failure
									if (Math.random() > 0.8) {
										reject(new Error('Server error: Failed to create folder'));
									} else {
										resolve(null);
									}
								}, 800);
							});
							alert(`Successfully created folder "${name}" in ${node.data.name}`);
							closeMenuCallback(); // Close on success
						} catch (error: any) {
							alert(`Failed to create folder: ${error.message}`);
							// Menu stays open on error so user can try again
						}
					}
					// Don't close if user cancelled
				}
			});

			menuItems.push({
				icon: '📄',
				label: 'New File',
				onclick: () => {
					const name = prompt('New file name:');
					if (name) {
						alert(`Creating new file "${name}" in ${node.data.name}`);
					}
				}
			});
		}

		// Divider
		menuItems.push({ divider: true });

		// Properties action - always available
		menuItems.push({
			icon: 'ℹ️',
			label: 'Properties',
			onclick: () => alert(`Properties of: ${node.data.name}\nType: ${node.data.type}\nPath: ${node.path}`)
		});

		return menuItems;
	}

	// Advanced context menu callback - demonstrates more complex scenarios
	function createAdvancedContextMenu(node: any, closeMenuCallback: () => void): ContextMenuEntry[] {
		const menuItems: ContextMenuEntry[] = [];

		// Status-based actions
		if (node.data.status === 'running') {
			menuItems.push({
				icon: '🔴',
				label: 'Stop',
				isDisabled: !node.data.canStop,
				onclick: () => {
					alert(`Stopping ${node.data.name}`);
					closeMenuCallback();
				}
			});

			if (node.data.canRestart) {
				menuItems.push({
					icon: '🔄',
					label: 'Restart',
					onclick: () => alert(`Restarting ${node.data.name}`)
				});
			}
		} else {
			menuItems.push({
				icon: '🟢',
				label: 'Start',
				isDisabled: !node.data.canStart,
				onclick: () => alert(`Starting ${node.data.name}`)
			});
		}

		// Type-specific actions
		if (node.data.type === 'server') {
			menuItems.push({ divider: true });

			menuItems.push({
				icon: '⚙️',
				label: 'Configuration',
				onclick: () => alert(`Opening configuration for ${node.data.name}`)
			});

			menuItems.push({
				icon: '📊',
				label: 'Metrics',
				onclick: () => alert(`Viewing metrics for ${node.data.name}`)
			});

			menuItems.push({
				icon: '📋',
				label: 'Logs',
				onclick: () => alert(`Viewing logs for ${node.data.name}`)
			});
		}

		if (node.data.type === 'database') {
			menuItems.push({ divider: true });

			menuItems.push({
				icon: '💾',
				label: 'Backup',
				onclick: async () => {
					try {
						// Simulate long-running backup operation
						alert(`Starting backup of ${node.data.name}...`);
						await new Promise(resolve => setTimeout(resolve, 2000));
						alert(`Backup completed successfully for ${node.data.name}`);
						closeMenuCallback(); // Close after successful backup
					} catch (error: any) {
						alert(`Backup failed: ${error.message}`);
						// Menu stays open so user can retry
					}
				}
			});

			menuItems.push({
				icon: '🔍',
				label: 'Query Console',
				isDisabled: node.data.isReadOnly,
				onclick: () => alert(`Opening query console for ${node.data.name}`)
			});
		}

		if (node.data.type === 'service') {
			menuItems.push({ divider: true });

			menuItems.push({
				icon: '🔧',
				label: 'Health Check',
				onclick: () => alert(`Running health check for ${node.data.name}`)
			});
		}

		// Common actions
		menuItems.push({ divider: true });

		menuItems.push({
			icon: '📈',
			label: 'Monitor',
			onclick: () => alert(`Monitoring ${node.data.name}`)
		});

		menuItems.push({
			icon: 'ℹ️',
			label: 'Properties',
			onclick: () => alert(`Properties:\nName: ${node.data.name}\nType: ${node.data.type}\nStatus: ${node.data.status}\nPath: ${node.path}`)
		});

		return menuItems;
	}
</script>


<div class="container-fluid p-4">
	<h1>Context Menu Development</h1>
	<p class="text-muted">Testing context menu functionality for tree nodes.</p>

	<div class="row mt-4">
		<div class="col-md-8">
			<div class="card">
				<div class="card-header">
					<h3 class="card-title mb-0">Tree with Context Menu</h3>
				</div>
				<div class="card-body">
					<Tree
						data={contextMenuData}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
						searchValueMember="name"
						{sortCallback}
						expandLevel={3}
						treePathSeparator="."
						bind:focusedNode={selectedNode}
						bind:searchText
						shouldUseInternalSearchIndex={true}
						shouldDisplayDebugInformation={true}
						clickBehavior="expand-and-focus"
						{onNodeClick}
						{contextMenuXOffset}
						{contextMenuYOffset}
						getContextMenuItemsCallback={createContextMenu}
						shouldDisplayContextMenuInDebugMode={debugContextMenu}
					>
						{#snippet nodeTemplate(node: any)}
							<div class="d-flex align-items-center context-menu-target">
								<span class="me-2">
									{#if node.data.type === 'folder'}📁
									{:else if node.data.type === 'project'}💼
									{:else if node.data.type === 'file'}📄
									{:else}📄{/if}
								</span>
								<div>
									<div class="fw-medium">{node.data.name}</div>
									<small class="text-muted">
										Type: {node.data.type} |
										Edit: {node.data.canEdit ? '✓' : '✗'} |
										Delete: {node.data.canDelete ? '✓' : '✗'}
									</small>
								</div>
							</div>
						{/snippet}
					</Tree>
				</div>
			</div>

			<!-- Artificial content to create scroll -->
			<div class="card mt-3">
				<div class="card-header">
					<h5 class="card-title mb-0">Test Scroll Area</h5>
				</div>
				<div class="card-body" style="height: 800px; background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);">
					<p class="text-muted">This is a large div to test scroll behavior with context menu.</p>
					<div class="mt-4 p-3 bg-white rounded">
						<h6>Scroll Test Instructions:</h6>
						<ol>
							<li>Right-click on any tree node above to open context menu</li>
							<li>While the context menu is open, scroll this page up or down</li>
							<li>The context menu should disappear immediately when scrolling</li>
						</ol>
					</div>
					<div class="mt-4 p-3 bg-white rounded">
						<p>Additional content to ensure scrolling...</p>
						<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
						<p>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
					</div>
					<div class="mt-4 p-3 bg-white rounded">
						<p>More content...</p>
						<p>Ut enim ad minim veniam, quis nostrud exercitation ullamco.</p>
					</div>
					<div class="mt-auto text-center text-muted">
						<p>↓ Scroll down for more ↓</p>
					</div>
				</div>
			</div>

			<!-- Even more content below -->
			<div class="card mt-3">
				<div class="card-body" style="height: 600px; background: linear-gradient(180deg, #e9ecef 0%, #dee2e6 100%);">
					<h5 class="card-title">Bottom Test Area</h5>
					<p>This ensures there's plenty of room to scroll.</p>
					<div class="mt-4">
						<p>You can scroll back up to the tree and test the context menu behavior multiple times.</p>
					</div>
				</div>
			</div>
		</div>

		<div class="col-md-4">
			<div class="card mb-3">
				<div class="card-header">
					<h5 class="card-title mb-0">Instructions</h5>
				</div>
				<div class="card-body">
					<ul class="small">
						<li><strong>Right-click</strong> on any tree node to open context menu</li>
						<li>Menu items are generated dynamically via <code>getContextMenuItemsCallback</code></li>
						<li>Different nodes have different permissions (edit/delete)</li>
						<li>Context menu actions show alerts for demonstration</li>
						<li>Menu position includes configurable X/Y offset</li>
						<li><strong>Click outside</strong> or <strong>scroll</strong> to close menu</li>
					</ul>
				</div>
			</div>

			<div class="card mb-3">
				<div class="card-header">
					<h5 class="card-title mb-0">Search</h5>
				</div>
				<div class="card-body">
					<input
						type="text"
						class="form-control form-control-sm"
						bind:value={searchText}
						placeholder="Search nodes..."
					>
				</div>
			</div>

			<div class="card mb-3">
				<div class="card-header">
					<h5 class="card-title mb-0">Context Menu Offset</h5>
				</div>
				<div class="card-body">
					<div class="mb-3">
						<label class="form-label">X Offset (px)
						<input
							type="number"
							class="form-control form-control-sm"
							bind:value={contextMenuXOffset}
							min="-50"
							max="50"
						>
						<small class="form-text text-muted">Horizontal offset from click position (default: 8px)</small>
						</label>
					</div>

					<div class="mb-3">
						<label class="form-label">Y Offset (px)
						<input
							type="number"
							class="form-control form-control-sm"
							bind:value={contextMenuYOffset}
							min="-50"
							max="50"
						>
						<small class="form-text text-muted">Vertical offset from click position (default: 0px)</small>
						</label>
					</div>

					<div class="mb-3">
						<div class="form-check">
							<input
								type="checkbox"
								class="form-check-input"
								bind:checked={debugContextMenu}
								id="debugContextMenu"
							>
							<label class="form-check-label" for="debugContextMenu">
								Debug Context Menu
							</label>
						</div>
						<small class="form-text text-muted">Shows context menu at fixed position relative to tree (200px right, 100px down)</small>
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

	<!-- Second Example - Advanced Context Menu -->
	<div class="row mt-5">
		<div class="col-12">
			<hr>
			<h2>Advanced Context Menu Example</h2>
			<p class="text-muted">Server management scenario with status-based and type-specific menu items, including disabled states.</p>
		</div>
	</div>

	<div class="row mt-3">
		<div class="col-md-8">
			<div class="card">
				<div class="card-header">
					<h3 class="card-title mb-0">Server Management Tree</h3>
				</div>
				<div class="card-body">
					<Tree
						data={advancedContextMenuData}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
						searchValueMember="name"
						{sortCallback}
						expandLevel={3}
						treePathSeparator="."
						bind:focusedNode={selectedNode2}
						bind:searchText={searchText2}
						shouldUseInternalSearchIndex={true}
						shouldDisplayDebugInformation={false}
						clickBehavior="expand-and-focus"
						{onNodeClick}
						{contextMenuXOffset}
						{contextMenuYOffset}
						getContextMenuItemsCallback={createAdvancedContextMenu}
						shouldDisplayContextMenuInDebugMode={debugContextMenu2}
					>
						{#snippet nodeTemplate(node: any)}
							<div class="d-flex align-items-center context-menu-target">
								<span class="me-2">
									{#if node.data.type === 'server'}🖥️
									{:else if node.data.type === 'service'}⚙️
									{:else if node.data.type === 'database'}🗄️
									{:else}📄{/if}
								</span>
								<div class="flex-grow-1">
									<div class="fw-medium">
										{node.data.name}
										{#if node.data.status === 'running'}
											<span class="badge bg-success ms-2">Running</span>
										{:else}
											<span class="badge bg-secondary ms-2">Stopped</span>
										{/if}
									</div>
									<small class="text-muted">
										Type: {node.data.type} |
										{#if node.data.isReadOnly}Read-only |{/if}
										Actions:
										{#if node.data.canStart}Start{/if}
										{#if node.data.canStop}{#if node.data.canStart} |{/if} Stop{/if}
										{#if node.data.canRestart}{#if node.data.canStart || node.data.canStop} |{/if} Restart{/if}
									</small>
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
					<h5 class="card-title mb-0">Advanced Features</h5>
				</div>
				<div class="card-body">
					<ul class="small">
						<li><strong>Status-based menus</strong>: Running vs stopped services</li>
						<li><strong>Disabled items</strong>: Context-sensitive availability</li>
						<li><strong>Type-specific actions</strong>: Different actions per node type</li>
						<li><strong>Complex logic</strong>: Conditional menu generation</li>
						<li><strong>Rich icons</strong>: Visual menu item identification</li>
					</ul>
				</div>
			</div>

			<div class="card mb-3">
				<div class="card-header">
					<h5 class="card-title mb-0">Search</h5>
				</div>
				<div class="card-body">
					<input
						type="text"
						class="form-control form-control-sm"
						bind:value={searchText2}
						placeholder="Search servers/services..."
					>
				</div>
			</div>

			<div class="card mb-3">
				<div class="card-header">
					<h5 class="card-title mb-0">Debug Tools</h5>
				</div>
				<div class="card-body">
					<div class="form-check">
						<input
							type="checkbox"
							class="form-check-input"
							bind:checked={debugContextMenu2}
							id="debugContextMenu2"
						>
						<label class="form-check-label" for="debugContextMenu2">
							Debug Context Menu
						</label>
					</div>
					<small class="form-text text-muted">Shows context menu at fixed position relative to tree for styling development</small>
				</div>
			</div>

			<div class="card">
				<div class="card-header">
					<h5 class="card-title mb-0">Selected Node</h5>
				</div>
				<div class="card-body">
					{#if selectedNode2}
						<pre class="bg-light p-2 rounded small"><code>{JSON.stringify(selectedNode2, null, 2)}</code></pre>
					{:else}
						<p class="text-muted small">No node selected</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>


<style>
	.context-menu-target {
		cursor: pointer;
		border-radius: 4px;
		padding: 2px 4px;
		transition: background-color 0.1s ease;
	}

	.context-menu-target:hover {
		background-color: rgba(0, 0, 0, 0.05);
	}

	:global(.stv__context-menu) {
		position: fixed;
		background: white;
		border: 1px solid #ccc;
		border-radius: 4px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
		z-index: 1000;
		min-width: 150px;
		padding: 4px 0;
	}

</style>