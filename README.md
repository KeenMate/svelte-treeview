# Svelte Treeview

The most elaborate treeview for svelte on earth (or even in galaxy). 

## Props

 - **tree** (array of nodes, default: *null*)
 - **treeId** (string, default: *null*) = you HAVE to set this to unique string
 - **maxExpandedDepth** (number, default: *3*)
 - **filteredTree** (array of nodes, default: *null*)
 - **recursive** (bool, default: *false*)
 - **checkboxes** (bool, default: *false*)
 - **leafNodeCheckboxesOnly** ( bool, default: *false*)
 - **disableOrHide** (bool, default: *false*)
 - **dragAndDrop** (bool, default: *false*)
 - **nodePathProperty** (string, default: *"nodePath"*)
 - **hasChildrenProperty** (string, default: *"hasChildren"*)
 - **expandedProperty** (string, default: *"__expanded"*)
 - **selectedProperty** (string, default: *"__selected"*)
 - **usecallbackProperty** (string, default: *"__useCallback"*)
 - **priorityProperty** (string, default: *"__priority"*)
 - **treeClass** (string css class, default: *""*)
 - **nodeClass** (string css class, default: *""*)
 - **expandedToggleClass** (string css class, default: *""*)
 - **collapsedToggleClass** (string css class, default: *""*)
 - **expandClass** (string css class, default: *"inserting-highlighted"*)
 - **inserLineClass** (string css class, default: *""*)
 - **inserLineNestClass** (string css class, default: *""*)
 - **timeToNest** (number in ms, default: *null*)
 - **pixelNestTreshold** (number in px, default: *150*)
 - **expandCallback** (function that takes node as argument, default: *null*)
 - **showContexMenu** (bool, default: false)
 - **beforeMovedCallback** (function with params: (movedNode,oldParent,TargetNode,Nesting), default: null ) = if it return false, move will be cancelled
 - **enableVerticalLines** (bool, default: false) = This property controls if vertical lines are displayed in front of each node for easier use 
 - **recalculateNodePath** (bool,default: false) = If true, will not change last part of nodePath of moved node. Use this is=f last part of your nodePath is **unique!**.  
 - **expandedLevel** (number,default:0) = will expand all nodes until this specific level(starting from 0). Will only effect nodes where you dont specify expansion.

## Events
- **expansion** { node: node,value: bool } = fired when user clicks on plus/minus icon
- **expanded** { node }
- **closed** { node }
- **moved**  { oldParent: Node, oldNode: Node, newNode: Node,targetNode: Node,nest: bool} = fires when user moved node with drag and drog 
- **selection** { node: node,value: bool }  = fired when user clicks on checkbox
- **selected** {node }
- **unselected** {node }

## function on component
you call them on binded component
- **changeAllExpansion(changeTo)** = changes expansionn status of every that hasChildren to value you specify

example:
```js
let thisTree


//...
<button on:click={thisTree.changeAllExpansion(true)} >expand All</button>
<button on:click={thisTree.changeAllExpansion(false)} >colapse All</button>

<TreeView
bind:this={thisTree}
	bind:tree
	treeId="tree"
	let:node
>
	{node.nodePath}
</TreeView>
```
## Helper functions
- **searchTree(tree, filterFunction, recursive,propNames)**  = function that will filter tree using filterFunction and adds all parent so that it can render. If recursive is true, it will only search through "lef nodes" (nodes that dont have children)
- **mergeTrees(oldTree,addedTree,nodePathProperty="nodePath")**  = will merge new tree into old one, so that expanded, etc. wont be reseted.

usage:
```js 
import {TreeView,mergeTrees,searchTree} from "../index.js";
//will merger treeToAdd into tree, so expansion etc wont be effected
tree = mergeTrees(tree,treeToAdd);
//searches tree
filteredTree = searchTree(tree, filterFunction, recursive,propNames)
```
## basic usage

You need to provide treeId and tree, that is array of node where every node has nodepath defined. Parent nodes have to have hasChildren set to true. Next you have to set a default slot with how you want you nodes to be rendered.You can add your own props to nodes and used them here in  events, contextmenus and callbacks. Treeview uses **expandedProperty** to determine expansion.

example:

```js
import {TreeView} from "svelte-treeview"
let tree = [
  { nodePath: "1"},
  { nodePath: "2"},
  { nodePath: "3", hasChildren: true},
  { nodePath: "3.1"},
  { nodePath: "3.2", hasChildren: true},
  { nodePath: "3.2.1"},
  { nodePath: "3.2.2"},
  { nodePath: "3.2.3" },
  { nodePath: "3.2.4"},
  { nodePath: "3.3"}
]
//...

<TreeView
	bind:tree
	treeId="tree"
	let:node
>
	{node.nodePath}
</TreeView>

```

## callbacks

To dynamicly load data, you have to have hasChildren(to show + icon) and **usecallbackProperty** set to true on nodes you want to use callback on. Then expandCallback will be called with expanded node as parametr. Function should return Promise or array of nodes, that will be added to tree. **usecallbackProperty** will be then set to false, so that callback will only be called once.

example:
```js
let tree = [
  { nodePath: "1",__useCallback: true,},
  { nodePath: "2",__useCallback: true,},
  { nodePath: "3", hasChildren: true},
  { nodePath: "3.1"},
  { nodePath: "3.2", hasChildren: true},
  { nodePath: "3.2.1"},
  { nodePath: "3.2.2"},
  { nodePath: "3.2.3" },
  { nodePath: "3.2.4"},
  { nodePath: "3.3",__useCallback: true,}
]
let num =0
//...
<TreeView
	bind:tree
	treeId="tree"
	let:node
	expandCallback={(n) => {
    return [ 
			{nodePath: n.nodePath + "." + ++num,
				__useCallback: true,hasChildren: true,}
      ]
  }}
>
	{node.nodePath}

</TreeView>

```

## selection

## search

## drag and drop

After setting dragAndDrop to true, you will be able to change order of nodes and moving them between nodes by dragging. You can enable nesting by setting timeToNest of pixerNestTreshold. Node will be inserted as child of targeted note after *at least one* of tresholds is met. Before node will be moved, **beforeMovedCallback** fill be fired and if it returns false, move will be cancelled.    
New id will be computed as biggest id of childred in targeted node +1 and new priority as 0 when nest or if not as priority of target +1. Then it recomputes all priorities so there wont be conficts. After this **moved** event will be fired with old parent, old node (copy of dragged node before changes to id, priority, etc.),new node (dragged node after changes), and target node (node you drop it at).    
You can also customize line show when dragging by changing **inserLineNestClass** and **inserLineClass** 

## context menu

To enable context menu you first need to add your desired context menu to slot named context-menu. you can accest clicked node with let:node. You can use MenuDivider and MenuOption from this package to easy creation of ctxmenu.Then just set **showContexMenu** to true and context menu will now be showen when you right click on node.

example:
```js

<TreeView
//...
showContexMenu 
//...
>
//...
<svelte:fragment slot="context-menu" let:node>
  <MenuOption text={node.nodePath} isDisabled />
  <MenuDivider />
  <MenuOption text="do stuff" on:click={(node) => doStuff(node)} />
</svelte:fragment>
<TreeView>
```

