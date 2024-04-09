import unionby from 'lodash.unionby'; // used by tree merge
import { SelectionHelper } from './selection-helpers.js';
import { DragAndDropHelper } from './drag-drop-helpers.js';
import type { Node, NodePath, HelperConfig, Tree } from '$lib/types.js';
import type { PropertyHelper } from '$lib/helpers/property-helper.js';
import { getParentNodePath, isChildrenOf, nodePathIsChild } from '$lib/helpers/nodepath-helpers.js';

export class TreeHelper {
	props: PropertyHelper;
	config: HelperConfig;

	constructor(props: PropertyHelper, config: HelperConfig = { separator: '.' }) {
		this.props = props;
		this.config = config;
	}

	/**
	 * Verifies that node has at least one child in the tree
	 */
	hasChildrenInTree(tree: Node[], nodePath: NodePath): boolean {
		return (
			tree?.find(
				(x) => getParentNodePath(this.props.path(x), this.config.separator) === nodePath
			) !== null
		);
	}

	findNode(tree: Node[], nodePath: NodePath): Node {
		return tree.find((node) => this.props.path(node) === nodePath) ?? null;
	}

	getDirectChildren(tree: Node[], parentNodePath: NodePath) {
		const children = (tree || []).filter((x) =>
			!parentNodePath
				? !nodePathIsChild(this.props.path(x), this.config.separator)
				: getParentNodePath(this.props.path(x), this.config.separator) === parentNodePath
		);

		return this.orderByPriority(children);
	}

	allCHildren(tree: Node[], parentNodePath: NodePath) {
		const children = tree.filter((x) => isChildrenOf(parentNodePath, this.props.path(x)));
		return children;
	}

	getAllLeafNodes(tree: Node[]) {
		return tree.filter((x) => {
			return this.props.hasChildren(x) == undefined || this.props.hasChildren(x) == false;
		});
	}

	mergeTrees(treeA: Node[], treeB: Node[]) {
		return unionby(treeB, treeA, this.props.props.nodePath);
	}

	/** changes expansion of every node that has this.hasChildren set to true
	 */
	changeEveryExpansion(tree: Node[], changeTo: boolean) {
		return tree.map((node) => {
			if (this.props.hasChildren(node) === true) {
				this.props.setExpanded(node, changeTo);
			}
			return node;
		});
	}

	/** orders nodes by priorityProp
	 */
	orderByPriority(tree: Tree) {
		// TODO investigata that it really works
		tree.sort((a: Node, b: Node) =>
			this.props.priority(b) ? this.props.priority(a) - this.props.priority(b) : 1
		);
		return tree;
	}
}
