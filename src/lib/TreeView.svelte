<script lang="ts" generics="T">
	import ContextMenu from './menu/ContextMenu.svelte';
	import { createEventDispatcher, onMount } from 'svelte';
	import { defaultClasses, defaultPixelTreshold, defaultPropNames } from './constants.js';

	import {
		SelectionModes as SelectionModes,
		type InsertionType,
		type Node,
		type Props,
		type Tree,
		type CustomizableClasses,
		type DragEnterCallback,
		type BeforeMovedCallback,
		type ExpandedCallback,
		VisualState,
		type NodeId,
		type ProvidedTree,
		type FilterFunction
	} from '$lib/types.js';
	import { TreeHelper } from '$lib/index.js';
	import Branch from './Branch.svelte';
	import { SelectionProvider } from '$lib/providers/selection-provider.js';

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
	 * By default, in recursive mode, non-leaf checkboxes will select/deselct all its children
	 * If you set this to true, this begaviour will be disabled and only leaf nodes will be selectable
	 */
	export let onlyLeafCheckboxes = false; //bool
	/**
	 * Instead of showing disabled checkboxes, show blank space
	 */
	export let hideDisabledCheckboxes = false; //bool
	/**
	 * Function that will be caled when node is expanded and useCallback is set to true
	 * It should return array of nodes that will be added to tree
	 * If it throws error, node will be collapsed,
	 * but user will be able to open it again and callback will be called
	 */
	export let loadChildrenAsync: ExpandedCallback | null = null;
	/**
	 * Show context menu on right click.
	 * Its defined in slot context-menu
	 */
	export let showContexMenu = false;

	/**
	 * Automaticaly expand nodes to this level,
	 * any user made expansion will override this.
	 */
	export let expandTo = 0;

	/**
	 * Classes used in tree. You can override default classes with this prop.
	 * It is recommended to use default classes and add aditinal styles in your css
	 */
	export let customClasses: CustomizableClasses = defaultClasses;

	// use any so use doesnt have to cast from unknown
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

	// props for drag and drop
	export let dragAndDrop = false; //bool
	export let timeToNest: number | null = null;
	export let pixelNestTreshold = defaultPixelTreshold;
	export let recalculateNodePath = true;
	export let dragEnterCallback: DragEnterCallback | null = null;
	export let beforeMovedCallback: BeforeMovedCallback | null = null;

	let ctxMenu: ContextMenu;

	let expandedIds: NodeId[] = [];

	// OLD variables, will be removed/changed in future
	let draggedPath: string | null = null;
	let highlightedNode: Node | null = null;
	let canNest: boolean = false;
	let validTarget = false;
	let insPos: InsertionType;

	$: dragAndDrop && console.warn('Drag and drop is not supported in this version');

	$: helper = new TreeHelper({
		separator
	});
	$: selectionProvider = new SelectionProvider(helper, recursiveSelection);
	$: computedTree = computeTree(helper, selectionProvider, tree, filter, props, expandedIds, value);
	$: debugLog('computedTree', computedTree);

	export function changeAllExpansion(changeTo: boolean) {
		debugLog('chaning expantion of every node to ', changeTo ? 'expanded' : 'collapsed');

		expandedIds = computedTree.map((node) => node.id);
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

		let mappedTree = helper.mapTree(userProvidedTree, filter, { ...defaultPropNames, ...props });

		helper.markExpanded(mappedTree, expandedIds);

		// TODO here we could save last value and only recompute visual state if value changed
		// or use diff to only update affected nodes
		selectionProvider.markSelected(mappedTree, value);

		return mappedTree;
	}

	function onExpand(event: CustomEvent<{ node: Node; changeTo: boolean }>) {
		const { node, changeTo } = event.detail;

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

		// TODO mark node as loaded and dont call callback again
		loadChildrenAsync(node);
	}

	function onSelectionChanged(event: CustomEvent<{ node: Node }>) {
		const { node } = event.detail;

		const nodePath = node.path;

		const changeTo = !selectionProvider.isNodeSelected(node);

		const newValue = selectionProvider.setSelection(computedTree, nodePath, changeTo, value);

		debugLog(
			"changing selection of node '",
			nodePath,
			"' to ",
			changeTo,
			' returing value ',
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

		if (!showContexMenu) return;
		e.preventDefault();
		ctxMenu.onRightClick(e, node);
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
	{draggedPath}
	{dragAndDrop}
	{highlightedNode}
	{readonly}
	{helper}
	classes={customClasses}
	{verticalLines}
	on:open-ctxmenu={openContextMenu}
	on:internal-expand={onExpand}
	on:internal-selectionChanged={onSelectionChanged}
	let:node={nodeInSlot}
	childDepth={0}
	{canNest}
	{validTarget}
	{insPos}
>
	<slot node={nodeInSlot} />
</Branch>

<ContextMenu bind:this={ctxMenu}>
	<svelte:fragment let:node>
		<slot name="context-menu" {node} />
	</svelte:fragment>
</ContextMenu>

<style lang="sass" global>
	@import "./tree-styles.sass"
</style>
