// Reexport your entry components here
export {default as Tree} from "./components/Tree.svelte"
export {default as TreeProvider} from "./components/TreeProvider.svelte"
export {default as ContextMenuItemC} from "./components/ContextMenuItem.svelte"
export {default as ContextMenuDividerC} from "./components/ContextMenuDivider.svelte"

// Core layer (headless controller)
export { TreeController } from "./core/TreeController.svelte"
export type { TreeControllerProps } from "./core/TreeController.svelte"
export { createTreeController } from "./core/createTreeController.js"

// Export types
export type { LTreeNode, NodeId, VisualState } from "./ltree/ltree-node.svelte"
export type { Ltree, DropPosition, DragDropMode, DropOperation, ToggleIconMode, ContextMenuItem, ContextMenuDivider, ContextMenuEntry, InsertArrayResult, TreeChange, ApplyChangesResult } from "./ltree/types.js"
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
