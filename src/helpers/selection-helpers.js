import { checkboxesType, visualStateType } from "../consts";

export class SelectionHelper {
	constructor(treeHelper) {
		this.helper = treeHelper;
		this.props = treeHelper.props;
	}

	path(node) {
		return this.helper.path(node);
	}
	selected(node) {
		return node[this.props.selected];
	}

	getChildrenWithCheckboxes(tree, parentNodePath) {
		return this.helper
			.getDirectChildren(tree, parentNodePath)
			.filter((node) => this.isSelectable(node, checkboxesType.all));
	}

	changeSelection(tree, nodePath, filteredTree) {
		this.toggleSelected(tree, nodePath);

		const recursive = this.helper.config?.recursive ?? false;

		if (recursive) {
			tree = this.recomputeAllParentVisualState(tree, filteredTree, nodePath);
		}

		return tree;
	}

	toggleSelected(tree, nodePath) {
		const node = this.helper.findNode(tree, nodePath);

		node[this.props.selected] = !node[this.props.selected];
	}

	changeSelectedForChildren(tree, parentNodePath, changeTo, filteredTree) {
		console.log(parentNodePath);
		tree = tree.map((node) => {
			//changes itself
			if (parentNodePath == this.path(node)) {
				this.updateLeafNodeSelection(node, changeTo);
			}

			if (!parentNodePath) {
				// TODO i think this isnt working
				// this only updates

				//top level
				this.updateLeafNodeSelection(node, changeTo);
			} else {
				//if parentNodePath isnt root
				if (
					this.path(node).startsWith(parentNodePath.toString()) &&
					this.path(node) != parentNodePath.toString()
				) {
					this.updateLeafNodeSelection(node, changeTo);
				}
			}
			return node;
		});

		tree = this.recomputeAllParentVisualState(
			tree,
			filteredTree,
			parentNodePath
		);
		return tree;
	}

	//changes selected or visual state depending on
	updateLeafNodeSelection(node, changeTo) {
		//dont change if not selectable
		if (!this.isSelectable(node, checkboxesType.all)) {
			return;
		}
		if (!node[this.props.hasChildren]) {
			node[this.props.selected] = changeTo;
		} else {
			node.__visual_state = changeTo.toString();
		}
	}

	/**Calculates visual state based on children  */
	getVisualState(filteredTree, node) {
		const children = this.getChildrenWithCheckboxes(
			filteredTree,
			this.path(node)
		);

		if (!children || children?.length == 0) return visualStateType.notSelected;

		//if every child is selected or vs=true return true
		if (
			children.every(
				(x) =>
					x[this.props.selected] === true ||
					x.__visual_state === visualStateType.selected
			)
		) {
			return visualStateType.selected;
		}
		//at least sone child is selected or indeterminate
		else if (
			children.some((x) => {
				return (
					x[this.props.selected] === true ||
					x.__visual_state === visualStateType.indeterminate ||
					x.__visual_state === visualStateType.selected
				);
			})
		) {
			return visualStateType.indeterminate;
		} else {
			return visualStateType.notSelected;
		}
	}

	/** recursibly recomputes parent visual state until root */
	recomputeAllParentVisualState(tree, filteredTree, nodePath) {
		const parent = this.helper.getParentNodePath(nodePath);

		let newstate;
		filteredTree.forEach((x) => {
			if (this.path(x) == parent) {
				newstate = this.getVisualState(filteredTree, x);
				x.__visual_state = newstate;
			}
		});
		if (this.helper.getParentNodePath(parent) != "") {
			tree = this.recomputeAllParentVisualState(tree, filteredTree, parent);
		}
		return tree;
	}

	/** Computes visual states for all nodes. Used for computing initial visual states when tree changes  */
	computeInitialVisualStates(tree, filteredTree) {
		let rootELements = this.getChildrenWithCheckboxes(tree, null);
		rootELements.forEach((x) => {
			if (x[this.props.hasChildren] == true) {
				tree = this.computeChildrenVisualStates(tree, filteredTree, x);
				x.__visual_state = this.getVisualState(filteredTree, x);
			}
		});
		return tree;
	}
	/** Recursivly computes visual state for children  */
	computeChildrenVisualStates(tree, filteredTree, node) {
		let children = this.getChildrenWithCheckboxes(tree, this.path(node));
		//foreaches all children if it has children, it calls itself, then it computes __vs => will compute from childern to parent
		children.forEach((x) => {
			if (x[this.props.hasChildren] == true) {
				tree = this.computeChildrenVisualStates(tree, filteredTree, x);
				x.__visual_state = this.getVisualState(filteredTree, x);
			}
		});
		return tree;
	}

	deleteSelected(tree) {
		return tree.map((node) => {
			node[this.props.selected] = false;
			node.__visual_state = undefined;
			return node;
		});
	}

	isSelectable(node, showCheckboxes) {
		if (showCheckboxes == checkboxesType.all) {
			return node[this.props.checkbox] !== false;
		}
		//show only if pop is true
		if (showCheckboxes == checkboxesType.perNode) {
			return node[this.props.checkbox] === true;
		}
		//dont show at all
		return false;
	}
}
