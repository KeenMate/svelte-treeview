import { PropertyHelper } from '$lib/helpers/property-helper.js';
import { Props, TreeHelper } from '$lib/index.js';
import { SelectionProvider } from '$lib/providers/selection-provider.js';
import { expect, test } from 'vitest';
import { expectArrayEqual } from './helpers.js';

const testingProperties: Props = {
	nodePath: 'nodePath2',
	nodeId: 'nodePath2',
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

function getHelper(recursive: boolean): { helper: TreeHelper } {
	const propertyHelper = new PropertyHelper(testingProperties);
	const helper = new TreeHelper(propertyHelper, { recursive, separator: '.' });
	return { helper };
}

test('get all children of root', () => {
	const { helper } = getHelper(true);
	const tree = getTree(helper);

	const parentNodePath = null;

	const children = helper.allCHildren(tree, parentNodePath);
	expectArrayEqual(tree, children);
});
