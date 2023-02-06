<script>
	import ContextMenu from "./menu/ContextMenu.svelte";
	import { createEventDispatcher } from "svelte";
	import createTreeHelper from "./helpers/tree-helper";
	import {
		checkboxesType,
		defaultCurrentlyDraggedClass,
		defaultExpandClass,
		defaultPixelTreshold,
		defaultPropNames,
		defaultTreeClass,
	} from "./consts";

	import Checkbox from "./Checkbox.svelte";

	const dispatch = createEventDispatcher();

	//! required
	export let tree = null; //array of nodes with nodePath
	export let treeId = null; //string
	//!user set
	//tree that will be rendered(will be same as tree if null)
	export let filteredTree = null; //array of nodes with nodePath
	export let recursive = false; //bool
	export let checkboxes = checkboxesType.none; //bool on of [all,perNode]
	//if true, will show checkboxes to elements with children
	//TODO make batter name
	export let onlyLeafCheckboxes = false; //bool
	//true = disabel hide = false
	export let checkboxesDisabled = false; //bool
	//will allow you to move nodes between nodes and reorder them
	export let dragAndDrop = false; //bool
	//will nest of at least one of them is meet
	export let timeToNest = null;
	export let pixelNestTreshold = defaultPixelTreshold;

	export let showContexMenu = false;
	export let enableVerticalLines = false;
	export let readonly = false;

	//change to false when last segment of nodePath is Guaranteed to be unqiue
	export let recalculateNodePath = true;
	export let expandedLevel = 0;

	//callback for dynamically disabling drop on specific node
	export let dragEnterCallback = null;
	export let beforeMovedCallback = null;
	export let expandCallback = null;

	//* classes for customization of tree
	export let treeClass = defaultTreeClass;
	export let nodeClass = null;
	export let expandedToggleClass = null;
	export let collapsedToggleClass = null;
	export let expandClass = defaultExpandClass;
	export let inserLineClass = null;
	export let inserLineNestClass = null;
	export let currentlyDraggedClass = defaultCurrentlyDraggedClass;

	//* properties
	export let props = {};
	let propNames = { ...defaultPropNames, ...props };
	$: propNames = { ...defaultPropNames, ...props };

	//! DONT SET ONLY USED INTERNALLY
	//TODO use context instead
	//path of currently dragged node
	export let draggedPath = null;
	export let highlightedNode = null;
	export let childDepth = 0; //number
	// svelte-ignore unused-export-let
	export let branchRootNode = {};

	let dragenterTimestamp;
	//
	let canNestPos = false;
	let canNestTime = false;
	let canNest;
	let dragTimeout;
	let validTarget = false;
	let insPos;
	//if insert is disabled => nest right away and never nest if its disabled
	$: canNest =
		(highlightedNode?.[propNames.insertDisabled] ||
			canNestPos ||
			canNestTime) &&
		highlightedNode?.[propNames.nestDisabled] !== true;
	//
	let ctxMenu;

	const getNodeId = (node) => `${treeId}-${helper.path(node)}`;

	let helper = createTreeHelper(propNames);
	// get new helper when propNames change
	$: helper = createTreeHelper(propNames);

	// get children nodes
	function getChildren() {
		return helper.dragDrop.OrderByPriority(
			helper.getDirectChildren(
				filteredTree ?? tree,
				helper.path(branchRootNode)
			)
		);
	}

	//#region expansions

	function toggleExpansion(node, expanded) {
		helper.changeExpansion(tree, node, !expanded);

		//update expansion
		tree = tree;

		let val = node[propNames.expanded];

		//trigger callback if it is present and node has useCallback
		if (
			val &&
			expandCallback !== null &&
			node[propNames.useCallback] === true
		) {
			//console.log("calling callback");
			node[propNames.useCallback] = false;
			expandCallback(node)
				.then((val) => {
					tree = tree.concat(val);
				})
				.catch((reason) => {
					console.log("ERROR IN CALLBACK!!");
					console.log(reason);
				});
		}

		//expansion events
		dispatch("expansion", {
			node: node,
			value: val,
		});

		if (val) {
			dispatch("expanded", node);
		} else {
			dispatch("closed", node);
		}
	}

	export function changeAllExpansion(changeTo) {
		tree = helper.changeEveryExpansion(tree, changeTo);
	}

	function isExpanded(node, depth, expandTo) {
		const nodeExpanded = node[propNames.expanded];

		//if expanded prop is defined it has priority over expand to
		if (nodeExpanded !== undefined && nodeExpanded !== null) {
			if (nodeExpanded) {
			}
			return nodeExpanded;
		}
		return depth <= expandTo;
	}

	//#endregion

	//#region checkboxes

	// TODO maybe optimize and only compute visual tree for changed branches
	$: ComputeVisualTree(filteredTree);
	function ComputeVisualTree(filteredTree) {
		tree = helper.selection.computeInitialVisualStates(
			tree,
			filteredTree ?? tree
		);
	}

	//checkboxes
	function selectionChanged(node) {
		//console.log(nodePath);
		tree = helper.selection.changeSelection(
			recursive,
			tree,
			helper.path(node),
			filteredTree ?? tree
		);
		selectionEvents(node);
	}

	//fired when in recursive mode you click on Leaf node
	function selectChildren(node, checked) {
		tree = helper.selection.changeSelectedForChildren(
			tree,
			helper.path(node),
			!checked,
			filteredTree ?? tree
		);
		selectionEvents(node);
	}

	function selectionEvents(node) {
		let val = node[propNames.selected];
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
		// dont allos drag if is draggable is false
		if (node[propNames.isDraggable] === false) {
			e.preventDefault();
			return;
		}

		console.log("dragstart from: " + helper.path(node));

		e.dataTransfer.dropEffect = "move";
		e.dataTransfer.setData("node_id", helper.path(node));
		draggedPath = helper.path(node);
	}

	function handleDragDrop(e, node, el) {
		//should be necesary but just in case
		highlightedNode = null;
		if (readonly || !dragAndDrop) return;

		draggedPath = e.dataTransfer.getData("node_id");

		console.log(draggedPath + " dropped on: " + helper.path(node));

		//important to check if timetonest is set, otherwise you could spend 30 minutes fixing this shit :)
		if (timeToNest) {
			canNestTime =
				(dragenterTimestamp ? new Date() - dragenterTimestamp : 1) > timeToNest;
		}

		let newNode = helper.findNode(tree, draggedPath);

		let oldNode = { ...newNode };
		let oldParent = helper.findNode(
			tree,
			helper.getParentNodePath(draggedPath)
		);

		let insType = canNest ? 0 : helper.dragDrop.getInsertionPosition(e, el);

		//cancel move if its not valid
		if (insType == 0 && node[propNames.nestDisabled] === true) return;
		else if (
			(insType == -1 || insType == 1) &&
			node[propNames.insertDisabled] === true
		)
			return;

		//callback can cancell move
		if (
			beforeMovedCallback &&
			beforeMovedCallback(
				oldNode,
				oldParent,
				node,
				helper.dragDrop.huminifyInsType(insType)
			) === false
		)
			return;

		tree = helper.dragDrop.moveNode(
			tree,
			draggedPath,
			helper.path(node),
			insType,
			recalculateNodePath
		);

		let newParent =
			helper.findNode(tree, helper.getParentNodePath(helper.path(newNode))) ??
			null;

		dispatch("moved", {
			oldParent: oldParent,
			newParent: newParent,
			oldNode: oldNode,
			newNode: newNode,
			targetNode: node,
			insType: helper.dragDrop.huminifyInsType(insType),
		});

		//reset props
		dragenterTimestamp = null;
		draggedPath = null;
		highlightedNode = null;
	}

	function handleDragOver(e, node, el) {
		insPos = helper.dragDrop.getInsertionPosition(e, el);

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
			insPos = helper.dragDrop.getInsertionPosition(e, el);

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
				helper.path(node).startsWith(draggedPath) ||
				(node[propNames.insertDisabled] === true &&
					node[propNames.nestDisabled] === true)
			) {
				validTarget = false;
			}

			//if defined calling callback
			if (dragEnterCallback) {
				//get node for event
				let draggedNode = helper.findNode(tree, draggedPath);
				let oldParent = helper.findNode(
					tree,
					helper.getParentNodePath(draggedPath)
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
	function highlighThisNode(node, highlitedNode, validTarget) {
		return validTarget && helper.path(highlitedNode) == helper.path(node);
	}
	/**
	 * returns true, it should highlight nesting on this node
	 * @param node node
	 * @param highlitedNode highlited node
	 * @param validTarget valid target
	 * @param canNest can nest
	 */
	function highlightNesting(node, highlitedNode, validTarget, canNest) {
		return (
			canNest &&
			highlighThisNode(node, highlitedNode, validTarget) &&
			node[propNames.nestDisabled] !== true
		);
	}
	/**
	 * returns true, it should highlight nesting on this node
	 * @param node node
	 * @param highlitedNode highlited node
	 * @param validTarget valid target
	 * @param canNest can nest
	 */
	function highlightInsert(node, highlitedNode, validTarget, canNest) {
		return (
			!canNest &&
			highlighThisNode(node, highlitedNode, validTarget) &&
			node[propNames.insertDisabled] !== true
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
	tree = helper.selection.computeInitialVisualStates(
		tree,

		filteredTree ?? tree
	);

	$: tree, tree == null || tree == undefined ? (tree = []) : "";

	let liElements = [];
</script>

<ul
	class:show-lines={childDepth === 0 && enableVerticalLines}
	class:child-menu={childDepth > 0}
	class={childDepth === 0 ? treeClass : ""}
>
	{#each getChildren(tree, filteredTree) as node (getNodeId(node))}
		{@const nesthighlighed = highlightNesting(
			node,
			highlightedNode,
			validTarget,
			canNest
		)}
		{@const insertHighlighted = highlightInsert(
			node,
			highlightedNode,
			validTarget,
			canNest
		)}
		{@const expanded = isExpanded(node, childDepth, expandedLevel)}
		{@const hasChildren = node[propNames.hasChildren]}
		{@const draggable =
			!readonly && dragAndDrop && node[propNames.isDraggable] !== false}
		<li
			class:is-child={helper.nodePathIsChild(helper.path(node))}
			class:has-children={hasChildren}
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
			{#if insPos == 1 && insertHighlighted}
				<div class="insert-line-wrapper">
					<div class="insert-line {inserLineClass}" />
				</div>
			{/if}

			<div
				class="tree-item
				{nesthighlighed ? expandClass : ''}
				{nodeClass} {draggedPath == helper.path(node) ||
				helper.path(node)?.startsWith(draggedPath)
					? currentlyDraggedClass
					: ''}"
				class:div-has-children={hasChildren}
				class:hover={insertHighlighted || nesthighlighed}
				{draggable}
				on:dragstart={(e) => handleDragStart(e, node)}
				on:dragend={(e) => handleDragEnd(e, node)}
			>
				{#if hasChildren}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<span
						on:click={() =>
							toggleExpansion(node, expanded && !node[propNames.useCallback])}
					>
						<!-- use callback overrides expanded  -->
						<i
							class="far {expanded
								? expandedToggleClass
								: collapsedToggleClass}"
							class:fa-minus-square={expanded}
							class:fa-plus-square={!expanded || node[propNames.useCallback]}
						/>
					</span>
				{:else}
					<span />
				{/if}

				<Checkbox
					{checkboxes}
					{helper}
					{recursive}
					{node}
					{onlyLeafCheckboxes}
					{checkboxesDisabled}
					{readonly}
					on:select-children={({ detail: { node, checked } }) =>
						selectChildren(node, checked)}
					on:select={({ detail: node }) => selectionChanged(node)}
				/>
				<span class:pointer-cursor={draggable}>
					<slot {node} />
				</span>
			</div>

			{#if nesthighlighed}
				<div class="insert-line-wrapper">
					<div
						class="insert-line insert-line-child {inserLineClass} {inserLineNestClass}"
					/>
				</div>
			{/if}
			{#if expanded && hasChildren}
				<svelte:self
					branchRootNode={node}
					{treeId}
					{checkboxes}
					bind:tree
					bind:filteredTree
					{recursive}
					childDepth={childDepth + 1}
					let:node={nodeNested}
					{onlyLeafCheckboxes}
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
					{propNames}
					{recalculateNodePath}
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
					{readonly}
				>
					<slot node={nodeNested} />
				</svelte:self>
			{/if}
			{#if !expanded && hasChildren}
				<ul class:child-menu={childDepth > 0} />
			{/if}
			<!-- Show line if insering -->
			{#if insPos == -1 && insertHighlighted}
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
			.pointer-cursor
				cursor: grab

</style>
