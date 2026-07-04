<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';
	import type { NodeRef } from '$lib/index.js';

	// Test fixture for the onNodeDoubleClick event (added v5.0.0-rc13). Targeted by
	// e2e/double-click.spec.ts. Two trees side by side so we can assert the event
	// fires across clickBehaviors:
	//   #select  → clickBehavior="select" (single=select, double=expand + event)
	//   #expand  → clickBehavior="expand-and-focus" (default; double still fires event)
	// We can't use the browser's native dblclick in flat mode (focus bumps _rev →
	// row is recreated), so detection is manual on the controller — this page proves
	// it works end-to-end.

	type Item = { id: number; path: string; name: string };

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name ?? '').localeCompare(b.data?.name ?? ''));
	}

	const data: Item[] = [
		{ id: 1, path: '1', name: 'Root' },
		{ id: 2, path: '1.1', name: 'Alpha' },
		{ id: 3, path: '1.2', name: 'Beta' },
		{ id: 4, path: '1.2.1', name: 'Beta-Child' }
	];

	let clickLog = $state<string[]>([]);
	let dblLog = $state<string[]>([]);

	const onNodeClick = ({ node, path }: NodeRef<Item>) => { clickLog = [...clickLog, node?.data?.name ?? path]; };
	const onNodeDoubleClick = ({ node, path }: NodeRef<Item>) => { dblLog = [...dblLog, node?.data?.name ?? path]; };

	function reset() { clickLog = []; dblLog = []; }
</script>

<h1>Double-click event test</h1>

<button data-testid="reset" onclick={reset}>Reset</button>

<div style="display: flex; gap: 32px; margin-top: 16px;">
	<section data-testid="select">
		<h2>clickBehavior="select"</h2>
		<Tree
			{data}
			idMember="id"
			pathMember="path"
			sortCallback={sortByName}
			isSorted={true}
			expandLevel={1}
			clickBehavior="select"
			{onNodeClick}
			{onNodeDoubleClick}
		/>
	</section>

	<section data-testid="expand">
		<h2>clickBehavior="expand-and-focus" (default)</h2>
		<Tree
			{data}
			idMember="id"
			pathMember="path"
			sortCallback={sortByName}
			isSorted={true}
			expandLevel={1}
			{onNodeClick}
			{onNodeDoubleClick}
		/>
	</section>
</div>

<div style="margin-top: 16px;">
	<div>onNodeClick: <span data-testid="click-count">{clickLog.length}</span> — <span data-testid="click-log">{clickLog.join(',')}</span></div>
	<div>onNodeDoubleClick: <span data-testid="dbl-count">{dblLog.length}</span> — <span data-testid="dbl-log">{dblLog.join(',')}</span></div>
</div>
