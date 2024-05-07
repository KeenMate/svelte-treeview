import type { PropertyHelper } from '$lib/helpers/property-helper.js';
import type { TreeHelper } from '$lib/helpers/tree-helper.js';
import { InsertionType, type Node, type NodePath, type Tree } from '$lib/types.js';

export class DragDropProvider {
	helper: TreeHelper;
	props: PropertyHelper;
	separator: string;

	constructor(treeHelper: TreeHelper) {
		this.helper = treeHelper;
		this.props = treeHelper.props;

		this.separator = this.helper.config.separator ?? '.';
	}

	path(node: Node) {
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
	moveNode(
		tree: Node[],
		movedNodePath: NodePath,
		targetNodePath: NodePath,
		insType: InsertionType,
		recalculateNodePath: boolean
	): Node[] {
		// cannot move root node
		if (!movedNodePath) return tree;

		const isNesting = insType === InsertionType.nest;
		// if you are not isNestinging, you want to be on same level
		//so you will have same parent as target node
		const parentNodePath = isNesting
			? targetNodePath
			: this.helper.getParentNodePath(targetNodePath);

		//trying to move parent to child
		if (parentNodePath?.startsWith(movedNodePath)) {
			return tree;
		}

		const changedParent = this.helper.getParentNodePath(movedNodePath) !== parentNodePath;

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

		const targetNode = this.helper.findNode(tree, targetNodePath);
		if (!targetNode) return tree;

		let movedNode;

		//move nodes
		tree = tree.map((node) => {
			//make sure that parent's haschild is set to true, so that children are visible
			if (this.path(node) == parentNodePath) {
				this.props.setHasChildren(node, true);
				this.props.setExpanded(node, true);
			}

			//move moved nodes to new location ( if location is being changed)
			if (changedParent && this.path(node)?.startsWith(movedNodePath)) {
				//replace old parent with new one
				const newPath = this.path(node)?.replace(movedNodePath, newNodePath) ?? null;
				this.props.setPath(node, newPath);
			}

			//if it is moved node
			if (this.path(node) === newNodePath) {
				movedNode = node;

				//? not sure if this is best
				this.updatePriority(tree, movedNode, parentNodePath, newNodePath, targetNode, insType);
			}
			return node;
		});

		if (!movedNode) return tree;

		//* insert node at right possition of array

		const oldIndex = tree.findIndex((x) => this.path(x) == newNodePath);
		tree.splice(oldIndex, 1);

		const index = tree.findIndex((x) => this.path(x) == this.path(targetNode));

		tree.splice(index + (insType == InsertionType.above ? 0 : 1), 0, movedNode);

		//TODO maybe add option to setting this.hasChildren to false when moved last children

		//hide plus icon if parent of moved node doesnt have any more children
		const oldParent = this.helper.findNode(tree, this.helper.getParentNodePath(movedNodePath));
		if (!oldParent) return tree;
		//moved last node
		const oldParentHasChildren = this.helper.allCHildren(tree, this.path(oldParent)).length;
		if (oldParent && !oldParentHasChildren) {
			this.props.setHasChildren(oldParent, false);
		}

		return tree;
	}

	calculateNewNodePath(
		tree: Tree,
		parentNodePath: NodePath,
		movedNodePath: NodePath,
		recalculateNodePath: boolean
	) {
		//node id is last part of nodePath
		let nodeId;

		if (recalculateNodePath) {
			nodeId = this.getNextNodeId(tree, parentNodePath);
		} else {
			//get last segment of path
			// nodeId = this.helper.getNodeIdFromPath(movedNodePath);
		}

		if (parentNodePath === null) return nodeId as string;

		return `${parentNodePath}${this.separator}${nodeId}`;
	}

	updatePriority(
		tree: Tree,
		node: Node,
		parentNodePath: NodePath,
		newNodePath: NodePath,
		targetNode: Node,
		insType: InsertionType
	) {
		const isNesting = insType == InsertionType.nest;

		if (isNesting || this.props.priority(targetNode) != null) {
			let newpriority = 0;
			if (!isNesting) {
				//calculate next
				newpriority = this.props.priority(targetNode) ?? 0;
				if (insType == InsertionType.below) {
					newpriority += 1;
				} else {
					//targetNode[this.props.priority] -= 1;
				}
			}
			this.recalculatesPriorities(tree, parentNodePath, newNodePath, newpriority);
			this.props.setPriority(targetNode, newpriority);
		} else {
			//so old priority doesnt mess up orderring
			this.props.setPriority(targetNode, undefined);
		}
	}

	/** recomputes all priorities after inserted priority.F
	 * Also changes all priorities to be one apart (1,5,6 => 1,2,3)
	 */
	//? maybe it will recalculate properly if dont set insertedPriority
	recalculatesPriorities(
		tree: Tree,
		parentNode: NodePath,
		movedNodePath: NodePath,
		insertedPriority = -1
	) {
		let nextPriority = insertedPriority + 1;
		this.helper.orderByPriority(this.helper.allCHildren(tree, parentNode)).forEach((node) => {
			if (this.props.priority(node) >= insertedPriority && this.path(node) != movedNodePath) {
				this.props.setPriority(node, nextPriority++);
			}
		});
	}

	/** return biggest value of nodepath number that children are using +1 */
	getNextNodeId(tree: Tree, parentPath: NodePath) {
		let max = 0;
		//findes biggest nodeNumber for
		this.helper.allCHildren(tree, parentPath).forEach((node) => {
			const parent = this.helper.getParentNodePath(this.path(node));

			if (parent === parentPath) {
				const num = parseInt(this.path(node)?.substring(parent ? parent.length + 1 : 0) ?? '0');
				max = Math.max(max, num);
			}
		});

		return (max + 1).toString();
	}

	getInsertionPosition(e: DragEvent, element: HTMLElement): InsertionType {
		const targetCords = element.getBoundingClientRect();
		const half = targetCords.bottom - targetCords.height / 2;

		if (e.y < half) {
			return InsertionType.below;
		}
		return InsertionType.above;
	}
	getNodeIdFromPath(nodePath: NodePath) {
		if (nodePath == null) {
			console.warn('getting node id of null node path');
			return null;
		}

		return nodePath?.split(this.helper.config.separator).slice(-1)[0];
	}
}
