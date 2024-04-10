import type { TreeHelper } from '$lib/helpers/tree-helper.js';
import {
	type BeforeMovedCallback,
	type DragEnterCallback,
	HighlighType,
	InsertionType,
	Node,
	Tree
} from '$lib/types.js';
import { derived, type Readable, writable } from 'svelte/store';

type dragConfig = {
	pixelNestTreshold: number | null;
	timeToNest: number | null;
	dragEnterCallback: DragEnterCallback | null;
	beforeMovedCallback: BeforeMovedCallback | null;
};

export type DragInfo = {
	highligh(node: Node): Readable<HighlighType>;
	isDragged(node: Node): boolean;
	dragEnter(e: DragEvent, tree: Tree, draggedOverNode: Node): void;
};

export function startDrag(draggedNode: Node, helper: TreeHelper, config: dragConfig): DragInfo {
	const draggedOverNodeStore = writable<Node | null>(null);
	const InsertionTypeStore = writable<InsertionType>(InsertionType.below);
	const validTargetStore = writable<boolean>(false);

	let nestTimeTimeout: NodeJS.Timeout;

	function isValidTarget(tree: Tree, target: Node): boolean {
		if (helper.props.insertDisabled(target) && helper.props.nestDisabled(target)) {
			return false;
		}

		const draggingOverChild = helper.isChildrenOf(helper.path(draggedNode), helper.path(target));

		if (draggingOverChild) {
			return false;
		}

		if (config.dragEnterCallback) {
			// TODO handle async
			const callbackResult = config.dragEnterCallback(
				draggedNode,
				helper.getParent(tree, target),
				target
			);

			if (!callbackResult) {
				return false;
			}
		}

		return true;
	}

	return {
		highligh(node: Node): Readable<HighlighType> {
			return derived(
				[draggedOverNodeStore, validTargetStore, InsertionTypeStore],
				([draggedOverNode, validTarget, insertionType]) => {
					if (helper.path(node) !== helper.path(draggedOverNode)) {
						return HighlighType.none;
					}

					return HighlighType.nest;
				}
			);
		},
		isDragged(node: Node): boolean {
			return helper.path(node) === helper.path(draggedNode);
		},
		dragEnter(e: DragEvent, tree: Tree, draggedOverNode: Node) {
			validTargetStore.set(isValidTarget(tree, draggedOverNode));

			clearTimeout(nestTimeTimeout);

			if (config.timeToNest) {
				nestTimeTimeout = setTimeout(() => {
					console.log('allow nest because of time');
					// nestTime.set(true);
				}, config.timeToNest);
			}

			console.log('drag enter over', helper.path(draggedOverNode));

			draggedOverNodeStore.set(draggedOverNode);
		}
	};
}
