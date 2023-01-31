import orderBy from "lodash.unionby"; // used by tree merge

export class TreeHelper {
	//#region basic helpres

	getParentNodePath(nodePath) {
		return nodePath?.substring(0, nodePath.lastIndexOf("."));
	}

	hasChildren(tree, nodePath, propNames) {
		return tree?.find(
			(x) => this.getParentNodePath(x[propNames.nodePathProperty]) === nodePath
		);
	}

	nodePathIsChild(nodePath) {
		return !nodePath || !!(nodePath.match(/\./g) || []).length;
	}

	getParentChildrenTree(tree, parentId, propNames) {
		return (tree || []).filter((x) =>
			!parentId
				? !this.nodePathIsChild(x[propNames.nodePathProperty])
				: this.getParentNodePath(x[propNames.nodePathProperty]) === parentId
		);
	}

	allCHildren(tree, parentId, propNames) {
		let children;
		children = tree.filter((x) => {
			if (!parentId) {
				//top level
				return !this.nodePathIsChild(x[propNames.nodePathProperty]);
			} else {
				return (
					x[propNames.nodePathProperty].startsWith(parentId.toString()) &&
					x[propNames.nodePathProperty] != parentId
				);
			}
		});
		return children;
	}

	getAllLeafNodes(tree, propNames) {
		return tree.filter((x) => {
			return (
				x[propNames.hasChildrenProperty] == undefined ||
				x[propNames.hasChildrenProperty] == false
			);
		});
	}

	joinTrees(filteredTree, tree, propNames) {
		return tree.map(
			(tnode) =>
				filteredTree.find(
					(fnode) =>
						tnode[propNames.nodePathProperty] ===
						fnode[propNames.nodePathProperty]
				) || tnode
		);
	}

	mergeTrees(oldTree, addedTree, nodePathProperty = "nodePath") {
		return orderBy(addedTree, oldTree, nodePathProperty);
	}

	/** toggles expansion on
	 */
	changeExpansion(tree, node, changeTo, propNames) {
		return tree.map((x) => {
			let t = x;
			if (x[propNames.nodePathProperty] == node?.[propNames.nodePathProperty]) {
				t[propNames.expandedProperty] = changeTo;
			}
			return t;
		});
	}

	/** orders nodes by priorityProp
	 */
	OrderByPriority(tree, propNames) {
		tree.sort((a, b) => {
			if (b[propNames.priorityProperty] > a[propNames.priorityProperty])
				return -1;
			return 1;
		});
		return tree;
	}

	/** changes expansion of every node that has this.hasChildren set to true
	 */
	changeEveryExpansion(tree, changeTo, propNames) {
		return tree.map((node) => {
			if (node[propNames.hasChildrenProperty] == true)
				node[propNames.expandedProperty] = changeTo;
			return node;
		});
	}

