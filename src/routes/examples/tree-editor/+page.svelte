<script lang="ts">
	import { onMount } from 'svelte';
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types';
	import RenderModeSwitch from '../RenderModeSwitch.svelte';
	import { getTreeProps } from '../render-mode.svelte.js';

	interface EditorNode {
		id: number;
		path: string;
		name: string;
		icon: string;
		sortOrder: number;
	}

	// Sample editable tree data with sort order
	let treeData = $state<EditorNode[]>([
		{ id: 1, path: '1', name: 'Root Folder', icon: '📁', sortOrder: 10 },
		{ id: 2, path: '1.1', name: 'Documents', icon: '📂', sortOrder: 10 },
		{ id: 8, path: '1.1.1', name: 'A', icon: '📄', sortOrder: 10 },
		{ id: 9, path: '1.1.1.1', name: 'B', icon: '📄', sortOrder: 10 },
		{ id: 3, path: '1.2', name: 'Images', icon: '🖼️', sortOrder: 20 },
		{ id: 4, path: '1.3', name: 'Music', icon: '🎵', sortOrder: 30 },
		{ id: 5, path: '2', name: 'Projects', icon: '🚀', sortOrder: 20 },
		{ id: 6, path: '2.1', name: 'Web App', icon: '🌐', sortOrder: 10 },
		{ id: 7, path: '2.2', name: 'Mobile App', icon: '📱', sortOrder: 20 }
	]);

	let treeRef: Tree<EditorNode>;
	let selectedNode = $state<LTreeNode<EditorNode> | null>(null);
	let activityLog = $state<string[]>([]);
	let dropWarning = $state<string | null>(null);
	let nextId = 100;

	// Form state for adding nodes
	let newNodeName = $state('');
	let newNodeIcon = $state('📄');

	// Drop zone configuration (with localStorage persistence)
	let dropZoneLayout = $state<'around' | 'above' | 'below' | 'wave' | 'wave2'>('wave');
	let dropZoneStart = $state<number | string>('50%');
	let dropZoneMaxWidth = $state(120);

	// Load settings from localStorage on mount
	onMount(() => {
		const saved = localStorage.getItem('dropZoneConfig');
		if (saved) {
			try {
				const config = JSON.parse(saved);
				if (config.layout) dropZoneLayout = config.layout;
				if (config.start !== undefined) dropZoneStart = config.start;
				if (config.maxWidth !== undefined) dropZoneMaxWidth = config.maxWidth;
			} catch (e) {
				// Ignore invalid JSON
			}
		}
	});

	// Save settings to localStorage when they change
	$effect(() => {
		const config = { layout: dropZoneLayout, start: dropZoneStart, maxWidth: dropZoneMaxWidth };
		localStorage.setItem('dropZoneConfig', JSON.stringify(config));
	});

	function sortByOrder(items: LTreeNode<EditorNode>[]) {
		return [...items].sort((a, b) => {
			// Sort by parent path first
			if (a.parentPath !== b.parentPath) {
				return (a.parentPath || '').localeCompare(b.parentPath || '');
			}
			// Then by sortOrder
			return (a.data?.sortOrder ?? 0) - (b.data?.sortOrder ?? 0);
		});
	}

	function addLog(message: string) {
		activityLog = [...activityLog.slice(-9), `${new Date().toLocaleTimeString()} - ${message}`];
	}

	function handleAddNode() {
		if (!newNodeName.trim()) {
			addLog('Error: Node name is required');
			return;
		}

		const parentPath = selectedNode?.path || '';
		const result = treeRef.addNode(parentPath, {
			id: nextId++,
			path: '', // Will be set by addNode
			name: newNodeName.trim(),
			icon: newNodeIcon,
			sortOrder: 100 // Will be placed at end
		});

		if (result.success) {
			addLog(`Added "${newNodeName}" ${parentPath ? `under "${selectedNode?.data?.name}"` : 'at root'}`);
			newNodeName = '';
		} else {
			addLog(`Error: ${result.error}`);
		}
	}

	function handleRemoveNode() {
		if (!selectedNode) {
			addLog('Error: Select a node to remove');
			return;
		}

		const nodeName = selectedNode.data?.name;
		const result = treeRef.removeNode(selectedNode.path);

		if (result.success) {
			addLog(`Removed "${nodeName}"`);
			selectedNode = null;
		} else {
			addLog(`Error: ${result.error}`);
		}
	}

	function handleMoveUp() {
		if (!selectedNode) {
			addLog('Error: Select a node to move');
			return;
		}

		const siblings = treeRef.getSiblings(selectedNode.path);
		const currentIndex = siblings.findIndex(s => s.path === selectedNode!.path);

		if (currentIndex <= 0) {
			addLog('Already at top');
			return;
		}

		const targetNode = siblings[currentIndex - 1];
		const result = treeRef.moveNode(selectedNode.path, targetNode.path, 'above');

		if (result.success) {
			addLog(`Moved "${selectedNode.data?.name}" above "${targetNode.data?.name}"`);
		} else {
			addLog(`Error: ${result.error}`);
		}
	}

	function handleMoveDown() {
		if (!selectedNode) {
			addLog('Error: Select a node to move');
			return;
		}

		const siblings = treeRef.getSiblings(selectedNode.path);
		const currentIndex = siblings.findIndex(s => s.path === selectedNode!.path);

		if (currentIndex >= siblings.length - 1) {
			addLog('Already at bottom');
			return;
		}

		const targetNode = siblings[currentIndex + 1];
		const result = treeRef.moveNode(selectedNode.path, targetNode.path, 'below');

		if (result.success) {
			addLog(`Moved "${selectedNode.data?.name}" below "${targetNode.data?.name}"`);
		} else {
			addLog(`Error: ${result.error}`);
		}
	}

	async function beforeDrop(dropNode: LTreeNode<EditorNode> | null, draggedNode: LTreeNode<EditorNode>, position: string, event: DragEvent | TouchEvent): Promise<boolean | { position: string } | void> {
		const isFolder = (node: LTreeNode<EditorNode> | null) =>
			node?.data?.icon?.includes('📁') || node?.data?.icon?.includes('📂');
		const isImage = (node: LTreeNode<EditorNode> | null) =>
			node?.data?.icon?.includes('🖼️');
		const isDocumentsFolder = (node: LTreeNode<EditorNode> | null) =>
			node?.data?.name === 'Documents';

		// Rule 1: Images cannot be dropped under Documents folder
		if (isImage(draggedNode) && position === 'child' && isDocumentsFolder(dropNode)) {
			addLog(`Cannot drop images under Documents folder - cancelled`);
			dropWarning = `Cannot drop images under Documents folder`;
			return false; // Cancel the drop
		}

		// Rule 2: Ask user when dropping as child of non-folder items
		if (position === 'child' && dropNode && !isFolder(dropNode)) {
			const choice = await showDropDialog(dropNode.data?.name || 'item');
			if (choice === 'cancel') {
				addLog(`Drop cancelled by user`);
				return false;
			}
			if (choice === 'sibling') {
				addLog(`User chose to drop as sibling of "${dropNode.data?.name}"`);
				return { position: 'below' };
			}
		}

		// Return undefined to proceed normally
	}

	// Simple dialog using native confirm/prompt - replace with your own modal
	function showDropDialog(targetName: string): Promise<'cancel' | 'sibling'> {
		return new Promise((resolve) => {
			const result = confirm(
				`"${targetName}" is not a folder.\n\nClick OK to drop as sibling, or Cancel to abort.`
			);
			resolve(result ? 'sibling' : 'cancel');
		});
	}

	function handleDragStart() {
		dropWarning = null;
	}

	function handleDrop(dropNode: LTreeNode<EditorNode> | null, draggedNode: LTreeNode<EditorNode>, position: string, event: DragEvent | TouchEvent) {
		if (!dropNode) {
			addLog(`Dropped "${draggedNode.data?.name}" at root`);
			return;
		}

		const result = treeRef.moveNode(
			draggedNode.path,
			dropNode.path,
			position as 'above' | 'below' | 'child'
		);

		if (result.success) {
			addLog(`Dropped "${draggedNode.data?.name}" ${position} "${dropNode.data?.name}"`);
		} else {
			addLog(`Error: ${result.error}`);
		}
	}

	function handleExport() {
		// Export current tree state
		const children = treeRef.getChildren('');
		const exportData = collectNodes(children);
		console.log('Exported tree data:', exportData);
		addLog(`Exported ${exportData.length} nodes to console`);
	}

	function collectNodes(nodes: LTreeNode<EditorNode>[]): EditorNode[] {
		const result: EditorNode[] = [];
		for (const node of nodes) {
			if (node.data) {
				result.push({ ...node.data, path: node.path });
			}
			result.push(...collectNodes(Object.values(node.children)));
		}
		return result;
	}

	function resetTree() {
		treeData = [
			{ id: 1, path: '1', name: 'Root Folder', icon: '📁', sortOrder: 10 },
			{ id: 2, path: '1.1', name: 'Documents', icon: '📂', sortOrder: 10 },
			{ id: 3, path: '1.2', name: 'Images', icon: '🖼️', sortOrder: 20 },
			{ id: 4, path: '1.3', name: 'Music', icon: '🎵', sortOrder: 30 },
			{ id: 5, path: '2', name: 'Projects', icon: '🚀', sortOrder: 20 },
			{ id: 6, path: '2.1', name: 'Web App', icon: '🌐', sortOrder: 10 },
			{ id: 7, path: '2.2', name: 'Mobile App', icon: '📱', sortOrder: 20 }
		];
		selectedNode = null;
		activityLog = [];
		addLog('Tree reset to initial state');
	}
