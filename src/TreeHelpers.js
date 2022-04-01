	//#region helpers
	/* Tree view helpers */

	//#region basic helpres

	export function getParentNodePath(nodePath) {
		return nodePath.substring(0, nodePath.lastIndexOf("."));
	}

	export function hasChildren(tree, nodePath) {
		return tree.find((x) => getParentNodePath(x.nodePath) === nodePath);
	}

	export function nodePathIsChild(nodePath) {
		return !nodePath || !!(nodePath.match(/\./g) || []).length;
	}

	export function getParentChildrenTree(tree, parentId, isChild, getParentId) {
		return (tree || []).filter((x) =>
			!parentId ? !isChild(x) : getParentId(x) === parentId
		);
	}

	export function allCHildren(tree, parentId, isChild) {
		let children;
		children = tree.filter((x) => {
			if (!parentId) {
				//top level
				return !isChild(x);
			} else {
				return (
					x.nodePath.startsWith(parentId.toString()) && x.nodePath != parentId
				);
			}
		});
		return children;
	}

	export function getAllLeafNodes(tree) {
		return tree.filter((x) => {
			return x.hasChildren == undefined || x.hasChildren == false;
		});
	}

	function joinTrees(filteredTree, tree) {
		return tree.map(
			(tnode) =>
				filteredTree.find((fnode) => tnode.nodePath === fnode.nodePath) || tnode
		);
	}

	export function changeExpansion(tree, nodePath, expandedProperty) {
		return tree.map((x) => {
			let t = x;
			if (x.nodePath == nodePath) {
				t[expandedProperty] = !x[expandedProperty];
			}
			return t;
		});
	}

	export function OrderByPriority(tree, priorityProp) {
		tree.sort((a, b) => {
			if (b[priorityProp] > a[priorityProp]) return -1;
			return 1;
		});
		return tree;
	}

	//#endregion

	//#region selection

	export function ChangeSelection(
		recursiveely,
		tree,
		nodePath,
		isChild,
		selectedProperty,
		getParentId,
		filteredTree
	) {
		if (!recursiveely) {
			//non recursiveely

			return addOrRemoveSelection(tree, nodePath, selectedProperty);
		} else {
			//recursiveely

			//only allow selection if it doesnt have any children
			tree = addOrRemoveSelection(tree, nodePath, selectedProperty);
			return recomputeAllParentVisualState(
				tree,
				nodePath,
				isChild,
				selectedProperty,
				getParentId,
				filteredTree
			);
		}
	}

	function addOrRemoveSelection(tree, nodePath, selectedProperty) {
		return tree.map((x) => {
			let t = x;
			if (x.nodePath == nodePath) {
				t[selectedProperty] = !x[selectedProperty];
				t.__visual_state = !x[selectedProperty];
			}
			return t;
		});
	}

	export function ChangeSelectForAllChildren(
		tree,
		parentId,
		isChild,
		selectedProperty,
		changeTo,
		getParentId,
		filteredTree
	) {
		tree = tree.map((x) => {
			//changes itself
			if (parentId == x.nodePath) {
				x = changeSelectedIfNParent(x, selectedProperty, changeTo);
			}

			if (!parentId) {
				//top level
				if (!isChild(x)) {
					x = changeSelectedIfNParent(x, selectedProperty, changeTo);
				}
			} else {
				//if parentId isnt root
				if (
					x.nodePath.startsWith(parentId.toString()) &&
					x.nodePath != parentId.toString()
				) {
					x = changeSelectedIfNParent(x, selectedProperty, changeTo);
				}
			}
			return x;
		});
		tree = recomputeAllParentVisualState(
			tree,
			parentId,
			isChild,
			selectedProperty,
			getParentId,
			filteredTree
		);
		return tree;
	}

	//changes selectedproperty or visual state depending on
	function changeSelectedIfNParent(node, selectedProperty, changeTo) {
		if (!node.hasChildren) {
			node[selectedProperty] = changeTo;
		} else {
			node.__visual_state = changeTo.toString();
		}
		return node;
	}

	function getVisualState(
		filteredTree,
		node,
		isChild,
		selectedProperty,
		getParentId
	) {
		let children = getParentChildrenTree(
			filteredTree,
			node.nodePath,
			isChild,
			getParentId
		);

		if (!children || children?.length == 0) return "false";

		//if every child is selected or vs=true return true
		if (
			children.every((x) => {
				return x[selectedProperty] === true || x.__visual_state === "true";
			})
		) {
			return "true";
		}
		//not every child but at least one return indeterminate
		else if (
			children.some((x) => {
				return (
					x[selectedProperty] === true ||
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
		selectedProperty,
		getParentId,
		filteredTree
	) {
		let parent = getParentId({ nodePath: nodePath });

		let newstate;
		filteredTree.forEach((x) => {
			if (x.nodePath == parent) {
				newstate = getVisualState(
					filteredTree,
					x,
					isChild,
					selectedProperty,
					getParentId
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
				selectedProperty,
				getParentId,
				filteredTree
			);
		}
		return tree;
	}

	//computes visual states for all nodes with children
	export function computeInitialVisualStates(
		tree,
		isChild,
		selectedProperty,
		getParentId,
		filteredTree
	) {
		let rootELements = getParentChildrenTree(tree, null, isChild, getParentId);
		rootELements.forEach((x) => {
			if (x.hasChildren == true) {
				tree = computeChildrenVisualStates(
					tree,
					x,
					isChild,
					selectedProperty,
					getParentId,
					filteredTree
				);
				x.__visual_state = getVisualState(
					filteredTree,
					x,
					isChild,
					selectedProperty,
					getParentId
				);
			}
		});
		return tree;
	}

	function computeChildrenVisualStates(
		tree,
		node,
		isChild,
		selectedProperty,
		getParentId,
		filteredTree
	) {
		let children = getParentChildrenTree(
			tree,
			node.nodePath,
			isChild,
			getParentId
		);
		//foreaches all children if it has children, it calls itself, then it computes __vs => will compute from childern to parent
		children.forEach((x) => {
			if (x.hasChildren == true) {
				tree = computeChildrenVisualStates(
					tree,
					x,
					isChild,
					selectedProperty,
					getParentId,
					filteredTree
				);
				x.__visual_state = getVisualState(
					filteredTree,
					x,
					isChild,
					selectedProperty,
					getParentId
				);
			}
		});
		return tree;
	}

	export function deleteSelected(tree) {
		return tree.map((t) => {
			let x = t;
			x.__selected = false;
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
		priorityProp,
		expandedProperty
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
				getNextNodeId(tree, parentNodePath, isChild);
		}

		//* find target node
		let targetNode = tree.find((x) => x.nodePath == targetNodePath);
		let movedNode;

		console.log("parentNodePath: " + newParrentNodePath);

		tree = tree.map((node) => {
			//make sure that parent's haschild is set to true, so that children
			if (node.nodePath == parentNodePath) {
				node.hasChildren = true;
				node[expandedProperty] = true;
			}

			//move moved nodes to new location ( if location is being changed)
			if (!insideParent && node.nodePath.startsWith(movedNodePath)) {
				//replace old parent with new
				let newPath = node.nodePath.replace(movedNodePath, newParrentNodePath);
				console.log(node.nodePath + " -> " + newPath);
				node.nodePath = newPath;
			}

			//if it is moved node
			if (node.nodePath == newParrentNodePath) {
				movedNode = node;

				if (nest || targetNode[priorityProp] != null) {
					let newpriority = 0;
					if (!nest) {
						//calculate next
						newpriority = (targetNode[priorityProp] ?? 0) + 1;
					}

					console.log("new priority:" + newpriority);

					InsertPriority(
						tree,
						parentNodePath,
						newParrentNodePath,
						newpriority,
						priorityProp,
						isChild
					);

					node[priorityProp] = newpriority;
				} else {
					//so old priority doesnt mess up orderring
					movedNode[priorityProp] = undefined;
				}
			}
			return node;
		});

		//* insert node at right possition of array
		let oldIndex = tree.findIndex((x) => x.nodePath == newParrentNodePath);
		tree.splice(oldIndex, 1);

		let index = tree.findIndex((x) => x.nodePath == targetNode.nodePath);
		tree.splice(index + 1, 0, movedNode);

		//hide plus icon if parrent of moved node doesnt have any more children
		let movedNodeParrent = tree.find(
			(x) => x.nodePath == getParentNodePath(movedNodePath)
		);
		if (
			movedNodeParrent &&
			!allCHildren(tree, movedNodeParrent.nodePath, isChild).length
		) {
			movedNodeParrent.hasChildren = false;
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
		priorityProp,
		isChild
	) {
		let nextPriority = insertedPriority + 1;
		OrderByPriority(
			allCHildren(tree, parentNode, isChild),
			priorityProp
		).forEach((n) => {
			if (n[priorityProp] >= insertedPriority && n.nodePath != movedNodePath) {
				n[priorityProp] = nextPriority++;
			}
		});
	}

	//return biggest value of nodepath number that children are using +1
	function getNextNodeId(tree, parentPath, isChild) {
		let max = 0;
		//findes biggest nodeNumber for
		allCHildren(tree, parentPath, isChild).forEach((node) => {
			let parent = getParentNodePath(node.nodePath);
			if (parent == parentPath) {
				let num = node.nodePath.substring(parent ? parent.length + 1 : 0);
				if (parseInt(num) >= parseInt(max)) max = num;
			}
		});
		return parseInt(max) + 1;
	}

	//#endregion

	/* Tree view helpers end */

	//#endregion

	export default {getParentNodePath, hasChildren, nodePathIsChild,OrderByPriority,getParentChildrenTree
		,computeInitialVisualStates,changeExpansion, ChangeSelection,ChangeSelectForAllChildren,
		moveNode}