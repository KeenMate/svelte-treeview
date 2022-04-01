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

## Events
- expansion { path: nodePath,value: bool } = fired when user clicks on plus/minus icon
- expanded { path: nodePath }
- closed { path: nodePath }
- moved  { moved: nodePath, to: nodePath } = fires when user moved node with drag and drog
- selection { path: nodePath,value: bool }  = fired when user clicks on checkbox
- selected { path: nodePath }
- unselected { path: nodePath }