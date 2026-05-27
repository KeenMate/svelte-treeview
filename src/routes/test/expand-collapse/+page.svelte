<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';

	// Deterministic fixture for the array + exclusive variants of
	// expandNodes / collapseNodes / expandAll / collapseAll.
	// Targeted by e2e/expand-collapse.spec.ts.

	type Item = { id: number; path: string; name: string };

	const sampleData: Item[] = [
		{ id: 1, path: '1', name: 'A' },
		{ id: 11, path: '1.1', name: 'A.1' },
		{ id: 111, path: '1.1.1', name: 'A.1.a' },
		{ id: 112, path: '1.1.2', name: 'A.1.b' },
		{ id: 12, path: '1.2', name: 'A.2' },
		{ id: 121, path: '1.2.1', name: 'A.2.a' },
		{ id: 122, path: '1.2.2', name: 'A.2.b' },
		{ id: 13, path: '1.3', name: 'A.3' },
		{ id: 131, path: '1.3.1', name: 'A.3.a' },
		{ id: 2, path: '2', name: 'B' },
		{ id: 21, path: '2.1', name: 'B.1' },
		{ id: 211, path: '2.1.1', name: 'B.1.a' },
		{ id: 22, path: '2.2', name: 'B.2' },
		{ id: 3, path: '3', name: 'C' },
		{ id: 31, path: '3.1', name: 'C.1' },
		{ id: 311, path: '3.1.1', name: 'C.1.a' },
		{ id: 32, path: '3.2', name: 'C.2' }
	];

	function sortByPath(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => a.path.localeCompare(b.path));
	}

	let treeRef: Tree<Item>;
</script>

<svelte:head>
	<title>Test — Expand/Collapse Fixture</title>
</svelte:head>

<main>
	<h1>Expand / Collapse Test Fixture</h1>

	<div class="controls">
		<button data-testid="collapse-all" onclick={() => treeRef?.collapseAll()}>collapseAll()</button>
		<button data-testid="expand-all" onclick={() => treeRef?.expandAll()}>expandAll()</button>

		<button data-testid="expand-nodes-single" onclick={() => treeRef?.expandNodes('1.1.1')}>
			expandNodes('1.1.1')
		</button>
		<button data-testid="expand-nodes-array" onclick={() => treeRef?.expandNodes(['1.1.1', '2.1.1'])}>
			expandNodes(['1.1.1','2.1.1'])
		</button>
		<button
			data-testid="expand-nodes-exclusive"
			onclick={() => treeRef?.expandNodes('1.1.1', { exclusive: true })}
		>
			expandNodes('1.1.1', exclusive)
		</button>
		<button
			data-testid="expand-nodes-array-exclusive"
			onclick={() => treeRef?.expandNodes(['1.1.1', '3.1.1'], { exclusive: true })}
		>
			expandNodes(['1.1.1','3.1.1'], exclusive)
		</button>

		<button data-testid="collapse-nodes-single" onclick={() => treeRef?.collapseNodes('1.1')}>
			collapseNodes('1.1')
		</button>
		<button
			data-testid="collapse-nodes-array"
			onclick={() => treeRef?.collapseNodes(['1.1', '2.1'])}
		>
			collapseNodes(['1.1','2.1'])
		</button>

		<button data-testid="expand-all-subtree" onclick={() => treeRef?.expandAll('2')}>
			expandAll('2')
		</button>
		<button data-testid="expand-all-array" onclick={() => treeRef?.expandAll(['1', '3'])}>
			expandAll(['1','3'])
		</button>
		<button
			data-testid="expand-all-exclusive"
			onclick={() => treeRef?.expandAll('1.1', { exclusive: true })}
		>
			expandAll('1.1', exclusive)
		</button>

		<button data-testid="collapse-all-subtree" onclick={() => treeRef?.collapseAll('1')}>
			collapseAll('1')
		</button>
		<button data-testid="collapse-all-array" onclick={() => treeRef?.collapseAll(['1', '2'])}>
			collapseAll(['1','2'])
		</button>
	</div>

	<div class="tree-container">
		<Tree
			bind:this={treeRef}
			data={sampleData}
			idMember="id"
			pathMember="path"
			sortCallback={sortByPath}
			isSorted={true}
			expandLevel={0}
		>
			{#snippet nodeTemplate(node: LTreeNode<Item>)}
				<span data-testid="node-name-{node.path}">{node.data?.name}</span>
			{/snippet}
		</Tree>
	</div>
</main>

<style>
	main {
		padding: 1rem;
		font-family: sans-serif;
	}
	h1 {
		margin: 0 0 1rem;
		font-size: 1.2rem;
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}
	.tree-container {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		max-width: 520px;
	}
</style>
