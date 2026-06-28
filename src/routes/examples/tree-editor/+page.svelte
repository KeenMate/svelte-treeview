<script lang="ts">
	import { onMount } from 'svelte';
	import Tree from '$lib/components/Tree.svelte';
	import type { TreeController } from '$lib/core/TreeController.svelte.js';
	import type { LTreeNode, DropPosition } from '$lib/ltree/types.js';
	import RenderModeSwitch from '../RenderModeSwitch.svelte';
	import { getTreeProps } from '../render-mode.svelte.js';

	interface EditorNode {
		id: number;
		path: string;
		name: string;
		type: string;
		icon: string;
		sortOrder: number;
	}

	// Sample editable tree data with sort order
	let treeData = $state<EditorNode[]>([
		{ id: 1, path: '1', name: 'Root Folder', type: 'folder', icon: '📁', sortOrder: 10 },
		{ id: 2, path: '1.1', name: 'Documents', type: 'folder', icon: '📂', sortOrder: 10 },
		{ id: 8, path: '1.1.1', name: 'Report.pdf', type: 'file', icon: '📄', sortOrder: 10 },
		{ id: 9, path: '1.1.2', name: 'Notes.txt', type: 'file', icon: '📄', sortOrder: 20 },
		{ id: 10, path: '1.1.3', name: 'Budget.xlsx', type: 'file', icon: '📄', sortOrder: 30 },
		{ id: 3, path: '1.2', name: 'Images', type: 'folder', icon: '📂', sortOrder: 20 },
		{ id: 11, path: '1.2.1', name: 'Vacation.jpg', type: 'image', icon: '🖼️', sortOrder: 10 },
		{ id: 12, path: '1.2.2', name: 'Logo.png', type: 'image', icon: '🖼️', sortOrder: 20 },
		{ id: 13, path: '1.2.3', name: 'Screenshot.png', type: 'image', icon: '🖼️', sortOrder: 30 },
		{ id: 4, path: '1.3', name: 'Music', type: 'folder', icon: '📂', sortOrder: 30 },
		{ id: 14, path: '1.3.1', name: 'Chill Mix.mp3', type: 'audio', icon: '🎵', sortOrder: 10 },
		{ id: 15, path: '1.3.2', name: 'Focus.mp3', type: 'audio', icon: '🎵', sortOrder: 20 },
		{ id: 5, path: '2', name: 'Projects', type: 'folder', icon: '📁', sortOrder: 20 },
		{ id: 6, path: '2.1', name: 'Web App', type: 'folder', icon: '📂', sortOrder: 10 },
		{ id: 16, path: '2.1.1', name: 'index.html', type: 'file', icon: '📄', sortOrder: 10 },
		{ id: 17, path: '2.1.2', name: 'styles.css', type: 'file', icon: '📄', sortOrder: 20 },
		{ id: 18, path: '2.1.3', name: 'app.js', type: 'file', icon: '📄', sortOrder: 30 },
		{ id: 7, path: '2.2', name: 'Mobile App', type: 'folder', icon: '📂', sortOrder: 20 },
		{ id: 19, path: '2.2.1', name: 'Main.swift', type: 'file', icon: '📄', sortOrder: 10 },
		{ id: 20, path: '2.2.2', name: 'icon.png', type: 'image', icon: '🖼️', sortOrder: 20 }
	]);

	let treeRef: Tree<EditorNode>;
	let selectedNode = $state<LTreeNode<EditorNode> | null>(null);
	// Multi-select highlight set (Ctrl/Cmd+click, Shift+click, Shift+Arrow).
	let highlightedPaths = $state<Set<string>>(new Set());
	// Paths currently dimmed because they were cut and await paste. The library
	// tracks an equivalent set on the controller (controller.cutPaths) but doesn't
	// render it, so we mirror it here and dim via the nodeTemplate.
	let cutPaths = $state<Set<string>>(new Set());
	let activityLog = $state<string[]>([]);
	let dropWarning = $state<string | null>(null);
	let nextId = 200;

	// ── Clipboard wiring (Ctrl/Cmd + C / X / V) ──────────────────────────────
	// The controller implements the clipboard operations (copyNodes / cutNodes /
	// pasteNodes / cancelCut) and a shared cross-tree clipboard; the key bindings
	// are left to the consumer because paste needs an app-specific transform
	// (fresh ids) and a target. We wire them through onTreeKeydown.

	// Copy/cut operate on the highlight set when present, else the focused node.
	function clipboardPaths(controller: TreeController<EditorNode>): string[] {
		if (controller.highlightedPaths.size > 0) return [...controller.highlightedPaths];
		return selectedNode ? [selectedNode.path] : [];
	}

	// Every pasted node (root + descendants) gets a fresh id; path is assigned by
	// addNode. Reusing ids would collide with existing nodes.
	function transformPasted(data: EditorNode): EditorNode {
		return { ...data, id: nextId++, path: '' };
	}

	// "Node1" → "Node1 Copy 1" → "Node1 Copy 2" … until the name is free among the
	// target's existing children. The leading `replace` strips any prior " Copy N"
	// so repeated pastes stay "Copy 1 / 2 / 3" instead of compounding into
	// "Copy 1 Copy 1 …" (a copy persists on the clipboard, and beforePaste mutates
	// its name, so the same entry is re-renamed on every paste).
	function uniqueCopyName(name: string, taken: Set<string>): string {
		const stem = name.replace(/ Copy \d+$/, '');
		if (!taken.has(stem)) return stem;
		let n = 1;
		while (taken.has(`${stem} Copy ${n}`)) n++;
		return `${stem} Copy ${n}`;
	}

	// beforePasteCallback: a pre-paste interceptor with the target path + clipboard
	// entries. Runs BEFORE the paste-into-self guard, so it can both redirect the
	// target and rename entries. Two behaviours for COPY:
	//   1. "Duplicate in the same folder" — Ctrl+C then Ctrl+V without moving focus
	//      pastes onto the copied node itself; redirect into its parent so the copy
	//      lands as a sibling (like duplicating a file in its own directory).
	//   2. "Copy N" suffix when the name already exists under the (final) target.
	// Only the root entry is renamed; descendants keep their names. Cut (move) is
	// left untouched. Mutating entry.data here is seen by the transformPasted/addNode pass.
	function beforePaste(
		targetPath: string,
		operation: 'copy' | 'cut',
		entries: { data: EditorNode; sourcePath: string }[]
	): { targetPath?: string } | void {
		if (operation !== 'copy') return;

		// 1. Pasting onto the copied node itself → redirect to its parent.
		let redirect: { targetPath?: string } | undefined;
		if (targetPath && entries.some((e) => e.sourcePath === targetPath)) {
			targetPath = treeRef.getNodeByPath(targetPath)?.parentPath ?? '';
			redirect = { targetPath };
		}

		// 2. "Copy N" naming against the (possibly redirected) target's children.
		const taken = new Set(treeRef.getChildren(targetPath).map((c) => c.data?.name ?? ''));
		for (const entry of entries) {
			const name = uniqueCopyName(entry.data.name, taken);
			entry.data = { ...entry.data, name };
			taken.add(name);
		}

		return redirect;
	}

	function handleTreeKeydown(event: KeyboardEvent, controller: TreeController<EditorNode>): boolean {
		// Ctrl on Windows/Linux, Cmd (metaKey) on macOS.
		const mod = event.ctrlKey || event.metaKey;
		const key = event.key.toLowerCase();

		// Success logging lives in the onCopy / onCut / onPaste callbacks below;
		// here we only map keys → operations (and report the can't-act cases).
		if (mod && key === 'c') {
			const paths = clipboardPaths(controller);
			if (!paths.length) { addLog('Nothing selected to copy'); return true; }
			controller.copyNodes(paths);
			cutPaths = new Set(); // copying supersedes any pending cut
			return true;
		}

		if (mod && key === 'x') {
			const paths = clipboardPaths(controller);
			if (!paths.length) { addLog('Nothing selected to cut'); return true; }
			controller.cutNodes(paths);
			cutPaths = new Set(controller.cutPaths); // mirror dim set for the template
			return true;
		}

		if (mod && key === 'v') {
			if (!controller.hasClipboardContent()) { addLog('Clipboard is empty'); return true; }
			controller.pasteNodes(selectedNode?.path ?? '', transformPasted, 'child');
			cutPaths = new Set();
			return true;
		}

		// Clear our cut-dimming alongside the library's Escape→cancel-cut.
		if (event.key === 'Escape' && cutPaths.size > 0) {
			controller.cancelCut();
			cutPaths = new Set();
			addLog('Cut cancelled');
			return true;
		}

		return false; // let the tree handle everything else
	}

	// Form state for adding nodes
	let newNodeName = $state('');
	let newNodeIcon = $state('📄');

	const iconToType: Record<string, string> = {
		'📄': 'file', '📁': 'folder', '📂': 'folder', '🖼️': 'image',
		'🎵': 'audio', '📝': 'note', '🚀': 'project'
	};

	// Drop zone configuration (with localStorage persistence)
	let dropZoneMode = $state<'floating' | 'glow'>('floating');
	let dropZoneLayout = $state<'around' | 'above' | 'below' | 'wave' | 'wave2'>('wave');
	let dropZoneStart = $state<number | string>('50%');
	let dropZoneMaxWidth = $state(120);

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
			} catch (e) {
				// Ignore invalid JSON
			}
		}
	});

	// Save settings to localStorage when they change
	$effect(() => {
		const config = { mode: dropZoneMode, layout: dropZoneLayout, start: dropZoneStart, maxWidth: dropZoneMaxWidth };
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
			type: iconToType[newNodeIcon] || 'file',
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
		const result = treeRef.moveNode(selectedNode.path, targetNode.path, 'before');

		if (result.success) {
			addLog(`Moved "${selectedNode.data?.name}" before "${targetNode.data?.name}"`);
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
		const result = treeRef.moveNode(selectedNode.path, targetNode.path, 'after');

		if (result.success) {
			addLog(`Moved "${selectedNode.data?.name}" after "${targetNode.data?.name}"`);
		} else {
			addLog(`Error: ${result.error}`);
		}
	}

	async function beforeDrop(dropNode: LTreeNode<EditorNode> | null, draggedNode: LTreeNode<EditorNode>, position: string, event: DragEvent | TouchEvent): Promise<boolean | { position: DropPosition } | void> {
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
				return { position: 'after' as DropPosition };
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
			position as 'before' | 'after' | 'child'
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
			{ id: 1, path: '1', name: 'Root Folder', type: 'folder', icon: '📁', sortOrder: 10 },
			{ id: 2, path: '1.1', name: 'Documents', type: 'folder', icon: '📂', sortOrder: 10 },
			{ id: 8, path: '1.1.1', name: 'Report.pdf', type: 'file', icon: '📄', sortOrder: 10 },
			{ id: 9, path: '1.1.2', name: 'Notes.txt', type: 'file', icon: '📄', sortOrder: 20 },
			{ id: 10, path: '1.1.3', name: 'Budget.xlsx', type: 'file', icon: '📄', sortOrder: 30 },
			{ id: 3, path: '1.2', name: 'Images', type: 'folder', icon: '📂', sortOrder: 20 },
			{ id: 11, path: '1.2.1', name: 'Vacation.jpg', type: 'image', icon: '🖼️', sortOrder: 10 },
			{ id: 12, path: '1.2.2', name: 'Logo.png', type: 'image', icon: '🖼️', sortOrder: 20 },
			{ id: 13, path: '1.2.3', name: 'Screenshot.png', type: 'image', icon: '🖼️', sortOrder: 30 },
			{ id: 4, path: '1.3', name: 'Music', type: 'folder', icon: '📂', sortOrder: 30 },
			{ id: 14, path: '1.3.1', name: 'Chill Mix.mp3', type: 'audio', icon: '🎵', sortOrder: 10 },
			{ id: 15, path: '1.3.2', name: 'Focus.mp3', type: 'audio', icon: '🎵', sortOrder: 20 },
			{ id: 5, path: '2', name: 'Projects', type: 'folder', icon: '📁', sortOrder: 20 },
			{ id: 6, path: '2.1', name: 'Web App', type: 'folder', icon: '📂', sortOrder: 10 },
			{ id: 16, path: '2.1.1', name: 'index.html', type: 'file', icon: '📄', sortOrder: 10 },
			{ id: 17, path: '2.1.2', name: 'styles.css', type: 'file', icon: '📄', sortOrder: 20 },
			{ id: 18, path: '2.1.3', name: 'app.js', type: 'file', icon: '📄', sortOrder: 30 },
			{ id: 7, path: '2.2', name: 'Mobile App', type: 'folder', icon: '📂', sortOrder: 20 },
			{ id: 19, path: '2.2.1', name: 'Main.swift', type: 'file', icon: '📄', sortOrder: 10 },
			{ id: 20, path: '2.2.2', name: 'icon.png', type: 'image', icon: '🖼️', sortOrder: 20 }
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
			Click to select a node (double-click to expand), then use the controls to add
			children, remove, or reorder. <strong>Ctrl/Cmd+click</strong> or
			<strong>Shift+click</strong> to multi-select, then <strong>Ctrl/Cmd+C / X / V</strong>
			to copy, cut, and paste — paste lands under the focused node (or at root), and a
			pasted copy whose name already exists there becomes <em>"Name Copy 1"</em>, <em>"Name Copy 2"</em>, …. Copying a
			node and pasting it without moving (<strong>Ctrl/Cmd+C</strong> then
			<strong>Ctrl/Cmd+V</strong>) drops the copy next to it in the same folder. Cut nodes
			dim until pasted; <strong>Esc</strong> cancels a pending cut. Drag and drop also moves nodes.
		</p>

		<div class="editor-layout">
			<div class="tree-section">
				<div class="tree-container" class:tree-container-tall={!getTreeProps().isVirtualScrollEnabled}>
					<Tree
						bind:this={treeRef}
						data={treeData}
						idMember="id"
						pathMember="path"
						orderMember="sortOrder"
						sortCallback={sortByOrder}
						isSorted={true}
						expandLevel={3}
						clickBehavior="select"
						selectionMode="multi"
						dragDropMode="both"
						getIsDraggableCallback={() => true}
						getIsDropAllowedCallback={() => true}
						bind:focusedNode={selectedNode}
						bind:highlightedPaths={highlightedPaths}
						onTreeKeydown={handleTreeKeydown}
						onCopy={(paths) => addLog(`Copied ${paths.length} node(s) to clipboard`)}
						onCut={(paths) => addLog(`Cut ${paths.length} node(s) — paste to move`)}
						onPaste={(result) => addLog(result.success ? `Pasted ${result.count} node(s)` : `Paste failed: ${result.error}`)}
						beforePasteCallback={beforePaste}
						beforeDropCallback={beforeDrop}
						onNodeDrop={handleDrop}
						onNodeDragStart={handleDragStart}
						{dropZoneMode}
						{dropZoneLayout}
						{dropZoneStart}
						{dropZoneMaxWidth}
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
							<span
								class:selected-node={selectedNode?.path === node.path}
								class:cut-dimmed={cutPaths.has(node.path)}
							>
								{node.data?.icon} {node.data?.name}
								<span class="node-type">{node.data?.type}</span>
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
						<select bind:value={dropZoneMode} style="flex: 1;">
							<option value="floating">Floating</option>
							<option value="glow">Glow</option>
						</select>
					</div>
					<div class="input-row">
						<label style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
							Start:
							<input type="text" bind:value={dropZoneStart} placeholder="50% or 50px" style="width: 80px;" />
						</label>
					</div>
					{#if dropZoneMode === 'floating'}
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
								Max W:
								<input type="number" bind:value={dropZoneMaxWidth} min="50" max="300" style="width: 60px;" />
							</label>
						</div>
					{/if}
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
					<td>Move a node to a new location ('before', 'after', 'child')</td>
				</tr>
				<tr>
					<td><code>removeNode(path, includeDescendants?)</code></td>
					<td>Remove a node (and optionally its descendants)</td>
				</tr>
				<tr>
					<td><code>updateNode(path, dataUpdates)</code></td>
					<td>Update data properties of a node in place</td>
				</tr>
				<tr>
					<td><code>copyNodeWithDescendants(node, parentPath, transformFn)</code></td>
					<td>Deep-copy a node and its subtree under a new parent</td>
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
				<tr>
					<td><code>refreshNode(path)</code></td>
					<td>Force re-render of a single node</td>
				</tr>
				<tr>
					<td><code>getExpandedPaths()</code></td>
					<td>Get all currently expanded node paths</td>
				</tr>
				<tr>
					<td><code>setExpandedPaths(paths)</code></td>
					<td>Restore expanded state from a saved list of paths</td>
				</tr>
				<tr>
					<td><code>getAllData()</code></td>
					<td>Get all node data as a flat array</td>
				</tr>
			</tbody>
		</table>

		<div class="note">
			<p class="note-title">orderMember Prop</p>
			<p>
				For proper before/after positioning, set the <code>orderMember</code> prop to specify
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
  import { Tree } from '@keenmate/svelte-treeview';
  import type { LTreeNode, DropPosition, DropOperation } from '@keenmate/svelte-treeview';

  interface MyNode {
    id: number;
    path: string;
    name: string;
    sortOrder: number;
  }

  let treeRef: Tree<MyNode>;
  let selectedNode = $state<LTreeNode<MyNode> | null>(null);

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

  // Move node before sibling
  function moveUp() {
    if (!selectedNode) return;
    const siblings = treeRef.getSiblings(selectedNode.path);
    const index = siblings.findIndex(s => s.path === selectedNode!.path);
    if (index > 0) {
      treeRef.moveNode(selectedNode.path, siblings[index - 1].path, 'before');
    }
  }

  // Remove selected node
  function remove() {
    if (!selectedNode) return;
    treeRef.removeNode(selectedNode.path);
    selectedNode = null;
  }

  // Handle drag-drop
  // dragDropMode: 'none' | 'self' | 'cross' | 'both'
  //   none  — disabled (default)
  //   self  — reorder within same tree only
  //   cross — between different trees only
  //   both  — same-tree and cross-tree
  function handleDrop(
    dropNode: LTreeNode<MyNode> | null,
    draggedNode: LTreeNode<MyNode>,
    position: DropPosition,
    event: DragEvent | TouchEvent,
    operation: DropOperation
  ) {
    if (dropNode) {
      treeRef.moveNode(draggedNode.path, dropNode.path, position);
    }
  }
<\/script>

<Tree
  bind:this={treeRef}
  data={data}
  orderMember="sortOrder"
  dragDropMode="both"
  onNodeDrop={handleDrop}
  bind:focusedNode={selectedNode}
>
  {#snippet nodeTemplate(node: any)}
    <span>{node.data?.name}</span>
  {/snippet}
</Tree>`}</pre>
		</div>
	</div>

	<!-- Multi-select + Clipboard -->
	<div class="card">
		<h2>Multi-select &amp; Clipboard (Ctrl/Cmd + C / X / V)</h2>
		<p class="description">
			The controller implements the clipboard operations and a shared cross-tree
			clipboard; the key bindings are left to you via <code>onTreeKeydown</code>
			because paste needs an app-specific transform (fresh ids) and a target path.
			Enable multi-select with <code>selectionMode="multi"</code>, then wire the
			shortcuts to <code>controller.copyNodes / cutNodes / pasteNodes</code>.
		</p>

		<div class="code-block">
			<pre>{`import type { TreeController } from '@keenmate/svelte-treeview';

let focusedNode = $state<LTreeNode<MyNode> | null>(null);
let highlightedPaths = $state<Set<string>>(new Set());
let cutPaths = $state<Set<string>>(new Set());
let nextId = 1000;

// Copy/cut act on the highlight set when present, else the focused node.
function clipboardPaths(controller: TreeController<MyNode>) {
  if (controller.highlightedPaths.size > 0) return [...controller.highlightedPaths];
  return focusedNode ? [focusedNode.path] : [];
}

// Every pasted node (root + descendants) needs a fresh id; path is set by addNode.
function transformPasted(data: MyNode): MyNode {
  return { ...data, id: nextId++, path: '' };
}

// beforePasteCallback runs BEFORE the paste-into-self guard, so it can redirect
// the target AND rename entries. For a COPY:
//   1. pasting onto the copied node itself (Ctrl+C then Ctrl+V, no move) →
//      redirect into its parent so the copy lands as a sibling (same-folder dup);
//   2. give the copy a "Copy N" suffix when its name already exists there.
function beforePaste(targetPath, operation, entries) {
  if (operation !== 'copy') return;               // a move (cut) keeps its name + target
  let redirect;
  if (targetPath && entries.some(e => e.sourcePath === targetPath)) {
    targetPath = treeRef.getNodeByPath(targetPath)?.parentPath ?? '';
    redirect = { targetPath };
  }
  const taken = new Set(treeRef.getChildren(targetPath).map(c => c.data?.name));
  for (const entry of entries) {
    // strip a prior " Copy N" so repeats stay Copy 1 / 2 / 3 (the copy persists on
    // the clipboard and this mutates its name, so the same entry is re-renamed).
    const stem = entry.data.name.replace(/ Copy \\d+$/, '');
    let name = stem, n = 1;
    while (taken.has(name)) name = \`\${stem} Copy \${n++}\`;
    entry.data = { ...entry.data, name };
    taken.add(name);
  }
  return redirect;                                // change the paste target, or undefined
}

function handleKeydown(event: KeyboardEvent, controller: TreeController<MyNode>) {
  const mod = event.ctrlKey || event.metaKey;  // Ctrl on Win/Linux, Cmd on macOS
  const key = event.key.toLowerCase();

  if (mod && key === 'c') {
    controller.copyNodes(clipboardPaths(controller));
    cutPaths = new Set();                         // copy supersedes a pending cut
    return true;
  }
  if (mod && key === 'x') {
    controller.cutNodes(clipboardPaths(controller));
    cutPaths = new Set(controller.cutPaths);      // mirror dim set for the template
    return true;
  }
  if (mod && key === 'v') {
    if (!controller.hasClipboardContent()) return true;
    controller.pasteNodes(focusedNode?.path ?? '', transformPasted, 'child');
    cutPaths = new Set();
    return true;
  }
  if (event.key === 'Escape' && cutPaths.size > 0) {
    controller.cancelCut();
    cutPaths = new Set();
    return true;
  }
  return false;  // let the tree handle everything else
}`}</pre>
		</div>

		<div class="code-block" style="margin-top: 1rem;">
			<pre>{`<Tree
  bind:this={treeRef}
  data={data}
  clickBehavior="select"            // click selects, double-click expands
  selectionMode="multi"             // Ctrl/Cmd+click & Shift+click extend the set
  bind:focusedNode={focusedNode}
  bind:highlightedPaths={highlightedPaths}
  onTreeKeydown={handleKeydown}
  onCopy={(paths) => log(\`copied \${paths.length}\`)}
  onCut={(paths) => log(\`cut \${paths.length}\`)}
  onPaste={(result) => log(result.success ? \`pasted \${result.count}\` : result.error)}
  beforePasteCallback={beforePaste}
>
  {#snippet nodeTemplate(node)}
    <span class:cut-dimmed={cutPaths.has(node.path)}>{node.data?.name}</span>
  {/snippet}
</Tree>`}</pre>
		</div>

		<div class="note">
			<p class="note-title">Events, interceptors &amp; "Copy N" naming</p>
			<p>
				The clipboard ops have symmetric hooks in two families:
				<code>beforeCopy</code> / <code>beforeCut</code> / <code>beforePaste</code>
				<strong>interceptors</strong> (the <code>*Callback</code> family — rewrite or block)
				and <code>onCopy</code> / <code>onCut</code> / <code>onPaste</code>
				<strong>events</strong> (the <code>on*</code> family — post-op notifications). The
				<code>"Copy N"</code> suffix is applied in <code>beforePasteCallback</code> by
				mutating the clipboard entries' data before they're inserted.
			</p>
		</div>

		<div class="note">
			<p class="note-title">Cut dimming</p>
			<p>
				The controller tracks cut paths on <code>controller.cutPaths</code> but doesn't
				paint dimming itself — render it yourself by checking the path in your
				<code>nodeTemplate</code> (the <code>.cut-dimmed</code> class above). The
				library wires <code>Escape</code>→cancel-cut into its own keydown handler; mirror
				it here only to clear your local dim set.
			</p>
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

	.cut-dimmed {
		opacity: 0.45;
		font-style: italic;
	}

	.node-type {
		font-size: 0.7rem;
		color: #a0aec0;
		margin-left: 0.35rem;
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
