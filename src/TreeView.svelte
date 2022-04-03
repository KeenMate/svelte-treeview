<script>
	import ContextMenu from "./ContextMenu.svelte";
	import { createEventDispatcher } from "svelte";

	const dispatch = createEventDispatcher();

	import {
		getParentNodePath,
		hasChildren,
		nodePathIsChild,
		OrderByPriority,
		getParentChildrenTree,
		computeInitialVisualStates,
		changeExpansion,
		ChangeSelection,
		ChangeSelectForAllChildren,
		moveNode,
	} from "./TreeHelpers";

	//! required
	export let tree = null; //array of nodes with nodePath
	export let treeId = null; //string
	export let maxExpandedDepth = 3; //number
	//tree that will be rendered(will be same as tree if null)
	export let filteredTree; //array of nodes with nodePath
	export let recursive = false; //bool
	export let checkboxes = false; //bool
	//if true, will show checkboxes to elements with children
	export let leafNodeCheckboxesOnly = false; //bool
	//true = disabel hide = false
	export let disableOrHide = false; //bool
	//will allow you to move nodes between nodes and reorder them
	export let dragAndDrop = false; //bool
	//properties
	export let expandedProperty = "__expanded";
	export let selectedProperty = "__selected";
	export let usecallbackPropery = "__useCallback";
	export let priorityPropery = "__priority";
	//classes for customization of tree
	export let treeCssClass = "",
		nodeCssClass = "",
		expandedToggleCss = "",
		collapsedToggleCss = "";
	//class shown on div when it should expand on drag and drop
	export let expandClass = "inserting-highlighted";
	//will nest of at least one of them is meet
	export let timeToNest = null;
	export let pixelNestTreshold = 150;
	export let expandCallback = null;
	export let showContexMenu = false;
	export let beforeMovedCallback = null;


	export let getId = (x) => x.nodePath;
	export let getParentId = (x) => getParentNodePath(x.nodePath);
	export let isChild = (x) => nodePathIsChild(x.nodePath);



	//! DONT SET ONLY USED INTERNALLY
	//path of currently dragged node
	export let draggedPath = null;
	export let highlightedNode = null;
	export let childDepth = 0; //number
	export let parentId = null; //string
	export let nodePath = null;

	let dragenterTimestamp;
	let canNestPos = false;
	let canNestTime = false;
	let canNest;
	let dragTimeout;
	let validTarget = false;
	$: canNest = canNestPos || canNestTime;

	//
	let ctxMenu;

	const getNodeId = (node) => `${treeId}-${getId(node)}`;

	$: parentChildrenTree = OrderByPriority(
		getParentChildrenTree(
			filteredTree === undefined ? tree : filteredTree,
			parentId,
			isChild,
			getParentId
		),
		priorityPropery
	);
	$: ComputeVisualTree(filteredTree);
	$: parsedMaxExpandedDepth = Number(maxExpandedDepth ?? 0);

	function ComputeVisualTree(filteredTree) {
		tree = computeInitialVisualStates(
			tree,
			isChild,
			selectedProperty,
			getParentId,
			filteredTree
		);
	}

	//#region expansions

	function expandNodes(nodes) {
		if (!nodes || !nodes.length) return;
		nodes.forEach((x) => toggleExpansion(x, true));
	}

	function toggleExpansion(node, setValueTo = null) {
		tree = changeExpansion(tree, node.nodePath, expandedProperty);

		let val = node[expandedProperty];

		//trigger callback if it is present and node has useCallbackPropery
		if (val && expandCallback != null && node[usecallbackPropery] == true) {
			console.log("calling callback");
			fetchNodeDataAsync(node)
				.then((val) => {
					tree = tree.concat(val);
					node[usecallbackPropery] = false;
				})
				.catch((reason) => {
					console.log("ERROR IN CALLBACK!!");
					console.log(reason);
				});
		}

		//expansion events
		dispatch("expansion", {
			node: node.nodePath,
			value: val,
		});

		if (val) {
			dispatch("expanded", node.nodePath);
		} else {
			dispatch("closed", node.nodePath);
		}
	}

	//awaits function provided in expandCallback
	async function fetchNodeDataAsync(node) {
		let data = await expandCallback(node);
		console.log("loaded new nodes: ");
		console.log(data);
		return data;
	}

	function recomputeExpandedNodes() {
		if (childDepth < parsedMaxExpandedDepth) {
			expandNodes(parentChildrenTree);
		}
	}

	//#endregion

	//#region checkboxes

	//checkboxes
	function selectionChanged(node) {
		//console.log(nodePath);
		tree = ChangeSelection(
			recursive,
			tree,
			node.nodePath,
			isChild,
			selectedProperty,
			getParentId,
			filteredTree
		);
		selectionEvents(node);
	}

	//selectes
	function selectChildren(node, e) {
		tree = ChangeSelectForAllChildren(
			tree,
			node.nodePath,
			isChild,
			selectedProperty,
			e.target.checked,
			getParentId,
			filteredTree
		);
		selectionEvents(node);
	}

	function selectionEvents(node) {
		let val = node[selectedProperty];
		dispatch("selection", {
			node: node,
			value: val,
		});
		if (val) {
			dispatch("selected", node);
		} else {
			dispatch("unselected", node);
		}
	}

	//#endregion

	//#region drag and drop
	function handleDragStart(e, node) {
		console.log("dragstart from: " + node.nodePath);
		e.dataTransfer.dropEffect = "move";
		e.dataTransfer.setData("node_id", node.nodePath);
		draggedPath = node.nodePath;
	}

	function handleDragDrop(e, node) {
		//should be necesary but just in case
		highlightedNode = null;
		if (!dragAndDrop) return;
		draggedPath = e.dataTransfer.getData("node_id");
		console.log(draggedPath + " dropped on: " + node.nodePath);

		//important to check if timetonest is set, otherwise you could spend 30 minutes fixing this shit :)
		if (timeToNest) {
			canNestTime =
				(dragenterTimestamp ? new Date() - dragenterTimestamp : 1) > timeToNest;
		}

		let newNode = tree.find((n) => n.nodePath == draggedPath);

		let oldNode = {...newNode}
		let oldParent = tree.find(
			(n) => (n.nodePath == getParentNodePath(draggedPath))
		);

		//callback can cancell move
		if(beforeMovedCallback(oldNode,oldParent,node,canNest) === false)
			return

		tree = moveNode(
			tree,
			draggedPath,
			node.nodePath,
			isChild,
			canNest,
			priorityPropery,
			expandedProperty
		);


		dispatch("moved", {
			oldParent: oldParent,
			oldNode: oldNode,
			NewNode: newNode,
			targetNode: node,
			nest: canNest
		});

		console.log("dispatched")


		//reset props
		dragenterTimestamp = null;
		draggedPath = null;
		highlightedNode = null;
	}

	function handleDragOver(e, node) {
		//if you are further away from right then treshold allow nesting
		let diff = e.x - e.target.getBoundingClientRect().x;
		//console.log(diff + " - " + (diff > pixelNestTreshold))
		if (pixelNestTreshold && diff > pixelNestTreshold) {
			canNestPos = true;
		} else {
			canNestPos = false;
		}

		//if you arent dropping parent to child allow drop
		if (dragAndDrop && !node.nodePath.startsWith(draggedPath)) {
			validTarget = true;
			e.preventDefault();
		} else {
			validTarget = false;
		}
	}

	function handleDragEnter(e, node) {
		validTarget = false;
		dragenterTimestamp = new Date();
		// will cause flashing when moving wrom node to node while be able to nest
		//* have to be here if you only use time
		highlightedNode = node;

		if (timeToNest) {
			canNestTime = false;

			clearTimeout(dragTimeout);

			dragTimeout = setTimeout(() => {
				canNestTime = true;
			}, timeToNest);
		}
		e.preventDefault();
	}

	function handleDragEnd(e, node) {
		setTimeout(() => {
			draggedPath = null;
			highlightedNode = null;
		}, 1);
	}

	//#endregion

	//#region context menu
	function openContextMenu(e, node) {
		if (!showContexMenu) return;
		e.preventDefault();
		console.log("openning context menu from: " + node.nodePath);
		ctxMenu.onRightClick(e, node);
	}

	//#endregion

	//computes all visual states when component is first created
	tree = computeInitialVisualStates(
		tree,
		isChild,
		selectedProperty,
		getParentId,
		filteredTree
	);
