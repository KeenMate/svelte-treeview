<script>
	import { TreeView, mergeTrees } from "../index.js";

	import MenuDivider from "../src/MenuDivider.svelte";
	import MenuOption from "../src/MenuOption.svelte";

	let tree = [
		{
			nodePath: "1",
			title: "1",
			__visual_state: "indeterminate",
			__useCallback: true,
			hasChildren: true,
		},
		{ nodePath: "2", title: "2", isDraggable:false},

		{ nodePath: "3", title: "3", hasChildren: true, __expanded: true },
		{ nodePath: "3.4", title: "	Omniknight" },
		{ nodePath: "4", hasChildren: true, __expanded: true },
		{ nodePath: "4.1", priority: 0, title: "ITEM_1" },
		{ nodePath: "4.6", priority: 6, title: "ITEM_2" , insertDisabled: true },
		{ nodePath: "4.2", priority: 2, title: "ITEM_3" },
		{ nodePath: "4.3", priority: 3, title: "ITEM_4", nestDisabled:true},
		{ nodePath: "4.4", priority: 4, title: "ITEM_5" ,dropDisabled:true},
		{ nodePath: "4.5", priority: 10, title: "ITEM_6" , isDraggable:false},
	];

	let treeToAdd = [
		{ nodePath: "3.1", title: "Hecarim" },
		{ nodePath: "3.2", title: "3.2", hasChildren: true },
		{
			nodePath: "3.2.2",
			title: "Visage",
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
	];
	let dragAndDrop = true,
		showContexMenu = true,
		enableVerticalLines = false,
		num = 0,
		thisTree,
		expandedLevel;

	async function callback(n) {
		console.log("callback from " + n.nodePath);
		let data = await [
			{
				nodePath: n.nodePath + "." + ++num,
				priority: 0,
				__useCallback: true,
				hasChildren: true,
			},
			{
				nodePath: n.nodePath + "." + ++num,
				priority: 0,
				__useCallback: true,
				hasChildren: true,
			},
		];
		return data;
	}

	function handleClick(node) {
		console.log(node.nodePath);
		tree = tree.filter((n) => n.nodePath != node.nodePath);
	}

	function beforeCallback(node, oldParent, targetNode, nest) {
		// alert(
		// 	`moved ${node?.nodePath} from ${oldParent?.nodePath} to ${
		// 		targetNode?.nodePath
		// 	} while ${nest ? "nesting" : "not nesting"}`
		// );
	}

	function addTo() {
		tree = mergeTrees(tree, treeToAdd);
	}
</script>

TreeView drag and drop test
<input type="checkbox" bind:checked={dragAndDrop} />
<input type="checkbox" bind:checked={showContexMenu} />
<input type="checkbox" bind:checked={enableVerticalLines} />
<input type="number" bind:value={expandedLevel} />
<button on:click={addTo}> add</button>

<button on:click={thisTree.changeAllExpansion(true)}> true</button>
<button on:click={thisTree.changeAllExpansion(false)}> false</button>

<TreeView
	bind:this={thisTree}
	bind:tree
	treeId="tree"
	let:node
	maxExpandedDepth={4}
	recursive
	checkboxes
	bind:filteredTree={tree}
	on:selection={(e) => console.log(e.detail)}
	on:expansion={(e) => console.log(e.detail)}
	on:moved={(e) => console.log(e.detail)}
	bind:dragAndDrop
	{showContexMenu}
	expandCallback={callback}
	beforeMovedCallback={beforeCallback}
	{enableVerticalLines}
	{expandedLevel}
	nestDisabledProperty="dropDisabled"
	insertDisabledProperty="dropDisabled"

>
	{JSON.stringify(node)}

	<svelte:fragment slot="context-menu" let:node>
		<MenuOption text={node.nodePath} isDisabled />
		<MenuDivider />
		<MenuOption text="alert object" on:click={alert(JSON.stringify(node))} />
		<MenuOption text="delete node" on:click={handleClick(node)} />
	</svelte:fragment>
</TreeView>

<style>
</style>
