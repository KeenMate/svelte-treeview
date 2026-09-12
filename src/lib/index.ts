// Reexport your entry components here
export {default as Tree} from "./components/Tree.svelte"
export {default as TreeProvider} from "./components/TreeProvider.svelte"
export {default as ContextMenuItemC} from "./components/ContextMenuItem.svelte"
export {default as ContextMenuDividerC} from "./components/ContextMenuDivider.svelte"

// Core layer (headless controller)
export { TreeController } from "./core/TreeController.svelte"
export type { TreeControllerProps, PasteResult, NodeTransformContext, BeforePasteContext, BeforeCopyContext, BeforeDeleteContext, NodeRef, NodeEventContext, NodeDragContext, DragStartContext, BeforeDropContext, DropGroup, NodeDropContext, ClipboardEventContext, SelectionChangeContext } from "./core/TreeController.svelte"
export { createTreeController } from "./core/createTreeController.js"

// Export types
export type { LTreeNode, NodeId, VisualState } from "./ltree/ltree-node.svelte"
export type { Ltree, DropPosition, DragDropMode, DropOperation, ToggleIconMode, IconSet, NodeTitleOverflow, ClickBehavior, CheckboxMode, CascadeSelectPolicy, SelectionMode, HighlightMode, TreeMutationOptions, ContextMenuItem, ContextMenuDivider, ContextMenuEntry, InsertArrayResult, InsertBranchResult, DeleteBranchResult, TreeChange, ApplyChangesResult } from "./ltree/types.js"

// Clipboard types & utilities
export type { ClipboardEntry, TreeClipboard } from "./core/clipboard.js"
export { setClipboard, getClipboard, clearClipboard, hasClipboard, getClipboardOperation, uniqueName } from "./core/clipboard.js"
export type { TreeNavigation, TreeNavigationOverrides } from "./core/navigation.js"
export type { RenderStats } from "./components/RenderCoordinator.svelte"
export type { NodeCallbacks, NodeConfig, SelectionModifiers } from "./core/TreeController.svelte"

// Export logging utilities
export { enableLogging, disableLogging, setLogLevel, setCategoryLevel, LOGGING_CATEGORIES } from "./logger.js"

// Export performance logging utilities
export {
    enablePerfLogging,
    disablePerfLogging,
    setPerfThreshold,
    isPerfLoggingEnabled,
    perfStart,
    perfEnd,
    perfMeasure,
    perfSummary
} from "./perf-logger.js"

// Responsive / device / container-size signal (transferred 1:1 from
// @keenmate/web-components-core; see src/lib/vendor/environment/README.md). The
// tree renders inline and does not change its own behaviour on these — they're
// exposed so a consumer can adapt settings to the space (AB10-style). The
// runes-friendly `containerSize`/`environmentState` bridges are for use inside a
// Svelte component; the raw observers are for app-level (non-Svelte) code.
export { containerSize, environmentState } from "./core/responsive.svelte.js"
export type { ReactiveSize, ReactiveEnvironment } from "./core/responsive.svelte.js"
export {
    observeEnvironment,
    observeViewport,
    getEnvironment,
    classifyDevice,
    configureBreakpoints,
    TABLET_MIN_SHORT_SIDE
} from "./vendor/environment/environment.js"
export type {
    EnvironmentSnapshot,
    EnvironmentListener,
    ObserveOptions,
    PointerType,
    Orientation,
    OS,
    BreakpointMap,
    DeviceClass
} from "./vendor/environment/environment.js"
export { observeElementSize } from "./vendor/environment/element-size.js"
export type { ElementSize, ElementSizeListener, ObserveElementSizeOptions } from "./vendor/environment/element-size.js"

// Export global API type and ensure registration runs
export type { GlobalTreeviewAPI } from "./global-api.js"
import "./global-api.js"
