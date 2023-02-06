<script>
	import MenuDivider from "../src/menu/MenuDivider.svelte";
	import MenuOption from "../src/menu/MenuOption.svelte";
	import TreeView from "../src/TreeView.svelte";

	let tree = [];

	function generateTree(rootNodesCount, number) {
		const generatedTree = [];
		let id;
		for (id = 1; id < rootNodesCount; id++) {
			const newNode = { nodePath: id.toString() };
			generatedTree.push(newNode);
		}

		for (; id < number; id++) {
			const maxIndex = generatedTree.length / 2 + 1;
			const parent = generatedTree.sort()[Math.floor(Math.random() * maxIndex)];
			parent.hasChildren = true;

			const newNode = { nodePath: parent.nodePath + "." + id };
			generatedTree.push(newNode);
		}
		console.log(generatedTree);
		return generatedTree;
	}

	tree = generateTree(5, 20);
</script>

<TreeView
	bind:tree
	treeId="tree"
	let:node
	on:selection={(e) => console.log(e.detail)}
	on:expansion={(e) => console.log(e.detail)}
	on:moved={(e) => console.log(e.detail)}
	dragAndDrop
	recalculateNodePath={false}
>
	{JSON.stringify(node)}

	<svelte:fragment slot="context-menu" let:node>
		<MenuOption text={node.nodePath} isDisabled />
		<MenuDivider />
		<MenuOption text="alert object" on:click={alert(JSON.stringify(node))} />
	</svelte:fragment>
</TreeView>
