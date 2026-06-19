<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode, DropOperation, DropPosition } from '$lib/ltree/types.js';

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

	function onSingleDrop(
		dropNode: LTreeNode<Item> | null,
		draggedNode: LTreeNode<Item>,
		position: string,
		_event: DragEvent | TouchEvent,
		operation: DropOperation
	) {
		singleDrop = {
			count: singleDrop.count + 1,
			dragged: draggedNode.data?.name ?? '',
			target: dropNode?.data?.name ?? '(root)',
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

	function onSourceDrop(
		dropNode: LTreeNode<Item> | null,
		draggedNode: LTreeNode<Item>,
		position: string,
		_event: DragEvent | TouchEvent,
		operation: DropOperation
	) {
		twoTreesDrop = {
			count: twoTreesDrop.count + 1,
			dragged: draggedNode.data?.name ?? '',
			target: dropNode?.data?.name ?? '(root)',
			position,
			operation,
			tree: 'source'
		};
	}

	function onTargetDrop(
		dropNode: LTreeNode<Item> | null,
		draggedNode: LTreeNode<Item>,
		position: string,
		_event: DragEvent | TouchEvent,
		operation: DropOperation
	) {
		twoTreesDrop = {
			count: twoTreesDrop.count + 1,
			dragged: draggedNode.data?.name ?? '',
			target: dropNode?.data?.name ?? '(root)',
			position,
			operation,
			tree: 'target'
		};

		const isSameTree = draggedNode.treeId === 'two-trees-target';
		if (isSameTree) return;

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

	function onRestrictedMemberDrop(
		dropNode: LTreeNode<RestrictedItem> | null,
		draggedNode: LTreeNode<RestrictedItem>,
		position: string,
		_event: DragEvent | TouchEvent,
		operation: DropOperation
	) {
		restrictedMemberDrop = {
			count: restrictedMemberDrop.count + 1,
			dragged: draggedNode.data?.name ?? '',
			target: dropNode?.data?.name ?? '(root)',
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

	function onRestrictedCallbackDrop(
		dropNode: LTreeNode<Item> | null,
		draggedNode: LTreeNode<Item>,
		position: string,
		_event: DragEvent | TouchEvent,
		operation: DropOperation
	) {
		restrictedCallbackDrop = {
			count: restrictedCallbackDrop.count + 1,
			dragged: draggedNode.data?.name ?? '',
			target: dropNode?.data?.name ?? '(root)',
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

	function onCopyDrop(
		dropNode: LTreeNode<Item> | null,
		draggedNode: LTreeNode<Item>,
		position: string,
		_event: DragEvent | TouchEvent,
		operation: DropOperation
	) {
		copyDrop = {
			count: copyDrop.count + 1,
			dragged: draggedNode.data?.name ?? '',
			target: dropNode?.data?.name ?? '(root)',
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

	function onMultiDrop(
		dropNode: LTreeNode<Item> | null,
		draggedNode: LTreeNode<Item>,
		position: string,
		_event: DragEvent | TouchEvent,
		operation: DropOperation
	) {
		multiDrop = {
			count: multiDrop.count + 1,
			dragged: draggedNode.data?.name ?? '',
			target: dropNode?.data?.name ?? '(root)',
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

	// ── Section 7: touch drag ──────────────────────────────────────────────

	let touchData: Item[] = $state([
		{ id: 51, path: '1', name: 'TouchA', sortOrder: 10 },
		{ id: 52, path: '2', name: 'TouchB', sortOrder: 20 },
		{ id: 53, path: '3', name: 'TouchC', sortOrder: 30 }
	]);

	let touchDrop: DropState = $state(emptyDropState());

	function onTouchDrop(
		dropNode: LTreeNode<Item> | null,
		draggedNode: LTreeNode<Item>,
		position: string,
		_event: DragEvent | TouchEvent,
		operation: DropOperation
	) {
		touchDrop = {
			count: touchDrop.count + 1,
			dragged: draggedNode.data?.name ?? '',
			target: dropNode?.data?.name ?? '(root)',
			position,
			operation,
			tree: 'touch'
		};
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
			<span>target: <b data-testid="r-callback-drop-target">{restrictedCallbackDrop.target}</b></span>
			<span>pos: <b data-testid="r-callback-drop-position">{restrictedCallbackDrop.position}</b></span>
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
					<span data-testid="r-callback-node-{node.path}"
						>{node.data?.name} (#{node.data?.id})</span
					>
				{/snippet}
			</Tree>
		</div>
	</section>

	<section data-testid="section-copy">
		<h2>Ctrl-Drag Copy (allowCopy=true)</h2>
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
				allowCopy={true}
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
