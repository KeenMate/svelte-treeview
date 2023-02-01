# Svelte Treeview


# API CHANGE IN DEV BRANCH, UDPATE README

The most elaborate treeview for svelte on earth (or even in our galaxy).  

[DEMO](https://dev.phoenix-svelte-adminlte.demo.keenmate.com/#/tree)

Table of Contents

- [Svelte Treeview](#svelte-treeview)
- [API CHANGE IN DEV BRANCH, UDPATE README](#api-change-in-dev-branch-udpate-readme)
  - [Props](#props)
  - [Events](#events)
  - [function on component](#function-on-component)
  - [Helper functions](#helper-functions)
  - [basic usage](#basic-usage)
  - [callbacks](#callbacks)
  - [selection](#selection)
  - [search](#search)
  - [drag and drop](#drag-and-drop)
  - [context menu](#context-menu)

## Props

- ***tree*** (array of nodes, default: *null*)
   tree itself.
- ***treeId*** (string, default: *null*)
  you HAVE to set this to unique string
- ***maxExpandedDepth*** (number, default: *3*)
- ***filteredTree*** (array of nodes, default: *null*)
   searched tree
- ***checkboxes*** (string "none"|"perNode"|"All", default: *false*)  
   When all checkboxes will be shown if **checkboxVisible** isnt false,whe perNode only nodes with **checkboxVisible** set to true will be shown. None will override **checkboxVisible** .When click on checkbox it will toggle selected on clicked node. You can specify this behavior with **recursive**, **leafNodeCheckboxesOnly** and **checkboxesDisabled**.
- ***recursive*** (bool, default: *false*)  
   When true, you can only select "leaf nodes" (nodes when **hasChildren** isnt true). When clicking other nodes, it will tooggle all children. Non leaf children will have wont have **selected**, instead, __visual_state will be calculated automatically ( all true => true, at least one true => indeterminate, all false => false).
- ***leafNodeCheckboxesOnly*** ( bool, default: *false*)  
   you wont be able to click on any other checkboxes that on leaf nodes.
- ***checkboxesDisabled*** (bool, default: *false*)  
   will only disable checkboxes, instead of not showing them.
- ***dragAndDrop*** (bool, default: *false*)  
   will enable drag and drop behavior viz drag and drop section
- ***timeToNest*** (number in ms, default: *null*)  
   after that time hovering over one node, it will nest.
- ***pixelNestTreshold*** (number in px, default: *150*)  
   when you move cursor to then left by x pixels will nest
- ***expandCallback*** (function that takes node as argument, default: *null*)  
    called when node with **useCallback** set to true is expanded. Only called once.
- ***showContexMenu*** (bool, default: false)  
   Will show context menu you defined in context-menu slot when you right click any node
- ***beforeMovedCallback*** (function with params: (movedNode,oldParent,TargetNode,insType: ("before","inside","after")), default: null )  
 Called when you droped node before any recalculation takes place. You can cancel move by returning false
- ***dragEnterCallback*** (function with params: (movedNode,oldParent,TargetNode), default: null )  
  Called when dragged nodes enters different node. By returnting false, it will set that node as nonvalid target so you wont be able to it and it doesnt show guide lines. Dont do any expensive operations here and dont modify tree.
- ***enableVerticalLines*** (bool, default: false)  
  This property controls if vertical lines are displayed in front of each node for easier use
- ***recalculateNodePath*** (bool,default: true)  
  If true, will not change last part of nodePath of moved node. Use this is=f last part of your nodePath is **unique!**.  
- ***expandedLevel*** (number,default:0)  
  will expand all nodes until this specific level(starting from 0). Set it to -1 to disable it. **expanded** has priority over this. It wont modify **expanded** on nodes so you can dynamicly change this and tree will rerender
- ***nodePath*** (string, default: *"nodePath"*)  
- ***hasChildren*** (string, default: *"hasChildren"*)  
- ***expanded*** (string, default: *"__expanded"*)  
- ***selected*** (string, default: *"__selected"*)  
- ***useCallback*** (string, default: *"__useCallback"*)  
- ***priority*** (string, default: *"__priority"*)  
- ***isDraggable*** (string, default: *"isDraggable"*)  
  when false, wont allow you to start dragging element
- ***insertDisabled*** (string, default: *"insertDisabled"*)  
  when true, you wont be able to drop element below are above nod. You still be able to nest it. When dragging over element it will always nest.
- ***nestDisabled*** (string, default: *"nestDisabled"*)  
  when true, wont be able to drop node inside (nest it)
- ***checkboxVisible*** (string, default: *"checkboxVisible"*)  
  modifies visibility of checkbox. When checkboxes are "none" wont show them event if this is true
- ***treeClass*** (string css class, default: *"treeview"*)  
  Setting this to anything else that default value will disable all styling so you can set everything yourself
- ***nodeClass*** (string css class, default: *""*)  
- ***expandedToggleClass*** (string css class, default: *""*)  
- ***collapsedToggleClass*** (string css class, default: *""*)  
- ***currentlyDraggedClass*** (string css class, default: *"currently-dragged"*)  
- ***expandClass*** (string css class, default: *"inserting-highlighted"*)  
- ***inserLineClass*** (string css class, default: *""*)  
- ***inserLineNestClass*** (string css class, default: *""*)  

## Events

- **expansion** { node: node,value: bool } = fired when user clicks on plus/minus icon
- **expanded** { node }
- **closed** { node }
- **moved**  { oldParent: Node,newParent:Node oldNode: Node, newNode: Node,targetNode: Node,insType: ("before","inside","after")} = fires when user moved node with drag and drop. Target is element you dropped node at.
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
- **mergeTrees(oldTree,addedTree,nodePath="nodePath")**  = will merge new tree into old one, so that expanded, etc. wont be reseted.

usage:

```js
import {TreeView,mergeTrees,searchTree} from "../index.js";
//will merger treeToAdd into tree, so expansion etc wont be effected
tree = mergeTrees(tree,treeToAdd);
//searches tree
filteredTree = searchTree(tree, filterFunction, recursive,propNames)
```

## basic usage

You need to provide treeId and tree, that is array of node where every node has nodepath defined. Parent nodes have to have hasChildren set to true. Next you have to set a default slot with how you want you nodes to be rendered.You can add your own props to nodes and used them here in  events, contextmenus and callbacks. Treeview uses **expanded** to determine expansion.

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

To dynamicly load data, you have to have hasChildren(to show + icon) and **useCallback** set to true on nodes you want to use callback on. Then expandCallback will be called with expanded node as parametr. Function should return Promise or array of nodes, that will be added to tree. **useCallback** will be then set to false, so that callback will only be called once.

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

After setting dragAndDrop to true, you will be able to change order of nodes and moving them between nodes by dragging.When **isDraggable** on node is set to false you wont be able to grab it. You can enable nesting by setting timeToNest of pixerNestTreshold. Node will be inserted as child of targeted note after *at least one* of tresholds is met. Before node will be moved, **beforeMovedCallback** fill be fired and if it returns false, move will be cancelled.
New id will be computed as biggest id of childred in targeted node +1 and new priority as 0 when nest or if not as priority of target +1. Then it recomputes all priorities so there wont be conficts. After this **moved** event will be fired with old parent, old node (copy of dragged node before changes to id, priority, etc.),new node (dragged node after changes), and target node (node you drop it at).
You can also customize line show when dragging by changing **inserLineNestClass** and **inserLineClass**

**dragEnterCallback** is called when you enter new node while dragging. If it return false, node wont be valid node location

TODO add note about insertDisabled and nestDisabled

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
