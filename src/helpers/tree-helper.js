import orderBy from "lodash.unionby"; // used by tree merge
import { SelectionHelper } from "./selection-helpers";
import { DragAndDropHelper } from "./drag-drop-helpers";

export class TreeHelper {
	constructor(propNames) {
		this.props = propNames;
		this.selection = new SelectionHelper(this);
		this.dragDrop = new DragAndDropHelper(this);
	}

	path(node) {
		return node?.[this.props.nodePath];
	}

	//#region basic helpres

	getParentNodePath(nodePath) {
		return nodePath?.substring(0, nodePath.lastIndexOf("."));
	}

	hasChildren(tree, nodePath) {
		return tree?.find((x) => this.getParentNodePath(this.path(x)) === nodePath);
	}

	findNode(tree, nodePath) {
		return tree.find((node) => this.path(node) === nodePath);
	}

	nodePathIsChild(nodePath) {
		return !nodePath || !!(nodePath.match(/\./g) || []).length;
	}

	getDirectChildren(tree, parentId) {
		return (tree || []).filter((x) =>
			!parentId
				? !this.nodePathIsChild(this.path(x))
				: this.getParentNodePath(this.path(x)) === parentId
		);
	}

	allCHildren(tree, parentId) {
		let children;
		children = tree.filter((x) => {
			if (!parentId) {
				//top level
				return !this.nodePathIsChild(this.path(x));
			} else {
				return (
					this.path(x).startsWith(parentId.toString()) &&
					this.path(x) != parentId
				);
			}
		});
		return children;
	}

	getAllLeafNodes(tree) {
		return tree.filter((x) => {
			return (
				x[this.props.hasChildren] == undefined ||
				x[this.props.hasChildren] == false
			);
		});
	}

	joinTrees(filteredTree, tree) {
		return tree.map(
			(tnode) => findNode(filteredTree, this.path(tnode)) || tnode
		);
	}

	mergeTrees(oldTree, addedTree, nodePath = "nodePath") {
		return orderBy(addedTree, oldTree, nodePath);
	}

	/** toggles expansion on
	 */
	changeExpansion(tree, node, changeTo) {
		let foundNode = this.findNode(tree, this.path(node));

		foundNode[this.props.expanded] = changeTo;
	}

	/** changes expansion of every node that has this.hasChildren set to true
	 */
	changeEveryExpansion(tree, changeTo) {
		return tree.map((node) => {
			if (node[this.props.hasChildren] == true)
				node[this.props.expanded] = changeTo;
			return node;
		});
	}

	/** changes expansion of every node that has this.hasChildren set to true if they are abose set level and expansion property isnt set
	 */
	expandToLevel(tree, level) {
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
	getDepthLevel(nodePath) {
		return nodePath.split(".").length - 1;
	}

	//#endregion

	searchTree(tree, filter, leafesOnly) {
		let filteredNodes;
		if (leafesOnly) {
			filteredNodes = this.getAllLeafNodes(tree).filter(filter);
		} else {
			console.log(tree);
			filteredNodes = tree.filter(filter);
		}

		const resultNodes = [];

		//console.log("matching nodes length:" + matchingPathes.length)
		filteredNodes.forEach((node) => {
			resultNodes.push(node);

			const parentNodes = this.getParents(tree, node);
			resultNodes.push(...parentNodes);
		});

		const uniqueNodes = unique(resultNodes, (node) => this.path(node));

		return uniqueNodes;
	}

	getParents(tree, node) {
		const parentsPaths = [];

		let nodePath = this.path(node);

		// get all parents
		while (nodePath.length > 0) {
			nodePath = this.getParentNodePath(nodePath);
			parentsPaths.push(nodePath);
		}

		//find nodes for given ids
		const parentNodes = tree.filter((n) =>
			parentsPaths.some((parentId) => this.path(n) === parentId)
		);

		return parentNodes;
	}
}

export default (...args) => {
	// TODO redundant now, maybe remove
	let helper = new TreeHelper(...args);
	return helper;
};
