<script lang="ts">
	import { onMount } from 'svelte';
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode, DropOperation } from '$lib/ltree/types';

	type FileItem = {
		id: number;
		path: string;
		name: string;
		icon: string;
		sortOrder: number;
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

	// Calculate sortOrder for a new node based on position relative to target
	function calculateSortOrder(
		siblings: LTreeNode<FileItem>[],
		targetNode: LTreeNode<FileItem>,
		position: 'above' | 'below' | 'child'
	): number {
		if (position === 'child') {
			// First child - use base value
			return 10;
		}

		const targetOrder = targetNode.data?.sortOrder ?? 0;
		const targetIndex = siblings.findIndex(s => s.path === targetNode.path);

		if (position === 'above') {
			// Get the node before target (if any)
			const prevNode = targetIndex > 0 ? siblings[targetIndex - 1] : null;
			const prevOrder = prevNode?.data?.sortOrder ?? 0;
			// Place between prev and target
			return Math.floor((prevOrder + targetOrder) / 2);
		} else {
			// position === 'below'
			// Get the node after target (if any)
			const nextNode = targetIndex < siblings.length - 1 ? siblings[targetIndex + 1] : null;
			const nextOrder = nextNode?.data?.sortOrder ?? targetOrder + 20;
			// Place between target and next
			return Math.floor((targetOrder + nextOrder) / 2);
		}
	}

	// Renumber siblings when sortOrders collide or get too close
	function renumberSiblings(parentPath: string | null): void {
		// Get all nodes with this parent from targetData
		const siblings = targetData.filter(item => {
			const itemParent = item.path.includes('.')
				? item.path.substring(0, item.path.lastIndexOf('.'))
				: null;
			return itemParent === parentPath;
		});

		// Sort by current sortOrder
		siblings.sort((a, b) => a.sortOrder - b.sortOrder);

		// Renumber with gaps of 10
		siblings.forEach((sibling, index) => {
			sibling.sortOrder = (index + 1) * 10;
		});

		// Trigger reactivity
		targetData = [...targetData];
		addLog(`Renumbered ${siblings.length} siblings under "${parentPath || 'root'}"`);
	}

	function addLog(message: string) {
		activityLog = [...activityLog.slice(-9), `${new Date().toLocaleTimeString()} - ${message}`];
	}

	function handleSourceDragStart(node: LTreeNode<FileItem>, event: DragEvent) {
		addLog(`Started dragging: ${node.data?.name}`);
	}

	function handleTargetDrop(dropNode: LTreeNode<FileItem> | null, draggedNode: LTreeNode<FileItem>, position: string, event: DragEvent | TouchEvent, operation: DropOperation) {
		// Same-tree moves are auto-handled by the library - just log it
		const isSameTreeDrag = draggedNode.treeId === 'target-tree';
		if (isSameTreeDrag && operation === 'move') {
			addLog(`[MOVE] Moved "${draggedNode.data?.name}" ${position} "${dropNode?.data?.name || 'root'}"`);
			return;
		}

		// Cross-tree drags or copy operations - create new node
		const itemId = nextId++;
		let newSortOrder: number;

		if (dropNode === null) {
			// Dropped on empty tree placeholder - calculate based on existing roots
			const rootNodes = targetData.filter(d => !d.path.includes('.'));
			const maxOrder = rootNodes.length > 0
				? Math.max(...rootNodes.map(n => n.sortOrder))
				: 0;
			newSortOrder = maxOrder + 10;

			const newItem: FileItem = {
				id: itemId,
				path: String(itemId),
				name: draggedNode.data?.name || 'Unknown',
				icon: draggedNode.data?.icon || '📄',
				sortOrder: newSortOrder
			};

			// INCREMENTAL: Use applyChanges instead of modifying targetData
			const createChange = { operation: 'create' as const, parentPath: '', data: newItem };
			console.log('[applyChanges] Creating root node:', createChange);
			const result = targetTreeRef.applyChanges([createChange]);
			addLog(`[${operation.toUpperCase()}] Added to root (order: ${newSortOrder}) - ${result.successful} ops`);

			// Keep local data in sync (won't trigger rebuild due to _skipInsertArray)
			targetData = [...targetData, newItem];
		} else {
			// Get siblings at target level using tree ref
			const siblings = targetTreeRef?.getSiblings(dropNode.path) ?? [];
			const targetIndex = siblings.findIndex(s => s.path === dropNode.path);

			// Calculate path based on position
			let parentPath: string | null;
			if (position === 'child') {
				parentPath = dropNode.path;
			} else {
				parentPath = dropNode.parentPath;
			}

			// Calculate sortOrder and handle collisions with incremental updates
			if (position === 'above') {
				const prevSibling = targetIndex > 0 ? siblings[targetIndex - 1] : null;
				const prevOrder = prevSibling?.data?.sortOrder ?? 0;
				const targetOrder = dropNode.data?.sortOrder ?? 10;
				newSortOrder = Math.floor((prevOrder + targetOrder) / 2);

				// If collision, shift siblings from target onwards INCREMENTALLY
				if (newSortOrder === targetOrder || newSortOrder === prevOrder) {
					newSortOrder = targetOrder;
					const siblingsToUpdate = siblings.slice(targetIndex);
					const updates = siblingsToUpdate.map((s, idx) => ({
						operation: 'update' as const,
						path: s.path,
						data: { sortOrder: targetOrder + (idx + 1) * 10 }
					}));
					console.log('[applyChanges] Shifting siblings (above):', updates);
					const shiftResult = targetTreeRef.applyChanges(updates);
					addLog(`[Incremental] Shifted ${shiftResult.successful} siblings down`);

					// Update local data to match
					siblingsToUpdate.forEach((s, idx) => {
						const item = targetData.find(d => d.path === s.path);
						if (item) item.sortOrder = targetOrder + (idx + 1) * 10;
					});
				}
			} else if (position === 'below') {
				const nextSibling = targetIndex < siblings.length - 1 ? siblings[targetIndex + 1] : null;
				const targetOrder = dropNode.data?.sortOrder ?? 0;
				const nextOrder = nextSibling?.data?.sortOrder ?? targetOrder + 20;
				newSortOrder = Math.floor((targetOrder + nextOrder) / 2);

				// If collision, shift siblings from next onwards INCREMENTALLY
				if (newSortOrder === targetOrder || newSortOrder === nextOrder) {
					newSortOrder = targetOrder + 10;
					const siblingsToUpdate = siblings.slice(targetIndex + 1);
					if (siblingsToUpdate.length > 0) {
						const updates = siblingsToUpdate.map((s, idx) => ({
							operation: 'update' as const,
							path: s.path,
							data: { sortOrder: newSortOrder + (idx + 1) * 10 }
						}));
						console.log('[applyChanges] Shifting siblings (below):', updates);
						const shiftResult = targetTreeRef.applyChanges(updates);
						addLog(`[Incremental] Shifted ${shiftResult.successful} siblings down`);

						// Update local data to match
						siblingsToUpdate.forEach((s, idx) => {
							const item = targetData.find(d => d.path === s.path);
							if (item) item.sortOrder = newSortOrder + (idx + 1) * 10;
						});
					}
				}
			} else {
				// position === 'child'
				const children = targetTreeRef.getChildren(dropNode.path);
				newSortOrder = children.length > 0
					? Math.max(...children.map(c => c.data?.sortOrder || 0)) + 10
					: 10;
			}

			const newItem: FileItem = {
				id: itemId,
				path: parentPath ? `${parentPath}.${itemId}` : String(itemId),
				name: draggedNode.data?.name || 'Unknown',
				icon: draggedNode.data?.icon || '📄',
				sortOrder: newSortOrder
			};

			// INCREMENTAL: Add node without full tree rebuild
			const createChange = { operation: 'create' as const, parentPath: parentPath || '', data: newItem };
			console.log('[applyChanges] Creating node:', createChange);
			const result = targetTreeRef.applyChanges([createChange]);
			addLog(`[${operation.toUpperCase()}] Added ${position} "${dropNode.data?.name}" (order: ${newSortOrder}) - ${result.successful} ops`);

			// Keep local data in sync
			targetData = [...targetData, newItem];
		}
	}

	function handleSourceDrop(dropNode: LTreeNode<FileItem> | null, draggedNode: LTreeNode<FileItem>, position: string, event: DragEvent | TouchEvent, operation: DropOperation) {
		// Handle drops within source tree - move or copy based on operation
		if (!dropNode) {
			addLog(`Cannot drop at root level in source tree`);
			return;
		}

		if (operation === 'move') {
			// Use moveNode to actually reorganize the tree
			const result = sourceTreeRef.moveNode(
				draggedNode.path,
				dropNode.path,
				position as 'above' | 'below' | 'child'
			);

			if (result.success) {
				addLog(`Moved: "${draggedNode.data?.name}" ${position} "${dropNode.data?.name}"`);
			} else {
				addLog(`Error: ${result.error}`);
			}
		} else {
			// Copy - create new node with cloned data
			const parentPath = position === 'child' ? dropNode.path : (dropNode.parentPath || '');
			const newData: FileItem = {
				...draggedNode.data!,
				id: nextId++,
				path: '', // Will be set by addNode
				name: `${draggedNode.data?.name} (copy)`
			};
			const result = sourceTreeRef.addNode(parentPath, newData);

			if (result.success) {
				addLog(`Copied: "${draggedNode.data?.name}" ${position} "${dropNode.data?.name}"`);
			} else {
				addLog(`Error: ${result.error}`);
			}
		}
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
</script>

<svelte:head>
	<title>Drag & Drop Examples - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>🎯 Drag & Drop Examples</h1>
		<p class="subtitle">Desktop and mobile drag and drop between trees</p>
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
				<div class="tree-container tree-container-tall">
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
						onNodeDragStart={handleSourceDragStart}
						onNodeDrop={handleSourceDrop}
						{allowCopy}
						{dropZoneMode}
						{dropZoneLayout}
						{dropZoneStart}
						{dropZoneMaxWidth}
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
				<div class="tree-container tree-container-tall">
					<Tree
						bind:this={targetTreeRef}
						treeId="target-tree"
						data={targetData}
						idMember="id"
						pathMember="path"
						orderMember="sortOrder"
						sortCallback={sortByOrder}
						expandLevel={3}
						onNodeDrop={handleTargetDrop}
						shouldDisplayDebugInformation={true}
						{allowCopy}
						{dropZoneMode}
						{dropZoneLayout}
						{dropZoneStart}
						{dropZoneMaxWidth}
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
