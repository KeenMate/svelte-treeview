<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode, DropPosition } from '$lib/ltree/types.js';
	import type { NodeDropContext } from '$lib/core/TreeController.svelte.js';

	// Test fixture for the get*Callback props. Targeted by e2e/callbacks.spec.ts.
	// Covers the bug class where seed-time callbacks reading node.data?.X
	// returned wrong values because node.data was assigned AFTER the callbacks
	// fired (fixed in v5.0.0-rc13). Also covers per-node drag/drop opt-outs via
	// callbacks (gap: the member form has e2e in /test/drag-drop, the callback
	// form had none).

	type Item = {
		id: number;
		path: string;
		name: string;
		sortOrder: number;
		isDraggable?: boolean;
		isDropAllowed?: boolean;
		allowedDropPositions?: DropPosition[];
	};

	function sortByOrder(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => {
			if (a.parentPath !== b.parentPath) {
				return (a.parentPath || '').localeCompare(b.parentPath || '');
			}
			return (a.data?.sortOrder ?? 0) - (b.data?.sortOrder ?? 0);
		});
	}

	// Two-folder layout. Folder-A has draggable behavior variants; Folder-B
	// has drop-permission variants. Names are stable for e2e assertions.
	// Names + paths are stable assertion targets.
	//  1     Folder-A
	//  1.1   File-Normal           — defaults (draggable, drop-allowed)
	//  1.2   File-Pinned           — getIsDraggableCallback → false
	//  2     Folder-B
	//  2.1   ChildOnlyTarget       — getAllowedDropPositionsCallback → ['child']
	//  2.2   BeforeAfterTarget     — getAllowedDropPositionsCallback → ['before','after']
	//  2.3   NoDropTarget          — getIsDropAllowedCallback → false (rejects all drops)
	const data: Item[] = [
		{ id: 1, path: '1', name: 'Folder-A', sortOrder: 10 },
		{ id: 2, path: '1.1', name: 'File-Normal', sortOrder: 10 },
		{ id: 3, path: '1.2', name: 'File-Pinned', sortOrder: 20, isDraggable: false },
		{ id: 4, path: '2', name: 'Folder-B', sortOrder: 20 },
		{ id: 5, path: '2.1', name: 'ChildOnlyTarget', sortOrder: 10, allowedDropPositions: ['child'] },
		{ id: 6, path: '2.2', name: 'BeforeAfterTarget', sortOrder: 20, allowedDropPositions: ['before', 'after'] },
		{ id: 7, path: '2.3', name: 'NoDropTarget', sortOrder: 30, isDropAllowed: false }
	];

	// Callbacks read node.data — the exact shape that broke in rc10-rc12.
	const getIsDraggableCallback = (n: LTreeNode<Item>) => n.data?.isDraggable !== false;
	const getIsDropAllowedCallback = (n: LTreeNode<Item>) => n.data?.isDropAllowed !== false;
	const getAllowedDropPositionsCallback = (n: LTreeNode<Item>): DropPosition[] | null =>
		n.data?.allowedDropPositions ?? null;

	type DropState = {
		count: number;
		dragged: string;
		target: string;
		position: string;
		operation: string;
	};

	let drop: DropState = $state({ count: 0, dragged: '', target: '', position: '', operation: '' });

	function onNodeDrop({ source, target, position, operation }: NodeDropContext<Item>) {
		drop = {
			count: drop.count + 1,
			dragged: source.node?.data?.name ?? '',
			target: target?.node?.data?.name ?? '(root)',
			position,
			operation
		};
	}

	function resetDrop() {
		drop = { count: 0, dragged: '', target: '', position: '', operation: '' };
	}
</script>

<svelte:head>
	<title>Test — Callbacks Fixture</title>
</svelte:head>

<main style="padding: 1rem; font-family: sans-serif;">
	<h1>Callbacks Fixture</h1>
	<p>
		Exercises <code>getIsDraggableCallback</code> +
		<code>getAllowedDropPositionsCallback</code> reading from <code>node.data</code>.
	</p>

	<section id="drop-display" style="margin-bottom: 0.75rem;">
		<button type="button" data-testid="reset-drop" onclick={resetDrop}>Reset drop log</button>
		<table style="margin-top: 0.5rem; border-collapse: collapse;">
			<tbody>
				<tr><td>count</td><td data-testid="drop-count">{drop.count}</td></tr>
				<tr><td>dragged</td><td data-testid="drop-dragged">{drop.dragged}</td></tr>
				<tr><td>target</td><td data-testid="drop-target">{drop.target}</td></tr>
				<tr><td>position</td><td data-testid="drop-position">{drop.position}</td></tr>
				<tr><td>operation</td><td data-testid="drop-operation">{drop.operation}</td></tr>
			</tbody>
		</table>
	</section>

	<div
		data-testid="tree-container"
		style="border: 1px solid #ccc; padding: 0.5rem; max-width: 480px;"
	>
		<Tree
			{data}
			idMember="id"
			pathMember="path"
			sortCallback={sortByOrder}
			expandLevel={10}
			dragDropMode="self"
			dropZoneMode="glow"
			{getIsDraggableCallback}
			{getIsDropAllowedCallback}
			{getAllowedDropPositionsCallback}
			{onNodeDrop}
		>
			{#snippet nodeTemplate(node: LTreeNode<Item>)}
				<span data-testid="node-name-{node.path}">{node.data?.name}</span>
			{/snippet}
		</Tree>
	</div>
</main>
