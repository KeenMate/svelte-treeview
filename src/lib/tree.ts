import type { PropertyHelper } from '$lib/helpers/property-helper.js';
import { SelectionModes, type HelperConfig, type Node, type NodePath, type Tree } from '$lib/types.js';
import { derived, get, type Readable, writable, type Writable } from 'svelte/store';
import uniqueBy from 'lodash.uniqby';
import { getParentNodePath } from '$lib/helpers/nodepath-helpers.js';

export class TreeStore {
	props: PropertyHelper;
	tree: Writable<Node[]>;
	config: HelperConfig;

	constructor(props: PropertyHelper, config: HelperConfig) {
		this.tree = writable([]);
		this.props = props;
		this.config = config;
	}

	filteredTree(filter: (node: any) => boolean): Readable<Node[]> {
		return derived([this.tree], ([tree]) => {
			const filteredNodes = tree.filter(filter);

			const resultNodes: Node[] = [];

			// add all parents from each node
			// needed so that tree can be rendered
			filteredNodes.forEach((node: any) => {
				resultNodes.push(node);

				const parentNodes = this.getParents(tree, node);
				resultNodes.push(...parentNodes);
			});

			const uniqueNodes = uniqueBy(resultNodes, (node) => this.props.path(node));

			return uniqueNodes;
		});
	}

	changeExpansion(node: Node, changeTo: boolean) {
		this.tree.update((tree) => {
			const foundNode = this.findNode(get(this.tree), this.props.path(node));

			this.props.setExpanded(foundNode, changeTo);
			return tree;
		});
	}

	changeSelection(node: Node, changeTo: boolean, recursiveMode: boolean) {
		this.tree.update((tree) => {
			const path = this.props.path(node);
			// allow selection of root node
			if ((recursiveMode && this.props.hasChildren(node)) || path === null) {
				this.changeSelectedRecursively(tree, path, changeTo);
			} else {
				if (!node) {
					// throw new Error('Node not found ' + nodePath);
					console.warn('Node %s doesnt exits', path);
					return tree;
				}

				this.props.setSelected(node, changeTo);
			}
			return tree;
		});
	}

	private getParents(tree: Node[], node: Node) {
		const parentsPaths: NodePath[] = [];

		let nodePath = this.props.path(node);

		// get all parents
		while (nodePath && nodePath.length > 0) {
			nodePath = getParentNodePath(nodePath, this.config.separator);
			parentsPaths.push(nodePath);
		}

		//find nodes for given ids
		const parentNodes = tree.filter((n) =>
			parentsPaths.some((parentNodePath) => this.props.path(n) === parentNodePath)
		);

		return parentNodes;
	}

	private findNode(tree: Node[], nodePath: NodePath): Node {
		return tree.find((node) => this.props.path(node) === nodePath) ?? null;
	}

	private changeSelectedRecursively(tree: Tree, parentNodePath: NodePath, changeTo: boolean) {
		tree.forEach((node) => {
			// match itself and all children
			if (this.props.path(node)?.startsWith(parentNodePath ?? '')) {
				//dont change if not selectable
				if (!this.isSelectable(node, SelectionModes.all)) {
					return;
				}

				// in recursive mode only update leaf nodes
				if (this.recursiveMode && this.props.hasChildren(node)) {
					return;
				}

				this.props.setSelected(node, changeTo);
			}
		});
	}
}
