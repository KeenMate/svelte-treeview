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

