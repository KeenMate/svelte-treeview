import FlexSearch, { Index } from 'flexsearch';

import { type LTreeNode, createLTreeNode } from './ltree-node.svelte';

import { isEmptyString } from '../helpers/string-helpers.js';
import {
	getLevel,
	getParentPath,
	getPathSegments,
	getRelativePath
} from '../helpers/ltree-helpers.js';

import type { Ltree, Tuple, InsertArrayResult } from './types.js';
import { createSearchIndex } from './flex.js';
import { Indexer } from './indexer.js';

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
	_treePathSeparator?: string | null | undefined,

	_expandLevel?: number | null | undefined,
	_shouldUseInternalSearchIndex?: boolean | null | undefined,
	_initializeIndexCallback?: () => Index,
	_indexerBatchSize?: number | null | undefined,
	_indexerTimeout?: number | null | undefined,

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
	let filteredRoot = createLTreeNode<T>();
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
	let indexer: Indexer<T> | null = null;

	// Initialize indexer when search index is available
	if (_shouldUseInternalSearchIndex && searchIndex) {
		indexer = new Indexer<T>(
			_treeId || 'unknown',
			searchIndex,
			shouldCalculateSearchValue,
			_searchValueMember,
			_getSearchValueCallback,
			_indexerBatchSize || 25, // batch size with fallback
			_indexerTimeout || 50, // timeout with fallback
			opts.shouldDisplayDebugInformation
		);
	}

	return {
		// Properties
		treePathSeparator: _treePathSeparator || '.',
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
			if (this.isFiltered) {
				return Object.values(filteredRoot?.children) || [];
			}
			if (!root?.children || !changeTracker) {
				return [];
			}

			return Object.values(root.children);
		},

		get statistics() {
			const filteredNodeCount = isFiltered ? filteredTree?.length || 0 : 0;
			const indexerStatus = indexer?.getStatus() || { isProcessing: false, queueSize: 0 };

			return (
				changeTracker && {
					nodeCount,
					maxLevel,
					filteredNodeCount,
					isIndexing: indexerStatus.isProcessing,
					pendingIndexCount: indexerStatus.queueSize
				}
			);
		},

		insertArray: function (data: T[], noEmitChanges: boolean = false): InsertArrayResult<T> {
			data = data || [];

			// Clear any pending indexing from previous calls
			indexer?.clearQueue();
			flatTreeNodes = [];

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

			if (this.shouldDisplayDebugInformation)
				console.log(`[Tree ${_treeId}] Mapped data before sort`, mappedData);

			performance.mark('sort-start');
			if (!this.isSorted) {
				if (this.sortCallback) mappedData = this.sortCallback(mappedData);
				else mappedData = this._defaultSort(this, mappedData);
			}

			if (this.shouldDisplayDebugInformation)
				console.log(`[Tree ${_treeId}] Mapped data after sort`, mappedData);
			performance.mark('sort-end');

			performance.mark('insert-start');

			const failedNodes: Array<{ node: LTreeNode<T>; originalData: T; error: string }> = [];
			const itemsToIndex: { node: LTreeNode<T>; index: number }[] = [];

			let realIndex: number = 0; // this is used to avoid scenario, when node cannot found a parent
			let successfulCount: number = 0;

			mappedData.forEach((node, index) => {
				const result = this.insertTreeNode(node.parentPath, node, true);
				if (result) {
					failedNodes.push({
						node: node,
						originalData: data[index],
						error: result
					});
				} else {
					successfulCount++;
					// Collect items for batch indexing
					if (_shouldUseInternalSearchIndex && indexer) {
						flatTreeNodes.push(node);
						itemsToIndex.push({ node, index: realIndex });
						realIndex++;
					}
				}
			});

			// Log errors for backward compatibility and debugging
			if (failedNodes.length > 0) {
				const errorMessages = failedNodes.map((f) => f.error);
				console.warn(
					`[Tree ${_treeId}] ${failedNodes.length} nodes failed to insert:`,
					errorMessages
				);
			}

			// Batch add items to indexer
			if (itemsToIndex.length > 0 && indexer) {
				indexer.setCallbacks(
					undefined, // no progress callback for now
					() => {
						// Completion callback - refresh tree when indexing is done
						if (!noEmitChanges) {
							this._emitTreeChanged();
						}
					}
				);
				indexer.addToQueue(itemsToIndex);
			}

			if (!noEmitChanges) {
				this._emitTreeChanged();
			}

			performance.mark('insert-end');

			performance.measure('sort-duration', 'sort-start', 'sort-end');
			performance.measure('conversion-duration', 'conversion-start', 'conversion-end');
			performance.measure('insert-duration', 'insert-start', 'insert-end');

			let measure = performance.getEntriesByName('sort-duration')[0];
			console.log(`[Tree ${_treeId}] Sort took: ${measure.duration}ms`);

			measure = performance.getEntriesByName('conversion-duration')[0];
			console.log(`[Tree ${_treeId}] Conversion took: ${measure.duration}ms`);

			measure = performance.getEntriesByName('insert-duration')[0];
			console.log(`[Tree ${_treeId}] Insert took: ${measure.duration}ms`);

			return {
				successful: successfulCount,
				failed: failedNodes,
				total: data.length
			};
		},

		insertTreeNode: function (
			parentPath: string,
			newNode: LTreeNode<T>,
			noEmitChanges?: boolean
		): string | null {
			const parentNode = this.getNodeByPath(parentPath);

			if (!parentNode) {
				return `Node: ${newNode.path} - Could not find parent node: ${parentPath}`;
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

			if (!noEmitChanges) {
				this._emitTreeChanged();
			}

			return null;
		},

		filterNodes(_searchText: string | null | undefined): void {
			if (this.shouldDisplayDebugInformation)
				console.log(`[Tree ${_treeId}] Filtering nodes by:`, _searchText);

			if (isEmptyString(_searchText)) {
				if (this.shouldDisplayDebugInformation)
					console.log(
						`[Tree ${_treeId}] Search text is empty, cleaning filtered tree and setting isFiltered = false`
					);
				// Clear filter when search is empty
				filteredRoot.children = {};
				this.isFiltered = false;
				this._emitTreeChanged();
				return;
			}

			if (!_shouldUseInternalSearchIndex) {
				if (this.shouldDisplayDebugInformation)
					console.warn(`[Tree ${_treeId}] Internal search index is disabled`);
				return;
			}

			const resultIndices = searchIndex.search(_searchText);
			if (this.shouldDisplayDebugInformation)
					console.warn(`[Tree ${_treeId}] Found indices:`, resultIndices);

			const foundPaths = resultIndices.map((row) => flatTreeNodes[row].path);

			this.createFilteredTree(foundPaths);
		},

		searchNodes(_searchText: string | null | undefined): LTreeNode<T>[] {
			if (this.shouldDisplayDebugInformation)
				console.log(`[Tree ${_treeId}] Searching nodes by:`, _searchText);

			if (isEmptyString(_searchText)) {
				return [];
			}

			if (!_shouldUseInternalSearchIndex) {
				if (this.shouldDisplayDebugInformation)
					console.warn(`[Tree ${_treeId}] Internal search index is disabled`);
				return [];
			}

			const resultIndices = searchIndex.search(_searchText);
			const foundNodes = resultIndices.map((row) => flatTreeNodes[row]);

			if (this.shouldDisplayDebugInformation)
				console.warn(`[Tree ${_treeId}] Search found ${foundNodes?.length || 0} nodes`);

			return foundNodes;
		},

		createFilteredTree(targetPaths: string[]): void {
			filteredRoot.children = {};
			filteredTree = null;
			// isFiltered = false;

			// 1. Expand all target paths to include their parents
			const allRequiredPaths = new Set<string>();
			targetPaths.forEach((path) => {
				const segments = path.split(this.treePathSeparator);
				for (let i = 1; i <= segments.length; i++) {
					allRequiredPaths.add(segments.slice(0, i).join(this.treePathSeparator));
				}
			});

			if (this.shouldDisplayDebugInformation)
				console.log(`[Tree ${_treeId}] allRequiredPaths`, Array.from(allRequiredPaths));

			// 2. Build filtered tree with only required paths
			const pathToNode = new Map<string, LTreeNode<T>>();

			// First pass: create copies of all required nodes
			allRequiredPaths.forEach((path) => {
				const originalNode = this.getNodeByPath(path, root);

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

				const segments = path.split(this.treePathSeparator);
				if (segments.length > 1) {
					// This node has a parent
					const parentPath = segments.slice(0, -1).join(this.treePathSeparator);
					const parentNode = pathToNode.get(parentPath);
					const segment = segmentPrefix + segments[segments.length - 1];

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

			rootNodes.forEach((node) => {
				filteredRoot.children[segmentPrefix + node.path] = node;
			});

			filteredTree = rootNodes;
			this.isFiltered = true;
			this._emitTreeChanged();

			if (this.shouldDisplayDebugInformation)
				console.log(`[Tree ${_treeId}] Created filtered tree with`, rootNodes.length, 'root nodes');
		},

		clearFilter(): void {
			filteredRoot.children = {};
			filteredTree = null;
			this.isFiltered = false;
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

			const segments = path.split(this.treePathSeparator);
			for (let i = 0; i < segments.length; i++) {
				const segment = segmentPrefix + segments[i];

				if (!node.children.hasOwnProperty(segment)) {
					node.children[segment] = createLTreeNode<T>();
				}
				node = node.children[segment]!;
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
			let node: LTreeNode<T> | undefined = this.isFiltered ? filteredRoot : root;

			const segments = path.split(this.treePathSeparator);
			for (let i = 0; i < segments.length; i++) {
				const segment = segmentPrefix + segments[i];

				if (node.children.hasOwnProperty(segment)) {
					node = node.children[segment];
					node.isExpanded = true;
				}
			}

			if (!noEmitChanges) {
				this._emitTreeChanged();
			}

			return this; // Return the API object for chaining
		},

		collapseNodes: function (path: string, noEmitChanges: boolean = false) {
			let node: LTreeNode<T> | undefined = this.isFiltered ? filteredRoot : this.root;

			const segments = path.split(this.treePathSeparator);
			for (let i = 0; i < segments.length; i++) {
				const segment = segmentPrefix + segments[i];

				if (node.children.hasOwnProperty(segment)) {
					node = node.children[segment];
					node.isExpanded = false;
				}
			}

			if (!noEmitChanges) {
				this._emitTreeChanged();
			}

			return this; // Return the API object for chaining
		},

		// Private helper methods
		getNodeByPath: function (
			path: string,
			_root?: LTreeNode<T> | null | undefined
		): LTreeNode<T> | null {
			let node = _root || (this.isFiltered ? filteredRoot : root);

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
