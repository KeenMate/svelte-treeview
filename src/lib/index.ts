// Reexport your entry components here
export {default as Tree} from "./components/Tree.svelte"
export {default as TreeProvider} from "./components/TreeProvider.svelte"

// Core layer (headless controller)
export { TreeController } from "./core/TreeController.svelte"
export type { TreeControllerProps } from "./core/TreeController.svelte"
export { createTreeController } from "./core/createTreeController.js"

// Export types
export type { LTreeNode, NodeId, VisualState } from "./ltree/ltree-node.svelte"
export type { Ltree, DropPosition, DragDropMode, DropOperation, ContextMenuItem, InsertArrayResult, TreeChange, ApplyChangesResult } from "./ltree/types"
export type { RenderStats } from "./components/RenderCoordinator.svelte"
export type { NodeCallbacks, NodeConfig } from "./core/TreeController.svelte"

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

// Canvas tree component
export { default as CanvasTree } from "./canvas/CanvasTree.svelte"

// Canvas types (for users writing custom render callbacks)
export type {
    CanvasRenderContext, CanvasNodeBounds, CanvasNodeState, CanvasVisualConfig,
    CanvasLevelConfig,
    RenderNodeCallback, RenderSlotCallback,
    MeasureNodeWidthCallback, MeasureNodeHeightCallback, GetNodeLabelCallback,
    LodLevel, Orientation, GrowthDirection, LayoutMode, ClickBehavior, InitialViewport, LayoutNode, GroupBox, NodeRenderSlots,
    FocusAnchor, FocusZoom, FocusOptions
} from "./canvas/types.js"

// Default renderers (for composition)
export {
    defaultRenderBackground, defaultRenderColorBar,
    defaultRenderBody, defaultRenderChevron, defaultRenderBadge
} from "./canvas/canvas-renderer.js"

// Canvas theming
export type { CanvasTheme } from "./canvas/canvas-theme.js"
export { defaultCanvasTheme } from "./canvas/canvas-theme.js"

// Export global API type and ensure registration runs
export type { GlobalTreeviewAPI } from "./global-api"
import "./global-api"
