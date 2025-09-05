import FlexSearch, { Index } from 'flexsearch';

import { type LTreeNode, createLTreeNode } from './ltree-node.svelte';

import { isEmptyString } from '../helpers/string-helpers.js';
import {
	getLevel,
	getParentPath,
	getPathSegments,
	getRelativePath
} from '../helpers/ltree-helpers.js';

import type { Ltree, Tuple } from './types.js';
import { createSearchIndex } from './flex.js';

export function createLTree<T>(
	_idMember: string,
	_pathMember: string,
	_parentPathMember?: string | null | undefined,
	_levelMember?: string | null | undefined,
	_hasChildrenMember?: string | null | undefined,
	_isExpandedMember?: string | null | undefined,
	_isSelectableMember?: string | null | undefined,
	_isDraggableMember?: string | null | undefined,
	_isDropAllowedMember?: string | null | undefined,
	_displayValueMember?: string | null | undefined,
	_getDisplayValueCallback?: (node: LTreeNode<T>) => string,

	_searchValueMember?: string | null | undefined,
	_getSearchValueCallback?: (node: LTreeNode<T>) => string,

	_treeId?: string,

	_expandLevel?: number | null | undefined,
	_shouldUseInternalSearchIndex?: boolean | null | undefined,
	_initializeIndexCallback?: () => Index,

	opts?: Partial<Ltree<T>>
): Ltree<T> {
	let shouldCalculateParentPath: boolean = isEmptyString(_parentPathMember);
	let shouldCalculateLevel: boolean = isEmptyString(_levelMember);
	let shouldCalculateHasChildren: boolean = isEmptyString(_hasChildrenMember);
	let shouldCalculateIsExpanded: boolean = isEmptyString(_isExpandedMember);
	let shouldCalculateIsSelectable: boolean = isEmptyString(_isSelectableMember);
	let shouldCalculateIsDraggable: boolean = isEmptyString(_isDraggableMember);
	let shouldCalculateIsDropAllowed: boolean = isEmptyString(_isDropAllowedMember);
	let shouldCalculateDisplayValue: boolean = isEmptyString(_displayValueMember);
	let shouldCalculateSearchValue: boolean = isEmptyString(_searchValueMember);

	// this is absolutely crucial to keep order of sorted items. Segments are just numbers and numbers as properties are always sorted
	// see https://stackoverflow.com/questions/33351816/how-to-prevent-automatic-sort-of-object-numeric-property/51497854#51497854
	const segmentPrefix = 'x';

	// Private state variables
	let root = createLTreeNode<T>();
	let searchIndex: Index | null | undefined = null;

	if (_shouldUseInternalSearchIndex)
		searchIndex = _initializeIndexCallback ? _initializeIndexCallback() : createSearchIndex();

	let changeTracker = $state(Symbol());
	let size = 0;
	let nodeCount = 0;
	let maxLevel = 0;

	let flatTreeNodes: LTreeNode<T>[] = [];
	let filteredTree: LTreeNode<T>[] | null = null;
	let isFiltered = false;

	// Async search indexing infrastructure
	let indexingQueue: { node: LTreeNode<T>; index: number }[] = [];
	let isIndexing = false;
	let indexingBatchSize = 1000;
	let pendingIndexingId: number | null = null;
	let onIndexingComplete: (() => void) | null = null;

	// RequestIdleCallback wrapper with fallback
	function scheduleIdleWork(callback: () => void): number {
		if (typeof requestIdleCallback !== 'undefined') {
			return requestIdleCallback(callback, { timeout: 50 }) as number;
		} else {
			return setTimeout(callback, 0) as number;
		}
	}

	function cancelIdleWork(id: number): void {
		if (typeof cancelIdleCallback !== 'undefined') {
			cancelIdleCallback(id);
		} else {
			clearTimeout(id);
		}
	}

	// // Async search indexing functions
	// function addToIndexingQueue(self: Ltree<T>): void {
	// 	if (!_shouldUseInternalSearchIndex || !searchIndex) return;

	// 	indexingQueue.push({ node, index });
	// 	console.log('🚀 ~ addToIndexingQueue ~ indexingQueue:', indexingQueue);

	// 	if (!isIndexing) {
	// 		startAsyncIndexing(self);
	// 	}
	// }

	function startAsyncIndexing(self: Ltree<T>): void {
		if (isIndexing || indexingQueue.length === 0) return;

		if (!isIndexing) {
			isIndexing = true;
			processIndexingQueue(self);
		}
	}

	function processIndexingQueue(self: Ltree<T>): void {
		// const batchEnd = Math.min(indexingBatchSize, indexingQueue.length);
		// const batch = indexingQueue.splice(0, batchEnd);

		if (indexingQueue.length > 0) {
			if (self.shouldDisplayDebugInformation) console.log('Indexing of whole indexing queue');
			pendingIndexingId = scheduleIdleWork(() => {
				addNodesToIndex(indexingQueue);
				// processIndexingBatch(self);
			});
		} else {
			if (self.shouldDisplayDebugInformation) console.log('Indexing of batch finished');

			isIndexing = false;
			pendingIndexingId = null;

			// Trigger completion callback and refresh tree
			if (onIndexingComplete) {
				onIndexingComplete();
				onIndexingComplete = null;
			}
		}
	}

	function addNodesToIndex(batch: { node: LTreeNode<T>; index: number }[]) {
		for (const { node, index } of batch) {
			if (!shouldCalculateSearchValue) {
				searchIndex!.add(index, node.data[_searchValueMember]);
			} else if (_getSearchValueCallback) {
				searchIndex!.add(index, _getSearchValueCallback(node));
			}
		}
	}

	function clearIndexingQueue(): void {
		indexingQueue.length = 0;
		isIndexing = false;
		if (pendingIndexingId !== null) {
			cancelIdleWork(pendingIndexingId);
			pendingIndexingId = null;
		}
	}

	return {
		// Properties
		treePathSeparator: '.',
		root,
		get changeTracker() {
			return changeTracker;
		},
		idMember: _idMember,
		pathMember: _pathMember,
		parentPathMember: _parentPathMember,
		levelMember: _levelMember,
		isExpandedMember: _isExpandedMember,
		isSelectableMember: _isSelectableMember,
		isDraggableMember: _isDraggableMember,
		isDropAllowedMember: _isDropAllowedMember,
		hasChildrenMember: _hasChildrenMember,
		displayValueMember: _displayValueMember,
		getDisplayValueCallback: _getDisplayValueCallback,

		searchValueMember: _searchValueMember,
		getSearchValueCallback: _getSearchValueCallback,
		isSorted: false,

		// Properties for filtering
		filteredTree,
		isFiltered,

		// Methods (will be bound later)
		get tree(): LTreeNode<T>[] {
			if (isFiltered) {
				return filteredTree || [];
			}
			if (!this.root?.children || !changeTracker) {
				return [];
			}

			return Object.values(this.root.children);
		},

		get statistics() {
			const filteredNodeCount = isFiltered ? filteredTree?.length || 0 : 0;
			return (
				changeTracker && {
					nodeCount,
					maxLevel,
					filteredNodeCount,
					isIndexing,
					pendingIndexCount: indexingQueue.length
				}
			);
		},

		insertArray: function (data: T[], noEmitChanges: boolean = false) {
			data = data || [];

			// Clear any pending indexing from previous calls
			clearIndexingQueue();

			performance.mark('conversion-start');
			let mappedData = data.map((row, index) => {
				const node = createLTreeNode<T>();
				node.treeId = _treeId;
				node.id = _idMember ? row[_idMember] : undefined;
				node.path = _pathMember ? row[_pathMember] : undefined;

				if (shouldCalculateParentPath) {
					node.parentPath = getParentPath(node.path);
				} else node.parentPath = row[_parentPathMember];

				node.pathSegment = getPathSegments(getRelativePath(node.path, node.parentPath));

				if (!shouldCalculateLevel) node.level = row[_levelMember];
				else node.level = getLevel(node.path, this.treePathSeparator);

				if (!shouldCalculateIsExpanded) node.isExpanded = row[_isExpandedMember];
				else if (_expandLevel) node.isExpanded = node.level <= _expandLevel;

				if (!shouldCalculateIsSelectable) node.isSelectable = row[_isSelectableMember];
				if (!shouldCalculateIsDraggable) node.isDraggable = row[_isDraggableMember];
				if (!shouldCalculateIsDropAllowed) node.isDropAllowed = row[_isDropAllowedMember];

				if (!shouldCalculateHasChildren) node.hasChildren = row[_hasChildrenMember];

				node.data = row;
				return node;
			});
			performance.mark('conversion-end');

			if (this.shouldDisplayDebugInformation) console.log('Mapped data before sort', mappedData);

			performance.mark('sort-start');
			if (!this.isSorted) {
				if (this.sortCallback) mappedData = this.sortCallback(mappedData);
				else mappedData = this._defaultSort(this, mappedData);
			}

			if (this.shouldDisplayDebugInformation) console.log('Mapped data after sort', mappedData);
			performance.mark('sort-end');

			performance.mark('insert-start');

			const errors: string[] = [];

			mappedData.forEach((node, index) => {
				const result = this.insertTreeNode(node.parentPath, node, true);
				if (result) {
					errors.push(result);
				} else {
					// Queue node for async search indexing
					if (_shouldUseInternalSearchIndex) indexingQueue.push({ node, index });
				}
			});
			if (errors.length > 0) console.warn(errors);

			if (_shouldUseInternalSearchIndex) {
				startAsyncIndexing(this);
			}

			if (!noEmitChanges) {
				this._emitTreeChanged();
			}

			// Set completion callback to emit changes when indexing is done
			if (_shouldUseInternalSearchIndex && indexingQueue.length > 0) {
				if (!noEmitChanges) {
					this._emitTreeChanged();
				}
				this.indexingCompleteCallback?.();
			}

			performance.mark('insert-end');

			performance.measure('sort-duration', 'sort-start', 'sort-end');
			performance.measure('conversion-duration', 'conversion-start', 'conversion-end');
			performance.measure('insert-duration', 'insert-start', 'insert-end');

			let measure = performance.getEntriesByName('sort-duration')[0];
			console.log(`Sort took: ${measure.duration}ms`);

			measure = performance.getEntriesByName('conversion-duration')[0];
			console.log(`Conversion took: ${measure.duration}ms`);

			measure = performance.getEntriesByName('insert-duration')[0];
			console.log(`Insert took: ${measure.duration}ms`);
		},

		insertTreeNode: function (
			parentPath: string,
			newNode: LTreeNode<T>,
			noEmitChanges?: boolean
		): string | null {
			const parentNode = this.getNodeByPath(parentPath);

			if (!parentNode) {
				return `Could not find node for parent path: ${parentPath}`;
			}
			if (shouldCalculateLevel) {
				newNode.level = (parentNode.level || 0) + 1;
			}

			const newSegment =
				segmentPrefix + getPathSegments(getRelativePath(newNode?.path, parentPath));

			if (!parentNode.children.hasOwnProperty(newSegment)) {
				parentNode.children[newSegment] = newNode;
				if (shouldCalculateHasChildren && !parentNode.hasChildren) {
					parentNode.hasChildren = true;
				}

				// Update statistics
				nodeCount++;
				maxLevel = Math.max(maxLevel, newNode.level || 0);
			}

			flatTreeNodes.push(newNode);

			if (!noEmitChanges) {
				this._emitTreeChanged();
			}

			return null;
		},

		filterNodes(_searchText: string | null | undefined): void {
			if (this.shouldDisplayDebugInformation) console.log('Filtering nodes by:', _searchText);

			if (isEmptyString(_searchText)) {
				if (this.shouldDisplayDebugInformation)
					console.log(
						'Search text is empty, cleaning filtered tree and setting isFiltered = false'
					);
				// Clear filter when search is empty
				filteredTree = null;
				isFiltered = false;
				this._emitTreeChanged();
				return;
			}

			if (!_shouldUseInternalSearchIndex) {
				if (this.shouldDisplayDebugInformation) console.warn('Internal search index is disabled');
				return;
			}

			const resultIndices = searchIndex.search(_searchText);
			const foundPaths = resultIndices.map((row) => flatTreeNodes[row].path);

			this.createFilteredTree(foundPaths);
		},

		createFilteredTree(targetPaths: string[]): void {
			if (!targetPaths || targetPaths.length === 0) {
				filteredTree = null;
				// isFiltered = false;
				this._emitTreeChanged();
				return;
			}

			// 1. Expand all target paths to include their parents
			const allRequiredPaths = new Set<string>();
			targetPaths.forEach((path) => {
				const parts = path.split(this.treePathSeparator);
				for (let i = 1; i <= parts.length; i++) {
					allRequiredPaths.add(parts.slice(0, i).join(this.treePathSeparator));
				}
			});

			if (this.shouldDisplayDebugInformation)
				console.log('allRequiredPaths', Array.from(allRequiredPaths));

			// 2. Build filtered tree with only required paths
			const pathToNode = new Map<string, LTreeNode<T>>();

			// First pass: create copies of all required nodes
			allRequiredPaths.forEach((path) => {
				const originalNode = this.getNodeByPath(path);
				if (originalNode) {
					// Deep copy the node but reset children
					const copiedNode: LTreeNode<T> = {
						...originalNode,
						children: {},
						hasChildren: false,
						isExpanded: true // Expand all nodes in filtered tree
					};
					pathToNode.set(path, copiedNode);
				}
			});

			// Second pass: rebuild parent-child relationships
			allRequiredPaths.forEach((path) => {
				const node = pathToNode.get(path);
				if (!node) return;

				const parts = path.split(this.treePathSeparator);
				if (parts.length > 1) {
					// This node has a parent
					const parentPath = parts.slice(0, -1).join(this.treePathSeparator);
					const parentNode = pathToNode.get(parentPath);
					const segment = parts[parts.length - 1];

					if (parentNode) {
						parentNode.children[segment] = node;
						parentNode.hasChildren = true;
					}
				}
			});

			// 3. Extract root level nodes for filteredTree
			const rootNodes: LTreeNode<T>[] = [];
			allRequiredPaths.forEach((path) => {
				if (!path.includes(this.treePathSeparator)) {
					// This is a root level node
					const node = pathToNode.get(path);
					if (node) {
						rootNodes.push(node);
					}
				}
			});

			filteredTree = rootNodes;
			isFiltered = true;
			this._emitTreeChanged();

			if (this.shouldDisplayDebugInformation)
				console.log('Created filtered tree with', rootNodes.length, 'root nodes');
		},

		clearFilter(): void {
			filteredTree = null;
			isFiltered = false;
			this._emitTreeChanged();
		},

		expandAll(nodePath: string | null | undefined): void {
			if (isEmptyString(nodePath))
				flatTreeNodes.forEach((row) => {
					row.isExpanded = true;
				});

			this._emitTreeChanged();
		},

		collapseAll(nodePath?: string | null | undefined): void {
			if (isEmptyString(nodePath))
				flatTreeNodes.forEach((row) => {
					row.isExpanded = false;
				});

			this._emitTreeChanged();
		},

		insert: function (path: string, data: T, noEmitChanges: boolean = false): void {
			let node = this.root;

			const pathParts = path.split(this.treePathSeparator);
			for (let i = 0; i < pathParts.length; i++) {
				const part = pathParts[i];

				if (!node.children.hasOwnProperty(part)) {
					node.children[part] = createLTreeNode<T>();
				}
				node = node.children[part]!;
			}

			// Mark as end of path and store data
			if (node.hasChildren) {
				size++;
			}
			node.hasChildren = true;
			node.data = data;

			if (!noEmitChanges) {
				this._emitTreeChanged();
			}
		},

		expandNodes: function (path: string, noEmitChanges: boolean = false) {
			let node: LTreeNode<T> | undefined = this.root;

			const pathParts = path.split(this.treePathSeparator);
			for (let i = 0; i < pathParts.length; i++) {
				const part = pathParts[i];

				if (node.children.hasOwnProperty(part)) {
					node = node.children[part];
					node.isExpanded = true;
				}
			}

			if (!noEmitChanges) {
				this._emitTreeChanged();
			}

			return this; // Return the API object for chaining
		},

		collapseNodes: function (path: string, noEmitChanges: boolean = false) {
			let node: LTreeNode<T> | undefined = this.root;

			const pathParts = path.split(this.treePathSeparator);
			for (let i = 0; i < pathParts.length; i++) {
				const part = pathParts[i];

				if (node.children.hasOwnProperty(part)) {
					node = node.children[part];
					node.isExpanded = false;
				}
			}

			if (!noEmitChanges) {
				this._emitTreeChanged();
			}

			return this; // Return the API object for chaining
		},

		// Private helper methods
		getNodeByPath: function (path: string): LTreeNode<T> | null {
			let node = this.root;

			if (path) {
				const parts = path.split(this.treePathSeparator);

				for (let i = 0; i < parts.length; i++) {
					const segment = segmentPrefix + parts[i];
					if (!node.children.hasOwnProperty(segment)) {
						return null;
					}
					node = node.children[segment]!;
				}
			}
			return node;
		},

		getNodeDisplayValue(node: LTreeNode<T>): string {
			if (!shouldCalculateDisplayValue) return node.data[_displayValueMember];

			if (this.getDisplayValueCallback) return this.getDisplayValueCallback(node);

			return '[N/A]';
		},

		getNodeSearchValue(node: LTreeNode<T>): string {
			if (!shouldCalculateSearchValue) return node.data[_searchValueMember];

			if (this.getSearchValueCallback) return this.getSearchValueCallback(node);

			return '[N/A]';
		},

		refresh(): void {
			this._emitTreeChanged();
		},

		_defaultSort: function (self: Ltree<T>, items: LTreeNode<T>[]): LTreeNode<T>[] {
			return items.sort((a, b) => {
				if (a.parentPath !== b.parentPath) {
					if (a.parentPath === '') return -1;
					if (b.parentPath === '') return 1;
					return a.parentPath.localeCompare(b.parentPath);
				}
				// console.log(
				// 	'a.name, b.name, comparison',
				// 	self.getNodeDisplayValue(a),
				// 	self.getNodeDisplayValue(b),
				// 	self.getNodeDisplayValue(a).localeCompare(this.getNodeDisplayValue(b))
				// );

				return self.getNodeDisplayValue(a).localeCompare(this.getNodeDisplayValue(b));
			});
		},

		_emitTreeChanged: function () {
			changeTracker = Symbol();
		},

		...opts
	};
}
