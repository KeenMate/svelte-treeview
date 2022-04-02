<script>
	import TreeView from "../src/TreeView.svelte";

	import MenuDivider from "../src/MenuDivider.svelte"
	import MenuOption from "../src/MenuOption.svelte"

	let num = 0;

	let tree = [
		{
			nodePath: "1",
			title: "1",
			__visual_state: "indeterminate",
			__useCallback: true,
			hasChildren: true,
		},
		{ nodePath: "2", title: "2" },

		{ nodePath: "3", title: "3", hasChildren: true, __expanded: true },
		{ nodePath: "3.1", title: "Hecarim" },
		{ nodePath: "3.2", title: "3.2", hasChildren: true, __expanded: false },
		{
			nodePath: "3.2.2",
			title: "Visage",
			__expanded: true,
			__selected: true,
			test: "test223",
		},
		{
			nodePath: "3.2.3",
			title: "Lycan",
			__expanded: true,
			__selected: true,
			test: "test223",
		},
		{
			nodePath: "3.2.4",
			title: "Bloodseeker",
			__expanded: true,
			__selected: true,
		},

		{ nodePath: "3.3", title: "3.3", hasChildren: true, __expanded: true },

		{
			nodePath: "3.3.1",
			title: "3.3.1",
			__expanded: true,
			__selected: false,
		},
		{ nodePath: "3.4", title: "	Omniknight" },
		{ nodePath: "4", hasChildren: true, __expanded: true },
		{ nodePath: "4.1", __priority: 0, title: "ITEM_1" },
		{ nodePath: "4.6", __priority: 6, title: "ITEM_2" },
		{ nodePath: "4.2", __priority: 2, title: "ITEM_3" },
		{ nodePath: "4.3", __priority: 3, title: "ITEM_4" },
		{ nodePath: "4.4", __priority: 4, title: "ITEM_5" },
		{ nodePath: "4.5", __priority: 10, title: "ITEM_6" },
	];
	let dragAndDrop = true,showContexMenu = true;
</script>

		TreeView drag and drop test
		<input type="checkbox" bind:checked={dragAndDrop} />
		<input type="checkbox" bind:checked={showContexMenu} />

	<TreeView
		bind:tree
		treeId="tree"
		let:node
		maxExpandedDepth={4}
		recursive
		checkboxes
		bind:filteredTree={tree}
		on:selection={(e) => console.log(e.detail)}
		on:expansion={(e) => console.log(e.detail)}
		bind:dragAndDrop
		{showContexMenu}
		expandCallback={async (n) => {
			console.log("callback from " + n.nodePath);
			let data = await [
				{
					nodePath: n.nodePath+ "." + ++num,
					__priority: 0,
					__useCallback: true,
					hasChildren: true,
				},
				{
					nodePath: n.nodePath+ "." + ++num,
					__priority: 0,
					__useCallback: true,
					hasChildren: true,
				},
				// {
				// 	nodePath: n.nodePath+ "." + ++num,
				// 	__priority: 0
				// },
			];
			return data;
		}}
	>
		{node.nodePath} p: {node.__priority} t: {node.title}

		<svelte:fragment slot="context-menu" let:node>

			<MenuOption text={node.nodePath} isDisabled></MenuOption>
			<MenuDivider/>
			<MenuOption text="alert object" on:click={alert(JSON.stringify(node))}></MenuOption>


		</svelte:fragment>
	</TreeView>

<style>
</style>
