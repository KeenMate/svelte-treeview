// Reexport your entry components here
export {default as Tree} from "./components/Tree.svelte"

// Export types
export type { LTreeNode, NodeId, VisualState } from "./ltree/ltree-node.svelte"
export type { Ltree, DropPosition, DragDropMode, DropOperation, ContextMenuItem, InsertArrayResult, TreeChange, ApplyChangesResult } from "./ltree/types"
export type { RenderStats } from "./components/RenderCoordinator.svelte"

// Export logging utilities
export { enableLogging, disableLogging, setLogLevel, setCategoryLevel, LOGGING_CATEGORIES } from "./logger"

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
} from "./perf-logger"

// Export global API type and ensure registration runs
export type { GlobalTreeviewAPI } from "./global-api"
import "./global-api"
