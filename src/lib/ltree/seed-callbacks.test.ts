import { describe, it, expect } from 'vitest';
import { createLTree } from './ltree.svelte.js';
import type { LTreeNode } from './ltree-node.svelte.js';

// Regression test for the seed-time callback ordering bug:
//
//   insertArray (and insertBranch) used to call _getIsDraggableCallback(node)
//   etc BEFORE assigning `node.data = row`, so consumer callbacks reading
//   `node.data?.X` saw `undefined` and returned whatever their default branch
//   produced (typically `true` for `node.data?.isDraggable !== false`).
//
//   The bug affected getIsExpandedCallback, getIsSelectableCallback,
//   getIsSelectedCallback, getIsDraggableCallback, getIsDropAllowedCallback.
//   Caught in production by the /examples/drag-drop demo (every node draggable
//   even though File C was marked isDraggable: false).
//
// These tests pass callbacks that explicitly read `node.data?.X` and assert
// the resulting node carries the correct flag. If `node.data` is undefined at
// callback time the assertion flips.

type Row = {
	id: string;
	path: string;
	name: string;
	isExpanded?: boolean;
	isSelectable?: boolean;
	isSelected?: boolean;
	isDraggable?: boolean;
	isDropAllowed?: boolean;
};

function sortByPath(items: LTreeNode<Row>[]) {
	return [...items].sort((a, b) => a.path.localeCompare(b.path));
}

const fixture: Row[] = [
	{ id: 'a', path: '1', name: 'Root A' },                                          // all defaults true
	{ id: 'b', path: '1.1', name: 'Pinned', isDraggable: false, isDropAllowed: false }, // both false via data
	{ id: 'c', path: '1.2', name: 'Locked', isSelectable: false, isSelected: false },    // both false via data
	{ id: 'd', path: '2', name: 'Open', isExpanded: true },                          // expanded via data
];

function buildTree(opts: {
	withCallbacks: boolean;
}) {
	const cb = opts.withCallbacks;
	return createLTree<Row>(
		'id',          // _idMember
		'path',        // _pathMember
		undefined,     // _parentPathMember
		undefined,     // _levelMember
		undefined,     // _hasChildrenMember
		undefined,     // _isExpandedMember
		cb ? (n) => n.data?.isExpanded !== false : undefined,
		undefined,     // _isSelectableMember
		cb ? (n) => n.data?.isSelectable !== false : undefined,
		undefined,     // _isSelectedMember
		cb ? (n) => n.data?.isSelected === true : undefined,
		undefined,     // _isDraggableMember
		cb ? (n) => n.data?.isDraggable !== false : undefined,
		undefined,     // _isDropAllowedMember
		cb ? (n) => n.data?.isDropAllowed !== false : undefined,
		undefined,     // _allowedDropPositionsMember
		'name',        // _displayValueMember
		undefined,     // _getDisplayValueCallback
		undefined,     // _searchValueMember
		undefined,     // _getSearchValueCallback
		undefined,     // _getAllowedDropPositionsCallback
		undefined,     // _isCollapsibleMember
		undefined,     // _getIsCollapsibleCallback
		undefined,     // _orderMember
		'seed-cb-tree',
		'.',
		2,             // expandLevel — sets isExpanded for level<=2 unless callback overrides
		false,
		undefined,
		25,
		50,
		{ sortCallback: sortByPath }
	);
}

describe('insertArray seed-time get*Callback', () => {
	const ltree = buildTree({ withCallbacks: true });
	ltree.insertArray(fixture);

	it('getIsDraggableCallback sees node.data populated and File-Pinned ends up not draggable', () => {
		const pinned = ltree.getNodeByPath('1.1');
		const normal = ltree.getNodeByPath('1');
		expect(pinned?.isDraggable).toBe(false);
		expect(normal?.isDraggable).toBe(true);
	});

	it('getIsSelectableCallback sees node.data and Locked is not selectable', () => {
		const locked = ltree.getNodeByPath('1.2');
		const normal = ltree.getNodeByPath('1');
		expect(locked?.isSelectable).toBe(false);
		expect(normal?.isSelectable).toBe(true);
	});

	it('getIsSelectedCallback sees node.data and Locked carries isSelected=false', () => {
		const locked = ltree.getNodeByPath('1.2');
		expect(locked?.isSelected).toBe(false);
	});

	it('getIsExpandedCallback sees node.data and Open is expanded', () => {
		const open = ltree.getNodeByPath('2');
		expect(open?.isExpanded).toBe(true);
	});

	it('getIsDropAllowedCallback sees node.data and Pinned does not allow drops', () => {
		const pinned = ltree.getNodeByPath('1.1');
		const normal = ltree.getNodeByPath('1');
		expect(pinned?.isDropAllowed).toBe(false);
		expect(normal?.isDropAllowed).toBe(true);
	});

	it('every node has node.data assigned post-insert', () => {
		for (const path of ['1', '1.1', '1.2', '2']) {
			const node = ltree.getNodeByPath(path);
			expect(node?.data).toBeDefined();
			expect(node?.data?.path).toBe(path);
		}
	});
});

describe('insertBranch seed-time get*Callback', () => {
	const ltree = buildTree({ withCallbacks: true });
	// Seed an empty parent first
	ltree.insertArray([{ id: 'root', path: '1', name: 'Root' }]);

	// Insert a branch with callback-driven flags
	ltree.insertBranch('1', [
		{ id: 'a', path: '1.1', name: 'BranchPinned', isDraggable: false },
		{ id: 'b', path: '1.2', name: 'BranchNormal' }
	]);

	it('branch insert preserves callback semantics — pinned child ends up non-draggable', () => {
		const branchPinned = ltree.getNodeByPath('1.1');
		const branchNormal = ltree.getNodeByPath('1.2');
		expect(branchPinned?.isDraggable).toBe(false);
		expect(branchNormal?.isDraggable).toBe(true);
		expect(branchPinned?.data?.name).toBe('BranchPinned');
	});
});
