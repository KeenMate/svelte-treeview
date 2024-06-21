<script lang="ts">
	import ContextMenu from './menu/ContextMenu.svelte';
	import { createEventDispatcher } from 'svelte';
	import { defaultClasses, defaultPropNames } from './constants.js';
	import {
		SelectionModes as SelectionModes,
		InsertionType,
		type Node,
		type Props,
		type Tree,
		type CustomizableClasses,
		type DragEnterCallback,
		type ExpandedCallback,
		type NodeId,
		type ProvidedTree,
		type FilterFunction
	} from '$lib/types.js';
	import { TreeHelper } from '$lib/index.js';
	import Branch from './Branch.svelte';
	import { SelectionProvider } from '$lib/providers/selection-provider.js';
	import { DragDropProvider } from '$lib/providers/drag-drop-provider.js';
	import uniq from 'lodash.uniq';
	import {
		calculateNewFocusedNode,
		parseMovementDirection
	} from '$lib/providers/movement-provider.js';

	const dispatch = createEventDispatcher();

	export let treeId: string;
	/**
	 * Array of nodes that represent tree structure.
	 * Each node should have unique path
	 * All tree modifications are made by modifying this array, so you need to bind it to parent component
	 */
	export let tree: ProvidedTree;

	/**
	 * Node paths of selected nodes
	 */
	export let value: NodeId[] = [];
	/**
	 * Object properties where information about node is stored
	 */
	export let props: Partial<Props> = {};
	/**
	 * Show vertical lines as visual guide
	 */
	export let verticalLines = false;
	/**
	 * Disables drag and drop and selection, expansion is still allowed
	 */
	export let readonly = false;
	/**
	 * Separator used to parse paths. It is used for getting node depth and getting parent node.
	 * Default is '.'.
	 */
	export let separator = '.';
	/**
	 * only leaf nodes can be selected, non-leaf nodes only select/deselect its children.
	 * Their visual state is calculated based on their children
	 * If you set selected on non-leaf node, it will be ignored and may be deleted
	 */
	export let recursiveSelection = false;
	/**
	 * Controls if checkboxes are shown and how they behave. Default is none
	 * TODO write about all the different modes
	 * TODO find better name
	 */
	export let selectionMode: SelectionModes = SelectionModes.none;
	/**
	 * By default, in recursive mode, non-leaf checkboxes will select/deselect all its children
	 * If you set this to true, this behavior will be disabled and only leaf nodes will be selectable
	 */
	export let onlyLeafCheckboxes = false; //bool
	/**
	 * Instead of showing disabled checkboxes, show blank space
	 */
	export let hideDisabledCheckboxes = false; //bool
	/**
	 * Function that will be caged when node is expanded and useCallback is set to true
	 * It should return array of nodes that will be added to tree
	 * If it throws error, node will be collapsed,
	 * but user will be able to open it again and callback will be called
	 */
	export let loadChildrenAsync: ExpandedCallback | null = null;
	/**
	 * Show context menu on right click.
	 * Its defined in slot context-menu
	 */
	export let showContextMenu = false;

	// TODO stopped working in new version
	/**
	 * Automatically expand nodes to this level,
	 * any user made expansion will override this.
	 */
	export let expandTo = 0;

	/**
	 * Threshold for automatic expansion. If tree has less or equal nodes than this value,
	 * all nodes will be expanded. Default is 0, which means no automatic expansion
	 */
	export let expansionThreshold = 0;

	/**
	 * Classes used in tree. You can override default classes with this prop.
	 * It is recommended to use default classes and add additional styles in your css
	 */
	export let customClasses: Partial<CustomizableClasses> = {};

	/**
	 * Function used to filter what nodes should be shown.
	 * Tree automatically adds all parents for nodes.
	 * User Higher order functions for reactive search.
	 * If you want to only search leaf nodes,
	 * its your responsibility to check if its hasChildren property is false
	 */
	export let filter: FilterFunction | null = null;

	/**
	 * Log function that will be called when something happens in tree.
	 * Used mostly for debugging
	 */
	export let logger: ((...data: any[]) => void) | null = null;

	/*
	 * Drag and drop mode allows all nodes, that don't have dragDisabled property set to true
	 * to be dragged and dropped. By default you can only insert at same level node you are dropping on,
	 * but you can allow nesting by setting nestAllowed to true on node. If you want to disable insertion,
	 * set dropDisabled to true on node. if both is disabled, you wont be able to drop on node.
	 */
	export let dragAndDrop = false; //bool
	/**
	 * Callback that will be called when user drags above node.
	 * It should return true, if drop is disabled on that node.
	 */
	export let dropDisabledCallback: DragEnterCallback | null = null;

	/**
	 * If true, keyboard navigation will be enabled. Use arrow keys to navigate and space to select node.
	 */
	export let allowKeyboardNavigation = false;

	let ctxMenu: ContextMenu;
	let expandedIds: NodeId[] = [];
	let draggedNode: Node | null = null;
	let highlightedNode: Node | null = null;
	let insertionType: InsertionType = InsertionType.none;
	let focusedNode: Node | null = null;

	$: computedClasses = { ...defaultClasses, ...(customClasses ?? {}) };

	$: dragAndDrop && console.warn('Drag and drop is not supported in this version');

	$: helper = new TreeHelper({
		separator
	});
	$: dragAndDropProvider = new DragDropProvider(helper);
	$: selectionProvider = new SelectionProvider(helper, recursiveSelection);
	$: computedTree = computeTree(helper, selectionProvider, tree, filter, props, expandedIds, value);
	$: debugLog('computedTree', computedTree);

	export function changeAllExpansion(changeTo: boolean) {
		debugLog('changing expansion of every node to ', changeTo ? 'expanded' : 'collapsed');
		if (changeTo) {
			expandedIds = computedTree.map((node) => node.id);
		} else {
			expandedIds = [];
		}
	}

	export function expandToNode(nodePath: string) {
		const targetNode = helper.findNode(computedTree, nodePath);

		if (!targetNode) {
			console.error('Node with path', nodePath, 'not found');
			return;
		}

		const parents = helper.getParents(computedTree, targetNode);

		debugLog("expanding to node '" + nodePath + "'" + ' parents', parents);
		expandedIds = uniq([...expandedIds, ...parents.map((node) => node.id)]);
	}

	export function setNodeExpansion(nodePath: string, changeTo: boolean) {
		const targetNode = helper.findNode(computedTree, nodePath);

		if (!targetNode) {
			console.error('Node with path', nodePath, 'not found');
			return;
		}

		expandedIds = helper.changeExpansion(targetNode, changeTo, expandedIds);
	}

	export function setExpansions(expansions: NodeId[]) {
		if (!Array.isArray(expansions)) {
			console.error('expansions must be an array');
			return;
		}

		expandedIds = expansions;
	}

	export function focusNode(nodePath: string | null) {
		if (nodePath === null) {
			focusedNode = null;
			return;
		}

		const node = helper.findNode(computedTree, nodePath);
		focusedNode = node;
	}

	export function focusFirstNode(): Node | null {
		const rootChildren = helper.getDirectChildren(computedTree, null);

		if (rootChildren.length === 0) {
			focusedNode = null;
			return null;
		}

		focusedNode = rootChildren[0];

		dispatch('focus', focusedNode);
		return focusedNode;
	}

	function computeTree(
		helper: TreeHelper,
		selectionProvider: SelectionProvider,
		userProvidedTree: any[],
		filter: FilterFunction | null,
		props: Partial<Props>,
		expandedIds: NodeId[],
		value: NodeId[]
	): Tree {
		if (!Array.isArray(userProvidedTree) || !Array.isArray(value)) {
			console.error('value and tree must be arrays!!');
			return [];
		}

		const mappedTree = helper.mapTree(userProvidedTree, { ...defaultPropNames, ...props });
		const { tree: filteredTree, count: filteredCount } = helper.searchTree(mappedTree, filter);

		// treshold applies to nodes that match the filter, not all their parents
		if (filteredCount <= expansionThreshold) {
			expandedIds = uniq([...expandedIds, ...filteredTree.map((node) => node.id)]);
		}

		helper.markExpanded(filteredTree, expandedIds);

		// TODO here we could save last value and only recompute visual state if value changed
		// or use diff to only update affected nodes
		selectionProvider.markSelected(filteredTree, value);

		return filteredTree;
	}

	function onExpand(detail: { node: Node; changeTo: boolean }) {
		const { node, changeTo } = detail;

		expandedIds = helper.changeExpansion(node, changeTo, expandedIds);

		debugLog("changed expansion of node '", node.id, "' to ", changeTo);

		//trigger callback if it is present and node has useCallback property set to true
		if (changeTo) {
			handleCallback(node);
		}

		//expansion events
		dispatch('expansion', {
			node: node,
			value: changeTo
		});

		if (changeTo) {
			dispatch('expanded', node);
		} else {
			dispatch('closed', node);
		}
	}

	function handleCallback(node: Node) {
		// only call on nodes with children
		if (node.hasChildren !== true) {
			return;
		}

		if (loadChildrenAsync == null) {
			console.warn(
				'loadChildrenAsync is not set, but useCallback is set to true on node with path',
				node.path
			);
			return;
		}

		debugLog('calling callback for node', node);

		// TODO mark node as loaded and don't call callback again
		// this is now responsibility of user
		loadChildrenAsync(node);
	}

	function onSelectionChanged(detail: { node: Node }) {
		const { node } = detail;

		const nodePath = node.path;

		const changeTo = !selectionProvider.isNodeSelected(node);

		const newValue = selectionProvider.setSelection(computedTree, nodePath, changeTo, value);

		debugLog(
			"changing selection of node '",
			nodePath,
			"' to ",
			changeTo,
			' returning value ',
			newValue
		);

		dispatch('change', newValue);

		dispatch('selection', {
			node: node,
			value: changeTo
		});

		if (changeTo) {
			dispatch('selected', { node, value: newValue });
		} else {
			dispatch('unselected', { node, value: newValue });
		}
	}

	function openContextMenu(ce: CustomEvent<{ e: MouseEvent; node: Node }>) {
		const { e, node } = ce.detail;
		if (!showContextMenu) return;
		e.preventDefault();
		ctxMenu.onRightClick(e, node);
	}

	function onDragStart(event: CustomEvent<{ node: Node; e: DragEvent }>) {
		const { node, e } = event.detail;

		draggedNode = null;

		if (!dragAndDrop || node.dragDisabled) {
			return;
		}

		draggedNode = node;
	}

	function onDragEnd({
		detail: { node, event, element }
	}: CustomEvent<{ node: Node; event: DragEvent; element: HTMLElement }>) {
		// fires when you stop dragging element

		draggedNode = null;
		highlightedNode = null;
	}

	function onDragDrop({
		detail: { node, event, element }
	}: CustomEvent<{ node: Node; event: DragEvent; element: HTMLElement }>) {
		// here we assume that highlightType is correctly calculated in handleDragOver
		if (!dragAndDrop || draggedNode === null || insertionType === InsertionType.none) {
			event.preventDefault();
			return;
		}

		highlightedNode = null;

		debugLog('DROPPED: ', draggedNode, 'on', node);

		dispatch('moved', {
			node: draggedNode,
			target: node,
			insertType: insertionType
		});
	}

	// handle highlighting
	function onDragEnter({
		detail: { node, event, element }
	}: CustomEvent<{ node: Node; event: DragEvent; element: HTMLElement }>) {
		highlightedNode = null;

		if (!draggedNode || !dragAndDrop) {
			return;
		}

		// static rules
		if (!dragAndDropProvider.isDropAllowed(draggedNode, node)) {
			return;
		}

		if (typeof dropDisabledCallback === 'function') {
			// possible bug, if the promise is resolved, when user is over another node
			dropDisabledCallback(draggedNode, node).then((dropDisabled) => {
				if (!dropDisabled) {
					highlightedNode = node;
				}
			});
		} else {
			highlightedNode = node;
		}
	}

	function onDragOver({
		detail: { node, event, element, nest }
	}: CustomEvent<{ node: Node; event: DragEvent; element: HTMLElement; nest: boolean }>) {
		if (!dragAndDrop || draggedNode === null || node.dropDisabled) {
			return;
		}

		const insertType = dragAndDropProvider.getInsertionPosition(
			draggedNode,
			node,
			event,
			element,
			nest
		);

		if (insertType === InsertionType.none) {
			return;
		}

		event.preventDefault();

		insertionType = insertType;
	}

	function onDragLeave({
		detail: { node, event, element }
	}: CustomEvent<{ node: Node; event: DragEvent; element: HTMLElement }>) {
		insertionType = InsertionType.none;
	}

	function onKeyPress(detail: { event: KeyboardEvent; node: Node }) {
		const { event, node: targetNode } = detail;
		if (!allowKeyboardNavigation) {
			return;
		}

		const movement = parseMovementDirection(event.key);
		if (movement) {
			const { node, setExpansion } = calculateNewFocusedNode(
				helper,
				computedTree,
				targetNode,
				movement
			);

			focusedNode = node;
			if (setExpansion !== null) {
				onExpand({ node: node, changeTo: setExpansion });
			}

			dispatch('focus', node);
			return;
		}

		if (event.key === 'Enter' || event.key === ' ') {
			onSelectionChanged({ node: targetNode });
			return;
		}

		if (event.key === 'Escape') {
			focusedNode = null;
			if (document.activeElement instanceof HTMLElement) {
				document.activeElement.blur();
			}

			dispatch('focus-leave');

			return;
		}
	}

	function debugLog(...data: any[]) {
		if (logger) {
			logger(...data);
		}
	}
</script>

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
	let:node={nodeInSlot}
	childDepth={0}
	{insertionType}
	{highlightedNode}
	{draggedNode}
	{focusedNode}
	{allowKeyboardNavigation}
	on:internal-handleDragStart={onDragStart}
	on:internal-handleDragDrop={onDragDrop}
	on:internal-handleDragOver={onDragOver}
	on:internal-handleDragEnter={onDragEnter}
	on:internal-handleDragEnd={onDragEnd}
	on:internal-handleDragLeave={onDragLeave}
	on:internal-keypress={(e) => onKeyPress(e.detail)}
	on:open-ctxmenu={openContextMenu}
	on:internal-expand={(e) => onExpand(e.detail)}
	on:internal-selectionChanged={(e) => onSelectionChanged(e.detail)}
>
	<slot node={nodeInSlot} />
	<svelte:fragment slot="nest-highlight">
		<slot name="nest-highlight" />
	</svelte:fragment>
</Branch>
<ContextMenu bind:this={ctxMenu}>
	<svelte:fragment let:node>
		<slot name="context-menu" {node} />
	</svelte:fragment>
</ContextMenu>

<style lang="sass" global>
	@import "./tree-styles.sass"
</style>
