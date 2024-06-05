# Svelte Treeview

The most elaborate treeview for svelte on earth (or even in our galaxy).

## Features

- load new nodes when expanding
- choose what object properties to use to get necessary information (id, path, ...)
- enable checkboxes on whole tree or just per node
- recursive seletion mode, where leafes can be selected
- build-in support for search
- drag and drop functionality controlable per node
- context menu
- keyboard navigation

## Instalation

install the package `@keenmate/svelte-treeview` using your favourite package manager.

**Font awesome is required for expand/collapse icons.**

## Minimal usage

Tree and treeId are only mandatory attributes.
Tree has to be list of nodes. Only mandatory property of node is nodePath.
You can specify which keys to use for what properties by setting **props**.

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

For more examples see `src/routes/`

## NodeId and NodePath

By default, nodeId uses same property is nodePath.
You can change this by setting nodoId in prosp.

## Properties

| Name                   | Type                                                               | Default | Description                                                                                           |
| ---------------------- | ------------------------------------------------------------------ | ------- | ----------------------------------------------------------------------------------------------------- |
| treeId                 | string                                                             |         | value used to generate ids of nodes                                                                   |
| tree                   | array of nodes                                                     |         | represents tree strucuture                                                                            |
| value                  | array of selected nodeIds                                          | []      |                                                                                                       |
| verticalLines          | bool                                                               | false   | show vertical guide lines                                                                             |
| readonly               | bool                                                               | false   | dont allow selection and drag and drop                                                                |
| separator              | string                                                             | "."     |                                                                                                       |
| recursiveSelection     | bool                                                               | false   | changes behavior of selection, see   [Selection](#selection)                                          |
| selectionMode          | SelectionModes                                                     | none    | changes selection mode, see   [Selection](#selection)                                                 |
| onlyLeafCheckboxes     | bool                                                               | false   | hides non leaf checkboxed, see   [Selection](#selection)                                              |
| hideDisabledCheckboxes | bool                                                               | false   | hides checkboxes instead of disabling, see   [Selection](#selection)                                  |
| loadChildrenAsync      | ExpandedCallback                                                   | null    | function that is called when node is expanded, see   [Async loading](#async-loading)                  |
| showContextMenu        | bool                                                               | false   | On right click dispaly context menu defined in `context-menu` slot, see [Context menu](#context-menu) |
| expansionTreshold      | number                                                             | 0       | Expand all nodes when there is less than number provided                                              |
| customClasses          | Partial<CustomizableClasses>                                       | {}      | changes classes used on same elements, see [Custom classes](#custom-classes)                          |
| filter                 | (node: Node) => boolean or null                                    | null    | function that is used for fitlering. It is called on every node                                       |
| dragAndDrop            | bool                                                               | false   | enables drag and drop, see [Drag and drop](#drag-and-drop)                                            |
| dropDisabledCallback   | (draggendNode: Node, targetNode: Node) => Promise<boolean> or null | null    | function called when draging over new node, see [Drag and drop](#drag-and-drop)                       |
| useKeyboardNavigation  | bool                                                               | false   | enables keyboard navigation , see [Keyboard navigation](#keyboard-navigation)                         |
| logger                 | ((...data: any[]) => void) or null                                 | null    | function that acts as logger for tree, mostly used for debugging                                      |

## Selection

## Async loading

## Context menu

## Custom classes

## Drag and drop
> [!NOTE]  
> In memory drag and drop is not yet supported. Tree just dispatches `moved` event with dragged node(`node`), target node (`target`) and insertion type (`insertType`).
> In future, this package will export function, that will allow you to easily compute new tree on frontend.


## Keyboard navigation

Enable keyboard navigation by setting `useKeyboardNavigation` to true.

Use arrows to navigata tree. First you need to focus some node,
you can use `focusNode` to do that. Use Enter or Space to select checkbox.
