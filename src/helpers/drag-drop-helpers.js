export class DragAndDropHelper {
	constructor(treeHelper) {
		this.helper = treeHelper;
		this.props = treeHelper.props;
	}

	path(node) {
		return this.helper.path(node);
	}

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
			? this.helper.getParentNodePath(targetNodePath)
			: targetNodePath;

		//trying to move parent to child
		if (parentNodePath.startsWith(movedNodePath)) return;

		let insideParent =
			!nest &&
			this.helper.getParentNodePath(movedNodePath) ==
				this.helper.getParentNodePath(targetNodePath);
		let newParentNodePath = movedNodePath;

		//dont create new node if you only moved inside same parent
		if (!insideParent) {
			let nodeId;
			if (recalculateNodePath) {
				nodeId = this.getNextNodeId(tree, parentNodePath);
			} else {
				nodeId = movedNodePath.substring(
					this.helper.getParentNodePath(movedNodePath)
						? this.helper.getParentNodePath(movedNodePath).length + 1
						: 0
				);
			}
			newParentNodePath = (parentNodePath ? parentNodePath + "." : "") + nodeId;
		}

		//console.log(newParentNodePath);

		//* find target node

		let targetNode = this.helper.findNode(tree, targetNodePath);
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
		let oldParent = this.helper.findNode(
			tree,
			this.helper.getParentNodePath(movedNodePath)
		);

		//moved
		if (
			oldParent &&
			!this.helper.allCHildren(tree, this.path(oldParent)).length
		) {
			oldParent[this.props.hasChildrenProperty] = false;
		}

		return tree;
	}

	/** recomputes all priorities after inserted priority.F
	 * Also changes all priorities to be one apart (1,5,6 => 1,2,3)
	 */
	InsertPriority(tree, parentNode, movedNodePath, insertedPriority) {
		let nextPriority = insertedPriority + 1;
		this.OrderByPriority(this.helper.allCHildren(tree, parentNode)).forEach(
			(n) => {
				if (
					n[this.props.priorityProperty] >= insertedPriority &&
					this.path(n) != movedNodePath
				) {
					n[this.props.priorityProperty] = nextPriority++;
				}
			}
		);
	}

	/** return biggest value of nodepath number that children are using +1 */
	getNextNodeId(tree, parentPath) {
		let max = 0;
		//findes biggest nodeNumber for
		this.helper.allCHildren(tree, parentPath).forEach((node) => {
			let parent = this.helper.getParentNodePath(this.path(node));
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
}
