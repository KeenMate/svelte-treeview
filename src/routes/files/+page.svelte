<script lang="ts">
	import { onMount } from 'svelte';
	import { MenuDivider, MenuOption, TreeView } from '../../lib/index.js';
	import Files from '../../data/files.js';
	import { Card } from '@keenmate/svelte-adminlte';
	import { SelectionModes } from '$lib/types.js';

	type file = { path: string; hasChildren: boolean; name: string; selected: boolean };

	let tree: file[] = [];
	let showObject: boolean;
	let lastSelectedNodePath: string;

	onMount(() => {
		tree = Files.map((n) => {
			return {
				...n,
				path: n.path.replaceAll('\\', '/'),
				checkbox: !n.path.startsWith('.'),
				selected: false
			};
		});
		console.log('MountedTree', tree);
	});

	function onSelectRandomNode() {
		const idx = Math.floor(Math.random() * tree.length);
		const node = tree[idx];

		if (!node.hasChildren) {
			node.selected = !node.selected;
		}

		lastSelectedNodePath = node.path;
		tree = tree;
	}
</script>

<div class="row mt-3">
	<div class="col-lg-8 col-12">
		<Card>
			<TreeView
				bind:tree
				treeId="tree"
				let:node
				on:selection={(e) => console.log(e.detail)}
				on:expansion={(e) => console.log(e.detail)}
				on:moved={(e) => console.log(e.detail)}
				recalculateNodePath={false}
				props={{ nodePath: 'path', selected: 'selected' }}
				separator="/"
				showContexMenu
				recursiveSelection
				expandTo={-1}
				selectionMode={SelectionModes.all}
				dragAndDrop
				verticalLines
				logger={(...data) => console.debug('treeview: ', ...data)}
			>
				{#if showObject}
					{JSON.stringify(node)}
				{:else}
					{#if node.hasChildren}
						<img
							src="https://static.vecteezy.com/system/resources/thumbnails/000/439/792/small/Basic_Ui__28178_29.jpg"
							alt="folder"
							height="20"
						/>
					{:else}
						<img
							src="https://cdn-icons-png.flaticon.com/512/124/124837.png"
							alt="folder"
							height="20"
						/>
					{/if}
					{node.name}
				{/if}

				<svelte:fragment slot="context-menu" let:node>
					<MenuOption text={node.path} isDisabled />
					<MenuDivider />
					<MenuOption
						on:click={() =>
							window.open(
								'https://github.com/KeenMate/phoenix-svelte-adminlte/blob/sveltekit/' + node.path
							)}
					>
						Open on github
					</MenuOption>
				</svelte:fragment>
			</TreeView>
		</Card>
	</div>
	<div class="col-lg-4 col-12">
		<Card>
			This demo shows how treeview can be used to browse files.
			<br />

			<label for="showObjects">Show node objects</label>
			<input id="showObjects" type="checkbox" bind:checked={showObject} />

			<br />

			<button class="btn btn-primary" on:click={onSelectRandomNode}> Select random node </button>

			{#if lastSelectedNodePath}
				<br />
				selected: {lastSelectedNodePath}
			{/if}
		</Card>
	</div>
</div>
