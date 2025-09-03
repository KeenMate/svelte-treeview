export type NodeId = string | number;

export enum VisualState {
	indeterminate = "indeterminate",
	selected = "true",
	notSelected = "false",
}

export interface LTreeTrieNode<T> {
	treeId: string;
	id: NodeId;
	path: string;
	pathSegment: string;
	parentPath: string | null | undefined;
	level: number | null | undefined;

	children: Record<string, LTreeTrieNode<T>>;
	hasChildren: boolean;
	data: T | null | undefined;

	useCallback: boolean;
	priority: number | null | undefined;

	isDragAllowed: boolean;
	isDropAllowed: boolean;

	isInsertAllowed: boolean;
	isNestAllowed: boolean;
	isCheckboxVisible: boolean | null | undefined;

	visualState: VisualState;
	isExpanded: boolean;
	isSelected: boolean;

	isSelectable: boolean;
}

export function createLTreeTrieNode<T>(data?: Partial<LTreeTrieNode<T>>): LTreeTrieNode<T> {
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
		isDragAllowed: true,
		isDropAllowed: true,
		isInsertAllowed: true,
		isNestAllowed: true,
		isCheckboxVisible: false,
		visualState: VisualState.indeterminate,
		isExpanded: false,
		isSelected: false,

		isSelectable: true,
		...data
	};
}
