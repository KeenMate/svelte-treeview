<script lang="ts">
	import { Card } from '@keenmate/svelte-adminlte';
	import TreeView from '$lib/TreeView.svelte';
	import { selectionModes } from '$lib/types.js';

	const MAX_NEW_CHILDREN = 7;
	const initalTree = [{ nodePath: '0', name: 'Root', hasChildren: true, __useCallback: true }];

	let tree = initalTree;
	let showObject = false;

	async function callback(node: any) {
		const newChildrenCount = Math.floor(Math.random() * (MAX_NEW_CHILDREN - 1)) + 1;

		const newNodes = [];
		for (let i = 0; i < newChildrenCount; i++) {
			newNodes.push({
				nodePath: `${node.nodePath},${i}`,
				name: `Child ${i}`,
				hasChildren: true,
				__useCallback: true
			});
		}

		return newNodes;
	}
</script>

<div class="row mt-3">
	<div class="col-lg-8 col-12">
		<Card>
			<TreeView
				bind:tree
				treeId="tree"
				expandCallback={callback}
				let:node
				logger={(...data) => console.debug('treeview: ', ...data)}
				separator=","
				selectionMode={selectionModes.all}
			>
				{#if showObject}
					{JSON.stringify(node)}
				{:else}
					{node.name}
				{/if}
			</TreeView>
		</Card>
	</div>
	<div class="col-lg-4 col-12">
		<Card>
			Demo of callback usage
			<br />

			<label for="showObjects">Show node objects</label>
			<input id="showObjects" type="checkbox" bind:checked={showObject} />

			<br />
		</Card>
	</div>
</div>
