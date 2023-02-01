export class SelectionHelper {
	constructor(treeHelper) {
		this.helper = treeHelper;
		this.props = treeHelper.props;
	}

	path(node) {
		return this.helper.path(node);
	}

	ChangeSelection(
		recursiveely,
		tree,
		nodePath,

		filteredTree
	) {
		tree = this.addOrRemoveSelection(tree, nodePath);

		if (recursiveely) {
			tree = this.recomputeAllParentVisualState(
				tree,
				nodePath,

				filteredTree
			);
		}
		return tree;
	}

	addOrRemoveSelection(tree, nodePath) {
		console.log(tree);
		return tree.map((x) => {
			let t = x;
			if (this.path(x) == nodePath) {
				t[this.props.selected] = !x[this.props.selected];
				//t.__visual_state = !x[this.props.selected];
			}
			return t;
		});
	}

	ChangeSelectForAllChildren(
		tree,
		parentId,

		changeTo,

		filteredTree
	) {
		tree = tree.map((x) => {
			//changes itself
			if (parentId == this.path(x)) {
				x = this.changeSelectedIfNParent(x, changeTo);
			}

			if (!parentId) {
				//top level
				if (!this.helper.nodePathIsChild(this.path(x))) {
					x = this.changeSelectedIfNParent(x, changeTo);
				}
			} else {
				//if parentId isnt root
				if (
					this.path(x).startsWith(parentId.toString()) &&
					this.path(x) != parentId.toString()
				) {
					x = this.changeSelectedIfNParent(x, changeTo);
				}
			}
			return x;
		});
		tree = this.recomputeAllParentVisualState(
			tree,
			parentId,

			filteredTree
		);
		return tree;
	}

	//changes selected or visual state depending on
	changeSelectedIfNParent(node, changeTo) {
		if (!node[this.props.hasChildren]) {
			node[this.props.selected] = changeTo;
		} else {
			node.__visual_state = changeTo.toString();
		}
		return node;
	}

	/**Calculates visual state based on children  */
	getVisualState(filteredTree, node) {
		let children = this.helper.getParentChildrenTree(
			filteredTree,
			this.path(node)
		);

		if (!children || children?.length == 0) return "false";

		//if every child is selected or vs=true return true
		if (
			children.every((x) => {
				return (
					x[this.props.selected] === true || x.__visual_state === "true"
				);
			})
		) {
			return "true";
		}
		//not every child but at least one return indeterminate
		else if (
			children.some((x) => {
				return (
					x[this.props.selected] === true ||
					x.__visual_state === "indeterminate" ||
					x.__visual_state === "true"
				);
			})
		) {
			return "indeterminate";
		} else {
			return "false";
		}
	}

	/** recursibly recomputes parent visual state until root */
	recomputeAllParentVisualState(
		tree,
		nodePath,

		filteredTree
	) {
		console.log(nodePath);
		let parent = this.helper.getParentNodePath(nodePath);

		let newstate;
		filteredTree.forEach((x) => {
			if (this.path(x) == parent) {
				newstate = this.getVisualState(filteredTree, x);
				x.__visual_state = newstate;
				//console.log("recomputing" + parent + " ->" + newstate);
			}
		});
		if (this.helper.getParentNodePath(parent) != "") {
			tree = this.recomputeAllParentVisualState(
				tree,
				parent,

				filteredTree
			);
		}
		return tree;
	}

	/** Computes visual states for all nodes. Used for computing initial visual states when tree changes  */
	computeInitialVisualStates(
		tree,

		filteredTree
	) {
		let rootELements = this.helper.getParentChildrenTree(tree, null);
		rootELements.forEach((x) => {
			if (x[this.props.hasChildren] == true) {
				tree = this.computeChildrenVisualStates(
					tree,
					x,

					filteredTree
				);
				x.__visual_state = this.getVisualState(filteredTree, x);
			}
		});
		return tree;
	}
	/** Recursivly computes visual state for children  */
	computeChildrenVisualStates(
		tree,
		node,

		filteredTree
	) {
		let children = this.helper.getParentChildrenTree(tree, this.path(node));
		//foreaches all children if it has children, it calls itself, then it computes __vs => will compute from childern to parent
		children.forEach((x) => {
			if (x[this.props.hasChildren] == true) {
				tree = this.computeChildrenVisualStates(tree, x, filteredTree);
				x.__visual_state = this.getVisualState(filteredTree, x);
			}
		});
		return tree;
	}

	deleteSelected(tree) {
		return tree.map((t) => {
			let x = t;
			x[this.props.selected] = false;
			x.__visual_state = undefined;
			return x;
		});
	}
}
