	//#region helpers
	/* Tree view helpers */

	//#region basic helpres

	export function getParentNodePath(nodePath) {
		return nodePath.substring(0, nodePath.lastIndexOf("."));
	}

	export function hasChildren(tree, nodePath,propNames) {
		return tree.find((x) => getParentNodePath(x[propNames.nodePathProperty]) === nodePath);
	}

	export function nodePathIsChild(nodePath) {
		return !nodePath || !!(nodePath.match(/\./g) || []).length;
	}

	export function getParentChildrenTree(tree, parentId, isChild, getParentId) {
		return (tree || []).filter((x) =>
			!parentId ? !isChild(x) : getParentId(x) === parentId
		);
	}

	export function allCHildren(tree, parentId, isChild,propNames) {
		let children;
		children = tree.filter((x) => {
			if (!parentId) {
				//top level
				return !isChild(x);
			} else {
				return (
					x[propNames.nodePathProperty].startsWith(parentId.toString()) && x[propNames.nodePathProperty] != parentId
				);
			}
		});
		return children;
	}

	export function getAllLeafNodes(tree,propNames) {
		return tree.filter((x) => {
			return x[propNames.hasChildrenProperty] == undefined || x[propNames.hasChildrenProperty] == false;
		});
	}

	export function joinTrees(filteredTree, tree,propNames) {
		return tree.map(
			(tnode) =>
				filteredTree.find((fnode) => tnode[propNames.nodePathProperty] === fnode[propNames.nodePathProperty]) || tnode
		);
	}


	export function changeExpansion(tree, nodePath, propNames) {
		return tree.map((x) => {
			let t = x;
			if (x[propNames.nodePathProperty] == nodePath) {
				t[propNames.expandedProperty] = !x[propNames.expandedProperty];
			}
			return t;
		});
	}

	export function OrderByPriority(tree, propNames) {
		tree.sort((a, b) => {
			if (b[propNames.priorityPropery] > a[propNames.priorityPropery]) return -1;
			return 1;
		});
		return tree;
	}


