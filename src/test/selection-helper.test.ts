import { TreeHelper, VisualState } from '$lib/index.js';
import { SelectionProvider } from '$lib/providers/selection-provider.js';
import type { Node, NodeId, Tree } from '$lib/types.js';
import { expect, test } from 'vitest';
import { expectArrayEqual } from './helpers.js';

const testingTree: any[] = [
	{ path: '0' },
	{ path: '1', hasChildren: true },
	{ path: '1.4' },
	{ path: '1.6' },
	{ path: '1.7', hasChildren: true },
	{ path: '1.7.10' },
	{ path: '1.7.11' },
	{ path: '1.8' },
	{ path: '1.9' },
	{ path: '2', hasChildren: true },
	{ path: '2.5' },
	{ path: '3' }
];

function getTree(treeHelper: TreeHelper, testSpecifcNodes: any[] = []): Tree {
	return [...testingTree, ...testSpecifcNodes].map((node) => ({ ...node, id: node.path } as Node));
}

function getHelper(recursive: boolean): { helper: TreeHelper; selection: SelectionProvider } {
	const helper = new TreeHelper({ recursive, separator: '.' });
	const selection = new SelectionProvider(helper, recursive);
	return { helper, selection };
}

test('getChildrenWithCheckboxes test root', () => {
	const { helper, selection } = getHelper(true);
	const tree = getTree(helper);

	// from root
	const children = selection.getSelectableDirectChildren(tree, null);

	const paths = children.map((node) => node.path);
	expect(paths).toEqual(['0', '1', '2', '3']);
});

test('getChildrenWithCheckboxes parent is normal node', () => {
	const { helper, selection } = getHelper(true);
	const tree = getTree(helper);

	// from root
	const children = selection.getSelectableDirectChildren(tree, '1');
	const paths = children.map((node) => node.path);
	expect(paths).toEqual(['1.4', '1.6', '1.7', '1.8', '1.9']);
});

test('getChildrenWithCheckboxes parent is leaf node', () => {
	const { helper, selection } = getHelper(true);
	const tree = getTree(helper);

	// from root
	const children = selection.getSelectableDirectChildren(tree, '1.4');
	const paths = children.map((node) => node.path);
	expect(paths).toEqual([]);
});

test('setSelection non-recursive', () => {
	const { helper, selection: selectionProvider } = getHelper(false);
	const tree = getTree(helper);

	const nodePath = '1.7';
	const nodeId = nodePath;

	let selection: NodeId[] = ['2.5'];

	selection = selectionProvider.setSelection(tree, nodePath, true, selection);
	expectArrayEqual(selection, [nodeId, '2.5']);

	selection = selectionProvider.setSelection(tree, nodePath, false, selection);

	expectArrayEqual(selection, ['2.5']);
});

test('setSelection recursive all children are leaf', () => {
	const { helper, selection: selectionProvider } = getHelper(true);
	const tree = getTree(helper);

	const parentNodePath = '1.7';
	//test it changes all selection not just toggles
	let selection: NodeId[] = ['1.7.10'];

	selection = selectionProvider.setSelection(tree, parentNodePath, true, selection);
	let visualStates = selectionProvider.computeVisualStates(tree, selection);

	// check that intermidiate is calcullated correcly
	expect(visualStates['1']).toBe(VisualState.indeterminate);

	const children = helper.getDirectChildren(tree, parentNodePath);

	const childrenIds = children.map((node) => node.id);
	expectArrayEqual(childrenIds, ['1.7.10', '1.7.11']);

	// all children should be selected
	expectArrayEqual(selection, childrenIds);

	// remove one children
	selection = selection.filter((x) => x !== '1.7.10');

	selection = selectionProvider.setSelection(tree, parentNodePath, false, selection);
	visualStates = selectionProvider.computeVisualStates(tree, selection);

	expect(visualStates['1']).toBe(VisualState.notSelected);
	expect(visualStates['1.7']).toBe(VisualState.notSelected);

	expect(selection).toEqual([]);
});

test('setSelection recursive all children are not leaf', () => {
	const { helper, selection: selectionProvider } = getHelper(true);
	const tree = getTree(helper);

	const parentNodePath = '1';
	let selection: NodeId[] = ['1.7.10'];

	selection = selectionProvider.setSelection(tree, parentNodePath, true, selection);
	let visualStates = selectionProvider.computeVisualStates(tree, selection);

	expect(visualStates['1']).toBe(VisualState.selected);

	const leafChildrenIds = helper
		.allCHildren(tree, parentNodePath)
		.filter((node) => !node.hasChildren)
		.map((node) => node.id);

	expectArrayEqual(selection, leafChildrenIds);

	selection = selectionProvider.setSelection(tree, '1.7.10', false, selection);
	selection = selectionProvider.setSelection(tree, parentNodePath, false, selection);
	visualStates = selectionProvider.computeVisualStates(tree, selection);

	expect(visualStates['1']).toBe(VisualState.notSelected);
	expect(selection).toEqual([]);
});

test('setSelection recursive parent is root', () => {
	const { helper, selection: selectionProvider } = getHelper(true);
	const tree = getTree(helper);

	const parentNodePath = null;

	let selection: NodeId[] = [];

	selection = selectionProvider.setSelection(tree, parentNodePath, true, selection);

	const allChildrenIds = helper
		.allCHildren(tree, parentNodePath)
		.filter((node) => !node.hasChildren)
		.map((node) => node.id);

	expectArrayEqual(allChildrenIds, selection);

	selection = selectionProvider.setSelection(tree, parentNodePath, false, selection);

	expect(selection).toEqual([]);
});

test('setSelection recursive if one child has hasChildren set to true but no actual children', () => {
	// expected behavior is that graphically it will be selected
	// but logically it will be ignored

	const { helper, selection: selectionProvider } = getHelper(true);
	const tree = getTree(helper, [{ path: '2.12', hasChildren: true }]);

	const parentNodePath = '2';

	const children = helper.allCHildren(tree, parentNodePath);
	expect(children.length).toBe(2);

	let selected: NodeId[] = [];

	selected = selectionProvider.setSelection(tree, parentNodePath, true, selected);
	let visualStates = selectionProvider.computeVisualStates(tree, selected);

	expectArrayEqual(selected, ['2.5']);

	selected = selectionProvider.setSelection(tree, parentNodePath, false, selected);

	visualStates = selectionProvider.computeVisualStates(tree, selected);

	// we can never unselect node that has hasChildren set to true but doesnt have any children
	expect(selectionProvider.isSelected('2.12', visualStates, selected)).toBe(true);
	expect(selectionProvider.isSelected('2.5', visualStates, selected)).toBe(false);
	expect(selectionProvider.isSelected('2', visualStates, selected)).toBe(false);
});
