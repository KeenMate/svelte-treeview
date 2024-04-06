import type { Props } from '$lib/types.js';

export const defaultPropNames: Props = {
	nodePath: 'nodePath',
	hasChildren: 'hasChildren',
	expanded: '__expanded',
	selected: '__selected',
	useCallback: '__useCallback',
	priority: 'priority',
	isDraggable: 'isDraggable',
	insertDisabled: 'insertDisabled',
	nestDisabled: 'nestDisabled',
	checkbox: 'checkbox',
	visualState: '__visual_state'
};

export const defaultPixelTreshold = 50;

export const defaultTreeClass = 'treeview';
export const defaultExpandClass = 'inserting-highlighted';
export const defaultCurrentlyDraggedClass = 'currently-dragged';
