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
		return node?.[this.props.nodePathProperty];
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

	getParentChildrenTree(tree, parentId) {
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
				x[this.props.hasChildrenProperty] == undefined ||
				x[this.props.hasChildrenProperty] == false
			);
		});
	}

	joinTrees(filteredTree, tree) {
		return tree.map(
			(tnode) => findNode(filteredTree, this.path(tnode)) || tnode
		);
	}

	mergeTrees(oldTree, addedTree, nodePathProperty = "nodePath") {
		return orderBy(addedTree, oldTree, nodePathProperty);
	}

	/** toggles expansion on
	 */
	changeExpansion(tree, node, changeTo) {
		return tree.map((x) => {
			let t = x;
			if (this.path(x) == this.path(node)) {
				t[this.props.expandedProperty] = changeTo;
			}
			return t;
		});
	}

	/** changes expansion of every node that has this.hasChildren set to true
	 */
	changeEveryExpansion(tree, changeTo) {
		return tree.map((node) => {
			if (node[this.props.hasChildrenProperty] == true)
				node[this.props.expandedProperty] = changeTo;
			return node;
		});
	}

	/** changes expansion of every node that has this.hasChildren set to true if they are abose set level and expansion property isnt set
	 */
	expandToLevel(tree, level) {
		return tree.map((n) => {
			if (
				n[this.props.expandedProperty] == undefined &&
				n[this.props.expandedProperty] == null &&
				n[this.props.useCallbackProperty] != true &&
				this.getDepthLevel(this.path(n)) <= level
			) {
				n[this.props.expandedProperty] = true;
			}
			return n;
		});
	}

	//based on number of dots
	getDepthLevel(nodePath) {
		return nodePath.split(".").length - 1;
	}

	//#endregion

	//return filtered tree
	searchTree(tree, filter, recursive) {
		let result = [],
			matchingNodes = [];
		if (recursive) {
			matchingNodes = this.getAllLeafNodes(tree).filter(filter);
		} else {
			matchingNodes = tree.filter(filter);
		}
		//console.log("matching nodes length:" + matchingNodes.length)
		matchingNodes.forEach((node) => {
			result.push(node);
			result = this.addParents(tree, result, node);
		});
		//console.log(result)
		return result;
	}

	addParents(tree, result, node) {
		let parentsIds = [],
			parentNodes = [];
		if (result === undefined) result = [];
		let nodePath = this.path(node);
		while (nodePath.length > 0) {
			nodePath = this.getParentNodePath(nodePath);
			parentsIds.push(nodePath);
		}

		//finds nodes for ids
		tree.forEach((n) => {
			if (
				parentsIds.some((parentId) => {
					return this.path(n) === parentId;
				})
			) {
				parentNodes.push(n);
			}
		});
		//removes duplicate nodePaths
		parentNodes.forEach((n) => {
			if (
				result.findIndex((x) => {
					return this.path(n) === this.path(x);
				}) < 0
			)
				result.push(n);
		});

		return result;
	}
}

export default (...args) => {
	// TODO redundant now, maybe remove
	let helper = new TreeHelper(...args);
	return helper;
};
