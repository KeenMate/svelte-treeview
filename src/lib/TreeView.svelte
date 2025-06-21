<script lang="ts">
	import ContextMenu from "./menu/ContextMenu.svelte"
	import {defaultClasses, defaultPropNames} from "./constants.js"
	import {
		type CustomizableClasses,
		type DragEnterCallback,
		type ExpandedCallback,
		type FilterFunction,
		InsertionType,
		type Node,
		type NodeId,
		type NodeSorter,
		type TreeProps,
		type ProvidedTree,
		SelectionModes as SelectionModes,
		type Tree
	} from "$lib/types.js"
	import {TreeHelper} from "$lib/index.js"
	import Branch from "./Branch.svelte"
	import {SelectionProvider} from "$lib/providers/selection-provider.js"
	import {DragDropProvider} from "$lib/providers/drag-drop-provider.js"
	import uniq from "lodash.uniq"
	import {calculateNewFocusedNode, parseMovementDirection} from "$lib/providers/movement-provider.js"

	interface Props {
		treeId: string;
		/**
		 * Array of nodes that represent tree structure.
		 * Each node should have unique path
		 * All tree modifications are made by modifying this array, so you need to bind it to parent component
		 */
		tree: ProvidedTree;
		/**
		 * Node paths of selected nodes
		 */
		value?: NodeId[];
		/**
		 * Object properties where information about node is stored
		 */
		treeProps?: Partial<TreeProps>;
		/**
		 * Show vertical lines as visual guide
		 */
		verticalLines?: boolean;
		/**
		 * Disables drag and drop and selection, expansion is still allowed
		 */
		readonly?: boolean;
		/**
		 * Separator used to parse paths. It is used for getting node depth and getting parent node.
		 * Default is '.'.
		 */
		separator?: string;
		/**
		 * only leaf nodes can be selected, non-leaf nodes only select/deselect its children.
		 * Their visual state is calculated based on their children
		 * If you set selected on non-leaf node, it will be ignored and may be deleted
		 */
		recursiveSelection?: boolean;
		/**
		 * Controls if checkboxes are shown and how they behave. Default is none
		 * TODO write about all the different modes
		 * TODO find better name
		 */
		selectionMode?: SelectionModes;
		/**
		 * By default, in recursive mode, non-leaf checkboxes will select/deselect all its children
		 * If you set this to true, this behavior will be disabled and only leaf nodes will be selectable
		 */
		onlyLeafCheckboxes?: boolean; //bool
		/**
		 * Instead of showing disabled checkboxes, show blank space
		 */
		hideDisabledCheckboxes?: boolean; //bool
		/**
		 * Function that will be caged when node is expanded and useCallback is set to true
		 * It should return array of nodes that will be added to tree
		 * If it throws error, node will be collapsed,
		 * but user will be able to open it again and callback will be called
		 */
		loadChildrenAsync?: ExpandedCallback | null;
		/**
		 * Show context menu on right click.
		 * Its defined in slot context-menu
		 */
		showContextMenu?: boolean;
		/**
		 * Automatically expand nodes to this level,
		 * any user made expansion will override this.
		 */
		expandTo?: number;
		/**
		 * Threshold for automatic expansion. If tree has less or equal nodes than this value,
		 * all nodes will be expanded. Default is 0, which means no automatic expansion
		 */
		expansionThreshold?: number;
		/**
		 * Classes used in tree. You can override default classes with this prop.
		 * It is recommended to use default classes and add additional styles in your css
		 */
		customClasses?: Partial<CustomizableClasses>;
		/**
		 * Function used to filter what nodes should be shown.
		 * Tree automatically adds all parents for nodes.
		 * User Higher order functions for reactive search.
		 * If you want to only search leaf nodes,
		 * its your responsibility to check if its hasChildren property is false
		 */
		filter?: FilterFunction | null;
		/**
		 * Log function that will be called when something happens in tree.
		 * Used mostly for debugging
		 */
		logger?: ((...data: any[]) => void) | null;
		nodeSorter?: NodeSorter | null;
		/*
	 * Drag and drop mode allows all nodes, that don't have dragDisabled property set to true
	 * to be dragged and dropped. By default you can only insert at same level node you are dropping on,
	 * but you can allow nesting by setting nestAllowed to true on node. If you want to disable insertion,
	 * set dropDisabled to true on node. if both is disabled, you wont be able to drop on node.
	 */
		dragAndDrop?: boolean; //bool
		/**
		 * Callback that will be called when user drags above node.
		 * It should return true, if drop is disabled on that node.
		 */
		dropDisabledCallback?: DragEnterCallback | null;
		/**
		 * If true, keyboard navigation will be enabled. Use arrow keys to navigate and space to select node.
		 */
		allowKeyboardNavigation?: boolean;

		onFocus?: (x: any) => void
		onFocusLeave?: (x: any) => void
		onExpansion?: (x: any) => void
		onExpanded?: (x: any) => void
		onClosed?: (x: any) => void
		onChange?: (x: any) => void
		onSelection?: (x: any) => void
		onSelected?: (x: any) => void
		onUnselected?: (x: any) => void
		onMoved?: (x: any) => void

		children?: import("svelte").Snippet<[any]>;
		nestHighlight?: import("svelte").Snippet;
		contextMenu?: import("svelte").Snippet<[any]>;
	}

	let {
		    treeId,
		    tree,
		    value                   = [],
		    treeProps               = {},
		    verticalLines           = false,
		    readonly                = false,
		    separator               = ".",
		    recursiveSelection      = false,
		    selectionMode           = SelectionModes.none,
		    onlyLeafCheckboxes      = false,
		    hideDisabledCheckboxes  = false,
		    loadChildrenAsync       = null,
		    showContextMenu         = false,
		    expandTo                = 0,
		    expansionThreshold      = 0,
		    customClasses           = {},
		    filter                  = null,
		    logger                  = null,
		    nodeSorter              = null,
		    dragAndDrop             = false,
		    dropDisabledCallback    = null,
		    allowKeyboardNavigation = false,
		    onFocus                 = undefined,
		    onFocusLeave            = undefined,
		    onExpansion             = undefined,
		    onExpanded              = undefined,
		    onClosed                = undefined,
		    onChange                = undefined,
		    onSelection             = undefined,
		    onSelected              = undefined,
		    onUnselected            = undefined,
		    onMoved                 = undefined,
		    children,
		    nestHighlight,
		    contextMenu
	    }: Props = $props()

	export function changeAllExpansion(changeTo: boolean) {
		debugLog("changing expansion of every node to ", changeTo ? "expanded" : "collapsed")
		if (changeTo) {
			expandedPaths = computedTree.map((node) => node.path)
		} else {
			expandedPaths = []
		}
	}

	export function expandToNode(targetNodePath: string) {
		if (!targetNodePath) {
			console.warn("Cannot expand to node with null path")
			return
		}

		const parentPaths = helper.getParentsPaths(targetNodePath)

		debugLog("expanding to node '" + targetNodePath + "'" + " parents", parentPaths)

		expandedPaths = uniq([...expandedPaths, ...parentPaths])
	}

	/**
	 *
	 * @param changeTo if null, it will toggle expansion
	 */
	export function setNodeExpansion(nodePath: string, changeTo: boolean | null) {
		if (!nodePath) {
			console.warn("Cannot expand node with null path")
			return
		}

		const expandedPathsBefore = $state.snapshot(expandedPaths)
		if (changeTo === null) {
			changeTo = !expandedPaths.includes(nodePath)
		}

		expandedPaths = helper.changeExpansion(nodePath, changeTo, expandedPaths)

		console.log("Setting expansion", {
			expandedPathsBefore: expandedPathsBefore,
			expandedPaths: $state.snapshot(expandedPaths),
		})
	}

	export function setExpansions(expansions: string[]) {
		if (!Array.isArray(expansions)) {
			console.error("expansions must be an array")
			return
		}

		expandedPaths = expansions
	}

	export function focusNode(nodePath: string | null) {
		if (nodePath === null) {
			focusedNode = null
			return
		}

		const node  = helper.findNode(computedTree, nodePath)
		focusedNode = node
	}

	export function focusFirstNode(): Node | null {
		const rootChildren = helper.getDirectChildren(computedTree, null)

		if (rootChildren.length === 0) {
			focusedNode = null
			return null
		}

		focusedNode = rootChildren[0]

		onFocus?.(focusedNode)

		return focusedNode
	}

	let ctxMenu: ContextMenu         = $state()
	let expandedPaths: string[]      = $state([])
	let draggedNode: Node | null     = $state(null)
	let highlightedNode: Node | null = $state(null)
	let insertionType: InsertionType = $state(InsertionType.none)
	let focusedNode: Node | null     = $state(null)

	let computedClasses = $derived({...defaultClasses, ...(customClasses ?? {})})
	let helper              = $derived(new TreeHelper({
		separator,
		nodeSorter
	}))
	let dragAndDropProvider = $derived(new DragDropProvider(helper))
	let selectionProvider   = $derived(new SelectionProvider(helper, recursiveSelection))
	let computedTree        = $derived(computeTree(
		helper,
		selectionProvider,
		tree,
		filter,
		treeProps,
		expandedPaths,
		value
	))

	$effect(() => {
		dragAndDrop && console.warn("Drag and drop is not supported in this version")
	})

	function computeTree(
		helper: TreeHelper,
		selectionProvider: SelectionProvider,
		userProvidedTree: any[],
		filter: FilterFunction | null,
		props: Partial<TreeProps>,
		expandedPaths: string[],
		value: NodeId[]
	): Tree {
		if (!Array.isArray(userProvidedTree) || !Array.isArray(value)) {
			console.error("value and tree must be arrays!!")
			return []
		}
		const start = Date.now()

		const mappedTree                                 = helper.mapTree(
			userProvidedTree,
			{...defaultPropNames, ...props}
		)
		const {tree: filteredTree, count: filteredCount} = helper.searchTree(mappedTree, filter)

		// threshold applies to nodes that match the filter, not all their parents
		if (filteredCount <= expansionThreshold) {
			expandedPaths = uniq([...expandedPaths, ...filteredTree.map((node) => node.path)])
		}

		helper.markExpanded(filteredTree, expandedPaths)

		// TODO here we could save last value and only recompute visual state if value changed
		// or use diff to only update affected nodes
		selectionProvider.markSelected(filteredTree, value)

		const end = Date.now()
		debugLog(`Tree computed in: ${end - start}`, computeTree)
		return filteredTree
	}

	function onExpand(data: { node: Node; changeTo: boolean }) {
		const {node, changeTo} = data

		expandedPaths = helper.changeExpansion(node.path, changeTo, expandedPaths)

		debugLog("changed expansion of node '", node.id, "' to ", changeTo)

		//trigger callback if it is present and node has useCallback property set to true
		if (changeTo) {
			handleCallback(node)
		}

		//expansion events
		onExpansion?.({
			node:  node,
			value: changeTo
		})

		if (changeTo) {
			onExpanded?.(node)
		} else {
			onClosed?.(node)
		}
	}

	function handleCallback(node: Node) {
		if (node.useCallback !== true) {
			return
		}

		// only call on nodes with children
		if (node.hasChildren !== true) {
			return
		}

		if (loadChildrenAsync == null) {
			console.warn(
				"loadChildrenAsync is not set, but useCallback is set to true on node with path",
				node.path
			)
			return
		}

		debugLog("calling callback for node", node)

		// TODO mark node as loaded and don't call callback again
		// this is now responsibility of user
		loadChildrenAsync(node)
	}

	function onSelectionChanged(data: { node: Node }) {
		const {node} = data

		const nodePath = node.path

		const changeTo = !selectionProvider.isNodeSelected(node)

		const newValue = selectionProvider.setSelection(computedTree, nodePath, changeTo, value)

		debugLog(
			"changing selection of node '",
			nodePath,
			"' to ",
			changeTo,
			" returning value ",
			newValue
		)

		onChange?.(newValue)

		onSelection?.({
			node:  node,
			value: changeTo
		})

		if (changeTo) {
			onSelected?.({node, value: newValue})
		} else {
			onUnselected?.({node, value: newValue})
		}
	}

	function openContextMenu(data: { event: MouseEvent; node: Node }) {
		const {event, node} = data
		if (!showContextMenu) {
			return
		}
		event.preventDefault()
		ctxMenu.onRightClick(event, node)
	}

	function onDragStart(data: { node: Node; event: DragEvent }) {
		const {node, event} = data

		draggedNode = null

		if (!dragAndDrop || node.dragDisabled) {
			return
		}

		draggedNode = node
	}

	function onDragEnd({node, event, element}: { node: Node; event: DragEvent; element: HTMLElement }) {
		// fires when you stop dragging element

		draggedNode     = null
		highlightedNode = null
	}

	function onDragDrop({node, event, element}: { node: Node; event: DragEvent; element: HTMLElement }) {
		// here we assume that highlightType is correctly calculated in handleDragOver
		if (!dragAndDrop || draggedNode === null || insertionType === InsertionType.none) {
			event.preventDefault()
			return
		}

		highlightedNode = null

		debugLog("DROPPED: ", draggedNode, "on", node)

		onMoved?.({
			node:       draggedNode,
			target:     node,
			insertType: insertionType
		})
	}

	// handle highlighting
	function onDragEnter({node, event, element}: { node: Node; event: DragEvent; element: HTMLElement }) {
		highlightedNode = null

		if (!draggedNode || !dragAndDrop) {
			return
		}

		// static rules
		if (!dragAndDropProvider.isDropAllowed(draggedNode, node)) {
			return
		}

		if (typeof dropDisabledCallback === "function") {
			// possible bug, if the promise is resolved, when user is over another node
			dropDisabledCallback(draggedNode, node).then((dropDisabled) => {
				if (!dropDisabled) {
					highlightedNode = node
				}
			})
		} else {
			highlightedNode = node
		}
	}

	function onDragOver({node, event, element, nest}: { node: Node; event: DragEvent; element: HTMLElement; nest: boolean }) {
		if (!dragAndDrop || draggedNode === null || node.dropDisabled) {
			return
		}

		const insertType = dragAndDropProvider.getInsertionPosition(
			draggedNode,
			node,
			event,
			element,
			nest
		)

		if (insertType === InsertionType.none) {
			return
		}

		event.preventDefault()

		insertionType = insertType
	}

	function onDragLeave({node, event, element}: { node: Node; event: DragEvent; element: HTMLElement }) {
		insertionType = InsertionType.none
	}

	function onKeyPress(data: { event: KeyboardEvent; node: Node }) {
		const {event, node: targetNode} = data
		if (!allowKeyboardNavigation) {
			return
		}

		const movement = parseMovementDirection(event.key)
		if (movement) {
			const {node, setExpansion} = calculateNewFocusedNode(
				helper,
				computedTree,
				targetNode,
				movement
			)

			focusedNode = node
			if (setExpansion !== null) {
				onExpand({node: node, changeTo: setExpansion})
			}

			onFocus?.(node)
			return
		}

		if (event.key === "Enter" || event.key === " ") {
			onSelectionChanged({node: targetNode})
			return
		}

		if (event.key === "Escape") {
			focusedNode = null
			if (document.activeElement instanceof HTMLElement) {
				document.activeElement.blur()
			}

			onFocusLeave?.()

			return
		}
	}

	function debugLog(...data: any[]) {
		if (logger) {
			logger(...data)
		}
	}
