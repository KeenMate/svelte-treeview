<script>
	import { onMount } from "svelte";
	import { checkboxesType } from "../src/consts";
	import Menu from "../src/menu/Menu.svelte";
	import MenuDivider from "../src/menu/MenuDivider.svelte";
	import MenuOption from "../src/menu/MenuOption.svelte";
	import TreeView from "../src/TreeView.svelte";
	import Files from "./files.js";

	let tree = [];

	onMount(() => {
		tree = Files.map((n) => {
			return { ...n, path: n.path.replaceAll("\\", "/") };
		});
	});
	let showObject;
</script>

<input type="checkbox" bind:checked={showObject} />

<TreeView
	bind:tree
	treeId="tree"
	let:node
	on:selection={(e) => console.log(e.detail)}
	on:expansion={(e) => console.log(e.detail)}
	on:moved={(e) => console.log(e.detail)}
	recalculateNodePath={false}
	props={{ nodePath: "path" }}
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
			on:click={window.open(
				"https://github.com/KeenMate/phoenix-svelte-adminlte/blob/dev/" +
					node.path
			)}
		>
			Open on github
		</MenuOption>
	</svelte:fragment>
</TreeView>
