// TODO rename nodeId to id and nodePath to path
import {TreeViewDraggableType} from "./constants.js"
import {TreeHelper} from "./helpers/tree-helper.js"

export type TreeProps = {
	nodeId: string;
	nodePath: string;
	hasChildren: string;
	useCallback: string;
	priority: string;
	dragDisabled: string;
	insertDisabled: string;
	nestAllowed: string;
	checkbox: string;
};

export type TreeConfig = {
	treeId: string;
	treeProps: Partial<TreeProps>;
	verticalLines: boolean;
	separator: string;
	recursiveSelection: boolean;
	selectionMode: SelectionModes;
	onlyLeafCheckboxes: boolean; //bool
	hideDisabledCheckboxes: boolean; //bool
	loadChildrenAsync: ExpandedCallback | null;
	showContextMenu: boolean;
	expandTo: number;
	expansionThreshold: number;
	filter: FilterFunction | null;
	nodeSorter: NodeSorter | null;
	dragMode: DragMode | undefined; //bool
	dropDisabledCallback: DragEnterCallback | null;
	allowKeyboardNavigation: boolean;
	insertionType: InsertionType;
}

export type VolatileTreeConfig = {
	readonly: boolean;
	cssClasses: Partial<CustomizableClasses>;
}

export type TreeState = {
	helper: TreeHelper,
	computedTree: ProvidedTree,
	logger: ((...data: unknown[]) => void) | null;
	highlightedNode: Node | null,
	focusedNode: Node | null
}

export type MappedNode = {
	id: NodeId;
	path: string;
	hasChildren: boolean;
	useCallback: boolean;
	priority: number;
	isDraggable: boolean;
	insertDisabled: boolean;
	nestDisabled: boolean;
	checkbox: boolean;
};

export type Node = {
	// TODO maybe use generics
	originalNode: any;
	id: NodeId;
	path: string;
	hasChildren: boolean;
	useCallback: boolean;
	priority: number;
	dragDisabled: boolean;
	insertDisabled: boolean;
	nestAllowed: boolean;
	checkbox: boolean | null;
	visualState: VisualState;
	expanded: boolean;
	selected: boolean;
	dropDisabled: boolean;
};

export enum VisualState {
	indeterminate = "indeterminate",
	selected = "true",
	notSelected = "false"
}

export enum SelectionModes {
	all = "all",
	perNode = "perNode",
	none = "none"
}

export type Tree = Node[];

export type NodeId = string | number;

export type CustomizableClasses = {
	treeClass: string;
	nodeClass: string;
	expandIcon: string;
	collapseIcon: string;
	nestIcon: string;
	expandClass: string;
	insertLineClass: string;
	currentlyDraggedClass: string;
};

export type DragEnterCallback = (draggedContext: DraggableContext, targetNode: Node) => Promise<boolean>;

export type BeforeMovedCallback = (
	draggedNode: Node,
	oldParent: Node,
	newParent: Node,
	insertionType: string
) => boolean;

export type ExpandedCallback = (node: Node) => Promise<void>;

export type HelperConfig = {
	separator: string;
	nodeSorter?: NodeSorter | null
};

export enum InsertionType {
	nest = "nest",
	insertAbove = "insert-above",
	insertBelow = "insert-below",
	none = "none"
}

export type TreeVisualStates = {
	[nodePath: string]: VisualState;
};

// unmapped values provided by the user
export type ProvidedTree = any[];

export type FilterFunction = (node: Node) => boolean;

export enum KeyboardMovement {
	Up = "ArrowUp",
	Down = "ArrowDown",
	Left = "ArrowLeft",
	Right = "ArrowRight"
}

export type NodeSorter = (left: Node, right: Node) => number

export type DragMode = "local" | "drag_source" | "drag_target" | "drag_both"

export type DraggableContext = {
	type: typeof TreeViewDraggableType
	treeId: string
	node: Node
	dragMode: "local" | "drag_source" | "drag_both"
}
