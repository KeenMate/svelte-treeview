import { type Node, TreeHelper } from '$lib/index.js';
import { test } from 'vitest';

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

function getTree(testSpecifcNodes: any[] = []) {
	return [...testingTree, ...testSpecifcNodes].map((node) => ({ ...node, id: node.path } as Node));
}

function getHelper(recursive: boolean): { helper: TreeHelper } {
	const helper = new TreeHelper({ recursive, separator: '.' });
	return { helper };
}

test('get all children of root', () => {
	const { helper } = getHelper(true);
	const tree = getTree();

	const parentNodePath = null;

	const children = helper.allCHildren(tree, parentNodePath);
	expectArrayEqual(tree, children);
});
