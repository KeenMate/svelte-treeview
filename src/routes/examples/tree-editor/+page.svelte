<script lang="ts">
	import { onMount } from 'svelte';
	import Tree from '$lib/components/Tree.svelte';
	import type {
		TreeController,
		NodeTransformContext,
		BeforePasteContext,
		BeforeDropContext,
		NodeDropContext
	} from '$lib/core/TreeController.svelte.js';
	import { uniqueName } from '$lib/core/clipboard.js';
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
		// An "internal" field that shouldn't travel on the clipboard — redacted by
		// nodeOutputTransformationCallback so a pasted copy never carries it.
		secret?: string;
	}

	// Sample editable tree data with sort order. A few files carry a `secret` to
	// demonstrate copy-time cleaning. Defined as a function so the tree and the
	// Reset button share one source.
	function initialTreeData(): EditorNode[] {
		return [
			{ id: 1, path: '1', name: 'Root Folder', type: 'folder', icon: '📁', sortOrder: 10 },
			{ id: 2, path: '1.1', name: 'Documents', type: 'folder', icon: '📂', sortOrder: 10 },
			{ id: 8, path: '1.1.1', name: 'Report.pdf', type: 'file', icon: '📄', sortOrder: 10, secret: 'sk-report-001' },
			{ id: 9, path: '1.1.2', name: 'Notes.txt', type: 'file', icon: '📄', sortOrder: 20 },
			{ id: 10, path: '1.1.3', name: 'Budget.xlsx', type: 'file', icon: '📄', sortOrder: 30, secret: 'sk-budget-002' },
			{ id: 3, path: '1.2', name: 'Images', type: 'folder', icon: '📂', sortOrder: 20 },
			{ id: 11, path: '1.2.1', name: 'Vacation.jpg', type: 'image', icon: '🖼️', sortOrder: 10 },
			{ id: 12, path: '1.2.2', name: 'Logo.png', type: 'image', icon: '🖼️', sortOrder: 20 },
			{ id: 13, path: '1.2.3', name: 'Screenshot.png', type: 'image', icon: '🖼️', sortOrder: 30 },
			{ id: 4, path: '1.3', name: 'Music', type: 'folder', icon: '📂', sortOrder: 30 },
			{ id: 14, path: '1.3.1', name: 'Chill Mix.mp3', type: 'audio', icon: '🎵', sortOrder: 10 },
			{ id: 15, path: '1.3.2', name: 'Focus.mp3', type: 'audio', icon: '🎵', sortOrder: 20 },
			{ id: 5, path: '2', name: 'Projects', type: 'folder', icon: '📁', sortOrder: 20 },
			{ id: 6, path: '2.1', name: 'Web App', type: 'folder', icon: '📂', sortOrder: 10 },
			{ id: 16, path: '2.1.1', name: 'index.html', type: 'file', icon: '📄', sortOrder: 10, secret: 'sk-index-003' },
			{ id: 17, path: '2.1.2', name: 'styles.css', type: 'file', icon: '📄', sortOrder: 20 },
			{ id: 18, path: '2.1.3', name: 'app.js', type: 'file', icon: '📄', sortOrder: 30 },
			{ id: 7, path: '2.2', name: 'Mobile App', type: 'folder', icon: '📂', sortOrder: 20 },
			{ id: 19, path: '2.2.1', name: 'Main.swift', type: 'file', icon: '📄', sortOrder: 10 },
			{ id: 20, path: '2.2.2', name: 'icon.png', type: 'image', icon: '🖼️', sortOrder: 20 }
		];
	}

	let treeData = $state<EditorNode[]>(initialTreeData());

	let treeRef: Tree<EditorNode>;
	let selectedNode = $state<LTreeNode<EditorNode> | null>(null);
	// Multi-select highlight set (Ctrl/Cmd+click, Shift+click, Shift+Arrow).
	let highlightedPaths = $state<Set<string>>(new Set());
	// Paths currently dimmed because they were cut and await paste. The library
	// tracks an equivalent set on the controller (controller.cutPaths) but doesn't
	// render it, so we mirror it here and dim via the nodeTemplate.
	let cutPaths = $state<Set<string>>(new Set());
	// Paths captured at the last copy/cut. Used to detect a "duplicate in place"
	// gesture (Ctrl+V onto one of the copied nodes) so each node can be duplicated
	// in its OWN parent rather than all landing in the focused node's folder.
	let copiedPaths: string[] = [];
	// While fanning out an in-place duplicate we issue several copy/paste ops; mute
	// their per-op logs so the activity log shows one summary line instead.
	let suppressClipboardLog = false;
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

	// nodeOutputTransformationCallback: per-node, at snapshot time (copy/cut). Clean data
	// before it lands on the shared (cross-tree) clipboard — here we redact the internal
	// `secret`. The original node keeps its secret; any pasted copy shows "🔒 redacted".
	function cleanOnCopy(data: EditorNode, _ctx: NodeTransformContext<EditorNode>): EditorNode {
		return data.secret !== undefined ? { ...data, secret: '🔒 redacted' } : data;
	}

	// nodeInputTransformationCallback: the single per-node hook for all paste-time data
	// derivation. The library calls it (pure) for every node about to be inserted, with
	// the resolved destination + the names already taken there. We give each node a fresh
	// id and, for a root, a collision-free "Copy N" name (uniqueName, library helper) only
	// when the name already exists in the TARGET parent. Descendants keep their names.
	// Because the transform reads the pristine clipboard snapshot, repeat pastes stay
	// "Copy 1 / 2 / 3" with no compounding — no strip-regex, no clipboard mutation.
	function pasteTransform(data: EditorNode, ctx: NodeTransformContext<EditorNode>): EditorNode {
		// Read names straight off the roots' landing neighbours — a 'child' paste lands among
		// target.node's children, a 'before'/'after' paste among the anchor's siblings. No
		// displayValueMember needed; we decide what "taken" means.
		const landing =
			ctx.position === 'child' && ctx.target?.node
				? Object.values(ctx.target.node.children)
				: ctx.target?.siblings ?? [];
		const taken = landing.map((s) => s.data?.name ?? '');
		return {
			...data,
			id: nextId++,
			path: '', // assigned by addNode
			name: ctx.isRoot ? uniqueName(data.name, taken) : data.name
		};
	}

	// beforePasteCallback now does policy only: when you paste onto the copied node
	// itself (Ctrl+C then Ctrl+V, no move), redirect into its parent so the copy lands
	// as a sibling — "duplicate in the same folder". ctx.target gives the resolved
	// destination node (no getNodeByPath needed); entries are readonly; naming lives in
	// pasteTransform.
	function beforePaste(ctx: BeforePasteContext<EditorNode>): { targetPath?: string } | void {
		if (ctx.operation !== 'copy') return;
		if (ctx.target.path && ctx.entries.some((e) => e.sourcePath === ctx.target.path)) {
			return { targetPath: ctx.target.node?.parentPath ?? '' };
		}
	}

	function handleTreeKeydown({
		event,
		controller
	}: {
		event: KeyboardEvent;
		focusedNode: LTreeNode<EditorNode> | null;
		highlightedNodes: LTreeNode<EditorNode>[];
		controller: TreeController<EditorNode>;
	}): boolean {
		// Ctrl on Windows/Linux, Cmd (metaKey) on macOS.
		const mod = event.ctrlKey || event.metaKey;
		const key = event.key.toLowerCase();

		// Success logging lives in the onCopy / onCut / onPaste callbacks below;
		// here we only map keys → operations (and report the can't-act cases).
		if (mod && key === 'c') {
			const paths = clipboardPaths(controller);
			if (!paths.length) { addLog('Nothing selected to copy'); return true; }
			controller.copyNodes(paths);
			copiedPaths = paths;
			cutPaths = new Set(); // copying supersedes any pending cut
			return true;
		}

		if (mod && key === 'x') {
			const paths = clipboardPaths(controller);
			if (!paths.length) { addLog('Nothing selected to cut'); return true; }
			controller.cutNodes(paths);
			copiedPaths = paths;
			cutPaths = new Set(controller.cutPaths); // mirror dim set for the template
			return true;
		}

		if (mod && key === 'v') {
			if (!controller.hasClipboardContent()) { addLog('Clipboard is empty'); return true; }
			const target = selectedNode?.path ?? '';

			// Duplicate-in-place: Ctrl+V onto one of the copied nodes when several were
			// copied. A single paste target can only land the whole set in one folder,
			// so a multi-folder selection would dump every copy into the focused node's
			// parent — only that node ends up correctly duplicated. Instead, paste each
			// node next to its own original (into its own parent); beforePaste then adds
			// "Copy N" per parent only where the name actually collides.
			if (
				controller.getClipboardOperation() === 'copy' &&
				copiedPaths.length > 1 &&
				copiedPaths.includes(target)
			) {
				suppressClipboardLog = true;
				let pasted = 0;
				for (const src of copiedPaths) {
					const parent = treeRef.getNodeByPath(src)?.parentPath ?? '';
					controller.copyNodes([src]);
					// transform comes from nodeInputTransformationCallback on <Tree>
					const result = controller.pasteNodes(parent, undefined, 'child');
					if (result.success) pasted += result.count;
				}
				controller.copyNodes(copiedPaths); // restore the full clipboard for repeats
				suppressClipboardLog = false;
				addLog(`Duplicated ${pasted} node(s) in place`);
				cutPaths = new Set();
				return true;
			}

			// Pasting onto a file (a node that can't hold children) lands the copies
			// beside it instead of nested inside — handled by the library now, driven
			// by getAllowedDropPositionsCallback below, so no per-app redirect here.
			controller.pasteNodes(target, undefined, 'child');
			cutPaths = new Set();
			return true;
		}

		// Delete / Backspace remove the selection. Deletion is a data mutation the
		// library leaves to the consumer, so there's no built-in Delete — we wire it
		// here just like copy/cut/paste. Operate on the highlight set when present,
		// else the focused node.
		if (event.key === 'Delete') {
			const paths = clipboardPaths(controller);
			if (!paths.length) { addLog('Nothing selected to delete'); return true; }
			// Remove only top-level paths: removing a parent takes its descendants
			// with it, so a still-listed child path would 404 on its own removeNode.
			const sep = '.';
			const topLevel = paths.filter(
				(p) => !paths.some((o) => o !== p && p.startsWith(o + sep))
			);
			let removed = 0;
			let blocked = 0;
			for (const p of topLevel) {
				const node = treeRef.getNodeByPath(p);
				// Test guard: refuse to delete a node that still has subnodes.
				if (node && Object.keys(node.children).length > 0) {
					blocked++;
					continue;
				}
				if (treeRef.removeNode(p).success) removed++;
			}
			controller.clearHighlight();
			selectedNode = null;
			cutPaths = new Set();
			if (blocked > 0) {
				const msg = `Cannot delete ${blocked} node(s) with subnodes — remove their contents first`;
				addLog(`Deleted ${removed} node(s); skipped ${blocked} with subnodes`);
				showWarning(msg);
			} else {
				addLog(`Deleted ${removed} node(s)`);
			}
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

	// Show a transient warning in the same banner used for drop rejections, and
	// auto-clear it after a few seconds so it doesn't linger.
	let warningTimer: ReturnType<typeof setTimeout> | undefined;
	function showWarning(message: string) {
		dropWarning = message;
		clearTimeout(warningTimer);
		warningTimer = setTimeout(() => (dropWarning = null), 4000);
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

	// A node can hold children only if it's a folder. Shared by drag-drop and paste
	// so both honour the same "files can't contain children" rule.
	const canHaveChildren = (node: LTreeNode<EditorNode> | null) =>
		node?.data?.icon?.includes('📁') || node?.data?.icon?.includes('📂');

	async function beforeDrop(ctx: BeforeDropContext<EditorNode>): Promise<boolean | { position: DropPosition } | void> {
		const { target, position } = ctx;
		const dropNode = target?.node ?? null;
		const draggedNode = ctx.dragged[0]?.node ?? null;
		const isFolder = canHaveChildren;
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

	function handleDrop({ source, target, position }: NodeDropContext<EditorNode>) {
		const dropNode = target?.node ?? null;
		const draggedNode = source.node;
		if (!dropNode || !draggedNode) {
			addLog(`Dropped "${draggedNode?.data?.name}" at root`);
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
		treeData = initialTreeData();
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
			dim until pasted; <strong>Esc</strong> cancels a pending cut. <strong>Delete</strong>
			removes the selected node(s). Drag and drop also moves nodes. Some files carry an
			internal <code>secret</code> token —
			<code>nodeOutputTransformationCallback</code> redacts it on copy, so a pasted copy shows
			<em>🔒 redacted</em> while the original keeps its value. Pasting onto a file (which
			can't hold children) drops the copy beside it instead of inside.
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
						getAllowedDropPositionsCallback={(node): DropPosition[] | undefined =>
							canHaveChildren(node) ? undefined : ['before', 'after']}
						bind:focusedNode={selectedNode}
						bind:highlightedPaths={highlightedPaths}
						onTreeKeydown={handleTreeKeydown}
						onCopy={({ paths }) => { if (!suppressClipboardLog) addLog(`Copied ${paths.length} node(s) to clipboard`); }}
						onCut={({ paths }) => addLog(`Cut ${paths.length} node(s) — paste to move`)}
						onPaste={(result) => { if (!suppressClipboardLog) addLog(result.success ? `Pasted ${result.count} node(s)` : `Paste failed: ${result.error}`); }}
						beforePasteCallback={beforePaste}
						nodeOutputTransformationCallback={cleanOnCopy}
						nodeInputTransformationCallback={pasteTransform}
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
								{#if node.data?.secret}
									<span class="node-secret">{node.data.secret}</span>
								{/if}
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

		<h3 style="margin-top: 2rem;">Clipboard API</h3>
		<p class="description">
			Controller methods (call via <code>onTreeKeydown</code>'s <code>controller</code> arg or
			<code>bind:this</code>) backed by a module-level, cross-tree clipboard.
		</p>
		<table>
			<thead>
				<tr><th>Method</th><th>Description</th></tr>
			</thead>
			<tbody>
				<tr>
					<td><code>copyNodes(paths?)</code></td>
					<td>Snapshot nodes onto the shared clipboard (defaults to the highlight set)</td>
				</tr>
				<tr>
					<td><code>cutNodes(paths?)</code></td>
					<td>Mark nodes for a move; they dim until pasted (tracked on <code>cutPaths</code>)</td>
				</tr>
				<tr>
					<td><code>pasteNodes(targetPath, transform?, position?)</code></td>
					<td>Insert clipboard content; returns <code>PasteResult</code> (<code>{`{ count, skipped }`}</code>)</td>
				</tr>
				<tr>
					<td><code>cancelCut()</code></td>
					<td>Clear a pending cut (also bound to <code>Esc</code>)</td>
				</tr>
				<tr>
					<td><code>hasClipboardContent()</code> / <code>getClipboardOperation()</code></td>
					<td>Query whether the clipboard has data, and whether it's a copy or cut</td>
				</tr>
			</tbody>
		</table>

		<table style="margin-top: 1rem;">
			<thead>
				<tr><th>Prop / helper</th><th>Description</th></tr>
			</thead>
			<tbody>
				<tr>
					<td><code>nodeInputTransformationCallback(data, ctx) =&gt; T | null</code></td>
					<td>Per-node paste derivation — fresh ids/values/names; return <code>null</code> to skip a node (skipping a root skips its subtree)</td>
				</tr>
				<tr>
					<td><code>nodeOutputTransformationCallback(data, ctx) =&gt; T</code></td>
					<td>Per-node clean at copy time — strip/redact fields before they hit the shared clipboard</td>
				</tr>
				<tr>
					<td><code>beforePasteCallback(targetPath, op, entries)</code></td>
					<td>Batch policy — redirect target/position or return <code>false</code> to block. Entries are <strong>readonly</strong></td>
				</tr>
				<tr>
					<td><code>uniqueName(base, taken, suffix?)</code></td>
					<td>Exported helper — collision-free name (default <code>"Name Copy N"</code>); use with names read off the roots' landing neighbours (<code>ctx.target.node.children</code> for a <code>'child'</code> paste, else <code>ctx.target.siblings</code>)</td>
				</tr>
			</tbody>
		</table>

		<div class="note">
			<p class="note-title">Two roles, two hooks</p>
			<p>
				<code>beforePasteCallback</code> is batch <strong>policy</strong> (redirect/block, readonly
				entries); <code>nodeInputTransformationCallback</code> is per-node <strong>derivation</strong>
				(ids, values, naming, skip). The clipboard snapshot is immutable — each paste runs on a
				fresh working copy, so naming never compounds.
			</p>
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
			clipboard; the key bindings are left to you via <code>onTreeKeydown</code>.
			Per-node paste derivation (fresh ids, values, "Copy N" naming, per-entry skip)
			lives in <code>nodeInputTransformationCallback</code>; <code>beforePasteCallback</code>
			is policy only (redirect/block) and gets <strong>readonly</strong> entries.
			Enable multi-select with <code>selectionMode="multi"</code>.
		</p>

		<div class="code-block">
			<pre>{`import { uniqueName } from '@keenmate/svelte-treeview';
import type { TreeController, NodeTransformContext } from '@keenmate/svelte-treeview';

let focusedNode = $state<LTreeNode<MyNode> | null>(null);
let highlightedPaths = $state<Set<string>>(new Set());
let cutPaths = $state<Set<string>>(new Set());
let nextId = 1000;

// Copy/cut act on the highlight set when present, else the focused node.
function clipboardPaths(controller: TreeController<MyNode>) {
  if (controller.highlightedPaths.size > 0) return [...controller.highlightedPaths];
  return focusedNode ? [focusedNode.path] : [];
}

// THE place for all paste-time data derivation — pure, per node, called by the
// library with LIVE references. target mirrors source: { path, node, parent, siblings }
// = the node you aimed at + its context; ctx.position says how the roots land. Return new
// data (fresh id/value/name) or null to SKIP this node (skipping a root skips its subtree).
// You decide what "collision" means by reading the landing neighbours — no displayValueMember
// assumption. They're LIVE and batch-aware, so repeats stay Copy 1/2/3 with no compounding.
// (Same context type the output transform gets, with phase: 'input'; on output, target is null.)
function pasteTransform(data: MyNode, ctx: NodeTransformContext<MyNode>): MyNode | null {
  // e.g. skip what isn't allowed here: if (!allowed(data, ctx)) return null;
  // Landing = target.node's children for a 'child' paste, else the anchor's siblings.
  const landing = ctx.position === 'child' && ctx.target?.node
    ? Object.values(ctx.target.node.children)
    : ctx.target?.siblings ?? [];
  const taken = landing.map(s => s.data?.name ?? '');
  return {
    ...data,
    id: nextId++,
    path: '',                                            // assigned by addNode
    name: ctx.isRoot ? uniqueName(data.name, taken) : data.name
  };
}

// beforePaste = policy only. ctx = { operation, target: { path, node }, entries }
// (entries are readonly snapshots). Pasting onto the copied node itself (Ctrl+C then
// Ctrl+V, no move) → redirect into its parent so the copy lands as a sibling.
function beforePaste(ctx) {
  if (ctx.operation !== 'copy') return;
  if (ctx.target.path && ctx.entries.some(e => e.sourcePath === ctx.target.path))
    return { targetPath: ctx.target.node?.parentPath ?? '' };
}

function handleKeydown({ event, controller }) {
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
    controller.pasteNodes(focusedNode?.path ?? '');  // transform comes from the prop
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
  onCopy={({ paths }) => log(\`copied \${paths.length}\`)}
  onCut={({ paths }) => log(\`cut \${paths.length}\`)}
  onPaste={(result) => log(result.success ? \`pasted \${result.count}, skipped \${result.skipped}\` : result.error)}
  beforePasteCallback={beforePaste}
  nodeInputTransformationCallback={pasteTransform}
>
  {#snippet nodeTemplate(node)}
    <span class:cut-dimmed={cutPaths.has(node.path)}>{node.data?.name}</span>
  {/snippet}
</Tree>`}</pre>
		</div>

		<div class="note">
			<p class="note-title">Two roles, two hooks</p>
			<p>
				<code>beforePasteCallback</code> is <strong>batch policy</strong> — redirect
				target/position or block; it sees <strong>readonly</strong> entries and never
				mutates data. <code>nodeInputTransformationCallback(data, ctx) =&gt; T | null</code>
				is <strong>per-node derivation</strong> — ids, values, <code>"Copy N"</code> naming
				(read names off the roots' landing neighbours — <code>ctx.target.node.children</code> for a
				<code>'child'</code> paste, else <code>ctx.target.siblings</code> — and pass to
				<code>uniqueName</code>), and per-entry skip (return <code>null</code>). <code>target</code> mirrors
				<code>source</code> — <code>path</code> / <code>node</code> / <code>parent</code> / <code>siblings</code>
				for the node you aimed at, plus <code>ctx.position</code> — so collision logic is yours, with no display-name assumption. The clipboard snapshot is immutable; each paste runs
				on a fresh working copy, and <code>nodeOutputTransformationCallback</code> can clean data
				before it ever lands on the shared clipboard.
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

	.node-secret {
		font-size: 0.65rem;
		font-family: ui-monospace, monospace;
		color: #b7791f;
		background: #fefcbf;
		border-radius: 3px;
		padding: 0 0.3rem;
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
