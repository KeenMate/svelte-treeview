<script lang="ts">
	import { onMount } from 'svelte';
	import { MenuDivider, MenuOption, TreeView } from '../../lib/index.js';

	type file = { path: string; hasChildren: boolean; name: string };

	import Files from '../../data/files.js';

	let tree: file[] = [];

	onMount(() => {
		tree = Files.map((n) => {
			return { ...n, path: n.path.replaceAll('\\', '/') };
		});
	});
	let showObject: boolean;
</script>

<label for="showObjects">Show node objects</label>
<input id="showObjects" type="checkbox" bind:checked={showObject} />

<TreeView
	bind:tree
	treeId="tree"
	let:node
	on:selection={(e) => console.log(e.detail)}
	on:expansion={(e) => console.log(e.detail)}
	on:moved={(e) => console.log(e.detail)}
	recalculateNodePath={false}
	props={{ nodePath: 'path' }}
	separator="/"
	showContexMenu
	recursive
	expandedLevel={-1}
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
			<img src="https://cdn-icons-png.flaticon.com/512/124/124837.png" alt="folder" height="20" />
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
