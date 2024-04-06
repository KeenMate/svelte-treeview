import type { Node, NodePath, Props } from '$lib/types.js';

export class PropertyHelper {
	props: Props;
	constructor(props: Props) {
		this.props = props;
	}

	path(node: Node): NodePath {
		// root node
		if (node === null) {
			return null;
		}

		return node?.[this.props.nodePath];
	}

	setPath(node: Node, path: NodePath) {
		node[this.props.nodePath] = path;
	}

	hasChildren(node: Node) {
		return node?.[this.props.hasChildren];
	}

	setHasChildren(node: Node, hasChildren: boolean) {
		node[this.props.hasChildren] = hasChildren;
	}

	expanded(node: Node) {
		return node?.[this.props.expanded];
	}

	setExpanded(node: Node, expanded: boolean) {
		node[this.props.expanded] = expanded;
	}

	selected(node: Node) {
		return node?.[this.props.selected];
	}

	setSelected(node: Node, selected: boolean) {
		node[this.props.selected] = selected;
	}

	useCallback(node: Node) {
		return node?.[this.props.useCallback];
	}

	setUseCallback(node: Node, useCallback: boolean) {
		node[this.props.useCallback] = useCallback;
	}

	priority(node: Node) {
		return node?.[this.props.priority];
	}

	setPriority(node: Node, priority: number | undefined) {
		node[this.props.priority] = priority;
	}

	isDraggable(node: Node) {
		return node?.[this.props.isDraggable];
	}

	setIsDraggable(node: Node, isDraggable: boolean) {
		node[this.props.isDraggable] = isDraggable;
	}

	insertDisabled(node: Node) {
		return node?.[this.props.insertDisabled];
	}

	setInsertDisabled(node: Node, insertDisabled: boolean) {
		node[this.props.insertDisabled] = insertDisabled;
	}

	nestDisabled(node: Node) {
		return node?.[this.props.nestDisabled];
	}

	setNestDisabled(node: Node, nestDisabled: boolean) {
		node[this.props.nestDisabled] = nestDisabled;
	}

	checkbox(node: Node) {
		return node?.[this.props.checkbox];
	}

	setCheckbox(node: Node, checkbox: boolean) {
		node[this.props.checkbox] = checkbox;
	}

	visualState(node: Node) {
		return node?.[this.props.visualState];
	}

	setVisualState(node: Node, visualState: string) {
		node[this.props.visualState] = visualState;
	}
}
