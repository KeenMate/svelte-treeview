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
		//expandToLevel,
		changeEveryExpansion,
		getInsertionPosition,
		huminifyInsType,
	} from "./TreeHelpers";

	//! required
	export let tree = null; //array of nodes with nodePath
	export let treeId = null; //string

	//!user set
	export let maxExpandedDepth = 3; //number
	//tree that will be rendered(will be same as tree if null)
	export let filteredTree; //array of nodes with nodePath
	export let recursive = false; //bool
	export let checkboxes = "none"; //bool
	//if true, will show checkboxes to elements with children
	export let leafNodeCheckboxesOnly = false; //bool
	//true = disabel hide = false
	export let checkboxesDisabled = false; //bool
	//will allow you to move nodes between nodes and reorder them
	export let dragAndDrop = false; //bool
	//will nest of at least one of them is meet
	export let timeToNest = null;
	export let pixelNestTreshold = 50;
	export let expandCallback = null;
	export let showContexMenu = false;
	export let beforeMovedCallback = null;
	export let enableVerticalLines = false;
	export let recalculateNodePath = true;
	export let expandedLevel = 0;
	export let dragEnterCallback = null;

	//* classes for customization of tree
	export let treeClass = "treeview";
	export let nodeClass = null;
	export let expandedToggleClass = null;
	export let collapsedToggleClass = null;
	export let expandClass = "inserting-highlighted";
	export let inserLineClass = null;
	export let inserLineNestClass = null;
	export let currentlyDraggedClass = "currently-dragged";

	//* properties
	export let nodePathProperty = "nodePath";
	export let hasChildrenProperty = "hasChildren";
	export let expandedProperty = "__expanded";
	export let selectedProperty = "__selected";
	export let useCallbackProperty = "__useCallback";
	export let priorityProperty = "priority";
	export let isDraggableProperty = "isDraggable";
	export let insertDisabledProperty = "insertDisabled";
	export let nestDisabledProperty = "nestDisabled";
	export let checkboxVisibleProperty = "checkboxVisible";

	let propNames = getPropsObject(
		nodePathProperty,
		hasChildrenProperty,
		expandedProperty,
		selectedProperty,
		useCallbackProperty,
		priorityProperty,
		isDraggableProperty,
		insertDisabledProperty,
		nestDisabledProperty,
		checkboxVisibleProperty
	);
	$: propNames = getPropsObject(
		nodePathProperty,
		hasChildrenProperty,
		expandedProperty,
		selectedProperty,
		useCallbackProperty,
		priorityProperty,
		isDraggableProperty,
		insertDisabledProperty,
		nestDisabledProperty,
		checkboxVisibleProperty
	);

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
	// svelte-ignore unused-export-let
	export let branchRootNode = {};

	let dragenterTimestamp;
	let canNestPos = false;
	let canNestTime = false;
	let canNest;
	let dragTimeout;
	let validTarget = false;
	let insPos;
	//if insert is disabled => nest right away and never nest if its disabled
	$: canNest =
		(highlightedNode?.[propNames?.insertDisabledProperty] ||
			canNestPos ||
			canNestTime) &&
		highlightedNode?.[propNames?.nestDisabledProperty] !== true;
	//
	let ctxMenu;
	const getNodeId = (node) => `${treeId}-${getId(node)}`;

	$: parentChildrenTree = OrderByPriority(
		getParentChildrenTree(
			filteredTree ? filteredTree : tree,
			parentId,
			isChild,
			getParentId
		),
		propNames
	);

	$: parsedMaxExpandedDepth = Number(maxExpandedDepth ?? 0);

	function getPropsObject(
		nodePath,
		hasChildren,
		expanded,
		selected,
		useCallback,
		priority,
		isDraggable,
		insertDisabled,
		nestDisabled,
		checkboxVisible
	) {
		return {
			nodePathProperty: nodePath,
			expandedProperty: expanded,
			selectedProperty: selected,
			useCallbackProperty: useCallback,
			priorityProperty: priority,
			hasChildrenProperty: hasChildren,
			isDraggableProperty: isDraggable,
			insertDisabledProperty: insertDisabled,
			nestDisabledProperty: nestDisabled,
			checkboxVisibleProperty: checkboxVisible,
		};
	}

	//#region expansions

	function toggleExpansion(node, expanded) {
		tree = changeExpansion(tree, node, !expanded, propNames);

		let val = node[propNames.expandedProperty];

		//trigger callback if it is present and node has useCallbackProperty
		if (
			val &&
			expandCallback != null &&
			node[propNames.useCallbackProperty] == true
		) {
			//console.log("calling callback");
			fetchNodeDataAsync(node)
				.then((val) => {
					tree = tree.concat(val);
					node[propNames.useCallbackProperty] = false;
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
		return data;
	}

	export function changeAllExpansion(changeTo) {
		tree = changeEveryExpansion(tree, changeTo, propNames);
	}

	function shouldExpand(expandProp, depth, expandTo) {
		//expanded prop has priority over expanded Level
		if (expandProp != undefined || expandProp != null) {
			return expandProp;
		}
		return depth <= expandTo;
	}

	//#endregion

	//#region checkboxes

	$: ComputeVisualTree(filteredTree);
	function ComputeVisualTree(filteredTree) {
		tree = computeInitialVisualStates(
			tree,
			isChild,
			getParentId,
			filteredTree ?? tree,
			propNames
		);
	}

	//checkboxes
	function selectionChanged(node) {
		//console.log(nodePath);
		tree = ChangeSelection(
			recursive,
			tree,
			node[propNames.nodePathProperty],
			isChild,
			getParentId,
			filteredTree ?? tree,
			propNames
		);
		selectionEvents(node);
	}

	//fired when in recursive mode you click on Leaf node
	function selectChildren(node, e) {
		tree = ChangeSelectForAllChildren(
			tree,
			node[propNames.nodePathProperty],
			isChild,
			e.target.checked,
			getParentId,
			filteredTree ?? tree,
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

	function showCheckboxes(node, checkboxes) {
		//show if prop isnt false
		if (checkboxes == "all") {
			return !(node[propNames.checkboxVisibleProperty] == false);
		}
		//show only if pop is true
		if (checkboxes == "perNode") {
			return node[propNames.checkboxVisibleProperty] == true;
		}
		//dont show at all
		return false;
	}

	//#endregion

	//#region drag and drop
	function handleDragStart(e, node) {
		if (node[propNames.isDraggableProperty] === false) {
			e.preventDefault();
			return;
		}

		console.log("dragstart from: " + node[propNames.nodePathProperty]);

		e.dataTransfer.dropEffect = "move";
		e.dataTransfer.setData("node_id", node[propNames.nodePathProperty]);
		draggedPath = node[propNames.nodePathProperty];
	}

	function handleDragDrop(e, node, el) {
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

		let insType = canNest ? 0 : getInsertionPosition(e, el);

		//cancel move if its not valid
		if (insType == 0 && node[propNames.nestDisabledProperty] === true) return;
		else if (
			(insType == -1 || insType == 1) &&
			node[propNames.insertDisabledProperty] === true
		)
			return;

		//callback can cancell move
		if (
			beforeMovedCallback &&
			beforeMovedCallback(
				oldNode,
				oldParent,
				node,
				huminifyInsType(insType)
			) === false
		)
			return;

		tree = moveNode(
			tree,
			draggedPath,
			node[propNames.nodePathProperty],
			isChild,
			insType,
			recalculateNodePath,
			propNames
		);

		let newParent =
			tree.find(
				(x) =>
					x[propNames.nodePathProperty] ==
					getParentNodePath(newNode[propNames.nodePathProperty])
			) ?? null;

		dispatch("moved", {
			oldParent: oldParent,
			newParent: newParent,
			oldNode: oldNode,
			newNode: newNode,
			targetNode: node,
			insType: huminifyInsType(insType),
		});

		//reset props
		dragenterTimestamp = null;
		draggedPath = null;
		highlightedNode = null;
	}

	function handleDragOver(e, node, el) {
		insPos = getInsertionPosition(e, el);

		//if you are further away from right then treshold allow nesting

		let diff = e.x - e.target.getBoundingClientRect().x;
		if (pixelNestTreshold && diff > pixelNestTreshold) {
			canNestPos = true;
		} else {
			canNestPos = false;
		}

		//allow drop if valid target
		if (validTarget) e.preventDefault();
	}

	function handleDragEnter(e, node, el) {
		setTimeout(() => {
			insPos = getInsertionPosition(e, el);

			validTarget = true;
			dragenterTimestamp = new Date();
			// will cause flashing when moving wrom node to node while be able to nest
			//* have to be here if you only use time
			highlightedNode = node;

			if (timeToNest) {
				canNestTime = false;

				//this is so that only one timeout is ticking at one time
				clearTimeout(dragTimeout);

				dragTimeout = setTimeout(() => {
					canNestTime = true;
				}, timeToNest);
			}

			//dont allow drop on child element and if both insertDisabled and nestDisabled to true
			if (
				node[propNames.nodePathProperty].startsWith(draggedPath) ||
				(node[propNames.insertDisabledProperty] === true &&
					node[propNames.nestDisabledProperty] === true)
			) {
				validTarget = false;
			}

			//if defined calling callback
			if (dragEnterCallback) {
				//get node for event
				let draggedNode = tree.find(
					(n) => n[propNames.nodePathProperty] == draggedPath
				);
				let oldParent = tree.find(
					(n) => n[propNames.nodePathProperty] == getParentNodePath(draggedPath)
				);

				//callback returning false means that it isnt valid target
				if (dragEnterCallback(draggedNode, oldParent, node) === false) {
					validTarget = false;
				}
			}
		}, 1);
		e.preventDefault();
	}

	function handleDragEnd(e, node) {
		//reset prop on next tick
		setTimeout(() => {
			draggedPath = null;
			highlightedNode = null;
		}, 1);
	}

	function handleDragleave(e, node) {
		// highlightedNode = null;
	}
	/**
	 *check if this node is one being hovered over (highlited) and is valid target
	 */
	function highlighThisNode(n, hn, vt) {
		return (
			vt && hn?.[propNames.nodePathProperty] == n?.[propNames.nodePathProperty]
		);
	}
	/**
	 * returns true, it should highlight nesting on this node
	 * @param n node
	 * @param hn highlited node
	 * @param vt valid target
	 * @param cn can nest
	 */
	function highlightNesting(n, hn, vt, cn) {
		return (
			cn &&
			highlighThisNode(n, hn, vt) &&
			n[propNames.nestDisabledProperty] !== true
		);
	}
	/**
	 * returns true, it should highlight nesting on this node
	 * @param n node
	 * @param hn highlited node
	 * @param vt valid target
	 * @param cn can nest
	 */
	function highlightInsert(n, hn, vt, cn) {
		return (
			!cn &&
			highlighThisNode(n, hn, vt) &&
			n[propNames.insertDisabledProperty] !== true
		);
	}

	//#endregion

	//#region context menu
	function openContextMenu(e, node) {
		if (!showContexMenu) return;
		e.preventDefault();
		ctxMenu.onRightClick(e, node);
	}

	//#endregion

	//computes all visual states when component is first created
	tree = computeInitialVisualStates(
		tree,
		isChild,
		getParentId,
		filteredTree ?? tree,
		propNames
	);

	$: tree, tree == null || tree == undefined ? (tree = []) : "";

	let liElements = [];
</script>

<ul
	class:show-lines={childDepth === 0 && enableVerticalLines}
	class:child-menu={childDepth > 0}
	class={childDepth === 0 ? treeClass : ""}
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
			on:drop|stopPropagation={(e) =>
				handleDragDrop(e, node, liElements[getNodeId(node)])}
			on:dragover|stopPropagation={(e) =>
				handleDragOver(e, node, liElements[getNodeId(node)])}
			on:dragenter|stopPropagation={(e) =>
				handleDragEnter(e, node, liElements[getNodeId(node)])}
			on:dragleave|stopPropagation={(e) =>
				handleDragleave(e, node, liElements[getNodeId(node)])}
			bind:this={liElements[getNodeId(node)]}
		>
			<!-- place here if insering above  -->

			{#if insPos == 1 && highlightInsert(node, highlightedNode, validTarget, canNest)}
				<div class="insert-line-wrapper">
					<div class="insert-line {inserLineClass}" />
				</div>
			{/if}

			<div
				class="tree-item
				{highlightNesting(node, highlightedNode, validTarget, canNest)
					? expandClass
					: ''}
				{nodeClass} {draggedPath == node?.[propNames.nodePathProperty] ||
				node?.[propNames.nodePathProperty]?.startsWith(draggedPath)
					? currentlyDraggedClass
					: ''}"
				class:div-has-children={node[propNames.hasChildrenProperty]}
				class:hover={highlightInsert(
					node,
					highlightedNode,
					validTarget,
					canNest
				) || highlightNesting(node, highlightedNode, validTarget, canNest)}
				draggable={dragAndDrop && node[propNames.isDraggableProperty] !== false}
				on:dragstart={(e) => handleDragStart(e, node)}
				on:dragend={(e) => handleDragEnd(e, node)}
			>
				{#if node[propNames.hasChildrenProperty]}
					<span
						on:click={() =>
							toggleExpansion(
								node,
								shouldExpand(
									node[propNames.expandedProperty],
									childDepth,
									expandedLevel
								) && !node[propNames.useCallbackProperty]
							)}
					>
						<i
							class="far {shouldExpand(
								node[propNames.expandedProperty],
								childDepth,
								expandedLevel
							)
								? expandedToggleClass
								: collapsedToggleClass}"
							class:fa-minus-square={shouldExpand(
								node[propNames.expandedProperty],
								childDepth,
								expandedLevel
							)}
							class:fa-plus-square={!shouldExpand(
								node[propNames.expandedProperty],
								childDepth,
								expandedLevel
							) || node[propNames.useCallbackProperty]}
						/>
					</span>
				{:else}
					<span />
				{/if}
				{#if checkboxes == "perNode" || checkboxes == "all"}
					{#if showCheckboxes(node, checkboxes)}
						{#if !recursive || (recursive && !node[propNames.hasChildrenProperty])}
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
						{:else}
							<input
								type="checkbox"
								id={getNodeId(node)}
								onclick="return false;"
								disabled={true}
								class:invisible={!checkboxesDisabled}
							/>
						{/if}
					{:else}
						<input
							type="checkbox"
							id={getNodeId(node)}
							onclick="return false;"
							disabled={true}
							class:invisible={!checkboxesDisabled}
						/>
					{/if}
				{/if}
				<slot {node} />
			</div>

			{#if highlightNesting(node, highlightedNode, validTarget, canNest)}
				<div class="insert-line-wrapper">
					<div
						class="insert-line insert-line-child {inserLineClass} {inserLineNestClass}"
					/>
				</div>
			{/if}
			{#if shouldExpand(node[propNames.expandedProperty], childDepth, expandedLevel) && node[propNames.hasChildrenProperty]}
				<svelte:self
					branchRootNode={node}
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
					{checkboxesDisabled}
					{expandedLevel}
					bind:draggedPath
					bind:dragAndDrop
					on:selection
					on:selected
					on:unselected
					on:expansion
					on:expanded
					on:closed
					{nodePathProperty}
					{hasChildrenProperty}
					{expandedProperty}
					{selectedProperty}
					{useCallbackProperty}
					{priorityProperty}
					{isDraggableProperty}
					{insertDisabledProperty}
					{nestDisabledProperty}
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
					{dragEnterCallback}
				>
					<slot node={nodeNested} />
				</svelte:self>
			{/if}
			{#if !shouldExpand(node[propNames.expandedProperty], childDepth, expandedLevel) && node[propNames.hasChildrenProperty]}
				<ul class:child-menu={childDepth > 0} />
			{/if}
			<!-- Show line if insering -->
			{#if insPos == -1 && highlightInsert(node, highlightedNode, validTarget, canNest)}
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

	:global
		$treeview-lines: solid black 1px
		.treeview
			//will show lines if you set show-lines to root element
			&.show-lines
				ul
					&:before
						border-left: $treeview-lines
					li:before
						border-top: $treeview-lines
			margin: 0
			padding: 0
			list-style: none
			ul, li
				margin: 0
				padding: 0
				list-style: none
			ul
				margin-left: 0.4em
				position: relative
				ul
				margin-left: .3em
				&:before
					content: ""
					display: block
					width: 0
					position: absolute
					top: 0
					bottom: 0
					left: 0
					// border-left: $treeview-lines
				li:before
					content: ""
					display: block
					width: 10px
					height: 0
					// border-top: $treeview-lines
					margin-top: -1px
					position: absolute
					top: 0.8em
					left: 0
				li:not(.has-children):before
					width: 26px



				li:last-child:before
					background: #fff
					height: auto
					top: 1em
					bottom: 0



			li
				margin: 0
				padding: 0 0.8em
				color: #555
				font-weight: 700
				position: relative
				&:not(.has-children)
						.tree-item
							margin-left: 14px

			.tree-item
				display: flex
				column-gap: 0.4em
				align-items: center
				padding:  4px 0

			.div-has-children
				//margin-left: 11px

			.no-arrow
				padding-left: .5rem

			.arrow
				cursor: pointer
				display: inline-block

			.arrowDown
				transform: rotate(90deg)

			.invisible
				visibility: hidden

			.inserting-highlighted
				color: red
			.hover
				font-weight: bold
			.insert-line
				position: absolute
				// top: 0.75em
				left: 0
				z-index: 99
				height: 2px
				width: 200px
				background-color: blue
				display: block
				border-radius: 3px
				margin-left: 28px
				margin-bottom: -2px
				margin-top: -2px
			.insert-line-child
				margin-left: calc( 28px + 5em )
				background-color: red
				height: 6px

			.insert-line-wrapper
				position: relative

			.currently-dragged
				color: LightGray

</style>
