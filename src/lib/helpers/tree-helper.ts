import orderBy from 'lodash.unionby'; // used by tree merge
import uniqueBy from 'lodash.uniqby'; // used by tree merge
import {
	type Node,
	type NodePath,
	type HelperConfig,
	type Tree,
	VisualState,
	type NodeId
} from '$lib/types.js';
import type { PropertyHelper } from '$lib/helpers/property-helper.js';
import { defaultConfig } from '$lib/constants.js';

export class TreeHelper {
	props: PropertyHelper;
	config: HelperConfig;

	constructor(props: PropertyHelper, config: HelperConfig = defaultConfig) {
		this.props = props;
		this.config = config;
	}

	// replace with this.props.path
	path(node: Node | null): NodePath {
		return this.props.path(node);
	}

	computeTree(
		tree: Tree,
		filter: (node: any) => boolean,
		expandedNodeIds: NodeId[],
		selectedNodeIds: NodeId[],
		visualStates: { [nodePath: string]: VisualState }
	): Tree {
		{
			return this.searchTree(tree, filter).map((node: any) => {
				const clonedNode = { ...node };
				const nodeId = this.props.id(clonedNode) ?? '';
				const expanded = expandedNodeIds.includes(nodeId);
				const selected = selectedNodeIds.includes(nodeId);

				const visualState: VisualState = visualStates[nodeId] ?? VisualState.notSelected;

				this.props.setExpanded(clonedNode, expanded);
				this.props.setSelected(clonedNode, selected);
				this.props.setVisualState(clonedNode, visualState);

				return clonedNode;
			});
		}
	}
	//#region basic helpres

	getParentNodePath(nodePath: NodePath): NodePath {
		if (nodePath == null) throw new Error('cannot get parent of root');

		const separator = this.config.separator ?? '.';
		const parentPath = nodePath?.substring(0, nodePath.lastIndexOf(separator));
		if (parentPath === '') return null;

		return parentPath ?? null;
	}

	isChildrenOf(parentNodePath: NodePath, childrenNodePath: NodePath) {
		if (parentNodePath === childrenNodePath) return false;

		return childrenNodePath?.startsWith(parentNodePath ?? '');
	}

	hasChildren(tree: Tree, nodePath: NodePath) {
		return tree?.find((x) => this.getParentNodePath(this.path(x)) === nodePath);
	}

	findNode(tree: Tree, nodePath: NodePath): Node | null {
		return tree.find((node) => this.path(node) === nodePath) ?? null;
	}

	nodePathIsChild(nodePath: NodePath) {
		const separator = this.config.separator ?? '.';

		const includesSeparator = nodePath?.includes(separator);
		return includesSeparator;
	}

	getDirectChildren(tree: Tree, parentNodePath: NodePath) {
		const children = (tree || []).filter((x) =>
			!parentNodePath
				? !this.nodePathIsChild(this.path(x))
				: this.getParentNodePath(this.path(x)) === parentNodePath
		);
		const ordered = this.orderByPriority(children);
		return ordered;
	}

	allCHildren(tree: Tree, parentNodePath: NodePath) {
		const children = tree.filter((x) => this.isChildrenOf(parentNodePath, this.path(x)));
		return children;
	}

	getAllLeafNodes(tree: Tree) {
		return tree.filter((x) => {
			return this.props.hasChildren(x) == undefined || this.props.hasChildren(x) == false;
		});
	}

	joinTrees(filteredTree: Tree, tree: Tree) {
		return tree.map((tnode) => this.findNode(filteredTree, this.path(tnode)) || tnode);
	}

	mergeTrees(oldTree: Tree, addedTree: Tree, nodePath = 'nodePath') {
		return orderBy(addedTree, oldTree, nodePath);
	}

	/** toggles expansion on
	 */
	changeExpansion(node: Node, changeTo: boolean, oldExpandedNodeIds: NodeId[]) {
		const nodeId = this.props.id(node) ?? '';

		if (changeTo === true) {
			return [...oldExpandedNodeIds, nodeId];
		}

		return oldExpandedNodeIds.filter((x) => x !== nodeId);
	}

	/** changes expansion of every node that has this.hasChildren set to true
	 */
	changeEveryExpansion(tree: Tree, changeTo: boolean) {
		return tree.map((node) => {
			if (this.props.hasChildren(node) == true) {
				this.props.setExpanded(node, changeTo);
			}
			return node;
		});
	}

	/** changes expansion of every node that has this.hasChildren set to true if they are abose set level and expansion property isnt set
	 */
	expandToLevel(tree: Tree, level: number) {
		return tree.map((n) => {
			if (
				this.props.expanded(n) == undefined &&
				this.props.expanded(n) == null &&
				this.props.useCallback(n) != true &&
				this.getDepthLevel(this.path(n)) <= level
			) {
				this.props.setExpanded(n, true);
			}
			return n;
		});
	}

	//based on number of dots
	getDepthLevel(nodePath: NodePath) {
		if (nodePath == null) return 0;

		const separator = this.config.separator ?? '.';
		return nodePath.split(separator).length - 1;
	}

	//#endregion

	searchTree(tree: Tree, filter: (node: unknown) => boolean) {
		const filteredNodes = tree.filter(filter);

		const resultNodes: Tree = [];

		// add all parents from each node
		// needed so that tree can be rendered
		filteredNodes.forEach((node) => {
			resultNodes.push(node);

			const parentNodes = this.getParents(tree, node);
			resultNodes.push(...parentNodes);
		});

		const uniqueNodes = uniqueBy(resultNodes, (node: Node) => this.path(node));

		return uniqueNodes;
	}

	getParents(tree: Tree, node: Node) {
		const parentsPaths: NodePath[] = [];

		let nodePath = this.path(node);

		// get all parents
		while (nodePath && nodePath.length > 0) {
			nodePath = this.getParentNodePath(nodePath);
			parentsPaths.push(nodePath);
		}

		//find nodes for given ids
		const parentNodes = tree.filter((n) =>
			parentsPaths.some((parentNodePath) => this.path(n) === parentNodePath)
		);

		return parentNodes;
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
