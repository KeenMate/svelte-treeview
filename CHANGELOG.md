# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [4.0.0-rc.06] - 2025-01-06

### Added
- **Customizable Scroll Highlight**: New `scrollHighlightClass` property allows users to define custom CSS classes for scroll highlight effects
- **Built-in Highlight Options**: Added pre-built highlight classes:
  - `ltree-scroll-highlight` - Background glow with blue color (default)  
  - `ltree-scroll-highlight-arrow` - Red arrow indicator positioned to the right of the node
- **Scroll Highlight Timeout Control**: New `scrollHighlightTimeout` property (default: 4000ms) controls duration of highlight effect
- **Enhanced scrollToPath Method**: Improved scroll highlighting with proper element targeting and CSS class management

### Changed
- **Removed CSS Animation Dependencies**: Scroll highlighting now uses pure CSS classes instead of CSS animations for better timeout control
- **Improved Element Targeting**: `scrollToPath` now targets `.ltree-node-content` specifically for more precise highlighting
- **Enhanced Documentation**: Updated README with comprehensive examples for highlight customization

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