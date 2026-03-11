// Reexport your entry components here
export {default as Tree} from "./components/Tree.svelte"
export {default as TreeProvider} from "./components/TreeProvider.svelte"
export {default as ContextMenuItemC} from "./components/ContextMenuItem.svelte"
export {default as ContextMenuDividerC} from "./components/ContextMenuDivider.svelte"

// Core layer (headless controller)
export { TreeController } from "./core/TreeController.svelte"
export type { TreeControllerProps, PasteResult } from "./core/TreeController.svelte"
export { createTreeController } from "./core/createTreeController.js"

// Export types
export type { LTreeNode, NodeId, VisualState } from "./ltree/ltree-node.svelte"
export type { Ltree, DropPosition, DragDropMode, DropOperation, ToggleIconMode, ContextMenuItem, ContextMenuDivider, ContextMenuEntry, InsertArrayResult, InsertBranchResult, DeleteBranchResult, TreeChange, ApplyChangesResult } from "./ltree/types.js"

// Clipboard types & utilities
export type { ClipboardEntry, TreeClipboard } from "./core/clipboard.js"
export { setClipboard, getClipboard, clearClipboard, hasClipboard, getClipboardOperation } from "./core/clipboard.js"
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

// Export global API type and ensure registration runs
export type { GlobalTreeviewAPI } from "./global-api.js"
import "./global-api.js"
