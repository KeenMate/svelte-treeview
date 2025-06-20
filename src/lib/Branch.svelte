https://svelte.dev/e/svelte_fragment_invalid_placement -->
<script lang="ts">
	import Branch from "./Branch.svelte"

	import Checkbox from "./Checkbox.svelte"
	import {type CustomizableClasses, InsertionType, type Node, SelectionModes} from "$lib/types.js"
	import type {TreeHelper} from "$lib/helpers/tree-helper.js"
	import {capturedKeys} from "$lib/constants.js"

	interface Props {
		tree: Node[];
		treeId: string;
		recursive?: boolean;
		checkboxes?: SelectionModes;
		onlyLeafCheckboxes: boolean;
		hideDisabledCheckboxes: boolean;
		dragAndDrop: boolean;
		verticalLines: boolean;
		readonly: boolean;
		expandTo: number;
		classes: CustomizableClasses;
		helper: TreeHelper;
		childDepth: number;
		branchRootNode: Node | null;
		draggedNode: Node | null;
		highlightedNode: Node | null;
		insertionType: InsertionType;
		focusedNode: Node | null;
		allowKeyboardNavigation: boolean;

		onOpenCtxmenu?: () => void

		internal_onExpand?: () => void
		internal_onSelectionChanged?: () => void
		internal_onHandleDragStart?: () => void
		internal_onHandleDragDrop?: () => void
		internal_onHandleDragOver?: () => void
		internal_onHandleDragEnter?: () => void
		internal_onHandleDragEnd?: () => void
		internal_onHandleDragLeave?: () => void
		internal_onKeypress?: () => void

		children?: import("svelte").Snippet<[any]>;
		nestHighlight?: import("svelte").Snippet;
	}

	let {
		    tree,
		    treeId,
		    recursive                   = false,
		    checkboxes                  = SelectionModes.none,
		    onlyLeafCheckboxes,
		    hideDisabledCheckboxes,
		    dragAndDrop,
		    verticalLines,
		    readonly,
		    expandTo,
		    classes,
		    helper,
		    childDepth,
		    branchRootNode,
		    draggedNode,
		    highlightedNode,
		    insertionType,
		    focusedNode,
		    allowKeyboardNavigation,
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

	let liElements: { [key: string]: HTMLLIElement } = $state({})

	const getNodeId    = (node: Node) => `${treeId}-${node.path}`
	let directChildren = $derived(helper.getDirectChildren(tree, branchRootNode?.path ?? null))

	$effect(() => {
		if (focusedNode && liElements[getNodeId(focusedNode)]) {
			liElements[getNodeId(focusedNode)].focus()
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
		internal_onHandleDragStart?.({node: node, e: e})
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
	class:show-lines={childDepth === 0 && verticalLines}
	class:child-menu={childDepth > 0}
	class={childDepth === 0 ? classes.treeClass : ''}
>
	<!-- TODO fix accessibility -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	{#each directChildren as node (getNodeId(node))}
		{@const expanded = isExpanded(node, childDepth, expandTo)}
		{@const draggable = !readonly && dragAndDrop && !node.dragDisabled}
		{@const isCurrentlyDragged = draggedNode && node.path.startsWith(draggedNode?.path)}
		{@const effectiveHighlight = getHighlighMode(node, highlightedNode, insertionType)}
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<li
			class:is-child={helper.nodePathIsChild(node.path)}
			class:has-children={node.hasChildren}
			oncontextmenu={e => onContextMenu(e, node)}
			ondrop={e => handleDragDrop(e, node, liElements[getNodeId(node)])}
			ondragover={e => handleDragOver(e, node, liElements[getNodeId(node)], false)}
			ondragenter={e => handleDragEnter(e, node, liElements[getNodeId(node)])}
			ondragleave={e => handleDragLeave(e, node, liElements[getNodeId(node)])}
			bind:this={liElements[getNodeId(node)]}
			onkeydown={(e) => handleKeyPress(e, node)}
			tabindex={allowKeyboardNavigation ? 1 : -1}
		>
			{#if effectiveHighlight == InsertionType.insertAbove}
				<div class="insert-line-wrapper">
					<div class="insert-line {classes.insertLineClass}"></div>
				</div>
			{/if}

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="tree-item
				{effectiveHighlight === InsertionType.nest ? classes.expandClass : ''}
				{classes.nodeClass} {isCurrentlyDragged ? classes.currentlyDraggedClass : ''}"
				class:div-has-children={node.hasChildren}
				class:hover={effectiveHighlight !== InsertionType.none}
				{draggable}
				ondragstart={(e) => handleDragStart(e, node)}
				ondragend={(e) => handleDragEnd(e, node)}
			>
				{#if node.hasChildren}
					<button
						class="expansion-button arrow"
						onclick={() => setExpansion(node, !expanded)}
						type="button"
						tabindex="-1"
					>
						<i class="fixed-icon arrow {expanded ? classes.collapseIcon : classes.expandIcon}"></i>
					</button>
				{:else}
					<span class="fixed-icon"></span>
				{/if}

				<Checkbox
					{checkboxes}
					{recursive}
					{node}
					{onlyLeafCheckboxes}
					{hideDisabledCheckboxes}
					{readonly}
					on:select={({ detail: { node } }) => selectionChanged(node)}
				/>
				<span class:pointer-cursor={draggable}>
					{@render children?.({node: node.originalNode,})}
				</span>

				{#if dragAndDrop && node.nestAllowed}
					<span
						ondragover={e => handleDragOver(e, node, liElements[getNodeId(node)], true)}
					>
						<i class="fixed-icon {classes.nestIcon}"></i>

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
					{treeId}
					{checkboxes}
					{tree}
					{recursive}
					{helper}
					{classes}
					{readonly}
					{onlyLeafCheckboxes}
					{hideDisabledCheckboxes}
					{expandTo}
					{dragAndDrop}
					{verticalLines}
					{draggedNode}
					{highlightedNode}
					{insertionType}
					{focusedNode}
					{allowKeyboardNavigation}
					on:open-ctxmenu
					on:internal-expand
					on:internal-selectionChanged
					on:internal-handleDragStart
					on:internal-handleDragDrop
					on:internal-handleDragOver
					on:internal-handleDragEnter
					on:internal-handleDragEnd
					on:internal-handleDragLeave
					on:internal-keypress
					
				>
					{#snippet children({ node: nodeNested })}
										{@render children?.({node: nodeNested,})}
						<!--<svelte:fragment slot="nest-highlight">-->
						<!--	<slot name="nest-highlight" />-->
						<!--</svelte:fragment>-->
														{/snippet}
								</Branch>
			{/if}
			{#if !expanded && node.hasChildren}
				<ul class:child-menu={childDepth > 0}></ul>
			{/if}
			<!-- Show line if insering -->
			{#if effectiveHighlight === InsertionType.insertBelow}
				<div class="insert-line-wrapper">
					<div class="insert-line {classes.insertLineClass}"></div>
				</div>
			{/if}
		</li>
	{/each}
</ul>
