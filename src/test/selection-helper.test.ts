import { PropertyHelper } from '$lib/helpers/property-helper.js';
import { TreeHelper } from '$lib/index.js';
import { type Props, VisualStates } from '$lib/types.js';
import { expect, test } from 'vitest';

const testingProperties: Props = {
	nodePath: 'nodePath2',
	hasChildren: 'hasChildren2',
	expanded: '__expanded2',
	selected: '__selected2',
	useCallback: '__useCallback2',
	priority: 'priority2',
	isDraggable: 'isDraggable2',
	insertDisabled: 'insertDisabled2',
	nestDisabled: 'nestDisabled2',
	checkbox: 'checkbox2',
	visualState: '__visual_state2'
};

const testingTree: any[] = [
	{ nodePath: '0' },
	{ nodePath: '1', hasChildren: true },
	{ nodePath: '1.4' },
	{ nodePath: '1.6' },
	{ nodePath: '1.7', hasChildren: true },
	{ nodePath: '1.7.10' },
	{ nodePath: '1.7.11' },
	{ nodePath: '1.8' },
	{ nodePath: '1.9' },
	{ nodePath: '2', hasChildren: true },
	{ nodePath: '2.5' },
	{ nodePath: '3' }
];

function getTree(treeHelper: TreeHelper, testSpecifcNodes: any[] = []) {
	const unmappedTree = [...testingTree, ...testSpecifcNodes];

	return unmappedTree.map((node) => {
		const newNode = {};
		treeHelper.props.setPath(newNode, node.nodePath);

		treeHelper.props.setHasChildren(newNode, node.hasChildren);
		return newNode;
	});
}

function getHelper(recursive: boolean): TreeHelper {
	const propertyHelper = new PropertyHelper(testingProperties);
	return new TreeHelper(propertyHelper, { recursive });
}

test('getChildrenWithCheckboxes test root', () => {
	const helper = getHelper(true);
	const tree = getTree(helper);

	// from root
	const children = helper.selection.getSelectableDirectChildren(tree, null);

	const paths = children.map((node) => helper.path(node));
	expect(paths).toEqual(['0', '1', '2', '3']);
});

test('getChildrenWithCheckboxes parent is normal node', () => {
	const helper = getHelper(true);
	const tree = getTree(helper);

	// from root
	const children = helper.selection.getSelectableDirectChildren(tree, '1');
	const paths = children.map((node) => helper.path(node));
	expect(paths).toEqual(['1.4', '1.6', '1.7', '1.8', '1.9']);
});

test('getChildrenWithCheckboxes parent is leaf node', () => {
	const helper = getHelper(true);
	const tree = getTree(helper);

	// from root
	const children = helper.selection.getSelectableDirectChildren(tree, '1.4');
	const paths = children.map((node) => helper.path(node));
	expect(paths).toEqual([]);
});

test('setSelection non-recursive', () => {
	const helper = getHelper(false);
	const tree = getTree(helper);

	const nodePath = '1.7';

	const node = helper.findNode(tree, nodePath);

	helper.selection.setSelection(tree, nodePath, true);

	expect(helper.selection.isSelected(node)).toBe(true);

	helper.selection.setSelection(tree, nodePath, false);

	expect(helper.selection.isSelected(node)).toBe(false);
});

test('setSelection recursive all children are leaf', () => {
	const helper = getHelper(true);
	const tree = getTree(helper);

	const parentNodePath = '1.7';

	//test it changes all selection not just toggles
	helper.selection.setSelection(tree, '1.7.10', true);

	helper.selection.setSelection(tree, parentNodePath, true);
	helper.selection.recomputeAllVisualStates(tree);

	const children = helper.getDirectChildren(tree, parentNodePath);

	const paths = children.map((node) => helper.path(node));
	expect(paths).toEqual(['1.7.10', '1.7.11']);

	let newChildrenSelected = children.map((node) => helper.selection.isSelected(node));
	expect(newChildrenSelected).not.toContain(false);

	helper.selection.setSelection(tree, '1.7.10', false);

	helper.selection.setSelection(tree, parentNodePath, false);
	helper.selection.recomputeAllVisualStates(tree);

	newChildrenSelected = children.map((node) => helper.selection.isSelected(node));
	expect(newChildrenSelected).not.toContain(true);
});

test('setSelection recursive all children are not leaf', () => {
	const helper = getHelper(true);
	const tree = getTree(helper);

	const parentNodePath = '1';

	//test it changes all selection not just toggles
	helper.selection.setSelection(tree, '1.7.10', true);

	helper.selection.setSelection(tree, parentNodePath, true);
	helper.selection.recomputeAllVisualStates(tree);

	const children = helper.allCHildren(tree, parentNodePath);

	const paths = children.map((node) => helper.path(node));
	expect(paths).toEqual(['1.4', '1.6', '1.7', '1.7.10', '1.7.11', '1.8', '1.9']);

	let newChildrenSelected = children.map((node) => helper.selection.isSelected(node));

	expect(newChildrenSelected).not.toContain(false);

	helper.selection.setSelection(tree, '1.7.10', false);

	helper.selection.setSelection(tree, parentNodePath, false);
	helper.selection.recomputeAllVisualStates(tree);

	newChildrenSelected = children.map((node) => helper.selection.isSelected(node));
	expect(newChildrenSelected).not.toContain(true);
});

test('setSelection recursive parent is root', () => {
	const helper = getHelper(true);
	const tree = getTree(helper);

	const parentNodePath = null;

	helper.selection.setSelection(tree, parentNodePath, true);
	helper.selection.recomputeAllVisualStates(tree);

	const children = helper.allCHildren(tree, parentNodePath);

	const paths = children.map((node) => helper.path(node));

	expect(paths).toEqual(helper.allCHildren(tree, null).map((node) => helper.path(node)));

	let newChildrenSelected = children.map((node) => helper.selection.isSelected(node));

	expect(newChildrenSelected).not.toContain(false);

	helper.selection.setSelection(tree, parentNodePath, false);
	helper.selection.recomputeAllVisualStates(tree);

	newChildrenSelected = children.map(
		(node) =>
			helper.selection.isSelected(node) || helper.props.visualState(node) === VisualStates.selected
	);
	expect(newChildrenSelected).not.toContain(true);
});

test('setSelection recursive if one child has hasChildren set to true but no actual children', () => {
	// expected behavior is that graphically it will be selected
	// but logically it will be ignored

	const helper = getHelper(true);
	const tree = getTree(helper, [{ nodePath: '2.12', hasChildren: true }]);

	const parentNodePath = '2';

	const children = helper.allCHildren(tree, parentNodePath);
	expect(children.length).toBe(2);

	helper.selection.setSelection(tree, parentNodePath, true);
	helper.selection.recomputeAllVisualStates(tree);

	const selected = children.map((node) => helper.selection.isSelected(node));

	expect(selected).not.toContain(false);

	helper.selection.setSelection(tree, parentNodePath, false);
	helper.selection.recomputeAllVisualStates(tree);

	// we can never unselect node that has hasChildren set to true but doesnt have any children
	expect(helper.selection.isSelected(helper.findNode(tree, '2.12'))).toBe(true);
	expect(helper.selection.isSelected(helper.findNode(tree, '2.5'))).toBe(false);
	expect(helper.selection.isSelected(helper.findNode(tree, '2'))).toBe(false);
});
