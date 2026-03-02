# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.8.0] - Unreleased

### Added
- **Virtual Scroll rendering mode**: Third rendering mode alongside recursive and progressive flat. Only renders visible nodes plus configurable overscan — handles 50,000+ nodes without DOM bloat. New props: `virtualScroll`, `virtualRowHeight`, `virtualOverscan`, `virtualContainerHeight`
- **Search bar with result navigation**: Dual-mode filter/search with result counter, prev/next navigation, Enter/Shift+Enter/Escape keyboard shortcuts, and round-robin cycling through matches
- **`scrollToPath` retry logic for virtual scroll**: Shared highlight helper with retry mechanism for virtual scroll timing — fixes ~40% of missing highlights when DOM wasn't yet rendered after scroll
- **`searchNodes()` public method**: Search the internal index and return matching nodes programmatically

### Changed
- **Floating drop zones auto-expand when positions are restricted**: When a node disallows certain drop positions (e.g. no "child" on a file), the remaining floating zones now expand to fill the available space instead of leaving a visible gap. Uses CSS `:not(:has())` selectors to detect which zone elements are absent from the DOM — no JavaScript overhead. Supports all horizontal layouts: "around" (bottom row expands), "above" and "below" (zones split into halves or full width depending on how many are visible), with correct border-radius adjustments
- **Drag and Drop Disabled by Default**: `dragDropMode` now defaults to `'none'` instead of `'both'`. Most trees are read-only, so this is a safer default. To enable drag and drop, explicitly set `dragDropMode="both"` (or `"self"` / `"cross"`)
- **`dropZoneStart` now controls glow mode child threshold**: Previously glow mode used a hardcoded 50% (`width / 2`) to determine when to snap to the "child" drop position. Now it uses the same `dropZoneStart` prop as floating mode, accepting both percentage and pixel values
- **Unified visual rendering across all three modes** (recursive, progressive, virtual):
  - All modes now use the same `--tree-node-indent-per-level` CSS variable for indentation
  - Removed `flatIndentSize` prop — no longer needed since both modes share the same CSS variable
  - Inter-node gaps now match exactly between modes (2px only at parent→first-child boundaries)
  - Removed `will-change: transform` from virtual scroll container (caused sub-pixel rendering shift)

