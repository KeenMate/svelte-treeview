export class DragAndDropHelper {
	constructor(treeHelper) {
		this.helper = treeHelper;
		this.props = treeHelper.props;

		this.separator = this.helper.config.separator ?? ".";
		console.log(this.separator);
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
		const isNesting = insType == 0;
		console.log({ tree, movedNodePath, targetNodePath, insType });
		// if you are not isNestinging, you want to be on same level
		//so you will have same parent as target node
		const parentNodePath = isNesting
			? targetNodePath
			: this.helper.getParentNodePath(targetNodePath);

		//trying to move parent to child
		if (parentNodePath.startsWith(movedNodePath)) return;

		const changedParent =
			this.helper.getParentNodePath(movedNodePath) !== parentNodePath;

		let newNodePath = movedNodePath;

		//dont create new node if you only moved inside same parent
		if (changedParent) {
			newNodePath = this.calculateNewNodePath(
				tree,
				parentNodePath,
				movedNodePath,
				recalculateNodePath
			);
		}

		//* find target node

		let targetNode = this.helper.findNode(tree, targetNodePath);

		let movedNode;

		//move nodes
		tree = tree.map((node) => {
			//make sure that parent's haschild is set to true, so that children are visible
			if (this.path(node) == parentNodePath) {
				node[this.props.hasChildren] = true;
				node[this.props.expanded] = true;
			}

			//move moved nodes to new location ( if location is being changed)
			if (changedParent && this.path(node).startsWith(movedNodePath)) {
				//replace old parent with new one
				const newPath = this.path(node).replace(movedNodePath, newNodePath);
				node[this.props.nodePath] = newPath;
			}

			//if it is moved node
			if (this.path(node) === newNodePath) {
				movedNode = node;

				//? not sure if this is best
				this.updatePriority(
					tree,
					movedNode,
					parentNodePath,
					newNodePath,
					targetNode,
					insType
				);
			}
			return node;
		});

		//* insert node at right possition of array

		let oldIndex = tree.findIndex((x) => this.path(x) == newNodePath);
		tree.splice(oldIndex, 1);

		let index = tree.findIndex((x) => this.path(x) == this.path(targetNode));

		tree.splice(index + (insType == 1 ? 0 : 1), 0, movedNode);

		console.log(tree);

		//TODO maybe add option to setting this.hasChildren to false when moved last children

		//hide plus icon if parent of moved node doesnt have any more children
		let oldParent = this.helper.findNode(
			tree,
			this.helper.getParentNodePath(movedNodePath)
		);

		//moved last node
		const oldParentHasChildren = this.helper.allCHildren(
			tree,
			this.path(oldParent)
		).length;
		if (oldParent && !oldParentHasChildren) {
			oldParent[this.props.hasChildren] = false;
		}

		return tree;
	}

	calculateNewNodePath(
		tree,
		parentNodePath,
		movedNodePath,
		recalculateNodePath
	) {
		//node id is last part of nodePath
		let nodeId;
		if (recalculateNodePath) {
			nodeId = this.getNextNodeId(tree, parentNodePath);
		} else {
			//get last segment of path
			nodeId = movedNodePath.split(this.separator).slice(-1)[0];
		}
		return (parentNodePath ? parentNodePath + this.separator : "") + nodeId;
	}

	updatePriority(tree, node, parentNodePath, newNodePath, targetNode, insType) {
		const isNesting = insType == 0;
		if (isNesting || targetNode[this.props.priority] != null) {
			let newpriority = 0;
			if (!isNesting) {
				//calculate next
				newpriority = targetNode[this.props.priority] ?? 0;
				if (insType == -1) {
					newpriority += 1;
				} else {
					//targetNode[this.props.priority] -= 1;
				}
			}
			this.recalculatesPriorities(
				tree,
				parentNodePath,
				newNodePath,
				newpriority
			);

			node[this.props.priority] = newpriority;
		} else {
			//so old priority doesnt mess up orderring
			node[this.props.priority] = undefined;
		}
	}

	/** recomputes all priorities after inserted priority.F
	 * Also changes all priorities to be one apart (1,5,6 => 1,2,3)
	 */
	//? maybe it will recalculate properly if dont set insertedPriority
	recalculatesPriorities(
		tree,
		parentNode,
		movedNodePath,
		insertedPriority = -1
	) {
		let nextPriority = insertedPriority + 1;
		this.OrderByPriority(this.helper.allCHildren(tree, parentNode)).forEach(
			(node) => {
				if (
					node[this.props.priority] >= insertedPriority &&
					this.path(node) != movedNodePath
				) {
					node[this.props.priority] = nextPriority++;
				}
			}
		);
	}

	/** return biggest value of nodepath number that children are using +1 */
	getNextNodeId(tree, parentPath) {
		let max = 0;
		//findes biggest nodeNumber for
		this.helper.allCHildren(tree, parentPath).forEach((node) => {
			const parent = this.helper.getParentNodePath(this.path(node));

			if (parent === parentPath) {
				let num = this.path(node).substring(parent ? parent.length + 1 : 0);
				max = Math.max(max, num);
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
			!!b[this.props.priority]
				? a[this.props.priority] > b[this.props.priority]
				: true;
		});
		return tree;
	}
}
