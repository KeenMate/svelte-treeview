<script lang="ts">
	import { Tree } from '$lib/index.js';
	import ShowcaseSection from '../ShowcaseSection.svelte';

	// Sample data for file system simulation
	const fileSystemData = [
		{ id: '1', path: '1', name: '📁 My Documents', type: 'folder', canRename: true, canDelete: true, canCreateFolder: true },
		{ id: '1.1', path: '1.1', name: '📁 Projects', type: 'folder', canRename: true, canDelete: true, canCreateFolder: true },
		{ id: '1.1.1', path: '1.1.1', name: '📄 Report.docx', type: 'file', canRename: true, canDelete: true, canDuplicate: true, size: '2.4 MB' },
		{ id: '1.1.2', path: '1.1.2', name: '📊 Analysis.xlsx', type: 'file', canRename: true, canDelete: true, canDuplicate: true, size: '856 KB' },
		{ id: '1.2', path: '1.2', name: '📁 Images', type: 'folder', canRename: true, canDelete: true, canCreateFolder: true },
		{ id: '1.2.1', path: '1.2.1', name: '🖼️ photo1.jpg', type: 'image', canRename: true, canDelete: true, canDuplicate: true, size: '3.2 MB' },
		{ id: '1.2.2', path: '1.2.2', name: '🖼️ screenshot.png', type: 'image', canRename: true, canDelete: true, canDuplicate: true, size: '1.8 MB' },
		{ id: '2', path: '2', name: '📁 Shared', type: 'folder', canRename: false, canDelete: false, canCreateFolder: true },
		{ id: '2.1', path: '2.1', name: '📋 ReadMe.txt', type: 'file', canRename: false, canDelete: false, canDuplicate: true, size: '2 KB' }
	];

	// Action history for demo
	let actionHistory = $state([]);

	// Context menu actions
	function performAction(action, node) {
		const timestamp = new Date().toLocaleTimeString();
		actionHistory.unshift({
			id: Date.now(),
			action,
			item: node.data.name,
			timestamp
		});

		// Keep only last 10 actions
		if (actionHistory.length > 10) {
			actionHistory = actionHistory.slice(0, 10);
		}

		console.log(`${action} performed on: ${node.data.name}`);
	}

	// Sort callback
	const sortCallback = (items) => {
		return items.sort((a, b) => {
			// Folders first, then files
			if (a.data.type === 'folder' && b.data.type !== 'folder') return -1;
			if (a.data.type !== 'folder' && b.data.type === 'folder') return 1;
			return a.data.name.localeCompare(b.data.name);
		});
	};
</script>

