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
	//classes for customization of tree
	export let treeClass = "",
		nodeClass = "",
		expandedToggleClass = "",
		collapsedToggleClass = "";
	//class shown on div when it should expand on drag and drop
	export let expandClass = "inserting-highlighted";
	export let inserLineClass = "";
	export let inserLineNestClass = "";
	//will nest of at least one of them is meet
	export let timeToNest = null;
	export let pixelNestTreshold = 150;
	export let expandCallback = null;
	export let showContexMenu = false;
	export let beforeMovedCallback = null;
	export let enableVerticalLines = false

	//* properties
	export let nodePathProperty = "nodePath";
	export let hasChildrenProperty = "hasChildren";
	export let expandedProperty = "__expanded";
	export let selectedProperty = "__selected";
	export let useCallbackPropery = "__useCallback";
	export let priorityPropery = "__priority";

	let propNames = getPropsObject(nodePathProperty,hasChildrenProperty,expandedProperty,selectedProperty,useCallbackPropery,priorityPropery);
	$: propNames = getPropsObject(nodePathProperty,hasChildrenProperty,expandedProperty,selectedProperty,useCallbackPropery,priorityPropery);


	export let getId = (x) => x[propNames.nodePathProperty];
	export let getParentId = (x) =>
		getParentNodePath(x[propNames.nodePathProperty]);
	export let isChild = (x) => nodePathIsChild(x[propNames.nodePathProperty]);

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
			getParentId,
			filteredTree,
			propNames
		);
	}

	function getPropsObject(nodePath,hasChildren, expanded,selected,useCallback,priority){
		return {
		nodePathProperty: nodePath,
		expandedProperty: expanded,
		selectedProperty: selected,
		useCallbackPropery: useCallback,
		priorityPropery: priority,
		hasChildrenProperty: hasChildren
	}
	}

	//#region expansions

	function expandNodes(nodes) {
		if (!nodes || !nodes.length) return;
		nodes.forEach((x) => toggleExpansion(x, true));
	}

	function toggleExpansion(node, setValueTo = null) {
		tree = changeExpansion(
			tree,
			node[propNames.nodePathProperty],
			propNames
		);

		let val = node[propNames.expandedProperty];

		//trigger callback if it is present and node has useCallbackPropery
		if (
			val &&
			expandCallback != null &&
			node[propNames.useCallbackPropery] == true
		) {
			console.log("calling callback");
			fetchNodeDataAsync(node)
				.then((val) => {
					tree = tree.concat(val);
					node[propNames.useCallbackPropery] = false;
				})
				.catch((reason) => {
					console.log("ERROR IN CALLBACK!!");
					console.log(reason);
				});
		}

		//expansion events
		dispatch("expansion", {
			node: node[propNames.nodePathProperty],
			value: val,
		});

		if (val) {
			dispatch("expanded", node[propNames.nodePathProperty]);
		} else {
			dispatch("closed", node[propNames.nodePathProperty]);
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
			node[propNames.nodePathProperty],
			isChild,
			getParentId,
			filteredTree,
			propNames
		);
		selectionEvents(node);
	}

	//selectes
	function selectChildren(node, e) {
		tree = ChangeSelectForAllChildren(
			tree,
			node[propNames.nodePathProperty],
			isChild,
			e.target.checked,
			getParentId,
			filteredTree,
			propNames
		);
		selectionEvents(node);
	}

	function selectionEvents(node) {
		let val = node[propNames.selectedProperty];
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
		console.log("dragstart from: " + node[propNames.nodePathProperty]);
		e.dataTransfer.dropEffect = "move";
		e.dataTransfer.setData("node_id", node[propNames.nodePathProperty]);
		draggedPath = node[propNames.nodePathProperty];
	}

	function handleDragDrop(e, node) {
		//should be necesary but just in case
		highlightedNode = null;
		if (!dragAndDrop) return;
		draggedPath = e.dataTransfer.getData("node_id");
		console.log(
			draggedPath + " dropped on: " + node[propNames.nodePathProperty]
		);

		//important to check if timetonest is set, otherwise you could spend 30 minutes fixing this shit :)
		if (timeToNest) {
			canNestTime =
				(dragenterTimestamp ? new Date() - dragenterTimestamp : 1) > timeToNest;
		}

		let newNode = tree.find(
			(n) => n[propNames.nodePathProperty] == draggedPath
		);

		let oldNode = { ...newNode };
		let oldParent = tree.find(
			(n) => n[propNames.nodePathProperty] == getParentNodePath(draggedPath)
		);

		//callback can cancell move
		if (beforeMovedCallback(oldNode, oldParent, node, canNest) === false)
			return;

		tree = moveNode(
			tree,
			draggedPath,
			node[propNames.nodePathProperty],
			isChild,
			canNest,
			propNames
		);

		dispatch("moved", {
			oldParent: oldParent,
			oldNode: oldNode,
			newNode: newNode,
			targetNode: node,
			nest: canNest,
		});

		console.log("dispatched");

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
		if (
			dragAndDrop &&
			!node[propNames.nodePathProperty].startsWith(draggedPath)
		) {
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
		console.log(
			"openning context menu from: " + node[propNames.nodePathProperty]
		);
		ctxMenu.onRightClick(e, node);
	}

	//#endregion

	//computes all visual states when component is first created
	tree = computeInitialVisualStates(
		tree,
		isChild,
		getParentId,
		filteredTree,
		propNames
	);
</script>

<ul
	class:treeview={childDepth === 0}
	class:show-lines={childDepth === 0 && enableVerticalLines}
	class:child-menu={childDepth > 0}
	class={treeClass}
>
	{#each parentChildrenTree as node (getNodeId(node))}
		<li
			class:is-child={isChild(node)}
			class:has-children={node[propNames.hasChildrenProperty]}
			on:contextmenu|stopPropagation={(e) => {
				childDepth == 0
					? openContextMenu(e, node)
					: dispatch("open-ctxmenu", { e: e, node: node });
			}}
		>
			<div
				class="tree-item {highlightedNode &&
				validTarget &&
				canNest &&
				highlightedNode[propNames.nodePathProperty] ==
					node[propNames.nodePathProperty]
					? expandClass
					: ''} {nodeClass}"
				class:div-has-children={node[propNames.hasChildrenProperty]}
				class:hover={validTarget &&
					highlightedNode &&
					highlightedNode[propNames.nodePathProperty] ==
						node[propNames.nodePathProperty]}
				draggable={dragAndDrop}
				on:dragstart={(e) => handleDragStart(e, node)}
				on:drop={(e) => handleDragDrop(e, node)}
				on:dragover={(e) => handleDragOver(e, node)}
				on:dragenter={(e) => handleDragEnter(e, node)}
				on:dragend={(e) => handleDragEnd(e, node)}
			>
				{#if node[propNames.hasChildrenProperty]}
					<span on:click={() => toggleExpansion(node)}>
						<i
							class="far {node[propNames.expandedProperty]
								? expandedToggleClass
								: collapsedToggleClass}"
							class:fa-minus-square={node[propNames.expandedProperty]}
							class:fa-plus-square={!node[propNames.expandedProperty]}
						/>
					</span>
				{:else}
					<span />
				{/if}
				{#if checkboxes}
					{#if recursive}
						{#if !hasChildren(tree, node[propNames.nodePathProperty],propNames)}
							<input
								type="checkbox"
								id={getNodeId(node)}
								on:change={() => selectionChanged(node)}
								checked={node[propNames.selectedProperty] ? "false" : ""}
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
							checked={node[propNames.selectedProperty] ? "false" : ""}
						/>
					{/if}
				{/if}
				<slot {node} />
			</div>

			{#if validTarget && canNest && highlightedNode && highlightedNode[propNames.nodePathProperty] == node[propNames.nodePathProperty]}
				<div class="insert-line-wrapper">
					<div
						class="insert-line insert-line-child {inserLineClass} {inserLineNestClass}"
					/>
				</div>
			{/if}
			<!-- {@debug node} -->
			<!--{@debug $_expansionState}-->
			{#if node[propNames.expandedProperty] && node[propNames.hasChildrenProperty]}
				<!--tree={tree/*.filter(x => x[propNames.nodePathProperty].startsWith(node[propNames.nodePathProperty]) && x[propNames.nodePathProperty] !== node[propNames.nodePathProperty])*/} -->
				<svelte:self
					nodePath={node[propNames.nodePathProperty]}
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
			{#if node[propNames.expandedProperty] != true && node[propNames.hasChildrenProperty]}
				<ul class:child-menu={childDepth > 0} />
			{/if}
			<!-- Show line if insering -->
			{#if validTarget && !canNest && highlightedNode && highlightedNode[propNames.nodePathProperty] == node[propNames.nodePathProperty]}
				<div class="insert-line-wrapper">
					<div class="insert-line {inserLineClass}" />
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
			&.show-lines
				> :first-child
					padding-left: 1px
				li
					border: $treeview-lines
					border-width: 0 0 1px 1px

					&:last-child > ul
						border-left: 1px solid white
					ul
						border-top: $treeview-lines
						margin-left: -1px
						border-left: none
				.has-children
					border-bottom: 0px


			padding-left: 1em
			ul, li
				list-style: none
				margin: 0
				padding: 0
			ul
				//margin-left: 1.5em
			li
				//padding: 0.3em 0
				div
					margin-left: 0
				ul
					padding-left: 1.25em


			.tree-item
				display: flex
				column-gap: 0.4em
				align-items: center
				background: white
				position: relative
				top: 0.75em
				margin-left: 26px

			.div-has-children
				margin-left: 11px

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
