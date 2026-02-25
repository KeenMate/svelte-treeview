import type { LTreeNode } from '../ltree/ltree-node.svelte.js';
import type { DropPosition, ContextMenuItem } from '../ltree/types.js';
import type { TreeController, TreeControllerProps } from '../core/TreeController.svelte.js';
import type { CanvasTheme } from './canvas-theme.js';

// Re-export for convenience
export type { LTreeNode, DropPosition, ContextMenuItem, TreeController, TreeControllerProps };

// ── LOD ──────────────────────────────────────────────────────────────────

/** Level of detail based on current zoom level */
export type LodLevel = 'simple' | 'medium' | 'full';

// ── Layout Types ─────────────────────────────────────────────────────────

/** A node positioned by the layout engine */
export interface LayoutNode<T> {
	node: LTreeNode<T>;
	x: number;
	y: number;
	w: number;
	h: number;
	cx: number;
	cy: number;
	parent: LayoutNode<T> | null;
	children: LayoutNode<T>[];
	depth: number;
	/** Used in grouped layouts for connection lines to group boxes */
	connectionTargets?: { x: number; y: number }[];
	/** Virtual node (e.g. balanced layout multi-root placeholder) — not rendered or clickable */
	isVirtual?: boolean;
	/** Override label for virtual/synthetic nodes (e.g. multi-root sunburst center) */
	labelOverride?: string;
	/** Sunburst arc geometry (radians, px from center) */
	arcStartAngle?: number;
	arcEndAngle?: number;
	arcInnerR?: number;
	arcOuterR?: number;
}

/** A group box drawn around collapsed sibling nodes */
export interface GroupBox {
	x: number;
	y: number;
	w: number;
	h: number;
	connX: number;
	connY: number;
	depth: number;
}

/** Result of a layout computation */
export interface LayoutResult<T> {
	nodes: LayoutNode<T>[];
	groupBoxes: GroupBox[];
	width: number;
	height: number;
	levelXArr: number[];
	time: number;
}

/** Per-level overrides — all optional, fall back to global CanvasTree props */
export interface CanvasLevelConfig {
	color?: string;
	groupSiblings?: boolean;
	nodeHeight?: number;
	nodeMinWidth?: number;
	nodePaddingX?: number;
	nodeGap?: number;
	columnGap?: number;
	levelSpacingV?: number;
	maxGridCols?: number;
	gridNodeMaxW?: number;
}

/** Layout-mode-specific configuration */
export interface LayoutModeConfig {
	balancedSplit: 'even' | 'weighted';
	radialStartAngle: number;
	radialSpacing: number;
	sunburstRingWidth: number;
	sunburstRootTitle?: string;
}

/** Configuration for the layout engine */
export interface LayoutConfig {
	nodeHeight: number;
	nodeGap: number;
	columnGap: number;
	levelSpacingV: number;
	gridGap: number;
	groupPadding: number;
	maxGridCols: number;
	gridNodeMinW: number;
	gridNodeMaxW: number;
	nodeMinWidth: number;
	levelOverrides?: CanvasLevelConfig[];
}

// ── Orientation & Click Behavior ─────────────────────────────────────────

export type Orientation = 'horizontal' | 'vertical';
export type GrowthDirection = 'right' | 'left' | 'down' | 'up';
export type LayoutMode = 'tree' | 'balanced' | 'fishbone' | 'radial' | 'box' | 'sunburst';
export type ClickBehavior = 'select' | 'expand' | 'expand-and-focus';
export type InitialViewport = 'root' | 'origin';

// ── Render Context & Callbacks ───────────────────────────────────────────

/** Bounding box of a node during drawing */
export interface CanvasNodeBounds {
	x: number;
	y: number;
	w: number;
	h: number;
	cx: number;
	cy: number;
	depth: number;
}

/** State flags for a node during drawing */
export interface CanvasNodeState {
	isSelected: boolean;
	isHovered: boolean;
	isDragSource: boolean;
	isDropTarget: boolean;
	isSearchMatch: boolean;
	isCurrentSearchResult: boolean;
	isSearchDimmed: boolean;
}

/** Visual configuration used by default renderers */
export interface CanvasVisualConfig {
	nodeHeight: number;
	nodeMinWidth: number;
	nodePaddingX: number;
	colorBarWidth: number;
	font: string;
	fontBold: string;
	getDepthColor: (depth: number) => string;
	growthDirection: GrowthDirection;
}

/** Context passed to every render callback */
export interface CanvasRenderContext<T> {
	ctx: CanvasRenderingContext2D;
	node: LTreeNode<T>;
	/** Resolved display label for this node (from getNodeLabel or displayValueMember) */
	label: string;
	bounds: CanvasNodeBounds;
	state: CanvasNodeState;
	lod: LodLevel;
	depthColor: string;
	config: CanvasVisualConfig;
	/** Resolved theme values (defaults merged with CSS vars and prop overrides) */
	theme: CanvasTheme;
}

/** Full node render override — replaces entire node rendering */
export type RenderNodeCallback<T> = (rctx: CanvasRenderContext<T>) => void;

/** Slot-level render callback — override individual parts */
export type RenderSlotCallback<T> = (rctx: CanvasRenderContext<T>) => void;

/** Node width measurement callback */
export type MeasureNodeWidthCallback<T> = (
	node: LTreeNode<T>,
	getTextWidth: (text: string) => number,
	config: CanvasVisualConfig
) => number;

/** Node height measurement callback */
export type MeasureNodeHeightCallback<T> = (
	node: LTreeNode<T>,
	getTextWidth: (text: string) => number,
	config: CanvasVisualConfig
) => number;

/** Node display text callback */
export type GetNodeLabelCallback<T> = (node: LTreeNode<T>) => string;

/** Collection of slot-level render callbacks */
export interface NodeRenderSlots<T> {
	renderNode?: RenderNodeCallback<T>;
	renderBackground?: RenderSlotCallback<T>;
	renderColorBar?: RenderSlotCallback<T>;
	renderBody?: RenderSlotCallback<T>;
	renderChevron?: RenderSlotCallback<T>;
	renderBadge?: RenderSlotCallback<T>;
}

// ── Focus Options ───────────────────────────────────────────────────

/** Where the focused node should appear in the viewport */
export type FocusAnchor =
	| 'center'
	| 'top-left' | 'top-center' | 'top-right'
	| 'center-left' | 'center-right'
	| 'bottom-left' | 'bottom-center' | 'bottom-right'
	| { x: number; y: number };  // normalized 0–1

/** How zoom should be handled when focusing */
export type FocusZoom =
	| number    // exact zoom level (clamped to [0.05, 3.0])
	| 'keep'    // maintain current zoom
	| 'auto';   // clamp current zoom to [0.8, 1.5] (default)

/** Options for focusOnPath / focusOnNode */
export interface FocusOptions {
	/** Where in the viewport the node should appear. Default: 'center' */
	anchor?: FocusAnchor;
	/** Zoom behavior. Default: 'auto' */
	zoom?: FocusZoom;
	/** Padding in px from viewport edge for edge anchors. Default: 40 */
	padding?: number;
	/** Whether to animate the transition. Default: true */
	animate?: boolean;
	/** Whether to update selectedPath. Default: true */
	select?: boolean;
}

// ── Drop Zone Types ──────────────────────────────────────────────────────

export interface DropZoneRect {
	position: DropPosition;
	x: number;
	y: number;
	w: number;
	h: number;
	label: string;
	color: string;
	activeColor: string;
}