<div class="container-fluid">
	<div class="row mb-4">
		<div class="col-12">
			<h1>Context Menus</h1>
			<p class="lead">Right-click context menus with customizable actions and templates.</p>
		</div>
	</div>

	<ShowcaseSection
		title="Basic Context Menu"
		subtitle="Right-click on any item to see the context menu">
		{#snippet demo()}
			<Tree
				data={fileSystemData}
				idMember="id"
				pathMember="path"
				displayValueMember="name"
				expandLevel={3}
				sortCallback={sortCallback}
			>
				{#snippet nodeTemplate(node)}
					<div class="d-flex align-items-center">
						<span class="me-2">{node.data.name}</span>
						{#if node.data.size}
							<small class="text-muted">({node.data.size})</small>
						{/if}
					</div>
				{/snippet}

				{#snippet contextMenu(node, closeMenu)}
					<div class="context-menu-custom">
						<div class="context-menu-header">
							<strong>{node.data.name}</strong>
							<small class="text-muted d-block">{node.data.type}</small>
						</div>

						<div class="context-menu-divider"></div>

						{#if node.data.canRename}
							<button
								class="context-menu-item"
								onclick={() => { performAction('Rename', node); closeMenu(); }}
							>
								✏️ Rename
							</button>
						{/if}

						{#if node.data.canDuplicate}
							<button
								class="context-menu-item"
								onclick={() => { performAction('Duplicate', node); closeMenu(); }}
							>
								📋 Duplicate
							</button>
						{/if}

						{#if node.data.type === 'folder' && node.data.canCreateFolder}
							<button
								class="context-menu-item"
								onclick={() => { performAction('Create Subfolder', node); closeMenu(); }}
							>
								📁 New Folder
							</button>
						{/if}

						{#if node.data.type !== 'folder'}
							<button
								class="context-menu-item"
								onclick={() => { performAction('Open', node); closeMenu(); }}
							>
								👁️ Open
							</button>

							<button
								class="context-menu-item"
								onclick={() => { performAction('Download', node); closeMenu(); }}
							>
								⬇️ Download
							</button>
						{/if}

						<div class="context-menu-divider"></div>

						<button
							class="context-menu-item"
							onclick={() => { performAction('Copy Path', node); closeMenu(); }}
						>
							🔗 Copy Path
						</button>

						<button
							class="context-menu-item"
							onclick={() => { performAction('Properties', node); closeMenu(); }}
						>
							ℹ️ Properties
						</button>

						{#if node.data.canDelete}
							<div class="context-menu-divider"></div>
							<button
								class="context-menu-item context-menu-danger"
								onclick={() => { performAction('Delete', node); closeMenu(); }}
							>
								🗑️ Delete
							</button>
						{/if}
					</div>
				{/snippet}
			</Tree>
		{/snippet}

		{#snippet controls()}
			<div class="mb-3">
				<h6>💡 Instructions:</h6>
				<ul class="small">
					<li>Right-click on any item to open context menu</li>
					<li>Different items have different available actions</li>
					<li>Some items have restricted permissions (Shared folder)</li>
					<li>Actions are logged in the history below</li>
				</ul>
			</div>

			<div class="action-history">
				<h6>📋 Action History:</h6>
				{#if actionHistory.length > 0}
					{#each actionHistory as action}
						<div class="alert alert-sm alert-info py-2">
							<small>
								<strong>{action.action}</strong> on "{action.item}"
								<br><span class="text-muted">{action.timestamp}</span>
							</small>
						</div>
					{/each}
				{:else}
					<div class="text-muted small">No actions yet - try right-clicking on items!</div>
				{/if}
			</div>
		{/snippet}

		{#snippet description()}
			<h6>Context Menu Slot</h6>
			<p>Use the <code>contextMenu</code> snippet to define custom menu content.</p>

			<h6>Menu Parameters</h6>
			<p><code>node</code> - The clicked node with all data and state</p>
			<p><code>closeMenu</code> - Function to close the menu after action</p>

			<h6>Dynamic Actions</h6>
			<p>Menu items can be shown/hidden based on node data properties and user permissions.</p>

			<h6>Event Handling</h6>
			<p>Context menu appears on right-click and automatically positions itself within viewport bounds.</p>
		{/snippet}
	</ShowcaseSection>

	<ShowcaseSection
		title="Conditional Menu Items"
		subtitle="Menu items based on node properties and permissions">
		{#snippet demo()}
			<div class="bg-light p-3 rounded">
				<h6>Permission Rules:</h6>
				<div class="row">
					<div class="col-md-6">
						<h6 class="small text-success">✅ Allowed Actions:</h6>
						<ul class="small">
							<li><strong>Files:</strong> Rename, Duplicate, Open, Download, Delete</li>
							<li><strong>Folders:</strong> Rename, Create Subfolder, Delete</li>
							<li><strong>All Items:</strong> Copy Path, Properties</li>
						</ul>
					</div>
					<div class="col-md-6">
						<h6 class="small text-danger">❌ Restricted Actions:</h6>
						<ul class="small">
							<li><strong>Shared folder:</strong> Cannot rename or delete</li>
							<li><strong>ReadMe.txt:</strong> Cannot rename or delete (protected)</li>
							<li><strong>Dynamic permissions</strong> based on data properties</li>
						</ul>
					</div>
				</div>
			</div>
		{/snippet}

		{#snippet controls()}
			<div class="code-example">
				<h6>Context Menu Template:</h6>
				<pre class="bg-dark text-light p-3 rounded small"><code>{`{#snippet contextMenu(node, closeMenu)}
  <div class="custom-menu">
    <!-- Dynamic menu items -->
    {#if node.data.canRename}
      <button onclick={() => {
        rename(node);
        closeMenu();
      }}>
        Rename
      </button>
    {/if}

    <!-- Conditional sections -->
    {#if node.data.type === 'folder'}
      <button onclick={() => {
        createFolder(node);
        closeMenu();
      }}>
        New Folder
      </button>
    {/if}
  </div>
{/snippet}`}</code></pre>
			</div>
		{/snippet}

		{#snippet description()}
			<h6>Conditional Rendering</h6>
			<p>Use Svelte's <code>&#123;#if&#125;</code> blocks to show/hide menu items based on:</p>
			<ul class="small">
				<li>Node data properties (<code>canRename</code>, <code>canDelete</code>)</li>
				<li>Node type (<code>folder</code>, <code>file</code>)</li>
				<li>User roles and permissions</li>
				<li>Application state</li>
			</ul>

			<h6>Menu Styling</h6>
			<p>Fully customizable with CSS classes and Bootstrap components.</p>

			<h6>Action Integration</h6>
			<p>Context menu actions can trigger:</p>
			<ul class="small">
				<li>State updates</li>
				<li>API calls</li>
				<li>Modal dialogs</li>
				<li>Navigation</li>
			</ul>
		{/snippet}
	</ShowcaseSection>
</div>

<style>
	.context-menu-custom {
		background: white;
		border: 1px solid #dee2e6;
		border-radius: 0.5rem;
		padding: 0.5rem 0;
		min-width: 200px;
		box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
	}

	.context-menu-header {
		padding: 0.5rem 1rem;
		background-color: #f8f9fa;
		border-bottom: 1px solid #dee2e6;
		margin-bottom: 0.5rem;
	}

	.context-menu-item {
		display: block;
		width: 100%;
		padding: 0.5rem 1rem;
		border: none;
		background: none;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.2s;
		font-size: 0.875rem;
	}

	.context-menu-item:hover {
		background-color: #f8f9fa;
	}

	.context-menu-danger {
		color: #dc3545;
	}

	.context-menu-danger:hover {
		background-color: #f5c6cb;
		color: #721c24;
	}

	.context-menu-divider {
		height: 1px;
		background-color: #dee2e6;
		margin: 0.5rem 0;
	}

	.action-history {
		max-height: 400px;
		overflow-y: auto;
	}

	.alert-sm {
		margin-bottom: 0.5rem;
	}

	.code-example pre {
		font-size: 0.8rem;
		line-height: 1.4;
		white-space: pre-wrap;
		max-height: 300px;
		overflow-y: auto;
	}
</style>