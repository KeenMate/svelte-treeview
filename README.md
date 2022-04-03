# Svelte Treeview

customizable svelte component for treeview

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
 - **treeCssClass** (string css class, default: *""*)
 - **nodeCssClass** (string css class, default: *""*)
 - **expandedToggleCss** (string css class, default: *""*)
 - **collapsedToggleCss** (string css class, default: *""*)
 - **expandClass** (string css class, default: *"inserting-highlighted"*)
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

## drag and drop
TODO: add some example 

## context menu

To enable context menu you first need to add your desired context menu to slot named context-menu. you can accest clicked node with let:node. You can use MenuDivider and MenuOption from this package to easy creation of ctxmenu. Set showContexMenu to true and context menu will now show when you right click on node.

example:
```js
	<svelte:fragment slot="context-menu" let:node>
		<MenuOption text={node.nodePath} isDisabled />
		<MenuDivider />
		<MenuOption text="do stuff" on:click={doStuff(node))} />
	</svelte:fragment>

```

