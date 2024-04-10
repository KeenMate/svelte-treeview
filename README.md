# Svelte Treeview

The most elaborate treeview for svelte on earth (or even in our galaxy).

## Features

- load new nodes whne expanding
- automatically expanding to given depth
- customization of all object properties
- checkboxes enabled on whole tree or based on property
- recursive seletion mode, where leafes can be selected
- build-in support for search

## Instalation

install the package `@keenmate/svelte-treeview` using your favourite package manager.

Font awesome is required for expand/collapse icons.

## Minimal usage


```svelte
<script lang="ts">
	import { TreeView } from '$lib/index.js';

	let tree = [
		{ nodePath: 'animals', title: 'Animals', hasChildren: true },
    //...
		{ nodePath: 'animals.insects.butterflies', title: 'Butterflies' }
	];
</script>

<TreeView {tree} treeId="my-tree" let:node>
	{node.title}
</TreeView>

```