export function changeEveryExpansion(tree, changeTo,propNames) {
	return tree.map((node) => {
		node[propNames.expandedProperty] = changeTo;
		return node;
	});
}

	//#endregion

	//#region selection

	export function ChangeSelection(
		recursiveely,
		tree,
		nodePath,
		isChild,
		getParentId,
		filteredTree,
		propNames
	) {
		if (!recursiveely) {
			//non recursiveely

			return addOrRemoveSelection(tree, nodePath, propNames);
		} else {
			//recursiveely

			//only allow selection if it doesnt have any children
			tree = addOrRemoveSelection(tree, nodePath, propNames);
			return recomputeAllParentVisualState(
				tree,
				nodePath,
				isChild,
				getParentId,
				filteredTree,
				propNames
			);
		}
	}

	function addOrRemoveSelection(tree, nodePath, propNames) {
		return tree.map((x) => {
			let t = x;
			if (x[propNames.nodePathProperty] == nodePath) {
				t[propNames.selectedProperty] = !x[propNames.selectedProperty];
				t.__visual_state = !x[propNames.selectedProperty];
			}
			return t;
		});
	}

	export function ChangeSelectForAllChildren(
		tree,
		parentId,
		isChild,
		changeTo,
		getParentId,
		filteredTree,
		propNames
	) {
		tree = tree.map((x) => {
			//changes itself
			if (parentId == x[propNames.nodePathProperty]) {
				x = changeSelectedIfNParent(x, changeTo,propNames);
			}

			if (!parentId) {
				//top level
				if (!isChild(x)) {
					x = changeSelectedIfNParent(x,changeTo,propNames);
				}
			} else {
				//if parentId isnt root
				if (
					x[propNames.nodePathProperty].startsWith(parentId.toString()) &&
					x[propNames.nodePathProperty] != parentId.toString()
				) {
					x = changeSelectedIfNParent(x,changeTo,propNames);
				}
			}
			return x;
		});
		tree = recomputeAllParentVisualState(
			tree,
			parentId,
			isChild,
			getParentId,
			filteredTree,
			propNames
		);
		return tree;
	}

	//changes selectedproperty or visual state depending on
	function changeSelectedIfNParent(node, changeTo,propNames) {
		if (!node[propNames.hasChildrenProperty]) {
			node[propNames.selectedProperty] = changeTo;
		} else {
			node.__visual_state = changeTo.toString();
		}
		return node;
	}

	function getVisualState(
		filteredTree,
		node,
		isChild,
		getParentId,
		propNames
	) {
		let children = getParentChildrenTree(
			filteredTree,
			node[propNames.nodePathProperty],
			isChild,
			getParentId
		);

		if (!children || children?.length == 0) return "false";

		//if every child is selected or vs=true return true
		if (
			children.every((x) => {
				return x[propNames.selectedProperty] === true || x.__visual_state === "true";
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

	//changes status of all parents of given nodepath until root
	function recomputeAllParentVisualState(
		tree,
		nodePath,
		isChild,
		getParentId,
		filteredTree,
		propNames
	) {
		let parent = getParentId({ nodePath: nodePath });

		let newstate;
		filteredTree.forEach((x) => {
			if (x[propNames.nodePathProperty] == parent) {
				newstate = getVisualState(
					filteredTree,
					x,
					isChild,
					getParentId,
					propNames
				);
				x.__visual_state = newstate;
				console.log("recomputing" + parent + " ->" + newstate);
			}
		});
		if (getParentNodePath(parent) != "") {
			tree = recomputeAllParentVisualState(
				tree,
				parent,
				isChild,
				getParentId,
				filteredTree,
				propNames
			);
		}
		return tree;
	}

	//computes visual states for all nodes with children
	export function computeInitialVisualStates(
		tree,
		isChild,
		getParentId,
		filteredTree,
		propNames
	) {
		let rootELements = getParentChildrenTree(tree, null, isChild, getParentId);
		rootELements.forEach((x) => {
			if (x[propNames.hasChildrenProperty] == true) {
				tree = computeChildrenVisualStates(
					tree,
					x,
					isChild,
					getParentId,
					filteredTree,
					propNames
				);
				x.__visual_state = getVisualState(
					filteredTree,
					x,
					isChild,
					getParentId,
					propNames
				);
			}
		});
		return tree;
	}

	function computeChildrenVisualStates(
		tree,
		node,
		isChild,
		getParentId,
		filteredTree,
		propNames
	) {
		let children = getParentChildrenTree(
			tree,
			node[propNames.nodePathProperty],
			isChild,
			getParentId
		);
		//foreaches all children if it has children, it calls itself, then it computes __vs => will compute from childern to parent
		children.forEach((x) => {
			if (x[propNames.hasChildrenProperty] == true) {
				tree = computeChildrenVisualStates(
					tree,
					x,
					isChild,
					getParentId,
					filteredTree,
					propNames
				);
				x.__visual_state = getVisualState(
					filteredTree,
					x,
					isChild,
					getParentId,
					propNames
				);
			}
		});
		return tree;
	}

	export function deleteSelected(tree,propNames) {
		return tree.map((t) => {
			let x = t;
			x[propNames.selectedProperty] = false;
			x.__visual_state = "false";
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
	 * @param {function} isChild - funcion to get if child
	 * @param {boolean} nest - if true, it will insert moved node as child of target node, if false, it will insert it bellow it in priority
	 * @param {string} priorityProp - prop where priority is stored
	 */
	export function moveNode(
		tree,
		movedNodePath,
		targetNodePath,
		isChild,
		nest,
		propNames
	) {
		// if you are not nesting, you want to be on same level
		let parentNodePath = !nest
			? getParentNodePath(targetNodePath)
			: targetNodePath;

		//trying to move parent to child
		if (parentNodePath.startsWith(movedNodePath)) return;

		//dont create new node if you only moved inside same parrent
		let insideParent =
			!nest &&
			getParentNodePath(movedNodePath) == getParentNodePath(targetNodePath);
		let newParrentNodePath = movedNodePath;
		if (!insideParent) {
			newParrentNodePath =
				(parentNodePath ? parentNodePath + "." : "") +
				getNextNodeId(tree, parentNodePath, isChild,propNames);
		}

		//* find target node
		let targetNode = tree.find((x) => x[propNames.nodePathProperty] == targetNodePath);
		let movedNode;

		console.log("parentNodePath: " + newParrentNodePath);

		tree = tree.map((node) => {
			//make sure that parent's haschild is set to true, so that children
			if (node[propNames.nodePathProperty] == parentNodePath) {
				node[propNames.hasChildrenProperty] = true;
				node[propNames.expandedProperty] = true;
			}

			//move moved nodes to new location ( if location is being changed)
			if (!insideParent && node[propNames.nodePathProperty].startsWith(movedNodePath)) {
				//replace old parent with new
				let newPath = node[propNames.nodePathProperty].replace(movedNodePath, newParrentNodePath);
				console.log(node[propNames.nodePathProperty] + " -> " + newPath);
				node[propNames.nodePathProperty] = newPath;
			}

			//if it is moved node
			if (node[propNames.nodePathProperty] == newParrentNodePath) {
				movedNode = node;

				if (nest || targetNode[propNames.priorityPropery] != null) {
					let newpriority = 0;
					if (!nest) {
						//calculate next
						newpriority = (targetNode[propNames.priorityPropery] ?? 0) + 1;
					}

					console.log("new priority:" + newpriority);

					InsertPriority(
						tree,
						parentNodePath,
						newParrentNodePath,
						newpriority,
						isChild,
						propNames
					);

					node[propNames.priorityPropery] = newpriority;
				} else {
					//so old priority doesnt mess up orderring
					movedNode[propNames.priorityPropery] = undefined;
				}
			}
			return node;
		});

		//* insert node at right possition of array
		let oldIndex = tree.findIndex((x) => x[propNames.nodePathProperty] == newParrentNodePath);
		tree.splice(oldIndex, 1);

		let index = tree.findIndex((x) => x[propNames.nodePathProperty] == targetNode[propNames.nodePathProperty]);
		tree.splice(index + 1, 0, movedNode);

		//hide plus icon if parrent of moved node doesnt have any more children
		let movedNodeParrent = tree.find(
			(x) => x[propNames.nodePathProperty] == getParentNodePath(movedNodePath)
		);
		if (
			movedNodeParrent &&
			!allCHildren(tree, movedNodeParrent[propNames.nodePathProperty], isChild,
				propNames).length
		) {
			movedNodeParrent[propNames.hasChildrenProperty] = false;
		}

		return tree;
	}

	//recomputes all priorities after inserted priority
	//also changes all priorities to be one apart (1,5,6 => 1,2,3)
	function InsertPriority(
		tree,
		parentNode,
		movedNodePath,
		insertedPriority,
		isChild,
		propNames
	) {
		let nextPriority = insertedPriority + 1;
		OrderByPriority(
			allCHildren(tree, parentNode, isChild,propNames),
			propNames
		).forEach((n) => {
			if (n[propNames.priorityPropery] >= insertedPriority && n[propNames.nodePathProperty] != movedNodePath) {
				n[propNames.priorityPropery] = nextPriority++;
			}
		});
	}

	//return biggest value of nodepath number that children are using +1
	function getNextNodeId(tree, parentPath, isChild,propNames) {
		let max = 0;
		//findes biggest nodeNumber for
		allCHildren(tree, parentPath, isChild,propNames).forEach((node) => {
			let parent = getParentNodePath(node[propNames.nodePathProperty]);
			if (parent == parentPath) {
				let num = node[propNames.nodePathProperty].substring(parent ? parent.length + 1 : 0);
				if (parseInt(num) >= parseInt(max)) max = num;
			}
		});
		return parseInt(max) + 1;
	}

	//#endregion

//#region searching

//return filtered tree
export function searchTree(tree, filterFunction, recursive,propNames) {
	let result = [],
		matchingNodes = [];
	if (recursive) {
		matchingNodes = getAllLeafNodes(tree,propNames).filter(filterFunction);
	} else {
		matchingNodes = tree.filter(filterFunction);
	}
	//console.log("matching nodes length:" + matchingNodes.length)
	matchingNodes.forEach((node) => {
		result.push(node);
		result = addParents(tree, result, node);
	});
	//console.log(result)
	return result;
}

function addParents(tree, result, node,propNames) {
	let parentsIds = [],
		parentNodes = [];
	if (result === undefined) result = [];
	let nodePath = node[propNames.nodePathProperty];
	while (nodePath.length > 0) {
		nodePath = getParentNodePath(nodePath);
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
				return n[propNames.nodePathProperty] === x[propNames.nodePathProperty];
			}) < 0
		)
			result.push(n);
	});

	return result;
}

//#endregion

	/* Tree view helpers end */

	//#endregion

	export default {getParentNodePath, hasChildren, nodePathIsChild,OrderByPriority,getParentChildrenTree
		,computeInitialVisualStates,changeExpansion, ChangeSelection,ChangeSelectForAllChildren,
		moveNode}