export type Props = {
	nodeId: string;
	nodePath: string;
	hasChildren: string;
	useCallback: string;
	priority: string;
	isDraggable: string;
	insertDisabled: string;
	nestDisabled: string;
	checkbox: string;
};

export type MappedNode = {
	id: NodeId;
	path: NodePath;
	hasChildren: boolean;
	useCallback: boolean;
	priority: number;
	isDraggable: boolean;
	insertDisabled: boolean;
	nestDisabled: boolean;
	checkbox: boolean;
};

export type Node = {
	originalNode: any;
	id: NodeId;
	path: NodePath;
	hasChildren: boolean;
	useCallback: boolean;
	priority: number;
	isDraggable: boolean;
	insertDisabled: boolean;
	nestDisabled: boolean;
	checkbox: boolean;
	visualState: VisualState;
	expanded: boolean;
	selected: boolean;
};

export enum VisualState {
	indeterminate = 'indeterminate',
	selected = 'true',
	notSelected = 'false'
}

export enum SelectionModes {
	all = 'all',
	perNode = 'perNode',
	none = 'none'
}

export type Tree = Node[];
export enum InsertionType {
	above = 'above',
	below = 'below',
	nest = 'nest'
}
export type NodePath = string | null;
export type NodeId = string | number;

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

export type DragEnterCallback = (draggendNode: Node, oldParent: Node, newParent: Node) => boolean;

export type BeforeMovedCallback = (
	draggendNode: Node,
	oldParent: Node,
	newParent: Node,
	insertionType: string
) => boolean;

export type ExpandedCallback = (node: Node) => Promise<void>;

export type HelperConfig = {
	separator: string;
};

export enum HighlighType {
	nest = 'nest',
	insertAbove = 'insert-above',
	insertBelow = 'insert-below',
	none = 'none'
}

export type TreeVisualStates = {
	[nodePath: string]: VisualState;
};

// unmapped values provided by the user
export type ProvidedTree = any[];

export type FilterFunction = (node: Node) => boolean;
