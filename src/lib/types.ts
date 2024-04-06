export type Props = {
	nodePath: string;
	hasChildren: string;
	expanded: string;
	selected: string;
	useCallback: string;
	priority: string;
	isDraggable: string;
	insertDisabled: string;
	nestDisabled: string;
	checkbox: string;
	visualState: string;
};

export enum visualStates {
	indeterminate = 'indeterminate',
	selected = 'true',
	notSelected = 'false'
}

export enum checkboxesTypes {
	all = 'all',
	perNode = 'perNode',
	none = 'none',
	readonly = 'readonly'
}

export type Node = any;

export type Tree = Node[];
export type InsertionType = -1 | 0 | 1;
export type NodePath = string | null;

export type CustomizableClasses = {
	treeClass: string;
	nodeClass: string;
	expandedToggleClass: string;
	collapsedToggleClass: string;
	expandClass: string;
	inserLineClass: string;
	inserLineNestClass: string;
	currentlyDraggedClass: string;
};
