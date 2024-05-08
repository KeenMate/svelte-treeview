import orderBy from 'lodash.unionby'; // used by tree merge
import uniqueBy from 'lodash.uniqby'; // used by tree merge
import {
	type Node,
	type NodePath,
	type HelperConfig,
	type Tree,
	VisualState,
	type NodeId,
	type Props,
	type FilterFunction
} from '$lib/types.js';
import { defaultConfig } from '$lib/constants.js';

export class TreeHelper {
	config: HelperConfig;

	constructor(config: HelperConfig = defaultConfig) {
		this.config = config;
	}

	mapTree(tree: Tree, filter: FilterFunction | null, properties: Props): Node[] {
		{
			return this.searchTree(tree, filter).map((node: any) => {
				// TODO maybe create class for nodes
				const mappedNode: Node = {
					originalNode: node,
					id: node[properties.nodeId],
					path: node[properties.nodePath],
					hasChildren: node[properties.hasChildren],
					useCallback: node[properties.useCallback],
					priority: node[properties.priority],
					isDraggable: node[properties.isDraggable],
					insertDisabled: node[properties.insertDisabled],
					nestDisabled: node[properties.nestDisabled],
					checkbox: node[properties.checkbox],
					expanded: false,
					selected: false,
					visualState: VisualState.notSelected
				};
				return mappedNode;
			});
		}
	}

	markExpanded(tree: Tree, expandedNodeIds: NodeId[]) {
		{
			tree.forEach((node: any) => {
				node.expanded = expandedNodeIds.includes(node.id ?? '');
			});
		}
	}

	//#region basic helpres

	getParentNodePath(nodePath: NodePath): NodePath {
		if (nodePath == null) throw new Error('cannot get parent of root');

		const separator = this.config.separator;
		const parentPath = nodePath?.substring(0, nodePath.lastIndexOf(separator));
		if (parentPath === '') return null;

		return parentPath ?? null;
	}

	isChildrenOf(parentNodePath: NodePath, childrenNodePath: NodePath) {
		if (parentNodePath === childrenNodePath) return false;

		return childrenNodePath?.startsWith(parentNodePath ?? '');
	}

	hasChildren(tree: Tree, nodePath: NodePath) {
		return tree?.find((x) => this.getParentNodePath(x.path) === nodePath);
	}

	findNode(tree: Tree, nodePath: NodePath): Node | null {
		return tree.find((node) => node.path === nodePath) ?? null;
	}

	nodePathIsChild(nodePath: NodePath) {
		const separator = this.config.separator;

		const includesSeparator = nodePath?.includes(separator);
		return includesSeparator;
	}

	getDirectChildren(tree: Tree, parentNodePath: NodePath) {
		const children = tree.filter((node) =>
			!parentNodePath
				? !this.nodePathIsChild(node.path)
				: this.getParentNodePath(node.path) === parentNodePath
		);
		const ordered = this.orderByPriority(children);
		return ordered;
	}

	allCHildren(tree: Tree, parentNodePath: NodePath) {
		const children = tree.filter((node) => this.isChildrenOf(parentNodePath, node.path));
		return children;
	}

	getAllLeafNodes(tree: Tree) {
		return tree.filter((node) => {
			return node.hasChildren !== true;
		});
	}

	joinTrees(filteredTree: Tree, tree: Tree) {
		return tree.map((node) => this.findNode(filteredTree, node.path) || node);
	}

	mergeTrees(oldTree: Tree, addedTree: Tree, nodePath = 'nodePath') {
		return orderBy(addedTree, oldTree, nodePath);
	}

	/** toggles expansion on
	 */
	changeExpansion(node: Node, changeTo: boolean, oldExpandedNodeIds: NodeId[]) {
		const nodeId = node.id ?? '';

		if (changeTo === true) {
			return [...oldExpandedNodeIds, nodeId];
		}

		return oldExpandedNodeIds.filter((x) => x !== nodeId);
	}

	/** changes expansion of every node that has this.hasChildren set to true if they are abose set level and expansion property isnt set
	 */
	expandToLevel(tree: Tree, level: number): NodeId[] {
		return tree
			.filter(
				(node) =>
					node.expanded == undefined &&
					node.expanded == null &&
					node.useCallback != true &&
					this.getDepthLevel(node.path) <= level
			)
			.map((node) => node.id ?? '');
	}

	//based on number of dots
	getDepthLevel(nodePath: NodePath) {
		if (nodePath == null) return 0;

		const separator = this.config.separator;
		return nodePath.split(separator).length - 1;
	}

	//#endregion

	searchTree(tree: Tree, filter: FilterFunction | null) {
		if (!filter) return tree;
		const filteredNodes = tree.filter(filter);

		const resultNodes: Tree = [];

		// add all parents from each node
		// needed so that tree can be rendered
		filteredNodes.forEach((node) => {
			resultNodes.push(node);

			const parentNodes = this.getParents(tree, node);
			resultNodes.push(...parentNodes);
		});

		const uniqueNodes = uniqueBy(resultNodes, (node: Node) => node.path);

		return uniqueNodes;
	}

	getParents(tree: Tree, targetNode: Node) {
		const parentsPaths: NodePath[] = [];

		let nodePath = targetNode.path;

		// get all parents
		while (nodePath && nodePath.length > 0) {
			nodePath = this.getParentNodePath(nodePath);
			parentsPaths.push(nodePath);
		}

		//find nodes for given ids
		const parentNodes = tree.filter((node) =>
			parentsPaths.some((parentNodePath) => node.path === parentNodePath)
		);

		return parentNodes;
	}

	/** orders nodes by priorityProp
	 */
	orderByPriority(tree: Tree) {
		// TODO investigata that it really works
		tree.sort((a: Node, b: Node) => (b.priority ? a.priority - b.priority : 1));
		return tree;
	}
}
