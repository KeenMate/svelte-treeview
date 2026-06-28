<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';

	// Test fixture for the data-driven per-node class hooks nodeClass / nodeContentClass
	// (added v5.0.0-rc13). Targeted by e2e/node-class.spec.ts. Each callback returns a
	// class string derived from node data; the library applies nodeClass to .stv__node
	// and nodeContentClass to .stv__node-content.

	type Item = { id: number; path: string; name: string; kind: 'folder' | 'file' };

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name ?? '').localeCompare(b.data?.name ?? ''));
	}

	const data: Item[] = [
		{ id: 1, path: '1', name: 'Root', kind: 'folder' },
		{ id: 2, path: '1.1', name: 'Folder-A', kind: 'folder' },
		{ id: 3, path: '1.2', name: 'File-A', kind: 'file' },
		{ id: 4, path: '1.3', name: 'File-B', kind: 'file' }
	];

	const nodeClass = (n: LTreeNode<Item>) => `kind-${n.data?.kind ?? 'unknown'}`;
	const nodeContentClass = (n: LTreeNode<Item>) => (n.data?.kind === 'file' ? 'is-file-content' : '');
</script>

<h1>nodeClass / nodeContentClass test</h1>

<Tree
	{data}
	idMember="id"
	pathMember="path"
	sortCallback={sortByName}
	isSorted={true}
	expandLevel={2}
	{nodeClass}
	{nodeContentClass}
/>

<style>
	/* Prove the classes actually land + are stylable from app CSS. */
	:global(.stv__node.kind-file) { outline: 2px solid tomato; }
	:global(.stv__node.kind-folder) { outline: 2px solid royalblue; }
	:global(.stv__node-content.is-file-content) { font-style: italic; }
</style>
