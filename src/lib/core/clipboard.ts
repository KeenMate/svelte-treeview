// ─── Clipboard types & module-level singleton ─────────────────────────────
// Shared across all TreeController instances for cross-tree copy/cut/paste.

export interface ClipboardEntry<T> {
	sourceTreeId: string;
	sourcePath: string;
	data: T; // structuredClone of node.data
	descendants: Array<{
		relativePath: string; // path relative to source (e.g. "1.2" under "1" → ".2")
		data: T;
	}>;
}

export interface TreeClipboard<T> {
	operation: 'copy' | 'cut';
	entries: ClipboardEntry<T>[];
	sourceTreeId: string;
}

// Module-level singleton — shared across all tree instances on the page
let _clipboard: TreeClipboard<any> | null = null;

export function setClipboard<T>(clip: TreeClipboard<T>): void {
	_clipboard = clip;
}

export function getClipboard<T>(): TreeClipboard<T> | null {
	return _clipboard as TreeClipboard<T> | null;
}

export function clearClipboard(): void {
	_clipboard = null;
}

export function hasClipboard(): boolean {
	return _clipboard !== null;
}

export function getClipboardOperation(): 'copy' | 'cut' | null {
	return _clipboard?.operation ?? null;
}
