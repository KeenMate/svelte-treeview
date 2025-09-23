import { isEmptyString } from './string-helpers.js';

export function getParentPath(path: string, pathSeparator: string = '.'): string | null {
	if (!path || typeof path !== 'string') return null;

	const lastDotIndex = path.lastIndexOf(pathSeparator);
	return lastDotIndex === -1 ? '' : path.substring(0, lastDotIndex);
}

export function getRelativePath(path: string, parentPath: string, pathSeparator: string = '.'): string {
	if (isEmptyString(parentPath)) return path;

	return path.startsWith(parentPath + pathSeparator) ? path.substring(parentPath.length + pathSeparator.length) : path;
}

export function getPathSegments(path: string, start: number = 0, count: number = 1, pathSeparator: string = '.'): string {
	const segments = path.split(pathSeparator);
	const taken = segments.slice(start, start + count);
	return taken.join(pathSeparator);
}

export function getLevel(path: string, pathSeparator: string): number {
	return path.split(pathSeparator).length;
}
