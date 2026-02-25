<script lang="ts" generics="T">
	import { type Snippet, onDestroy } from 'svelte';
	import TreeProvider from '../components/TreeProvider.svelte';
	import { TreeController, type TreeControllerProps } from '../core/TreeController.svelte.js';
	import type { LTreeNode } from '../ltree/ltree-node.svelte.js';
	import type { DropPosition, ContextMenuItem } from '../ltree/types.js';
	import type {
		Orientation,
		GrowthDirection,
		LayoutMode,
		ClickBehavior,
		InitialViewport,
		LayoutNode,
		LayoutResult,
		GroupBox,
		NodeRenderSlots,
		CanvasNodeState,
		CanvasVisualConfig,
		RenderNodeCallback,
		RenderSlotCallback,
		MeasureNodeWidthCallback,
		MeasureNodeHeightCallback,
		GetNodeLabelCallback,
		LodLevel,
		CanvasLevelConfig,
		FocusOptions
	} from './types.js';
	import { createTextCache } from './canvas-text.js';
	import { computeLayout } from './canvas-layout.js';
	import { drawRadialConnections } from './canvas-layout-radial.js';
	import { drawSunburstNodes, buildSunburstHitTester } from './canvas-layout-sunburst.js';
	import type { CanvasTheme } from './canvas-theme.js';
	import { defaultCanvasTheme, readCssTheme, resolveTheme } from './canvas-theme.js';
	import {
		drawConnections,
		drawBalancedConnections,
		drawFishboneConnections,
		drawGroupBoxes,
		drawDotGrid,
		drawMinimap,
		drawDropZones,
		drawDragGhost,
		drawNode,
		drawNodeSimple,
		drawNodeMedium
	} from './canvas-renderer.js';
	import { createInteractionManager } from './canvas-interaction.js';

	// ── Props ─────────────────────────────────────────────────────────────

	interface Props {
		// Data (passed through to TreeController)
		data: T[];
		idMember: string;
		pathMember: string;
		sortCallback?: (items: LTreeNode<T>[]) => LTreeNode<T>[];
		expandLevel?: number;
		// Additional TreeController passthrough props
		isSorted?: boolean;
		parentPathMember?: string;
		levelMember?: string;
		hasChildrenMember?: string;
		displayValueMember?: string;
		getDisplayValueCallback?: (node: LTreeNode<T>) => string;
		searchValueMember?: string;
		getSearchValueCallback?: (node: LTreeNode<T>) => string;
		treePathSeparator?: string;
		dragDropMode?: 'none' | 'self' | 'cross' | 'both';
		shouldUseInternalSearchIndex?: boolean;
		isExpandedMember?: string;
		isDraggableMember?: string;
		getIsDraggableCallback?: (node: LTreeNode<T>) => boolean;
		isDropAllowedMember?: string;
		allowedDropPositionsMember?: string;
		getAllowedDropPositionsCallback?: (node: LTreeNode<T>) => import('../ltree/types.js').DropPosition[] | null;
		isCollapsibleMember?: string;
		getIsCollapsibleCallback?: (node: LTreeNode<T>) => boolean;
		orderMember?: string;

		// Canvas Visual Config
		layoutMode?: LayoutMode;
		growthDirection?: GrowthDirection;
		initialViewport?: InitialViewport;

		// Balanced layout
		balancedSplit?: 'even' | 'weighted';

		// Fishbone layout
		fishboneCrossNav?: boolean;

		// Radial layout
		radialStartAngle?: number;
		radialSpacing?: number;

		// Sunburst layout
		sunburstRingWidth?: number;
		sunburstRootTitle?: string;
		groupSiblings?: boolean;
		showDotGrid?: boolean;
		clickBehavior?: ClickBehavior;
		collapsible?: boolean;
		nodeHeight?: number;
		nodeMinWidth?: number;
		nodePaddingX?: number;
		nodeGap?: number;
		columnGap?: number;
		levelSpacingV?: number;
		colorBarWidth?: number;
		depthColors?: string[];
		fontSize?: number;
		fontFamily?: string;
		zoomLodText?: number;
		zoomLodSimple?: number;
		gridGap?: number;
		groupPadding?: number;
		maxGridCols?: number;
		gridNodeMaxW?: number;
		levelConfig?: CanvasLevelConfig[];

		// Render callbacks
		renderNode?: RenderNodeCallback<T>;
		renderBackground?: RenderSlotCallback<T>;
		renderColorBar?: RenderSlotCallback<T>;
		renderBody?: RenderSlotCallback<T>;
		renderChevron?: RenderSlotCallback<T>;
		renderBadge?: RenderSlotCallback<T>;
		measureNodeWidth?: MeasureNodeWidthCallback<T>;
		measureNodeHeight?: MeasureNodeHeightCallback<T>;
		getNodeLabel?: GetNodeLabelCallback<T>;

		// Bindable state
		selectedPath?: string | null;
		controller?: TreeController<T> | null;

		// Events
		onNodeClick?: (node: LTreeNode<T>) => void;
		onNodeDrop?: (source: LTreeNode<T>, target: LTreeNode<T>, position: DropPosition) => void;
		onNodeContextMenu?: (node: LTreeNode<T>) => ContextMenuItem[];

		// Metrics (bindable, readonly)
		layoutTime?: number;
		drawTime?: number;
		visibleCount?: number;
		totalCount?: number;

		// Custom tooltip snippet — receives the LTreeNode and label
		tooltipSnippet?: Snippet<[LTreeNode<T>, string]>;

		// Theme overrides (highest priority, over CSS variables and defaults)
		theme?: Partial<CanvasTheme>;
	}

	let {
		// Data props
		data,
		idMember,
		pathMember,
		sortCallback,
		expandLevel = 2,
		isSorted,
		parentPathMember,
		levelMember,
		hasChildrenMember,
		displayValueMember,
		getDisplayValueCallback,
		searchValueMember,
		getSearchValueCallback,
		treePathSeparator,
		dragDropMode = 'self',
		shouldUseInternalSearchIndex,
		isExpandedMember,
		isDraggableMember,
		getIsDraggableCallback,
		isDropAllowedMember,
		allowedDropPositionsMember,
		getAllowedDropPositionsCallback,
		isCollapsibleMember,
		getIsCollapsibleCallback,
		orderMember,

		// Visual config
		layoutMode = $bindable('tree'),
		growthDirection = $bindable('right'),
		initialViewport = 'root',
		balancedSplit = 'even',
		fishboneCrossNav = false,
		radialStartAngle = 0,
		radialSpacing,
		sunburstRingWidth = 100,
		sunburstRootTitle,
		groupSiblings = $bindable(true),
		showDotGrid = $bindable(false),
		clickBehavior = $bindable('expand'),
		collapsible = true,
		nodeHeight = $bindable(28),
		nodeMinWidth = $bindable(100),
		nodePaddingX = $bindable(14),
		nodeGap = $bindable(6),
		columnGap = $bindable(40),
		levelSpacingV = $bindable(60),
		colorBarWidth = $bindable(3),
		depthColors = $bindable(['#f59e0b', '#0d9488', '#7c3aed', '#ec4899']),
		fontSize = $bindable(12),
		fontFamily = $bindable('"SF Mono", "Cascadia Code", "Fira Code", monospace'),
		zoomLodText = $bindable(0.35),
		zoomLodSimple = $bindable(0.12),
		gridGap = $bindable(4),
		groupPadding = $bindable(8),
		maxGridCols = $bindable(10),
		gridNodeMaxW = $bindable(260),
		levelConfig,

		// Render callbacks
		renderNode,
		renderBackground,
		renderColorBar,
		renderBody,
		renderChevron,
		renderBadge,
		measureNodeWidth: measureNodeWidthCb,
		measureNodeHeight: measureNodeHeightCb,
		getNodeLabel: getNodeLabelCb,

		// Bindable state
		selectedPath = $bindable(null),
		controller = $bindable(null),

		// Events
		onNodeClick: onNodeClickCb,
		onNodeDrop: onNodeDropCb,
		onNodeContextMenu: onNodeContextMenuCb,

		// Metrics
		layoutTime = $bindable(0),
		drawTime = $bindable(0),
		visibleCount = $bindable(0),
		totalCount = $bindable(0),

		// Tooltip
		tooltipSnippet,

		// Theme overrides
		theme: themePropOverrides,
	}: Props = $props();

	// ── Internal State ──────────────────────────────────────────────────

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let containerEl: HTMLDivElement | undefined = $state();
	let ctrlRef: TreeController<T> | null = null;
	let rafId: number | null = null;
	/** Tooltip state — explicitly updated at end of each draw() for reliable reactivity */
	let tooltipLn = $state<LayoutNode<T> | null>(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	// Layout data (non-reactive for performance)
	let layoutNodes: LayoutNode<T>[] = [];
	let groupBoxes: import('./types.js').GroupBox[] = [];
	let layoutWidth = 0;
	let layoutHeight = 0;
	let levelXArr: number[] = [0];
	let cachedSunburstHitTester: ((wx: number, wy: number) => LayoutNode<T> | null) | null = null;

	// Search state
	let matchedPaths: Set<string> = new Set();
	let searchResults: LTreeNode<T>[] = [];
	let currentResultIndex = -1;

	// Text cache
	const textCache = createTextCache();

	// Theme: resolved from defaults → CSS variables → prop overrides
	let resolvedTheme: CanvasTheme = defaultCanvasTheme;

	function buildTheme() {
		const cssOverrides = containerEl ? readCssTheme(containerEl) : {};
		resolvedTheme = resolveTheme(cssOverrides, themePropOverrides ?? {});
	}

	// Derived font strings
	let fontStr = $derived(`${fontSize}px ${fontFamily}`);
	let fontBold = $derived(`bold ${fontSize}px ${fontFamily}`);

	// ── Depth Color ────────────────────────────────────────────────────

	function getDepthColor(depth: number): string {
		return levelConfig?.[depth]?.color ?? depthColors[depth % depthColors.length];
	}

	// ── Node Label ──────────────────────────────────────────────────────

	function getLabel(node: LTreeNode<T>): string {
		if (getNodeLabelCb) return getNodeLabelCb(node);
		if (ctrlRef) return ctrlRef.tree.getNodeDisplayValue(node);
		return (node.data as Record<string, unknown>)?.name as string || node.path;
	}

	// ── Node Width Measurement ──────────────────────────────────────────

	function measureNodeWidthFn(treeNode: LTreeNode<T>): number {
		if (measureNodeWidthCb) {
			return measureNodeWidthCb(treeNode, textCache.getTextWidth, {
				nodeHeight,
				nodeMinWidth,
				nodePaddingX,
				colorBarWidth,
				font: fontStr,
				fontBold,
				getDepthColor,
				growthDirection
			});
		}
		const label = getLabel(treeNode);
		const tw = textCache.getTextWidth(label);
		const chevronW = treeNode.hasChildren ? 16 : 0;
		return Math.max(nodeMinWidth, tw + nodePaddingX * 2 + colorBarWidth + chevronW);
	}

	// ── Layout ──────────────────────────────────────────────────────────

	function doLayout() {
		if (!ctrlRef) return;
		const _lt0 = performance.now();
		const result = computeLayout(
			ctrlRef,
			growthDirection,
			groupSiblings,
			measureNodeWidthFn,
			{
				nodeHeight,
				nodeGap,
				columnGap,
				levelSpacingV,
				gridGap,
				groupPadding,
				maxGridCols,
				gridNodeMinW: 120,
				gridNodeMaxW,
				nodeMinWidth,
				levelOverrides: levelConfig
			},
			layoutMode,
			{
				balancedSplit,
				radialStartAngle,
				radialSpacing: radialSpacing ?? columnGap * 3,
				sunburstRingWidth,
				sunburstRootTitle
			}
		);
		layoutNodes = result.nodes;
		groupBoxes = result.groupBoxes;
		layoutWidth = result.width;
		layoutHeight = result.height;
		levelXArr = result.levelXArr;
		layoutTime = result.time;
		totalCount = result.nodes.length;

		// Build cached sunburst hit tester (ring-indexed for performance)
		if (layoutMode === 'sunburst' && layoutNodes.length > 0) {
			const rootLn = layoutNodes.find(n => n.depth === 0);
			if (rootLn) {
				cachedSunburstHitTester = buildSunburstHitTester(layoutNodes, rootLn.cx, rootLn.cy);
			} else {
				cachedSunburstHitTester = null;
			}
		} else {
			cachedSunburstHitTester = null;
		}
		console.log(`[doLayout] ${(performance.now() - _lt0).toFixed(1)}ms | ${layoutNodes.length} nodes | mode=${layoutMode}`);
	}

	// ── Draw ────────────────────────────────────────────────────────────

	// Performance logging
	let _perfLogCounter = 0;
	const _PERF_LOG_EVERY = 60; // log every N frames

	function draw() {
		if (!canvasEl || !containerEl) return;
		const t0 = performance.now();
		const doLog = (++_perfLogCounter % _PERF_LOG_EVERY) === 0;
		const ctx = canvasEl.getContext('2d')!;
		const dpr = window.devicePixelRatio || 1;
		const rect = containerEl.getBoundingClientRect();
		const cw = rect.width;
		const ch = rect.height;

		const targetW = Math.round(cw * dpr);
		const targetH = Math.round(ch * dpr);
		if (canvasEl.width !== targetW || canvasEl.height !== targetH) {
			canvasEl.width = targetW;
			canvasEl.height = targetH;
			canvasEl.style.width = cw + 'px';
			canvasEl.style.height = ch + 'px';
		}

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, cw, ch);

		const iState = interaction.getState();
		const theme = resolvedTheme;

		// Background
		ctx.fillStyle = theme.bg;
		ctx.fillRect(0, 0, cw, ch);
		let tGrid = t0;
		if (showDotGrid) {
			drawDotGrid(ctx, cw, ch, iState.panX, iState.panY, iState.zoom, theme);
			tGrid = performance.now();
		}

		ctx.save();
		ctx.translate(iState.panX, iState.panY);
		ctx.scale(iState.zoom, iState.zoom);

		// Viewport bounds in world coords for culling
		const vl = -iState.panX / iState.zoom;
		const vt = -iState.panY / iState.zoom;
		const vr = vl + cw / iState.zoom;
		const vb = vt + ch / iState.zoom;
		const M = 50;

		const isV = growthDirection === 'up' || growthDirection === 'down';
		const isReversed = growthDirection === 'left' || growthDirection === 'up';
		const isSearchActive = matchedPaths.size > 0;

		// Connections (sunburst uses adjacent arcs, no lines needed)
		if (layoutMode === 'sunburst') {
			// no connection lines
		} else if (layoutMode === 'balanced') {
			drawBalancedConnections(ctx, layoutNodes, vl, vt, vr, vb, theme, columnGap, levelSpacingV);
		} else if (layoutMode === 'radial') {
			drawRadialConnections(ctx, layoutNodes, vl, vt, vr, vb, theme);
		} else if (layoutMode === 'fishbone') {
			drawFishboneConnections(ctx, layoutNodes, isV, vl, vt, vr, vb, theme);
		} else if (layoutMode !== 'box') {
			drawConnections(ctx, layoutNodes, levelXArr, isV, isReversed, columnGap, levelSpacingV, vl, vt, vr, vb, theme);
		}
		const tConn = performance.now();

		// Group boxes
		drawGroupBoxes(ctx, groupBoxes, getDepthColor, zoomLodSimple, zoomLodText, iState.zoom, vl, vt, vr, vb);
		const tBoxes = performance.now();

		// Nodes
		let visible = 0;

		if (layoutMode === 'sunburst') {
			// Sunburst: find center from root node and draw arcs
			const rootLn = layoutNodes.find(n => n.depth === 0);
			const scx = rootLn ? rootLn.cx : 0;
			const scy = rootLn ? rootLn.cy : 0;
			visible = drawSunburstNodes(
				ctx, layoutNodes, scx, scy,
				getDepthColor, (node, ln) => ln?.labelOverride ?? getLabel(node),
				iState.hoveredNode as LayoutNode<T> | null,
				selectedPath, fontStr, iState.zoom,
				vl, vt, vr, vb, theme
			);
		} else {
			const lodText = iState.zoom >= zoomLodText;
			const lodSimple = iState.zoom < zoomLodSimple;

			const visualConfig: CanvasVisualConfig = {
				nodeHeight,
				nodeMinWidth,
				nodePaddingX,
				colorBarWidth,
				font: fontStr,
				fontBold,
				getDepthColor,
				growthDirection
			};

			const slots: NodeRenderSlots<T> = {
				renderNode,
				renderBackground,
				renderColorBar,
				renderBody,
				renderChevron,
				renderBadge
			};

			for (const n of layoutNodes) {
				if (n.isVirtual) continue;
				if (n.x + n.w < vl - M || n.x > vr + M || n.y + n.h < vt - M || n.y > vb + M) continue;
				visible++;

				const depthColor = getDepthColor(n.depth);
				const isSelected = n.node.path === selectedPath;
				const isMatch = isSearchActive && matchedPaths.has(n.node.path);
				const isCurrent = isMatch && currentResultIndex >= 0 && searchResults[currentResultIndex]?.path === n.node.path;
				const isDragSrc = iState.dragSrcNode?.node.path === n.node.path && iState.isDragging;
				const isDropTgt = iState.dropTarget?.node.path === n.node.path && iState.isDragging;
				const isHovered = iState.hoveredNode?.node.path === n.node.path && !iState.isDragging;
				const isSearchDimmed = isSearchActive && !isMatch;

				// LOD: simple
				if (lodSimple) {
					drawNodeSimple(ctx, n, depthColor, isSelected, isMatch, isCurrent, isSearchDimmed, theme);
					continue;
				}

				ctx.globalAlpha = isDragSrc ? 0.3 : isSearchDimmed ? 0.25 : 1;

				// LOD: medium
				if (!lodText) {
					drawNodeMedium(ctx, n, depthColor, isSelected, isDropTgt, isMatch, isCurrent, colorBarWidth, isV, theme);
					ctx.globalAlpha = 1;
					continue;
				}

				// LOD: full detail — use slot-based rendering
				const state: CanvasNodeState = {
					isSelected,
					isHovered,
					isDragSource: isDragSrc,
					isDropTarget: isDropTgt,
					isSearchMatch: isMatch,
					isCurrentSearchResult: isCurrent,
					isSearchDimmed
				};

				const lod: LodLevel = 'full';
				drawNode(ctx, n, getLabel(n.node), state, lod, visualConfig, slots, theme);

				ctx.globalAlpha = 1;
			}
		}
		const tNodes = performance.now();

		// Drop zone buttons
		if (iState.isDragging && iState.dropTarget) {
			drawDropZones(ctx, iState.dropTarget as LayoutNode<T>, iState.dropPosition, isV, isReversed, theme);
		}

		// Drag ghost
		if (iState.isDragging && iState.dragSrcNode) {
			ctx.restore();
			ctx.save();
			drawDragGhost(
				ctx,
				iState.dragSrcNode as LayoutNode<T>,
				iState.dragX,
				iState.dragY,
				fontStr,
				colorBarWidth,
				nodePaddingX,
				(ln) => getLabel(ln.node),
				theme
			);
			ctx.restore();
		} else {
			ctx.restore();
		}

		// Minimap
		const tMm0 = performance.now();
		drawMinimap(
			ctx, layoutNodes, groupBoxes,
			layoutWidth, layoutHeight,
			getDepthColor, selectedPath,
			iState.panX, iState.panY, iState.zoom,
			cw, ch,
			theme
		);
		const tMm1 = performance.now();

		visibleCount = visible;
		drawTime = performance.now() - t0;

		if (doLog) {
			console.log(
				`[draw] total=${drawTime.toFixed(1)}ms | grid=${(tGrid - t0).toFixed(1)} conn=${(tConn - tGrid).toFixed(1)} boxes=${(tBoxes - tConn).toFixed(1)} nodes=${(tNodes - tBoxes).toFixed(1)} minimap=${(tMm1 - tMm0).toFixed(1)} | visible=${visible}/${layoutNodes.length} zoom=${iState.zoom.toFixed(3)}`
			);
		}

		// Sync tooltip state to reactive $state for HTML overlay
		// Compare by path, not reference — tooltipLn is a $state proxy, tt is plain
		const tt = iState.tooltipNode as LayoutNode<T> | null;
		if (tt?.node.path !== tooltipLn?.node.path || iState.tooltipScreenX !== tooltipX || iState.tooltipScreenY !== tooltipY) {
			tooltipLn = tt;
			tooltipX = iState.tooltipScreenX;
			tooltipY = iState.tooltipScreenY;
		}
	}

	function requestRedraw() {
		if (rafId != null) return;
		rafId = requestAnimationFrame(() => {
			rafId = null;
			draw();
		});
	}

	function recomputeAndDraw() {
		if (!ctrlRef) return;
		const _rc0 = performance.now();
		doLayout();
		requestRedraw();
		console.log(`[recomputeAndDraw] layout+schedule: ${(performance.now() - _rc0).toFixed(1)}ms`);
	}

	// ── Interaction Manager ─────────────────────────────────────────────

	const interaction = createInteractionManager<T>(
		{
			getCanvas: () => canvasEl,
			getContainer: () => containerEl,
			getLayoutNodes: () => layoutNodes,
			getLayoutSize: () => ({ width: layoutWidth, height: layoutHeight }),
			getDirection: () => ({
				isV: growthDirection === 'up' || growthDirection === 'down',
				isReversed: growthDirection === 'left' || growthDirection === 'up'
			}),
			requestRedraw,
			onNodeClick: (ln, chevronHit) => {
				// Sunburst accordion: clicking any node collapses its expanded siblings
				// (only if they are collapsible — respect isCollapsible check)
				let accordionChanged = false;
				if (layoutMode === 'sunburst' && ctrlRef) {
					const siblings = ctrlRef.getSiblings(ln.node.path);
					for (const sib of siblings) {
						if (sib.path !== ln.node.path && sib.isExpanded && ctrlRef.getNodeIsCollapsible(sib)) {
							ctrlRef.collapseNodes(sib.path);
							accordionChanged = true;
						}
					}
				}

				const nodeCollapsible = ctrlRef?.getNodeIsCollapsible(ln.node) ?? true;
				const shouldToggle = collapsible && nodeCollapsible && ln.node.hasChildren && (
					clickBehavior !== 'select' || chevronHit
				);
				const wasExpanded = ln.node.isExpanded;
				if (shouldToggle) {
					if (wasExpanded) ctrlRef!.collapseNodes(ln.node.path);
					else ctrlRef!.expandNodes(ln.node.path);
					accordionChanged = true;
				}
				if (accordionChanged) recomputeAndDraw();

				// Sunburst: after expanding, focus on the first child
				if (layoutMode === 'sunburst' && shouldToggle && !wasExpanded) {
					const children = ctrlRef!.getChildren(ln.node.path);
					if (children.length > 0) {
						const firstChildLn = layoutNodes.find(n => n.node.path === children[0].path);
						if (firstChildLn) interaction.focusOnNode(firstChildLn, { select: false });
					}
				}
				onNodeClickCb?.(ln.node);
			},
			onDragDrop: (src, target, position) => {
				console.log('[CanvasTree] onDragDrop', { src: src.node.path, target: target.node.path, position, hasCtrl: !!ctrlRef });
				if (ctrlRef) {
					const result = ctrlRef.moveNode(src.node.path, target.node.path, position);
					console.log('[CanvasTree] moveNode result:', result);
					if (result.success) {
						console.log('[CanvasTree] recomputeAndDraw after move');
						recomputeAndDraw();
						onNodeDropCb?.(src.node, target.node, position);
					}
				}
			},
			onContextMenu: (ln, clientX, clientY) => {
				if (ctrlRef && onNodeContextMenuCb) {
					ctrlRef.contextMenuCallbackCb = (node, close) => onNodeContextMenuCb!(node);
					ctrlRef.openContextMenu(ln.node, clientX, clientY);
				}
			},
			onCloseContextMenu: () => {
				ctrlRef?.closeContextMenu();
			},
			onHoverChange: (_ln) => {
				// Redraw is handled by interaction manager
			},
			onSelectionChange: (path) => {
				selectedPath = path;
			},
			getNodeLabel: (ln) => getLabel(ln.node),
			onTooltipPositionChange: (_node, x, y) => {
				tooltipX = x;
				tooltipY = y;
			},
			hitTestOverride: () => {
				if (layoutMode !== 'sunburst') return null;
				return cachedSunburstHitTester;
			}
		},
		{
			getClickBehavior: () => clickBehavior,
			getDragDropMode: () => dragDropMode,
			animDuration: 400
		}
	);

	// ── Controller Capture ──────────────────────────────────────────────

	function captureCtrl(ctrl: TreeController<T>) {
		// Only set the non-reactive internal ref here (called from template)
		ctrlRef = ctrl;
	}

	// Sync the bindable controller prop via $effect (safe for reactive state)
	$effect(() => {
		if (ctrlRef) {
			controller = ctrlRef;
		}
	});

	// ── Keyboard ────────────────────────────────────────────────────────
	// Up/Down: sibling navigation (same level, no wrapping)
	// Left: collapse or go to parent
	// Right: expand or go to first child

	/** Find the group box that contains a layout node (if any) */
	function findContainingGroupBox(ln: LayoutNode<T>): GroupBox | null {
		for (const box of groupBoxes) {
			if (ln.cx >= box.x && ln.cx <= box.x + box.w &&
				ln.cy >= box.y && ln.cy <= box.y + box.h) {
				return box;
			}
		}
		return null;
	}

	/** Get all layout nodes inside a given group box */
	function getNodesInGroupBox(box: GroupBox): LayoutNode<T>[] {
		return layoutNodes.filter(ln =>
			ln.cx >= box.x && ln.cx <= box.x + box.w &&
			ln.cy >= box.y && ln.cy <= box.y + box.h
		);
	}

	/**
	 * Find the nearest node in a direction within a set of candidates.
	 * axis: which coordinate to test direction on
	 * forward: true = increasing coordinate, false = decreasing
	 */
	function findNearest(
		currentLn: LayoutNode<T>,
		candidates: LayoutNode<T>[],
		axis: 'x' | 'y',
		forward: boolean
	): LayoutNode<T> | null {
		const pos = axis === 'x' ? currentLn.cx : currentLn.cy;
		let bestLn: LayoutNode<T> | null = null;
		let bestDist = Infinity;

		for (const ln of candidates) {
			if (ln.node.path === currentLn.node.path) continue;
			const lnPos = axis === 'x' ? ln.cx : ln.cy;
			if (forward ? lnPos <= pos + 1 : lnPos >= pos - 1) continue;

			const dx = ln.cx - currentLn.cx;
			const dy = ln.cy - currentLn.cy;
			const dist = dx * dx + dy * dy;
			if (dist < bestDist) {
				bestDist = dist;
				bestLn = ln;
			}
		}
		return bestLn;
	}

	/** Find the nearest same-depth node outside any group box */
	function findSpatialNeighborAtDepth(
		currentLn: LayoutNode<T>,
		axis: 'x' | 'y',
		forward: boolean
	): LayoutNode<T> | null {
		const candidates = layoutNodes.filter(ln => ln.depth === currentLn.depth);
		return findNearest(currentLn, candidates, axis, forward);
	}

	/**
	 * Map a physical arrow key to a logical navigation action based on
	 * orientation and direction.  This keeps all layout-specific key
	 * binding in one place so adding RTL or new orientations is trivial.
	 *
	 * Logical actions:
	 *   treeForward  – toward children  (Right in H-LTR, Down in V, Left in H-RTL)
	 *   treeBack     – toward parent    (Left  in H-LTR, Up   in V, Right in H-RTL)
	 *   crossNext    – next on cross axis (Down in H, Right in V-LTR, Left in V-RTL)
	 *   crossPrev    – prev on cross axis (Up   in H, Left  in V-LTR, Right in V-RTL)
	 */
	type NavAction = 'treeForward' | 'treeBack' | 'crossNext' | 'crossPrev';

	function resolveNavAction(key: string, dir?: GrowthDirection): NavAction | null {
		const effectiveDir = dir ?? growthDirection;
		switch (effectiveDir) {
			case 'right':
				switch (key) {
					case 'ArrowRight': return 'treeForward';
					case 'ArrowLeft':  return 'treeBack';
					case 'ArrowDown':  return 'crossNext';
					case 'ArrowUp':    return 'crossPrev';
				}
				break;
			case 'left':
				switch (key) {
					case 'ArrowLeft':  return 'treeForward';
					case 'ArrowRight': return 'treeBack';
					case 'ArrowDown':  return 'crossNext';
					case 'ArrowUp':    return 'crossPrev';
				}
				break;
			case 'down':
				switch (key) {
					case 'ArrowDown':  return 'treeForward';
					case 'ArrowUp':    return 'treeBack';
					case 'ArrowRight': return 'crossNext';
					case 'ArrowLeft':  return 'crossPrev';
				}
				break;
			case 'up':
				switch (key) {
					case 'ArrowUp':    return 'treeForward';
					case 'ArrowDown':  return 'treeBack';
					case 'ArrowRight': return 'crossNext';
					case 'ArrowLeft':  return 'crossPrev';
				}
				break;
		}
		return null;
	}

	/** Resolve the spatial axis & direction for a logical action */
	function resolveAxis(action: NavAction, dir?: GrowthDirection): { axis: 'x' | 'y'; forward: boolean } {
		const effectiveDir = dir ?? growthDirection;
		const isV = effectiveDir === 'up' || effectiveDir === 'down';
		const isReversed = effectiveDir === 'left' || effectiveDir === 'up';

		if (isV) {
			// tree axis = Y, cross axis = X
			switch (action) {
				case 'treeForward': return { axis: 'y', forward: !isReversed };
				case 'treeBack':    return { axis: 'y', forward: isReversed };
				case 'crossNext':   return { axis: 'x', forward: true };
				case 'crossPrev':   return { axis: 'x', forward: false };
			}
		} else {
			// tree axis = X, cross axis = Y
			switch (action) {
				case 'treeForward': return { axis: 'x', forward: !isReversed };
				case 'treeBack':    return { axis: 'x', forward: isReversed };
				case 'crossNext':   return { axis: 'y', forward: true };
				case 'crossPrev':   return { axis: 'y', forward: false };
			}
		}
	}

	/** Find the root (depth-0) layout node for balanced nav */
	function getBalancedRootLn(): LayoutNode<T> | null {
		return layoutNodes.find(ln => ln.depth === 0) ?? null;
	}

	/** Determine which arm a node belongs to based on its cx relative to root's cx */
	function getBalancedArmDir(currentLn: LayoutNode<T>, rootLn: LayoutNode<T>): GrowthDirection | 'root' {
		if (currentLn.node.path === rootLn.node.path) return 'root';
		return currentLn.cx < rootLn.cx ? 'left' : 'right';
	}

	/** Cross-axis neighbor constrained to the same arm of a balanced layout */
	function findBalancedCrossNeighbor(
		currentLn: LayoutNode<T>, rootCx: number, axis: 'x' | 'y', forward: boolean
	): LayoutNode<T> | null {
		const isLeft = currentLn.cx < rootCx;
		const candidates = layoutNodes.filter(ln =>
			ln.depth === currentLn.depth && (isLeft ? ln.cx < rootCx : ln.cx >= rootCx)
		);
		return findNearest(currentLn, candidates, axis, forward);
	}

	function onKeyDown(e: KeyboardEvent) {
		// Don't handle keys when focus is in input fields
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

		if (e.key === 'Escape' && ctrlRef?.contextMenuVisible) {
			ctrlRef.closeContextMenu();
			return;
		}

		if (!ctrlRef || !selectedPath) return;

		const node = ctrlRef.getNodeByPath(selectedPath);
		if (!node) return;

		// Enter: toggle expand/collapse
		if (e.key === 'Enter') {
			if (!node.hasChildren) return;
			e.preventDefault();
			if (node.isExpanded) {
				ctrlRef.collapseNodes(selectedPath);
			} else {
				ctrlRef.expandNodes(selectedPath);
			}
			recomputeAndDraw();
			return;
		}

		const action = resolveNavAction(e.key);
		if (!action) return;
		e.preventDefault();

		const currentLn = layoutNodes.find(ln => ln.node.path === node.path);
		if (!currentLn) return;
		const box = findContainingGroupBox(currentLn);

		if (box) {
			// ── Inside a group box: navigate like Excel within the grid ──
			const groupNodes = getNodesInGroupBox(box);
			const { axis, forward } = resolveAxis(action);

			if (action === 'crossPrev' || action === 'crossNext') {
				const neighbor = findNearest(currentLn, groupNodes, axis, forward);
				if (neighbor) {
					navigateToPath(neighbor.node.path);
				} else {
					// At edge of group — escape to nearest same-depth node outside
					const outer = findSpatialNeighborAtDepth(currentLn, axis, forward);
					if (outer) navigateToPath(outer.node.path);
				}
			} else if (action === 'treeForward') {
				const neighbor = findNearest(currentLn, groupNodes, axis, forward);
				if (neighbor) navigateToPath(neighbor.node.path);
				// At forward edge of group → do nothing (grouped nodes have no children)
			} else if (action === 'treeBack') {
				const neighbor = findNearest(currentLn, groupNodes, axis, forward);
				if (neighbor) {
					navigateToPath(neighbor.node.path);
				} else if (node.parentPath) {
					// At back edge of group → go to parent
					navigateToPath(node.parentPath);
				}
			}
		} else {
			// ── Outside a group box: individually laid out nodes ──

			if (layoutMode === 'balanced') {
				const rootLn = getBalancedRootLn();
				if (!rootLn) return;
				const armDir = getBalancedArmDir(currentLn, rootLn);

				if (armDir === 'root') {
					// Root node: arrows directly enter the respective arm
					if (e.key === 'ArrowRight') {
						const rightKids = (currentLn.children || []).filter(c => c.cx > currentLn.cx);
						if (rightKids.length > 0) {
							const best = rightKids.reduce((a, b) =>
								Math.abs(a.cy - currentLn.cy) < Math.abs(b.cy - currentLn.cy) ? a : b
							);
							navigateToPath(best.node.path);
						}
					} else if (e.key === 'ArrowLeft') {
						const leftKids = (currentLn.children || []).filter(c => c.cx < currentLn.cx);
						if (leftKids.length > 0) {
							const best = leftKids.reduce((a, b) =>
								Math.abs(a.cy - currentLn.cy) < Math.abs(b.cy - currentLn.cy) ? a : b
							);
							navigateToPath(best.node.path);
						}
					}
					// Up/Down from root: no siblings — do nothing
				} else {
					// Non-root node in an arm: use the arm's direction
					const armAction = resolveNavAction(e.key, armDir);
					if (!armAction) return;

					if (armAction === 'crossPrev' || armAction === 'crossNext') {
						const { axis, forward } = resolveAxis(armAction, armDir);
						const neighbor = findBalancedCrossNeighbor(currentLn, rootLn.cx, axis, forward);
						if (neighbor) navigateToPath(neighbor.node.path);
					} else if (armAction === 'treeForward') {
						if (node.hasChildren && node.isExpanded) {
							const children = ctrlRef.getChildren(node.path);
							if (children.length > 0) navigateToPath(children[0].path);
						}
					} else if (armAction === 'treeBack') {
						if (node.parentPath) navigateToPath(node.parentPath);
					}
				}
				return;
			}

			if (layoutMode === 'fishbone') {
				// Fishbone has a fundamentally different spatial structure:
				// - Spine (depth 1) nodes spread along one axis
				// - Branch (depth 2+) nodes spread perpendicular to spine
				// Generic treeForward/treeBack mapping doesn't work here.
				const isH = !(growthDirection === 'up' || growthDirection === 'down');
				const spineAxis: 'x' | 'y' = isH ? 'x' : 'y';
				const branchAxis: 'x' | 'y' = isH ? 'y' : 'x';
				// After mirror: spine goes away from root in the forward direction
				const spineForwardKey = isH ? 'ArrowLeft' : 'ArrowUp';
				const spineBackKey = isH ? 'ArrowRight' : 'ArrowDown';
				const branchKey1 = isH ? 'ArrowUp' : 'ArrowLeft';       // toward smaller branch-axis coordinate
				const branchKey2 = isH ? 'ArrowDown' : 'ArrowRight';    // toward larger branch-axis coordinate

				if (currentLn.depth === 0) {
					// Root: only enter spine (forward direction)
					if (e.key === spineForwardKey) {
						const kids = currentLn.children || [];
						if (kids.length > 0) {
							const best = kids.reduce((a, b) => {
								const da = (a.cx - currentLn.cx) ** 2 + (a.cy - currentLn.cy) ** 2;
								const db = (b.cx - currentLn.cx) ** 2 + (b.cy - currentLn.cy) ** 2;
								return da < db ? a : b;
							});
							navigateToPath(best.node.path);
						}
					}
				} else if (currentLn.depth === 1) {
					// Spine node
					// Determine which side of the fishbone this spine node is on
					const rootLn = layoutNodes.find(ln => ln.depth === 0);
					const myBranchPos = branchAxis === 'y' ? currentLn.cy : currentLn.cx;
					const rootBranchPos = rootLn ? (branchAxis === 'y' ? rootLn.cy : rootLn.cx) : myBranchPos;
					const mySpineSide = myBranchPos < rootBranchPos ? 'before' : 'after';
					const allSpine = layoutNodes.filter(ln => ln.depth === 1);

					if (e.key === spineForwardKey || e.key === spineBackKey) {
						// Left/Right: same-side spine siblings, sorted by spine-axis distance
						const forward = e.key === spineBackKey;
						const mySpinePos = spineAxis === 'x' ? currentLn.cx : currentLn.cy;
						const sameSide = allSpine.filter(ln => {
							const lnBranchPos = branchAxis === 'y' ? ln.cy : ln.cx;
							const lnSide = lnBranchPos < rootBranchPos ? 'before' : 'after';
							return lnSide === mySpineSide;
						});
						const inDir = sameSide.filter(ln => {
							if (ln.node.path === currentLn.node.path) return false;
							const lnPos = spineAxis === 'x' ? ln.cx : ln.cy;
							return forward ? lnPos > mySpinePos + 1 : lnPos < mySpinePos - 1;
						});
						inDir.sort((a, b) => {
							const aPos = spineAxis === 'x' ? a.cx : a.cy;
							const bPos = spineAxis === 'x' ? b.cx : b.cy;
							return forward ? aPos - bPos : bPos - aPos;
						});
						const neighbor = inDir[0] ?? null;
						if (neighbor) {
							navigateToPath(neighbor.node.path);
						} else if (e.key === spineBackKey && currentLn.parent) {
							navigateToPath(currentLn.parent.node.path);
						}
					} else if (e.key === branchKey1 || e.key === branchKey2) {
						const wantBefore = e.key === branchKey1;
						const children = currentLn.children || [];

						// Check if children are in the pressed direction
						const childrenInDir = children.filter(c => {
							const cPos = branchAxis === 'y' ? c.cy : c.cx;
							return wantBefore ? cPos < myBranchPos : cPos > myBranchPos;
						});

						if (childrenInDir.length > 0) {
							// Enter branch children
							const best = childrenInDir.reduce((a, b) => {
								const da = Math.abs((spineAxis === 'x' ? a.cx : a.cy) - (spineAxis === 'x' ? currentLn.cx : currentLn.cy));
								const db = Math.abs((spineAxis === 'x' ? b.cx : b.cy) - (spineAxis === 'x' ? currentLn.cx : currentLn.cy));
								return da < db ? a : b;
							});
							navigateToPath(best.node.path);
						} else {
							// Cross to other side: nearest spine node on opposite side by spine-axis
							const oppositeSide = mySpineSide === 'before' ? 'after' : 'before';
							const otherSide = allSpine.filter(ln => {
								const lnBranchPos = branchAxis === 'y' ? ln.cy : ln.cx;
								const lnSide = lnBranchPos < rootBranchPos ? 'before' : 'after';
								return lnSide === oppositeSide;
							});
							const mySpinePos = spineAxis === 'x' ? currentLn.cx : currentLn.cy;
							otherSide.sort((a, b) => {
								const da = Math.abs((spineAxis === 'x' ? a.cx : a.cy) - mySpinePos);
								const db = Math.abs((spineAxis === 'x' ? b.cx : b.cy) - mySpinePos);
								return da - db;
							});
							const nearest = otherSide[0] ?? null;
							if (nearest) {
								navigateToPath(nearest.node.path);
							}
						}
					}
				} else {
					// Branch node (depth 2+)
					// Helpers: walk up to depth-1 ancestor and determine spine side
					const getSpineAncestor = (ln: LayoutNode<T>): LayoutNode<T> => {
						let a = ln;
						while (a.parent && a.depth > 1) a = a.parent;
						return a;
					};
					const getSpineSide = (ln: LayoutNode<T>): 'before' | 'after' => {
						const coord = branchAxis === 'y' ? ln.cy : ln.cx;
						const spine = getSpineAncestor(ln);
						const spineCoord = branchAxis === 'y' ? spine.cy : spine.cx;
						return coord < spineCoord ? 'before' : 'after';
					};

					const spineAnc = getSpineAncestor(currentLn);
					const mySide = getSpineSide(currentLn);
					if (e.key === spineForwardKey || e.key === spineBackKey) {
						// Left/Right: same-side siblings at same depth across all spine branches
						const forward = e.key === spineBackKey;
						const sameSideSiblings = layoutNodes.filter(ln =>
							ln.depth === currentLn.depth && getSpineSide(ln) === mySide
						);
						const neighbor = findNearest(currentLn, sameSideSiblings, spineAxis, forward);
						if (neighbor) {
							navigateToPath(neighbor.node.path);
						} else if (e.key === spineBackKey) {
							// No more same-side siblings toward root — go to spine ancestor
							navigateToPath(spineAnc.node.path);
						}
					} else if (e.key === branchKey1 || e.key === branchKey2) {
						// Up/Down: parent/child within branch, then cross-spine
						const wantBefore = e.key === branchKey1;
						const myPos = branchAxis === 'y' ? currentLn.cy : currentLn.cx;
						const parent = currentLn.parent;
						const parentPos = parent ? (branchAxis === 'y' ? parent.cy : parent.cx) : null;
						const parentIsBefore = parentPos !== null && parentPos < myPos;
						const parentIsAfter = parentPos !== null && parentPos > myPos;
						const parentIsBranch = parent !== null && parent.depth > 1;
						const children = currentLn.children || [];

						// Check if children exist in the desired direction
						const childrenInDir = children.filter(c => {
							const cPos = branchAxis === 'y' ? c.cy : c.cx;
							return wantBefore ? cPos < myPos : cPos > myPos;
						});

						// Priority 1: Parent is in that direction (branch or spine — return to spine before crossing)
						if ((wantBefore ? parentIsBefore : parentIsAfter) && parent) {
							navigateToPath(parent.node.path);
						}
						// Priority 2: Children in that direction → go to nearest child
						else if (childrenInDir.length > 0) {
							const best = childrenInDir.reduce((a, b) => {
								const da = Math.abs((spineAxis === 'x' ? a.cx : a.cy) - (spineAxis === 'x' ? currentLn.cx : currentLn.cy));
								const db = Math.abs((spineAxis === 'x' ? b.cx : b.cy) - (spineAxis === 'x' ? currentLn.cx : currentLn.cy));
								return da < db ? a : b;
							});
							navigateToPath(best.node.path);
						}
						// Priority 3: Cross to other side of spine (gated by fishboneCrossNav)
						else if (fishboneCrossNav) {
							const oppositeSide = mySide === 'before' ? 'after' : 'before';
							const crossCandidates = layoutNodes.filter(ln =>
								ln.depth === currentLn.depth && getSpineSide(ln) === oppositeSide
							);
							const nearest = findNearest(currentLn, crossCandidates, spineAxis, true)
								|| findNearest(currentLn, crossCandidates, spineAxis, false);
							if (nearest) {
								navigateToPath(nearest.node.path);
							} else if (parent) {
								navigateToPath(parent.node.path);
							}
						}
						// Priority 4: Fallback — go to parent (always available when P3 skipped)
						else if (parent) {
							navigateToPath(parent.node.path);
						}
					}
				}
				return;
			}

			if (action === 'crossPrev' || action === 'crossNext') {
				const { axis, forward } = resolveAxis(action);
				const neighbor = findSpatialNeighborAtDepth(currentLn, axis, forward);
				if (neighbor) navigateToPath(neighbor.node.path);
			} else if (action === 'treeForward') {
				// Go to first child if expanded
				if (node.hasChildren && node.isExpanded) {
					const children = ctrlRef.getChildren(node.path);
					if (children.length > 0) navigateToPath(children[0].path);
				}
			} else if (action === 'treeBack') {
				// Go to parent
				if (node.parentPath) navigateToPath(node.parentPath);
			}
		}
	}

	function navigateToPath(path: string) {
		selectedPath = path;
		doLayout(); // ensure node is in layout (may have been expanded)
		interaction.ensurePathVisible(path);
	}

	// ── Effects ─────────────────────────────────────────────────────────

	// Clear text cache when font changes
	$effect(() => {
		const _font = fontStr;
		textCache.setFont(_font);
	});

	// Reposition viewport when growth direction changes via binding
	let prevDirection: GrowthDirection | null = null;
	$effect(() => {
		const dir = growthDirection;
		if (prevDirection !== null && prevDirection !== dir && containerEl) {
			// Direction changed — reposition pan to show root
			doLayout();
			const { x, y } = panForDirection(dir);
			interaction.setPan(x, y);
			interaction.setZoom(1);
			requestRedraw();
		}
		prevDirection = dir;
	});

	// Rebuild layout when tree or config changes
	$effect(() => {
		if (!ctrlRef || !canvasEl) return;
		const _tracker = ctrlRef.tree.changeTracker;
		const _direction = growthDirection;
		const _grouped = groupSiblings;
		const _dots = showDotGrid;
		const _layoutMode = layoutMode;
		// Track all layout-affecting state
		void [columnGap, gridNodeMaxW, nodeHeight, nodeGap, levelSpacingV,
			nodePaddingX, nodeMinWidth, colorBarWidth, fontSize, fontFamily,
			gridGap, groupPadding, maxGridCols, depthColors, levelConfig,
			zoomLodText, zoomLodSimple, balancedSplit, radialStartAngle, radialSpacing,
			sunburstRingWidth, sunburstRootTitle];
		console.log('[effect:relayout] triggered — changeTracker or config changed');
		doLayout();
		requestRedraw();
	});

	// Read CSS theme variables from container
	$effect(() => {
		if (!containerEl) return;
		void themePropOverrides; // re-run when prop overrides change
		buildTheme();
	});

	// ResizeObserver
	$effect(() => {
		if (!containerEl) return;
		const ro = new ResizeObserver(() => {
			buildTheme();
			requestRedraw();
		});
		ro.observe(containerEl);
		return () => ro.disconnect();
	});

	// Cleanup rAF
	$effect(() => {
		return () => {
			if (rafId != null) cancelAnimationFrame(rafId);
		};
	});

	onDestroy(() => {
		interaction.destroy();
	});

	// ── Public Methods ──────────────────────────────────────────────────

	export function zoomToFit() {
		interaction.zoomToFit();
	}

	export function focusOnPath(path: string, options?: FocusOptions) {
		if (!ctrlRef) return;
		const node = ctrlRef.getNodeByPath(path);
		if (!node) return;
		if (node.parentPath) {
			ctrlRef.expandNodes(node.parentPath);
			doLayout();
		}
		interaction.focusOnPath(path, options);
	}

	/** Scroll to a node without changing level-axis pan.
	 *  In horizontal layout: only adjusts vertical scroll.
	 *  In vertical layout: only adjusts horizontal scroll.
	 *  If the node is already visible, does nothing. */
	export function scrollToPath(path: string) {
		if (!ctrlRef) return;
		const node = ctrlRef.getNodeByPath(path);
		if (!node) return;
		if (node.parentPath) {
			ctrlRef.expandNodes(node.parentPath);
			doLayout();
		}
		interaction.scrollToPath(path);
	}

	export function expandAll(nodePath?: string | null) {
		if (!ctrlRef) return;
		if (layoutMode === 'sunburst') {
			sunburstExpandAll(ctrlRef, nodePath ?? null);
		} else {
			ctrlRef.expandAll(nodePath);
		}
		recomputeAndDraw();
	}

	/** Sunburst-aware expand: at each parent, check if children would overflow
	 *  into sub-rings. If they fit → expand ALL. If overflow → only the biggest.
	 *  This adapts to the angular space available at each depth. */
	function sunburstExpandAll(ctrl: TreeController<T>, nodePath: string | null) {
		const MIN_ARC = 40; // matches MIN_ARC_PX in canvas-layout-sunburst.ts
		const MIN_EXPAND_SWEEP = 0.15; // ~8.6°, stop recursing into narrower slices
		const rw = sunburstRingWidth;

		function countAllDescendants(node: LTreeNode<T>): number {
			const children = Object.values(node.children);
			if (children.length === 0) return 0;
			let total = children.length;
			for (const child of children) total += countAllDescendants(child);
			return total;
		}

		function expandNode(node: LTreeNode<T>, depth: number, parentSweep: number) {
			if (!node.hasChildren) return;
			ctrl.expandNodes(node.path);

			const children = ctrl.getChildren(node.path);
			if (children.length === 0) return;

			const childDepth = depth + 1;
			const midR = childDepth * rw + rw / 2;
			const capacity = Math.floor(parentSweep * midR / MIN_ARC);

			// Count total descendants for sweep distribution
			const descCounts: { child: LTreeNode<T>; count: number }[] = [];
			let totalDesc = 0;
			for (const child of children) {
				const count = Math.max(1, countAllDescendants(child));
				descCounts.push({ child, count });
				totalDesc += count;
			}

			if (children.length <= capacity) {
				// Fits without overflow → expand ALL children
				for (const { child, count } of descCounts) {
					const childSweep = parentSweep * (count / totalDesc);
					// Only recurse deeper if child's slice is wide enough to be readable
					if (childSweep >= MIN_EXPAND_SWEEP) {
						expandNode(child, childDepth, childSweep);
					}
				}
			} else {
				// Would overflow → only expand the biggest child
				descCounts.sort((a, b) => b.count - a.count);
				const biggest = descCounts[0];
				// Collapse collapsible siblings
				for (const child of children) {
					if (child.path !== biggest.child.path && child.isExpanded && ctrl.getNodeIsCollapsible(child)) {
						ctrl.collapseNodes(child.path);
					}
				}
				const biggestSweep = parentSweep * (biggest.count / totalDesc);
				if (biggestSweep >= MIN_EXPAND_SWEEP) {
					expandNode(biggest.child, childDepth, biggestSweep);
				}
			}
		}

		if (nodePath) {
			const node = ctrl.tree.getNodeByPath(nodePath);
			if (node) expandNode(node, node.level ?? 0, Math.PI * 2);
		} else {
			for (const root of ctrl.tree.tree) {
				expandNode(root, 0, Math.PI * 2);
			}
		}
	}

	export function collapseAll(nodePath?: string | null) {
		if (!ctrlRef) return;
		ctrlRef.collapseAll(nodePath);
		recomputeAndDraw();
	}

	export function searchNodes(query: string): LTreeNode<T>[] {
		if (!ctrlRef) return [];
		searchResults = ctrlRef.searchNodes(query);
		matchedPaths = new Set(searchResults.map(n => n.path));
		if (searchResults.length > 0) {
			currentResultIndex = 0;
			navigateToResult(0);
		} else {
			currentResultIndex = -1;
			requestRedraw();
		}
		return searchResults;
	}

	export function filterNodes(query: string) {
		if (!ctrlRef) return;
		ctrlRef.filterNodes(query);
		// changeTracker effect handles layout recomputation
	}

	export function clearSearch() {
		searchResults = [];
		currentResultIndex = -1;
		matchedPaths = new Set();
		if (ctrlRef) ctrlRef.filterNodes('');
		requestRedraw();
	}

	export function navigateToResult(index: number) {
		if (!ctrlRef || searchResults.length === 0) return;
		currentResultIndex = ((index % searchResults.length) + searchResults.length) % searchResults.length;
		const node = searchResults[currentResultIndex];
		selectedPath = node.path;
		if (node.parentPath) {
			ctrlRef.expandNodes(node.parentPath);
		}
		doLayout();
		const ln = layoutNodes.find(n => n.node.path === node.path);
		if (ln) interaction.focusOnNode(ln);
		else requestRedraw();
	}

	export function nextResult() {
		if (searchResults.length === 0) return;
		navigateToResult(currentResultIndex + 1);
	}

	export function prevResult() {
		if (searchResults.length === 0) return;
		navigateToResult(currentResultIndex - 1);
	}

	export function getSearchResults() {
		return { results: searchResults, currentIndex: currentResultIndex, matchedPaths };
	}

	/** Compute the initial pan so the viewport starts at the root's corner or at the origin */
	function panForDirection(dir: GrowthDirection): { x: number; y: number } {
		const pad = 40;
		if (initialViewport === 'origin') {
			console.log(`[panForDirection] dir=${dir}, initialViewport=${initialViewport} → pan=(${pad}, ${pad})`);
			return { x: pad, y: pad };
		}
		const rect = containerEl?.getBoundingClientRect();
		const cw = rect?.width ?? 800;
		const ch = rect?.height ?? 600;
		// Center the viewport on the root node:
		// - horizontal dirs (left/right): root is at one horizontal edge, vertically centered
		// - vertical dirs (up/down): root is at one vertical edge, horizontally centered
		const centerY = (ch - layoutHeight) / 2;
		const centerX = (cw - layoutWidth) / 2;
		let result: { x: number; y: number };
		switch (dir) {
			case 'right': result = { x: pad, y: centerY }; break;
			case 'left':  result = { x: cw - layoutWidth - pad, y: centerY }; break;
			case 'down':  result = { x: centerX, y: pad }; break;
			case 'up':    result = { x: centerX, y: ch - layoutHeight - pad }; break;
		}
		console.log(`[panForDirection] dir=${dir}, initialViewport=${initialViewport}, container=${cw}x${ch}, layout=${layoutWidth}x${layoutHeight} → pan=(${result.x}, ${result.y})`);
		return result;
	}

	export function setGrowthDirection(dir: GrowthDirection) {
		growthDirection = dir;
		interaction.setZoom(1);
		doLayout();
		const { x, y } = panForDirection(dir);
		interaction.setPan(x, y);
		requestRedraw();
	}

	/** @deprecated Use setGrowthDirection instead */
	export function setOrientation(o: Orientation) {
		setGrowthDirection(o === 'vertical' ? 'down' : 'right');
	}

	export function getLayoutNodes(): LayoutNode<T>[] {
		return layoutNodes;
	}

	export function refreshTheme() {
		buildTheme();
		requestRedraw();
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<TreeProvider
	{data}
	{idMember}
	{pathMember}
	{sortCallback}
	{isSorted}
	{expandLevel}
	parentPathMember={parentPathMember}
	levelMember={levelMember}
	hasChildrenMember={hasChildrenMember}
	displayValueMember={displayValueMember}
	getDisplayValueCallback={getDisplayValueCallback}
	searchValueMember={searchValueMember}
	getSearchValueCallback={getSearchValueCallback}
	treePathSeparator={treePathSeparator}
	dragDropMode={dragDropMode}
	shouldUseInternalSearchIndex={shouldUseInternalSearchIndex}
	isExpandedMember={isExpandedMember}
	isDraggableMember={isDraggableMember}
	getIsDraggableCallback={getIsDraggableCallback}
	isDropAllowedMember={isDropAllowedMember}
	allowedDropPositionsMember={allowedDropPositionsMember}
	getAllowedDropPositionsCallback={getAllowedDropPositionsCallback}
	isCollapsibleMember={isCollapsibleMember}
	getIsCollapsibleCallback={getIsCollapsibleCallback}
	orderMember={orderMember}
	contextMenuCallback={onNodeContextMenuCb}
	contextMenuXOffset={8}
	contextMenuYOffset={4}
>
	{#snippet children(ctrl)}
		{@const _init = captureCtrl(ctrl)}
		<div class="canvas-tree-wrapper" bind:this={containerEl}>
			<canvas
				bind:this={canvasEl}
				onwheel={interaction.onWheel}
				onmousedown={interaction.onMouseDown}
				onmousemove={interaction.onMouseMove}
				onmouseup={interaction.onMouseUp}
				onmouseleave={interaction.onMouseLeave}
				oncontextmenu={interaction.onContextMenu}
			></canvas>
		</div>

		{#if tooltipLn && !ctrl.contextMenuVisible}
			<div class="canvas-tree-tooltip" style="position: fixed; left: {tooltipX}px; top: {tooltipY}px;">
				{#if tooltipSnippet}
					{@render tooltipSnippet(tooltipLn.node, getLabel(tooltipLn.node))}
				{:else}
					<strong>{getLabel(tooltipLn.node)}</strong>
					<span class="canvas-tree-tooltip-meta">Path: {tooltipLn.node.path}</span>
					{#if tooltipLn.node.hasChildren}
						<span class="canvas-tree-tooltip-meta">Children: {Object.keys(tooltipLn.node.children).length}{tooltipLn.node.isExpanded ? ' (expanded)' : ''}</span>
					{/if}
				{/if}
			</div>
		{/if}

		{#if ctrl.contextMenuVisible && ctrl.contextMenuNode}
			{@const menuItems = ctrl.contextMenuCallbackCb?.(ctrl.contextMenuNode, ctrl.closeContextMenu.bind(ctrl)) || []}
			<div class="canvas-tree-ctx-menu" style="position: fixed; left: {ctrl.contextMenuX}px; top: {ctrl.contextMenuY}px;">
				<div class="canvas-tree-ctx-menu-header">{getLabel(ctrl.contextMenuNode as LTreeNode<T>)}</div>
				{#each menuItems as item}
					{#if item.isDivider}
						<div class="canvas-tree-ctx-menu-divider"></div>
					{:else}
						<button
							class="canvas-tree-ctx-menu-item"
							class:disabled={item.isDisabled}
							disabled={item.isDisabled}
							onclick={() => { item.callback(); ctrl.closeContextMenu(); }}
						>{item.icon ? `${item.icon} ` : ''}{item.title}</button>
					{/if}
				{/each}
			</div>
		{/if}
	{/snippet}
</TreeProvider>

<style>
	.canvas-tree-wrapper {
		width: 100%;
		height: 100%;
		min-height: 200px;
		overflow: hidden;
		position: relative;
	}

	.canvas-tree-wrapper canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.canvas-tree-tooltip {
		pointer-events: none;
		background: var(--ct-tooltip-bg, #1e293b);
		color: var(--ct-tooltip-text, #f1f5f9);
		padding: 6px 10px;
		border-radius: var(--ct-tooltip-radius, 6px);
		font-size: 0.8rem;
		line-height: 1.4;
		max-width: 280px;
		z-index: 1000;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.canvas-tree-tooltip strong {
		display: block;
		margin-bottom: 2px;
	}

	:global(.canvas-tree-tooltip-meta) {
		display: block;
		color: #94a3b8;
		font-size: 0.75rem;
	}

	.canvas-tree-ctx-menu {
		background: var(--ct-menu-bg, #1e293b);
		border-radius: var(--ct-menu-radius, 8px);
		padding: 4px 0;
		min-width: 160px;
		z-index: 1000;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
	}

	.canvas-tree-ctx-menu-header {
		padding: 6px 12px;
		font-size: 0.75rem;
		color: #94a3b8;
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 200px;
	}

	.canvas-tree-ctx-menu-item {
		display: block;
		width: 100%;
		padding: 6px 12px;
		border: none;
		background: none;
		color: var(--ct-menu-text, #f1f5f9);
		font-size: 0.8rem;
		text-align: left;
		cursor: pointer;
		white-space: nowrap;
	}

	.canvas-tree-ctx-menu-item:hover:not(:disabled) {
		background: var(--ct-menu-hover, #334155);
	}

	.canvas-tree-ctx-menu-item.disabled {
		opacity: 0.4;
		cursor: default;
	}

	.canvas-tree-ctx-menu-divider {
		height: 1px;
		background: var(--ct-menu-hover, #334155);
		margin: 4px 0;
	}
</style>
