import orderBy from "lodash.unionby"; // used by tree merge

export class TreeHelper {
	constructor(propNames) {
		this.props = propNames;
	}

	path(node) {
		return node[this.props.nodePathProperty];
	}

	//#region basic helpres

	getParentNodePath(nodePath) {
		return nodePath?.substring(0, nodePath.lastIndexOf("."));
	}

	hasChildren(tree, nodePath) {
		return tree?.find((x) => this.getParentNodePath(this.path(x)) === nodePath);
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
			(tnode) =>
				filteredTree.find((fnode) => this.path(tnode) === this.path(fnode)) ||
				tnode
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

	/** orders nodes by priorityProp
	 */
	OrderByPriority(tree) {
		tree.sort((a, b) => {
			if (b[this.props.priorityProperty] > a[this.props.priorityProperty])
				return -1;
			return 1;
		});
		return tree;
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

	//#region selection

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
				t[this.props.selectedProperty] = !x[this.props.selectedProperty];
				//t.__visual_state = !x[this.props.selectedProperty];
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
				if (!this.nodePathIsChild(this.path(x))) {
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

	//changes selectedproperty or visual state depending on
	changeSelectedIfNParent(node, changeTo) {
		if (!node[this.props.hasChildrenProperty]) {
			node[this.props.selectedProperty] = changeTo;
		} else {
			node.__visual_state = changeTo.toString();
		}
		return node;
	}

	/**Calculates visual state based on children  */
	getVisualState(filteredTree, node) {
		let children = this.getParentChildrenTree(filteredTree, this.path(node));

		if (!children || children?.length == 0) return "false";

		//if every child is selected or vs=true return true
		if (
			children.every((x) => {
				return (
					x[this.props.selectedProperty] === true || x.__visual_state === "true"
				);
			})
		) {
			return "true";
		}
		//not every child but at least one return indeterminate
		else if (
			children.some((x) => {
				return (
					x[this.props.selectedProperty] === true ||
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
		let parent = this.getParentNodePath(nodePath);

		let newstate;
		filteredTree.forEach((x) => {
			if (this.path(x) == parent) {
				newstate = this.getVisualState(filteredTree, x);
				x.__visual_state = newstate;
				//console.log("recomputing" + parent + " ->" + newstate);
			}
		});
		if (this.getParentNodePath(parent) != "") {
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
		let rootELements = this.getParentChildrenTree(tree, null);
		rootELements.forEach((x) => {
			if (x[this.props.hasChildrenProperty] == true) {
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
		let children = this.getParentChildrenTree(tree, this.path(node));
		//foreaches all children if it has children, it calls itself, then it computes __vs => will compute from childern to parent
		children.forEach((x) => {
			if (x[this.props.hasChildrenProperty] == true) {
				tree = this.computeChildrenVisualStates(tree, x, filteredTree);
				x.__visual_state = this.getVisualState(filteredTree, x);
			}
		});
		return tree;
	}

	deleteSelected(tree) {
		return tree.map((t) => {
			let x = t;
			x[this.props.selectedProperty] = false;
			x.__visual_state = undefined;
			return x;
		});
	}

	//#endregion

	//#region drag and drop

	/**
	 * moves node from one parent to another
	 * @param {Object[]} tree - tree
	 * @param {nodePath} movedNodePath - nodepath of moved(dragged) node
	 * @param {nodePath} targetNodePath - nodepath of node where it should be moved ( either bellow it in priority or as child)
	 * @param {int} insType - if true, it will insert moved node as child of target node, if false, it will insert it bellow it in priority
	 * @param {boolean} recalculateNodePath - wont recalculare id of moved node, used when last part of nodePath is always unique
	 */
	moveNode(tree, movedNodePath, targetNodePath, insType, recalculateNodePath) {
		//console.log(insType);
		let nest = insType == 0;

		// if you are not nesting, you want to be on same level
		let parentNodePath = !nest
			? this.getParentNodePath(targetNodePath)
			: targetNodePath;

		//trying to move parent to child
		if (parentNodePath.startsWith(movedNodePath)) return;

		let insideParent =
			!nest &&
			this.getParentNodePath(movedNodePath) ==
				this.getParentNodePath(targetNodePath);
		let newParentNodePath = movedNodePath;

		//dont create new node if you only moved inside same parent
		if (!insideParent) {
			let nodeId;
			if (recalculateNodePath) {
				nodeId = this.getNextNodeId(tree, parentNodePath);
			} else {
				nodeId = movedNodePath.substring(
					this.getParentNodePath(movedNodePath)
						? this.getParentNodePath(movedNodePath).length + 1
						: 0
				);
			}
			newParentNodePath = (parentNodePath ? parentNodePath + "." : "") + nodeId;
		}

		//console.log(newParentNodePath);

		//* find target node
		let targetNode = tree.find((x) => this.path(x) == targetNodePath);
		let movedNode;

		//console.log("parentNodePath: " + newParentNodePath);

		tree = tree.map((node) => {
			//make sure that parent's haschild is set to true, so that children
			if (this.path(node) == parentNodePath) {
				node[this.props.hasChildrenProperty] = true;
				node[this.props.expandedProperty] = true;
			}

			//move moved nodes to new location ( if location is being changed)
			if (!insideParent && this.path(node).startsWith(movedNodePath)) {
				//replace old parent with new
				let newPath = this.path(node).replace(movedNodePath, newParentNodePath);
				//console.log(this.path(node) + " -> " + newPath);
				node[this.props.nodePathProperty] = newPath;
			}

			//if it is moved node
			if (this.path(node) == newParentNodePath) {
				movedNode = node;

				if (nest || targetNode[this.props.priorityProperty] != null) {
					let newpriority = 0;
					if (!nest) {
						//calculate next
						newpriority = targetNode[this.props.priorityProperty] ?? 0;
						if (insType == -1) {
							newpriority += 1;
						} else {
							//targetNode[this.props.priorityProperty] -= 1;
						}
					}

					//console.log("new priority:" + newpriority);

					this.InsertPriority(
						tree,
						parentNodePath,
						newParentNodePath,
						newpriority
					);

					node[this.props.priorityProperty] = newpriority;
				} else {
					//so old priority doesnt mess up orderring
					movedNode[this.props.priorityProperty] = undefined;
				}
			}
			return node;
		});

		//* insert node at right possition of array
		//

		let oldIndex = tree.findIndex((x) => this.path(x) == newParentNodePath);
		tree.splice(oldIndex, 1);

		let index = tree.findIndex((x) => this.path(x) == this.path(targetNode));

		//insert below expcept if inspos is 1

		tree.splice(index + (insType == 1 ? 0 : 1), 0, movedNode);

		//TODO maybe add option to setting this.hasChildren to false when moved last children

		//hide plus icon if parent of moved node doesnt have any more children
		let oldParent = tree.find(
			(x) => this.path(x) == this.getParentNodePath(movedNodePath)
		);

		//moved
		if (oldParent && !this.allCHildren(tree, this.path(oldParent)).length) {
			oldParent[this.props.hasChildrenProperty] = false;
		}

		return tree;
	}

	/** recomputes all priorities after inserted priority.F
	 * Also changes all priorities to be one apart (1,5,6 => 1,2,3)
	 */
	InsertPriority(tree, parentNode, movedNodePath, insertedPriority) {
		let nextPriority = insertedPriority + 1;
		this.OrderByPriority(this.allCHildren(tree, parentNode)).forEach((n) => {
			if (
				n[this.props.priorityProperty] >= insertedPriority &&
				this.path(n) != movedNodePath
			) {
				n[this.props.priorityProperty] = nextPriority++;
			}
		});
	}

	/** return biggest value of nodepath number that children are using +1 */
	getNextNodeId(tree, parentPath) {
		let max = 0;
		//findes biggest nodeNumber for
		this.allCHildren(tree, parentPath).forEach((node) => {
			let parent = this.getParentNodePath(this.path(node));
			if (parent == parentPath) {
				let num = this.path(node).substring(parent ? parent.length + 1 : 0);
				if (parseInt(num) >= parseInt(max)) max = num;
			}
		});
		return parseInt(max) + 1;
	}

	getInsertionPosition(e, element) {
		let targetCords = element.getBoundingClientRect();
		let half = targetCords.bottom - targetCords.height / 2;

		if (e.y < half) {
			return 1;
		}
		return -1;
	}

	huminifyInsType(insType) {
		switch (insType) {
			case 1:
				return "before";
			case 0:
				return "inside";
			case -1:
				return "after";
		}
	}

	//#endregion

	//#region searching

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

//#endregion