</script>

<div class="treeview-parent">
	<Branch
		branchRootNode={null}
		{treeId}
		checkboxes={selectionMode}
		tree={computedTree}
		recursive={recursiveSelection}
		{onlyLeafCheckboxes}
		{hideDisabledCheckboxes}
		{expandTo}
		{dragAndDrop}
		{readonly}
		{helper}
		classes={computedClasses}
		{verticalLines}
		childDepth={0}
		{insertionType}
		{highlightedNode}
		{draggedNode}
		{focusedNode}
		{allowKeyboardNavigation}
		{children}
		{nestHighlight}
		internal_onHandleDragStart={onDragStart}
		internal_onHandleDragDrop={onDragDrop}
		internal_onHandleDragOver={onDragOver}
		internal_onHandleDragEnter={onDragEnter}
		internal_onHandleDragEnd={onDragEnd}
		internal_onHandleDragLeave={onDragLeave}
		internal_onKeypress={onKeyPress}
		internal_onExpand={onExpand}
		internal_onSelectionChanged={onSelectionChanged}
		onOpenCtxmenu={openContextMenu}
	/>
	<ContextMenu bind:this={ctxMenu}>
		{#snippet children({node})}
			{@render contextMenu?.({node})}
		{/snippet}
	</ContextMenu>
</div>

<style lang="scss" global>
	.treeview-parent {
		:global {
			color: red !important;
			@import "./tree-styles";
		}
	}
</style>
