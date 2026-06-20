<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';

	// Test fixture for isSelectableMember + isSelectedMember props.
	// Targeted by e2e/member-props.spec.ts — keep paths and field semantics
	// stable. Moved from /dev/member-props as part of the /test/ migration.

	type Item = {
		id: number;
		path: string;
		name: string;
		selectable: boolean;
		selected: boolean;
	};

	const data: Item[] = [
		{ id: 1, path: '1', name: 'Documents', selectable: true, selected: false },
		{ id: 2, path: '1.1', name: 'Work', selectable: true, selected: true },
		{ id: 3, path: '1.2', name: 'Locked', selectable: false, selected: false },
		// 1.3 / Pinned: not selectable, but "selected" — selectable gates rendering,
		// so checkbox is still hidden. Path should still appear in selectedPaths
		// (the seed walk reads node.isSelected regardless of isSelectable).
		{ id: 4, path: '1.3', name: 'Pinned', selectable: false, selected: true },
		{ id: 5, path: '2', name: 'Music', selectable: true, selected: true },
		{ id: 6, path: '2.1', name: 'Playlists', selectable: true, selected: false }
	];

	function sortByPath(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => a.path.localeCompare(b.path));
	}

	let selectedPaths: Set<string> = $state(new Set());
</script>

<svelte:head>
	<title>Test — Member Props Fixture</title>
</svelte:head>

<main style="padding: 1rem; font-family: sans-serif;">
	<h1>Member Props Fixture</h1>

	<section id="paths-display">
		<p>
			<strong>selectedPaths.size</strong>:
			<span data-testid="selected-paths-count">{selectedPaths.size}</span>
		</p>
		<p>
			<strong>selectedPaths</strong>:
			<span data-testid="selected-paths-list">{[...selectedPaths].sort().join(',')}</span>
		</p>
	</section>

	<div style="border: 1px solid #ccc; padding: 0.5rem; max-width: 480px;">
		<Tree
			{data}
			idMember="id"
			pathMember="path"
			isSelectableMember="selectable"
			isSelectedMember="selected"
			sortCallback={sortByPath}
			shouldShowCheckboxes={true}
			expandLevel={10}
			bind:selectedPaths
		>
			{#snippet nodeTemplate(node: LTreeNode<Item>)}
				<span data-testid="node-name-{node.path}">{node.data?.name}</span>
			{/snippet}
		</Tree>
	</div>
</main>
