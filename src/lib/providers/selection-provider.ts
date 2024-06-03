import type { TreeHelper } from '$lib/helpers/tree-helper.js';
import {
	SelectionModes,
	type Tree,
	VisualState,
	type TreeVisualStates,
	type Node,
	type NodeId
} from '$lib/types.js';

export class SelectionProvider {
	helper: TreeHelper;
	recursiveMode: boolean;

	constructor(treeHelper: TreeHelper, recursive: boolean) {
		this.helper = treeHelper;
		this.recursiveMode = recursive;
	}

	markSelected(tree: Tree, selectedNodeIds: NodeId[]) {
		const visualStates = this.computeVisualStates(tree, selectedNodeIds);

		tree.forEach((node: Node) => {
			if (selectedNodeIds.includes(node.id ?? '')) {
				node.selected = true;
				node.visualState = VisualState.selected;
				return;
			}

			node.selected = false;

			const visualState = visualStates[node.id ?? ''];
			if (!visualState) {
				node.visualState = VisualState.notSelected;
			}
			node.visualState = visualState;
		});
	}

	isNodeSelected(node: Node): boolean {
		return node.selected === true || node.visualState === VisualState.selected;
	}

	isSelected(nodeId: string, visualStates: TreeVisualStates, selectedNodeIds: NodeId[]): boolean {
		const selected = selectedNodeIds.includes(nodeId);
		if (selected) return true;

		const visualState = visualStates[nodeId];
		return visualState === VisualState.selected;
	}

	getSelectableDirectChildren(tree: Tree, parentNodePath: string | null) {
		return this.helper
			.getDirectChildren(tree, parentNodePath)
			.filter((node: Node) => isSelectable(node, SelectionModes.all));
	}

	setSelection(
		tree: Tree,
		nodePath: string | null,
		changeTo: boolean,
		oldSelection: NodeId[]
	): NodeId[] {
		const node = nodePath ? this.helper.findNode(tree, nodePath) : null;
		const nodeHasChildren = node ? node.hasChildren : false;

		// allow selection of root node
		if (nodePath === null || (this.recursiveMode && nodeHasChildren)) {
			return this.changeSelectedRecursively(tree, nodePath, changeTo, oldSelection);
		} else {
			if (!node) {
				// throw new Error('Node not found ' + nodePath);
				console.warn('Node %s doesnt exits', nodePath);
				return oldSelection;
			}

			const nodeId = node.id ?? '';

			// prevent double selection
			const filteredSelection = oldSelection.filter((x) => x !== nodeId);
			if (changeTo === false) {
				return filteredSelection;
			}

			return [...filteredSelection, nodeId];
		}
	}

	/** Computes visual states for all nodes. Used for computing initial visual states when tree changes  */
	computeVisualStates(tree: Tree, selectedNodeIds: (string | number)[]) {
		const visualStates: TreeVisualStates = {};

		// TODO is this really the case?
		// if some node is not selectable, are all its children also not selectable?

		const rootELements = this.getSelectableDirectChildren(tree, null);
		rootELements.forEach((node: Node) => {
			if (node.hasChildren == true) {
				const result = this.computeVisualStateRecursively(
					tree,
					node,
					selectedNodeIds,
					visualStates
				);
				visualStates[node.id ?? ''] = result.state;
			}
		});

		return visualStates;
	}

	private computeVisualState(directChildrenVisualStates: VisualState[]) {
		if (!directChildrenVisualStates || directChildrenVisualStates?.length == 0)
			return VisualState.selected;

		//if every child is selected or vs=true return true
		if (directChildrenVisualStates.every((state: VisualState) => state === VisualState.selected)) {
			return VisualState.selected;
		}
		//at least sone child is selected or indeterminate
		else if (
			directChildrenVisualStates.some(
				(state: VisualState) =>
					state === VisualState.selected || state === VisualState.indeterminate
			)
		) {
			return VisualState.indeterminate;
		} else {
			return VisualState.notSelected;
		}
	}

	/**
	 * Computes visual state from leaf to node
	 * @param tree
	 * @param filteredTree
	 * @param node
	 * @returns New visual state for node
	 */
	private computeVisualStateRecursively(
		tree: Tree,
		node: Node,
		selectedNodeIds: (string | number)[],
		visualStates: TreeVisualStates
	): { state: VisualState; ignore: boolean } {
		const directChildren = this.getSelectableDirectChildren(tree, node.path);

		const directChildrenStates: VisualState[] = [];
		// using recustion compute from leaft nodes to root
		directChildren.forEach((child: Node) => {
			if (!child.hasChildren) {
				const childState = selectedNodeIds.includes(child.id ?? '')
					? VisualState.selected
					: VisualState.notSelected;

				directChildrenStates.push(childState);

				return;
			}

			const result = this.computeVisualStateRecursively(tree, child, selectedNodeIds, visualStates);
			visualStates[child.id ?? ''] = result.state;

			if (!result.ignore) {
				directChildrenStates.push(result.state);
			}
		});

		// if no children, all are selected, but dont count it for recursive computationq
		const ignore = directChildrenStates.length === 0;

		return { ignore, state: this.computeVisualState(directChildrenStates) };
	}

	private changeSelectedRecursively(
		tree: Tree,
		parentNodePath: string | null,
		changeTo: boolean,
		oldSelection: NodeId[]
	): NodeId[] {
		let newSelection = [...oldSelection];

		tree.forEach((node) => {
			// match itself and all children
			if (
				node.path?.startsWith(parentNodePath ? parentNodePath + this.helper.config.separator : '')
			) {
				//dont change if not selectable
				if (!isSelectable(node, SelectionModes.all)) {
					return;
				}

				// in recursive mode only update leaf nodes
				if (this.recursiveMode && node.hasChildren) {
					return;
				}

				// prevent double selection
				newSelection = newSelection.filter((x) => x !== node.id ?? '');

				if (changeTo === true) {
					newSelection.push(node.id ?? '');
				}
			}
		});

		return newSelection;
	}
}

export function isSelectable(node: Node, showCheckboxes: SelectionModes) {
	if (showCheckboxes === SelectionModes.all) {
		return node.checkbox !== false;
	}
	//show only if pop is true
	if (showCheckboxes === SelectionModes.perNode) {
		return node.checkbox === true;
	}
	//dont show at all
	return false;
}
