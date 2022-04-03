# Svelte Treeview

The most elaborate treeview for svelte on earth (or even in galaxy)
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
 - **expandedProperty** (string, default: *"__expanded"*)
 - **selectedProperty** (string, default: *"__selected"*)
 - **usecallbackPropery** (string, default: *"__useCallback"*)
 - **priorityPropery** (string, default: *"__priority"*)
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

## Events
- **expansion** { node: node,value: bool } = fired when user clicks on plus/minus icon
- **expanded** { node }
- **closed** { node }
- **moved**  { oldParent: Node, oldNode: Node, NewNode: Node,targetNode: Node,nest: bool} = fires when user moved node with drag and drog 
- **selection** { node: node,value: bool }  = fired when user clicks on checkbox
- **selected** {node }
- **unselected** {node }

## basic usage

You need to provide treeId and tree, that is array of node where every node has nodepath defined. Parent nodes have to have hasChildren set to true. Next you have to set a default slot with how you want you nodes to be rendered.You can add your own props to nodes and used them here in  events, contextmenus and callbacks. Treeview uses **expandedProperty** to determine expansion.

example:

```js
let tree = [
  { nodePath: "1"},
  { nodePath: "2"},
  { nodePath: "3" hasChildren: true},
  { nodePath: "3.1"},
  { nodePath: "3.2", hasChildren: true},
  { nodePath: "3.2.1"},
  { nodePath: "3.2.2"},
  { nodePath: "3.2.3" },
  { nodePath: "3.2.4"},
  { nodePath: "3.3"}
]
...

<TreeView
	bind:tree
	treeId="tree"
	let:node
>
	{node.nodePath}
</TreeView>

```

## callbacks

## selection

## drag and drop

After setting dragAndDrop to true, you will be able to change order of nodes and moving them between nodes by dragging. You can enable nesting by setting timeToNest of pixerNestTreshold. Node will be inserted as child of targeted note after *at least one* of tresholds is met. Before node will be moved, **beforeMovedCallback** fill be fired and if it returns false, move will be cancelled.    
New id will be computed as biggest id of childred in targeted node +1 and new priority as 0 when nest or if not as priority of target +1. Then it recomputes all priorities so there wont be conficts. After this **moved** event will be fired with old parent, old node (copy of dragged node before changes to id, priority, etc.),new node (dragged node after changes), and target node (node you drop it at).    
You can also customize line show when dragging by changing **inserLineNestClass** and **inserLineClass** 

## context menu

To enable context menu you first need to add your desired context menu to slot named context-menu. you can accest clicked node with let:node. You can use MenuDivider and MenuOption from this package to easy creation of ctxmenu.Then just set **showContexMenu** to true and context menu will now be showen when you right click on node.

example:
```js

<TreeView
...
>
...
<svelte:fragment slot="context-menu" let:node>
  <MenuOption text={node.nodePath} isDisabled />
  <MenuDivider />
  <MenuOption text="do stuff" on:click={(node) => doStuff(node)} />
</svelte:fragment>
<TreeView>
```

