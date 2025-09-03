import type { Index } from "flexsearch";
import type { LTreeTrieNode } from "./ltree-trie-node.svelte";

export interface LTreeTrie<T> {
	// Properties (readonly getters)
	treePathSeparator: string;

	root: LTreeTrieNode<T>;

	changeTracker: Symbol | undefined;
	sortCallback?: (items: T[]) => T[];

	idMember: string | null | undefined;
	pathMember: string | null | undefined;
	parentPathMember: string | null | undefined;
	levelMember: string | null | undefined;

	hasChildrenMember: string | null | undefined;
	isExpandedMember: string | null | undefined;

	displayValueMember?: string | null | undefined;
	getDisplayValueCallback?: (node: LTreeTrieNode<T>) => string;

	searchValueMember?: string | null | undefined;
	getSearchValueCallback?: (node: LTreeTrieNode<T>) => string;

	isSorted: boolean | null | undefined;

	// Filtering properties
	filteredTree: LTreeTrieNode<T>[] | null;
	isFiltered: boolean;

	// Methods
	get tree(): LTreeTrieNode<T>[];

	insertArray(data: T[]): void;

	insertTreeNode(
		parentPath: string,
		newNode: LTreeTrieNode<T>,
		noEmitChanges?: boolean
	): string | null;

	filterNodes(_searchText: string): void;

	createFilteredTree(targetPaths: string[]): void;

	clearFilter(): void;

	expandAll(nodePath?: string | null | undefined): void;
	collapseAll(nodePath?: string | null | undefined): void;

	insert(path: string, data: T, noEmitChanges?: boolean): void;

	getNodeByPath(path: string): LTreeTrieNode<T> | null;

	expandNodes(path: string): LTreeTrie<T>; // Returns self for chaining

	collapseNodes(path: string): LTreeTrie<T>; // Returns self for chaining

	getNodeDisplayValue(node: LTreeTrieNode<T>): string;

	getNodeSearchValue(node: LTreeTrieNode<T>): string;

	_defaultSort(items: T[]): T[];

	_emitTreeChanged(): void;

	refresh(): void;
}
