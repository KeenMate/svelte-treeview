<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import {
		defaultCurrentlyDraggedClass,
		defaultExpandClass,
		defaultPropNames,
		defaultTreeClass
	} from './constants.js';

	import Checkbox from './Checkbox.svelte';
	import {
		checkboxesTypes,
		type CustomizableClasses,
		type InsertionType,
		type Node,
		type Props,
		type Tree
	} from '$lib/types.js';
	import type { TreeHelper } from '$lib/index.js';
	import type ContextMenu from '$lib/menu/ContextMenu.svelte';

	const dispatch = createEventDispatcher();

	export let helper: TreeHelper;

	export let tree: Node[]; //array of nodes with nodePath
	export let treeId: string; //string
	export let recursive = false; //bool
	export let checkboxes: checkboxesTypes = checkboxesTypes.none; //bool on of [all,perNode]
	//if true, will show checkboxes to elements with children
	//TODO make batter name
	export let onlyLeafCheckboxes = false; //bool
	//true = disabel hide = false
	export let checkboxesDisabled = false; //bool

	//will allow you to move nodes between nodes and reorder them
	export let dragAndDrop = false;

	export let enableVerticalLines = false;
	export let readonly = false;

	export let expandedLevel = 0;

	//* classes for customization of tree
	export let classes: CustomizableClasses;

	//* properties
	export let props: Partial<Props> = {};
	$: propNames = { ...defaultPropNames, ...props };

	//! DONT SET ONLY USED INTERNALLY
	//TODO use context instead
	//path of currently dragged node
	export let draggedPath: string | null = null;
	export let highlightedNode: Node = null;
	export let childDepth = 0; //number
	export let branchRootNode: Node | null = null;

	let canNest: boolean;
	let validTarget = false;
	let insPos: InsertionType;

	const getNodeId = (node: Node) => `${treeId}-${helper.path(node)}`;

	// get children nodes
	function getChildren(tree: Tree) {
		const directChildren = helper.getDirectChildren(tree, helper.path(branchRootNode));

		const orderedChildren = helper.dragDrop.OrderByPriority(directChildren);

		return orderedChildren;
	}

	function toggleExpansion(node: Node, expanded: boolean) {
		dispatch('internal-expand', { node: node, expanded: expanded });
	}

	function isExpanded(node: Node, depth: number, expandToDepth: number) {
		const nodeExpanded = helper.props.expanded(node);

		//if expanded prop is defined it has priority over expand to
		if (nodeExpanded !== undefined && nodeExpanded !== null) {
			return nodeExpanded;
		}
		return depth <= expandToDepth;
	}

	//checkboxes
	function selectionChanged(node: Node) {
		dispatch('internal-selectionChanged', { node: node });
	}

	//fired when in recursive mode you click on Leaf node
	function selectChildren(node: Node, checked: boolean) {
		// TODO unify with selectionChanged
		selectionChanged(node);
	}

	function handleDragStart(e: DragEvent, node: Node) {
		dispatch('internal-handleDragStart', { node: node, e: e });
	}

	function handleDragDrop(e: DragEvent, node: Node, el: HTMLElement) {
		dispatch('internal-handleDragStart', { node: node, event: e, element: el });
	}

	function handleDragOver(e: DragEvent, node: Node, el: HTMLElement) {
		dispatch('internal-handleDragOver', { node: node, event: e, element: el });
	}

	function handleDragEnter(e: DragEvent, node: Node, el: HTMLElement) {
		dispatch('internal-handleDragEnter', { node: node, event: e, element: el });
	}

	function handleDragEnd(e: DragEvent, node: Node) {
		dispatch('internal-handleDragEnd', { node: node, event: e });
	}

	function handleDragLeave(e: DragEvent, node: Node, el: HTMLElement) {
		dispatch('internal-handleDragLeave', { node: node, event: e, element: el });
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
			helper.props.nestDisabled(node) !== true
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
			helper.props.nestDisabled(node) !== true
		);
	}

	let liElements: { [key: string]: HTMLLIElement } = {};
</script>

<ul
	class:show-lines={childDepth === 0 && enableVerticalLines}
	class:child-menu={childDepth > 0}
	class={childDepth === 0 ? classes.treeClass : ''}
>
	{#each getChildren(tree) as node (getNodeId(node))}
		{@const nesthighlighed = highlightNesting(node, highlightedNode, validTarget, canNest)}
		{@const insertHighlighted = highlightInsert(node, highlightedNode, validTarget, canNest)}
		{@const expanded = isExpanded(node, childDepth, expandedLevel)}
		{@const hasChildren = helper.props.hasChildren(node)}
		{@const draggable = !readonly && dragAndDrop && helper.props.isDraggable(node)}
		{@const isCurrentlyDragged =
			draggedPath == helper.path(node) ||
			(draggedPath && helper.path(node)?.startsWith(draggedPath))}

		<li
			class:is-child={helper.nodePathIsChild(helper.path(node))}
			class:has-children={hasChildren}
			on:contextmenu|stopPropagation={(e) => {
				dispatch('open-ctxmenu', { e: e, node: Node });
			}}
			on:drop|stopPropagation={(e) => handleDragDrop(e, node, liElements[getNodeId(node)])}
			on:dragover|stopPropagation={(e) => handleDragOver(e, node, liElements[getNodeId(node)])}
			on:dragenter|stopPropagation={(e) => handleDragEnter(e, node, liElements[getNodeId(node)])}
			on:dragleave|stopPropagation={(e) => handleDragLeave(e, node, liElements[getNodeId(node)])}
			bind:this={liElements[getNodeId(node)]}
		>
			{#if insPos == 1 && insertHighlighted}
				<div class="insert-line-wrapper">
					<div class="insert-line {classes.inserLineClass}" />
				</div>
			{/if}

			<!-- svelte-ignore a11y-no-static-element-interactions -->
			<div
				class="tree-item
				{nesthighlighed ? classes.expandClass : ''}
				{classes.nodeClass} {isCurrentlyDragged ? classes.currentlyDraggedClass : ''}"
				class:div-has-children={hasChildren}
				class:hover={insertHighlighted || nesthighlighed}
				{draggable}
				on:dragstart={(e) => handleDragStart(e, node)}
				on:dragend={(e) => handleDragEnd(e, node)}
			>
				{#if hasChildren}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<span on:click={() => toggleExpansion(node, expanded && !helper.props.useCallback(node))}>
						<!-- use callback overrides expanded  -->
						<i
							class="far {expanded ? classes.expandedToggleClass : classes.collapsedToggleClass}"
							class:fa-minus-square={expanded}
							class:fa-plus-square={!expanded || helper.props.useCallback(node)}
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
					<div
						class="insert-line insert-line-child {classes.inserLineClass} {classes.inserLineNestClass}"
					/>
				</div>
			{/if}
			{#if expanded && hasChildren}
				<svelte:self
					branchRootNode={node}
					{treeId}
					{checkboxes}
					bind:tree
					{recursive}
					childDepth={childDepth + 1}
					let:node={nodeNested}
					{onlyLeafCheckboxes}
					{checkboxesDisabled}
					{expandedLevel}
					bind:draggedPath
					bind:dragAndDrop
					{props}
					bind:highlightedNode
					on:open-ctxmenu
					{helper}
					{classes}
					on:internal-expand
					on:internal-selectionChanged
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
					<div class="insert-line {classes.inserLineClass}" />
				</div>
			{/if}
		</li>
	{/each}
</ul>