</script>

<ul
	class:treeview={childDepth === 0}
	class:child-menu={childDepth > 0}
	class={treeCssClass}
>
	{#each parentChildrenTree as node (getNodeId(node))}
		<li
			class:is-child={isChild(node)}
			class:has-children={node.hasChildren}
			on:contextmenu|stopPropagation={(e) => {
				childDepth == 0
					? openContextMenu(e, node)
					: dispatch("open-ctxmenu", { e: e, node: node });
			}}
		>
			<div
				class="tree-item {validTarget &&
				canNest &&
				highlightedNode?.nodePath == node.nodePath
					? expandClass
					: ''} {nodeCssClass}"
				class:div-has-children={node.hasChildren}
				class:hover={validTarget && highlightedNode?.nodePath == node.nodePath}
				draggable={dragAndDrop}
				on:dragstart={(e) => handleDragStart(e, node)}
				on:drop={(e) => handleDragDrop(e, node)}
				on:dragover={(e) => handleDragOver(e, node)}
				on:dragenter={(e) => handleDragEnter(e, node)}
				on:dragend={(e) => handleDragEnd(e, node)}
			>
				{#if node.hasChildren}
					<span on:click={() => toggleExpansion(node)}>
						<i
							class="far {node[expandedProperty]
								? expandedToggleCss
								: collapsedToggleCss}"
							class:fa-minus-square={node[expandedProperty]}
							class:fa-plus-square={!node[expandedProperty]}
						/>
					</span>
				{:else}
					<span />
				{/if}
				{#if checkboxes}
					{#if recursive}
						{#if !hasChildren(tree, node.nodePath)}
							<input
								type="checkbox"
								id={getNodeId(node)}
								on:change={() => selectionChanged(node)}
								checked={node[selectedProperty] ? "false" : ""}
							/>
						{:else if !leafNodeCheckboxesOnly}
							<input
								type="checkbox"
								id={getNodeId(node)}
								on:click={(e) => {
									e.preventDefault;
									selectChildren(node, e);
								}}
								checked={node.__visual_state == "true" ? "false" : ""}
								indeterminate={node.__visual_state == "indeterminate"}
							/>
						{:else if disableOrHide}
							<input
								type="checkbox"
								id={getNodeId(node)}
								onclick="return false;"
								disabled={true}
							/>
						{:else}
							<input
								type="checkbox"
								id={getNodeId(node)}
								onclick="return false;"
								class:invisible={!disableOrHide}
							/>
						{/if}
					{:else}
						<input
							type="checkbox"
							id={getNodeId(node)}
							on:change={() => selectionChanged(node)}
							checked={node[selectedProperty] ? "false" : ""}
						/>
					{/if}
				{/if}
				<slot {node} />
			</div>

			{#if validTarget && canNest && highlightedNode?.nodePath == node.nodePath}
				<div class="insert-line-wrapper">
					<div class="insert-line insert-line-child" />
				</div>
			{/if}
			<!-- {@debug node} -->
			<!--{@debug $_expansionState}-->
			{#if node[expandedProperty] && node.hasChildren}
				<!--tree={tree/*.filter(x => x.nodePath.startsWith(node.nodePath) && x.nodePath !== node.nodePath)*/} -->
				<svelte:self
					nodePath={node.nodePath}
					{treeId}
					{getId}
					{checkboxes}
					{getParentId}
					{maxExpandedDepth}
					bind:tree
					bind:filteredTree
					{recursive}
					childDepth={childDepth + 1}
					parentId={getId(node)}
					let:node={nodeNested}
					{leafNodeCheckboxesOnly}
					{disableOrHide}
					bind:draggedPath
					bind:dragAndDrop
					on:selection
					on:selected
					on:unselected
					on:expansion
					on:expanded
					on:closed
					bind:highlightedNode
					bind:timeToNest
					bind:pixelNestTreshold
					on:open-ctxmenu={(data) => {
						childDepth == 0
							? openContextMenu(data.detail.e, data.detail.node)
							: dispatch("open-ctxmenu", data.detail);
					}}
					{expandCallback}
					on:moved
					{beforeMovedCallback}
				>
					<slot node={nodeNested} />
				</svelte:self>
			{/if}
			{#if node[expandedProperty] != true && node.hasChildren}
				<ul class:child-menu={childDepth > 0} />
			{/if}
			<!-- Show line if insering -->
			{#if validTarget && !canNest && highlightedNode?.nodePath == node.nodePath}
				<div class="insert-line-wrapper">
					<div class="insert-line" />
				</div>
			{/if}
		</li>
	{/each}
</ul>

<ContextMenu bind:this={ctxMenu}>
	<svelte:fragment let:node>
		<slot name="context-menu" {node} />
	</svelte:fragment>
</ContextMenu>

<style lang="sass">
	$treeview-lines: dotted black 1px

	:global
		.treeview
			padding-left: 1em

			> :first-child
				//border-left: none
				padding-left: 1px

			ul, li
				list-style: none
				margin: 0
				padding: 0

			ul
				margin-left: 1.5em

			li
				border: $treeview-lines
				border-width: 0 0 1px 1px
				//padding: 0.3em 0


				&:last-child > ul
					border-left: 1px solid white

				div
					margin-left: 0


				ul
					border-top: $treeview-lines
					margin-left: -1px
					padding-left: 1.25em
					border-left: none
			.has-children
				border-bottom: 0px

			.tree-item
				display: flex
				column-gap: 0.4em
				align-items: center
				background: white
				position: relative
				top: 0.75em
				margin-left: 26px

			.div-has-children
				margin-left: 12px

			.no-arrow
				padding-left: .5rem

			.arrow
				cursor: pointer
				display: inline-block

			.arrowDown
				transform: rotate(90deg)

			.invisible
				visibility: none

			.inserting-highlighted
				color: red
			.hover
				font-weight: bold
			.insert-line
				position: absolute
				top: 0.75em
				left: 0
				z-index: 99
				height: 2px
				width: 200px
				background-color: blue
				display: block
				border-radius: 3px
				margin-left: 2.5em
			.insert-line-child
				margin-left: 5em
				background-color: red

			.insert-line-wrapper
				position: relative


</style>
