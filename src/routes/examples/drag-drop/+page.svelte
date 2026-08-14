<script lang="ts">
	import { onMount } from 'svelte';
	import Tree from '$lib/components/Tree.svelte';
	import type {
		NodeTransformContext,
		BeforePasteContext,
		NodeDropContext,
		NodeEventContext,
		DragStartContext,
		BeforeDropContext,
		DropGroup
	} from '$lib/core/TreeController.svelte.js';
	import { uniqueName } from '$lib/core/clipboard.js';
	import type { LTreeNode, DropPosition } from '$lib/ltree/types.js';
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

	// Source tree data. Most items are draggable; "File C" carries isDraggable:false
	// so it can't be grabbed on its own (it still rides along when its parent folder
	// is dragged — see the pinned-node note in the markup). Draggability is resolved
	// via getIsDraggableCallback below — items without the field default to true; only
	// an explicit `false` opts out.
	let sourceData = $state<FileItem[]>([
		{ id: 1, path: '1', name: 'Source Folder', icon: '📁', sortOrder: 10 },
		{ id: 2, path: '1.1', name: 'File A', icon: '📄', sortOrder: 10 },
		{ id: 3, path: '1.2', name: 'File B', icon: '📄', sortOrder: 20 },
		{
			id: 4,
			path: '1.3',
			name: '🔒 File C (pinned)',
			icon: '📄',
			sortOrder: 30,
			isDraggable: false
		},
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
	let showDropZoneWhenEmpty = $state(true); // Keep the target tree's drop zone visible + paste-ready while empty
	let handleKeyboardShortcuts = $state(true); // Built-in Ctrl/Cmd+C/X/V + Delete + CUA aliases
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
				if (config.showDropZoneWhenEmpty !== undefined)
					showDropZoneWhenEmpty = config.showDropZoneWhenEmpty;
				if (config.handleKeyboardShortcuts !== undefined)
					handleKeyboardShortcuts = config.handleKeyboardShortcuts;
			} catch (e) {
				// Ignore invalid JSON
			}
		}
	});

	// Save settings to localStorage when they change
	$effect(() => {
		const config = {
			mode: dropZoneMode,
			layout: dropZoneLayout,
			start: dropZoneStart,
			maxWidth: dropZoneMaxWidth,
			isCopyAllowed,
			showDropZoneWhenEmpty,
			handleKeyboardShortcuts
		};
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

	function handleSourceDragStart({ node }: NodeEventContext<FileItem>) {
		addLog(`Started dragging: ${node?.data?.name}`);
	}

	// ── Cross-tree clipboard + Delete ────────────────────────────────────────
	// Both trees opt into the library's built-in keyboard handling via
	// shouldHandleKeyboardShortcuts: Ctrl/Cmd+C/X/V (copy/cut/paste), Delete, Esc.
	// The clipboard is a shared singleton, so copy in one tree + paste in the other
	// just works — and a cross-tree CUT now removes the originals automatically (the
	// source tree is reached through the library's internal registry). All that's left
	// for the consumer is the two policy hooks below (paste transform + self-paste
	// redirect) and the on* events for the activity log — no hand-rolled keymap.

	// Each pasted node gets a fresh id; path is assigned by the paste insert. A root
	// node whose name already exists in the destination becomes "Name Copy 1/2/3…". The
	// landing neighbours depend on ctx.position: a 'child' paste lands among target.node's
	// children, a 'before'/'after' paste among the anchor's siblings (= target.siblings).
	// Both are LIVE and batch-aware. Descendants keep their names. Same NodeTransformContext
	// the output transform would see, but with phase: 'input' and a populated `target`.
	function transformPasted(data: FileItem, ctx: NodeTransformContext<FileItem>): FileItem {
		const landing =
			ctx.position === 'child' && ctx.target?.node
				? Object.values(ctx.target.node.children)
				: (ctx.target?.siblings ?? []);
		const taken = landing.map((s) => s.data?.name ?? '');
		return {
			...data,
			id: nextId++,
			path: '',
			name: ctx.isRoot ? uniqueName(data.name, taken) : data.name
		};
	}

	// Pasting onto one of the copied nodes itself (Ctrl+C then Ctrl+V without moving)
	// would hit the paste-into-self guard and skip everything. Redirect into the node's
	// parent so the copy lands beside it — ctx.target.node.parentPath, no string surgery.
	function selfPasteRedirect(ctx: BeforePasteContext<FileItem>): { targetPath?: string } | void {
		if (ctx.target.path && ctx.entries.some((e) => e.sourcePath === ctx.target.path)) {
			return { targetPath: ctx.target.node?.parentPath ?? '' };
		}
	}

	function handleTargetDrop({
		source,
		target,
		dragged,
		position,
		operation
	}: NodeDropContext<FileItem>) {
		const dropNode = target?.node ?? null;
		const draggedNode = source.node;
		if (!draggedNode) return;
		// Same-tree operations are auto-handled by the library - just log
		const isSameTreeDrag = draggedNode.treeId === 'target-tree';
		if (isSameTreeDrag) {
			addLog(
				`[${operation.toUpperCase()}] ${operation === 'move' ? 'Moved' : 'Copied'} "${draggedNode.data?.name}" ${position} "${dropNode?.data?.name || 'root'}"`
			);
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
		// library (it only auto-places the lead node), but ctx.dragged still carries
		// the FULL top-level dragged set — already draggable-filtered (pinned nodes
		// like "File C" are excluded) — so we just copy each subtree in turn. No need
		// to re-read highlightedPaths or re-run the isDraggable predicate here.
		const sourcePaths = dragged.map((r) => r.path);

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
			if (!srcNode) {
				failed++;
				continue;
			}
			const useParent = i === 0 ? parentPath : dropNode ? dropNode.path : '';
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
					sortOrder: data.id === srcNode.data?.id ? rootSort : data.sortOrder || 10
				}),
				useSibling,
				usePos
			);
			if (result.success) copied += result.count;
			else failed++;
		}

		if (failed === 0) {
			const label =
				sourcePaths.length > 1
					? `${sourcePaths.length} subtrees (${copied} nodes)`
					: `${copied} node(s)`;
			addLog(
				`[CROSS-TREE] Copied ${label} to "${parentPath || 'root'}"${siblingPath ? ` ${copyPosition} "${siblingPath}"` : ''}`
			);
		} else {
			addLog(`Error: ${failed} of ${sourcePaths.length} subtree(s) failed to copy`);
		}
	}

	function handleSourceDrop({ source, target, position, operation }: NodeDropContext<FileItem>) {
		const dropNode = target?.node ?? null;
		const draggedNode = source.node;
		if (!draggedNode) return;
		// Same-tree moves and copies are auto-handled by the library - just log
		if (!dropNode) {
			addLog(`Cannot drop at root level in source tree`);
			return;
		}

		addLog(
			`[${operation.toUpperCase()}] ${operation === 'move' ? 'Moved' : 'Copied'} "${draggedNode.data?.name}" ${position} "${dropNode.data?.name}"`
		);
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
			nodes.push({
				id: id++,
				path: `${i}`,
				name: `Folder ${i}`,
				icon: '📁',
				sortOrder: i * 10,
				...pin()
			});

			// Each root has 3 subfolders
			for (let j = 1; j <= 3; j++) {
				nodes.push({
					id: id++,
					path: `${i}.${j}`,
					name: `Subfolder ${i}.${j}`,
					icon: '📂',
					sortOrder: j * 10,
					...pin()
				});

				// Each subfolder has 2-3 files
				for (let k = 1; k <= 2 + (i % 2); k++) {
					nodes.push({
						id: id++,
						path: `${i}.${j}.${k}`,
						name: `File ${i}.${j}.${k}`,
						icon: '📄',
						sortOrder: k * 10,
						...pin()
					});
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
		{
			id: 101,
			path: '1',
			name: '🗑️ Trash (pinned)',
			icon: '',
			sortOrder: 10,
			allowedDropPositions: ['child'],
			isDraggable: false
		},
		{ id: 102, path: '1.1', name: 'Deleted Item 1', icon: '📄', sortOrder: 10 },
		{ id: 103, path: '1.2', name: 'Deleted Item 2', icon: '📄', sortOrder: 20 },

		// Regular folder: all drop positions allowed (default)
		{ id: 104, path: '2', name: '📁 Projects', icon: '', sortOrder: 20 },
		{ id: 105, path: '2.1', name: 'Project A', icon: '📂', sortOrder: 10 },
		{ id: 106, path: '2.2', name: 'Project B', icon: '📂', sortOrder: 20 },

		// Files: only accept drops before/after (can't drop INTO a file)
		{
			id: 107,
			path: '3',
			name: '📄 Readme.md',
			icon: '',
			sortOrder: 30,
			allowedDropPositions: ['before', 'after']
		},
		{
			id: 108,
			path: '4',
			name: '📄 Config.json',
			icon: '',
			sortOrder: 40,
			allowedDropPositions: ['before', 'after']
		},

		// Source items to drag
		{ id: 109, path: '5', name: '📁 Source Items', icon: '', sortOrder: 50 },
		{ id: 110, path: '5.1', name: 'Drag me!', icon: '🔵', sortOrder: 10 },
		{ id: 111, path: '5.2', name: 'Drag me too!', icon: '🟢', sortOrder: 20 }
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
		{
			id: 506,
			path: '3',
			name: '🔒 Drafts (pinned)',
			icon: '📝',
			sortOrder: 30,
			isDraggable: false
		}
	]);
	let touchLog = $state<string[]>([]);

	function addTouchLog(message: string) {
		touchLog = [...touchLog.slice(-9), `${new Date().toLocaleTimeString()} - ${message}`];
	}

	function handleTouchDragStart({ node }: NodeEventContext<FileItem>) {
		addTouchLog(`dragStart: "${node?.data?.name}"`);
	}

	function handleTouchDrop({ source, target, position }: NodeDropContext<FileItem>) {
		addTouchLog(
			`drop: "${source.node?.data?.name}" ${position} "${target?.node?.data?.name || 'root'}"`
		);
	}

	// Attach document-level touch logging to debug DevTools emulation
	onMount(() => {
		const touchTree = document.querySelector('.touch-demo-tree');
		if (!touchTree) return;

		touchTree.addEventListener(
			'touchstart',
			(e) => {
				const touch = (e as TouchEvent).touches[0];
				addTouchLog(`touchstart: (${Math.round(touch.clientX)}, ${Math.round(touch.clientY)})`);
			},
			{ passive: true }
		);

		touchTree.addEventListener(
			'touchmove',
			(e) => {
				const touch = (e as TouchEvent).touches[0];
				addTouchLog(`touchmove: (${Math.round(touch.clientX)}, ${Math.round(touch.clientY)})`);
			},
			{ passive: false }
		);

		touchTree.addEventListener('touchend', (e) => {
			const touch = (e as TouchEvent).changedTouches[0];
			addTouchLog(`touchend: (${Math.round(touch.clientX)}, ${Math.round(touch.clientY)})`);
		});

		touchTree.addEventListener('touchcancel', () => {
			addTouchLog(`touchcancel`);
		});
	});

	function handleRestrictedDrop({ source, target, position }: NodeDropContext<RestrictedFileItem>) {
		const dropNode = target?.node ?? null;
		const positionLabel =
			dropNode?.data?.allowedDropPositions?.length === 1
				? `(only ${dropNode.data.allowedDropPositions[0]} allowed)`
				: '';
		addRestrictedLog(
			`Dropped "${source.node?.data?.name}" ${position} "${dropNode?.data?.name || 'root'}" ${positionLabel}`
		);
	}

	// === Drag-Set Guard Demo (beforeDragStartCallback) — two trees ===
	// A single pre-drag interceptor that reshapes the WHOLE dragged set on the SOURCE
	// tree before anything crosses: PRUNE locked files, AUGMENT with a linked companion
	// that must travel together, and VETO a drag that starts on a protected node. It's the
	// only hook that sees the full combination — getIsDraggableCallback is per-node and
	// can't protect a locked file carried inside a dragged folder, nor force-add one. The
	// reshaped set is published across trees, so the destination receives exactly that set.
	type GuardItem = FileItem & { locked?: boolean; companion?: string; isProtected?: boolean };

	// Folders drag normally. The guard reshapes the dragged SET: prune a locked file (loose OR
	// nested inside a dragged folder — the guard sees the COMPLETE flattened manifest), force in a
	// companion, or veto the whole drag on a protected node. The reshaped manifest is published
	// cross-tree, and the destination tree AUTO-COPIES it: the library's duplicateNodes skips any
	// pruned (nested) node as a manifest hole and mints ids via nodeInputTransformationCallback.
	// No imperative placement — onGuardDrop just logs what the library dropped (ctx.dropped).
	function initialGuardSource(): GuardItem[] {
		return [
			{ id: 601, path: '1', name: 'Documents', icon: '📁', sortOrder: 10 },
			{ id: 602, path: '1.1', name: 'report.doc', icon: '📄', sortOrder: 10 },
			{ id: 603, path: '1.2', name: 'memo.txt', icon: '📄', sortOrder: 20 },
			{
				id: 611,
				path: '1.3',
				name: '🔒 secret.key (locked)',
				icon: '',
				sortOrder: 30,
				locked: true
			},
			{ id: 604, path: '2', name: 'Photos', icon: '📁', sortOrder: 20 },
			{ id: 605, path: '2.1', name: 'sunset.jpg', icon: '🖼️', sortOrder: 10 },
			{ id: 606, path: '2.2', name: 'beach.jpg', icon: '🖼️', sortOrder: 20 },
			{ id: 607, path: '3', name: 'invoice.pdf', icon: '📄', sortOrder: 30, companion: '4' },
			{ id: 608, path: '4', name: '🔗 invoice.sig (linked)', icon: '', sortOrder: 40 },
			{
				id: 609,
				path: '5',
				name: '🔒 license.key (locked)',
				icon: '',
				sortOrder: 50,
				locked: true
			},
			{
				id: 610,
				path: '6',
				name: '⛔ system.lock (protected)',
				icon: '',
				sortOrder: 60,
				isProtected: true
			}
		];
	}
	function initialGuardDest(): GuardItem[] {
		return [{ id: 650, path: '1', name: 'Destination', icon: '📁', sortOrder: 10 }];
	}

	let guardSourceData = $state<GuardItem[]>(initialGuardSource());
	let guardDestData = $state<GuardItem[]>(initialGuardDest());
	let guardSourceRef: Tree<GuardItem>;
	let guardDestRef: Tree<GuardItem>;
	let guardHighlighted = $state(new Set<string>());
	let guardLog = $state<string[]>([]);
	let guardNextId = 900;

	function addGuardLog(m: string) {
		guardLog = [...guardLog.slice(-6), `${new Date().toLocaleTimeString()} - ${m}`];
	}

	function beforeGuardDragStart(ctx: DragStartContext<GuardItem>): string[] | false | void {
		// VETO: a protected node anywhere in the dragged set cancels the whole drag
		// (onNodeDragStart never fires). getIsDraggableCallback can't do this — it's per-node,
		// with no view of what else is being dragged.
		const protectedRef = ctx.dragged.find((r) => r.node?.data?.isProtected);
		if (protectedRef) {
			addGuardLog(`Vetoed — "${protectedRef.node?.data?.name}" is protected`);
			return false;
		}
		// PRUNE locked files OUT of the dragged set (drag a folder + a selected lock → only the
		// folder travels); AUGMENT each dragged item's linked companion. The returned array is
		// AUTHORITATIVE — it replaces the top-level set in landing order.
		const pruned = ctx.dragged.filter((r) => r.node?.data?.locked);
		const kept = ctx.dragged.filter((r) => !r.node?.data?.locked).map((r) => r.path);
		const companions = ctx.dragged
			.map((r) => r.node?.data?.companion)
			.filter((p): p is string => !!p);
		const result = [...kept, ...companions];
		if (pruned.length || companions.length) {
			addGuardLog(
				`Reshaped set → ${result.length} node(s): pruned ${pruned.length} locked, added ${companions.length} linked`
			);
		}
		return result;
	}

	// Force every drop on the Destination tree to be a COPY (the source keeps its files), so the
	// library auto-handles the cross-tree placement instead of the consumer. Returned from
	// beforeDropCallback — it overrides the operation after the Ctrl/isCopyAllowed check, so no
	// modifier key is needed.
	const guardForceCopy = () => ({ operation: 'copy' as const });

	// INPUT transform on the Destination tree: mint a fresh id as each copied node lands. The
	// guard's pruning (the nested locked file) is handled by the published MANIFEST, not here —
	// duplicateNodes simply never offers a pruned node to this transform.
	const guardMintId = (d: GuardItem) => ({ ...d, id: guardNextId++ });

	function onGuardDrop({ dropped }: NodeDropContext<GuardItem>) {
		// Nothing imperative: the library already copied the guard-pruned manifest into the
		// Destination tree. ctx.dropped is what it placed (the root copies) — log it. Which nodes
		// arrive PROVES the guard worked (no locked file, plus any linked companion).
		const arrived = (dropped ?? []).map((r) => r.node?.data?.name ?? '').filter(Boolean);
		addGuardLog(`Arrived in Destination: ${arrived.join(', ') || '(nothing)'}`);
	}

	function resetGuard() {
		guardSourceData = initialGuardSource();
		guardDestData = initialGuardDest();
		guardHighlighted = new Set();
		guardLog = [];
		guardNextId = 900;
	}

	// === Leave-behind on drag (same-tree) — beforeDragStartCallback + moveNodes holes ===
	// SAME tree, so the library auto-moves the drop. ctx.dragged is the COMPLETE flattened set;
	// dropping the locked node from the returned manifest makes it a "hole" that moveNodes leaves
	// behind — re-homed to the moved folder's old parent — while the folder + its other files move.
	type LbItem = FileItem & { locked?: boolean };

	function initialLeaveBehind(): LbItem[] {
		return [
			{ id: 801, path: '1', name: 'Documents', icon: '📁', sortOrder: 10 },
			{ id: 802, path: '1.1', name: 'report.doc', icon: '📄', sortOrder: 10 },
			{
				id: 803,
				path: '1.2',
				name: '🔒 secret.key (locked)',
				icon: '',
				sortOrder: 20,
				locked: true
			},
			{ id: 804, path: '1.3', name: 'notes.txt', icon: '📄', sortOrder: 30 },
			{ id: 805, path: '2', name: 'Archive', icon: '📂', sortOrder: 20 }
		];
	}

	let leaveBehindData = $state<LbItem[]>(initialLeaveBehind());
	let leaveBehindHighlighted = $state(new Set<string>());
	let leaveBehindLog = $state<string[]>([]);

	function addLbLog(m: string) {
		leaveBehindLog = [...leaveBehindLog.slice(-5), `${new Date().toLocaleTimeString()} - ${m}`];
	}

	function beforeLeaveBehindDragStart(ctx: DragStartContext<LbItem>): string[] {
		// Keep everything except locked nodes; the omitted lock becomes a hole left behind.
		const kept = ctx.dragged.filter((r) => !r.node?.data?.locked);
		const held = ctx.dragged.length - kept.length;
		if (held) addLbLog(`Held back ${held} locked file(s) — they stay put`);
		return kept.map((r) => r.path);
	}

	function onLeaveBehindDrop({ dropped }: NodeDropContext<LbItem>) {
		const names = (dropped ?? []).map((r) => r.node?.data?.name).filter(Boolean);
		if (names.length) addLbLog(`Moved: ${names.join(', ')}`);
	}

	function resetLeaveBehind() {
		leaveBehindData = initialLeaveBehind();
		leaveBehindHighlighted = new Set();
		leaveBehindLog = [];
	}

	// === Sorting Zone Demo — two trees (shouldEnableTreeDropZone + DropGroup routing) ===
	// Left = a Basket of loose produce. Right = a Pantry whose category nodes REJECT direct
	// drops (getIsDropAllowedCallback => false); instead the WHOLE pantry is one drop zone.
	// Drop a mixed basket anywhere on the pantry → each item auto-files under Fruits/Vegetables.
	//  • CROSS-TREE arrivals (basket → pantry): the consumer routes them in onNodeDrop (the
	//    library can't auto-move nodes that live in another tree).
	//  • SAME-TREE re-sorts (drag a produce already IN the pantry to the zone): beforeDropCallback
	//    returns a DropGroup[] and the library auto-executes it — one drop fans out to categories.
	type ProduceItem = FileItem & { kind?: 'fruit' | 'vegetable' | 'category' };

	function initialBasket(): ProduceItem[] {
		return [
			{ id: 703, path: '1', name: 'Apple', icon: '🍎', sortOrder: 10, kind: 'fruit' },
			{ id: 704, path: '2', name: 'Carrot', icon: '🥕', sortOrder: 20, kind: 'vegetable' },
			{ id: 705, path: '3', name: 'Banana', icon: '🍌', sortOrder: 30, kind: 'fruit' },
			{ id: 706, path: '4', name: 'Broccoli', icon: '🥦', sortOrder: 40, kind: 'vegetable' },
			{ id: 707, path: '5', name: 'Cherry', icon: '🍒', sortOrder: 50, kind: 'fruit' }
		];
	}
	function initialPantry(): ProduceItem[] {
		return [
			{ id: 701, path: '1', name: 'Fruits', icon: '🍎', sortOrder: 10, kind: 'category' },
			{ id: 702, path: '2', name: 'Vegetables', icon: '🥕', sortOrder: 20, kind: 'category' }
		];
	}

	let basketData = $state<ProduceItem[]>(initialBasket());
	let pantryData = $state<ProduceItem[]>(initialPantry());
	let basketRef: Tree<ProduceItem>;
	let pantryRef: Tree<ProduceItem>;
	let basketHighlighted = $state(new Set<string>());
	let pantryHighlighted = $state(new Set<string>());
	let produceLog = $state<string[]>([]);
	let produceNextId = 950;

	function addProduceLog(m: string) {
		produceLog = [...produceLog.slice(-6), `${new Date().toLocaleTimeString()} - ${m}`];
	}

	const categoryPathFor = (kind?: string) => (kind === 'vegetable' ? '2' : '1'); // Vegetables : Fruits

	// SAME-TREE re-sort only: route pantry-resident produce back into its category. Cross-tree
	// refs have node=null here (source lives in the basket) — skip them; onProduceDrop handles
	// those. Returns a DropGroup[] the library auto-executes for the same-tree nodes.
	function beforePantryDrop(ctx: BeforeDropContext<ProduceItem>): DropGroup[] {
		const byTarget = new Map<string, string[]>();
		for (const ref of ctx.dragged) {
			if (!ref.node || ref.node.data?.kind === 'category') continue;
			const targetPath = categoryPathFor(ref.node.data?.kind);
			const list = byTarget.get(targetPath) ?? [];
			list.push(ref.path);
			byTarget.set(targetPath, list);
		}
		return [...byTarget.entries()].map(([targetPath, paths]) => ({
			targetPath,
			position: 'child' as const,
			paths
		}));
	}

	function onProduceDrop({ dragged, dropped }: NodeDropContext<ProduceItem>) {
		// dropped != null → the library already auto-moved a SAME-TREE DropGroup[]; just log it.
		if (dropped && dropped.length) {
			const counts = new Map<string, number>();
			for (const ref of dropped) {
				const parentName = ref.parent?.data?.name ?? '(root)';
				counts.set(parentName, (counts.get(parentName) ?? 0) + 1);
			}
			addProduceLog(
				'Re-sorted within pantry → ' + [...counts.entries()].map(([n, c]) => `${c}→${n}`).join(', ')
			);
			return;
		}
		// CROSS-TREE basket arrivals: route each item into its category by kind, copying from
		// the basket. (kind isn't visible on cross-tree refs, so we read it off the source node.)
		const counts = new Map<string, number>();
		for (const ref of dragged) {
			const src = basketRef.getNodeByPath(ref.path);
			if (!src || src.data?.kind === 'category') continue;
			const targetPath = categoryPathFor(src.data?.kind);
			const r = pantryRef.copyNodeWithDescendants(src, targetPath, (d: ProduceItem) => ({
				...d,
				id: produceNextId++,
				path: ''
			}));
			if (r.success) {
				const name = targetPath === '2' ? 'Vegetables' : 'Fruits';
				counts.set(name, (counts.get(name) ?? 0) + 1);
			}
		}
		addProduceLog(
			'Sorted basket → ' +
				([...counts.entries()].map(([n, c]) => `${c}→${n}`).join(', ') || 'nothing')
		);
	}

	function resetProduce() {
		basketData = initialBasket();
		pantryData = initialPantry();
		basketHighlighted = new Set();
		pantryHighlighted = new Set();
		produceLog = [];
		produceNextId = 950;
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
			<strong>Source tree (left):</strong> Drag to reorganize nodes (move). Enable "Allow Ctrl+drag
			to copy" then hold Ctrl while dragging to copy nodes. With <code>selectionMode="multi"</code>
			(default below), Ctrl/Shift+click multiple nodes and drag any one of them — the whole
			highlight set moves together (top-level subtrees only; descendants ride along inside).
			<strong>Target tree (right):</strong> Drag from source to add nodes. Starts empty to demo drop
			placeholder. Once it has nodes, multi-drag works inside the target tree the same way.
		</p>
		<p class="description">
			<strong>Clipboard (cross-tree):</strong> select nodes in either tree and press
			<strong>Ctrl/Cmd+C</strong> (copy) or <strong>X</strong> (cut), then click the other tree and
			<strong>Ctrl/Cmd+V</strong>
			to paste. While the target tree is empty it uses
			<code>shouldShowDropPlaceholderWhenEmpty</code> — the drop zone stays visible and grabs
			keyboard focus on hover, so you can copy in the left tree, hover the drop zone, and press
			<strong>Ctrl/Cmd+V</strong> to fill it without clicking first. The clipboard is a shared
			singleton, so it works across both trees — copy duplicates, cut moves (the source nodes are
			removed on paste).
			<strong>Delete</strong> removes the selected node(s) (a folder takes its whole subtree with
			it);
			<strong>Esc</strong> cancels a pending cut. The classic <strong>Ctrl+Insert</strong> /
			<strong>Shift+Insert</strong> / <strong>Shift+Delete</strong> aliases work too. These keys
			come from the library's built-in <code>shouldHandleKeyboardShortcuts</code> — no hand-rolled
			keymap; this demo only supplies the paste transform (fresh ids / <em>Copy N</em> names) and a self-paste
			redirect.
		</p>

		<div class="note">
			<p class="note-title">About 🔒 File C (pinned)</p>
			<p style="margin: 0;">
				<code>getIsDraggableCallback</code> is <strong>per-node</strong>: it stops you grabbing 🔒
				<code>File C</code> on its own (its row renders <code>draggable="false"</code>), but it can't
				stop the node from riding along when you drag its <strong>parent</strong> — dragging
				<code>Source Folder</code> moves the whole subtree, File C included. That's expected: a drag
				carries complete subtrees. To keep a locked child <em>behind</em> even when its parent moves,
				reshape the dragged set in <code>beforeDragStartCallback</code> — see the
				<a href="#drag-set-guard">Drag-Set Guard</a> and
				<a href="#leave-behind">Leave a locked child behind</a> demos below.
			</p>
		</div>

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
					<input
						type="text"
						bind:value={dropZoneStart}
						placeholder="33% or 50px"
						style="width: 80px;"
					/>
				</label>
				<label style="display: flex; align-items: center; gap: 0.5rem;">
					Max Width (px):
					<input
						type="number"
						bind:value={dropZoneMaxWidth}
						min="50"
						max="300"
						style="width: 60px;"
					/>
				</label>
			{/if}
			<label style="display: flex; align-items: center; gap: 0.5rem; margin-left: 1rem;">
				<input type="checkbox" bind:checked={isCopyAllowed} />
				Allow Ctrl+drag to copy
			</label>
			<label style="display: flex; align-items: center; gap: 0.5rem;">
				<input type="checkbox" bind:checked={showDropZoneWhenEmpty} />
				Show drop zone when target empty
			</label>
			<label
				style="display: flex; align-items: center; gap: 0.5rem;"
				title="Ctrl/Cmd+C/X/V, Delete, Esc + Ctrl+Insert / Shift+Insert / Shift+Delete"
			>
				<input type="checkbox" bind:checked={handleKeyboardShortcuts} />
				Built-in keyboard shortcuts
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
						clickBehavior="select"
						data={sourceData}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
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
						shouldHandleKeyboardShortcuts={handleKeyboardShortcuts}
						nodeInputTransformationCallback={transformPasted}
						beforePasteCallback={selfPasteRedirect}
						onCopy={(c) => addLog(`Copied ${c.paths.length} from source-tree`)}
						onCut={(c) => addLog(`Cut ${c.paths.length} from source-tree`)}
						onPaste={(r) =>
							addLog(
								`Pasted ${r.count} into source-tree${r.skipped ? ` (skipped ${r.skipped})` : ''}`
							)}
						onDelete={(c) => addLog(`Deleted ${c.paths.length} node(s) from source-tree`)}
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
							<small style="color: #999; margin-left: 0.5rem; font-size: 0.75em;"
								>(#{node.data?.sortOrder})</small
							>
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
						clickBehavior="select"
						data={targetData}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
						orderMember="sortOrder"
						getIsDraggableCallback={(node) => node.data?.isDraggable !== false}
						getIsDropAllowedCallback={() => true}
						sortCallback={sortByOrder}
						expandLevel={3}
						dragDropMode="both"
						{selectionMode}
						highlightedNodeClass="stv__node-content--highlight-bold"
						bind:highlightedPaths={targetHighlightedPaths}
						shouldHandleKeyboardShortcuts={handleKeyboardShortcuts}
						nodeInputTransformationCallback={transformPasted}
						beforePasteCallback={selfPasteRedirect}
						onCopy={(c) => addLog(`Copied ${c.paths.length} from target-tree`)}
						onCut={(c) => addLog(`Cut ${c.paths.length} from target-tree`)}
						onPaste={(r) =>
							addLog(
								`Pasted ${r.count} into target-tree${r.skipped ? ` (skipped ${r.skipped})` : ''}`
							)}
						onDelete={(c) => addLog(`Deleted ${c.paths.length} node(s) from target-tree`)}
						onNodeDrop={handleTargetDrop}
						shouldDisplayDebugInformation={true}
						shouldShowDropPlaceholderWhenEmpty={showDropZoneWhenEmpty}
						{isCopyAllowed}
						{dropZoneMode}
						{dropZoneLayout}
						{dropZoneStart}
						{dropZoneMaxWidth}
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.icon} {node.data?.name}</span>
							<small style="color: #999; margin-left: 0.5rem; font-size: 0.75em;"
								>(#{node.data?.sortOrder})</small
							>
						{/snippet}
						{#snippet dropPlaceholder()}
							<div style="text-align: center; color: #667eea;">
								<p style="font-size: 2rem;">📥</p>
								<p>Drop items here to add them</p>
								<p style="font-size: 0.8em; color: #999;">
									…or copy in the left tree, hover here, and press Ctrl/Cmd+V
								</p>
							</div>
						{/snippet}
					</Tree>
				</div>
			</div>
		</div>

		{#if sourceHighlightedPaths.size > 0}
			<div class="output">
				<p class="output-label">
					Source highlight ({sourceHighlightedPaths.size}) — dragging any of these moves the whole
					set
				</p>
				<pre>{[...sourceHighlightedPaths].join(', ')}</pre>
			</div>
		{/if}

		{#if targetHighlightedPaths.size > 0}
			<div class="output">
				<p class="output-label">
					Target highlight ({targetHighlightedPaths.size}) — dragging any of these moves the whole
					set within the target tree
				</p>
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
			Control which drop positions are valid per node using <code>allowedDropPositions</code>. Try
			dragging items to different targets. With <code>selectionMode="multi"</code>, Ctrl/Shift+click
			several items first and drag any one of them to move the whole set — per-node
			<code>allowedDropPositions</code> are still enforced on the drop target.
		</p>

		<div class="note">
			<p class="note-title">Node Types</p>
			<ul>
				<li>
					<strong>🗑️ Trash</strong> - Only accepts <code>child</code> drops (drop INTO, not before/after)
				</li>
				<li><strong>📁 Projects</strong> - All positions allowed (default behavior)</li>
				<li>
					<strong>📄 Files</strong> - Only <code>before</code> and <code>after</code> (can't drop INTO
					a file)
				</li>
			</ul>
		</div>

		<div class="tree-container tree-container-tall">
			<Tree
				bind:this={restrictedTreeRef}
				treeId="restricted-tree"
				clickBehavior="select"
				data={restrictedData}
				idMember="id"
				pathMember="path"
				displayValueMember="name"
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
				<p class="output-label">
					Highlight ({restrictedHighlightedPaths.size}) — drag any of these to move the whole set
					(per-node <code>allowedDropPositions</code> still apply)
				</p>
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

	<!-- Drag-Set Guard (beforeDragStartCallback) -->
	<div class="card" id="drag-set-guard">
		<h2>Drag-Set Guard (<code>beforeDragStartCallback</code>)</h2>
		<p class="description">
			A set-level interceptor that fires ONCE at drag start, before anything moves, and can
			<strong>reshape or block the whole dragged set</strong>. It's the only hook that sees the full
			combination — per-node <code>getIsDraggableCallback</code> runs one node at a time and can't
			drop a companion, force one in, or veto based on what else is selected. Folders and files all
			drag normally; the guard only rewrites the set. Try these from the
			<strong>Files</strong> tree into <strong>Destination</strong> and watch the log:
		</p>
		<div class="note">
			<ul>
				<li>
					<strong>Prunes (nested)</strong> — drag 📁 <code>Documents</code>: its nested 🔒
					<code>secret.key</code> is pruned from the manifest and left behind, so only the folder + its
					unlocked files cross.
				</li>
				<li>
					<strong>Prunes (loose)</strong> — Ctrl/Shift+click 📁 <code>Documents</code> <em>and</em>
					🔒 <code>license.key</code>, then drag <code>Documents</code>: the loose locked file is
					removed from the set too.
				</li>
				<li>
					<strong>Augments</strong> — drag <code>invoice.pdf</code>: its linked 🔗
					<code>invoice.sig</code> rides along, even if you didn't select it.
				</li>
				<li>
					<strong>Vetoes</strong> — drag ⛔ <code>system.lock</code> (alone or in a selection): the
					whole drag is cancelled (<code>onNodeDragStart</code> never fires).
				</li>
			</ul>
			<p style="margin: 0.5rem 0 0;">
				Grab a draggable node as the one you drag — the node under the cursor always travels; you
				can prune its companions, just not itself.
			</p>
		</div>

		<div class="controls">
			<button class="btn btn-secondary" onclick={resetGuard}>Reset</button>
		</div>

		<div class="trees-side-by-side">
			<div>
				<h3>Files (drag from here)</h3>
				<div class="tree-container">
					<Tree
						bind:this={guardSourceRef}
						treeId="guard-source"
						clickBehavior="select"
						data={guardSourceData}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
						orderMember="sortOrder"
						sortCallback={sortByOrder}
						isSorted={true}
						expandLevel={3}
						dragDropMode="both"
						selectionMode="multi"
						highlightedNodeClass="stv__node-content--highlight-bold"
						bind:highlightedPaths={guardHighlighted}
						getIsDraggableCallback={() => true}
						getIsDropAllowedCallback={() => true}
						beforeDragStartCallback={beforeGuardDragStart}
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.icon} {node.data?.name}</span>
						{/snippet}
					</Tree>
				</div>
			</div>
			<div>
				<h3>Destination (drop here)</h3>
				<div class="tree-container">
					<Tree
						bind:this={guardDestRef}
						treeId="guard-dest"
						clickBehavior="select"
						data={guardDestData}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
						orderMember="sortOrder"
						sortCallback={sortByOrder}
						isSorted={true}
						expandLevel={3}
						dragDropMode="both"
						getIsDraggableCallback={() => true}
						getIsDropAllowedCallback={() => true}
						beforeDropCallback={guardForceCopy}
						nodeInputTransformationCallback={guardMintId}
						onNodeDrop={onGuardDrop}
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.icon} {node.data?.name}</span>
						{/snippet}
					</Tree>
				</div>
			</div>
		</div>

		<div class="code-block">
			<pre>{`beforeDragStartCallback={(ctx) => {
  // ctx.dragged = full top-level set (the grabbed node + everything highlighted)
  if (ctx.dragged.some((r) => r.node?.data?.protected)) return false;  // VETO whole drag
  const kept = ctx.dragged
    .filter((r) => !r.node?.data?.locked).map((r) => r.path);          // PRUNE locked
  const linked = ctx.dragged
    .map((r) => r.node?.data?.companion).filter(Boolean);              // AUGMENT companions
  return [...kept, ...linked];  // AUTHORITATIVE new set, in landing order
}}`}</pre>
		</div>

		{#if guardLog.length > 0}
			<div class="output">
				<p class="output-label">Activity Log:</p>
				<pre>{guardLog.join('\n')}</pre>
			</div>
		{/if}
	</div>

	<!-- Leave-behind on drag (same-tree, moveNodes holes) -->
	<div class="card" id="leave-behind">
		<h2>Leave a locked child behind (same-tree drag)</h2>
		<p class="description">
			Drag <strong>Documents</strong> onto <strong>Archive</strong>. Its
			<code>beforeDragStartCallback</code> receives the <strong>complete</strong>
			<code>ctx.dragged</code> set (folder + every descendant) and drops 🔒
			<code>secret.key</code> from it. The library's <code>moveNodes</code> treats that omission as
			a <em>hole</em>: it moves the folder with <code>report.doc</code> + <code>notes.txt</code>
			and re-homes the lock to the folder's old parent, so it <strong>stays where it was</strong>.
			Same tree, so the move is fully auto-handled — no <code>onNodeDrop</code> copying.
		</p>

		<div class="controls">
			<button class="btn btn-secondary" onclick={resetLeaveBehind}>Reset</button>
		</div>

		<div class="tree-container">
			<Tree
				treeId="leave-behind"
				clickBehavior="select"
				data={leaveBehindData}
				idMember="id"
				pathMember="path"
				displayValueMember="name"
				orderMember="sortOrder"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={3}
				dragDropMode="self"
				selectionMode="multi"
				highlightedNodeClass="stv__node-content--highlight-bold"
				bind:highlightedPaths={leaveBehindHighlighted}
				getIsDraggableCallback={() => true}
				getIsDropAllowedCallback={() => true}
				beforeDragStartCallback={beforeLeaveBehindDragStart}
				onNodeDrop={onLeaveBehindDrop}
				{...getTreeProps()}
			>
				{#snippet nodeTemplate(node: any)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>

		<div class="code-block">
			<pre>{`beforeDragStartCallback={(ctx) => {
  // ctx.dragged is the COMPLETE flattened set (folder + every descendant).
  // Drop the locked node → the omission is a hole moveNodes leaves behind.
  return ctx.dragged.filter((r) => !r.node?.data?.locked).map((r) => r.path);
}}
// Same tree → the drop is auto-handled: the folder moves, the lock stays put.`}</pre>
		</div>

		{#if leaveBehindLog.length > 0}
			<div class="output">
				<p class="output-label">Activity Log:</p>
				<pre>{leaveBehindLog.join('\n')}</pre>
			</div>
		{/if}
	</div>

	<!-- Sorting Zone (whole-tree drop zone + DropGroup routing) -->
	<div class="card">
		<h2>Sorting Zone (<code>shouldEnableTreeDropZone</code> + <code>DropGroup[]</code>)</h2>
		<p class="description">
			The <strong>Pantry</strong> category nodes reject direct drops (<code
				>getIsDropAllowedCallback</code
			>
			returns <code>false</code>). Instead the
			<strong>whole pantry is one drop zone</strong> (<code>shouldEnableTreeDropZone</code>) — a
			drop anywhere lands with <code>target=null</code>. Ctrl/Shift+click a mixed basket of produce
			on the left and drop it <em>anywhere</em> on the pantry: each item auto-files under 🍎&nbsp;Fruits
			or 🥕&nbsp;Vegetables.
		</p>
		<div class="note">
			<ul>
				<li>
					<strong>Cross-tree (basket → pantry):</strong> the consumer routes arrivals in
					<code>onNodeDrop</code> — the library can't auto-move nodes that live in another tree.
				</li>
				<li>
					<strong>Same-tree re-sort:</strong> drag a produce item already <em>in</em> the pantry
					back onto the zone — <code>beforeDropCallback</code> returns a <code>DropGroup[]</code> and
					the library auto-executes it, fanning the one drop out to the right categories.
				</li>
			</ul>
		</div>

		<div class="controls">
			<button class="btn btn-secondary" onclick={resetProduce}>Reset</button>
		</div>

		<div class="trees-side-by-side">
			<div>
				<h3>Basket (drag from here)</h3>
				<div class="tree-container">
					<Tree
						bind:this={basketRef}
						treeId="produce-basket"
						clickBehavior="select"
						data={basketData}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
						orderMember="sortOrder"
						sortCallback={sortByOrder}
						isSorted={true}
						expandLevel={3}
						dragDropMode="both"
						selectionMode="multi"
						highlightedNodeClass="stv__node-content--highlight-bold"
						bind:highlightedPaths={basketHighlighted}
						getIsDraggableCallback={() => true}
						getIsDropAllowedCallback={() => true}
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.icon} {node.data?.name}</span>
						{/snippet}
					</Tree>
				</div>
			</div>
			<div>
				<h3>Pantry (drop zone — nodes reject direct drops)</h3>
				<div class="tree-container">
					<Tree
						bind:this={pantryRef}
						treeId="produce-pantry"
						clickBehavior="select"
						data={pantryData}
						idMember="id"
						pathMember="path"
						displayValueMember="name"
						orderMember="sortOrder"
						sortCallback={sortByOrder}
						isSorted={true}
						expandLevel={3}
						dragDropMode="both"
						selectionMode="multi"
						highlightedNodeClass="stv__node-content--highlight-bold"
						bind:highlightedPaths={pantryHighlighted}
						getIsDraggableCallback={(node: LTreeNode<ProduceItem>) =>
							node.data?.kind !== 'category'}
						getIsDropAllowedCallback={() => false}
						shouldEnableTreeDropZone={true}
						beforeDropCallback={beforePantryDrop}
						onNodeDrop={onProduceDrop}
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.icon} {node.data?.name}</span>
							{#if node.data?.kind === 'category'}
								<small style="color: #999; margin-left: 0.5rem; font-size: 0.75em;"
									>(category)</small
								>
							{/if}
						{/snippet}
					</Tree>
				</div>
			</div>
		</div>

		{#if produceLog.length > 0}
			<div class="output">
				<p class="output-label">Activity Log:</p>
				<pre>{produceLog.join('\n')}</pre>
			</div>
		{/if}

		<div class="code-block">
			<pre>{`<Tree
  shouldEnableTreeDropZone={true}        // whole tree = one drop target
  getIsDropAllowedCallback={() => false} // nodes reject direct drops
  beforeDropCallback={(ctx) => {
    // SAME-TREE re-sort: fan ONE drop out to many targets by content
    return [
      { targetPath: fruitsPath,     position: 'child', paths: fruitPaths },
      { targetPath: vegetablesPath, position: 'child', paths: vegPaths },
    ];  // DropGroup[] — library auto-moves each same-tree node into place
  }}
  onNodeDrop={({ dragged, dropped }) => {
    if (dropped) return;                 // library already placed the re-sort
    // CROSS-TREE arrivals: place each item into its category yourself
    for (const ref of dragged) routeIntoCategory(ref);
  }}
/>`}</pre>
		</div>
	</div>

	<!-- Touch Drag Instructions -->
	<div class="card">
		<h2>Touch Drag (Mobile)</h2>
		<p class="description">
			On touch devices, long-press (300ms) on a node to start dragging. A ghost element will follow
			your finger.
		</p>

		<div class="tree-container touch-demo-tree" style="max-height: 260px;">
			<Tree
				data={touchData}
				clickBehavior="select"
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
  onNodeDrop={({ source, target, position, operation }) => {
    // source.node = the dragged node (+ its parent/siblings)
    // target.node = the drop node, or target is null on an empty tree/root
    console.log('Dropped:', source.node?.data?.name);
    console.log('Position:', position); // 'before', 'after', or 'child'
    console.log('Operation:', operation); // 'move' or 'copy'
    console.log('On:', target?.node?.data?.name || 'empty tree');
  }}
/>`}</pre>
		</div>
	</div>

	<!-- Drop Placeholder -->
	<div class="card">
		<h2>Drop Placeholder Customization</h2>
		<p class="description">
			When dragging to an empty tree, a customizable placeholder appears. Use the <code
				>dropPlaceholder</code
			> snippet to customize it.
		</p>

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
			<p>
				onNodeDrop receives one context object. <code>source</code>/<code>target</code> are node
				pointers ({`{ node, parent, siblings }`}); <code>position</code> is <code>'before'</code>,
				<code>'after'</code>, or <code>'child'</code>; <code>operation</code> is <code>'move'</code>
				or <code>'copy'</code> (Ctrl+drag):
			</p>
			<pre style="margin-top: 0.5rem;">{`onNodeDrop={({ source, target, position, operation }) => {
  if (target === null) {
    // Dropped on empty tree placeholder or root drop zone
    // Add source.node as a root node
  } else {
    // position: 'before' - insert as sibling before target.node
    // position: 'after' - insert as sibling after target.node
    // position: 'child' - insert as child of target.node
  }
  // operation: 'move' (default) or 'copy' (Ctrl+drag with isCopyAllowed)
}}`}</pre>
		</div>
	</div>

	<!-- Drag Drop Mode -->
	<div class="card">
		<h2>Drag Drop Mode</h2>
		<p class="description">
			Control where drag and drop is allowed with the <code>dragDropMode</code> prop.
		</p>

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
  onNodeDrop={({ source, target, position, operation }) => {
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
