import { describe, it, expect } from 'vitest';
import { createLTree } from './ltree.svelte.js';
import { type LTreeNode, createLTreeNode } from './ltree-node.svelte.js';

describe('LTree Sorting', () => {
	function createTestLTree() {
		return createLTree<any>(
			'id',
			'path',
			undefined, // parentPathMember
			undefined, // levelMember
			undefined, // hasChildrenMember
			undefined, // isExpandedMember
			undefined, // isSelectableMember
			undefined, // isSelectedMember
			undefined, // isDraggableMember
			undefined, // getIsDraggableCallback
			undefined, // isDropAllowedMember
			undefined, // allowedDropPositionsMember
			'name', // displayValueMember
			undefined, // getDisplayValueCallback
			undefined, // searchValueMember
			undefined, // getSearchValueCallback
			undefined, // getAllowedDropPositionsCallback
			undefined, // isCollapsibleMember
			undefined, // getIsCollapsibleCallback
			undefined, // orderMember
			'test-tree',
			'.', // treePathSeparator
			2, // expandLevel
			false, // shouldUseInternalSearchIndex
			undefined, // initializeIndexCallback
			25, // indexerBatchSize
			50, // indexerTimeout
			{ shouldDisplayDebugInformation: false }
		);
	}

	describe('_defaultSort', () => {
		it('should sort by level (parent path depth) first', () => {
			const ltree = createTestLTree();

			// Create unsorted test data with mixed levels
			const testData = [
				{ id: '1.1.1', path: '1.1.1', name: 'Deep Item A' },
				{ id: '1', path: '1', name: 'Root A' },
				{ id: '2.1', path: '2.1', name: 'Mid Item B' },
				{ id: '1.1', path: '1.1', name: 'Mid Item A' },
				{ id: '2', path: '2', name: 'Root B' },
				{ id: '1.1.2', path: '1.1.2', name: 'Deep Item B' }
			];

			// Convert to LTreeNode format
			const nodes: LTreeNode<any>[] = testData.map(item => createLTreeNode({
				id: item.id,
				path: item.path,
				parentPath: ltree.treePathSeparator === '.' ?
					(item.path.includes('.') ? item.path.substring(0, item.path.lastIndexOf('.')) : '') :
					'',
				pathSegment: item.path.split(ltree.treePathSeparator).pop() || '',
				level: item.path.split(ltree.treePathSeparator).length,
				data: item,
				treeId: 'test-tree'
			}));

			const sorted = ltree._defaultSort(ltree, nodes);

			// Extract paths to verify order
			const sortedPaths = sorted.map(node => node.path);

			// Level 1 items should come first, then level 2, then level 3
			expect(sortedPaths).toEqual([
				'1',    // Level 1
				'2',    // Level 1
				'1.1',  // Level 2
				'2.1',  // Level 2
				'1.1.1', // Level 3
				'1.1.2'  // Level 3
			]);
		});

		it('should sort siblings alphabetically by display value when parent paths are equal', () => {
			const ltree = createTestLTree();

			const testData = [
				{ id: '1.3', path: '1.3', name: 'Charlie' },
				{ id: '1.1', path: '1.1', name: 'Alpha' },
				{ id: '1.2', path: '1.2', name: 'Beta' }
			];

			const nodes: LTreeNode<any>[] = testData.map(item => createLTreeNode({
				id: item.id,
				path: item.path,
				parentPath: '1',
				pathSegment: item.path.split('.').pop() || '',
				level: 2,
				data: item,
				treeId: 'test-tree'
			}));

			const sorted = ltree._defaultSort(ltree, nodes);
			const sortedNames = sorted.map(node => node.data.name);

			expect(sortedNames).toEqual(['Alpha', 'Beta', 'Charlie']);
		});

		it('should handle empty parent path (root level) correctly', () => {
			const ltree = createTestLTree();

			const testData = [
				{ id: '1.1', path: '1.1', name: 'Child' },
				{ id: '1', path: '1', name: 'Root' }
			];

			const nodes: LTreeNode<any>[] = testData.map(item => createLTreeNode({
				id: item.id,
				path: item.path,
				parentPath: item.path === '1' ? '' : '1',
				pathSegment: item.path.split('.').pop() || '',
				level: item.path.split('.').length,
				data: item,
				treeId: 'test-tree'
			}));

			const sorted = ltree._defaultSort(ltree, nodes);
			const sortedPaths = sorted.map(node => node.path);

			// Root should come before child
			expect(sortedPaths).toEqual(['1', '1.1']);
		});

		it('should sort complex hierarchical data correctly', () => {
			const ltree = createTestLTree();

			// Complex test data with multiple levels and siblings
			const testData = [
				{ id: '2.2.1', path: '2.2.1', name: 'Deep B' },
				{ id: '1.2', path: '1.2', name: 'Mid Z' },
				{ id: '3', path: '3', name: 'Root C' },
				{ id: '1.1.2', path: '1.1.2', name: 'Deep A2' },
				{ id: '1', path: '1', name: 'Root A' },
				{ id: '2.1', path: '2.1', name: 'Mid A' },
				{ id: '1.1', path: '1.1', name: 'Mid A' },
				{ id: '2', path: '2', name: 'Root B' },
				{ id: '1.1.1', path: '1.1.1', name: 'Deep A1' },
				{ id: '2.2', path: '2.2', name: 'Mid B' }
			];

			const nodes: LTreeNode<any>[] = testData.map(item => {
				const segments = item.path.split('.');
				return createLTreeNode({
					id: item.id,
					path: item.path,
					parentPath: segments.length > 1 ? segments.slice(0, -1).join('.') : '',
					pathSegment: segments[segments.length - 1],
					level: segments.length,
					data: item,
					treeId: 'test-tree'
				});
			});

			const sorted = ltree._defaultSort(ltree, nodes);
			const sortedPaths = sorted.map(node => node.path);

			expect(sortedPaths).toEqual([
				// Level 1 (sorted by display value)
				'1',    // Root A
				'2',    // Root B
				'3',    // Root C
				// Level 2 (sorted by parent path, then display value)
				'1.1',  // parentPath: '1', name: 'Mid A'
				'1.2',  // parentPath: '1', name: 'Mid Z'
				'2.1',  // parentPath: '2', name: 'Mid A'
				'2.2',  // parentPath: '2', name: 'Mid B'
				// Level 3 (sorted by parent path, then display value)
				'1.1.1', // parentPath: '1.1', name: 'Deep A1'
				'1.1.2', // parentPath: '1.1', name: 'Deep A2'
				'2.2.1'  // parentPath: '2.2', name: 'Deep B'
			]);
		});
	});

	describe('Progressive Rendering Scenarios', () => {
		it('should ensure progressive rendering works with proper level ordering', () => {
			const ltree = createTestLTree();

			// Simulate large dataset generation similar to generateLargeDataset
			const testData = [];
			for (let root = 3; root >= 1; root--) { // Reverse order to test sorting
				testData.push({ id: `${root}`, path: `${root}`, name: `Category ${root}` });

				for (let cat = 2; cat >= 1; cat--) { // Reverse order
					testData.push({
						id: `${root}.${cat}`,
						path: `${root}.${cat}`,
						name: `Subcategory ${root}.${cat}`
					});

					for (let item = 2; item >= 1; item--) { // Reverse order
						testData.push({
							id: `${root}.${cat}.${item}`,
							path: `${root}.${cat}.${item}`,
							name: `Item ${root}.${cat}.${item}`
						});
					}
				}
			}

			const nodes: LTreeNode<any>[] = testData.map(item => {
				const segments = item.path.split('.');
				return createLTreeNode({
					id: item.id,
					path: item.path,
					parentPath: segments.length > 1 ? segments.slice(0, -1).join('.') : '',
					pathSegment: segments[segments.length - 1],
					level: segments.length,
					data: item,
					treeId: 'test-tree'
				});
			});

			const sorted = ltree._defaultSort(ltree, nodes);

			// Verify that all level 1 nodes come before level 2 nodes
			const levels = sorted.map(node => node.level!);
			let currentLevel = 1;
			for (const level of levels) {
				expect(level).toBeGreaterThanOrEqual(currentLevel);
				currentLevel = level;
			}

			// For expandLevel = 2, verify nodes up to level 2 come first
			const expandLevel = 2;
			const nodesUpToExpandLevel = sorted.filter(node => node.level! <= expandLevel);
			const nodesBeyondExpandLevel = sorted.filter(node => node.level! > expandLevel);

			// All nodes up to expandLevel should come before nodes beyond expandLevel
			const indexOfFirstBeyondExpand = sorted.findIndex(node => node.level! > expandLevel);
			const indexOfLastUpToExpand = sorted.map((node, index) => node.level! <= expandLevel ? index : -1)
				.filter(index => index !== -1)
				.pop();

			if (indexOfFirstBeyondExpand !== -1 && indexOfLastUpToExpand !== undefined) {
				expect(indexOfLastUpToExpand).toBeLessThan(indexOfFirstBeyondExpand);
			}
		});
	});
});