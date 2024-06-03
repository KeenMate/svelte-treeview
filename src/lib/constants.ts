import type { HelperConfig, CustomizableClasses, Props } from '$lib/types.js';

export const defaultPropNames: Props = {
	nodePath: 'nodePath',
	nodeId: 'nodePath',
	hasChildren: 'hasChildren',
	useCallback: '__useCallback',
	priority: 'priority',
	dragDisabled: 'dragDisabled',
	insertDisabled: 'insertDisabled',
	nestAllowed: 'nestAllowed',
	checkbox: 'checkbox'
};

export const defaultClasses: CustomizableClasses = {
	treeClass: 'treeview',
	expandClass: 'inserting-highlighted',
	currentlyDraggedClass: 'currently-dragged',
	nodeClass: '',
	expandIcon: 'far fa-fw fa-plus-square',
	collapseIcon: 'far fa-fw fa-minus-square',
	inserLineClass: '',
	nestIcon: 'fas fa-level-down-alt'
};

export const defaultConfig: HelperConfig = {
	separator: '.'
};

export const capturedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '];