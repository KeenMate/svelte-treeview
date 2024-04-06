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

	import {
		checkboxesTypes,
		type InsertionType,
		type Node,
		type Props,
		type Tree,
		type CustomizableClasses
	} from '$lib/types.js';
	import { TreeHelper } from '$lib/index.js';
	import Branch from './Branch.svelte';
	import { PropertyHelper } from '$lib/helpers/property-helper.js';

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

	export let logger: ((...data: any[]) => void) | null = null;
	//* properties
	export let props: Partial<Props> = {};

	//! DONT SET ONLY USED INTERNALLY
	//TODO use context instead
	//path of currently dragged node
	let draggedPath: string | null = null;
	let highlightedNode: node = null;
	let branchRootNode: node | null = null;

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
	$: propHelper = new PropertyHelper({ ...defaultPropNames, ...props });
	$: helper = new TreeHelper(propHelper, config);
	$: tree = computeVisualTree(tree, filteredTree);

	//if insert is disabled => nest right away and never nest if its disabled

	$: canNest =
		(propHelper.insertDisabled(highlightedNode) || canNestPos || canNestTime) &&
		propHelper.nestDisabled(highlightedNode) !== true;

	$: customClasses = {
		treeClass,
		nodeClass,
		expandedToggleClass,
		collapsedToggleClass,
		expandClass,
		inserLineClass,
		inserLineNestClass,
		currentlyDraggedClass
	} as CustomizableClasses;

	function onExpand(event: CustomEvent<{ node: node; expanded: boolean }>) {
		const { node, expanded } = event.detail;

		helper.changeExpansion(tree, node, !expanded);

		//update expansion
		tree = tree;

		let isExpanded = propHelper.expanded(node);

		//trigger callback if it is present and node has useCallback
		if (isExpanded && expandCallback !== null && propHelper.useCallback(node) === true) {
			// dont fetch same data twice
			propHelper.setUseCallback(node, false);

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
			value: isExpanded
		});

		if (isExpanded) {
			dispatch('expanded', node);
		} else {
			dispatch('closed', node);
		}
	}

	export function changeAllExpansion(changeTo: boolean) {
		log('chaning expantion of every node to ', changeTo ? 'expanded' : 'collapsed');

		tree = helper.changeEveryExpansion(tree, changeTo);
	}

	function computeVisualTree(_tree: Tree, _filteredTree: Tree | null): Tree {
		if (checkboxes === checkboxesTypes.none) {
			// no point in computing something we wont show
			return _tree;
		}

		log('computing visual tree', { tree: _tree, filteredTree: _filteredTree });

		return helper.selection.computeInitialVisualStates(_tree, _filteredTree ?? _tree);
	}

	//checkboxes
	function onSelectionChanged(event: CustomEvent<{ node: node }>) {
		const { node } = event.detail;

		const nodePath = helper.path(node);

		if (recursive && helper.props.hasChildren(node)) {
			const checked = propHelper.visualState(node) === 'true';

			log('old vs ', propHelper.visualState(node));
			log('changing selection of node ', node, ' and all children to ', !checked);

			tree = helper.selection.changeSelectedForChildren(
				tree,
				nodePath,
				!checked,
				filteredTree ?? tree
			);
		} else {
			log("changing selection of node '", nodePath, "' to ", !propHelper.selected(node));
			tree = helper.selection.changeSelection(tree, nodePath, filteredTree ?? tree);
		}

		// dispatch selection events

		let val = propHelper.selected(node);
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

	function openContextMenu(ce: CustomEvent<{ e: MouseEvent; node: Node }>) {
		const { e, node } = ce.detail;

		if (!showContexMenu) return;
		e.preventDefault();
		ctxMenu.onRightClick(e, node);
	}

	function log(...data: any[]) {
		if (logger) {
			logger(...data);
		}
	}
</script>

<Branch
	branchRootNode={null}
	{treeId}
	{checkboxes}
	tree={filteredTree ?? tree}
	{recursive}
	{onlyLeafCheckboxes}
	{checkboxesDisabled}
	{expandedLevel}
	bind:draggedPath
	bind:dragAndDrop
	{props}
	bind:highlightedNode
	on:open-ctxmenu={openContextMenu}
	{readonly}
	{helper}
	let:node={nodeInSlot}
	classes={customClasses}
	{enableVerticalLines}
	on:internal-expand={onExpand}
	on:internal-selectionChanged={onSelectionChanged}
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
