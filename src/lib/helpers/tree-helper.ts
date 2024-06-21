import orderBy from 'lodash.unionby'; // used by tree merge
import uniqueBy from 'lodash.uniqby'; // used by tree merge
import {
	type Node,
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

	mapTree(tree: Tree, properties: Props): Node[] {
		{
			return tree.map((node: any) => {
				// TODO maybe create class for nodes
				const mappedNode: Node = {
					originalNode: node,
					id: node[properties.nodeId],
					path: node[properties.nodePath],
					hasChildren: node[properties.hasChildren] === true,
					useCallback: node[properties.useCallback] === true,
					priority: node[properties.priority],
					dragDisabled: node[properties.dragDisabled] === true,
					insertDisabled: node[properties.insertDisabled] === true,
					nestAllowed: node[properties.nestAllowed] === true,
					checkbox: node[properties.checkbox] ?? null,
					expanded: false,
					selected: false,
					visualState: VisualState.notSelected,
					dropDisabled: false
				};

				mappedNode.dropDisabled = mappedNode.insertDisabled && !mappedNode.nestAllowed;
				return mappedNode;
			});
		}
	}

	markExpanded(tree: Tree, expandedPaths: string[]) {
		{
			tree.forEach((node: Node) => {
				node.expanded = expandedPaths.includes(node.path ?? '');
			});
		}
	}

	//#region basic helpers

	getParentNodePath(nodePath: string): string | null {
		if (nodePath == null) throw new Error('cannot get parent of root');

		const separator = this.config.separator;
		const parentPath = nodePath?.substring(0, nodePath.lastIndexOf(separator));
		if (parentPath === '') return null;

		return parentPath ?? null;
	}

	isChildrenOf(parentNodePath: string | null, childrenNodePath: string) {
		if (parentNodePath === childrenNodePath) return false;

		return childrenNodePath?.startsWith(parentNodePath ?? '');
	}

	hasChildren(tree: Tree, nodePath: string) {
		return tree?.find((x) => this.getParentNodePath(x.path) === nodePath);
	}

	findNode(tree: Tree, nodePath: string): Node | null {
		return tree.find((node) => node.path === nodePath) ?? null;
	}

	nodePathIsChild(nodePath: string) {
		const separator = this.config.separator;

		const includesSeparator = nodePath?.includes(separator);
		return includesSeparator;
	}

	getDirectChildren(tree: Tree, parentNodePath: string | null) {
		const children = tree.filter((node) =>
			!parentNodePath
				? !this.nodePathIsChild(node.path)
				: this.getParentNodePath(node.path) === parentNodePath
		);
		const ordered = this.orderByPriority(children);
		return ordered;
	}

	allCHildren(tree: Tree, parentNodePath: string | null) {
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
	changeExpansion(
		targetNodePath: string,
		changeTo: boolean,
		previousExpandedPaths: string[]
	): string[] {
		// const nodeId = node.id ?? '';
		if (!targetNodePath) {
			return previousExpandedPaths;
		}

		if (changeTo === true) {
			return [...previousExpandedPaths, targetNodePath];
		}

		return previousExpandedPaths.filter((x) => x !== targetNodePath);
	}

	/**
	 * returns path of every node, that is at or above given depth level
	 */
	getNodesAbove(tree: Tree, depth: number): Node[] {
		return tree.filter((node) => this.getDepthLevel(node.path) <= depth);
	}

	//based on number of dots
	getDepthLevel(nodePath: string) {
		if (nodePath == null) return 0;

		const separator = this.config.separator;
		return nodePath.split(separator).length - 1;
	}

	//#endregion

	searchTree(tree: Tree, filter: FilterFunction | null): { count: number; tree: Tree } {
		if (!filter) return { count: tree.length, tree };
		const filteredNodes = tree.filter(filter);

		const resultNodes: Tree = [];

		// add all parents from each node
		// needed so that tree can be rendered
		filteredNodes.forEach((node) => {
			resultNodes.push(node);

			const parentNodes = this.getParents(tree, node);
			resultNodes.push(...parentNodes);
		});

		const uniqueNodes = uniqueBy(resultNodes, (node: Node) => node.path) as Tree;

		return { count: filteredNodes.length, tree: uniqueNodes };
	}

	getParentsPaths(targetNodePath: string): string[] {
		const parentsPaths: string[] = [];

		// TODO refactor
		let nodePath: string | null = targetNodePath;
		// get all parents
		while (nodePath !== null && nodePath !== '') {
			nodePath = this.getParentNodePath(nodePath as string);
			if (nodePath === null) {
				break;
			}
			parentsPaths.push(nodePath);
		}

		return parentsPaths;
	}

	getParents(tree: Tree, targetNode: Node): Node[] {
		if (!targetNode) {
			return [];
		}

		const parentsPaths = this.getParentsPaths(targetNode.path);

		//find nodes for given ids
		const parentNodes = tree.filter((node) =>
			parentsPaths.some((parentNodePath) => node.path === parentNodePath)
		);

		return parentNodes;
	}

	/** orders nodes by priorityProp
	 */
	orderByPriority(tree: Tree) {
		// TODO investigate that it really works
		tree.sort((a: Node, b: Node) => (b.priority ? a.priority - b.priority : 1));
		return tree;
	}
}
