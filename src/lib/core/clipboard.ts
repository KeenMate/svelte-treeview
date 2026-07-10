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

// ─── Cross-tree controller registry ───────────────────────────────────────
// Minimal registry so a paste can reach back to the SOURCE tree it came from
// (identified by clipboard.sourceTreeId) — needed to remove the originals on a
// cross-tree CUT (a same-tree cut removes them directly). Kept to a tiny surface
// (just removeNode) to avoid a circular type dependency on TreeController.
export interface ClipboardSourceTree {
	removeNode(path: string, includeDescendants?: boolean): unknown;
	/** Resolve a live node by path in the SOURCE tree — needed for a cross-tree COPY that
	 *  the library auto-handles (it reads the source subtree to duplicate it into the dest). */
	getNodeByPath(path: string): unknown;
	/** The source Ltree, passed to the dest's duplicateNodes() so the manifest paths resolve
	 *  in the source tree's path space. Loosely typed to avoid a circular dep on TreeController. */
	readonly tree: unknown;
}

const _trees = new Map<string, ClipboardSourceTree>();

export function registerClipboardTree(id: string, tree: ClipboardSourceTree): void {
	if (id) _trees.set(id, tree);
}

export function unregisterClipboardTree(id: string, tree: ClipboardSourceTree): void {
	if (_trees.get(id) === tree) _trees.delete(id);
}

export function getClipboardTree(id: string): ClipboardSourceTree | undefined {
	return _trees.get(id);
}

// ─── Cross-tree drag set ──────────────────────────────────────────────────
// Published by the SOURCE tree on drag start so a CROSS-TREE drop/dragover can see
// what's moving (the target controller only gets ONE reconstituted node from
// dataTransfer and can't read the source's highlight set). Two views:
//  - `paths`: the TOP-LEVEL dragged set → exposed via ctx.dragged on the on* events.
//  - `manifest`: the PLACEMENT manifest the library feeds to duplicateNodes/moveNodes —
//    a curated beforeDragStart override AS-IS (holes preserved) or, for a plain drag, the
//    COMPLETE set (every descendant) so whole subtrees copy. Cross-tree auto-copy reads this.
// Same-tree drops don't need this — they compute the set from their own live highlight.
let _dragSet: { sourceTreeId: string; paths: string[]; manifest: string[] } | null = null;

export function setDragSet(sourceTreeId: string, paths: string[], manifest: string[]): void {
	_dragSet = { sourceTreeId, paths, manifest };
}

export function getDragSet(): { sourceTreeId: string; paths: string[]; manifest: string[] } | null {
	return _dragSet;
}

export function clearDragSet(): void {
	_dragSet = null;
}

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

/**
 * Pick a name that doesn't collide with `taken`, appending a suffix until free.
 * Convenience for collision-aware paste naming inside a nodeInputTransformationCallback:
 * `name: uniqueName(data.name, ctx.target.siblings.map(s => s.data?.name))`. Because the transform
 * reads the pristine clipboard snapshot every paste, `base` is never pre-suffixed — no
 * "Copy 1 Copy 1".
 *
 * @param base   The desired name.
 * @param taken  Names already in use (e.g. read off the destination's sibling nodes).
 * @param suffix Formats the n-th alternative; defaults to `${base} Copy ${n}` (n from 1).
 */
export function uniqueName(
	base: string,
	taken: Iterable<string>,
	suffix: (base: string, n: number) => string = (b, n) => `${b} Copy ${n}`
): string {
	const takenSet = taken instanceof Set ? (taken as Set<string>) : new Set(taken);
	if (!takenSet.has(base)) return base;
	let n = 1;
	while (takenSet.has(suffix(base, n))) n++;
	return suffix(base, n);
}
