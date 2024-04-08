<script lang="ts">
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
		type ExpandedCallback
	} from '$lib/types.js';
	import { TreeHelper } from '$lib/index.js';
	import Branch from './Branch.svelte';
	import { PropertyHelper } from '$lib/helpers/property-helper.js';

	const dispatch = createEventDispatcher();

	export let treeId: string;
	/**
	 * Array of nodes that represent tree structure.
	 * Each node should have unique path
	 * All tree modifications are node by modyfing this array, so you need to bind it to parent component
	 */
	export let tree: Node[];
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
	 * Separater used to parse paths. It is used for getting node depth and getting parent node.
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
	export let expandCallback: ExpandedCallback | null = null;
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

	//! DONT SET ONLY USED INTERNALLY
	//TODO use context instead
	//path of currently dragged node
	let draggedPath: string | null = null;
	let highlightedNode: Node = null;

	let dragenterTimestamp: Date | null = null;
	//
	let canNestPos = false;
	let canNestTime = false;
	let canNest: boolean;
	let dragTimeout: NodeJS.Timeout;
	let validTarget = false;
	let insPos: InsertionType;
	let ctxMenu: ContextMenu;

	$: dragAndDrop && console.warn('Drag and drop is not supported in this version');

	// ensure tree is never null
	$: tree, tree == null || tree == undefined ? (tree = []) : '';

	$: propHelper = new PropertyHelper({ ...defaultPropNames, ...props });
	$: helper = new TreeHelper(propHelper, {
		recursive: recursiveSelection,
		recalculateNodePath,
		checkboxes: selectionMode,
		separator
	});

	// compute vissual tree still caleed twice, because if we force update changes tree
	// which fires this event again
	// TODO fix computeVisualTree beiing called twice
	$: recursiveSelection && selectionMode !== SelectionModes.none && computeVisualTree(tree),
		forceUpdate();

	//if insert is disabled => nest right away and never nest if its disabled
	$: canNest =
		(propHelper.insertDisabled(highlightedNode) || canNestPos || canNestTime) &&
		propHelper.nestDisabled(highlightedNode) !== true;

	function onExpand(event: CustomEvent<{ node: Node }>) {
		const { node } = event.detail;

		const changeTo = !propHelper.expanded(node);

		helper.changeExpansion(tree, node, changeTo);

		debugLog("changed expansion of node '", helper.path(node), "' to ", changeTo);

		forceUpdate();

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
		if (propHelper.useCallback(node) !== true) {
			return;
		}

		if (expandCallback == null) {
			console.warn(
				'expandCallback is not set, but useCallback is set to true on node with path',
				helper.path(node)
			);
			return;
		}

		debugLog('calling callback for node', node);

		expandCallback(node).then(handleCallbackSuccess(node)).catch(handleCallbackError(node));
	}

	function handleCallbackSuccess(node: Node) {
		return (newNodes: Node[]) => {
			debugLog('callback returned ', newNodes.length, ' new nodes', newNodes);

			tree = tree.concat(newNodes);
			if (newNodes.length === 0) {
				propHelper.setHasChildren(node, false);
			}
			// dont fetch same data twice
			propHelper.setUseCallback(node, false);
		};
	}

	function handleCallbackError(node: Node) {
		return (reason: any) => {
			console.warn(
				'error in callback, if you dont want user to be able to retry, return empty array intead of error',
				reason
			);
			// TODO find better way to handle error
			debugLog('error in callback', reason);

			// allow user to try again
			propHelper.setExpanded(node, false);
		};
	}

	// TODO remove and expose function from package
	export function changeAllExpansion(changeTo: boolean) {
		debugLog('chaning expantion of every node to ', changeTo ? 'expanded' : 'collapsed');

		tree = helper.changeEveryExpansion(tree, changeTo);
	}

	function computeVisualTree(_tree: Tree): void {
		if (selectionMode === SelectionModes.none) {
			// no point in computing something we wont show
			return;
		}

		debugLog('computing visual tree', { tree: _tree });
		helper.selection.recomputeAllVisualStates(_tree);
	}

	function onSelectionChanged(event: CustomEvent<{ node: Node }>) {
		const { node } = event.detail;

		const nodePath = helper.path(node);

		const changeTo = !helper.selection.isSelected(node);

		helper.selection.setSelection(tree, nodePath, changeTo);

		debugLog("changing selection of node '", nodePath, "' to ", !propHelper.selected(node));

		forceUpdate();

		dispatch('selection', {
			node: node,
			value: changeTo
		});

		if (changeTo) {
			dispatch('selected', node);
		} else {
			dispatch('unselected', node);
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

	function forceUpdate() {
		tree = tree;
	}

	//#region drag and drop

	function handleDragStart(e: DragEvent, node: Node) {
		// dont allos drag if is draggable is false
		if (propHelper.isDraggable(node) === false) {
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

	function handleDragDrop(e: DragEvent, node: Node, el: HTMLElement) {
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

		let oldNode = { ...(newNode as any) };
		let oldParent = helper.findNode(tree, helper.getParentNodePath(draggedPath));

		let insType = canNest ? 0 : helper.dragDrop.getInsertionPosition(e, el);

		//cancel move if its not valid
		if (insType == 0 && propHelper.nestDisabled(node) === true) return;
		else if ((insType == -1 || insType == 1) && propHelper.insertDisabled(node) === true) return;

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
				helper.path(node)?.startsWith(draggedPath ?? '') ||
				(propHelper.insertDisabled(node) === true && propHelper.nestDisabled(node) === true)
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
			propHelper.nestDisabled(node) !== true
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
			propHelper.insertDisabled(node) !== true
		);
	}

	//#endregion
</script>

<Branch
	branchRootNode={null}
	{treeId}
	checkboxes={selectionMode}
	{tree}
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
