import type { PropertyHelper } from '$lib/helpers/property-helper.js';
import type { TreeHelper } from '$lib/helpers/tree-helper.js';
import { SelectionModes, type Node, type NodePath, type Tree, VisualStates } from '$lib/types.js';

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

	isSelected(node: Node): boolean {
		return (
			this.props.selected(node) === true || this.props.visualState(node) === VisualStates.selected
		);
	}

	getSelectableDirectChildren(tree: Tree, parentNodePath: string | null) {
		return this.helper
			.getDirectChildren(tree, parentNodePath)
			.filter((node: Node) => this.isSelectable(node, SelectionModes.all));
	}

	setSelection(tree: Tree, nodePath: NodePath, changeTo: boolean) {
		const node = this.helper.findNode(tree, nodePath);

		// allow selection of root node
		if ((this.recursiveMode && this.props.hasChildren(node)) || nodePath === null) {
			this.changeSelectedRecursively(tree, nodePath, changeTo);
		} else {
			if (!node) {
				// throw new Error('Node not found ' + nodePath);
				console.warn('Node %s doesnt exits', nodePath);
				return;
			}
			this.props.setSelected(node, changeTo);
		}
	}

	private changeSelectedRecursively(tree: Tree, parentNodePath: NodePath, changeTo: boolean) {
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

				this.props.setSelected(node, changeTo);
			}
		});
	}

	/** Computes visual states for all nodes. Used for computing initial visual states when tree changes  */
	recomputeAllVisualStates(tree: Tree) {
		// TODO is this really the case?
		// if some node is not selectable, are all its children also not selectable?

		const rootELements = this.getSelectableDirectChildren(tree, null);
		rootELements.forEach((x: Node) => {
			if (this.props.hasChildren(x) == true) {
				const result = this.computeVisualStateRecursively(tree, x);
				this.props.setVisualState(x, result.state);
			}
		});
	}

	deleteSelected(tree: Tree) {
		return tree.forEach((node: Node) => {
			this.props.setSelected(node, false);
			this.props.setVisualState(node, null);
		});
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

	private computeVisualStates(directChildrenVisualStates: VisualStates[]) {
		if (!directChildrenVisualStates || directChildrenVisualStates?.length == 0)
			return VisualStates.selected;

		//if every child is selected or vs=true return true
		if (
			directChildrenVisualStates.every((state: VisualStates) => state === VisualStates.selected)
		) {
			return VisualStates.selected;
		}
		//at least sone child is selected or indeterminate
		else if (
			directChildrenVisualStates.some(
				(state: VisualStates) =>
					state === VisualStates.selected || state === VisualStates.indeterminate
			)
		) {
			return VisualStates.indeterminate;
		} else {
			return VisualStates.notSelected;
		}
	}

	/** recursibly recomputes parent visual state until root */
	private recomputeParentVisualState(tree: Tree, filteredTree: Tree, nodePath: NodePath) {
		// no need to recompute state for root
		if (nodePath === null) {
			return;
		}

		// TODO maybe check that this node have children

		const parentNode = this.helper.findNode(tree, nodePath);
		const directChildren = this.helper.getDirectChildren(tree, nodePath);
		const directChildrenVisualStates: VisualStates[] = directChildren.map((node: Node) =>
			this.getVisualState(node)
		);

		const newState = this.computeVisualStates(directChildrenVisualStates);
		this.props.setVisualState(parentNode, newState);

		// use recursion, because we need to traverse from node to root
		const ParentPath = this.helper.getParentNodePath(nodePath);

		this.recomputeParentVisualState(tree, filteredTree, ParentPath);
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
		node: Node
	): { state: VisualStates; ignore: boolean } {
		const directChildren = this.getSelectableDirectChildren(tree, this.path(node));

		const directChildrenStates: VisualStates[] = [];
		// using recustion compute from leaft nodes to root
		directChildren.forEach((child: Node) => {
			if (!this.props.hasChildren(child)) {
				const childState = this.isSelected(child)
					? VisualStates.selected
					: VisualStates.notSelected;

				directChildrenStates.push(childState);

				return;
			}

			const result = this.computeVisualStateRecursively(tree, child);
			this.props.setVisualState(child, result.state);

			if (!result.ignore) {
				directChildrenStates.push(result.state);
			}
		});

		// if no children, all are selected, but dont count it for recursive computationq
		const ignore = directChildrenStates.length === 0;

		return { ignore, state: this.computeVisualStates(directChildrenStates) };
	}

	private getVisualState(node: Node) {
		if (this.props.hasChildren(node)) {
			return this.props.visualState(node) ?? VisualStates.notSelected;
		}

		return this.isSelected(node) ? VisualStates.selected : VisualStates.notSelected;
	}
}
