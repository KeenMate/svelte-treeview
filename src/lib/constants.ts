import {
	type HelperConfig,
	SelectionModes,
	type CustomizableClasses,
	type Props
} from '$lib/types.js';

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

export const defaultClasses: CustomizableClasses = {
	treeClass: 'treeview',
	expandClass: 'inserting-highlighted',
	currentlyDraggedClass: 'currently-dragged',
	nodeClass: '',
	expandedToggleClass: '',
	collapsedToggleClass: '',
	inserLineClass: '',
	inserLineNestClass: ''
};

export const defaultConfig: HelperConfig = {
	separator: '.',
	checkboxes: SelectionModes.none
};
