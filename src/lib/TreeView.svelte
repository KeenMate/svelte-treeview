<script lang="ts">
	import ContextMenu from './menu/ContextMenu.svelte';
	import { createEventDispatcher, onMount } from 'svelte';
	import {
		defaultCurrentlyDraggedClass,
		defaultExpandClass,
		defaultPixelTreshold,
		defaultPropNames,
		defaultTreeClass
	} from './constants.js';

	import Checkbox from './Checkbox.svelte';
	import {
		checkboxesTypes,
		type InsertionType,
		type Node,
		type Props,
		type Tree
	} from '$lib/types.js';
	import { TreeHelper } from '$lib/index.js';

	const dispatch = createEventDispatcher();

	//! required
	type node = any;
	type dragEnterCallback = (draggendNode: node, oldParent: node, newParent: node) => boolean;
	type beforeMovedCallback = (
		draggendNode: node,
		oldParent: node,
		newParent: node,
		insertionType: string
	) => boolean;
	type expandedCallback = (node: node) => Promise<node[]>;

	export let tree: node[]; //array of nodes with nodePath
	export let treeId: string; //string
	//!user set
	//tree that will be rendered(will be same as tree if null)
	export let filteredTree: Tree | null = null; //array of nodes with nodePath
	export let recursive = false; //bool
	export let checkboxes: checkboxesTypes = checkboxesTypes.none; //bool on of [all,perNode]
	//if true, will show checkboxes to elements with children
	//TODO make batter name
	export let onlyLeafCheckboxes = false; //bool
	//true = disabel hide = false
	export let checkboxesDisabled = false; //bool

	//will allow you to move nodes between nodes and reorder them
	export let dragAndDrop = false; //bool
	//will nest of at least one of them is meet
	export let timeToNest: number | null = null;
	export let pixelNestTreshold = defaultPixelTreshold;
	//change to false when last segment of nodePath is Guaranteed to be unqiue
	export let recalculateNodePath = true;
	//callback for dynamically disabling drop on specific node
	export let dragEnterCallback: dragEnterCallback | null = null;
	export let beforeMovedCallback: beforeMovedCallback | null = null;

	export let showContexMenu = false;
	export let enableVerticalLines = false;
	export let readonly = false;
	export let separator = '.';

	export let expandedLevel = 0;
	export let expandCallback: expandedCallback | null = null;

	//* classes for customization of tree
	export let treeClass: string = defaultTreeClass;
	export let nodeClass: string = '';
	export let expandedToggleClass: string = '';
	export let collapsedToggleClass: string = '';
	export let expandClass: string = defaultExpandClass;
	export let inserLineClass: string = '';
	export let inserLineNestClass: string = '';
	export let currentlyDraggedClass: string = defaultCurrentlyDraggedClass;

	//* properties
	export let props: Partial<Props> = {};
	$: propNames = { ...defaultPropNames, ...props };

	//! DONT SET ONLY USED INTERNALLY
	//TODO use context instead
	//path of currently dragged node
	export let draggedPath: string | null = null;
	export let highlightedNode: node = null;
	export let childDepth = 0; //number
	export let branchRootNode: node | null = null;

	let dragenterTimestamp: Date | null = null;
	//
	let canNestPos = false;
	let canNestTime = false;
	let canNest: boolean;
	let dragTimeout: NodeJS.Timeout;
	let validTarget = false;
	let insPos: InsertionType;
	let ctxMenu: ContextMenu;

	// ensure tree is never null
	// $: tree, tree == null || tree == undefined ? (tree = []) : '';

	// get new helper when propNames change
	$: config = {
		recursive,
		recalculateNodePath,
		checkboxes,
		separator
	};
	$: helper = new TreeHelper(propNames, config);

	$: console.log('TreeView - tree', tree);
	$: tree = computeVisualTree(tree, filteredTree);

	//if insert is disabled => nest right away and never nest if its disabled

	$: canNest =
		(highlightedNode?.[propNames.insertDisabled] || canNestPos || canNestTime) &&
		highlightedNode?.[propNames.nestDisabled] !== true;

	const getNodeId = (node: node) => `${treeId}-${helper.path(node)}`;

	// get children nodes
	function getChildren(tree: Tree, filteredTree: Tree | null) {
		const directChildren = helper.getDirectChildren(
			filteredTree ?? tree,
			helper.path(branchRootNode)
		);

		const orderedChildren = helper.dragDrop.OrderByPriority(directChildren);

		return orderedChildren;
	}

	//#region expansions

	function toggleExpansion(node: node, expanded: boolean) {
		helper.changeExpansion(tree, node, !expanded);

		//update expansion
		tree = tree;

		let isAlreadyExpanded = node[propNames.expanded];

		//trigger callback if it is present and node has useCallback
		if (isAlreadyExpanded && expandCallback !== null && node[propNames.useCallback] === true) {
			//console.log("calling callback");
			node[propNames.useCallback] = false;
			expandCallback(node)
				.then((newTreeNodes: node[]) => {
					tree = tree.concat(newTreeNodes);
				})
				.catch((reason) => {
					console.log('ERROR IN CALLBACK!!');
					console.log(reason);
				});
		}

		//expansion events
		dispatch('expansion', {
			node: node,
			value: isAlreadyExpanded
		});

		if (isAlreadyExpanded) {
			dispatch('expanded', node);
		} else {
			dispatch('closed', node);
		}
	}

	export function changeAllExpansion(changeTo: boolean) {
		tree = helper.changeEveryExpansion(tree, changeTo);
	}

	function isExpanded(node: node, depth: number, expandToDepth: number) {
		const nodeExpanded = node[propNames.expanded];

		//if expanded prop is defined it has priority over expand to
		if (nodeExpanded !== undefined && nodeExpanded !== null) {
			return nodeExpanded;
		}
		return depth <= expandToDepth;
	}

	function computeVisualTree(_tree: Tree, _filteredTree: Tree | null): Tree {
		if (checkboxes === checkboxesTypes.none) {
			// no point in computing something we wont show
			return _tree;
		}

		console.log('computing visual tree ', branchRootNode?.[propNames.nodePath], {
			_tree,
			_filteredTree
		});
		return helper.selection.computeInitialVisualStates(_tree, _filteredTree ?? _tree);
	}

	//checkboxes
	function selectionChanged(node: node) {
		//console.log(nodePath);
		tree = helper.selection.changeSelection(tree, helper.path(node), filteredTree ?? tree);
		selectionEvents(node);
	}

	//fired when in recursive mode you click on Leaf node
	function selectChildren(node: node, checked: boolean) {
		tree = helper.selection.changeSelectedForChildren(
			tree,
			helper.path(node),
			!checked,
			filteredTree ?? tree
		);
		selectionEvents(node);
	}

	function selectionEvents(node: node) {
		let val = node[propNames.selected];
		dispatch('selection', {
			node: node,
			value: val
		});

		if (val) {
			dispatch('selected', node);
		} else {
			dispatch('unselected', node);
		}
	}

	function handleDragStart(e: DragEvent, node: node) {
		// dont allos drag if is draggable is false
		if (node[propNames.isDraggable] === false) {
			e.preventDefault();
			return;
		}

		console.log('dragstart from: ' + helper.path(node));
		//@ts-ignore
		e.dataTransfer.dropEffect = 'move';
		//@ts-ignore
		e.dataTransfer.setData('node_id', helper.path(node));
		draggedPath = helper.path(node);
	}

	function handleDragDrop(e: DragEvent, node: node, el: HTMLElement) {
		//should be necesary but just in case
		highlightedNode = null;
		if (readonly || !dragAndDrop) return;

		//@ts-ignore
		draggedPath = e.dataTransfer.getData('node_id');

		console.log(draggedPath + ' dropped on: ' + helper.path(node));

		//important to check if timetonest is set, otherwise you could spend 30 minutes fixing this shit :)
		if (timeToNest) {
			const nowTimestamp = new Date();
			canNestTime =
				(dragenterTimestamp ? nowTimestamp.getTime() - dragenterTimestamp.getTime() : 1) >
				timeToNest;
		}

		let newNode = helper.findNode(tree, draggedPath);

		let oldNode = { ...newNode };
		let oldParent = helper.findNode(tree, helper.getParentNodePath(draggedPath));

		let insType = canNest ? 0 : helper.dragDrop.getInsertionPosition(e, el);

		//cancel move if its not valid
		if (insType == 0 && node[propNames.nestDisabled] === true) return;
		else if ((insType == -1 || insType == 1) && node[propNames.insertDisabled] === true) return;

		//callback can cancell move
		if (
			beforeMovedCallback &&
			beforeMovedCallback(oldNode, oldParent, node, helper.dragDrop.huminifyInsType(insType)) ===
				false
		)
			return;

		tree = helper.dragDrop.moveNode(
			tree,
			draggedPath,
			helper.path(node),
			insType,
			recalculateNodePath
		);

		let newParent = helper.findNode(tree, helper.getParentNodePath(helper.path(newNode))) ?? null;

		dispatch('moved', {
			oldParent: oldParent,
			newParent: newParent,
			oldNode: oldNode,
			newNode: newNode,
			targetNode: node,
			insType: helper.dragDrop.huminifyInsType(insType)
		});

		//reset props
		dragenterTimestamp = null;
		draggedPath = null;
		highlightedNode = null;
	}

	function handleDragOver(e: DragEvent, node: Node, el: HTMLElement) {
		insPos = helper.dragDrop.getInsertionPosition(e, el);

		//if you are further away from right then treshold allow nesting
		// @ts-ignore
		let diff = e.x - e.target?.getBoundingClientRect()?.x;
		if (pixelNestTreshold && diff > pixelNestTreshold) {
			canNestPos = true;
		} else {
			canNestPos = false;
		}

		//allow drop if valid target
		if (validTarget) e.preventDefault();
	}

	function handleDragEnter(e: DragEvent, node: Node, el: HTMLElement) {
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
				helper.path(node).startsWith(draggedPath ?? '') ||
				(node[propNames.insertDisabled] === true && node[propNames.nestDisabled] === true)
			) {
				validTarget = false;
			}

			//if defined calling callback
			if (dragEnterCallback) {
				//get node for event
				let draggedNode = helper.findNode(tree, draggedPath ?? '');
				let oldParent = helper.findNode(tree, helper.getParentNodePath(draggedPath ?? ''));

				//callback returning false means that it isnt valid target
				if (dragEnterCallback(draggedNode, oldParent, node) === false) {
					validTarget = false;
				}
			}
		}, 1);
		e.preventDefault();
	}

	function handleDragEnd(e: DragEvent, node: Node) {
		//reset prop on next tick
		setTimeout(() => {
			draggedPath = null;
			highlightedNode = null;
		}, 1);
	}

	function handleDragleave(e: DragEvent, node: Node, el: HTMLElement) {
		// highlightedNode = null;
	}
	/**
	 *check if this node is one being hovered over (highlited) and is valid target
	 */
	function highlighThisNode(node: Node, highlitedNode: Node, validTarget: boolean) {
		return validTarget && helper.path(highlitedNode) == helper.path(node);
	}
	/**
	 * returns true, it should highlight nesting on this node
	 * @param node node
	 * @param highlitedNode highlited node
	 * @param validTarget valid target
	 * @param canNest can nest
	 */
	function highlightNesting(
		node: Node,
		highlitedNode: Node,
		validTarget: boolean,
		canNest: boolean
	) {
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
	function highlightInsert(
		node: Node,
		highlitedNode: Node,
		validTarget: boolean,
		canNest: boolean
	) {
		return (
			!canNest &&
			highlighThisNode(node, highlitedNode, validTarget) &&
			node[propNames.insertDisabled] !== true
		);
	}

	function openContextMenu(e: MouseEvent, node: Node) {
		if (!showContexMenu) return;
		e.preventDefault();
		ctxMenu.onRightClick(e, node);
	}

	//computes all visual states when component is first created

	// onMount(() => {
	// 	tree = computeVisualTree(tree, filteredTree);
	// });

	let liElements: { [key: string]: HTMLLIElement } = {};
</script>

<ul
	class:show-lines={childDepth === 0 && enableVerticalLines}
	class:child-menu={childDepth > 0}
	class={childDepth === 0 ? treeClass : ''}
>
	{#each getChildren(tree, filteredTree) as node (getNodeId(node))}
		{@const nesthighlighed = highlightNesting(node, highlightedNode, validTarget, canNest)}
		{@const insertHighlighted = highlightInsert(node, highlightedNode, validTarget, canNest)}
		{@const expanded = isExpanded(node, childDepth, expandedLevel)}
		{@const hasChildren = node[propNames.hasChildren]}
		{@const draggable = !readonly && dragAndDrop && node[propNames.isDraggable] !== false}
		<li
			class:is-child={helper.nodePathIsChild(helper.path(node))}
			class:has-children={hasChildren}
			on:contextmenu|stopPropagation={(e) => {
				childDepth == 0 ? openContextMenu(e, node) : dispatch('open-ctxmenu', { e: e, node: node });
			}}
			on:drop|stopPropagation={(e) => handleDragDrop(e, node, liElements[getNodeId(node)])}
			on:dragover|stopPropagation={(e) => handleDragOver(e, node, liElements[getNodeId(node)])}
			on:dragenter|stopPropagation={(e) => handleDragEnter(e, node, liElements[getNodeId(node)])}
			on:dragleave|stopPropagation={(e) => handleDragleave(e, node, liElements[getNodeId(node)])}
			bind:this={liElements[getNodeId(node)]}
		>
			{#if insPos == 1 && insertHighlighted}
				<div class="insert-line-wrapper">
					<div class="insert-line {inserLineClass}" />
				</div>
			{/if}

			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="tree-item
				{nesthighlighed ? expandClass : ''}
				{nodeClass} {draggedPath == helper.path(node) ||
				(draggedPath && helper.path(node)?.startsWith(draggedPath))
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
					<span on:click={() => toggleExpansion(node, expanded && !node[propNames.useCallback])}>
						<!-- use callback overrides expanded  -->
						<i
							class="far {expanded ? expandedToggleClass : collapsedToggleClass}"
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
					on:select-children={({ detail: { node, checked } }) => selectChildren(node, checked)}
					on:select={({ detail: node }) => selectionChanged(node)}
				/>
				<span class:pointer-cursor={draggable}>
					<slot {node} />
				</span>
			</div>

			{#if nesthighlighed}
				<div class="insert-line-wrapper">
					<div class="insert-line insert-line-child {inserLineClass} {inserLineNestClass}" />
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
					{props}
					{recalculateNodePath}
					bind:highlightedNode
					bind:timeToNest
					bind:pixelNestTreshold
					on:open-ctxmenu={(data) => {
						childDepth == 0
							? openContextMenu(data.detail.e, data.detail.node)
							: dispatch('open-ctxmenu', data.detail);
					}}
					{expandCallback}
					on:moved
					{beforeMovedCallback}
					{dragEnterCallback}
					{readonly}
					{separator}
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
	@import "./tree-styles.sass"
</style>
