<script lang="ts">
	import { onMount } from 'svelte';
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode, DropOperation, DropPosition } from '$lib/ltree/types.js';
	import RenderModeSwitch from '../RenderModeSwitch.svelte';
	import { getTreeProps } from '../render-mode.svelte.js';

	type FileItem = {
		id: number;
		path: string;
		name: string;
		icon: string;
		sortOrder: number;
		isDraggable?: boolean;
	};

	// Extended type with allowedDropPositions for restricted drop demo
	type RestrictedFileItem = FileItem & {
		allowedDropPositions?: DropPosition[];
	};

	// Source tree data. Most items are draggable; "File C" is pinned (not
	// draggable) to demo per-node opt-out under the new isDraggable=false default.
	// Draggability is resolved via getIsDraggableCallback below — items without
	// the field default to true; only explicit `false` opts out.
	let sourceData = $state<FileItem[]>([
		{ id: 1, path: '1', name: 'Source Folder', icon: '📁', sortOrder: 10 },
		{ id: 2, path: '1.1', name: 'File A', icon: '📄', sortOrder: 10 },
		{ id: 3, path: '1.2', name: 'File B', icon: '📄', sortOrder: 20 },
		{ id: 4, path: '1.3', name: '🔒 File C (pinned)', icon: '📄', sortOrder: 30, isDraggable: false },
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
	let isCopyAllowed = $state(false); // Enable Ctrl+drag to copy

	// Selection mode for the source tree. Defaulting to 'multi' so the new
	// multi-drag feature (drag the whole highlighted set with top-level
	// subtree absorption) is demoable. The library default is 'single'.
	let selectionMode = $state<'single' | 'multi'>('multi');

	// Bindable highlight sets so users can see what they're about to multi-drag
	// in each tree. The drag/drop logic in TreeController reads the same set
	// internally to decide whether a single-node drag should become a multi-drag.
	let sourceHighlightedPaths = $state(new Set<string>());
	let targetHighlightedPaths = $state(new Set<string>());
	let restrictedHighlightedPaths = $state(new Set<string>());

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
				if (config.isCopyAllowed !== undefined) isCopyAllowed = config.isCopyAllowed;
			} catch (e) {
				// Ignore invalid JSON
			}
		}
	});

	// Save settings to localStorage when they change
	$effect(() => {
		const config = { mode: dropZoneMode, layout: dropZoneLayout, start: dropZoneStart, maxWidth: dropZoneMaxWidth, isCopyAllowed };
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

	// Given a set of paths under a "." separator, return only the ones whose
	// nearest highlighted ancestor is NOT in the set — i.e. the top-level
	// subtrees. Mirrors the library's same-tree multi-drag absorption.
	function topLevelPaths(paths: string[], separator = '.'): string[] {
		const set = new Set(paths);
		return paths.filter((p) => {
			const parts = p.split(separator);
			for (let i = 1; i < parts.length; i++) {
				const ancestor = parts.slice(0, i).join(separator);
				if (set.has(ancestor)) return false;
			}
			return true;
		});
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
		let copyPosition: 'before' | 'after' | undefined;

		if (dropNode === null) {
			// Dropped on empty tree placeholder - add to root
			parentPath = '';
		} else if (position === 'child') {
			// Drop as child of target node
			parentPath = dropNode.path;
		} else {
			// Drop as sibling (before/after) - use target's parent
			parentPath = dropNode.parentPath || '';
			siblingPath = dropNode.path;
			copyPosition = position as 'before' | 'after';
		}

		// Multi-drag across trees: cross-tree multi-drag isn't auto-handled by the
		// library (the drop handler only receives one node ref). When the source
		// tree has a multi-highlight that includes the dragged node, copy each
		// top-level highlighted subtree in turn so the whole set rides along.
		// Filter out pinned nodes (isDraggable=false) — same predicate as the
		// tree's getIsDraggableCallback — so a locked node like "File C" that
		// happens to be in the highlight set doesn't ride along. (Same-tree
		// multi-drag enforces this inside the library; cross-tree is the
		// consumer's responsibility because only the lead node ref crosses.)
		const sourcePaths = (
			sourceHighlightedPaths.size > 1 && sourceHighlightedPaths.has(draggedNode.path)
				? topLevelPaths([...sourceHighlightedPaths])
				: [draggedNode.path]
		).filter((p) => sourceTreeRef.getNodeByPath(p)?.data?.isDraggable !== false);

		let copied = 0;
		let failed = 0;
		// First node uses the requested position relative to dropNode; subsequent
		// ones drop as children of dropNode so the whole set lands together.
		let firstSibling = siblingPath;
		let firstPos = copyPosition;
		// Re-number sortOrder across the batch so the dropped set keeps its source
		// order. Without this, siblings with equal sortOrder (e.g. File A=10 and
		// Document 1=10) interleave under the target's sortByOrder callback.
		let batchSort = 10;
		for (let i = 0; i < sourcePaths.length; i++) {
			const srcNode = sourceTreeRef.getNodeByPath(sourcePaths[i]);
			if (!srcNode) { failed++; continue; }
			const useParent = i === 0 ? parentPath : (dropNode ? dropNode.path : '');
			const useSibling = i === 0 ? firstSibling : undefined;
			const usePos = i === 0 ? firstPos : undefined;
			const rootSort = batchSort;
			batchSort += 10;
			const result = targetTreeRef.copyNodeWithDescendants(
				srcNode,
				useParent,
				(data: FileItem) => ({
					...data,
					id: nextId++,
					path: '',
					// Only the top-level node of each copied subtree gets the
					// batch-assigned sortOrder; descendants keep their original
					// relative ordering within their own subtree.
					sortOrder: data.id === srcNode.data?.id ? rootSort : (data.sortOrder || 10)
				}),
				useSibling,
				usePos
			);
			if (result.success) copied += result.count; else failed++;
		}

		if (failed === 0) {
			const label = sourcePaths.length > 1 ? `${sourcePaths.length} subtrees (${copied} nodes)` : `${copied} node(s)`;
			addLog(`[CROSS-TREE] Copied ${label} to "${parentPath || 'root'}"${siblingPath ? ` ${copyPosition} "${siblingPath}"` : ''}`);
		} else {
			addLog(`Error: ${failed} of ${sourcePaths.length} subtree(s) failed to copy`);
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

		// Create 10 root folders with sortOrder. Every 7th item is pinned
		// (not draggable) so the demo shows the per-node opt-out at scale.
		let counter = 0;
		const pin = () => (++counter % 7 === 0 ? { isDraggable: false } : {});
		for (let i = 1; i <= 10; i++) {
			nodes.push({ id: id++, path: `${i}`, name: `Folder ${i}`, icon: '📁', sortOrder: i * 10, ...pin() });

			// Each root has 3 subfolders
			for (let j = 1; j <= 3; j++) {
				nodes.push({ id: id++, path: `${i}.${j}`, name: `Subfolder ${i}.${j}`, icon: '📂', sortOrder: j * 10, ...pin() });

				// Each subfolder has 2-3 files
				for (let k = 1; k <= 2 + (i % 2); k++) {
					nodes.push({ id: id++, path: `${i}.${j}.${k}`, name: `File ${i}.${j}.${k}`, icon: '📄', sortOrder: k * 10, ...pin() });
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
		// Trash folder: only accepts drops as children, and itself is pinned
		// (not draggable) — you can drop INTO it but not move the folder around.
		{ id: 101, path: '1', name: '🗑️ Trash (pinned)', icon: '', sortOrder: 10, allowedDropPositions: ['child'], isDraggable: false },
		{ id: 102, path: '1.1', name: 'Deleted Item 1', icon: '📄', sortOrder: 10 },
		{ id: 103, path: '1.2', name: 'Deleted Item 2', icon: '📄', sortOrder: 20 },

		// Regular folder: all drop positions allowed (default)
		{ id: 104, path: '2', name: '📁 Projects', icon: '', sortOrder: 20 },
		{ id: 105, path: '2.1', name: 'Project A', icon: '📂', sortOrder: 10 },
		{ id: 106, path: '2.2', name: 'Project B', icon: '📂', sortOrder: 20 },

		// Files: only accept drops before/after (can't drop INTO a file)
		{ id: 107, path: '3', name: '📄 Readme.md', icon: '', sortOrder: 30, allowedDropPositions: ['before', 'after'] },
		{ id: 108, path: '4', name: '📄 Config.json', icon: '', sortOrder: 40, allowedDropPositions: ['before', 'after'] },

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

	// === Touch Drag Demo ===
	let touchData = $state<FileItem[]>([
		{ id: 501, path: '1', name: 'Inbox', icon: '📥', sortOrder: 10 },
		{ id: 502, path: '1.1', name: 'New Message', icon: '✉️', sortOrder: 10 },
		{ id: 503, path: '1.2', name: 'Newsletter', icon: '📰', sortOrder: 20 },
		{ id: 504, path: '2', name: 'Archive', icon: '📦', sortOrder: 20 },
		{ id: 505, path: '2.1', name: 'Old Stuff', icon: '📜', sortOrder: 10 },
		{ id: 506, path: '3', name: '🔒 Drafts (pinned)', icon: '📝', sortOrder: 30, isDraggable: false },
	]);
	let touchLog = $state<string[]>([]);

	function addTouchLog(message: string) {
		touchLog = [...touchLog.slice(-9), `${new Date().toLocaleTimeString()} - ${message}`];
	}

	function handleTouchDragStart(node: LTreeNode<FileItem>, event: DragEvent) {
		addTouchLog(`dragStart: "${node.data?.name}"`);
	}

	function handleTouchDrop(dropNode: LTreeNode<FileItem> | null, draggedNode: LTreeNode<FileItem>, position: string, event: DragEvent | TouchEvent, operation: DropOperation) {
		addTouchLog(`drop: "${draggedNode.data?.name}" ${position} "${dropNode?.data?.name || 'root'}"`);
	}

	// Attach document-level touch logging to debug DevTools emulation
	onMount(() => {
		const touchTree = document.querySelector('.touch-demo-tree');
		if (!touchTree) return;

		touchTree.addEventListener('touchstart', (e) => {
			const touch = (e as TouchEvent).touches[0];
			addTouchLog(`touchstart: (${Math.round(touch.clientX)}, ${Math.round(touch.clientY)})`);
		}, { passive: true });

		touchTree.addEventListener('touchmove', (e) => {
			const touch = (e as TouchEvent).touches[0];
			addTouchLog(`touchmove: (${Math.round(touch.clientX)}, ${Math.round(touch.clientY)})`);
		}, { passive: false });

		touchTree.addEventListener('touchend', (e) => {
			const touch = (e as TouchEvent).changedTouches[0];
			addTouchLog(`touchend: (${Math.round(touch.clientX)}, ${Math.round(touch.clientY)})`);
		});

		touchTree.addEventListener('touchcancel', () => {
			addTouchLog(`touchcancel`);
		});
	});

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
			With <code>selectionMode="multi"</code> (default below), Ctrl/Shift+click multiple nodes
			and drag any one of them — the whole highlight set moves together (top-level subtrees
			only; descendants ride along inside).
			<strong>Target tree (right):</strong> Drag from source to add nodes. Starts empty to demo drop placeholder.
			Once it has nodes, multi-drag works inside the target tree the same way.
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
						<option value="around">Around (before + after/child)</option>
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
				<input type="checkbox" bind:checked={isCopyAllowed} />
				Allow Ctrl+drag to copy
			</label>
			<label style="display: flex; align-items: center; gap: 0.5rem;">
				Selection mode:
				<select bind:value={selectionMode}>
					<option value="single">single (one highlight; one node per drag)</option>
					<option value="multi">multi (Ctrl/Shift+click; drag the whole highlight set)</option>
				</select>
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
						getIsDraggableCallback={(node) => node.data?.isDraggable !== false}
						getIsDropAllowedCallback={() => true}
						sortCallback={sortByOrder}
						isSorted={true}
						expandLevel={3}
						dragDropMode="both"
						{selectionMode}
						highlightedNodeClass="stv__node-content--highlight-bold"
						bind:highlightedPaths={sourceHighlightedPaths}
						onNodeDragStart={handleSourceDragStart}
						onNodeDrop={handleSourceDrop}
						{isCopyAllowed}
						{dropZoneMode}
						{dropZoneLayout}
						{dropZoneStart}
						{dropZoneMaxWidth}
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
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
						getIsDraggableCallback={(node) => node.data?.isDraggable !== false}
						getIsDropAllowedCallback={() => true}
						sortCallback={sortByOrder}
						expandLevel={3}
						dragDropMode="both"
						{selectionMode}
						highlightedNodeClass="stv__node-content--highlight-bold"
						bind:highlightedPaths={targetHighlightedPaths}
						onNodeDrop={handleTargetDrop}
						shouldDisplayDebugInformation={true}
						{isCopyAllowed}
						{dropZoneMode}
						{dropZoneLayout}
						{dropZoneStart}
						{dropZoneMaxWidth}
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
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

		{#if sourceHighlightedPaths.size > 0}
			<div class="output">
				<p class="output-label">Source highlight ({sourceHighlightedPaths.size}) — dragging any of these moves the whole set</p>
				<pre>{[...sourceHighlightedPaths].join(', ')}</pre>
			</div>
		{/if}

		{#if targetHighlightedPaths.size > 0}
			<div class="output">
				<p class="output-label">Target highlight ({targetHighlightedPaths.size}) — dragging any of these moves the whole set within the target tree</p>
				<pre>{[...targetHighlightedPaths].join(', ')}</pre>
			</div>
		{/if}

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
			Try dragging items to different targets. With <code>selectionMode="multi"</code>, Ctrl/Shift+click
			several items first and drag any one of them to move the whole set — per-node
			<code>allowedDropPositions</code> are still enforced on the drop target.
		</p>

		<div class="note">
			<p class="note-title">Node Types</p>
			<ul>
				<li><strong>🗑️ Trash</strong> - Only accepts <code>child</code> drops (drop INTO, not before/after)</li>
				<li><strong>📁 Projects</strong> - All positions allowed (default behavior)</li>
				<li><strong>📄 Files</strong> - Only <code>before</code> and <code>after</code> (can't drop INTO a file)</li>
			</ul>
		</div>

		<div class="tree-container tree-container-tall">
			<Tree
				bind:this={restrictedTreeRef}
				treeId="restricted-tree"
				data={restrictedData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				getIsDraggableCallback={(node) => node.data?.isDraggable !== false}
				getIsDropAllowedCallback={() => true}
				allowedDropPositionsMember="allowedDropPositions"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={3}
				dragDropMode="self"
				{selectionMode}
				highlightedNodeClass="stv__node-content--highlight-bold"
				bind:highlightedPaths={restrictedHighlightedPaths}
				onNodeDrop={handleRestrictedDrop}
				{dropZoneMode}
				{dropZoneLayout}
				{...getTreeProps()}
			>
				{#snippet nodeTemplate(node: any)}
					<span>{node.data?.icon} {node.data?.name}</span>
					{#if node.data?.allowedDropPositions}
						<small style="color: #888; margin-left: 0.5rem; font-size: 0.7em;">
							({node.data.allowedDropPositions.join('/')})
						</small>
					{/if}
				{/snippet}
			</Tree>
		</div>

		{#if restrictedHighlightedPaths.size > 0}
			<div class="output">
				<p class="output-label">Highlight ({restrictedHighlightedPaths.size}) — drag any of these to move the whole set (per-node <code>allowedDropPositions</code> still apply)</p>
				<pre>{[...restrictedHighlightedPaths].join(', ')}</pre>
			</div>
		{/if}

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
  { id: 3, name: '📄 Readme.md', allowedDropPositions: ['before', 'after'] },
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

		<div class="tree-container touch-demo-tree" style="max-height: 260px;">
			<Tree
				data={touchData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				displayValueMember="name"
				getIsDraggableCallback={(node) => node.data?.isDraggable !== false}
				getIsDropAllowedCallback={() => true}
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={3}
				dragDropMode="self"
				shouldDisplayDebugInformation={true}
				onNodeDragStart={handleTouchDragStart}
				onNodeDrop={handleTouchDrop}
				{...getTreeProps()}
			>
				{#snippet nodeTemplate(node: any)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>

		<div class="activity-log" style="margin-top: 0.75rem; min-height: 3rem;">
			{#if touchLog.length === 0}
				<div class="log-entry" style="color: #999;">Touch events will appear here...</div>
			{:else}
				{#each touchLog as entry}
					<div class="log-entry">{entry}</div>
				{/each}
			{/if}
		</div>

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
  dragDropMode="self"
  sortCallback={sortByOrder}
  onNodeDrop={(dropNode, draggedNode, position, event, operation) => {
    // Handle the drop - position is 'before', 'after', or 'child'
    console.log('Dropped:', draggedNode.data?.name);
    console.log('Position:', position);
    console.log('Operation:', operation); // 'move' or 'copy'
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
			<p>The <code>position</code> parameter indicates where to drop: <code>'before'</code>, <code>'after'</code>, or <code>'child'</code>. The <code>operation</code> parameter is <code>'move'</code> or <code>'copy'</code> (Ctrl+drag):</p>
			<pre style="margin-top: 0.5rem;">{`onNodeDrop={(dropNode, draggedNode, position, event, operation) => {
  if (dropNode === null) {
    // Dropped on empty tree placeholder or root drop zone
    // Add as root node
  } else {
    // position: 'before' - insert as sibling before dropNode
    // position: 'after' - insert as sibling after dropNode
    // position: 'child' - insert as child of dropNode
  }
  // operation: 'move' (default) or 'copy' (Ctrl+drag with isCopyAllowed)
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
					<td>Drag and drop is disabled (default)</td>
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
					<td>Allow both self and cross-tree drag and drop</td>
				</tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`<!-- Only allow drops from other trees -->
<Tree
  data={targetData}
  dragDropMode="cross"
  onNodeDrop={(dropNode, draggedNode, position, event, operation) => {
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
					<td><code>stv__node-content--dragover-highlight</code></td>
					<td>Dragging over a node</td>
					<td>Highlights the drop target with a background color</td>
				</tr>
				<tr>
					<td><code>stv__node-content--dragover-glow</code></td>
					<td>Dragging over a node</td>
					<td>Alternative glow effect for drop target</td>
				</tr>
				<tr>
					<td><code>stv__drop-placeholder</code></td>
					<td>Dragging over empty tree</td>
					<td>Styles the drop placeholder area</td>
				</tr>
				<tr>
					<td><code>stv__drop-zones</code></td>
					<td>Drag in progress over a node</td>
					<td>Container for floating drop zone buttons (before/child/after)</td>
				</tr>
				<tr>
					<td><code>stv__drop-zone--before</code></td>
					<td>Position indicator active</td>
					<td>Shows drop will insert before the node</td>
				</tr>
				<tr>
					<td><code>stv__drop-zone--child</code></td>
					<td>Position indicator active</td>
					<td>Shows drop will insert as child of the node</td>
				</tr>
				<tr>
					<td><code>stv__drop-zone--after</code></td>
					<td>Position indicator active</td>
					<td>Shows drop will insert after the node</td>
				</tr>
				<tr>
					<td><code>stv__node-content--glow-before</code></td>
					<td>Glow mode: drop position is "before"</td>
					<td>Top border glow with arrow indicator</td>
				</tr>
				<tr>
					<td><code>stv__node-content--glow-after</code></td>
					<td>Glow mode: drop position is "after"</td>
					<td>Bottom border glow with arrow indicator</td>
				</tr>
				<tr>
					<td><code>stv__node-content--glow-child</code></td>
					<td>Glow mode: drop position is "child"</td>
					<td>Right border glow with background tint</td>
				</tr>
				<tr>
					<td><code>stv__touch-ghost</code></td>
					<td>Touch drag in progress</td>
					<td>Styles the ghost element following the finger</td>
				</tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`/* Customize drag-over highlight */
:global(.stv__node-content--dragover-highlight) {
  background-color: rgba(102, 126, 234, 0.2) !important;
  border-radius: 4px;
}

/* Customize touch ghost */
:global(.stv__touch-ghost) {
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
