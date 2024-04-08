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

export enum selectionModes {
	all = 'all',
	perNode = 'perNode',
	none = 'none'
}

// this disallows direct access to the node object and forces usage of the helper
export type Node = unknown;

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

export type DragEnterCallback = (draggendNode: Node, oldParent: Node, newParent: Node) => boolean;
export type BeforeMovedCallback = (
	draggendNode: Node,
	oldParent: Node,
	newParent: Node,
	insertionType: string
) => boolean;
export type ExpandedCallback = (node: Node) => Promise<Node[]>;
export type HelperConfig = {
	separator?: string;
	recursive?: boolean;
	recalculateNodePath?: boolean;
	checkboxes?: selectionModes;
};