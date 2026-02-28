<script lang="ts">
	import { onMount } from 'svelte';
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode, DropOperation, DropPosition } from '$lib/ltree/types';
	import RenderModeSwitch from '../RenderModeSwitch.svelte';
	import { getTreeProps } from '../render-mode.svelte.js';

	type FileItem = {
		id: number;
		path: string;
		name: string;
		icon: string;
		sortOrder: number;
	};

	// Extended type with allowedDropPositions for restricted drop demo
	type RestrictedFileItem = FileItem & {
		allowedDropPositions?: DropPosition[];
	};

	// Source tree data with sortOrder for reorganization
	let sourceData = $state<FileItem[]>([
		{ id: 1, path: '1', name: 'Source Folder', icon: '📁', sortOrder: 10 },
		{ id: 2, path: '1.1', name: 'File A', icon: '📄', sortOrder: 10 },
		{ id: 3, path: '1.2', name: 'File B', icon: '📄', sortOrder: 20 },
		{ id: 4, path: '1.3', name: 'File C', icon: '📄', sortOrder: 30 },
		{ id: 5, path: '2', name: 'Another Folder', icon: '📁', sortOrder: 20 },
		{ id: 6, path: '2.1', name: 'Document 1', icon: '📝', sortOrder: 10 },
		{ id: 7, path: '2.2', name: 'Document 2', icon: '📝', sortOrder: 20 }
	]);

	let sourceTreeRef: Tree<FileItem>;
	let targetTreeRef: Tree<FileItem>;

	// Target tree data (starts empty for drop placeholder demo)
	let targetData = $state<FileItem[]>([]);

	// Activity log
	let activityLog = $state<string[]>([]);
	let nextId = 100;

	// Drop zone configuration (with localStorage persistence)
	let dropZoneMode = $state<'floating' | 'glow'>('glow');
	let dropZoneLayout = $state<'around' | 'above' | 'below' | 'wave' | 'wave2'>('around');
	let dropZoneStart = $state<number | string>('33%');
	let dropZoneMaxWidth = $state(120);
	let allowCopy = $state(false); // Enable Ctrl+drag to copy

	// Load settings from localStorage on mount
	onMount(() => {
		const saved = localStorage.getItem('dropZoneConfig');
		if (saved) {
			try {
				const config = JSON.parse(saved);
				if (config.mode) dropZoneMode = config.mode;
				if (config.layout) dropZoneLayout = config.layout;
				if (config.start !== undefined) dropZoneStart = config.start;
				if (config.maxWidth !== undefined) dropZoneMaxWidth = config.maxWidth;
				if (config.allowCopy !== undefined) allowCopy = config.allowCopy;
			} catch (e) {
				// Ignore invalid JSON
			}
		}
	});

	// Save settings to localStorage when they change
	$effect(() => {
		const config = { mode: dropZoneMode, layout: dropZoneLayout, start: dropZoneStart, maxWidth: dropZoneMaxWidth, allowCopy };
		localStorage.setItem('dropZoneConfig', JSON.stringify(config));
	});

	function sortByName(items: LTreeNode<FileItem>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	function sortByOrder(items: LTreeNode<FileItem>[]) {
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

	function handleSourceDragStart(node: LTreeNode<FileItem>, event: DragEvent) {
		addLog(`Started dragging: ${node.data?.name}`);
	}

	function handleTargetDrop(dropNode: LTreeNode<FileItem> | null, draggedNode: LTreeNode<FileItem>, position: string, event: DragEvent | TouchEvent, operation: DropOperation) {
		// Same-tree operations are auto-handled by the library - just log
		const isSameTreeDrag = draggedNode.treeId === 'target-tree';
		if (isSameTreeDrag) {
			addLog(`[${operation.toUpperCase()}] ${operation === 'move' ? 'Moved' : 'Copied'} "${draggedNode.data?.name}" ${position} "${dropNode?.data?.name || 'root'}"`);
			return;
		}

		// Cross-tree drags - use copyNodeWithDescendants to include children
		// Calculate parent path and sibling for positioning
		let parentPath: string;
		let siblingPath: string | undefined;
		let copyPosition: 'above' | 'below' | undefined;

		if (dropNode === null) {
			// Dropped on empty tree placeholder - add to root
			parentPath = '';
		} else if (position === 'child') {
			// Drop as child of target node
			parentPath = dropNode.path;
		} else {
			// Drop as sibling (above/below) - use target's parent
			parentPath = dropNode.parentPath || '';
			siblingPath = dropNode.path;
			copyPosition = position as 'above' | 'below';
		}

		// Copy the node and all its descendants with new IDs
		const result = targetTreeRef.copyNodeWithDescendants(
			draggedNode,
			parentPath,
			(data: FileItem) => ({
				...data,
				id: nextId++,
				path: '', // Will be assigned by addNode
				sortOrder: data.sortOrder || 10
			}),
			siblingPath,
			copyPosition
		);

		if (result.success) {
			addLog(`[CROSS-TREE] Copied ${result.count} node(s) to "${parentPath || 'root'}"${siblingPath ? ` ${copyPosition} "${siblingPath}"` : ''}`);
		} else {
			addLog(`Error: ${result.error}`);
		}
	}

	function handleSourceDrop(dropNode: LTreeNode<FileItem> | null, draggedNode: LTreeNode<FileItem>, position: string, event: DragEvent | TouchEvent, operation: DropOperation) {
		// Same-tree moves and copies are auto-handled by the library - just log
		if (!dropNode) {
			addLog(`Cannot drop at root level in source tree`);
			return;
		}

		addLog(`[${operation.toUpperCase()}] ${operation === 'move' ? 'Moved' : 'Copied'} "${draggedNode.data?.name}" ${position} "${dropNode.data?.name}"`);
	}

	function clearTarget() {
		targetData = [];
		addLog('Cleared target tree');
	}

	function resetTarget() {
		// Generate 100 nodes in a hierarchical structure with sortOrders
		const nodes: FileItem[] = [];
		let id = 1000;

		// Create 10 root folders with sortOrder
		for (let i = 1; i <= 10; i++) {
			nodes.push({ id: id++, path: `${i}`, name: `Folder ${i}`, icon: '📁', sortOrder: i * 10 });

			// Each root has 3 subfolders
			for (let j = 1; j <= 3; j++) {
				nodes.push({ id: id++, path: `${i}.${j}`, name: `Subfolder ${i}.${j}`, icon: '📂', sortOrder: j * 10 });

				// Each subfolder has 2-3 files
				for (let k = 1; k <= 2 + (i % 2); k++) {
					nodes.push({ id: id++, path: `${i}.${j}.${k}`, name: `File ${i}.${j}.${k}`, icon: '📄', sortOrder: k * 10 });
				}
			}
		}

		targetData = nodes;
		addLog(`Reset target tree with ${nodes.length} nodes`);
	}

	function clearLog() {
		activityLog = [];
	}

	// === Restricted Drop Positions Demo ===
	// Data with allowedDropPositions to restrict where nodes can be dropped
	let restrictedData = $state<RestrictedFileItem[]>([
		// Trash folder: only accepts drops as children (can't drop above/below)
		{ id: 101, path: '1', name: '🗑️ Trash', icon: '', sortOrder: 10, allowedDropPositions: ['child'] },
		{ id: 102, path: '1.1', name: 'Deleted Item 1', icon: '📄', sortOrder: 10 },
		{ id: 103, path: '1.2', name: 'Deleted Item 2', icon: '📄', sortOrder: 20 },

		// Regular folder: all drop positions allowed (default)
		{ id: 104, path: '2', name: '📁 Projects', icon: '', sortOrder: 20 },
		{ id: 105, path: '2.1', name: 'Project A', icon: '📂', sortOrder: 10 },
		{ id: 106, path: '2.2', name: 'Project B', icon: '📂', sortOrder: 20 },

		// Files: only accept drops above/below (can't drop INTO a file)
		{ id: 107, path: '3', name: '📄 Readme.md', icon: '', sortOrder: 30, allowedDropPositions: ['above', 'below'] },
		{ id: 108, path: '4', name: '📄 Config.json', icon: '', sortOrder: 40, allowedDropPositions: ['above', 'below'] },

		// Source items to drag
		{ id: 109, path: '5', name: '📁 Source Items', icon: '', sortOrder: 50 },
		{ id: 110, path: '5.1', name: 'Drag me!', icon: '🔵', sortOrder: 10 },
		{ id: 111, path: '5.2', name: 'Drag me too!', icon: '🟢', sortOrder: 20 },
	]);

	let restrictedTreeRef: Tree<RestrictedFileItem>;
	let restrictedLog = $state<string[]>([]);

	function addRestrictedLog(message: string) {
		restrictedLog = [...restrictedLog.slice(-4), `${new Date().toLocaleTimeString()} - ${message}`];
	}

	function handleRestrictedDrop(dropNode: LTreeNode<RestrictedFileItem> | null, draggedNode: LTreeNode<RestrictedFileItem>, position: string, event: DragEvent | TouchEvent, operation: DropOperation) {
		const positionLabel = dropNode?.data?.allowedDropPositions?.length === 1
			? `(only ${dropNode.data.allowedDropPositions[0]} allowed)`
			: '';
		addRestrictedLog(`Dropped "${draggedNode.data?.name}" ${position} "${dropNode?.data?.name || 'root'}" ${positionLabel}`);
	}
</script>

<svelte:head>
	<title>Drag & Drop Examples - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>🎯 Drag & Drop Examples</h1>
		<p class="subtitle">Desktop and mobile drag and drop between trees</p>
		<RenderModeSwitch />
	</header>

	<!-- Two Trees Side by Side -->
	<div class="card">
		<h2>Drag Between Trees</h2>
		<p class="description">
			<strong>Source tree (left):</strong> Drag to reorganize nodes (move). Enable "Allow Ctrl+drag to copy" then hold Ctrl while dragging to copy nodes.
			<strong>Target tree (right):</strong> Drag from source to add nodes. Starts empty to demo drop placeholder.
		</p>

		<div class="controls">
			<button class="btn btn-secondary" onclick={clearTarget}>Clear Target Tree</button>
			<button class="btn" onclick={resetTarget}>Reset Target Tree (100 nodes)</button>
			<button class="btn btn-secondary" onclick={clearLog}>Clear Log</button>
		</div>

		<div class="controls" style="align-items: center;">
			<label style="display: flex; align-items: center; gap: 0.5rem;">
				Drop Zone Mode:
				<select bind:value={dropZoneMode}>
					<option value="glow">Glow (border indicators)</option>
					<option value="floating">Floating (popup zones)</option>
				</select>
			</label>
			{#if dropZoneMode === 'floating'}
				<label style="display: flex; align-items: center; gap: 0.5rem;">
					Layout:
					<select bind:value={dropZoneLayout}>
						<option value="around">Around (above + below/child)</option>
						<option value="above">Above (all 3 in row above)</option>
						<option value="below">Below (all 3 in row below)</option>
						<option value="wave">Wave (stacked vertically)</option>
						<option value="wave2">Wave2 (diagonal pattern)</option>
					</select>
				</label>
				<label style="display: flex; align-items: center; gap: 0.5rem;">
					Zone Start:
					<input type="text" bind:value={dropZoneStart} placeholder="33% or 50px" style="width: 80px;" />
				</label>
				<label style="display: flex; align-items: center; gap: 0.5rem;">
					Max Width (px):
					<input type="number" bind:value={dropZoneMaxWidth} min="50" max="300" style="width: 60px;" />
				</label>
			{/if}
			<label style="display: flex; align-items: center; gap: 0.5rem; margin-left: 1rem;">
				<input type="checkbox" bind:checked={allowCopy} />
				Allow Ctrl+drag to copy
			</label>
		</div>

		<div class="trees-side-by-side">
			<div>
				<h3>Source Tree (Reorganizable)</h3>
				<div class="tree-container" class:tree-container-tall={!getTreeProps().virtualScroll}>
					<Tree
						bind:this={sourceTreeRef}
						treeId="source-tree"
						data={sourceData}
						idMember="id"
						pathMember="path"
						orderMember="sortOrder"
						sortCallback={sortByOrder}
						isSorted={true}
						expandLevel={3}
						dragDropMode="both"
						onNodeDragStart={handleSourceDragStart}
						onNodeDrop={handleSourceDrop}
						{allowCopy}
						{dropZoneMode}
						{dropZoneLayout}
						{dropZoneStart}
						{dropZoneMaxWidth}
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node)}
							<span>{node.data?.icon} {node.data?.name}</span>
							<small style="color: #999; margin-left: 0.5rem; font-size: 0.75em;">(#{node.data?.sortOrder})</small>
						{/snippet}
					</Tree>
				</div>
			</div>

			<div>
				<h3>Target Tree {targetData.length === 0 ? '(Empty - Drop Here!)' : ''}</h3>
				<div class="tree-container" class:tree-container-tall={!getTreeProps().virtualScroll}>
					<Tree
						bind:this={targetTreeRef}
						treeId="target-tree"
						data={targetData}
						idMember="id"
						pathMember="path"
						orderMember="sortOrder"
						sortCallback={sortByOrder}
						expandLevel={3}
						dragDropMode="both"
						onNodeDrop={handleTargetDrop}
						shouldDisplayDebugInformation={true}
						{allowCopy}
						{dropZoneMode}
						{dropZoneLayout}
						{dropZoneStart}
						{dropZoneMaxWidth}
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node)}
							<span>{node.data?.icon} {node.data?.name}</span>
							<small style="color: #999; margin-left: 0.5rem; font-size: 0.75em;">(#{node.data?.sortOrder})</small>
						{/snippet}
						{#snippet dropPlaceholder()}
							<div style="text-align: center; color: #667eea;">
								<p style="font-size: 2rem;">📥</p>
								<p>Drop items here to add them</p>
							</div>
						{/snippet}
					</Tree>
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

	<!-- Restricted Drop Positions Demo -->
	<div class="card">
		<h2>Restricted Drop Positions</h2>
		<p class="description">
			Control which drop positions are valid per node using <code>allowedDropPositions</code>.
			Try dragging items to different targets:
		</p>

		<div class="note">
			<p class="note-title">Node Types</p>
			<ul>
				<li><strong>🗑️ Trash</strong> - Only accepts <code>child</code> drops (drop INTO, not above/below)</li>
				<li><strong>📁 Projects</strong> - All positions allowed (default behavior)</li>
				<li><strong>📄 Files</strong> - Only <code>above</code> and <code>below</code> (can't drop INTO a file)</li>
			</ul>
		</div>

		<div class="tree-container" class:tree-container-tall={!getTreeProps().virtualScroll}>
			<Tree
				bind:this={restrictedTreeRef}
				treeId="restricted-tree"
				data={restrictedData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				allowedDropPositionsMember="allowedDropPositions"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={3}
				dragDropMode="both"
				onNodeDrop={handleRestrictedDrop}
				{dropZoneMode}
				{dropZoneLayout}
				{...getTreeProps()}
			>
				{#snippet nodeTemplate(node)}
					<span>{node.data?.icon} {node.data?.name}</span>
					{#if node.data?.allowedDropPositions}
						<small style="color: #888; margin-left: 0.5rem; font-size: 0.7em;">
							({node.data.allowedDropPositions.join('/')})
						</small>
					{/if}
				{/snippet}
			</Tree>
		</div>

		{#if restrictedLog.length > 0}
			<div class="output">
				<p class="output-label">Activity Log:</p>
				<pre>{restrictedLog.join('\n')}</pre>
			</div>
		{/if}

		<div class="code-block">
			<pre>{`// Define allowed drop positions per node
const data = [
  // Trash: only accept drops as children
  { id: 1, name: '🗑️ Trash', allowedDropPositions: ['child'] },

  // Regular folder: all positions (default)
  { id: 2, name: '📁 Projects' },

  // Files: can't drop INTO them
  { id: 3, name: '📄 Readme.md', allowedDropPositions: ['above', 'below'] },
];

<Tree
  data={data}
  allowedDropPositionsMember="allowedDropPositions"
  ...
/>`}</pre>
		</div>
	</div>

	<!-- Touch Drag Instructions -->
	<div class="card">
		<h2>Touch Drag (Mobile)</h2>
		<p class="description">On touch devices, long-press (300ms) on a node to start dragging. A ghost element will follow your finger.</p>

		<div class="note">
			<p class="note-title">How Touch Drag Works</p>
			<ul>
				<li><strong>Long-press (300ms)</strong> on a node to start dragging</li>
				<li>A <strong>ghost element</strong> appears and follows your finger</li>
				<li>Move your finger to the <strong>drop target</strong></li>
				<li>Lift your finger to <strong>drop</strong> the node</li>
				<li>Slight movement cancels drag initiation to allow scrolling</li>
			</ul>
		</div>

		<div class="code-block">
			<pre>{`<!-- Touch events are handled automatically -->
<Tree
  data={data}
  idMember="id"
  pathMember="path"
  sortCallback={sortByName}
  onNodeDrop={(dropNode, draggedNode, position, event) => {
    // Handle the drop - position is 'above', 'below', or 'child'
    console.log('Dropped:', draggedNode.data?.name);
    console.log('Position:', position);
    console.log('On:', dropNode?.data?.name || 'empty tree');
  }}
/>`}</pre>
		</div>
	</div>

	<!-- Drop Placeholder -->
	<div class="card">
		<h2>Drop Placeholder Customization</h2>
		<p class="description">When dragging to an empty tree, a customizable placeholder appears. Use the <code>dropPlaceholder</code> snippet to customize it.</p>

		<div class="code-block">
			<pre>{`<Tree data={emptyData} ...>
  {#snippet dropPlaceholder()}
    <div style="text-align: center; color: #667eea;">
      <p style="font-size: 2rem;">📥</p>
      <p>Drop items here to add them</p>
    </div>
  {/snippet}
</Tree>`}</pre>
		</div>

		<div class="note">
			<p class="note-title">onNodeDrop Signature</p>
			<p>The <code>position</code> parameter indicates where to drop: <code>'above'</code>, <code>'below'</code>, or <code>'child'</code>:</p>
			<pre style="margin-top: 0.5rem;">{`onNodeDrop={(dropNode, draggedNode, position, event) => {
  if (dropNode === null) {
    // Dropped on empty tree placeholder or root drop zone
    // Add as root node
  } else {
    // position: 'above' - insert as sibling before dropNode
    // position: 'below' - insert as sibling after dropNode
    // position: 'child' - insert as child of dropNode
  }
}}`}</pre>
		</div>
	</div>

	<!-- Drag Drop Mode -->
	<div class="card">
		<h2>Drag Drop Mode</h2>
		<p class="description">Control where drag and drop is allowed with the <code>dragDropMode</code> prop.</p>

		<table>
			<thead>
				<tr>
					<th>Mode</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td><code>'none'</code></td>
					<td>Drag and drop is disabled</td>
				</tr>
				<tr>
					<td><code>'self'</code></td>
					<td>Only allow drag and drop within the same tree</td>
				</tr>
				<tr>
					<td><code>'cross'</code></td>
					<td>Only allow drag and drop between different trees</td>
				</tr>
				<tr>
					<td><code>'both'</code></td>
					<td>Allow both self and cross-tree drag and drop (default)</td>
				</tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`<!-- Only allow drops from other trees -->
<Tree
  data={targetData}
  dragDropMode="cross"
  onNodeDrop={(dropNode, draggedNode, position, event) => {
    // Only triggered when dropping from a different tree
  }}
/>`}</pre>
		</div>
	</div>

	<!-- Drag Visual Feedback -->
	<div class="card">
		<h2>Drag Visual Feedback</h2>
		<p class="description">CSS classes are applied during drag operations for visual feedback.</p>

		<table>
			<thead>
				<tr>
					<th>Class</th>
					<th>Applied When</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td><code>ltree-dragover-highlight</code></td>
					<td>Dragging over a node</td>
					<td>Highlights the drop target with a background color</td>
				</tr>
				<tr>
					<td><code>ltree-dragover-glow</code></td>
					<td>Dragging over a node</td>
					<td>Alternative glow effect for drop target</td>
				</tr>
				<tr>
					<td><code>ltree-drop-placeholder</code></td>
					<td>Dragging over empty tree</td>
					<td>Styles the drop placeholder area</td>
				</tr>
				<tr>
					<td><code>ltree-drop-indicators</code></td>
					<td>Drag in progress over a node</td>
					<td>Container for position indicators (above/child/below)</td>
				</tr>
				<tr>
					<td><code>ltree-drop-above</code></td>
					<td>Position indicator active</td>
					<td>Shows drop will insert above the node</td>
				</tr>
				<tr>
					<td><code>ltree-drop-child</code></td>
					<td>Position indicator active</td>
					<td>Shows drop will insert as child of the node</td>
				</tr>
				<tr>
					<td><code>ltree-drop-below</code></td>
					<td>Position indicator active</td>
					<td>Shows drop will insert below the node</td>
				</tr>
				<tr>
					<td><code>ltree-touch-ghost</code></td>
					<td>Touch drag in progress</td>
					<td>Styles the ghost element following the finger</td>
				</tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`/* Customize drag-over highlight */
:global(.ltree-dragover-highlight) {
  background-color: rgba(102, 126, 234, 0.2) !important;
  border-radius: 4px;
}

/* Customize touch ghost */
:global(.ltree-touch-ghost) {
  background: rgba(102, 126, 234, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
}`}</pre>
		</div>
	</div>

	<footer>
		<p><a href="/">&larr; Back to Examples</a></p>
	</footer>
</div>
