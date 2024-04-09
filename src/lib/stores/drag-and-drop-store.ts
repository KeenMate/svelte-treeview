import type { TreeHelper } from '$lib/helpers/tree-helper.js';
import { type BeforeMovedCallback, type DragEnterCallback, HighlighType } from '$lib/types.js';
import { derived, type Readable, writable } from 'svelte/store';

const storeDefaults = {
	dragging: false,
	x: 0,
	y: 0
};

type dragConfig = {
	dragEnterCallback: DragEnterCallback | null;
	beforeMovedCallback: BeforeMovedCallback | null;
};

export function startDrag(config: dragConfig) {
	const draggedNodeStore = writable(null);

	return {
		highligh(helper: TreeHelper, node: Node): Readable<HighlighType> {
			// forces update when gragged nodes is changed
			return derived([draggedNodeStore], ([store]) => {
				return HighlighType.none;
			});
		},
		isDragged(helper: TreeHelper, node: Node): Readable<boolean> {
			return derived([draggedNodeStore], ([draggedNode]) => {
				return helper.path(node) === helper.path(draggedNode);
			});
		}
	};
}
