import type { NodePath } from '$lib/types.js';

export function getParentNodePath(nodePath: NodePath, separator: string): NodePath {
	if (nodePath == null) throw new Error('cannot get parent of root');

	const parentPath = nodePath?.substring(0, nodePath.lastIndexOf(separator));
	if (parentPath === '') return null;

	return parentPath ?? null;
}

export function isChildrenOf(parentNodePath: NodePath, childrenNodePath: NodePath) {
	if (parentNodePath === childrenNodePath) return false;

	return childrenNodePath?.startsWith(parentNodePath ?? '');
}

export function nodePathIsChild(nodePath: NodePath, separator: string) {
	const includesSeparator = nodePath?.includes(separator);
	return includesSeparator;
}

//based on number of dots
export function getDepthLevel(nodePath: NodePath, separator: string) {
	if (nodePath == null) return 0;

	return nodePath.split(separator).length;
}
