export type Props = {
	nodeId: string;
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

// this disallows direct access to the node object and forces usage of the helper
// TODO maybe implement some generics for event handlers and such
// keep this only for internal stuff
export type Node = object;

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

export type ExpandedCallback = (node: Node) => Promise<Node[]>;

export type HelperConfig = {
	separator: string;
	recursive?: boolean;
	recalculateNodePath?: boolean;
	checkboxes?: SelectionModes;
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
