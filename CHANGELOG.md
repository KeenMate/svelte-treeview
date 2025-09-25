# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