### Fixed
- **Cross-tree `copyNodeWithDescendants` ignoring drop position**: The `Tree.svelte` exported `copyNodeWithDescendants()` wrapper only forwarded 3 of 5 parameters (`sourceNode`, `targetParentPath`, `transformData`) to the underlying ltree method — the `siblingPath` and `position` parameters were silently dropped. This caused cross-tree drag-and-drop to always append nodes at the end regardless of where the user dropped them (above/below a sibling). Same-tree drops were unaffected because the internal `_handleDrop` calls the ltree method directly, bypassing the wrapper. The fix adds the missing `siblingPath` and `position` parameters to the exported wrapper and forwards them through
- **`treeId` becoming undefined on prop changes**: Auto-generated `treeId` was lost when parent re-rendered with spread props, causing `scrollToPath` and DOM ID lookups to fail. Now uses stable fallback via `$effect.pre`
- **Empty tree drop placeholder ignoring `dragDropMode`**: The empty tree placeholder accepted drops even when `dragDropMode` was `'none'`, `'self'`, or `'cross'`. Now respects the mode setting consistently
- **Sort order mismatch between rendering modes**: `visibleFlatNodes` had inverted sort logic compared to recursive mode
- **Drag-drop example missing `dragDropMode`**: Added `dragDropMode="both"` to all trees in the drag-drop example page (required since default changed to `'none'`)
- **Tree-editor example missing `dragDropMode`**: Added `dragDropMode="both"` to tree-editor example (same issue as drag-drop page)
- **`updateNode` not triggering re-render in flat mode**: Flat/progressive rendering didn't pick up per-node updates
- **`bodyClass` prop not applying custom class name** (#24)
- Removed development `console.log` statements from `Tree.svelte` and `ltree.svelte.ts`

### Examples
- **Search example**: Added filter/search mode toggle (funnel vs magnifying glass icon) matching the performance page pattern
- **Tree-editor example**: Added `type` field to node data and display node type behind each node title
- **Shared CSS**: Moved search bar and `kbd` styles to `examples-shared.css` for reuse across all example pages

## [4.7.0] - 2026-02-11

### Added
- **Per-Node Drop Position Restrictions**: New feature to control which drop positions are allowed per node
  - `allowedDropPositionsMember` - Property name mapping for static data (e.g., from server)
  - `getAllowedDropPositionsCallback` - Callback for dynamic position logic based on node type
  - `DropPosition` type exported: `'above' | 'below' | 'child'`
  - Example use cases:
    - Trash folder: `['child']` only (can drop INTO, not above/below)
    - Files: `['above', 'below']` only (can't drop INTO a file)
    - Folders: `undefined` or `[]` (all positions allowed - default)
  - Works with both glow mode (snaps to nearest allowed position) and floating mode (only shows allowed zones)
  - Backwards compatible: `undefined`/empty array = all positions allowed

### Example Usage
```typescript
// Callback approach (dynamic logic)
function getAllowedDropPositionsCallback(node: LTreeNode<T>): DropPosition[] | null {
  if (node.data?.type === 'file') return ['above', 'below'];
  if (node.data?.type === 'trash') return ['child'];
  return undefined; // all positions allowed
}

// Member approach (server data)
const data = [
  { path: '1', name: 'Trash', allowedDropPositions: ['child'] },
  { path: '2', name: 'Document.pdf', allowedDropPositions: ['above', 'below'] },
  { path: '3', name: 'Projects' }, // all positions (default)
];
```

## [4.6.0] - 2026-02-11

### Added
- **Flat Rendering Mode**: New `useFlatRendering` prop (default: `true`) for significantly faster rendering
  - Renders all visible nodes in a single `{#each}` loop instead of recursive components
  - Initial render ~12x faster (300ms → 25ms for 5500 nodes)
  - Progressive rendering batches initial load to prevent UI freeze
  - Documentation: `docs/FLAT_MODE_PERFORMANCE.md`
- **Context-Based Node Configuration**: Moved stable callbacks and config to Svelte context
  - `NodeCallbacks<T>` interface for all event handlers (click, drag, drop, touch)
  - `NodeConfig` interface for stable configuration (icons, classes, drop zone settings)
  - Eliminates inline arrow function re-renders (5500 nodes no longer re-evaluate on array changes)
  - Exported types: `NodeCallbacks`, `NodeConfig` from package index
- **Async beforeDropCallback**: `beforeDropCallback` now supports async/Promise return values
  - Enables showing confirmation dialogs before completing a drop
  - Can await user input to decide whether to cancel, proceed, or modify the drop
  - Example: `async (dropNode, draggedNode, position) => { return await showDialog(); }`

### Enhanced
- **Exponential Batch Sizing**: Progressive rendering now uses exponential batching (20 → 40 → 80 → 160...)
  - First batch (20 nodes) renders instantly for immediate visual feedback
  - Batch size doubles each frame up to `maxBatchSize` (default 500)
  - New props: `initialBatchSize` (default 20), `maxBatchSize` (default 500)
  - Replaces fixed `renderBatchSize` prop
  - Expand/collapse on large trees (>1000 nodes): Immediate add to minimize diffs
- **Tree Editor Example**: Enhanced with async drop validation dialog
  - Demonstrates async `beforeDropCallback` with native confirm dialog
  - Shows warning when drop position is modified

### Fixed
- **Scroll Highlight Stacking**: Fixed multiple nodes staying highlighted when rapidly clicking prev/next
  - Previous highlight now immediately cleared when navigating to new node
  - Timeout properly cancelled to prevent stale highlight removal
- **Flat Mode Node Updates After Move**: Fixed nodes not re-rendering after `moveNode()` in flat mode
  - Keyed each now uses `node.id + path + hasChildren` to detect moved nodes
  - Moved nodes now correctly update their indentation level
  - Parent nodes correctly update toggle icon when children are moved away

### Changed
- **Default Rendering Mode**: `useFlatRendering` now defaults to `true` (was `false`)
- **Default Progressive Render**: `progressiveRender` now defaults to `true` (was `false`)

## [4.5.0] - 2026-02-09

### Added
- **Drop Zone Layout Configuration**: New props to customize drop zone appearance and positioning
  - `dropZoneLayout` - Controls zone arrangement with 5 layout options:
    - `'around'` (default) - Above zone on top, Below/Child zones on bottom
    - `'above'` - All 3 zones in a horizontal row above the node
    - `'below'` - All 3 zones in a horizontal row below the node
    - `'wave'` - Zones stacked vertically (above/child/below) with fixed width
    - `'wave2'` - Diagonal wave pattern with Above/Below offset 7% to the left
  - `dropZoneStart` - Number (0-100) controlling where zones start horizontally (default: 33%)
  - `dropZoneMaxWidth` - Max width in pixels for wave layouts (default: 120px)
- **New TypeScript Type**: `DropZoneLayout` type exported from `types.ts`
- **Mobile Touch Drag and Drop**: Full touch support for drag and drop on mobile devices
  - Long-press (300ms) to initiate drag - distinguishes from tap and scroll
  - Visual ghost element follows finger during drag showing the dragged node
  - Drop target highlighting using existing `dragOverNodeClass` prop
  - Haptic feedback via `navigator.vibrate()` when drag starts (on supported devices)
  - Automatic cancellation if finger moves >10px before long-press completes (allows normal scrolling)
  - Works alongside existing desktop HTML5 drag and drop - same `onNodeDrop` callback for both
- **Drop Placeholder for Empty Trees**: When dragging nodes to an empty tree, a drop zone placeholder appears
  - Shows visual drop target in empty trees during drag operations
  - Works with both desktop (HTML5 DnD) and touch drag
  - Customizable via `dropPlaceholder` snippet prop for custom content
  - `onNodeDrop` callback receives `null` as `dropNode` for root-level drops into empty trees
- **Drop Position Indicators**: Visual indicators showing exactly where dropped items will be placed
  - Three drop positions per node: `'above'` (sibling before), `'child'` (as child), `'below'` (sibling after)
  - Absolutely positioned indicators on right half of node to prevent layout shifts
  - Position calculated from mouse Y: top 25% = above, middle 50% = child, bottom 25% = below
  - New CSS classes: `.ltree-drop-indicators`, `.ltree-drop-above`, `.ltree-drop-child`, `.ltree-drop-below`
- **Root Drop Zone**: Drop zone that appears at bottom of non-empty trees during drag
  - Allows dropping items as root-level nodes in trees that already have content
  - New CSS class: `.ltree-root-drop-zone`
- **Drag Drop Mode Control**: New `dragDropMode` prop to control allowed drag operations
  - `'none'` - Drag and drop disabled
  - `'self'` - Only within same tree
  - `'cross'` - Only between different trees
  - `'both'` - Both self and cross-tree (default)
- **Sibling Order Support**: New `orderMember` prop for explicit sibling ordering
  - Specifies which field in user data contains the sort order value
  - Used by default sort to order siblings within the same parent
  - Required for proper above/below positioning in drag-drop tree editors
  - Example: `orderMember="sortOrder"` with data like `{ path: '1.1', name: 'A', sortOrder: 10 }`
- **Tree Editor Helper Methods**: New methods for building tree editors
  - `getChildren(parentPath)` - Get direct children of a node
  - `getSiblings(path)` - Get all siblings of a node (including itself)
  - `getNodeByPath(path)` - Get a node by its path
  - `refreshSiblings(parentPath)` - Re-sort children of a parent using orderMember
  - `refreshNode(path)` - Trigger re-render for a specific node
- **Tree Editor Mutation Methods**: New methods for modifying tree structure
  - `addNode(parentPath, data, pathSegment?)` - Add a new node to the tree
  - `moveNode(sourcePath, targetPath, position)` - Move a node with full subtree to a new location
    - Supports 'above', 'below', and 'child' positions
    - Automatically updates paths of all descendants
    - Calculates order values when orderMember is set
  - `removeNode(path, includeDescendants?)` - Remove a node from the tree
- **Example Pages**: New `/examples` route with interactive demos (same look-and-feel as web-multiselect)
  - Landing page with feature cards linking to 7 example sections
  - Basic Examples: tree rendering, expand level control, scroll to path, programmatic expand/collapse
  - Drag & Drop: two-tree drag demo, touch drag instructions, drop placeholder customization
  - Context Menu: callback-based menus, dynamic items, icons, disabled states, dividers
  - Search & Filter: live filtering with `searchText`, `searchNodes()` query method
  - Theming: CSS variable reference, theme examples (default, purple, dark, green)
  - Data Structures: path-based hierarchy, custom separators, insert result validation
  - Tree Editor: add/move/remove nodes with drag-drop and orderMember support
- **Drop Indicator Arrows**: Visual arrow indicators for glow-mode drop zones
  - Arrows positioned at 66% of row width, centered vertically
  - Uses Lucide SVG icons as data URIs: `arrow-big-up`, `arrow-big-down`, `arrow-big-right-dash`
  - Child arrow rotated 45° for diagonal pointing effect
  - Fully customizable via SCSS variables
- **Ctrl+Drag Copy Operation**: Full support for copying nodes via Ctrl+drag
  - `allowCopy` prop enables Ctrl+drag to copy instead of move
  - `autoHandleCopy` prop (default: true) controls whether Tree auto-handles same-tree copies
    - `true`: Tree creates copy with generated ID (`{id}_copy_{timestamp}`) - good for batch/offline mode
    - `false`: User callback handles copy (for DB/API integration) - good for online/live mode
  - Copy operations respect drop position (above/below/child) just like moves
  - Visual feedback: `.ltree-drop-copy` class applied during copy operations
- **Position Support for copyNodeWithDescendants**: Enhanced copy method now supports sibling positioning
  - New optional parameters: `siblingPath` and `position` ('above' | 'below')
  - Copies can be placed at specific positions relative to siblings
  - Uses same `orderMember` logic as `moveNode` for consistent ordering
- **Logging Infrastructure**: Categorized logging using vendored loglevel library
  - Six log categories: `LTREE:INIT`, `LTREE:DATA`, `LTREE:RENDER`, `LTREE:INDEX`, `LTREE:DRAG`, `LTREE:UI`
  - Color-coded console output with timestamps for easy debugging
  - Disabled by default (silent mode) for production
  - Exported utilities: `enableLogging()`, `disableLogging()`, `setLogLevel()`, `setCategoryLevel()`
  - UI logging: node clicks, expand/collapse, selection changes, context menu
  - Drag logging: drag start/end, drop operations, touch drag events
  - Render logging: progressive rendering frame stats
  - Index logging: async search indexing progress
  - New `/dev/logging` demo page for testing log levels and categories
- **Performance Logging**: Dedicated performance measurement utilities
  - Measures key operations: `insertArray` (conversion/sort/insert phases), `filterNodes`, `expandAll`, `collapseAll`
  - Output includes duration, item count, per-item time, and items/sec throughput
  - Summary view showing breakdown by phase with percentages
  - Configurable threshold to only log operations slower than X ms
  - Exported utilities: `enablePerfLogging()`, `disablePerfLogging()`, `setPerfThreshold(ms)`
  - Browser console access: `window.components['svelte-treeview'].perf.enable()`
  - Purple color-coded output for easy identification
- **Global Runtime API**: `window.components['svelte-treeview']` for browser console access
  - `config` - Package info (name, version, author, license, repository, homepage) read from package.json at build time
  - `version()` - Returns current version string
  - `logging.enableLogging()` / `logging.disableLogging()` - Toggle all logging
  - `logging.setLogLevel(level)` - Set level for all categories
  - `logging.setCategoryLevel(category, level)` - Set level for specific category
  - `logging.getCategories()` - List available log categories
- **Container-Scoped Scrolling**: New `containerScroll` option for `scrollToPath()`
  - `scrollToPath(path, { containerScroll: true })` scrolls only within the nearest scrollable ancestor
  - Prevents page-level scrolling when tree is inside a scrollable container
  - Automatically finds the scrollable parent element (overflow: auto/scroll)
  - Useful for search result navigation without disrupting page position

### Enhanced
- **Drop Zone Styling**: Improved visual feedback during drag operations
  - Semi-transparent zones (0.25 opacity) that become solid (0.85) when hovered
  - Modern pastel color palette: sage green for Above, peach/coral for Below, lavender for Child
  - Interactive controls in `/examples/drag-drop` to test all layout configurations
- **Drop Zone SCSS Variables**: Full customization of drop zone appearance via SCSS variables
  - `$drop-zone-border-radius` - Border radius for all zones (default: 0)
  - Per-zone variables for backgrounds, colors, and shadows in both inactive and active states:
    - Above: `$drop-zone-above-bg`, `$drop-zone-above-color`, `$drop-zone-above-active-bg`, `$drop-zone-above-active-color`, `$drop-zone-above-active-shadow`
    - Below: `$drop-zone-below-bg`, `$drop-zone-below-color`, `$drop-zone-below-active-bg`, `$drop-zone-below-active-color`, `$drop-zone-below-active-shadow`
    - Child: `$drop-zone-child-bg`, `$drop-zone-child-color`, `$drop-zone-child-active-bg`, `$drop-zone-child-active-color`, `$drop-zone-child-active-shadow`
- **Drop Zone Positioning**: Moved drop zones from inside `.ltree-node-content` to `.ltree-node-row` level
  - Eliminates padding-related gaps that made zones hard to reach
  - More predictable positioning relative to the full row width
- **Wave2 Layout Overlap**: Added 10% overlap for Above/Below zones in wave2 layout
  - Ensures first node's Above zone and last node's Below zone are always reachable
  - Child zone shrunk to 80% height to accommodate overlap without zone collision
- **dropZoneStart Flexibility**: Now accepts both number (percentage) and string (any CSS value)
  - Number: treated as percentage (e.g., `33` → `33%`)
  - String: used as-is (e.g., `"33%"`, `"50px"`, `"3rem"`)
- **Touch UX**: Added CSS properties to prevent text selection during touch drag
  - `-webkit-user-select: none` and `-webkit-touch-callout: none` on node content
- **Ghost Element Styling**: New `.ltree-touch-ghost` CSS class with customizable CSS variables
  - `--tree-ghost-bg`: Background color (default: rgba(59, 130, 246, 0.9))
  - `--tree-ghost-color`: Text color (default: white)
- **Drop Placeholder Styling**: New `.ltree-drop-placeholder` and `.ltree-drop-placeholder-content` CSS classes
- **Drop Indicator Arrow SCSS Variables**: Full customization of arrow indicators via SCSS variables
  - `$drop-arrow-above`, `$drop-arrow-below`, `$drop-arrow-child` - SVG data URIs for each direction
  - `$drop-arrow-size` - Arrow size (default: 24px)
  - `$drop-arrow-position` - Horizontal position within row (default: 66%)
  - `$drop-arrow-above-rotation`, `$drop-arrow-below-rotation`, `$drop-arrow-child-rotation` - Rotation angles
- **Search Example Page Redesign**: Merged filter and search cards into unified search experience
  - Single search input with live filtering and result navigation
  - Prev/Next buttons to traverse search results with wrap-around
  - Result counter showing "X of Y" position indicator
  - Keyboard navigation: Enter = next result, Shift+Enter = previous
  - Clickable result list with active item highlighting
  - Auto-scroll to first result when searching

### Fixed
- **Empty Tree Drop Placeholder**: Fixed drop placeholder not appearing when dragging to empty trees
  - Added missing `ondragenter` handler to empty state divs
  - Added `min-height: 60px` to `.ltree-empty-state` to ensure drop target is always reachable
- **Drag-Drop Demo ID/Path Mismatch**: Fixed bug where second node drop to first node didn't work on first try
  - Root cause: `nextId++` post-increment caused id and path to use different values
  - Fixed by extracting `const itemId = nextId++` before using in object properties
- **Tree Data Reset**: Fixed `insertArray` not clearing existing tree data when called with new/empty data
  - Previously, setting `data = []` would not clear the tree - existing nodes remained visible
  - Now `insertArray` properly resets root children, nodeCount, and maxLevel before inserting
- **Example Pages Data Insertion**: Added `isSorted={true}` to all example page Tree components
  - Prevents "Could not find parent node" errors caused by `sortCallback` sorting data before insertion
  - When `sortCallback` alphabetizes data, children could be inserted before parents (e.g., "AuthService" before "Services")
  - `isSorted={true}` tells the tree to skip pre-sorting and only use `sortCallback` for display ordering
- **Search Example Async Index**: Added note explaining that search index is built asynchronously
  - Added Enter key support for better UX when retrying searches
  - Users are now informed to wait a moment if no results appear immediately after page load
- **Search Example Reactivity**: Made "Search Nodes (Query)" input reactive
  - Added `$effect` to automatically trigger search when input changes
- **Glow Mode Border Radius**: Fixed border-radius appearing on glow drop indicators during drag
  - Changed `$tree-node-content-border-radius` default from `4px` to `0`
- **Search Example Documentation**: Fixed incorrect prop name in search configuration table
  - Changed `searchValueCallback` → `getSearchValueCallback` (correct prop name)
  - Fixed callback signature from `(item: T) => string` to `(node: LTreeNode<T>) => string`
- **LTreeNode Type Export**: Added `LTreeNode` re-export from `types.ts`
  - Fixes import errors when using `import type { LTreeNode } from '$lib/ltree/types'`
- **Search Example Endless Loop**: Fixed `$effect` causing infinite loop on search
  - Used Svelte's `untrack()` to prevent reactive state updates from re-triggering the effect
  - Effect now only reacts to `searchText` changes, not internal state mutations
- **Search Example Container Scroll**: Fixed prev/next navigation scrolling the entire page
  - Now uses `scrollToPath(path, { containerScroll: true })` for container-scoped scrolling
- **Critical Performance Bug in insertArray**: Fixed O(n²) algorithm causing 85+ second load times
  - Progressive render check was iterating all remaining nodes for every node at expandLevel
  - With 17,000 nodes this caused ~145 million iterations instead of ~34,000
  - Fix: Pre-compute last expandLevel index once, then use simple index comparison
  - Result: Load time reduced from 85+ seconds to under 1 second
- **Global API Constants**: Fixed `__PACKAGE_NAME__ is not defined` error when using library in other projects
  - Vite `define` constants only work during dev, not when library is built with `svelte-package`
  - Added `scripts/generate-constants.js` to bake package.json values into `constants.generated.ts`

### Important - Svelte 5 Performance

**Use `$state.raw()` for large datasets passed to Tree component**

When passing large arrays (1000+ items) to the Tree component, use `$state.raw()` instead of `$state()` to avoid severe performance degradation:

```typescript
// SLOW - Svelte deeply proxies all 8000+ objects, causing 5000x slowdown
let treeNodes = $state<TreeNode[]>([])
treeNodes = response.data  // Each item becomes a Proxy

// FAST - Array is reactive but items remain plain objects
let treeNodes = $state.raw<TreeNode[]>([])
treeNodes = response.data  // Items stay as plain objects
```

**Why this matters:**
- `$state()` creates deep proxies - every nested object becomes a Proxy
- Tree's `insertArray()` accesses multiple properties on each data item
- With 8000 items × ~10 property accesses = 80,000 proxy operations
- Proxy overhead: ~2.2ms per item vs ~0.0004ms for plain objects (5,500x slower)

**Symptoms of this issue:**
- Tree takes 15-90+ seconds to render with thousands of items
- Console shows `[Violation] 'message' handler took XXXXms`
- Same data loads instantly in isolated test environment

**The fix does NOT affect reactivity** - changes to `treeNodes` array itself still trigger updates. Only the individual items inside lose deep reactivity, which Tree doesn't need.
  - Build now runs `npm run generate-constants` before `svelte-package`
- **Glow Mode Border Radius**: Added `!important` to `border-radius: 0` on glow classes to ensure override
  - Removed `border-radius: 4px !important` from `.ltree-dragover-glow` class
  - Removed `border-radius` from `.ltree-node-content` transition to prevent animation glitch
- **Glow Mode Drop Validation**: Fixed glow showing on invalid drop targets
  - When `dragDropMode='cross'` prevents drops, glow no longer appears on hover
  - Cleared `hoveredNodeForDrop` state when drop validation fails
  - Debug logging for drop rejection now gated behind `shouldDisplayDebugInformation`
- **Glow Mode Border Radius Transition**: Fixed double border artifact on node hover during drag
  - Added `border-radius` to transition property for smooth animation
  - Eliminates visual conflict between base rounded corners and glow's straight corners
- **Ctrl+Drag dropEffect Timing**: Fixed copy operation failing with `dropEffect: none`
  - Root cause: Node's `ondragover` read stale `dropOperation` prop before Tree updated it
  - Fix: Node now reads `event.ctrlKey` directly to calculate dropEffect immediately
  - Also added dropEffect confirmation in `ondrop` handlers for spec compliance
- **Missing allowCopy Prop in Recursive Node**: Fixed `allowCopy` not being passed to child nodes
  - Caused Ctrl+drag to fail on non-root nodes since they defaulted to `allowCopy=false`
  - Added `{allowCopy}` to recursive Node component call

### Changed
- **BREAKING: onNodeDrop Signature**: Callback signature updated to include drop position
  - Before: `onNodeDrop?: (dropNode, draggedNode, event) => void`
  - After: `onNodeDrop?: (dropNode, draggedNode, position, event) => void`
  - `position` is `'above'`, `'below'`, or `'child'` indicating where item should be placed
  - `dropNode` can be `null` when dropping into empty tree or root drop zone

## [4.4.0] - 2025-10-02

### Added
- **External Update Method**: New `update()` method for programmatic prop updates from vanilla JavaScript
  - Allows external code to update component props without Svelte reactivity
  - Accepts partial object with any Tree props (excluding snippets/templates)
  - Useful for HTML/JavaScript integration and dynamic configuration
  - Example: `tree.update({ searchText: 'query', expandLevel: 3, data: newData })`

### Fixed
- **Search Functionality**: Fixed search filtering in context-menu dev page
  - Added missing `searchValueMember="name"` prop to enable proper search indexing
  - Search now correctly filters nodes by name instead of filtering everything out

### Changed
- **Code Cleanup**: Renamed internal "trie" references to "tree" for consistency
  - Updated variable names in Tree.svelte, Node.svelte, and ltree-demo.ts
  - Removed "trie" from package.json keywords
  - Improved code readability and naming consistency throughout codebase

## [4.3.1] - 2025-09-25

### Enhanced
- **Async Callback Support**: Context menu callbacks now fully support async operations
  - Updated `callback: () => void | Promise<void>` signature in `ContextMenuItem` interface
  - Added automatic error handling for async callbacks with try/catch wrapper
  - Menu item clicks properly await async operations before completing
  - Errors in async callbacks are logged to console for debugging
- **Robust Error Handling**: Async callback failures don't break menu functionality
  - Failed async operations are caught and logged automatically
  - Developers can implement custom error handling within their callbacks
  - Menu stays open on errors, allowing users to retry actions
- **Enhanced Dev Examples**: Added comprehensive async callback demonstrations
  - Copy action with simulated network delay
  - New folder creation with error simulation (20% failure rate)
  - Database backup with long-running operation simulation
  - Shows patterns for success/failure handling and conditional menu closing

### Documentation
- **Async Patterns**: Examples showing proper async callback implementation
- **Error Handling**: Best practices for managing async operation failures
- **Menu Control**: Demonstrated conditional closing based on operation success/failure

## [4.3.0] - 2025-09-25

### Added
- **Enhanced Context Menu Control**: Context menu callback now receives `closeMenuCallback` parameter for programmatic menu control
  - `contextMenuCallback?: (node: LTreeNode<T>, closeMenuCallback: () => void) => ContextMenuItem[]`
  - Developers can now control when/if context menu closes after menu item actions
  - Enables conditional closing patterns (e.g., don't close on cancel, only on success)
  - Public `closeContextMenu()` method exported for external control
- **Context Menu Item Styling**: New `className?: string` property in `ContextMenuItem` interface
  - Apply custom CSS classes to individual menu items for styling
  - Supports multiple classes (space-separated strings)
  - Example: `className: 'text-danger fw-bold'` for destructive actions
- **Enhanced Dev Examples**: Updated context menu examples to demonstrate new features
  - Conditional menu closing patterns for different action types
  - CSS class styling demonstrations with Bootstrap classes
  - Improved UX patterns showing when to close vs keep menu open

### Enhanced
- **Flexible Menu Behavior**: Context menu now supports various interaction patterns
  - Immediate close after action completion
  - Conditional close based on user confirmation
  - Persistent menu for multi-step operations
  - Custom styling per menu item type

## [4.2.1] - 2025-09-24

### Enhanced
- **Debug Context Menu Positioning**: Improved debug context menu to position relative to tree element instead of viewport
  - Debug menu now appears 200px right and 100px down from each tree's top-left corner
  - Supports multiple trees on same page with individual positioning
  - Enhanced debug logging to include tree ID and calculated position coordinates
  - Better for CSS development when tree is not at top-left of viewport
- **Debug Context Menu Robustness**: Enhanced debug mode to work with single-node trees
  - Uses second node when available, falls back to first node for single-node trees
  - More flexible node selection for debug menu display
  - Improved reliability for development scenarios

### Fixed
- **Debug Mode State Management**: Fixed context menu interference between debug mode and normal right-click menus
  - Added `isDebugMenuActive` state tracking to prevent debug logic from hiding user-triggered menus
  - Normal right-click context menus now work properly when debug mode is disabled
  - Proper cleanup of debug state when switching between modes
- **Debug Mode Requirements**: Relaxed debug context menu requirements to support edge cases
  - Changed minimum tree length requirement from `> 1` to `> 0` for better compatibility
  - Debug mode now works with any non-empty tree structure

## [4.2.0] - 2025-09-24

### Added
- **Context Menu System**: Comprehensive context menu functionality with two implementation approaches
  - **Callback-based Context Menus**: New `contextMenuCallback` prop that accepts a function `(node: LTreeNode<T>) => ContextMenuItem[]`
  - **ContextMenuItem Interface**: New interface with `icon`, `title`, `isDisabled`, `callback`, and `isDivider` properties
  - **Position Offset Configuration**: New `contextMenuXOffset` (default: 8px) and `contextMenuYOffset` (default: 0px) props for cursor clearance
  - **Debug Mode**: New `shouldDisplayContextMenuInDebugMode` prop for persistent context menu display at fixed position (200px, 100px)
  - **Snippet-based Support**: Maintains backward compatibility with existing `{#snippet contextMenu(node, closeMenu)}` approach
- **Enhanced Context Menu UX**:
  - Auto-close on scroll events (mouse wheel, scrollbar, touch, programmatic)
  - Auto-close on outside clicks
  - Support for disabled menu items with visual feedback
  - Support for menu dividers for visual organization
  - Rich icon support for menu items
- **Development Tools**: New `/dev/context-menu` page with comprehensive examples
  - Basic file system context menu example with conditional actions
  - Advanced server management example with status-based and type-specific menus
  - Real-time offset configuration testing
  - Interactive demonstration of all context menu features
  - Debug context menu mode with `shouldDisplayContextMenuInDebugMode` for easy styling development
  - Navigation link added to main layout for easy access

### Enhanced
- **CSS Styling**: Added comprehensive context menu styles in `main.scss`
  - `.ltree-context-menu`, `.ltree-context-menu-item`, `.ltree-context-menu-icon`, `.ltree-context-menu-divider` classes
  - Support for disabled states with `.ltree-context-menu-item-disabled`
  - Flexible layout with proper hover effects and visual hierarchy
- **Type Safety**: Full TypeScript support for all context menu features
- **Documentation**: Comprehensive README and CLAUDE.md updates covering both implementation approaches

### Fixed
- **Context Menu Scroll Behavior**: Fixed issue where context menu remained visible when scrolling
  - Added scroll event listeners with capture phase to catch all scroll events
  - Added wheel event listeners for mouse wheel scrolling
  - Context menu now properly closes on any scroll interaction

## [4.1.1] - 2025-09-23

### Fixed
- **TreePathSeparator Default Value**: Fixed `treePathSeparator` parameter to properly default to '.' when not provided to Tree.svelte
  - Previously, when `treePathSeparator` was undefined, the reactive effect would override the ltree's internal default
  - Now defaults to '.' in the parameter destructuring, ensuring consistent behavior

## [4.1.0] - 2025-09-23

### Fixed
- **Critical Sorting Bug**: Fixed default sort method to sort by level first, ensuring proper hierarchical tree construction
  - Previously sorted by parent path first, causing level 3 nodes to be inserted before level 2 nodes
  - Now sorts by level (depth) first, then parent path, then display value
  - Eliminates "Could not find parent node" errors when nodes are inserted out of level order
- **Progressive Rendering**: Fixed progressive rendering feature to work correctly with proper level-based sorting
  - Progressive rendering now displays levels 1-2 immediately while deeper levels continue processing
  - Improves perceived performance for large datasets by showing initial tree structure quickly
- **TreePathSeparator Reactivity**: Fixed Tree component to properly update internal separator when `treePathSeparator` prop changes
  - Added reactive effect to update ltree's separator property when prop changes
  - Prevents race conditions where data is processed with wrong separator
  - Fixes filesystem demo and other custom separator use cases
- **Sort Functions in Examples**: Updated all demo sort functions to calculate level from path depth during sorting
  - Home page, dev page, and filesystem examples now use path-based level calculation
  - Ensures consistent level-first sorting across all demos and examples
  - Prevents insertion failures in example applications

### Enhanced
- **Test Coverage**: Added comprehensive test suite for sorting functionality
  - Tests verify level-first sorting behavior with various hierarchical data structures
  - Validates progressive rendering scenarios and sort correctness
  - Uses Vitest framework for fast, reliable testing

### Changed
- **Default Sort Algorithm**: Updated `_defaultSort` method to prioritize level over parent path for hierarchical correctness
- **Example Sort Functions**: All demo applications now use level-first sorting for consistent behavior

## [4.0.1] - 2025-01-23

### Fixed
- **treePathSeparator Propagation**: Fixed helper functions (`getParentPath`, `getRelativePath`, `getPathSegments`) to properly use the configured `treePathSeparator` instead of hardcoded "." separator
  - All path manipulation functions now respect the custom separator setting
  - Ensures consistent path handling throughout the tree operations when using custom separators like "/"
  - Fixed `getRelativePath` to use `pathSeparator.length` instead of assuming single character
  - Fixed `getLevel` to properly count segments with multi-character separators

### Added
- **Test Suite**: Added comprehensive test coverage for ltree helper functions
  - 24 test cases covering single-character, multi-character, and edge case separators
  - Vitest testing framework integration with `npm run test` and `make test` commands
  - Tests validate proper handling of separators like `"::"`, `"->>"`, `"<|>"` and complex edge cases

## [4.0.0] - 2025-01-09

### Added
- **Complete Showcase Site Redesign**: Comprehensive overhaul of the documentation and demo site
  - **API Reference Page**: Complete tabbed reference with properties, methods, events, and templates tables
  - **Professional Navigation**: Fixed-top navbar with burger menu, GitHub link, and responsive sidebar
  - **Ocean Color Scheme**: Beautiful blue-themed design using Coolors.co palette (#00171F, #003459, #007EA7, #00A7E1, #FFFFFF)
  - **Responsive Layout**: Mobile-first design with collapsible sidebar and backdrop overlay
  - **Enhanced Examples**: Four comprehensive code examples with descriptions in tabbed interface
- **Docker Production Setup**: Complete containerization for static site deployment
  - **Multi-stage Dockerfile**: Optimized build with Node.js builder and nginx production stage
  - **Static Site Generation**: SvelteKit configuration for pre-rendered HTML pages
  - **Make Commands**: Docker build, run, and management commands with custom registry support
  - **Nginx Configuration**: Optimized serving with gzip, caching, and SPA routing support

### Changed
- **Layout Architecture**: Moved from nested Bootstrap containers to clean, consistent structure
  - **Fixed Navigation**: Top navbar with brand, burger menu, and GitHub link
  - **Sidebar Design**: Fixed-width (280px) sidebar with consistent icon spacing
  - **Footer Integration**: Professional footer with KeenMate branding
- **SvelteKit Configuration**: Updated for optimal static generation
  - **Static Adapter**: Switched from adapter-auto to adapter-static for reliable builds
  - **Prerendering**: Enabled SSR and prerender for all showcase pages
  - **Build Output**: Optimized for nginx serving with proper fallback handling
- **Page Structure Consistency**: Standardized header structure across all showcase pages
  - **Removed Redundant Containers**: Eliminated nested container-fluid wrappers
  - **Clean Headers**: Direct h1 and description elements without Bootstrap grid overhead

### Enhanced
- **Visual Design**: Professional styling throughout the showcase site
  - **Fixed Icon Alignment**: Consistent 1.5rem width for sidebar navigation icons
  - **Gradient Backgrounds**: Sophisticated color gradients across navbar, sidebar, and footer
  - **Interactive Elements**: Hover effects, focus states, and smooth transitions
  - **Typography**: Clear hierarchy with proper contrast and accessibility
- **User Experience**: Improved navigation and usability
  - **Always-Visible Burger Menu**: Toggle sidebar on any screen size for flexible layout
  - **Responsive Behavior**: Automatic sidebar hiding on mobile with backdrop close
  - **Tab Navigation**: Full-width code examples with clean tab interface
  - **Mobile Optimization**: Touch-friendly interactions and responsive text sizing

### Fixed
- **Container Structure**: Resolved double-container issues causing layout inconsistencies
- **Sidebar Toggle**: Fixed burger menu functionality to work across all screen sizes
- **Static Generation**: Proper SvelteKit configuration for nginx-compatible static builds
- **Icon Spacing**: Consistent navigation icon width preventing text misalignment

### Documentation
- **API Reference**: Complete tables for all component properties, methods, events, and templates
- **Usage Examples**: Real-world code examples including organization tree configuration
- **Docker Documentation**: Make commands and containerization setup
- **Responsive Design**: Mobile-first approach with professional styling

## [4.0.0-rc.08] - 2025-01-08

### Added
- **searchNodes() Method**: New public method `searchNodes(searchText)` that returns an array of matching nodes without filtering the tree display
  - Programmatically search nodes using the internal search index
  - Returns `LTreeNode<T>[]` array of matching nodes
  - Useful for building custom search interfaces, suggestions, and result summaries
- **Configurable Path Separators**: New `treePathSeparator` property allows custom hierarchical path separators
  - Default remains `"."` for backward compatibility (e.g., "1.2.3")
  - Support for custom separators like `"/"` for file system style paths (e.g., "1/src/components")
  - All path operations throughout the component respect the custom separator
- **Data Structure Showcase Page**: New comprehensive `/data-structure` showcase page with four detailed sections:
  - **LTree Path Structure**: Understanding path-based hierarchical data model
  - **Optimized Data Structure**: Precomputed values for better performance
  - **Custom Path Separators**: Live demo with file system style paths using "/" separator
  - **External Search & Data Management**: Managing search outside the tree component
  - **Invalid Data Structures**: Common mistakes and unsupported patterns
- **Enhanced Search Showcase**: Added new `searchNodes()` method demonstration section to `/search` page
  - Interactive search interface showing difference between `searchNodes()` and `filterNodes()`
  - Live examples with result display and usage patterns
- **Insert Result Information**: New `insertResult` bindable property provides detailed information about data insertion
  - `InsertArrayResult<T>` interface with successful count and failed nodes array
  - Each failed node includes original data, processed node, and error message
  - Useful for data validation, debugging, and handling incomplete datasets
- **Drag-over Visual Feedback**: New `dragOverNodeClass` property for highlighting nodes during drag operations
  - Two built-in classes: `ltree-dragover-highlight` (dashed border) and `ltree-dragover-glow` (shadow effect)
  - Automatic state management with proper drag event handling
  - Provides clear visual feedback for drop targets during drag-and-drop operations

### Changed
- **Documentation Updates**: Updated README.md, CLAUDE.md, and showcase pages with new features
  - Added `searchNodes` to public methods documentation
  - Added `treePathSeparator` to Tree Configuration properties table
  - Updated architecture description to reflect configurable separators
  - Fixed path requirements documentation to clarify separator flexibility
- **Navigation Enhancement**: Added "Data Structure" page to sidebar navigation with 🗂️ icon

### Enhanced
- **Type System**: Updated `Ltree<T>` interface to include `searchNodes` method signature
- **Internal Architecture**: Enhanced `createLTree` function to accept configurable `treePathSeparator` parameter
- **Component Integration**: Updated `Tree.svelte` component to pass through `treePathSeparator` property

### Fixed
- **Node Indentation**: Fixed `Node.svelte` indent style to use consistent per-level indentation instead of cumulative indentation
  - Previously: Each level had exponentially increasing indent (level * indent-per-level)
  - Now: Each level uses fixed CSS variable `--tree-node-indent-per-level` allowing proper CSS-based indentation control
- **Search Index Accuracy**: Fixed `insertArray` to only add successfully inserted nodes to `flatTreeNodes` array
  - Prevents search index from returning incorrect node indices for nodes that failed to insert
  - Failed nodes are no longer included in search operations, ensuring search results match visible tree structure
- **Error Message Clarity**: Improved `insertTreeNode` error messages to include the failing node's path
  - Error format: `"Node: {path} - Could not find parent node: {parentPath}"`
  - Makes debugging hierarchical data issues much clearer

### Documentation
- **Comprehensive Examples**: Added working code examples for both basic and advanced use cases
- **Path Separator Flexibility**: Clarified that paths don't need to be dot-separated, can use any consistent separator
- **External Data Management**: Detailed examples of filtering data outside the tree component
- **Performance Optimization**: Guidelines for when to use precomputed values vs automatic calculations

## [4.0.0-rc.07] - 2025-01-06

### Added
- **Customizable Scroll Highlight**: New `scrollHighlightClass` property allows users to define custom CSS classes for scroll highlight effects
- **Built-in Highlight Options**: Added pre-built highlight classes:
  - `ltree-scroll-highlight` - Background glow with blue color (default)  
  - `ltree-scroll-highlight-arrow` - Red arrow indicator positioned to the right of the node
- **Scroll Highlight Timeout Control**: New `scrollHighlightTimeout` property (default: 4000ms) controls duration of highlight effect
- **Enhanced scrollToPath Method**: Improved scroll highlighting with proper element targeting and CSS class management
- **Debug Logging Control for Indexer**: Added `shouldDisplayDebugInformation` property to Indexer class for consistent debug logging control

### Changed
- **Removed CSS Animation Dependencies**: Scroll highlighting now uses pure CSS classes instead of CSS animations for better timeout control
- **Improved Element Targeting**: `scrollToPath` now targets `.ltree-node-content` specifically for more precise highlighting
- **Enhanced Documentation**: Updated README with comprehensive examples for highlight customization
- **Consistent Debug Logging**: All indexer console.log messages now respect the `shouldDisplayDebugInformation` flag for unified logging control

### Fixed
- **Scroll Highlight Duration**: Fixed issue where CSS animations overrode JavaScript timeout values
- **Element Selection**: Improved DOM element selection for scroll highlighting functionality
- **LTree Path Traversal**: Fixed `expandNodes` and `collapseNodes` methods by correctly prefixing path segments with 'x' prefix to match internal tree structure storage

## [4.0.0-rc.05] - 2025-09-05

### Added
- **Optimized Async Search Indexing**: Improved indexing implementation that processes entire queue at once during idle time instead of small batches
- **Enhanced Indexing Performance**: Increased batch size from 100 to 1000 nodes and streamlined queue processing
- **Better Debug Logging**: Added conditional debug logging for indexing operations when `shouldDisplayDebugInformation` is enabled

### Changed
- **Indexing Architecture**: Refactored async indexing to process all queued nodes in a single idle callback rather than batched processing
- **Queue Management**: Simplified indexing queue processing with more efficient completion handling
- **TypeScript Support**: Added `Tuple<T, U>` type import for enhanced type safety

### Performance
- **Faster Indexing**: Single-pass indexing of entire queue reduces overhead and callback scheduling
- **Reduced Idle Callbacks**: Less frequent but more efficient use of `requestIdleCallback`
- **Improved Memory Usage**: More efficient queue management with immediate processing

## [4.0.0] - 2025-09-01

### Added
- **Asynchronous Search Indexing**: Search indexing now uses `requestIdleCallback` for non-blocking performance
- **Statistics Tracking**: New `statistics` getter provides real-time data:
  - `nodeCount`: Total number of nodes in the tree
  - `maxLevel`: Maximum depth level of the tree
  - `filteredNodeCount`: Number of nodes currently visible when filtering
  - `isIndexing`: Boolean indicating if search indexing is in progress
  - `pendingIndexCount`: Number of nodes pending indexing
- **Expand Level Control**: New `expandLevel` property (default: 2) automatically expands nodes up to specified depth
- **Drag & Drop Properties**: Added `isDraggableMember` and `isDropAllowedMember` for fine-grained drag & drop control
- **Debug Information Panel**: Enhanced debug display with collapsible interface showing tree statistics and indexing progress

### Changed
- **Breaking**: Renamed internal references from "Trie" to "LTree" for consistency
- **Breaking**: `trieId` property renamed to `treeId`
- **Search Performance**: Tree now renders immediately while search indexing happens asynchronously
- **Debug Styling**: Updated debug panel styling to use `em` units with reduced padding

### Performance
- **Non-blocking UI**: Tree renders immediately while search indexing occurs during browser idle time
- **Improved Large Dataset Handling**: Async indexing prevents UI freezing with large data sets
- **Batch Processing**: Search indexing processes nodes in batches during idle periods
- **Graceful Degradation**: Falls back to `setTimeout` on browsers without `requestIdleCallback` support

### Documentation
- Added comprehensive documentation for async search indexing
- Added warning about search indexing requirements
- Enhanced API documentation with new properties and statistics
- Updated performance section highlighting async capabilities
