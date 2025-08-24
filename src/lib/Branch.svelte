<script lang="ts">
	import Branch from "./Branch.svelte"
	import Checkbox from "./Checkbox.svelte"
	import {
		type DraggableContext,
		InsertionType,
		type Node,
		type TreeConfig, type TreeState
	} from "$lib/types.js"
	import {capturedKeys} from "$lib/constants.js"
	import {getContext} from "svelte"
	import type {Writable} from "svelte/store"
	import type {VolatileTreeConfig} from "./types.js"

	interface Props {
		// tree: Node[];
		// treeId: string;
		// recursive?: boolean;
		// checkboxes?: SelectionModes;
		// onlyLeafCheckboxes: boolean;
		// hideDisabledCheckboxes: boolean;
		// dragMode: DragMode;
		// verticalLines: boolean;
		// readonly: boolean;
		// expandTo: number;
		// classes: CustomizableClasses;
		// helper: TreeHelper;
		// allowKeyboardNavigation: boolean;
		childDepth: number;
		branchRootNode: Node | null;

		onOpenCtxmenu?: () => void

		internal_onExpand?: ({node: any, changeTo: boolean}) => void
		internal_onSelectionChanged?: ({node: any}) => void
		internal_onHandleDragStart?: ({node: any, event: any}) => void
		internal_onHandleDragDrop?: ({node: any, event: any, element: any}) => void
		internal_onHandleDragOver?: ({node: any, event: any, element: any, nest: any}) => void
		internal_onHandleDragEnter?: ({node: any, event: any, element: any}) => void
		internal_onHandleDragEnd?: ({node: any, event: any}) => void
		internal_onHandleDragLeave?: ({node: any, event: any, element: any}) => void
		internal_onKeypress?: ({node: any, event: any}) => void

		children?: import("svelte").Snippet<[any]>;
		nestHighlight?: import("svelte").Snippet;
	}

	let {
		    // tree,
		    // treeId,
		    // recursive                   = false,
		    // checkboxes                  = SelectionModes.none,
		    // onlyLeafCheckboxes,
		    // hideDisabledCheckboxes,
		    // dragMode,
		    // verticalLines,
		    // readonly,
		    // expandTo,
		    // classes,
		    // helper,
		    childDepth,
		    branchRootNode,
		    // draggedNode,
		    // highlightedNode,
		    // insertionType,
		    // focusedNode,
		    // allowKeyboardNavigation,
		    onOpenCtxmenu = undefined,

		    internal_onExpand           = undefined,
		    internal_onSelectionChanged = undefined,
		    internal_onHandleDragStart  = undefined,
		    internal_onHandleDragDrop   = undefined,
		    internal_onHandleDragOver   = undefined,
		    internal_onHandleDragEnter  = undefined,
		    internal_onHandleDragEnd    = undefined,
		    internal_onHandleDragLeave  = undefined,
		    internal_onKeypress         = undefined,

		    children,
		    nestHighlight
	    }: Props = $props()

	const volatileTreeConfig: Writable<VolatileTreeConfig> = getContext("volatileTreeConfig")
	const treeConfig: Writable<TreeConfig> = getContext("treeConfig")
	const treeState: Writable<TreeState> = getContext("treeState")
	const draggedContext: Writable<DraggableContext> = getContext("draggedContext")

	let liElements: { [key: string]: HTMLLIElement } = $state({})

	const getNodeId    = (node: Node) => `${$treeConfig.treeId}-${node.path}`
	let directChildren = $derived($treeState.helper.getDirectChildren($treeState.computedTree, branchRootNode?.path ?? null))

	$effect(() => {
		if ($treeState.focusedNode && liElements[getNodeId($treeState.focusedNode)]) {
			liElements[getNodeId($treeState.focusedNode)].focus()
		}
	})

	function setExpansion(node: Node, changeTo: boolean) {
		internal_onExpand?.({node: node, changeTo})
	}

	function isExpanded(node: Node, depth: number, expandToDepth: number) {
		const nodeExpanded = node.expanded

		//if expanded prop is defined it has priority over expand to
		if (nodeExpanded === null) {
			return depth <= expandToDepth
		}
		return nodeExpanded
	}

	//checkboxes
	function selectionChanged(node: Node) {
		internal_onSelectionChanged?.({node: node})
	}

	// drag and drop
	function handleDragStart(e: DragEvent, node: Node) {
		internal_onHandleDragStart?.({node: node, event: e})
	}

	function handleDragDrop(e: DragEvent, node: Node, el: HTMLElement) {
		e.stopImmediatePropagation()
		internal_onHandleDragDrop?.({node: node, event: e, element: el})
	}

	function handleDragOver(e: DragEvent, node: Node, el: HTMLElement, nest: boolean) {
		e.stopImmediatePropagation()
		internal_onHandleDragOver?.({node: node, event: e, element: el, nest})
	}

	function handleDragEnter(e: DragEvent, node: Node, el: HTMLElement) {
		e.stopImmediatePropagation()
		internal_onHandleDragEnter?.({node: node, event: e, element: el})
	}

	function handleDragEnd(e: DragEvent, node: Node) {
		e.stopImmediatePropagation()
		internal_onHandleDragEnd?.({node: node, event: e})
	}

	function handleDragLeave(e: DragEvent, node: Node, el: HTMLElement) {
		e.stopImmediatePropagation()
		internal_onHandleDragLeave?.({node: node, event: e, element: el})
	}

	function handleKeyPress(e: KeyboardEvent, node: Node) {
		if (!capturedKeys.includes(e.key)) {
			return
		}

		e.preventDefault()
		e.stopPropagation()

		internal_onKeypress?.({event: e, node})
	}

	function getHighlighMode(
		node: Node,
		highlightedNode: Node | null,
		insertionType: InsertionType
	): InsertionType {
		// return InsertionType.insertAbove;

		if (highlightedNode?.path !== node.path) {
			return InsertionType.none
		}
		return insertionType
	}

	function onContextMenu(ev: Event, node: any) {
		ev.stopImmediatePropagation()
		onOpenCtxmenu({ev, node})
	}
