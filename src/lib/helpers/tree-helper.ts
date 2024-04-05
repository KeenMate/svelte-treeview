import orderBy from 'lodash.unionby'; // used by tree merge
import uniqueBy from 'lodash.uniqby'; // used by tree merge
import { SelectionHelper } from './selection-helpers.js';
import { DragAndDropHelper } from './drag-drop-helpers.js';
import { defaultPropNames } from '$lib/constants.js';
import type { Node, Props } from '$lib/types.js';
export type HelperConfig = {
	separator?: string;
	recursive?: boolean;
};

export class TreeHelper {
	props: Props;
	config: HelperConfig;
	selection: SelectionHelper;
	dragDrop: DragAndDropHelper;

	constructor(propNames: Props, config = {}) {
		this.props = { ...defaultPropNames, ...propNames };
		this.config = config;
		this.selection = new SelectionHelper(this);
		this.dragDrop = new DragAndDropHelper(this);
	}

	path(node: Node | null): string {
		return node?.[this.props.nodePath];
	}

	//#region basic helpres

	getParentNodePath(nodePath: string) {
		const separator = this.config.separator ?? '.';
		const parentPath = nodePath?.substring(0, nodePath.lastIndexOf(separator));
		return parentPath;
	}

	hasChildren(tree: Node[], nodePath: string) {
		return tree?.find((x) => this.getParentNodePath(this.path(x)) === nodePath);
	}

	findNode(tree: Node[], nodePath: string) {
		return tree.find((node) => this.path(node) === nodePath);
	}

	nodePathIsChild(nodePath: string) {
		const separator = this.config.separator ?? '.';

		const includesSeparator = nodePath?.includes(separator);
		return includesSeparator;
	}

	getDirectChildren(tree: Node[], parentNodePath: string | null) {
		const children = (tree || []).filter((x) =>
			!parentNodePath
				? !this.nodePathIsChild(this.path(x))
				: this.getParentNodePath(this.path(x)) === parentNodePath
		);

		return children;
	}

	allCHildren(tree: Node[], parentNodePath: string) {
		const children = tree.filter((x) => {
			if (!parentNodePath) {
				//top level
				return !this.nodePathIsChild(this.path(x));
			} else {
				return this.path(x).startsWith(parentNodePath.toString()) && this.path(x) != parentNodePath;
			}
		});
		return children;
	}

	getAllLeafNodes(tree: Node[]) {
		return tree.filter((x) => {
			return x[this.props.hasChildren] == undefined || x[this.props.hasChildren] == false;
		});
	}

	joinTrees(filteredTree: Node[], tree: Node[]) {
		return tree.map((tnode) => this.findNode(filteredTree, this.path(tnode)) || tnode);
	}

	mergeTrees(oldTree: Node[], addedTree: Node[], nodePath = 'nodePath') {
		return orderBy(addedTree, oldTree, nodePath);
	}

	/** toggles expansion on
	 */
	changeExpansion(tree: Node[], node: Node, changeTo: boolean) {
		const foundNode = this.findNode(tree, this.path(node));

		foundNode[this.props.expanded] = changeTo;
	}

	/** changes expansion of every node that has this.hasChildren set to true
	 */
	changeEveryExpansion(tree: Node[], changeTo: boolean) {
		return tree.map((node) => {
			if (node[this.props.hasChildren] == true) node[this.props.expanded] = changeTo;
			return node;
		});
	}

	/** changes expansion of every node that has this.hasChildren set to true if they are abose set level and expansion property isnt set
	 */
	expandToLevel(tree: Node[], level: number) {
		return tree.map((n) => {
			if (
				n[this.props.expanded] == undefined &&
				n[this.props.expanded] == null &&
				n[this.props.useCallback] != true &&
				this.getDepthLevel(this.path(n)) <= level
			) {
				n[this.props.expanded] = true;
			}
			return n;
		});
	}

	//based on number of dots
	getDepthLevel(nodePath: string) {
		const separator = this.config.separator ?? '.';
		return nodePath.split(separator).length - 1;
	}

	//#endregion

	searchTree(tree: Node[], filter: (node: Node) => boolean, leafesOnly: boolean) {
		let filteredNodes;
		if (leafesOnly) {
			filteredNodes = this.getAllLeafNodes(tree).filter(filter);
		} else {
			console.log(tree);
			filteredNodes = tree.filter(filter);
		}

		const resultNodes: Node[] = [];

		//console.log("matching nodes length:" + matchingPathes.length)
		filteredNodes.forEach((node) => {
			resultNodes.push(node);

			const parentNodes = this.getParents(tree, node);
			resultNodes.push(...parentNodes);
		});

		const uniqueNodes = uniqueBy(resultNodes, (node) => this.path(node));

		return uniqueNodes;
	}

	getParents(tree: Node[], node: Node) {
		const parentsPaths: string[] = [];

		let nodePath = this.path(node);

		// get all parents
		while (nodePath.length > 0) {
			nodePath = this.getParentNodePath(nodePath);
			parentsPaths.push(nodePath);
		}

		//find nodes for given ids
		const parentNodes = tree.filter((n) =>
			parentsPaths.some((parentNodePath) => this.path(n) === parentNodePath)
		);

		return parentNodes;
	}
}
