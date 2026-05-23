<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';

	// Deterministic e2e fixture for keyboard navigation. Targeted by
	// e2e/keyboard-nav.spec.ts.
	//
	// Seed produces exactly 18 visible nodes at level 1–3 when expandLevel=10:
	//
	//   idx | path  | name     | level
	//   ----+-------+----------+------
	//     0 | 1     | Root-A   |   1
	//     1 | 1.1   | A-1      |   2
	//     2 | 1.1.1 | A-1-x    |   3
	//     3 | 1.1.2 | A-1-y    |   3
	//     4 | 1.2   | A-2      |   2
	//     5 | 1.2.1 | A-2-x    |   3
	//     6 | 1.2.2 | A-2-y    |   3
	//     7 | 1.3   | A-3      |   2  (leaf)
	//     8 | 2     | Root-B   |   1
	//     9 | 2.1   | B-1      |   2
	//    10 | 2.1.1 | B-1-x    |   3
	//    11 | 2.1.2 | B-1-y    |   3
	//    12 | 2.2   | B-2      |   2  (leaf)
	//    13 | 3     | Root-C   |   1
	//    14 | 3.1   | C-1      |   2  (leaf)
	//    15 | 3.2   | C-2      |   2  (leaf)
	//    16 | 4     | Root-D   |   1  (leaf)
	//    17 | 5     | Root-E   |   1  (leaf)
	//
	// PageDown=10 from index 0 lands on '2.1.1' (B-1-x); from '2.1.1' it
	// clamps to '5'. PageUp=10 from '5' lands on '1.3' (A-3).

	type Item = { id: number; path: string; name: string; sortOrder: number };

	function initialData(): Item[] {
		return [
			{ id: 1, path: '1', name: 'Root-A', sortOrder: 10 },
			{ id: 2, path: '1.1', name: 'A-1', sortOrder: 10 },
			{ id: 3, path: '1.1.1', name: 'A-1-x', sortOrder: 10 },
			{ id: 4, path: '1.1.2', name: 'A-1-y', sortOrder: 20 },
			{ id: 5, path: '1.2', name: 'A-2', sortOrder: 20 },
			{ id: 6, path: '1.2.1', name: 'A-2-x', sortOrder: 10 },
			{ id: 7, path: '1.2.2', name: 'A-2-y', sortOrder: 20 },
			{ id: 8, path: '1.3', name: 'A-3', sortOrder: 30 },
			{ id: 9, path: '2', name: 'Root-B', sortOrder: 20 },
			{ id: 10, path: '2.1', name: 'B-1', sortOrder: 10 },
			{ id: 11, path: '2.1.1', name: 'B-1-x', sortOrder: 10 },
			{ id: 12, path: '2.1.2', name: 'B-1-y', sortOrder: 20 },
			{ id: 13, path: '2.2', name: 'B-2', sortOrder: 20 },
			{ id: 14, path: '3', name: 'Root-C', sortOrder: 30 },
			{ id: 15, path: '3.1', name: 'C-1', sortOrder: 10 },
			{ id: 16, path: '3.2', name: 'C-2', sortOrder: 20 },
			{ id: 17, path: '4', name: 'Root-D', sortOrder: 40 },
			{ id: 18, path: '5', name: 'Root-E', sortOrder: 50 }
		];
	}

	let treeData = $state<Item[]>(initialData());
	let treeRef: Tree<Item>;

	function sortByOrder(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => {
			if (a.parentPath !== b.parentPath) {
				return (a.parentPath || '').localeCompare(b.parentPath || '');
			}
			return (a.data?.sortOrder ?? 0) - (b.data?.sortOrder ?? 0);
		});
	}

	let focusedNode = $state<LTreeNode<Item> | null | undefined>(null);
	let highlightedPaths = $state<Set<string>>(new Set());

	const highlightedSorted = $derived(
		[...highlightedPaths].sort((a, b) => a.localeCompare(b)).join(',')
	);

	function resetTree() {
		treeData = initialData();
		focusedNode = null;
		highlightedPaths = new Set();
		treeRef.expandAll();
	}
</script>

<svelte:head>
	<title>Test — Keyboard Navigation Fixture</title>
</svelte:head>

<main>
	<h1>Keyboard Navigation Test Fixture</h1>

	<section data-testid="section-state">
		<div class="state-row">
			<span>focused.path: <b data-testid="focused-path">{focusedNode?.path ?? ''}</b></span>
			<span>focused.name: <b data-testid="focused-name">{focusedNode?.data?.name ?? ''}</b></span>
		</div>
		<div class="state-row">
			<span>highlighted.size: <b data-testid="highlighted-size">{highlightedPaths.size}</b></span>
			<span>highlighted.sorted: <b data-testid="highlighted-sorted">{highlightedSorted}</b></span>
		</div>
		<div class="state-row">
			<button data-testid="btn-reset" onclick={resetTree}>Reset</button>
		</div>
	</section>

	<section data-testid="section-tree">
		<div class="tree-box">
			<Tree
				bind:this={treeRef}
				treeId="keyboard-nav"
				data={treeData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
				clickBehavior="select"
				bind:focusedNode
				bind:highlightedPaths
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span data-testid="node-{node.path}">{node.data?.name}</span>
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
	section {
		border: 1px solid #ccc;
		padding: 0.75rem;
		margin-bottom: 0.75rem;
		border-radius: 4px;
	}
	.state-row {
		font-size: 0.85rem;
		margin-bottom: 0.4rem;
	}
	.state-row span {
		display: inline-block;
		margin-right: 0.75rem;
		padding: 0.1rem 0.35rem;
		background: #f1f5f9;
		border-radius: 3px;
	}
	.state-row b {
		font-family: monospace;
		color: #1e293b;
	}
	.state-row button {
		padding: 0.25rem 0.6rem;
		border: 1px solid #cbd5e1;
		background: white;
		border-radius: 3px;
		cursor: pointer;
		font-size: 0.8rem;
	}
	.tree-box {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		max-width: 480px;
	}
</style>