</script>

<ul
	class:show-lines={childDepth === 0 && $treeConfig.verticalLines}
	class:child-menu={childDepth > 0}
	class={childDepth === 0 ? $volatileTreeConfig.cssClasses.treeClass : ''}
>
	<!-- TODO fix accessibility -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	{#each directChildren as node (getNodeId(node))}
		{@const expanded = isExpanded(node, childDepth, $treeConfig.expandTo)}
		{@const draggable = !$volatileTreeConfig.readonly && ($treeConfig.dragMode && $treeConfig.dragMode !== "drag_target") && !node.dragDisabled}
		{@const isCurrentlyDragged = $draggedContext?.node && node.path.startsWith($draggedContext.node.path)}
		{@const effectiveHighlight = getHighlighMode(node, $treeState.highlightedNode, $treeConfig.insertionType)}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<li
			class:is-child={$treeState.helper.nodePathIsChild(node.path)}
			class:has-children={node.hasChildren}
			oncontextmenu={e => onContextMenu(e, node)}
			ondrop={e => handleDragDrop(e, node, liElements[getNodeId(node)])}
			ondragover={e => handleDragOver(e, node, liElements[getNodeId(node)], false)}
			ondragenter={e => handleDragEnter(e, node, liElements[getNodeId(node)])}
			ondragleave={e => handleDragLeave(e, node, liElements[getNodeId(node)])}
			bind:this={liElements[getNodeId(node)]}
			onkeydown={(e) => handleKeyPress(e, node)}
			tabindex={$treeConfig.allowKeyboardNavigation ? 1 : -1}
		>
			{#if effectiveHighlight == InsertionType.insertAbove}
				<div class="insert-line-wrapper">
					<div class="insert-line {$volatileTreeConfig.cssClasses.insertLineClass}"></div>
				</div>
			{/if}

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="tree-item
				{effectiveHighlight === InsertionType.nest ? $volatileTreeConfig.cssClasses.expandClass : ''}
				{$volatileTreeConfig.cssClasses.nodeClass} {isCurrentlyDragged ? $volatileTreeConfig.cssClasses.currentlyDraggedClass : ''}"
				class:div-has-children={node.hasChildren}
				class:hover={effectiveHighlight !== InsertionType.none}
				{draggable}
				ondragstart={(e) => handleDragStart(e, node)}
				ondragend={(e) => handleDragEnd(e, node)}
			>
				{#if node.hasChildren}
					<button
						class="expansion-button arrow"
						type="button"
						tabindex="-1"
						onclick={() => setExpansion(node, !expanded)}
					>
						<i class="fixed-icon arrow {expanded ? $volatileTreeConfig.cssClasses.collapseIcon : $volatileTreeConfig.cssClasses.expandIcon}"></i>
					</button>
				{:else}
					<span class="fixed-icon"></span>
				{/if}

				<Checkbox
					checkboxes={$treeConfig.selectionMode}
					recursive={$treeConfig.recursiveSelection}
					{node}
					onlyLeafCheckboxes={$treeConfig.onlyLeafCheckboxes}
					hideDisabledCheckboxes={$treeConfig.hideDisabledCheckboxes}
					readonly={$volatileTreeConfig.readonly}
					on:select={({ detail: { node } }) => selectionChanged(node)}
				/>
				<span class:pointer-cursor={draggable}>
					{@render children?.({node: node.originalNode,})}
				</span>

				{#if $treeConfig.dragMode && $treeConfig.dragMode !== "drag_target" && node.nestAllowed}
					<span
						ondragover={e => handleDragOver(e, node, liElements[getNodeId(node)], true)}
					>
						<i class="fixed-icon {$volatileTreeConfig.cssClasses.nestIcon}"></i>

						{#if effectiveHighlight === InsertionType.nest}
							{@render nestHighlight?.()}
						{/if}
					</span>
				{/if}
			</div>
			{#if expanded && node.hasChildren}
				<Branch
					branchRootNode={node}
					childDepth={childDepth + 1}
					{children}
					{nestHighlight}
					{onOpenCtxmenu}
					{internal_onExpand}
					{internal_onSelectionChanged}
					{internal_onHandleDragStart}
					{internal_onHandleDragDrop}
					{internal_onHandleDragOver}
					{internal_onHandleDragEnter}
					{internal_onHandleDragEnd}
					{internal_onHandleDragLeave}
					{internal_onKeypress}
				/>
			{/if}
			{#if !expanded && node.hasChildren}
				<ul class:child-menu={childDepth > 0}></ul>
			{/if}
			<!-- Show line if inserting -->
			{#if effectiveHighlight === InsertionType.insertBelow}
				<div class="insert-line-wrapper">
					<div class="insert-line {$volatileTreeConfig.cssClasses.insertLineClass}"></div>
				</div>
			{/if}
		</li>
	{/each}
</ul>
