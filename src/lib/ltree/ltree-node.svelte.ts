export type NodeId = string | number;
export type DropPosition = 'before' | 'after' | 'child';

export enum VisualState {
	indeterminate = "indeterminate",
	selected = "true",
	notSelected = "false",
}

export interface LTreeNode<T> {
	treeId: string;
	id: NodeId;
	path: string;
	pathSegment: string;
	parentPath: string | null | undefined;
	level: number | null | undefined;

	children: Record<string, LTreeNode<T>>;
	hasChildren: boolean;
	data: T | null | undefined;

	useCallback: boolean;
	priority: number | null | undefined;

	isDraggable: boolean;
	isCollapsible: boolean;
	isDropAllowed: boolean;
	allowedDropPositions: DropPosition[] | null | undefined;

	isInsertAllowed: boolean;
	isNestAllowed: boolean;
	isCheckboxVisible: boolean | null | undefined;

	visualState: VisualState;
	isExpanded: boolean;
	isSelected: boolean;

	isSelectable: boolean;

	_rev: number;
}

export function createLTreeNode<T>(data?: Partial<LTreeNode<T>>): LTreeNode<T> {
	return {
		treeId: "",
		path: "",
		pathSegment: "",
		parentPath: undefined,
		level: undefined,
		id: -1,

		children: {},
		hasChildren: false,
		data: undefined,

		useCallback: false,
		priority: undefined,
		isDraggable: true,
		isCollapsible: true,
		isDropAllowed: true,
		allowedDropPositions: undefined,
		isInsertAllowed: true,
		isNestAllowed: true,
		isCheckboxVisible: false,
		visualState: VisualState.indeterminate,
		isExpanded: false,
		isSelected: false,

		isSelectable: true,

		_rev: 0,
		...data
	};
}