	/** changes expansion of every node that has this.hasChildren set to true if they are abose set level and expansion property isnt set
	 */
	expandToLevel(tree, level, propNames) {
		return tree.map((n) => {
			if (
				n[propNames.expandedProperty] == undefined &&
				n[propNames.expandedProperty] == null &&
				n[propNames.useCallbackProperty] != true &&
				this.getDepthLevel(n[propNames.nodePathProperty]) <= level
			) {
				n[propNames.expandedProperty] = true;
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

		filteredTree,
		propNames
	) {
		tree = this.addOrRemoveSelection(tree, nodePath, propNames);

		if (recursiveely) {
			tree = this.recomputeAllParentVisualState(
				tree,
				nodePath,

				filteredTree,
				propNames
			);
		}
		return tree;
	}

	addOrRemoveSelection(tree, nodePath, propNames) {
		console.log(tree);
		return tree.map((x) => {
			let t = x;
			if (x[propNames.nodePathProperty] == nodePath) {
				t[propNames.selectedProperty] = !x[propNames.selectedProperty];
				//t.__visual_state = !x[propNames.selectedProperty];
			}
			return t;
		});
	}

	ChangeSelectForAllChildren(
		tree,
		parentId,

		changeTo,

		filteredTree,
		propNames
	) {
		tree = tree.map((x) => {
			//changes itself
			if (parentId == x[propNames.nodePathProperty]) {
				x = this.changeSelectedIfNParent(x, changeTo, propNames);
			}

			if (!parentId) {
				//top level
				if (!this.nodePathIsChild(x[propNames.nodePathProperty])) {
					x = this.changeSelectedIfNParent(x, changeTo, propNames);
				}
			} else {
				//if parentId isnt root
				if (
					x[propNames.nodePathProperty].startsWith(parentId.toString()) &&
					x[propNames.nodePathProperty] != parentId.toString()
				) {
					x = this.changeSelectedIfNParent(x, changeTo, propNames);
				}
			}
			return x;
		});
		tree = this.recomputeAllParentVisualState(
			tree,
			parentId,

			filteredTree,
			propNames
		);
		return tree;
	}

	//changes selectedproperty or visual state depending on
	changeSelectedIfNParent(node, changeTo, propNames) {
		if (!node[propNames.hasChildrenProperty]) {
			node[propNames.selectedProperty] = changeTo;
		} else {
			node.__visual_state = changeTo.toString();
		}
		return node;
	}

	/**Calculates visual state based on children  */
	getVisualState(filteredTree, node, propNames) {
		let children = this.getParentChildrenTree(
			filteredTree,
			node[propNames.nodePathProperty],

			propNames
		);

		if (!children || children?.length == 0) return "false";

		//if every child is selected or vs=true return true
		if (
			children.every((x) => {
				return (
					x[propNames.selectedProperty] === true || x.__visual_state === "true"
				);
			})
		) {
			return "true";
		}
		//not every child but at least one return indeterminate
		else if (
			children.some((x) => {
				return (
					x[propNames.selectedProperty] === true ||
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

		filteredTree,
		propNames
	) {
		let parent = this.getParentNodePath(nodePath);

		let newstate;
		filteredTree.forEach((x) => {
			if (x[propNames.nodePathProperty] == parent) {
				newstate = this.getVisualState(
					filteredTree,
					x,

					propNames
				);
				x.__visual_state = newstate;
				//console.log("recomputing" + parent + " ->" + newstate);
			}
		});
		if (this.getParentNodePath(parent) != "") {
			tree = this.recomputeAllParentVisualState(
				tree,
				parent,

				filteredTree,
				propNames
			);
		}
		return tree;
	}

	/** Computes visual states for all nodes. Used for computing initial visual states when tree changes  */
	computeInitialVisualStates(
		tree,

		filteredTree,
		propNames
	) {
		let rootELements = this.getParentChildrenTree(
			tree,
			null,

			propNames
		);
		rootELements.forEach((x) => {
			if (x[propNames.hasChildrenProperty] == true) {
				tree = this.computeChildrenVisualStates(
					tree,
					x,

					filteredTree,
					propNames
				);
				x.__visual_state = this.getVisualState(
					filteredTree,
					x,

					propNames
				);
			}
		});
		return tree;
	}
	/** Recursivly computes visual state for children  */
	computeChildrenVisualStates(
		tree,
		node,

		filteredTree,
		propNames
	) {
		let children = this.getParentChildrenTree(
			tree,
			node[propNames.nodePathProperty],

			propNames
		);
		//foreaches all children if it has children, it calls itself, then it computes __vs => will compute from childern to parent
		children.forEach((x) => {
			if (x[propNames.hasChildrenProperty] == true) {
				tree = this.computeChildrenVisualStates(
					tree,
					x,
					filteredTree,
					propNames
				);
				x.__visual_state = this.getVisualState(filteredTree, x, propNames);
			}
		});
		return tree;
	}

	deleteSelected(tree, propNames) {
		return tree.map((t) => {
			let x = t;
			x[propNames.selectedProperty] = false;
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
	 * @param {Object} propNames - object where all propNames are stored
	 */
	moveNode(
		tree,
		movedNodePath,
		targetNodePath,
		insType,
		recalculateNodePath,
		propNames
	) {
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
				nodeId = this.getNextNodeId(tree, parentNodePath, propNames);
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
		let targetNode = tree.find(
			(x) => x[propNames.nodePathProperty] == targetNodePath
		);
		let movedNode;

		//console.log("parentNodePath: " + newParentNodePath);

		tree = tree.map((node) => {
			//make sure that parent's haschild is set to true, so that children
			if (node[propNames.nodePathProperty] == parentNodePath) {
				node[propNames.hasChildrenProperty] = true;
				node[propNames.expandedProperty] = true;
			}

			//move moved nodes to new location ( if location is being changed)
			if (
				!insideParent &&
				node[propNames.nodePathProperty].startsWith(movedNodePath)
			) {
				//replace old parent with new
				let newPath = node[propNames.nodePathProperty].replace(
					movedNodePath,
					newParentNodePath
				);
				//console.log(node[propNames.nodePathProperty] + " -> " + newPath);
				node[propNames.nodePathProperty] = newPath;
			}

			//if it is moved node
			if (node[propNames.nodePathProperty] == newParentNodePath) {
				movedNode = node;

				if (nest || targetNode[propNames.priorityProperty] != null) {
					let newpriority = 0;
					if (!nest) {
						//calculate next
						newpriority = targetNode[propNames.priorityProperty] ?? 0;
						if (insType == -1) {
							newpriority += 1;
						} else {
							//targetNode[propNames.priorityProperty] -= 1;
						}
					}

					//console.log("new priority:" + newpriority);

					this.InsertPriority(
						tree,
						parentNodePath,
						newParentNodePath,
						newpriority,

						propNames
					);

					node[propNames.priorityProperty] = newpriority;
				} else {
					//so old priority doesnt mess up orderring
					movedNode[propNames.priorityProperty] = undefined;
				}
			}
			return node;
		});

		//* insert node at right possition of array
		//

		let oldIndex = tree.findIndex(
			(x) => x[propNames.nodePathProperty] == newParentNodePath
		);
		tree.splice(oldIndex, 1);

		let index = tree.findIndex(
			(x) =>
				x[propNames.nodePathProperty] == targetNode[propNames.nodePathProperty]
		);

		//insert below expcept if inspos is 1

		tree.splice(index + (insType == 1 ? 0 : 1), 0, movedNode);

		//TODO maybe add option to setting this.hasChildren to false when moved last children

		/*
	//hide plus icon if parent of moved node doesnt have any more children
	let oldParent = tree.find(
		(x) => x[propNames.nodePathProperty] == this.getParentNodePath(movedNodePath)
	);

	//moved
	if (
		oldParent &&
		!this.allCHildren(
			tree,
			oldParent[propNames.nodePathProperty],

			propNames
		).length
	) {
		oldParent[propNames.hasChildrenProperty] = false;
	}
*/
		return tree;
	}

	/** recomputes all priorities after inserted priority.F
	 * Also changes all priorities to be one apart (1,5,6 => 1,2,3)
	 */
	InsertPriority(
		tree,
		parentNode,
		movedNodePath,
		insertedPriority,

		propNames
	) {
		let nextPriority = insertedPriority + 1;
		this.OrderByPriority(
			this.allCHildren(tree, parentNode, propNames),
			propNames
		).forEach((n) => {
			if (
				n[propNames.priorityProperty] >= insertedPriority &&
				n[propNames.nodePathProperty] != movedNodePath
			) {
				n[propNames.priorityProperty] = nextPriority++;
			}
		});
	}

	/** return biggest value of nodepath number that children are using +1 */
	getNextNodeId(tree, parentPath, propNames) {
		let max = 0;
		//findes biggest nodeNumber for
		this.allCHildren(tree, parentPath, propNames).forEach((node) => {
			let parent = this.getParentNodePath(node[propNames.nodePathProperty]);
			if (parent == parentPath) {
				let num = node[propNames.nodePathProperty].substring(
					parent ? parent.length + 1 : 0
				);
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
	searchTree(tree, filter, recursive, propNames) {
		let result = [],
			matchingNodes = [];
		if (recursive) {
			matchingNodes = this.getAllLeafNodes(tree, propNames).filter(filter);
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

	addParents(tree, result, node, propNames) {
		let parentsIds = [],
			parentNodes = [];
		if (result === undefined) result = [];
		let nodePath = node[propNames.nodePathProperty];
		while (nodePath.length > 0) {
			nodePath = this.getParentNodePath(nodePath);
			parentsIds.push(nodePath);
		}

		//finds nodes for ids
		tree.forEach((n) => {
			if (
				parentsIds.some((parentId) => {
					return n[propNames.nodePathProperty] === parentId;
				})
			) {
				parentNodes.push(n);
			}
		});
		//removes duplicate nodePaths
		parentNodes.forEach((n) => {
			if (
				result.findIndex((x) => {
					return (
						n[propNames.nodePathProperty] === x[propNames.nodePathProperty]
					);
				}) < 0
			)
				result.push(n);
		});

		return result;
	}
}

//#endregion
