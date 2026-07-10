<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode, DropPosition } from '$lib/ltree/types.js';
	import type {
		NodeDropContext,
		DragStartContext,
		BeforeDropContext,
		DropGroup
	} from '$lib/index.js';

	// Deterministic e2e fixture for drag and drop. Targeted by e2e/drag-drop.spec.ts.
	// Each section exposes the last drop event via dedicated data-testid spans so
	// specs assert on parsed state, not on log strings.

	type Item = {
		id: number;
		path: string;
		name: string;
		sortOrder: number;
	};

	type RestrictedItem = Item & { allowedDropPositions?: DropPosition[] };

	function sortByOrder<T extends { sortOrder: number }>(items: LTreeNode<T>[]) {
		return [...items].sort((a, b) => {
			if (a.parentPath !== b.parentPath) {
				return (a.parentPath || '').localeCompare(b.parentPath || '');
			}
			return (a.data?.sortOrder ?? 0) - (b.data?.sortOrder ?? 0);
		});
	}

	type DropState = {
		count: number;
		dragged: string;
		target: string;
		position: string;
		operation: string;
		tree: string;
	};

	function emptyDropState(): DropState {
		return { count: 0, dragged: '', target: '', position: '', operation: '', tree: '' };
	}

	// ── Section 1: single-tree drag ────────────────────────────────────────

	let singleData: Item[] = $state([
		{ id: 1, path: '1', name: 'Alpha', sortOrder: 10 },
		{ id: 2, path: '1.1', name: 'Alpha-1', sortOrder: 10 },
		{ id: 3, path: '1.2', name: 'Alpha-2', sortOrder: 20 },
		{ id: 4, path: '2', name: 'Beta', sortOrder: 20 },
		{ id: 5, path: '2.1', name: 'Beta-1', sortOrder: 10 }
	]);

	let singleDrop: DropState = $state(emptyDropState());

	function onSingleDrop({ source, target, position, operation }: NodeDropContext<Item>) {
		singleDrop = {
			count: singleDrop.count + 1,
			dragged: source.node?.data?.name ?? '',
			target: target?.node?.data?.name ?? '(root)',
			position,
			operation,
			tree: 'single'
		};
	}

	// ── Section 2: two-tree drag (source ↔ target, target starts empty) ────

	function initialSourceData(): Item[] {
		return [
			{ id: 11, path: '1', name: 'Src-Root', sortOrder: 10 },
			{ id: 12, path: '1.1', name: 'Src-A', sortOrder: 10 },
			{ id: 13, path: '1.2', name: 'Src-B', sortOrder: 20 }
		];
	}

	let sourceData: Item[] = $state(initialSourceData());
	let targetData: Item[] = $state<Item[]>([]);
	let targetTreeRef: Tree<Item>;
	let crossTreeId = 1000;

	let twoTreesDrop: DropState = $state(emptyDropState());

	function onSourceDrop({ source, target, position, operation }: NodeDropContext<Item>) {
		twoTreesDrop = {
			count: twoTreesDrop.count + 1,
			dragged: source.node?.data?.name ?? '',
			target: target?.node?.data?.name ?? '(root)',
			position,
			operation,
			tree: 'source'
		};
	}

	function onTargetDrop({ source, target, position, operation }: NodeDropContext<Item>) {
		const dropNode = target?.node ?? null;
		const draggedNode = source.node;
		twoTreesDrop = {
			count: twoTreesDrop.count + 1,
			dragged: draggedNode?.data?.name ?? '',
			target: dropNode?.data?.name ?? '(root)',
			position,
			operation,
			tree: 'target'
		};

		const isSameTree = draggedNode?.treeId === 'two-trees-target';
		if (isSameTree || !draggedNode) return;

		// Cross-tree: copy descendants into the target tree so spec can assert
		// that the dragged node landed in the target with a fresh id.
		let parentPath: string = '';
		let siblingPath: string | undefined;
		let copyPos: 'before' | 'after' | undefined;

		if (dropNode === null) {
			parentPath = '';
		} else if (position === 'child') {
			parentPath = dropNode.path;
		} else {
			parentPath = dropNode.parentPath || '';
			siblingPath = dropNode.path;
			copyPos = position as 'before' | 'after';
		}

		targetTreeRef.copyNodeWithDescendants(
			draggedNode,
			parentPath,
			(data: Item) => ({ ...data, id: crossTreeId++, path: '', sortOrder: data.sortOrder || 10 }),
			siblingPath,
			copyPos
		);
	}

	function resetTwoTrees() {
		sourceData = initialSourceData();
		targetData = [];
		twoTreesDrop = emptyDropState();
		crossTreeId = 1000;
	}

	// ── Section 3: restricted positions via allowedDropPositionsMember ─────

	let restrictedMemberData: RestrictedItem[] = $state([
		{ id: 21, path: '1', name: 'TrashChildOnly', sortOrder: 10, allowedDropPositions: ['child'] },
		{ id: 22, path: '2', name: 'NormalFolder', sortOrder: 20 },
		{
			id: 23,
			path: '3',
			name: 'FileBeforeAfter',
			sortOrder: 30,
			allowedDropPositions: ['before', 'after']
		},
		{ id: 24, path: '4', name: 'Mover', sortOrder: 40 }
	]);

	let restrictedMemberDrop: DropState = $state(emptyDropState());

	function onRestrictedMemberDrop({
		source,
		target,
		position,
		operation
	}: NodeDropContext<RestrictedItem>) {
		restrictedMemberDrop = {
			count: restrictedMemberDrop.count + 1,
			dragged: source.node?.data?.name ?? '',
			target: target?.node?.data?.name ?? '(root)',
			position,
			operation,
			tree: 'restricted-member'
		};
	}

	// ── Section 4: restricted positions via getAllowedDropPositionsCallback ─

	let restrictedCallbackData: Item[] = $state([
		{ id: 31, path: '1', name: 'OddBeforeOnly-31', sortOrder: 10 },
		{ id: 32, path: '2', name: 'EvenChildOnly-32', sortOrder: 20 },
		{ id: 33, path: '3', name: 'OddBeforeOnly-33', sortOrder: 30 },
		{ id: 34, path: '4', name: 'Mover-34', sortOrder: 40 }
	]);

	function callbackAllowed(node: LTreeNode<Item>): DropPosition[] | null {
		if (!node.data) return null;
		return node.data.id % 2 === 1 ? ['before'] : ['child'];
	}

	let restrictedCallbackDrop: DropState = $state(emptyDropState());

	function onRestrictedCallbackDrop({
		source,
		target,
		position,
		operation
	}: NodeDropContext<Item>) {
		restrictedCallbackDrop = {
			count: restrictedCallbackDrop.count + 1,
			dragged: source.node?.data?.name ?? '',
			target: target?.node?.data?.name ?? '(root)',
			position,
			operation,
			tree: 'restricted-callback'
		};
	}

	// ── Section 5: Ctrl-drag copy ──────────────────────────────────────────

	let copyData: Item[] = $state([
		{ id: 41, path: '1', name: 'CopyFoo', sortOrder: 10 },
		{ id: 42, path: '2', name: 'CopyBar', sortOrder: 20 }
	]);

	let copyDrop: DropState = $state(emptyDropState());

	function onCopyDrop({ source, target, position, operation }: NodeDropContext<Item>) {
		copyDrop = {
			count: copyDrop.count + 1,
			dragged: source.node?.data?.name ?? '',
			target: target?.node?.data?.name ?? '(root)',
			position,
			operation,
			tree: 'copy'
		};
	}

	// ── Section 6: multi-drag (selectionMode='multi') ──────────────────────

	function initialMultiData(): Item[] {
		return [
			{ id: 61, path: '1', name: 'Multi-A', sortOrder: 10 },
			{ id: 62, path: '1.1', name: 'A-1', sortOrder: 10 },
			{ id: 63, path: '1.2', name: 'A-2', sortOrder: 20 },
			{ id: 64, path: '2', name: 'Multi-B', sortOrder: 20 },
			{ id: 65, path: '3', name: 'Multi-C', sortOrder: 30 },
			{ id: 66, path: '4', name: 'Multi-D', sortOrder: 40 }
		];
	}

	let multiData: Item[] = $state(initialMultiData());
	let multiHighlighted = $state(new Set<string>());
	let multiFocused = $state<LTreeNode<Item> | null>(null);
	let multiDrop: DropState = $state(emptyDropState());

	const multiHighlightedSorted = $derived(
		[...multiHighlighted].sort((a, b) => a.localeCompare(b)).join(',')
	);

	function onMultiDrop({ source, target, position, operation }: NodeDropContext<Item>) {
		multiDrop = {
			count: multiDrop.count + 1,
			dragged: source.node?.data?.name ?? '',
			target: target?.node?.data?.name ?? '(root)',
			position,
			operation,
			tree: 'multi'
		};
	}

	function resetMulti() {
		multiData = initialMultiData();
		multiHighlighted = new Set();
		multiFocused = null;
		multiDrop = emptyDropState();
	}

	// ── Section 6b: multi-drag with a LOCKED node (isDraggable=false) ───────
	// Mirrors the /examples/drag-drop "File C (pinned)" scenario: a non-draggable
	// node that happens to be in the multi-highlight set must NOT ride along.

	type LockableItem = Item & { draggable?: boolean };

	function initialLockedData(): LockableItem[] {
		return [
			{ id: 71, path: '1', name: 'Lock-A', sortOrder: 10 },
			{ id: 72, path: '2', name: 'Lock-B', sortOrder: 20 },
			{ id: 73, path: '3', name: 'Lock-C', sortOrder: 30, draggable: false }, // pinned
			{ id: 74, path: '4', name: 'Lock-D', sortOrder: 40 } // drop target
		];
	}

	let lockedData: LockableItem[] = $state(initialLockedData());
	let lockedHighlighted = $state(new Set<string>());
	let lockedFocused = $state<LTreeNode<LockableItem> | null>(null);
	let lockedDrop: DropState = $state(emptyDropState());

	function onLockedDrop({ source, target, position, operation }: NodeDropContext<LockableItem>) {
		lockedDrop = {
			count: lockedDrop.count + 1,
			dragged: source.node?.data?.name ?? '',
			target: target?.node?.data?.name ?? '(root)',
			position,
			operation,
			tree: 'locked'
		};
	}

	function resetLocked() {
		lockedData = initialLockedData();
		lockedHighlighted = new Set();
		lockedFocused = null;
		lockedDrop = emptyDropState();
	}

	// ── Section 7: touch drag ──────────────────────────────────────────────

	let touchData: Item[] = $state([
		{ id: 51, path: '1', name: 'TouchA', sortOrder: 10 },
		{ id: 52, path: '2', name: 'TouchB', sortOrder: 20 },
		{ id: 53, path: '3', name: 'TouchC', sortOrder: 30 }
	]);

	let touchDrop: DropState = $state(emptyDropState());

	function onTouchDrop({ source, target, position, operation }: NodeDropContext<Item>) {
		touchDrop = {
			count: touchDrop.count + 1,
			dragged: source.node?.data?.name ?? '',
			target: target?.node?.data?.name ?? '(root)',
			position,
			operation,
			tree: 'touch'
		};
	}

	// ── Section 8: beforeDragStartCallback (prune / augment / veto) ─────────
	// The callback rewrites the dragged set BEFORE the drag engages:
	//   - drops any `pinned` node (prune),
	//   - force-adds a node's `companion` even if it wasn't selected (augment),
	//   - cancels the whole drag when the grabbed node is `protected` (veto).

	type BdItem = Item & { pinned?: boolean; companion?: string; protected?: boolean };

	function initialBdData(): BdItem[] {
		return [
			{ id: 81, path: '1', name: 'BD-A', sortOrder: 10 },
			{ id: 82, path: '2', name: 'BD-B', sortOrder: 20, pinned: true }, // pruned from any drag
			{ id: 83, path: '3', name: 'BD-C', sortOrder: 30 },
			{ id: 84, path: '4', name: 'BD-D', sortOrder: 40, companion: '5' }, // drags BD-E along
			{ id: 85, path: '5', name: 'BD-E', sortOrder: 50 }, // force-added companion
			{ id: 86, path: '6', name: 'BD-F', sortOrder: 60, protected: true }, // vetoes the drag
			{ id: 87, path: '7', name: 'BD-Target', sortOrder: 70 } // drop target
		];
	}

	let bdData: BdItem[] = $state(initialBdData());
	let bdHighlighted = $state(new Set<string>());
	let bdFocused = $state<LTreeNode<BdItem> | null>(null);
	let bdDrop: DropState = $state(emptyDropState());
	let bdStartCount = $state(0); // onNodeDragStart fires (proves veto suppressed it when 0)
	let bdLastSet = $state(''); // the paths the callback finally decided on

	function beforeBdDragStart(ctx: DragStartContext<BdItem>): string[] | false | void {
		// Veto: a protected lead cancels the whole drag.
		if (ctx.lead.node?.data?.protected) {
			bdLastSet = '(cancelled)';
			return false;
		}
		// Prune pinned nodes; force-add each dragged node's companion.
		const kept = ctx.dragged.filter((r) => !r.node?.data?.pinned).map((r) => r.path);
		const companions = ctx.dragged
			.map((r) => r.node?.data?.companion)
			.filter((p): p is string => !!p);
		const result = [...kept, ...companions];
		bdLastSet = result.join(',');
		return result;
	}

	function onBdDragStart() {
		bdStartCount += 1;
	}

	function onBdDrop({ source, target, position, operation }: NodeDropContext<BdItem>) {
		bdDrop = {
			count: bdDrop.count + 1,
			dragged: source.node?.data?.name ?? '',
			target: target?.node?.data?.name ?? '(root)',
			position,
			operation,
			tree: 'bd'
		};
	}

	function resetBd() {
		bdData = initialBdData();
		bdHighlighted = new Set();
		bdFocused = null;
		bdDrop = emptyDropState();
		bdStartCount = 0;
		bdLastSet = '';
	}

	// ── Section 9: tree-level drop zone + content-addressed routing ────────
	// The whole tree is one drop zone (nodes reject drops). Dropping the produce onto the zone
	// routes each item to its category node by data.kind — a beforeDropCallback DropGroup[].

	type ProduceItem = Item & { kind?: 'fruit' | 'vegetable' | 'category' };

	function initialProduceData(): ProduceItem[] {
		return [
			{ id: 91, path: '1', name: 'Fruits', sortOrder: 10, kind: 'category' },
			{ id: 92, path: '2', name: 'Vegetables', sortOrder: 20, kind: 'category' },
			{ id: 93, path: '3', name: 'Apple', sortOrder: 30, kind: 'fruit' },
			{ id: 94, path: '4', name: 'Carrot', sortOrder: 40, kind: 'vegetable' },
			{ id: 95, path: '5', name: 'Banana', sortOrder: 50, kind: 'fruit' }
		];
	}

	let produceData: ProduceItem[] = $state(initialProduceData());
	let produceHighlighted = $state(new Set<string>());
	let produceFocused = $state<LTreeNode<ProduceItem> | null>(null);
	let produceDrop: DropState = $state(emptyDropState());
	let produceRouted = $state(''); // "targetName:count" pairs, proving the fan-out

	// Route each dragged item to its category node by kind. Returns a DropGroup[] so a single
	// drop onto the zone sorts a mixed basket into the proper nodes.
	function beforeProduceDrop(ctx: BeforeDropContext<ProduceItem>): DropGroup[] {
		const byTarget = new Map<string, string[]>();
		for (const ref of ctx.dragged) {
			const kind = ref.node?.data?.kind;
			const targetPath = kind === 'vegetable' ? '2' : '1'; // Vegetables : Fruits
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

	function onProduceDrop({ dropped }: NodeDropContext<ProduceItem>) {
		// Summarize where the library placed the items, grouped by their new parent's name.
		const counts = new Map<string, number>();
		for (const ref of dropped ?? []) {
			const parentName = ref.parent?.data?.name ?? '(root)';
			counts.set(parentName, (counts.get(parentName) ?? 0) + 1);
		}
		produceRouted = [...counts.entries()]
			.sort((a, b) => a[0].localeCompare(b[0]))
			.map(([name, n]) => `${name}:${n}`)
			.join(',');
		produceDrop = {
			count: produceDrop.count + 1,
			dragged: '',
			target: '(zone)',
			position: 'child',
			operation: 'move',
			tree: 'produce'
		};
	}

	function resetProduce() {
		produceData = initialProduceData();
		produceHighlighted = new Set();
		produceFocused = null;
		produceDrop = emptyDropState();
		produceRouted = '';
	}

	// ── Section 10: moveNodes batch primitive (whole subtree vs hole leave-behind) ──
	// Imperative moveNodes() calls. A COMPLETE manifest moves the whole subtree; a manifest
	// that OMITS a descendant leaves it behind (re-homed to the moved root's old parent).
	type MNItem = { id: number; path: string; name: string; sortOrder: number };

	function initialMN(): MNItem[] {
		return [
			{ id: 1, path: '1', name: 'MN-Folder', sortOrder: 10 },
			{ id: 2, path: '1.1', name: 'MN-A', sortOrder: 10 },
			{ id: 3, path: '1.2', name: 'MN-Locked', sortOrder: 20 },
			{ id: 4, path: '1.3', name: 'MN-B', sortOrder: 30 },
			{ id: 5, path: '2', name: 'MN-Target', sortOrder: 20 }
		];
	}

	let mnData: MNItem[] = $state(initialMN());
	let mnTreeRef: Tree<MNItem>;
	let mnResult = $state('');
	let mnFolderParent = $state('');
	let mnFolderChildren = $state('');
	let mnLockedParent = $state('');

	function mnRecord(r: { movedNodes: LTreeNode<MNItem>[]; leftBehind: LTreeNode<MNItem>[] }) {
		mnResult = `moved:${r.movedNodes.length},left:${r.leftBehind.length}`;
		const folder = r.movedNodes[0] ?? null;
		mnFolderParent = folder ? folder.parentPath || '(root)' : '';
		mnFolderChildren = folder
			? Object.values(folder.children)
					.map((c) => c.data?.name ?? '')
					.sort()
					.join(',')
			: '';
		const locked = r.leftBehind[0] ?? null;
		mnLockedParent = locked ? locked.parentPath || '(root)' : '(none)';
	}

	// Complete manifest → no holes → whole subtree moves (MN-Locked rides along).
	function mnMoveWhole() {
		mnRecord(mnTreeRef.moveNodes(['1', '1.1', '1.2', '1.3'], '2', 'child'));
	}

	// MN-Locked (1.2) omitted → hole → left behind at MN-Folder's old parent (root).
	function mnMoveHole() {
		mnRecord(mnTreeRef.moveNodes(['1', '1.1', '1.3'], '2', 'child'));
	}

	function mnReset() {
		mnData = initialMN();
		mnResult = '';
		mnFolderParent = '';
		mnFolderChildren = '';
		mnLockedParent = '';
	}

	// ── Section 11: drag leaves a locked descendant behind (beforeDragStart → moveNodes hole) ──
	// ctx.dragged is the COMPLETE flattened set, so the callback can filter descendants; the
	// omitted (locked) node becomes a hole moveNodes re-homes to the folder's old parent.
	type DhItem = { id: number; path: string; name: string; sortOrder: number; locked?: boolean };

	function initialDh(): DhItem[] {
		return [
			{ id: 1, path: '1', name: 'DH-Folder', sortOrder: 10 },
			{ id: 2, path: '1.1', name: 'DH-A', sortOrder: 10 },
			{ id: 3, path: '1.2', name: 'DH-Lock', sortOrder: 20, locked: true },
			{ id: 4, path: '1.3', name: 'DH-B', sortOrder: 30 },
			{ id: 5, path: '2', name: 'DH-Target', sortOrder: 20 }
		];
	}

	let dhData: DhItem[] = $state(initialDh());
	let dhTreeRef: Tree<DhItem>;
	let dhDropCount = $state(0);
	let dhDraggedSize = $state(0); // proves ctx.dragged is the flattened set
	let dhFolderChildren = $state('');
	let dhLockParent = $state('');

	function beforeDhDragStart(ctx: DragStartContext<DhItem>): string[] {
		dhDraggedSize = ctx.dragged.length;
		return ctx.dragged.filter((r) => !r.node?.data?.locked).map((r) => r.path);
	}

	function onDhDrop({ dropped }: NodeDropContext<DhItem>) {
		dhDropCount += 1;
		const folder = dropped?.[0]?.node ?? null; // the moved root (dropped is NodeRef[])
		dhFolderChildren = folder
			? Object.values(folder.children)
					.map((c) => c.data?.name ?? '')
					.sort()
					.join(',')
			: '';
		const all = dhTreeRef.getAllData();
		const lockData = all.find((d) => d.name === 'DH-Lock');
		const lockNode = lockData ? dhTreeRef.getNodeByPath(lockData.path) : null;
		dhLockParent = lockNode ? lockNode.parentPath || '(root)' : '(gone)';
	}

	function resetDh() {
		dhData = initialDh();
		dhDropCount = 0;
		dhDraggedSize = 0;
		dhFolderChildren = '';
		dhLockParent = '';
	}

	// ── Section 12: copyNodeWithDescendants null-skip (cross-tree leave-behind) ──
	// The copy transform returning null SKIPS that node + its subtree — the copy twin of the
	// moveNodes hole. Copying CS-Src into CS-Dest while returning null for CS-Locked drops it.
	type CsItem = { id: number; path: string; name: string; sortOrder: number; locked?: boolean };

	function initialCs(): CsItem[] {
		return [
			{ id: 1, path: '1', name: 'CS-Src', sortOrder: 10 },
			{ id: 2, path: '1.1', name: 'CS-A', sortOrder: 10 },
			{ id: 3, path: '1.2', name: 'CS-Locked', sortOrder: 20, locked: true },
			{ id: 4, path: '1.3', name: 'CS-B', sortOrder: 30 },
			{ id: 5, path: '2', name: 'CS-Dest', sortOrder: 20 }
		];
	}

	let csData: CsItem[] = $state(initialCs());
	let csTreeRef: Tree<CsItem>;
	let csNextId = 100;
	let csResult = $state('');
	let csDestChildren = $state('');

	// Copy CS-Src into CS-Dest, skipping the locked descendant via a null-returning transform.
	function csCopySkipLocked() {
		const src = csTreeRef.getNodeByPath('1');
		const dest = csTreeRef.getNodeByPath('2');
		if (!src || !dest) return;
		const r = csTreeRef.copyNodeWithDescendants(src, dest.path, (d: CsItem) =>
			d.locked ? null : { ...d, id: csNextId++, path: '' }
		);
		csResult = `success:${r.success},count:${r.count}`;
		const copyRoot = Object.values(dest.children)[0] ?? null;
		csDestChildren = copyRoot
			? Object.values(copyRoot.children)
					.map((c) => c.data?.name ?? '')
					.sort()
					.join(',')
			: '';
	}

	function resetCs() {
		csData = initialCs();
		csNextId = 100;
		csResult = '';
		csDestChildren = '';
	}

	// ── Section 13: duplicateNodes (batch copy primitive, manifest holes) ──
	// The copy-side twin of moveNodes: duplicate a COMPLETE manifest into a target. A descendant
	// ABSENT from the manifest is a hole — NOT copied (nothing to re-home; the source stays put).
	// Each node's data runs through the input transform (derive fresh ids). Two cases:
	//  (a) one root with a hole → copy omits it, source keeps it;
	//  (b) two roots → chained under the target in source order.
	type DnItem = { id: number; path: string; name: string; sortOrder: number; locked?: boolean };

	function initialDn(): DnItem[] {
		return [
			{ id: 1, path: '1', name: 'DN-Src', sortOrder: 10 },
			{ id: 2, path: '1.1', name: 'DN-A', sortOrder: 10 },
			{ id: 3, path: '1.2', name: 'DN-Locked', sortOrder: 20, locked: true },
			{ id: 4, path: '1.3', name: 'DN-B', sortOrder: 30 },
			{ id: 5, path: '2', name: 'DN-Dest', sortOrder: 20 }
		];
	}

	let dnData: DnItem[] = $state(initialDn());
	let dnTreeRef: Tree<DnItem>;
	let dnNextId = 200;
	let dnResult = $state('');
	let dnDestChildren = $state('');
	let dnSrcChildren = $state('');

	const dnMint = (d: DnItem) => ({ ...d, id: dnNextId++, path: '' });

	function dnChildrenOf(path: string): string {
		const n = dnTreeRef.getNodeByPath(path);
		return n
			? Object.values(n.children)
					.map((c) => c.data?.name ?? '')
					.sort()
					.join(',')
			: '(gone)';
	}

	// (a) Duplicate DN-Src into DN-Dest, but with DN-Locked (1.2) OMITTED from the manifest.
	function dnCopyWithHole() {
		const r = dnTreeRef.duplicateNodes(['1', '1.1', '1.3'], '2', 'child', dnMint);
		dnResult = `success:${r.success},roots:${r.copiedNodes.length},skipped:${r.skipped}`;
		// dest's single copied root's children (should be DN-A,DN-B — no DN-Locked)
		const copyRoot = Object.values(dnTreeRef.getNodeByPath('2')?.children ?? {})[0] ?? null;
		dnDestChildren = copyRoot
			? Object.values(copyRoot.children)
					.map((c) => c.data?.name ?? '')
					.sort()
					.join(',')
			: '';
		dnSrcChildren = dnChildrenOf('1'); // source subtree must be untouched
	}

	// (b) Duplicate two leaf roots (DN-A, DN-B) into DN-Dest, chained.
	function dnCopyTwoRoots() {
		const r = dnTreeRef.duplicateNodes(['1.1', '1.3'], '2', 'child', dnMint);
		dnResult = `success:${r.success},roots:${r.copiedNodes.length},skipped:${r.skipped}`;
		dnDestChildren = dnChildrenOf('2');
		dnSrcChildren = dnChildrenOf('1');
	}

	function resetDnSection() {
		dnData = initialDn();
		dnNextId = 200;
		dnResult = '';
		dnDestChildren = '';
		dnSrcChildren = '';
	}

	// ── Section 14: cross-tree AUTO-copy (library places, no consumer loop) ──
	// The dest tree forces operation 'copy' via beforeDropCallback, so a cross-tree drop is
	// auto-handled: the source publishes its (guard-pruned) manifest, and the library's
	// duplicateNodes copies whole subtrees into the dest — skipping a pruned node as a manifest
	// hole and minting ids via nodeInputTransformationCallback. onNodeDrop only LOGS ctx.dropped.
	type XcItem = { id: number; path: string; name: string; sortOrder: number; locked?: boolean };

	function initialXcSrc(): XcItem[] {
		return [
			{ id: 1, path: '1', name: 'XC-Folder', sortOrder: 10 },
			{ id: 2, path: '1.1', name: 'XC-A', sortOrder: 10 },
			{ id: 3, path: '1.2', name: 'XC-Locked', sortOrder: 20, locked: true },
			{ id: 4, path: '1.3', name: 'XC-B', sortOrder: 30 }
		];
	}
	function initialXcDest(): XcItem[] {
		return [{ id: 50, path: '1', name: 'XC-Dest', sortOrder: 10 }];
	}

	let xcSrcData: XcItem[] = $state(initialXcSrc());
	let xcDestData: XcItem[] = $state(initialXcDest());
	let xcSrcRef: Tree<XcItem>;
	let xcDestRef: Tree<XcItem>;
	let xcNextId = 300;
	let xcDropped = $state('');
	let xcDestChildren = $state('');
	let xcSrcChildren = $state('');

	// PRUNE the locked file out of the dragged set (leaves it behind on the source).
	function xcPrune(ctx: DragStartContext<XcItem>): string[] {
		return ctx.dragged.filter((r) => !r.node?.data?.locked).map((r) => r.path);
	}
	// Force every drop on the dest into a copy the library auto-handles.
	const xcForceCopy = () => ({ operation: 'copy' as const });
	// INPUT transform: mint a fresh id as each copy lands.
	const xcMint = (d: XcItem) => ({ ...d, id: xcNextId++ });

	function onXcDrop({ dropped }: NodeDropContext<XcItem>) {
		xcDropped = (dropped ?? [])
			.map((r) => r.node?.data?.name ?? '')
			.filter(Boolean)
			.join(',');
		const copyRoot = dropped?.[0]?.node ?? null;
		xcDestChildren = copyRoot
			? Object.values(copyRoot.children)
					.map((c) => c.data?.name ?? '')
					.sort()
					.join(',')
			: '';
		const src = xcSrcRef.getNodeByPath('1');
		xcSrcChildren = src
			? Object.values(src.children)
					.map((c) => c.data?.name ?? '')
					.sort()
					.join(',')
			: '';
	}

	function resetXc() {
		xcSrcData = initialXcSrc();
		xcDestData = initialXcDest();
		xcNextId = 300;
		xcDropped = '';
		xcDestChildren = '';
		xcSrcChildren = '';
	}
</script>

<svelte:head>
	<title>Test — Drag &amp; Drop Fixture</title>
</svelte:head>

<main>
	<h1>Drag &amp; Drop Test Fixture</h1>

	<section data-testid="section-single">
		<h2>Single-Tree Drag</h2>
		<div class="drop-state">
			<span>count: <b data-testid="single-drop-count">{singleDrop.count}</b></span>
			<span>dragged: <b data-testid="single-drop-dragged">{singleDrop.dragged}</b></span>
			<span>target: <b data-testid="single-drop-target">{singleDrop.target}</b></span>
			<span>pos: <b data-testid="single-drop-position">{singleDrop.position}</b></span>
			<span>op: <b data-testid="single-drop-operation">{singleDrop.operation}</b></span>
		</div>
		<div class="tree-box">
			<Tree
				treeId="single"
				data={singleData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
				dragDropMode="self"
				getIsDraggableCallback={() => true}
				getIsDropAllowedCallback={() => true}
				onNodeDrop={onSingleDrop}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span data-testid="single-node-{node.path}">{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
	</section>

	<section data-testid="section-two-trees">
		<h2>Two-Tree Drag (Source → Target)</h2>
		<button data-testid="two-trees-reset" onclick={resetTwoTrees}>Reset</button>
		<div class="drop-state">
			<span>count: <b data-testid="two-trees-drop-count">{twoTreesDrop.count}</b></span>
			<span>tree: <b data-testid="two-trees-drop-tree">{twoTreesDrop.tree}</b></span>
			<span>dragged: <b data-testid="two-trees-drop-dragged">{twoTreesDrop.dragged}</b></span>
			<span>target: <b data-testid="two-trees-drop-target">{twoTreesDrop.target}</b></span>
			<span>pos: <b data-testid="two-trees-drop-position">{twoTreesDrop.position}</b></span>
			<span>op: <b data-testid="two-trees-drop-operation">{twoTreesDrop.operation}</b></span>
		</div>
		<div class="two-trees">
			<div class="tree-box" data-testid="two-trees-source-box">
				<h3>Source</h3>
				<Tree
					treeId="two-trees-source"
					data={sourceData}
					idMember="id"
					pathMember="path"
					orderMember="sortOrder"
					sortCallback={sortByOrder}
					isSorted={true}
					expandLevel={10}
					dragDropMode="both"
					getIsDraggableCallback={() => true}
					getIsDropAllowedCallback={() => true}
					onNodeDrop={onSourceDrop}
				>
					{#snippet nodeTemplate(node: LTreeNode<Item>)}
						<span data-testid="source-node-{node.path}">{node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
			<div class="tree-box" data-testid="two-trees-target-box">
				<h3>Target {targetData.length === 0 ? '(empty)' : ''}</h3>
				<Tree
					bind:this={targetTreeRef}
					treeId="two-trees-target"
					data={targetData}
					idMember="id"
					pathMember="path"
					orderMember="sortOrder"
					sortCallback={sortByOrder}
					isSorted={true}
					expandLevel={10}
					dragDropMode="both"
					getIsDraggableCallback={() => true}
					getIsDropAllowedCallback={() => true}
					onNodeDrop={onTargetDrop}
				>
					{#snippet nodeTemplate(node: LTreeNode<Item>)}
						<span data-testid="target-node-{node.path}">{node.data?.name}</span>
					{/snippet}
					{#snippet dropPlaceholder()}
						<div data-testid="target-empty-placeholder">Drop here</div>
					{/snippet}
				</Tree>
			</div>
		</div>
	</section>

	<section data-testid="section-restricted-member">
		<h2>Restricted via allowedDropPositionsMember</h2>
		<div class="drop-state">
			<span>count: <b data-testid="r-member-drop-count">{restrictedMemberDrop.count}</b></span>
			<span>target: <b data-testid="r-member-drop-target">{restrictedMemberDrop.target}</b></span>
			<span>pos: <b data-testid="r-member-drop-position">{restrictedMemberDrop.position}</b></span>
		</div>
		<div class="tree-box">
			<Tree
				treeId="restricted-member"
				data={restrictedMemberData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				allowedDropPositionsMember="allowedDropPositions"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
				dragDropMode="self"
				getIsDraggableCallback={() => true}
				getIsDropAllowedCallback={() => true}
				onNodeDrop={onRestrictedMemberDrop}
			>
				{#snippet nodeTemplate(node: LTreeNode<RestrictedItem>)}
					<span data-testid="r-member-node-{node.path}">{node.data?.name}</span>
					{#if node.data?.allowedDropPositions}
						<small data-testid="r-member-hint-{node.path}"
							>[{node.data.allowedDropPositions.join('|')}]</small
						>
					{/if}
				{/snippet}
			</Tree>
		</div>
	</section>

	<section data-testid="section-restricted-callback">
		<h2>Restricted via getAllowedDropPositionsCallback</h2>
		<p class="hint">Odd id → ['before'], Even id → ['child'].</p>
		<div class="drop-state">
			<span>count: <b data-testid="r-callback-drop-count">{restrictedCallbackDrop.count}</b></span>
			<span
				>target: <b data-testid="r-callback-drop-target">{restrictedCallbackDrop.target}</b></span
			>
			<span
				>pos: <b data-testid="r-callback-drop-position">{restrictedCallbackDrop.position}</b></span
			>
		</div>
		<div class="tree-box">
			<Tree
				treeId="restricted-callback"
				data={restrictedCallbackData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				getAllowedDropPositionsCallback={callbackAllowed}
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
				dragDropMode="self"
				getIsDraggableCallback={() => true}
				getIsDropAllowedCallback={() => true}
				onNodeDrop={onRestrictedCallbackDrop}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span data-testid="r-callback-node-{node.path}">{node.data?.name} (#{node.data?.id})</span
					>
				{/snippet}
			</Tree>
		</div>
	</section>

	<section data-testid="section-copy">
		<h2>Ctrl-Drag Copy (isCopyAllowed=true)</h2>
		<div class="drop-state">
			<span>count: <b data-testid="copy-drop-count">{copyDrop.count}</b></span>
			<span>dragged: <b data-testid="copy-drop-dragged">{copyDrop.dragged}</b></span>
			<span>target: <b data-testid="copy-drop-target">{copyDrop.target}</b></span>
			<span>op: <b data-testid="copy-drop-operation">{copyDrop.operation}</b></span>
		</div>
		<div class="tree-box">
			<Tree
				treeId="copy"
				data={copyData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
				dragDropMode="self"
				getIsDraggableCallback={() => true}
				getIsDropAllowedCallback={() => true}
				isCopyAllowed={true}
				onNodeDrop={onCopyDrop}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span data-testid="copy-node-{node.path}">{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
	</section>

	<section data-testid="section-multi">
		<h2>Multi-Drag (selectionMode='multi')</h2>
		<button data-testid="multi-reset" onclick={resetMulti}>Reset</button>
		<div class="drop-state">
			<span>count: <b data-testid="multi-drop-count">{multiDrop.count}</b></span>
			<span>dragged: <b data-testid="multi-drop-dragged">{multiDrop.dragged}</b></span>
			<span>target: <b data-testid="multi-drop-target">{multiDrop.target}</b></span>
			<span>pos: <b data-testid="multi-drop-position">{multiDrop.position}</b></span>
			<span>hi.size: <b data-testid="multi-highlighted-size">{multiHighlighted.size}</b></span>
			<span>hi.sorted: <b data-testid="multi-highlighted-sorted">{multiHighlightedSorted}</b></span>
			<span>focused: <b data-testid="multi-focused-path">{multiFocused?.path ?? ''}</b></span>
		</div>
		<div class="tree-box">
			<Tree
				treeId="multi"
				data={multiData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
				dragDropMode="self"
				getIsDraggableCallback={() => true}
				getIsDropAllowedCallback={() => true}
				clickBehavior="select"
				selectionMode="multi"
				highlightedNodeClass="stv__node-content--highlight-bold"
				bind:focusedNode={multiFocused}
				bind:highlightedPaths={multiHighlighted}
				onNodeDrop={onMultiDrop}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span data-testid="multi-node-{node.path}">{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
	</section>

	<section data-testid="section-multi-locked">
		<h2>Multi-Drag with a locked node (isDraggable=false)</h2>
		<button data-testid="locked-reset" onclick={resetLocked}>Reset</button>
		<div class="drop-state">
			<span>count: <b data-testid="locked-drop-count">{lockedDrop.count}</b></span>
			<span>dragged: <b data-testid="locked-drop-dragged">{lockedDrop.dragged}</b></span>
			<span>hi.size: <b data-testid="locked-highlighted-size">{lockedHighlighted.size}</b></span>
		</div>
		<div class="tree-box">
			<Tree
				treeId="locked"
				data={lockedData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
				dragDropMode="self"
				getIsDraggableCallback={(node) => node.data?.draggable !== false}
				getIsDropAllowedCallback={() => true}
				clickBehavior="select"
				selectionMode="multi"
				highlightedNodeClass="stv__node-content--highlight-bold"
				bind:focusedNode={lockedFocused}
				bind:highlightedPaths={lockedHighlighted}
				onNodeDrop={onLockedDrop}
			>
				{#snippet nodeTemplate(node: LTreeNode<LockableItem>)}
					<span data-testid="locked-node-{node.path}">{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
	</section>

	<section data-testid="section-touch">
		<h2>Touch Drag</h2>
		<div class="drop-state">
			<span>count: <b data-testid="touch-drop-count">{touchDrop.count}</b></span>
			<span>dragged: <b data-testid="touch-drop-dragged">{touchDrop.dragged}</b></span>
			<span>target: <b data-testid="touch-drop-target">{touchDrop.target}</b></span>
			<span>pos: <b data-testid="touch-drop-position">{touchDrop.position}</b></span>
		</div>
		<div class="tree-box">
			<Tree
				treeId="touch"
				data={touchData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
				dragDropMode="self"
				getIsDraggableCallback={() => true}
				getIsDropAllowedCallback={() => true}
				onNodeDrop={onTouchDrop}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span data-testid="touch-node-{node.path}">{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
	</section>

	<section data-testid="section-before-drag">
		<h2>beforeDragStartCallback (prune / augment / veto)</h2>
		<button data-testid="bd-reset" onclick={resetBd}>Reset</button>
		<div class="drop-state">
			<span>drop.count: <b data-testid="bd-drop-count">{bdDrop.count}</b></span>
			<span>drop.dragged: <b data-testid="bd-drop-dragged">{bdDrop.dragged}</b></span>
			<span>start.count: <b data-testid="bd-start-count">{bdStartCount}</b></span>
			<span>last.set: <b data-testid="bd-last-set">{bdLastSet}</b></span>
			<span>hi.size: <b data-testid="bd-highlighted-size">{bdHighlighted.size}</b></span>
		</div>
		<div class="tree-box">
			<Tree
				treeId="before-drag"
				data={bdData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
				dragDropMode="self"
				getIsDraggableCallback={() => true}
				getIsDropAllowedCallback={() => true}
				clickBehavior="select"
				selectionMode="multi"
				highlightedNodeClass="stv__node-content--highlight-bold"
				bind:focusedNode={bdFocused}
				bind:highlightedPaths={bdHighlighted}
				beforeDragStartCallback={beforeBdDragStart}
				onNodeDragStart={onBdDragStart}
				onNodeDrop={onBdDrop}
			>
				{#snippet nodeTemplate(node: LTreeNode<BdItem>)}
					<span data-testid="bd-node-{node.path}">{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
	</section>

	<section data-testid="section-tree-zone">
		<h2>Tree-level drop zone + content-addressed routing</h2>
		<button data-testid="produce-reset" onclick={resetProduce}>Reset</button>
		<div class="drop-state">
			<span>drop.count: <b data-testid="produce-drop-count">{produceDrop.count}</b></span>
			<span>routed: <b data-testid="produce-routed">{produceRouted}</b></span>
			<span>hi.size: <b data-testid="produce-highlighted-size">{produceHighlighted.size}</b></span>
		</div>
		<div class="tree-box">
			<Tree
				treeId="produce"
				data={produceData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
				dragDropMode="self"
				shouldEnableTreeDropZone={true}
				getIsDraggableCallback={(node) => node.data?.kind !== 'category'}
				getIsDropAllowedCallback={() => false}
				clickBehavior="select"
				selectionMode="multi"
				highlightedNodeClass="stv__node-content--highlight-bold"
				bind:focusedNode={produceFocused}
				bind:highlightedPaths={produceHighlighted}
				beforeDropCallback={beforeProduceDrop}
				onNodeDrop={onProduceDrop}
			>
				{#snippet nodeTemplate(node: LTreeNode<ProduceItem>)}
					<span data-testid="produce-node-{node.path}">{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
	</section>

	<section data-testid="section-move-nodes">
		<h2>moveNodes (batch move + hole leave-behind)</h2>
		<button data-testid="mn-reset" onclick={mnReset}>Reset</button>
		<button data-testid="mn-move-whole" onclick={mnMoveWhole}>Move whole</button>
		<button data-testid="mn-move-hole" onclick={mnMoveHole}>Move with hole</button>
		<div class="drop-state">
			<span>result: <b data-testid="mn-result">{mnResult}</b></span>
			<span>folder.parent: <b data-testid="mn-folder-parent">{mnFolderParent}</b></span>
			<span>folder.children: <b data-testid="mn-folder-children">{mnFolderChildren}</b></span>
			<span>locked.parent: <b data-testid="mn-locked-parent">{mnLockedParent}</b></span>
		</div>
		<div class="tree-box">
			<Tree
				bind:this={mnTreeRef}
				treeId="move-nodes"
				data={mnData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
				dragDropMode="self"
				getIsDraggableCallback={() => true}
				getIsDropAllowedCallback={() => true}
			>
				{#snippet nodeTemplate(node: LTreeNode<MNItem>)}
					<span data-testid="mn-node-{node.path}">{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
	</section>

	<section data-testid="section-drag-hole">
		<h2>Drag leaves a locked descendant behind (beforeDragStart → moveNodes hole)</h2>
		<button data-testid="dh-reset" onclick={resetDh}>Reset</button>
		<div class="drop-state">
			<span>drop.count: <b data-testid="dh-drop-count">{dhDropCount}</b></span>
			<span>dragged.size: <b data-testid="dh-dragged-size">{dhDraggedSize}</b></span>
			<span>folder.children: <b data-testid="dh-folder-children">{dhFolderChildren}</b></span>
			<span>lock.parent: <b data-testid="dh-lock-parent">{dhLockParent}</b></span>
		</div>
		<div class="tree-box">
			<Tree
				bind:this={dhTreeRef}
				treeId="drag-hole"
				data={dhData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
				dragDropMode="self"
				getIsDraggableCallback={() => true}
				getIsDropAllowedCallback={() => true}
				clickBehavior="select"
				selectionMode="multi"
				beforeDragStartCallback={beforeDhDragStart}
				onNodeDrop={onDhDrop}
			>
				{#snippet nodeTemplate(node: LTreeNode<DhItem>)}
					<span data-testid="dh-node-{node.path}">{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
	</section>

	<section data-testid="section-copy-skip">
		<h2>copyNodeWithDescendants null-skip (leave a descendant behind on copy)</h2>
		<button data-testid="cs-copy" onclick={csCopySkipLocked}>Copy skip locked</button>
		<button data-testid="cs-reset" onclick={resetCs}>Reset</button>
		<div class="drop-state">
			<span>result: <b data-testid="cs-result">{csResult}</b></span>
			<span>dest.copy.children: <b data-testid="cs-dest-children">{csDestChildren}</b></span>
		</div>
		<div class="tree-box">
			<Tree
				bind:this={csTreeRef}
				treeId="copy-skip"
				data={csData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
			>
				{#snippet nodeTemplate(node: LTreeNode<CsItem>)}
					<span data-testid="cs-node-{node.path}">{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
	</section>

	<section data-testid="section-duplicate-nodes">
		<h2>duplicateNodes (batch copy primitive, manifest holes)</h2>
		<button data-testid="dn-copy-hole" onclick={dnCopyWithHole}>Copy w/ hole</button>
		<button data-testid="dn-copy-two" onclick={dnCopyTwoRoots}>Copy two roots</button>
		<button data-testid="dn-reset" onclick={resetDnSection}>Reset</button>
		<div class="drop-state">
			<span>result: <b data-testid="dn-result">{dnResult}</b></span>
			<span>dest.children: <b data-testid="dn-dest-children">{dnDestChildren}</b></span>
			<span>src.children: <b data-testid="dn-src-children">{dnSrcChildren}</b></span>
		</div>
		<div class="tree-box">
			<Tree
				bind:this={dnTreeRef}
				treeId="duplicate-nodes"
				data={dnData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
			>
				{#snippet nodeTemplate(node: LTreeNode<DnItem>)}
					<span data-testid="dn-node-{node.path}">{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
	</section>

	<section data-testid="section-xtree-copy">
		<h2>cross-tree AUTO-copy (library places, no consumer loop)</h2>
		<button data-testid="xc-reset" onclick={resetXc}>Reset</button>
		<div class="drop-state">
			<span>dropped: <b data-testid="xc-dropped">{xcDropped}</b></span>
			<span>dest.copy.children: <b data-testid="xc-dest-children">{xcDestChildren}</b></span>
			<span>src.children: <b data-testid="xc-src-children">{xcSrcChildren}</b></span>
		</div>
		<div class="two-trees">
			<div class="tree-box" data-testid="xc-src-box">
				<Tree
					bind:this={xcSrcRef}
					treeId="xtree-copy-src"
					data={xcSrcData}
					idMember="id"
					pathMember="path"
					orderMember="sortOrder"
					sortCallback={sortByOrder}
					isSorted={true}
					expandLevel={10}
					dragDropMode="both"
					getIsDraggableCallback={() => true}
					getIsDropAllowedCallback={() => true}
					beforeDragStartCallback={xcPrune}
				>
					{#snippet nodeTemplate(node: LTreeNode<XcItem>)}
						<span data-testid="xc-src-node-{node.path}">{node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
			<div class="tree-box" data-testid="xc-dest-box">
				<Tree
					bind:this={xcDestRef}
					treeId="xtree-copy-dest"
					data={xcDestData}
					idMember="id"
					pathMember="path"
					orderMember="sortOrder"
					sortCallback={sortByOrder}
					isSorted={true}
					expandLevel={10}
					dragDropMode="both"
					getIsDraggableCallback={() => true}
					getIsDropAllowedCallback={() => true}
					beforeDropCallback={xcForceCopy}
					nodeInputTransformationCallback={xcMint}
					onNodeDrop={onXcDrop}
				>
					{#snippet nodeTemplate(node: LTreeNode<XcItem>)}
						<span data-testid="xc-dest-node-{node.path}">{node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
		</div>
	</section>
</main>

<style>
	main {
		padding: 1rem;
		font-family: sans-serif;
	}
	h1 {
		margin: 0 0 1rem;
	}
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.05rem;
	}
	h3 {
		margin: 0 0 0.5rem;
		font-size: 0.9rem;
		color: #555;
	}
	section {
		border: 1px solid #ccc;
		padding: 0.75rem;
		margin-bottom: 0.75rem;
		border-radius: 4px;
	}
	.drop-state {
		font-size: 0.8rem;
		margin-bottom: 0.5rem;
	}
	.drop-state span {
		display: inline-block;
		margin-right: 0.75rem;
		padding: 0.1rem 0.35rem;
		background: #f1f5f9;
		border-radius: 3px;
	}
	.drop-state b {
		font-family: monospace;
		color: #1e293b;
	}
	.hint {
		font-size: 0.8rem;
		color: #64748b;
		margin: 0 0 0.5rem;
	}
	.tree-box {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		min-height: 80px;
		max-width: 480px;
	}
	.two-trees {
		display: flex;
		gap: 1rem;
	}
	.two-trees .tree-box {
		flex: 1;
	}
</style>
