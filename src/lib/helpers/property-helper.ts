import type { Node, NodePath, Props, VisualStates } from '$lib/types.js';

export class PropertyHelper {
	props: Props;
	constructor(props: Props) {
		this.props = props;
	}

	private getVal<T>(node: Node, key: string): T {
		return (node as any)?.[key] as T;
	}

	private setVal(node: Node, key: string, value: any) {
		(node as any)[key] = value;
	}

	path(node: Node): NodePath {
		// root node
		if (node === null) {
			return null;
		}

		return this.getVal(node, this.props.nodePath);
	}

	setPath(node: Node, path: NodePath) {
		this.setVal(node, this.props.nodePath, path);
	}

	hasChildren(node: Node): boolean {
		return this.getVal(node, this.props.hasChildren) ?? false;
	}

	setHasChildren(node: Node, hasChildren: boolean) {
		this.setVal(node, this.props.hasChildren, hasChildren);
	}

	expanded(node: Node): boolean | null {
		return this.getVal(node, this.props.expanded) ?? null;
	}

	setExpanded(node: Node, expanded: boolean) {
		this.setVal(node, this.props.expanded, expanded);
	}

	selected(node: Node): boolean | null {
		return this.getVal(node, this.props.selected);
	}

	setSelected(node: Node, selected: boolean | null) {
		this.setVal(node, this.props.selected, selected);
	}

	useCallback(node: Node): boolean {
		return this.getVal(node, this.props.useCallback) ?? false;
	}

	setUseCallback(node: Node, useCallback: boolean) {
		this.setVal(node, this.props.useCallback, useCallback);
	}

	priority(node: Node): number {
		return this.getVal(node, this.props.priority) ?? 0;
	}

	setPriority(node: Node, priority: number | undefined) {
		this.setVal(node, this.props.priority, priority);
	}

	isDraggable(node: Node): boolean {
		return this.getVal(node, this.props.isDraggable) ?? false;
	}

	setIsDraggable(node: Node, isDraggable: boolean) {
		this.setVal(node, this.props.isDraggable, isDraggable);
	}

	insertDisabled(node: Node): boolean {
		return this.getVal(node, this.props.insertDisabled) ?? false;
	}

	setInsertDisabled(node: Node, insertDisabled: boolean) {
		this.setVal(node, this.props.insertDisabled, insertDisabled);
	}

	nestDisabled(node: Node): boolean {
		return this.getVal(node, this.props.nestDisabled) ?? false;
	}

	setNestDisabled(node: Node, nestDisabled: boolean) {
		this.setVal(node, this.props.nestDisabled, nestDisabled);
	}

	checkbox(node: Node): boolean | null {
		return this.getVal(node, this.props.checkbox) ?? null;
	}

	setCheckbox(node: Node, checkbox: boolean) {
		this.setVal(node, this.props.checkbox, checkbox);
	}

	visualState(node: Node): VisualStates | null {
		return this.getVal(node, this.props.visualState) ?? null;
	}

	setVisualState(node: Node, visualState: VisualStates | null) {
		this.setVal(node, this.props.visualState, visualState);
	}
}
