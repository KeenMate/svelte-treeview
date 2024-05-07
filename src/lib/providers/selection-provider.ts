import type { PropertyHelper } from '$lib/helpers/property-helper.js';
import type { TreeHelper } from '$lib/helpers/tree-helper.js';
import {
	SelectionModes,
	type Node,
	type NodePath,
	type Tree,
	VisualState,
	type TreeVisualStates,
	type NodeId
} from '$lib/types.js';

export class SelectionProvider {
	helper: TreeHelper;
	props: PropertyHelper;
	recursiveMode: boolean;

	constructor(treeHelper: TreeHelper, recursive: boolean) {
		this.helper = treeHelper;
		this.props = treeHelper.props;
		this.recursiveMode = recursive;
	}

	private path(node: Node): NodePath {
		return this.helper.path(node);
	}

	isNodeSelected(node: Node): boolean {
		return (
			this.props.selected(node) === true || this.props.visualState(node) === VisualState.selected
		);
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
			.filter((node: Node) => this.isSelectable(node, SelectionModes.all));
	}

	setSelection(
		tree: Tree,
		nodePath: NodePath,
		changeTo: boolean,
		oldSelection: NodeId[]
	): NodeId[] {
		const node = this.helper.findNode(tree, nodePath);
		const nodeHasChildren = node ? this.props.hasChildren(node) : false;
		// allow selection of root node
		if (nodePath === null || (this.recursiveMode && nodeHasChildren)) {
			return this.changeSelectedRecursively(tree, nodePath, changeTo, oldSelection);
		} else {
			if (!node) {
				// throw new Error('Node not found ' + nodePath);
				console.warn('Node %s doesnt exits', nodePath);
				return oldSelection;
			}

			// prevent double selection
			const filteredSelection = oldSelection.filter((x) => x !== this.props.id(node));

			if (changeTo === false) {
				return filteredSelection;
			}

			return [...filteredSelection, this.props.id(node) ?? ''];
		}
	}

	/** Computes visual states for all nodes. Used for computing initial visual states when tree changes  */
	computeVisualStates(tree: Tree, selectedNodeIds: (string | number)[]) {
		const visualStates: TreeVisualStates = {};

		// TODO is this really the case?
		// if some node is not selectable, are all its children also not selectable?

		const rootELements = this.getSelectableDirectChildren(tree, null);
		rootELements.forEach((node: Node) => {
			if (this.props.hasChildren(node) == true) {
				const result = this.computeVisualStateRecursively(
					tree,
					node,
					selectedNodeIds,
					visualStates
				);
				visualStates[this.props.id(node) ?? ''] = result.state;
			}
		});

		return visualStates;
	}

	isSelectable(node: Node, showCheckboxes: SelectionModes) {
		if (showCheckboxes === SelectionModes.all) {
			return this.props.checkbox(node) !== false;
		}
		//show only if pop is true
		if (showCheckboxes === SelectionModes.perNode) {
			return this.props.checkbox(node) === true;
		}
		//dont show at all
		return false;
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
		const directChildren = this.getSelectableDirectChildren(tree, this.path(node));

		const directChildrenStates: VisualState[] = [];
		// using recustion compute from leaft nodes to root
		directChildren.forEach((child: Node) => {
			if (!this.props.hasChildren(child)) {
				const childState = selectedNodeIds.includes(this.props.id(child) ?? '')
					? VisualState.selected
					: VisualState.notSelected;

				directChildrenStates.push(childState);

				return;
			}

			const result = this.computeVisualStateRecursively(tree, child, selectedNodeIds, visualStates);
			visualStates[this.props.id(child) ?? ''] = result.state;

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
		parentNodePath: NodePath,
		changeTo: boolean,
		oldSelection: NodeId[]
	): NodeId[] {
		let newSelection = [...oldSelection];

		tree.forEach((node) => {
			// match itself and all children
			if (this.path(node)?.startsWith(parentNodePath ?? '')) {
				//dont change if not selectable
				if (!this.isSelectable(node, SelectionModes.all)) {
					return;
				}

				// in recursive mode only update leaf nodes
				if (this.recursiveMode && this.props.hasChildren(node)) {
					return;
				}

				// prevent double selection
				newSelection = newSelection.filter((x) => x !== this.props.id(node) ?? '');

				if (changeTo === true) {
					newSelection.push(this.props.id(node) ?? '');
				}
			}
		});

		return newSelection;
	}
}
