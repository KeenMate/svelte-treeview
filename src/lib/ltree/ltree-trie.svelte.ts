import FlexSearch, { Index } from "flexsearch";

import {
	type LTreeTrieNode,
	createLTreeTrieNode,
} from "./ltree-trie-node.svelte";

import { isEmptyString } from "../helpers/string-helpers";
import {
	getParentPath,
	getPathSegments,
	getRelativePath,
} from "../helpers/ltree-helpers";

import type { LTreeTrie } from "./types";
import { createSearchIndex } from "./flex";

export function createLTreeTrie<T>(
	_idMember: string,
	_pathMember: string,
	_parentPathMember?: string | null | undefined,
	_levelMember?: string | null | undefined,
	_hasChildrenMember?: string | null | undefined,
	_isExpandedMember?: string | null | undefined,
	_isSelectableMember?: string | null | undefined,
	_displayValueMember?: string | null | undefined,
	_getDisplayValueCallback?: (node: LTreeTrieNode<T>) => string,

	_searchValueMember?: string | null | undefined,
	_getSearchValueCallback?: (node: LTreeTrieNode<T>) => string,

	_treeId?: string,

	_shouldUseInternalSearchIndex?: boolean | null | undefined,
	_initializeIndexCallback?: () => Index,

	opts?: Partial<LTreeTrie<T>>
): LTreeTrie<T> {
	let shouldCalculateParentPath: boolean = isEmptyString(_parentPathMember);
	let shouldCalculateLevel: boolean = isEmptyString(_levelMember);
	let shouldCalculateHasChildren: boolean = isEmptyString(_hasChildrenMember);
	let shouldCalculateIsExpanded: boolean = isEmptyString(_isExpandedMember);
	let shouldCalculateIsSelectable: boolean = isEmptyString(_isSelectableMember);
	let shouldCalculateDisplayValue: boolean = isEmptyString(_displayValueMember);
	let shouldCalculateSearchValue: boolean = isEmptyString(_searchValueMember);

	// Private state variables
	let root = createLTreeTrieNode<T>();
	let searchIndex: Index | null | undefined = null;

	if (_shouldUseInternalSearchIndex)
		searchIndex = _initializeIndexCallback
			? _initializeIndexCallback()
			: createSearchIndex();

	let changeTracker = $state(Symbol());
	let size = 0;

	let flatTreeNodes: LTreeTrieNode<T>[] = [];
	let filteredTree: LTreeTrieNode<T>[] | null = null;
	let isFiltered = false;

	return {
		// Properties
		treePathSeparator: ".",
		root,
		get changeTracker() {
			return changeTracker;
		},
		idMember: _idMember,
		pathMember: _pathMember,
		parentPathMember: _parentPathMember,
		levelMember: _levelMember,
		isExpandedMember: _isExpandedMember,
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
		get tree(): LTreeTrieNode<T>[] {
			if (isFiltered) {
				return filteredTree || [];
			}
			if (!this.root?.children || !changeTracker) {
				return [];
			}

			return Object.values(this.root.children);
		},

		insertArray: function (data: T[], noEmitChanges: boolean = false) {
			performance.mark("sort-start");

			data = data || [];

			if (!this.isSorted) {
				data = (this.sortCallback || this._defaultSort)?.(data);
			}

			performance.mark("sort-end");
			performance.mark("conversion-start");
			const mappedData = data.map((row, index) => {
				const node = createLTreeTrieNode<T>();
				node.treeId = _treeId;
				node.id = _idMember ? row[_idMember] : undefined;
				node.path = _pathMember ? row[_pathMember] : undefined;

				if (shouldCalculateParentPath) {
					node.parentPath = getParentPath(node.path);
				} else node.parentPath = row[_parentPathMember];

				node.pathSegment = getPathSegments(
					getRelativePath(node.path, node.parentPath)
				);

				if (!shouldCalculateLevel) node.level = row[_levelMember];

				if (!shouldCalculateIsExpanded)
					node.isExpanded = row[_isExpandedMember];

				if (!shouldCalculateIsSelectable)
					node.isSelectable = row[_isSelectableMember];

				if (!shouldCalculateHasChildren)
					node.hasChildren = row[_hasChildrenMember];

				node.data = row;
				return node;
			});
			performance.mark("conversion-end");
			performance.mark("insert-start");

			const errors: string[] = [];

			mappedData.forEach((node, index) => {
				const result = this.insertTreeNode(node.parentPath, node, true);

				if (_shouldUseInternalSearchIndex) {
					if (!shouldCalculateSearchValue) {
						searchIndex.add(index, node.data[_searchValueMember]);
					} else if (_getSearchValueCallback) {
						searchIndex.add(index, _getSearchValueCallback(node));
					}
				}

				if (result) errors.push(result);
			});
			if (errors.length > 0) console.warn(errors);

			if (!noEmitChanges) {
				this._emitTreeChanged();
			}
			performance.mark("insert-end");

			performance.measure("sort-duration", "sort-start", "sort-end");
			performance.measure(
				"conversion-duration",
				"conversion-start",
				"conversion-end"
			);
			performance.measure("insert-duration", "insert-start", "insert-end");

			let measure = performance.getEntriesByName("sort-duration")[0];
			console.log(`Sort took: ${measure.duration}ms`);

			measure = performance.getEntriesByName("conversion-duration")[0];
			console.log(`Conversion took: ${measure.duration}ms`);

			measure = performance.getEntriesByName("insert-duration")[0];
			console.log(`Insert took: ${measure.duration}ms`);
		},

		insertTreeNode: function (
			parentPath: string,
			newNode: LTreeTrieNode<T>,
			noEmitChanges?: boolean
		): string | null {
			const parentNode = this.getNodeByPath(parentPath);

			if (!parentNode) {
				return `Could not find node for parent path: ${parentPath}`;
			}
			if (shouldCalculateLevel) {
				newNode.level = (parentNode.level || 0) + 1;
			}

			const newSegment = getPathSegments(
				getRelativePath(newNode?.path, parentPath)
			);

			if (!parentNode.children.hasOwnProperty(newSegment)) {
				parentNode.children[newSegment] = newNode;
				if (shouldCalculateHasChildren && !parentNode.hasChildren) {
					parentNode.hasChildren = true;
				}
			}
			flatTreeNodes.push(newNode);

			if (!noEmitChanges) {
				this._emitTreeChanged();
			}

			return null;
		},

		filterNodes(_searchText: string): void {
			if (!_shouldUseInternalSearchIndex) {
				console.warn("Internal search index is disabled");
				return;
			}

			if (!_searchText || _searchText.trim() === "") {
				// Clear filter when search is empty
				filteredTree = null;
				isFiltered = false;
				this._emitTreeChanged();
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

			console.log("allRequiredPaths", Array.from(allRequiredPaths));

			// 2. Build filtered tree with only required paths
			const pathToNode = new Map<string, LTreeTrieNode<T>>();

			// First pass: create copies of all required nodes
			allRequiredPaths.forEach((path) => {
				const originalNode = this.getNodeByPath(path);
				if (originalNode) {
					// Deep copy the node but reset children
					const copiedNode: LTreeTrieNode<T> = {
						...originalNode,
						children: {},
						hasChildren: false,
						isExpanded: true, // Expand all nodes in filtered tree
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
			const rootNodes: LTreeTrieNode<T>[] = [];
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

			console.log("Created filtered tree with", rootNodes.length, "root nodes");
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

		insert: function (
			path: string,
			data: T,
			noEmitChanges: boolean = false
		): void {
			let node = this.root;

			const pathParts = path.split(this.treePathSeparator);
			for (let i = 0; i < pathParts.length; i++) {
				const part = pathParts[i];

				if (!node.children.hasOwnProperty(part)) {
					node.children[part] = createLTreeTrieNode<T>();
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
			let node: LTreeTrieNode<T> | undefined = this.root;

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
			let node: LTreeTrieNode<T> | undefined = this.root;

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
		getNodeByPath: function (path: string): LTreeTrieNode<T> | null {
			let node = this.root;

			if (path) {
				const parts = path.split(this.treePathSeparator);

				for (let i = 0; i < parts.length; i++) {
					if (!node.children.hasOwnProperty(parts[i])) {
						return null;
					}
					node = node.children[parts[i]]!;
				}
			}
			return node;
		},

		getNodeDisplayValue(node: LTreeTrieNode<T>): string {
			if (!shouldCalculateDisplayValue) return node.data[_displayValueMember];

			if (this.getDisplayValueCallback)
				return this.getDisplayValueCallback(node);

			return "[N/A]";
		},

		getNodeSearchValue(node: LTreeTrieNode<T>): string {
			if (!shouldCalculateSearchValue) return node.data[_searchValueMember];

			if (this.getSearchValueCallback) return this.getSearchValueCallback(node);

			return "[N/A]";
		},

		refresh(): void {
			this._emitTreeChanged();
		},

		_defaultSort: function (items: T[]): T[] {
			return items.sort((a, b) => a[_pathMember].localeCompare(b[_pathMember]));
		},

		_emitTreeChanged: function () {
			changeTracker = Symbol();
		},

		...opts,
	};
}