</script>

<svelte:head>
	<title>Tree Editor - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>Tree Editor</h1>
		<p class="subtitle">Add, remove, and move nodes with drag-and-drop</p>
		<RenderModeSwitch />
	</header>

	<!-- Main Editor -->
	<div class="card">
		<h2>Interactive Tree Editor</h2>
		<p class="description">
			Select a node, then use the controls to add children, remove, or reorder.
			Drag and drop also works for moving nodes!
		</p>

		<div class="editor-layout">
			<div class="tree-section">
				<div class="tree-container" class:tree-container-tall={!getTreeProps().virtualScroll}>
					<Tree
						bind:this={treeRef}
						data={treeData}
						idMember="id"
						pathMember="path"
						orderMember="sortOrder"
						sortCallback={sortByOrder}
						isSorted={true}
						expandLevel={3}
						bind:selectedNode
						beforeDropCallback={beforeDrop}
						onNodeDrop={handleDrop}
						onNodeDragStart={handleDragStart}
						{dropZoneLayout}
						{dropZoneStart}
						{dropZoneMaxWidth}
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node)}
							<span class:selected-node={selectedNode?.path === node.path}>
								{node.data?.icon} {node.data?.name}
							</span>
						{/snippet}
					</Tree>
				</div>
				{#if dropWarning}
					<div class="drop-warning">
						{dropWarning}
					</div>
				{/if}
			</div>

			<div class="controls-section">
				<div class="control-group">
					<h3>Add Node</h3>
					<p class="help-text">
						{selectedNode ? `Adding to: ${selectedNode.data?.name}` : 'Adding at root level'}
					</p>
					<div class="input-row">
						<input
							type="text"
							placeholder="Node name"
							bind:value={newNodeName}
							onkeydown={(e) => e.key === 'Enter' && handleAddNode()}
						/>
						<select bind:value={newNodeIcon}>
							<option value="📄">📄 File</option>
							<option value="📁">📁 Folder</option>
							<option value="📂">📂 Open Folder</option>
							<option value="🖼️">🖼️ Image</option>
							<option value="🎵">🎵 Music</option>
							<option value="📝">📝 Note</option>
							<option value="🚀">🚀 Project</option>
						</select>
					</div>
					<button class="btn" onclick={handleAddNode}>Add Node</button>
				</div>

				<div class="control-group">
					<h3>Move Node</h3>
					<p class="help-text">
						{selectedNode ? `Moving: ${selectedNode.data?.name}` : 'Select a node first'}
					</p>
					<div class="button-row">
						<button class="btn btn-secondary" onclick={handleMoveUp} disabled={!selectedNode}>
							Move Up
						</button>
						<button class="btn btn-secondary" onclick={handleMoveDown} disabled={!selectedNode}>
							Move Down
						</button>
					</div>
				</div>

				<div class="control-group">
					<h3>Remove Node</h3>
					<button class="btn btn-danger" onclick={handleRemoveNode} disabled={!selectedNode}>
						Remove Selected
					</button>
				</div>

				<div class="control-group">
					<h3>Actions</h3>
					<div class="button-row">
						<button class="btn btn-secondary" onclick={handleExport}>Export to Console</button>
						<button class="btn btn-secondary" onclick={resetTree}>Reset Tree</button>
					</div>
				</div>

				<div class="control-group">
					<h3>Drop Zones</h3>
					<div class="input-row">
						<select bind:value={dropZoneLayout} style="flex: 1;">
							<option value="around">Around</option>
							<option value="above">Above</option>
							<option value="below">Below</option>
							<option value="wave">Wave</option>
							<option value="wave2">Wave2</option>
						</select>
					</div>
					<div class="input-row">
						<label style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
							Start %:
							<input type="text" bind:value={dropZoneStart} placeholder="50% or 50px" style="width: 80px;" />
						</label>
						<label style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
							Max W:
							<input type="number" bind:value={dropZoneMaxWidth} min="50" max="300" style="width: 60px;" />
						</label>
					</div>
				</div>
			</div>
		</div>

		{#if activityLog.length > 0}
			<div class="output">
				<p class="output-label">Activity Log:</p>
				<pre>{activityLog.join('\n')}</pre>
			</div>
		{/if}
	</div>

	<!-- API Reference -->
	<div class="card">
		<h2>Tree Editor API</h2>
		<p class="description">Methods available for programmatic tree manipulation.</p>

		<table>
			<thead>
				<tr>
					<th>Method</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td><code>addNode(parentPath, data, pathSegment?)</code></td>
					<td>Add a new node under the specified parent</td>
				</tr>
				<tr>
					<td><code>moveNode(sourcePath, targetPath, position)</code></td>
					<td>Move a node to a new location ('above', 'below', 'child')</td>
				</tr>
				<tr>
					<td><code>removeNode(path, includeDescendants?)</code></td>
					<td>Remove a node (and optionally its descendants)</td>
				</tr>
				<tr>
					<td><code>getNodeByPath(path)</code></td>
					<td>Get a node by its path</td>
				</tr>
				<tr>
					<td><code>getChildren(parentPath)</code></td>
					<td>Get direct children of a node</td>
				</tr>
				<tr>
					<td><code>getSiblings(path)</code></td>
					<td>Get siblings of a node (including itself)</td>
				</tr>
				<tr>
					<td><code>refreshSiblings(parentPath)</code></td>
					<td>Re-sort siblings using orderMember</td>
				</tr>
			</tbody>
		</table>

		<div class="note">
			<p class="note-title">orderMember Prop</p>
			<p>
				For proper above/below positioning, set the <code>orderMember</code> prop to specify
				which field in your data contains the sort order value. The tree will automatically
				calculate new order values when moving nodes.
			</p>
			<pre style="margin-top: 0.5rem;">{`<Tree
  data={data}
  orderMember="sortOrder"
  ...
/>`}</pre>
		</div>
	</div>

	<!-- Code Example -->
	<div class="card">
		<h2>Code Example</h2>
		<p class="description">Example of handling tree editing operations.</p>

		<div class="code-block">
			<pre>{`<script lang="ts">
  import Tree from '@keenmate/svelte-treeview';

  interface MyNode {
    id: number;
    path: string;
    name: string;
    sortOrder: number;
  }

  let treeRef: Tree<MyNode>;
  let selectedNode = $state(null);

  // Add a new node
  function addChild() {
    const result = treeRef.addNode(
      selectedNode?.path || '',
      { id: Date.now(), path: '', name: 'New Node', sortOrder: 100 }
    );
    if (result.success) {
      console.log('Added:', result.node);
    }
  }

  // Move node above sibling
  function moveUp() {
    const siblings = treeRef.getSiblings(selectedNode.path);
    const index = siblings.findIndex(s => s.path === selectedNode.path);
    if (index > 0) {
      treeRef.moveNode(selectedNode.path, siblings[index - 1].path, 'above');
    }
  }

  // Remove selected node
  function remove() {
    treeRef.removeNode(selectedNode.path);
    selectedNode = null;
  }

  // Handle drag-drop
  function handleDrop(dropNode, draggedNode, position, event) {
    if (dropNode) {
      treeRef.moveNode(draggedNode.path, dropNode.path, position);
    }
  }
<\/script>

<Tree
  bind:this={treeRef}
  data={data}
  orderMember="sortOrder"
  onNodeDrop={handleDrop}
  bind:selectedNode
>
  {#snippet nodeTemplate(node)}
    <span>{node.data?.name}</span>
  {/snippet}
</Tree>`}</pre>
		</div>
	</div>

	<footer>
		<p><a href="/">&larr; Back to Examples</a></p>
	</footer>
</div>

<style>
	.editor-layout {
		display: grid;
		grid-template-columns: 1fr 300px;
		gap: 1.5rem;
	}

	@media (max-width: 768px) {
		.editor-layout {
			grid-template-columns: 1fr;
		}
	}

	.tree-section {
		min-height: 400px;
	}

	.controls-section {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.control-group {
		background: rgba(255, 255, 255, 0.5);
		padding: 1rem;
		border-radius: 8px;
		border: 1px solid rgba(102, 126, 234, 0.2);
	}

	.control-group h3 {
		margin: 0 0 0.5rem 0;
		font-size: 0.9rem;
		color: #4a5568;
	}

	.help-text {
		font-size: 0.8rem;
		color: #718096;
		margin: 0 0 0.75rem 0;
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.input-row input {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid #e2e8f0;
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.input-row select {
		padding: 0.5rem;
		border: 1px solid #e2e8f0;
		border-radius: 4px;
		font-size: 0.9rem;
		background: white;
	}

	.button-row {
		display: flex;
		gap: 0.5rem;
	}

	.button-row .btn {
		flex: 1;
	}

	.btn-danger {
		background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
		color: white;
	}

	.btn-danger:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(229, 62, 62, 0.3);
	}

	.btn-danger:disabled {
		background: #e2e8f0;
		color: #a0aec0;
		cursor: not-allowed;
	}

	.btn:disabled {
		background: #e2e8f0;
		color: #a0aec0;
		cursor: not-allowed;
		transform: none;
		box-shadow: none;
	}

	.selected-node {
		font-weight: 600;
		color: #667eea;
	}

	.drop-warning {
		margin-top: 0.75rem;
		padding: 0.5rem 0.75rem;
		background: #fef3c7;
		border: 1px solid #f59e0b;
		border-radius: 4px;
		color: #92400e;
		font-size: 0.85rem;
	}
</style>
