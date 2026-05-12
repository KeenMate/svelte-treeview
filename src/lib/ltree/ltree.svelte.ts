import FlexSearch, { Index, type SearchOptions } from 'flexsearch';

import { type LTreeNode, createLTreeNode } from './ltree-node.svelte';

import { isEmptyString } from '../helpers/string-helpers.js';
import {
	getLevel,
	getParentPath,
	getPathSegments,
	getRelativePath
} from '../helpers/ltree-helpers.js';

import type { Ltree, InsertArrayResult, InsertBranchResult, DeleteBranchResult } from './types.js';
import { createSearchIndex } from './flex.js';
import { Indexer } from './indexer.js';
import { perfStart, perfEnd, perfSummary } from '../perf-logger.js';

/** Helper to safely access a property on a generic data item using a string member name */
function getField(item: unknown, member: string): any {
	return (item as Record<string, unknown>)[member];
}

export function createLTree<T>(
	_idMember: string,
	_pathMember: string,
	_parentPathMember?: string | null | undefined,
	_levelMember?: string | null | undefined,
	_hasChildrenMember?: string | null | undefined,
	_isExpandedMember?: string | null | undefined,
	_isSelectableMember?: string | null | undefined,
	_isSelectedMember?: string | null | undefined,
	_isDraggableMember?: string | null | undefined,
	_getIsDraggableCallback?: (node: LTreeNode<T>) => boolean,
	_isDropAllowedMember?: string | null | undefined,
	_allowedDropPositionsMember?: string | null | undefined,
	_displayValueMember?: string | null | undefined,
	_getDisplayValueCallback?: (node: LTreeNode<T>) => string,

	_searchValueMember?: string | null | undefined,
	_getSearchValueCallback?: (node: LTreeNode<T>) => string,

	_getAllowedDropPositionsCallback?: (node: LTreeNode<T>) => import('./types.js').DropPosition[] | null | undefined,

	_isCollapsibleMember?: string | null | undefined,
	_getIsCollapsibleCallback?: (node: LTreeNode<T>) => boolean,

	_orderMember?: string | null | undefined,

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
	let shouldCalculateIsSelected: boolean = isEmptyString(_isSelectedMember);
	let shouldCalculateIsDraggable: boolean = isEmptyString(_isDraggableMember);
	let shouldCalculateIsDropAllowed: boolean = isEmptyString(_isDropAllowedMember);
	let shouldCalculateAllowedDropPositions: boolean = isEmptyString(_allowedDropPositionsMember);
	let shouldCalculateIsCollapsible: boolean = isEmptyString(_isCollapsibleMember);
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
	let nodeCount = 0;
	let maxLevel = 0;

	let flatTreeNodes: LTreeNode<T>[] = [];
	let filteredTree: LTreeNode<T>[] | null = null;
	let isFiltered = false;

	// Cache for visibleFlatNodes - only recompute when tree changes
	let cachedVisibleFlatNodes: LTreeNode<T>[] = [];
	let cachedVisibleFlatNodesTracker: Symbol | null = null;

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
			opts?.shouldDisplayDebugInformation ?? false
		);
	}

	return {
		// Properties
		treePathSeparator: _treePathSeparator || '.',
		root,
		filteredRoot,
		get changeTracker() {
			return changeTracker;
		},
		idMember: _idMember,
		pathMember: _pathMember,
		parentPathMember: _parentPathMember,
		levelMember: _levelMember,
		isExpandedMember: _isExpandedMember,
		isSelectableMember: _isSelectableMember,
		isSelectedMember: _isSelectedMember,
		isDraggableMember: _isDraggableMember,
		getIsDraggableCallback: _getIsDraggableCallback,
		isDropAllowedMember: _isDropAllowedMember,
		allowedDropPositionsMember: _allowedDropPositionsMember,
		hasChildrenMember: _hasChildrenMember,
		displayValueMember: _displayValueMember,
		getDisplayValueCallback: _getDisplayValueCallback,

		searchValueMember: _searchValueMember,
		getSearchValueCallback: _getSearchValueCallback,
		getAllowedDropPositionsCallback: _getAllowedDropPositionsCallback,
		isCollapsibleMember: _isCollapsibleMember,
		getIsCollapsibleCallback: _getIsCollapsibleCallback,
		orderMember: _orderMember,
		isSorted: false,
		shouldDisplayDebugInformation: opts?.shouldDisplayDebugInformation ?? false,

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

		/**
		 * Returns a flat array of all visible nodes in render order (depth-first).
		 * A node is visible if all its ancestors are expanded.
		 * This is optimized for flat/centralized rendering without recursion.
		 *
		 * Note: This getter depends on changeTracker to ensure reactivity when
		 * nodes are expanded/collapsed or the tree structure changes.
		 * Results are cached to avoid recomputation on repeated access.
		 */
		get visibleFlatNodes(): LTreeNode<T>[] {
			// Explicitly read changeTracker to create reactive dependency
			const _tracker = changeTracker;

			// Return cached result if changeTracker hasn't changed
			if (_tracker === cachedVisibleFlatNodesTracker && cachedVisibleFlatNodes.length > 0) {
				return cachedVisibleFlatNodes;
			}

			const computeStart = performance.now();

			const startRoot = this.isFiltered ? filteredRoot : root;
			if (!startRoot?.children || !_tracker) {
				cachedVisibleFlatNodes = [];
				cachedVisibleFlatNodesTracker = _tracker;
				return cachedVisibleFlatNodes;
			}

			const result: LTreeNode<T>[] = [];
			const self = this;

			function traverse(node: LTreeNode<T>) {
				// Get children in natural tree key order (same as recursive mode).
				// Sorting was already applied at insertion time in insertArray().
				const children = Object.values(node.children);

				for (const child of children) {
					result.push(child);
					// Only traverse into children if this node is expanded
					if (child.isExpanded && child.hasChildren) {
						traverse(child);
					}
				}
			}

			traverse(startRoot);

			// Cache the result
			cachedVisibleFlatNodes = result;
			cachedVisibleFlatNodesTracker = _tracker;
			return result;
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

			// Clear existing tree data - reset root children
			root.children = {};
			nodeCount = 0;
			maxLevel = 0;

			perfStart(`[${_treeId}] insertArray:conversion`);

			const conversionFailures: Array<{ node: LTreeNode<T>; originalData: T; error: string }> = [];

			let mappedData = data.map((row, index) => {
				const node = createLTreeNode<T>();
				node.treeId = _treeId || '';
				node.id = _idMember ? getField(row, _idMember) : undefined;
				const rawPath = _pathMember ? getField(row, _pathMember) : undefined;

				// Validate path - must be a non-empty string
				if (rawPath == null || rawPath === '' || typeof rawPath !== 'string') {
					node.path = '';
					node.data = row;
					const pathDesc = rawPath === '' ? 'empty string'
						: rawPath == null ? 'undefined/null'
						: `non-string (${typeof rawPath})`;
					conversionFailures.push({
						node,
						originalData: row,
						error: `Item at index ${index} has invalid path (${pathDesc}). Check that pathMember="${_pathMember}" matches your data. First item keys: ${index === 0 ? JSON.stringify(Object.keys(row as any)) : '(see index 0)'}`
					});
					return null;
				}
				node.path = rawPath;

				if (shouldCalculateParentPath) {
					node.parentPath = getParentPath(node.path, this.treePathSeparator);
				} else node.parentPath = getField(row, _parentPathMember!);

				node.pathSegment = getPathSegments(getRelativePath(node.path, node.parentPath ?? '', this.treePathSeparator), 0, 1, this.treePathSeparator);

				if (!shouldCalculateLevel) node.level = getField(row, _levelMember!);
				else node.level = getLevel(node.path, this.treePathSeparator);

				if (!shouldCalculateIsExpanded) node.isExpanded = getField(row, _isExpandedMember!);
				else if (_expandLevel) node.isExpanded = (node.level ?? 0) <= _expandLevel;

				if (!shouldCalculateIsSelectable) node.isSelectable = getField(row, _isSelectableMember!);
				if (!shouldCalculateIsSelected) node.isSelected = getField(row, _isSelectedMember!);
				if (!shouldCalculateIsDraggable) node.isDraggable = getField(row, _isDraggableMember!);
				if (!shouldCalculateIsCollapsible) node.isCollapsible = getField(row, _isCollapsibleMember!);
				if (!shouldCalculateIsDropAllowed) node.isDropAllowed = getField(row, _isDropAllowedMember!);
				if (!shouldCalculateAllowedDropPositions) node.allowedDropPositions = getField(row, _allowedDropPositionsMember!);

				if (!shouldCalculateHasChildren) node.hasChildren = getField(row, _hasChildrenMember!);

				node.data = row;
				return node;
			}).filter((node): node is LTreeNode<T> => node !== null);
			const conversionTime = perfEnd(`[${_treeId}] insertArray:conversion`, data.length);

			perfStart(`[${_treeId}] insertArray:sort`);
			if (!this.isSorted) {
				if (this.sortCallback) mappedData = this.sortCallback(mappedData);
				else mappedData = this._defaultSort(this, mappedData);
			}

			const sortTime = perfEnd(`[${_treeId}] insertArray:sort`, data.length);

			perfStart(`[${_treeId}] insertArray:insert`);

			const failedNodes: Array<{ node: LTreeNode<T>; originalData: T; error: string }> = [...conversionFailures];

			// Warn early about data mapping issues (most common user error)
			if (conversionFailures.length > 0) {
				console.warn(
					`[Tree ${_treeId}] ${conversionFailures.length} of ${data.length} items have invalid paths (pathMember="${_pathMember}"). These items will be skipped.\n` +
					`First failure: ${conversionFailures[0].error}`
				);
			}
			const itemsToIndex: { node: LTreeNode<T>; index: number }[] = [];

			let realIndex: number = 0; // this is used to avoid scenario, when node cannot found a parent
			let successfulCount: number = 0;
			let hasRenderedExpandLevel = false;

			// Pre-compute the last index at expandLevel to avoid O(n²) lookup
			let lastExpandLevelIndex = -1;
			if (_expandLevel && !noEmitChanges) {
				for (let i = mappedData.length - 1; i >= 0; i--) {
					const nodeLevel = mappedData[i].level || getLevel(mappedData[i].path, this.treePathSeparator);
					if (nodeLevel <= _expandLevel) {
						lastExpandLevelIndex = i;
						break;
					}
				}
			}

			mappedData.forEach((node, index) => {
				const result = this.insertTreeNode(node.parentPath ?? '', node, true);
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

					// Progressive rendering: emit changes when we complete expandLevel
					if (!noEmitChanges && !hasRenderedExpandLevel && _expandLevel && index === lastExpandLevelIndex) {
						// We've processed all nodes up to expandLevel - render now!
						hasRenderedExpandLevel = true;
						this._emitTreeChanged();
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

			// Final render (only if we haven't already rendered progressively)
			if (!noEmitChanges) {
				this._emitTreeChanged();
			}

			const insertTime = perfEnd(`[${_treeId}] insertArray:insert`, data.length);

			// Log performance summary
			perfSummary(_treeId || 'unknown', {
				'Conversion': conversionTime,
				'Sort': sortTime,
				'Insert': insertTime
			}, data.length);

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
				segmentPrefix + getPathSegments(getRelativePath(newNode?.path, parentPath, this.treePathSeparator), 0, 1, this.treePathSeparator);

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

		filterNodes(_searchText: string | null | undefined, _searchOptions?: SearchOptions): void {
			if (isEmptyString(_searchText)) {
				// Clear filter when search is empty
				filteredRoot.children = {};
				this.isFiltered = false;
				this._emitTreeChanged();
				return;
			}

			if (!_shouldUseInternalSearchIndex) {
				return;
			}

			perfStart(`[${_treeId}] filterNodes:search`);
			const resultIndices = searchIndex!.search(_searchText!, _searchOptions);
			const foundPaths = resultIndices.map((row) => flatTreeNodes[row as number].path);
			perfEnd(`[${_treeId}] filterNodes:search`, resultIndices.length);

			this.createFilteredTree(foundPaths);
		},

		searchNodes(_searchText: string | null | undefined, _searchOptions?: SearchOptions): LTreeNode<T>[] {
			if (isEmptyString(_searchText)) {
				return [];
			}

			if (!_shouldUseInternalSearchIndex) {
				return [];
			}

			const resultIndices = searchIndex!.search(_searchText!, _searchOptions);
			const foundNodes = resultIndices.map((row) => flatTreeNodes[row as number]);

			return foundNodes;
		},

		createFilteredTree(targetPaths: string[]): void {
			perfStart(`[${_treeId}] createFilteredTree`);
			filteredRoot.children = {};
			filteredTree = null;

			// 1. Expand all target paths to include their parents
			const allRequiredPaths = new Set<string>();
			targetPaths.forEach((path) => {
				const segments = path.split(this.treePathSeparator);
				for (let i = 1; i <= segments.length; i++) {
					allRequiredPaths.add(segments.slice(0, i).join(this.treePathSeparator));
				}
			});

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

			perfEnd(`[${_treeId}] createFilteredTree`, rootNodes.length);

		},

		clearFilter(): void {
			filteredRoot.children = {};
			filteredTree = null;
			this.isFiltered = false;
			this._emitTreeChanged();
		},

		expandAll(nodePath: string | null | undefined): void {
			perfStart(`[${_treeId}] expandAll`);
			function setExpandedRecursive(node: LTreeNode<T>, value: boolean) {
				node.isExpanded = value;
				for (const key in node.children) {
					setExpandedRecursive(node.children[key], value);
				}
			}

			if (isEmptyString(nodePath)) {
				setExpandedRecursive(root, true);
			} else {
				const target = this.getNodeByPath(nodePath!);
				if (target) setExpandedRecursive(target, true);
			}

			this._emitTreeChanged();
			perfEnd(`[${_treeId}] expandAll`);
		},

		collapseAll(nodePath?: string | null | undefined): void {
			perfStart(`[${_treeId}] collapseAll`);
			const self = this;
			function collapseRecursive(node: LTreeNode<T>) {
				if (node.isExpanded && self.getNodeIsCollapsible(node)) {
					node.isExpanded = false;
				}
				for (const key in node.children) {
					collapseRecursive(node.children[key]);
				}
			}

			if (isEmptyString(nodePath)) {
				collapseRecursive(root);
			} else {
				const target = this.getNodeByPath(nodePath!);
				if (target) collapseRecursive(target);
			}

			this._emitTreeChanged();
			perfEnd(`[${_treeId}] collapseAll`);
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

			node.hasChildren = true;
			node.data = data;

			if (!noEmitChanges) {
				this._emitTreeChanged();
			}
		},

		expandNodes: function (path: string, noEmitChanges: boolean = false) {
			perfStart(`[${_treeId}] expandNodes`);
			let node: LTreeNode<T> | undefined = this.isFiltered ? filteredRoot : root;
			let hasChanges = false;

			const segments = path.split(this.treePathSeparator);
			for (let i = 0; i < segments.length; i++) {
				const segment = segmentPrefix + segments[i];

				if (node.children.hasOwnProperty(segment)) {
					node = node.children[segment];
					// Only mark as changed if actually changing from collapsed to expanded
					if (!node.isExpanded) {
						node.isExpanded = true;
						hasChanges = true;
					}
				}
			}

			// Only emit changes if something actually changed
			if (!noEmitChanges && hasChanges) {
				this._emitTreeChanged();
			}

			perfEnd(`[${_treeId}] expandNodes`);
			return this; // Return the API object for chaining
		},

		collapseNodes: function (path: string, noEmitChanges: boolean = false) {
			let node: LTreeNode<T> | undefined = this.isFiltered ? filteredRoot : this.root;
			let hasChanges = false;

			const segments = path.split(this.treePathSeparator);
			for (let i = 0; i < segments.length; i++) {
				const segment = segmentPrefix + segments[i];

				if (node.children.hasOwnProperty(segment)) {
					node = node.children[segment];
				}
			}

			// Only collapse the target node, not ancestors
			if (node.isExpanded) {
				node.isExpanded = false;
				hasChanges = true;
			}

			// Only emit changes if something actually changed
			if (!noEmitChanges && hasChanges) {
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
			if (!shouldCalculateDisplayValue && node.data) return getField(node.data, _displayValueMember!);

			if (this.getDisplayValueCallback) return this.getDisplayValueCallback(node);

			return '[N/A]';
		},

		getNodeSearchValue(node: LTreeNode<T>): string {
			if (!shouldCalculateSearchValue && node.data) return getField(node.data, _searchValueMember!);

			if (this.getSearchValueCallback) return this.getSearchValueCallback(node);

			return '[N/A]';
		},

		getNodeAllowedDropPositions(node: LTreeNode<T>): import('./types.js').DropPosition[] | null | undefined {
			// Priority: callback > member > node property
			if (this.getAllowedDropPositionsCallback) {
				return this.getAllowedDropPositionsCallback(node);
			}

			if (!shouldCalculateAllowedDropPositions && node.data) {
				return getField(node.data, _allowedDropPositionsMember!);
			}

			return node.allowedDropPositions;
		},

		getNodeIsDraggable(node: LTreeNode<T>): boolean {
			if (this.getIsDraggableCallback) return this.getIsDraggableCallback(node);
			if (!shouldCalculateIsDraggable && node.data) return getField(node.data, _isDraggableMember!);
			return node.isDraggable;
		},

		getNodeIsCollapsible(node: LTreeNode<T>): boolean {
			if (this.getIsCollapsibleCallback) return this.getIsCollapsibleCallback(node);
			if (!shouldCalculateIsCollapsible && node.data) return getField(node.data, _isCollapsibleMember!);
			return node.isCollapsible;
		},

		refresh(): void {
			this._emitTreeChanged();
		},

		/**
		 * Get direct children of a node at the given path
		 * @param parentPath - Path to parent node (empty string for root)
		 * @returns Array of child nodes
		 */
		getChildren(parentPath: string): LTreeNode<T>[] {
			// Read changeTracker to create reactive dependency for custom recursive renderers
			const _tracker = changeTracker;
			const parent = this.getNodeByPath(parentPath);
			if (!parent || !_tracker) return [];
			return Object.values(parent.children);
		},

		/**
		 * Get siblings of a node (including the node itself)
		 * @param path - Path to the node
		 * @returns Array of sibling nodes (nodes with same parent)
		 */
		getSiblings(path: string): LTreeNode<T>[] {
			// Read changeTracker to create reactive dependency for custom recursive renderers
			const _tracker = changeTracker;
			const node = this.getNodeByPath(path);
			if (!node || !_tracker) return [];

			// Get parent and return all its children
			const parentPath = node.parentPath || '';
			return this.getChildren(parentPath);
		},

		/**
		 * Re-sort siblings under a parent path using sortCallback or default sort
		 * This reorders the children object to reflect updated order values
		 * @param parentPath - Path to parent node (empty string for root)
		 */
		refreshSiblings(parentPath: string): void {
			const parent = parentPath ? this.getNodeByPath(parentPath) : root;
			if (!parent) return;

			// Get current children as array
			const children = Object.values(parent.children) as LTreeNode<T>[];
			if (children.length === 0) return;

			// Sort using sortCallback or default sort
			let sorted: LTreeNode<T>[];
			if (this.sortCallback) {
				sorted = this.sortCallback(children);
			} else {
				// Use a simplified sort for siblings only (all same level/parent)
				sorted = [...children].sort((a, b) => {
					// If orderMember is provided, use it
					if (this.orderMember && a.data && b.data) {
						const aOrder = getField(a.data, this.orderMember) ?? 0;
						const bOrder = getField(b.data, this.orderMember) ?? 0;
						if (aOrder !== bOrder) {
							return aOrder - bOrder;
						}
					}
					// Fall back to display value
					return this.getNodeDisplayValue(a).localeCompare(this.getNodeDisplayValue(b));
				});
			}

			// Rebuild children object in sorted order
			const newChildren: Record<string, LTreeNode<T>> = {};
			sorted.forEach(child => {
				const segment = segmentPrefix + child.pathSegment;
				newChildren[segment] = child;
			});
			parent.children = newChildren;

			this._emitTreeChanged();
		},

		/**
		 * Refresh a single node and optionally its descendants
		 * Useful after modifying node data externally
		 * @param path - Path to the node to refresh
		 */
		refreshNode(path: string): void {
			// For now, just trigger a tree change
			// Future optimization: only re-render the specific subtree
			this._emitTreeChanged();
		},

		/**
		 * Move a node to a new location in the tree
		 * @param sourcePath - Path of the node to move
		 * @param targetPath - Path of the target node
		 * @param position - Where to place relative to target: 'before', 'after', or 'child'
		 * @returns Object with success status and optional error message
		 */
		moveNode(sourcePath: string, targetPath: string, position: 'before' | 'after' | 'child'): { success: boolean; error?: string } {
			// Find source node
			const sourceNode = this.getNodeByPath(sourcePath);
			if (!sourceNode) {
				return { success: false, error: `Source node not found: ${sourcePath}` };
			}

			// Find target node
			const targetNode = this.getNodeByPath(targetPath);
			if (!targetNode) {
				return { success: false, error: `Target node not found: ${targetPath}` };
			}

			// Prevent moving a node into itself or its descendants
			if (targetPath.startsWith(sourcePath + this.treePathSeparator) || targetPath === sourcePath) {
				return { success: false, error: 'Cannot move a node into itself or its descendants' };
			}

			// Get source's current parent
			const sourceParentPath = sourceNode.parentPath || '';
			const sourceParent = sourceParentPath ? this.getNodeByPath(sourceParentPath) : root;
			if (!sourceParent) {
				return { success: false, error: `Source parent not found: ${sourceParentPath}` };
			}

			// Remove source from current parent
			const sourceSegment = segmentPrefix + sourceNode.pathSegment;
			delete sourceParent.children[sourceSegment];

			// Update source parent's hasChildren
			if (Object.keys(sourceParent.children).length === 0) {
				sourceParent.hasChildren = false;
				if (_hasChildrenMember && sourceParent.data) {
					(sourceParent.data as any)[_hasChildrenMember] = false;
				}
			}

			// Calculate new parent and path
			let newParentPath: string;
			let newParent: LTreeNode<T>;

			if (position === 'child') {
				// Insert as child of target
				newParentPath = targetPath;
				newParent = targetNode;
			} else {
				// Insert as sibling (before or after)
				newParentPath = targetNode.parentPath || '';
				newParent = newParentPath ? this.getNodeByPath(newParentPath)! : root;
			}

			// Generate new path segment (use source's original segment if unique)
			let newSegment = sourceNode.pathSegment;

			// Check if a node with this segment already exists in the new parent (excluding source node itself)
			const existingChild = newParent.children[segmentPrefix + newSegment];
			if (existingChild && existingChild !== sourceNode) {
				// Segment collision - generate a unique segment
				// Try using the source's ID first, then fall back to timestamp
				const sourceId = sourceNode.id?.toString();
				if (sourceId && !newParent.children[segmentPrefix + sourceId]) {
					newSegment = sourceId;
				} else {
					// Generate unique segment with timestamp
					newSegment = `${newSegment}_${Date.now()}`;
				}
			}

			const newPath = newParentPath ? `${newParentPath}${this.treePathSeparator}${newSegment}` : newSegment;
			const oldPath = sourceNode.path;

			// Update source node's path and parentPath
			sourceNode.path = newPath;
			sourceNode.pathSegment = newSegment;
			// Keep '' for root nodes (matching insertArray's getParentPath convention)
			sourceNode.parentPath = newParentPath;
			sourceNode.level = getLevel(newPath, this.treePathSeparator);

			// Sync data object fields to match new tree position
			if (sourceNode.data) {
				if (_pathMember) (sourceNode.data as any)[_pathMember] = newPath;
				if (_parentPathMember) (sourceNode.data as any)[_parentPathMember] = newParentPath;
				if (_levelMember) (sourceNode.data as any)[_levelMember] = sourceNode.level;
			}

			// Update all descendants' paths recursively
			this._updateDescendantPaths(sourceNode, oldPath, newPath);

			// Insert into new parent
			newParent.children[segmentPrefix + newSegment] = sourceNode;
			newParent.hasChildren = true;
			if (_hasChildrenMember && newParent.data) {
				(newParent.data as any)[_hasChildrenMember] = true;
			}

			// If orderMember is defined and position is before/after, calculate order
			if (this.orderMember && position !== 'child' && sourceNode.data) {
				const om = this.orderMember;
				const siblings = Object.values(newParent.children) as LTreeNode<T>[];
				const targetOrder = (targetNode.data ? getField(targetNode.data, om) : 0) ?? 0;

				if (position === 'before') {
					// Find order value just before target
					const siblingOrders = siblings
						.filter(s => s !== sourceNode && s.data && getField(s.data, om) !== undefined)
						.map(s => getField(s.data!, om) as number)
						.filter(o => o < targetOrder)
						.sort((a, b) => b - a);
					const prevOrder = siblingOrders[0] ?? targetOrder - 20;
					(sourceNode.data as any)[om] = Math.floor((prevOrder + targetOrder) / 2);
				} else {
					// Find order value just after target
					const siblingOrders = siblings
						.filter(s => s !== sourceNode && s.data && getField(s.data, om) !== undefined)
						.map(s => getField(s.data!, om) as number)
						.filter(o => o > targetOrder)
						.sort((a, b) => a - b);
					const nextOrder = siblingOrders[0] ?? targetOrder + 20;
					(sourceNode.data as any)[om] = Math.floor((targetOrder + nextOrder) / 2);
				}
			}

			// Re-sort siblings if needed
			this.refreshSiblings(newParentPath);

			return { success: true };
		},

		/**
		 * Helper to recursively update descendant paths after a move
		 */
		_updateDescendantPaths(node: LTreeNode<T>, oldBasePath: string, newBasePath: string): void {
			for (const child of Object.values(node.children) as LTreeNode<T>[]) {
				// Save the old path BEFORE updating, for correct recursive calculation
				const oldChildPath = child.path;

				// Calculate new path by replacing the old base with new base
				const relativePath = oldChildPath.substring(oldBasePath.length);
				const newChildPath = newBasePath + relativePath;

				child.path = newChildPath;
				child.parentPath = node.path;
				child.level = getLevel(newChildPath, this.treePathSeparator);

				// Sync data object fields
				if (child.data) {
					if (_pathMember) (child.data as any)[_pathMember] = newChildPath;
					if (_parentPathMember) (child.data as any)[_parentPathMember] = node.path;
					if (_levelMember) (child.data as any)[_levelMember] = child.level;
				}

				// Recurse into children using the OLD child path as base
				this._updateDescendantPaths(child, oldChildPath, newChildPath);
			}
		},

		/**
		 * Remove a node from the tree
		 * @param path - Path of the node to remove
		 * @param includeDescendants - If true, removes all descendants (default: true)
		 * @returns Object with success status and the removed node
		 */
		removeNode(path: string, includeDescendants: boolean = true): { success: boolean; node?: LTreeNode<T>; error?: string } {
			const node = this.getNodeByPath(path);
			if (!node) {
				return { success: false, error: `Node not found: ${path}` };
			}

			// Get parent
			const parentPath = node.parentPath || '';
			const parent = parentPath ? this.getNodeByPath(parentPath) : root;
			if (!parent) {
				return { success: false, error: `Parent not found: ${parentPath}` };
			}

			// Remove from parent
			const segment = segmentPrefix + node.pathSegment;
			delete parent.children[segment];

			// Update parent's hasChildren
			if (Object.keys(parent.children).length === 0) {
				parent.hasChildren = false;
				// Sync data object's hasChildren field
				if (_hasChildrenMember && parent.data) {
					(parent.data as any)[_hasChildrenMember] = false;
				}
			}

			// Update node count
			if (includeDescendants) {
				const countDescendants = (n: LTreeNode<T>): number => {
					let count = 1;
					for (const child of Object.values(n.children)) {
						count += countDescendants(child);
					}
					return count;
				};
				nodeCount -= countDescendants(node);
			} else {
				nodeCount--;
			}

			this._emitTreeChanged();
			return { success: true, node };
		},

		/**
		 * Add a new node to the tree
		 * @param parentPath - Path of the parent (empty string for root)
		 * @param data - The data object for the new node
		 * @param pathSegment - Optional path segment (auto-generated if not provided)
		 * @returns Object with success status and the created node
		 */
		addNode(parentPath: string, data: T, pathSegment?: string): { success: boolean; node?: LTreeNode<T>; error?: string } {
			const parent = parentPath ? this.getNodeByPath(parentPath) : root;
			if (!parent && parentPath) {
				return { success: false, error: `Parent not found: ${parentPath}` };
			}

			// Generate path segment if not provided
			if (!pathSegment) {
				// Use ID from data if available, otherwise generate a unique one
				const id = _idMember && data ? (data as any)[_idMember] : undefined;
				pathSegment = id?.toString() || `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			}

			// At this point pathSegment is guaranteed to be a string
			const segment: string = pathSegment!;

			// Calculate full path
			const newPath: string = parentPath ? `${parentPath}${this.treePathSeparator}${segment}` : segment;

			// Check if path already exists
			if (this.getNodeByPath(newPath)) {
				return { success: false, error: `Node already exists at path: ${newPath}` };
			}

			// Create the node
			const newNode = createLTreeNode<T>();
			newNode.treeId = _treeId || '';
			newNode.id = _idMember && data ? (data as any)[_idMember] : undefined;
			newNode.path = newPath;
			newNode.pathSegment = segment;
			// Keep '' for root nodes (matching insertArray's getParentPath convention)
			newNode.parentPath = parentPath;
			newNode.level = getLevel(newPath, this.treePathSeparator);
			newNode.data = data;
			newNode.isExpanded = _expandLevel ? newNode.level! <= _expandLevel : false;
			newNode.hasChildren = false;

			// Sync data object fields to match new tree position
			if (data) {
				if (_pathMember) (data as any)[_pathMember] = newPath;
				if (_parentPathMember) (data as any)[_parentPathMember] = parentPath;
				if (_levelMember) (data as any)[_levelMember] = newNode.level;
				if (_hasChildrenMember) (data as any)[_hasChildrenMember] = false;
			}

			// Add to parent
			const targetParent = parent || root;
			targetParent.children[segmentPrefix + pathSegment] = newNode;
			targetParent.hasChildren = true;
			// Sync data object's hasChildren field
			if (_hasChildrenMember && targetParent.data) {
				(targetParent.data as any)[_hasChildrenMember] = true;
			}

			// Update statistics
			nodeCount++;
			maxLevel = Math.max(maxLevel, newNode.level || 0);

			// Add to flat tree for search indexing
			flatTreeNodes.push(newNode);

			// Re-sort siblings to place new node in correct position
			this.refreshSiblings(parentPath);

			this._emitTreeChanged();
			return { success: true, node: newNode };
		},

		/**
		 * Update an existing node's data
		 * @param path - Path of the node to update
		 * @param dataUpdates - Partial data to merge into existing node data
		 * @returns Object with success status and the updated node
		 */
		updateNode(path: string, dataUpdates: Partial<T>): { success: boolean; node?: LTreeNode<T>; error?: string } {
			const node = this.getNodeByPath(path);
			if (!node) {
				return { success: false, error: `Node not found: ${path}` };
			}
			if (!node.data) {
				return { success: false, error: `Node has no data: ${path}` };
			}

			// Check if orderMember is being updated (will need re-sort)
			const orderMemberUpdated = this.orderMember && this.orderMember in dataUpdates;

			// Merge updates into existing data
			node.data = { ...node.data, ...dataUpdates };
			node._rev = (node._rev || 0) + 1;

			// Re-index for search if needed
			if (indexer && _shouldUseInternalSearchIndex) {
				const flatIndex = flatTreeNodes.indexOf(node);
				if (flatIndex !== -1) {
					indexer.addItem({ node, index: flatIndex });
				}
			}

			// Re-sort siblings if order was updated
			if (orderMemberUpdated) {
				this.refreshSiblings(node.parentPath || '');
			}

			this._emitTreeChanged();
			return { success: true, node };
		},

		/**
		 * Apply multiple changes to the tree in a single batch
		 * @param changes - Array of create/update/delete operations
		 * @returns Object with count of successful operations and array of failures
		 */
		applyChanges(changes: import('./types.js').TreeChange<T>[]): import('./types.js').ApplyChangesResult {
			const failures: Array<{ index: number; operation: string; path: string; error: string }> = [];
			let successCount = 0;

			for (let i = 0; i < changes.length; i++) {
				const change = changes[i];
				let result: { success: boolean; error?: string };

				switch (change.operation) {
					case 'create':
						result = this.addNode(change.parentPath, change.data, change.pathSegment);
						if (result.success) {
							successCount++;
						} else {
							failures.push({
								index: i,
								operation: change.operation,
								path: change.parentPath,
								error: result.error || 'Unknown error'
							});
						}
						break;
					case 'update':
						result = this.updateNode(change.path, change.data);
						if (result.success) {
							successCount++;
						} else {
							failures.push({
								index: i,
								operation: change.operation,
								path: change.path,
								error: result.error || 'Unknown error'
							});
						}
						break;
					case 'delete':
						result = this.removeNode(change.path);
						if (result.success) {
							successCount++;
						} else {
							failures.push({
								index: i,
								operation: change.operation,
								path: change.path,
								error: result.error || 'Unknown error'
							});
						}
						break;
				}
			}

			// Single emission after all changes
			if (successCount > 0) {
				this._emitTreeChanged();
			}

			return { successful: successCount, failed: failures };
		},

		/**
		 * Copy a node and all its descendants to a new location
		 * Useful for cross-tree drag-drop operations
		 * @param sourceNode - The node to copy (including its children)
		 * @param targetParentPath - Path where to insert the copy (empty string for root)
		 * @param transformData - Function to transform each node's data (e.g., assign new IDs)
		 * @param siblingPath - Optional path of sibling to position relative to
		 * @param position - Optional position relative to sibling ('before' or 'after')
		 * @returns Object with success status, the created root node, and count of nodes created
		 */
		copyNodeWithDescendants(
			sourceNode: LTreeNode<T>,
			targetParentPath: string,
			transformData: (data: T) => T,
			siblingPath?: string,
			position?: 'before' | 'after'
		): { success: boolean; rootNode?: LTreeNode<T>; count: number; error?: string } {
			if (!sourceNode.data) {
				return { success: false, count: 0, error: 'Source node has no data' };
			}

			let totalCount = 0;

			// Recursive helper function
			const copyRecursive = (node: LTreeNode<T>, parentPath: string): LTreeNode<T> | null => {
				if (!node.data) return null;

				// Transform the data (user assigns new IDs, etc.)
				const transformedData = transformData(node.data);

				// Add the node
				const result = this.addNode(parentPath, transformedData);
				if (!result.success || !result.node) {
					if (this.shouldDisplayDebugInformation) {
						console.warn(`[Tree ${_treeId}] copyNodeWithDescendants: Failed to add node`, result.error);
					}
					return null;
				}

				totalCount++;
				const newNode = result.node;

				// Recursively copy children
				if (node.children && Object.keys(node.children).length > 0) {
					for (const child of Object.values(node.children)) {
						copyRecursive(child, newNode.path);
					}
				}

				return newNode;
			};

			// Start the recursive copy
			const rootNode = copyRecursive(sourceNode, targetParentPath);

			if (!rootNode) {
				return { success: false, count: 0, error: 'Failed to copy root node' };
			}

			// Handle positioning relative to sibling if specified
			if (siblingPath && position && rootNode.data) {
				const siblingNode = this.getNodeByPath(siblingPath);
				if (siblingNode && this.orderMember) {
					// Get the parent to access siblings
					const parent = targetParentPath ? this.getNodeByPath(targetParentPath) : root;
					if (parent) {
						const siblings = Object.values(parent.children) as LTreeNode<T>[];
						const oKey = this.orderMember!;
						const siblingOrder = (siblingNode.data as any)?.[oKey] ?? 0;

						if (position === 'before') {
							// Find order value just before sibling
							const siblingOrders = siblings
								.filter(s => s !== rootNode && (s.data as any)?.[oKey] !== undefined)
								.map(s => (s.data as any)[oKey] as number)
								.filter(o => o < siblingOrder)
								.sort((a, b) => b - a);
							const prevOrder = siblingOrders[0] ?? siblingOrder - 20;
							(rootNode.data as any)[oKey] = Math.floor((prevOrder + siblingOrder) / 2);
						} else {
							// Find order value just after sibling
							const siblingOrders = siblings
								.filter(s => s !== rootNode && (s.data as any)?.[oKey] !== undefined)
								.map(s => (s.data as any)[oKey] as number)
								.filter(o => o > siblingOrder)
								.sort((a, b) => a - b);
							const nextOrder = siblingOrders[0] ?? siblingOrder + 20;
							(rootNode.data as any)[oKey] = Math.floor((siblingOrder + nextOrder) / 2);
						}

						// Re-sort siblings
						this.refreshSiblings(targetParentPath);
					}
				}
			}

			return { success: true, rootNode, count: totalCount };
		},

		/**
		 * Get paths of all expanded nodes
		 * Useful for saving expanded state before a full redraw
		 * @returns Array of paths that are currently expanded
		 */
		getExpandedPaths(): string[] {
			const paths: string[] = [];
			const traverse = (node: LTreeNode<T>) => {
				if (node.isExpanded && node.path) {
					paths.push(node.path);
				}
				for (const child of Object.values(node.children)) {
					traverse(child);
				}
			};
			traverse(root);
			return paths;
		},

		/**
		 * Set expanded state for given paths
		 * Useful for restoring expanded state after a full redraw
		 * @param paths - Array of paths to expand (all others will be collapsed)
		 */
		setExpandedPaths(paths: string[]): void {
			const pathSet = new Set(paths);
			const traverse = (node: LTreeNode<T>) => {
				if (node.path) {
					node.isExpanded = pathSet.has(node.path);
				}
				for (const child of Object.values(node.children)) {
					traverse(child);
				}
			};
			traverse(root);
			this._emitTreeChanged();
		},

		/**
		 * Extract all node data as a flat array
		 * Useful for saving the entire tree state to a database
		 * @returns Array of all node data objects
		 */
		getAllData(): T[] {
			const result: T[] = [];
			const traverse = (node: LTreeNode<T>) => {
				if (node.data) {
					result.push(node.data);
				}
				for (const child of Object.values(node.children)) {
					traverse(child);
				}
			};
			traverse(root);
			return result;
		},

		// ── Bulk subtree operations (single emission) ─────────────────────────

		insertBranch(parentPath: string, data: T[]): InsertBranchResult<T> {
			const targetParent = parentPath ? this.getNodeByPath(parentPath) : root;
			if (!targetParent && parentPath) {
				return { success: false, count: 0, failed: [], parentNode: null };
			}
			const parentNode = targetParent || root;

			if (data.length === 0) {
				return { success: true, count: 0, failed: [], parentNode };
			}

			const failed: Array<{ data: T; error: string }> = [];

			// Convert raw data → LTreeNode (same logic as insertArray lines 244-288)
			let mappedData = data.map((row, index) => {
				const node = createLTreeNode<T>();
				node.treeId = _treeId || '';
				node.id = _idMember ? getField(row, _idMember) : undefined;
				const rawPath = _pathMember ? getField(row, _pathMember) : undefined;

				if (rawPath == null || rawPath === '' || typeof rawPath !== 'string') {
					const pathDesc = rawPath === '' ? 'empty string'
						: rawPath == null ? 'undefined/null'
						: `non-string (${typeof rawPath})`;
					failed.push({ data: row, error: `Item at index ${index} has invalid path (${pathDesc})` });
					return null;
				}
				node.path = rawPath;

				if (shouldCalculateParentPath) {
					node.parentPath = getParentPath(node.path, this.treePathSeparator);
				} else node.parentPath = getField(row, _parentPathMember!);

				node.pathSegment = getPathSegments(getRelativePath(node.path, node.parentPath ?? '', this.treePathSeparator), 0, 1, this.treePathSeparator);

				if (!shouldCalculateLevel) node.level = getField(row, _levelMember!);
				else node.level = getLevel(node.path, this.treePathSeparator);

				if (!shouldCalculateIsExpanded) node.isExpanded = getField(row, _isExpandedMember!);
				else if (_expandLevel) node.isExpanded = (node.level ?? 0) <= _expandLevel;

				if (!shouldCalculateIsSelectable) node.isSelectable = getField(row, _isSelectableMember!);
				if (!shouldCalculateIsSelected) node.isSelected = getField(row, _isSelectedMember!);
				if (!shouldCalculateIsDraggable) node.isDraggable = getField(row, _isDraggableMember!);
				if (!shouldCalculateIsCollapsible) node.isCollapsible = getField(row, _isCollapsibleMember!);
				if (!shouldCalculateIsDropAllowed) node.isDropAllowed = getField(row, _isDropAllowedMember!);
				if (!shouldCalculateAllowedDropPositions) node.allowedDropPositions = getField(row, _allowedDropPositionsMember!);

				if (!shouldCalculateHasChildren) node.hasChildren = getField(row, _hasChildrenMember!);

				node.data = row;
				return node;
			}).filter((node): node is LTreeNode<T> => node !== null);

			// Sort to ensure parents come before children
			if (!this.isSorted) {
				if (this.sortCallback) mappedData = this.sortCallback(mappedData);
				else mappedData = this._defaultSort(this, mappedData);
			}

			// Insert all nodes silently (no emission per node)
			const affectedParents = new Set<string>();
			let insertedCount = 0;

			for (const node of mappedData) {
				const result = this.insertTreeNode(node.parentPath ?? '', node, true);
				if (result) {
					failed.push({ data: node.data!, error: result });
				} else {
					insertedCount++;
					affectedParents.add(node.parentPath ?? '');

					// Add to flat tree for search indexing
					if (_shouldUseInternalSearchIndex) {
						flatTreeNodes.push(node);
					}
				}
			}

			// Re-sort each affected parent's children (without emitting)
			for (const pp of affectedParents) {
				const parent = pp ? this.getNodeByPath(pp) : root;
				if (!parent) continue;
				const children = Object.values(parent.children) as LTreeNode<T>[];
				if (children.length === 0) continue;

				let sorted: LTreeNode<T>[];
				if (this.sortCallback) {
					sorted = this.sortCallback(children);
				} else {
					sorted = [...children].sort((a, b) => {
						if (this.orderMember && a.data && b.data) {
							const aOrder = getField(a.data, this.orderMember) ?? 0;
							const bOrder = getField(b.data, this.orderMember) ?? 0;
							if (aOrder !== bOrder) return aOrder - bOrder;
						}
						return this.getNodeDisplayValue(a).localeCompare(this.getNodeDisplayValue(b));
					});
				}
				const newChildren: Record<string, LTreeNode<T>> = {};
				sorted.forEach(child => {
					newChildren[segmentPrefix + child.pathSegment] = child;
				});
				parent.children = newChildren;
			}

			// ── Pipeline: directly update all affected parents ──────────
			// Update hasChildren + _hasChildrenMember on EVERY parent that received children
			for (const pp of affectedParents) {
				const parent = pp ? this.getNodeByPath(pp) : root;
				if (!parent) continue;
				parent.hasChildren = Object.keys(parent.children).length > 0;
				if (_hasChildrenMember && parent.data) {
					(parent.data as any)[_hasChildrenMember] = parent.hasChildren;
				}
			}

			// Bump _rev on all affected parents AND their ancestors up to root
			const bumpedPaths = new Set<string>();
			for (const pp of affectedParents) {
				let walkPath = pp;
				while (walkPath && !bumpedPaths.has(walkPath)) {
					bumpedPaths.add(walkPath);
					const ancestor = this.getNodeByPath(walkPath);
					if (ancestor) ancestor._rev = (ancestor._rev || 0) + 1;
					const sepIdx = walkPath.lastIndexOf(this.treePathSeparator);
					walkPath = sepIdx > 0 ? walkPath.substring(0, sepIdx) : '';
				}
			}

			// Batch add to indexer
			if (_shouldUseInternalSearchIndex && indexer) {
				const startIdx = flatTreeNodes.length - insertedCount;
				const itemsToIndex: { node: LTreeNode<T>; index: number }[] = [];
				for (let i = startIdx; i < flatTreeNodes.length; i++) {
					itemsToIndex.push({ node: flatTreeNodes[i], index: i });
				}
				if (itemsToIndex.length > 0) {
					indexer.addToQueue(itemsToIndex);
				}
			}

			// Single emission
			this._emitTreeChanged();

			return { success: true, count: insertedCount, failed, parentNode };
		},

		replaceBranch(parentPath: string, data: T[]): InsertBranchResult<T> {
			const targetParent = parentPath ? this.getNodeByPath(parentPath) : root;
			if (!targetParent && parentPath) {
				return { success: false, count: 0, failed: [], parentNode: null };
			}
			const parentNode = targetParent || root;

			// Count and collect all descendant paths for removal
			const countDescendants = (n: LTreeNode<T>): number => {
				let count = 0;
				for (const child of Object.values(n.children)) {
					count += 1 + countDescendants(child);
				}
				return count;
			};
			const removedCount = countDescendants(parentNode);

			// Remove descendants from flatTreeNodes (for search index consistency)
			if (removedCount > 0) {
				const collectPaths = (n: LTreeNode<T>, paths: Set<string>) => {
					for (const child of Object.values(n.children)) {
						paths.add(child.path);
						collectPaths(child, paths);
					}
				};
				const pathsToRemove = new Set<string>();
				collectPaths(parentNode, pathsToRemove);
				flatTreeNodes = flatTreeNodes.filter(n => !pathsToRemove.has(n.path));
			}

			// Clear children
			parentNode.children = {};
			parentNode.hasChildren = false;
			if (_hasChildrenMember && parentNode.data) {
				(parentNode.data as any)[_hasChildrenMember] = false;
			}
			nodeCount -= removedCount;

			// Delegate to insertBranch for the new data
			return this.insertBranch(parentPath, data);
		},

		deleteBranch(path: string, keepParent: boolean = false): DeleteBranchResult<T> {
			const countDescendants = (n: LTreeNode<T>): number => {
				let count = 0;
				for (const child of Object.values(n.children)) {
					count += 1 + countDescendants(child);
				}
				return count;
			};

			const collectPaths = (n: LTreeNode<T>, paths: Set<string>) => {
				for (const child of Object.values(n.children)) {
					paths.add(child.path);
					collectPaths(child, paths);
				}
			};

			if (keepParent) {
				// Keep the node, clear its children
				const node = path ? this.getNodeByPath(path) : root;
				if (!node && path) {
					return { success: false, removedCount: 0, error: `Node not found: ${path}` };
				}
				const targetNode = node || root;

				const removedCount = countDescendants(targetNode);
				if (removedCount === 0) {
					return { success: true, removedCount: 0 };
				}

				// Remove from flatTreeNodes
				const pathsToRemove = new Set<string>();
				collectPaths(targetNode, pathsToRemove);
				flatTreeNodes = flatTreeNodes.filter(n => !pathsToRemove.has(n.path));

				targetNode.children = {};
				targetNode.hasChildren = false;
				if (_hasChildrenMember && targetNode.data) {
					(targetNode.data as any)[_hasChildrenMember] = false;
				}
				nodeCount -= removedCount;

				// Bump _rev on node itself + ancestors
				targetNode._rev = (targetNode._rev || 0) + 1;
				let ancestorPath = path;
				while (ancestorPath) {
					const sepIdx = ancestorPath.lastIndexOf(this.treePathSeparator);
					ancestorPath = sepIdx > 0 ? ancestorPath.substring(0, sepIdx) : '';
					if (ancestorPath) {
						const ancestor = this.getNodeByPath(ancestorPath);
						if (ancestor) ancestor._rev = (ancestor._rev || 0) + 1;
					}
				}

				this._emitTreeChanged();
				return { success: true, removedCount };
			} else {
				// Remove the node itself + all descendants
				if (path === '') {
					return { success: false, removedCount: 0, error: 'Cannot delete root node' };
				}

				const node = this.getNodeByPath(path);
				if (!node) {
					return { success: false, removedCount: 0, error: `Node not found: ${path}` };
				}

				const parentPath = node.parentPath || '';
				const parent = parentPath ? this.getNodeByPath(parentPath) : root;
				if (!parent) {
					return { success: false, removedCount: 0, error: `Parent not found: ${parentPath}` };
				}

				const removedCount = 1 + countDescendants(node);

				// Remove from flatTreeNodes
				const pathsToRemove = new Set<string>();
				pathsToRemove.add(node.path);
				collectPaths(node, pathsToRemove);
				flatTreeNodes = flatTreeNodes.filter(n => !pathsToRemove.has(n.path));

				// Remove from parent
				const segment = segmentPrefix + node.pathSegment;
				delete parent.children[segment];

				if (Object.keys(parent.children).length === 0) {
					parent.hasChildren = false;
					if (_hasChildrenMember && parent.data) {
						(parent.data as any)[_hasChildrenMember] = false;
					}
				}

				nodeCount -= removedCount;

				// Bump _rev on ancestors
				let ancestorPath = parentPath;
				while (ancestorPath) {
					const ancestor = this.getNodeByPath(ancestorPath);
					if (ancestor) ancestor._rev = (ancestor._rev || 0) + 1;
					const sepIdx = ancestorPath.lastIndexOf(this.treePathSeparator);
					ancestorPath = sepIdx > 0 ? ancestorPath.substring(0, sepIdx) : '';
				}

				this._emitTreeChanged();
				return { success: true, removedCount };
			}
		},

		_defaultSort: function (self: Ltree<T>, items: LTreeNode<T>[]): LTreeNode<T>[] {
			return items.sort((a, b) => {
				// First, sort by level (shallower levels first)
				const aLevel = a.level || 0;
				const bLevel = b.level || 0;
				if (aLevel !== bLevel) {
					return aLevel - bLevel;
				}

				// Then sort by parent path
				if (a.parentPath !== b.parentPath) {
					if (!a.parentPath) return -1;
					if (!b.parentPath) return 1;
					return a.parentPath.localeCompare(b.parentPath!);
				}

				// If orderMember is provided, use it for sibling ordering
				if (self.orderMember && a.data && b.data) {
					const aOrder = (a.data as any)[self.orderMember] ?? 0;
					const bOrder = (b.data as any)[self.orderMember] ?? 0;
					if (aOrder !== bOrder) {
						return aOrder - bOrder;
					}
				}

				// Finally sort by display value
				return self.getNodeDisplayValue(a).localeCompare(self.getNodeDisplayValue(b));
			});
		},

		_emitTreeChanged: function () {
			changeTracker = Symbol();
		},

		...opts
	};
}
