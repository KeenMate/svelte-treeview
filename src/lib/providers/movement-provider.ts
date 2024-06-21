import { TreeHelper } from '$lib/helpers/tree-helper.js';
import { KeyboardMovement as MovementDirection, type Node } from '$lib/types.js';

export function calculateNewFocusedNode(
	helper: TreeHelper,
	tree: Node[],
	targetNode: Node,
	movementDirection: MovementDirection
): { node: Node; setExpansion: boolean | null } {
	// TODO this could use some refactoring

	const parentNodePath = helper.getParentNodePath(targetNode.path);

	const parentNode = parentNodePath ? helper.findNode(tree, parentNodePath) : null;

	const parentDirectChildren = helper.getDirectChildren(tree, parentNodePath);

	const targetNodeIndex = parentDirectChildren.findIndex((node) => node.path === targetNode.path);

	switch (movementDirection) {
		case MovementDirection.Right: {
			// cannot expand or nest, so go to next sibling
			if (!targetNode.hasChildren) {
				const sibling = getRelativeSibling(helper, tree, targetNode, 1);

				// already at end of list
				if (sibling === null) {
					return wrapReturn(targetNode);
				}

				return wrapReturn(sibling);
			}

			if (!targetNode.expanded) {
				return wrapReturn(targetNode, true);
			}

			// if already expanded, go to first child (if any)
			const targetNodeChildren = helper.getDirectChildren(tree, targetNode.path);

			if (targetNodeChildren.length == 0) {
				return wrapReturn(targetNode);
			}

			return wrapReturn(targetNodeChildren[0]);
		}
		case MovementDirection.Left: {
			if (targetNode.expanded) {
				return wrapReturn(targetNode, false);
			}

			// on closed node, go to parent
			if (parentNode) {
				return wrapReturn(parentNode);
			}

			// no parent node = root level => nowhere to go
			return wrapReturn(targetNode);
		}
		case MovementDirection.Down: {
			// not last node in parent
			if (targetNodeIndex !== parentDirectChildren.length - 1) {
				return wrapReturn(parentDirectChildren[targetNodeIndex + 1]);
			}

			// last node in parent

			// already at root level, nowhere to go
			if (parentNode === null) {
				return wrapReturn(targetNode);
			}

			const sibling = getRelativeSibling(helper, tree, parentNode, 1);

			// at end of list
			if (sibling === null) {
				return wrapReturn(targetNode);
			}

			return wrapReturn(sibling);
		}
		case MovementDirection.Up: {
			// not first node in parent
			if (targetNodeIndex !== 0) {
				return wrapReturn(parentDirectChildren[targetNodeIndex - 1]);
			}

			// already at root level, nowhere to go
			if (parentNodePath === null) {
				return wrapReturn(targetNode);
			}

			const parentNode = helper.findNode(tree, parentNodePath);

			// assertion
			if (!parentNode) {
				console.warn('Parent node not found, this should never happen');
				return wrapReturn(targetNode);
			}

			return wrapReturn(parentNode);
		}
	}
}

export function parseMovementDirection(key: string): MovementDirection | null {
	switch (key) {
		case 'ArrowRight':
			return MovementDirection.Right;
		case 'ArrowLeft':
			return MovementDirection.Left;
		case 'ArrowDown':
			return MovementDirection.Down;
		case 'ArrowUp':
			return MovementDirection.Up;
		default:
			return null;
	}
}

function wrapReturn(node: Node, setExpansion: boolean | null = null) {
	return { node, setExpansion };
}

function getRelativeSibling(
	helper: TreeHelper,
	tree: Node[],
	node: Node,
	relativeIndex: number
): Node | null {
	const parentNodePath = helper.getParentNodePath(node.path);
	const parentDirectChildren = helper.getDirectChildren(tree, parentNodePath);

	const nodeIndex = parentDirectChildren.findIndex((x) => x.path === node.path);
	const siblingIndex = nodeIndex + relativeIndex;

	if (siblingIndex < 0 || siblingIndex >= parentDirectChildren.length) return null;

	return parentDirectChildren[siblingIndex];
}
