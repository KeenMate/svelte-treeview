<script lang="ts" generics="T">
	import { onDestroy } from 'svelte';
	import TreeProvider from '../components/TreeProvider.svelte';
	import { TreeController, type TreeControllerProps } from '../core/TreeController.svelte.js';
	import type { LTreeNode } from '../ltree/ltree-node.svelte.js';
	import type { DropPosition, ContextMenuItem } from '../ltree/types.js';
	import type {
		Orientation,
		ClickBehavior,
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
		CanvasLevelConfig
	} from './types.js';
	import { createTextCache } from './canvas-text.js';
	import { computeLayout } from './canvas-layout.js';
	import type { CanvasTheme } from './canvas-theme.js';
	import { defaultCanvasTheme, readCssTheme, resolveTheme } from './canvas-theme.js';
	import {
		drawConnections,
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
		isDropAllowedMember?: string;
		allowedDropPositionsMember?: string;
		getAllowedDropPositionsCallback?: (node: LTreeNode<T>) => import('../ltree/types.js').DropPosition[] | null;
		orderMember?: string;

		// Canvas Visual Config
		orientation?: Orientation;
		groupSiblings?: boolean;
		showDotGrid?: boolean;
		clickBehavior?: ClickBehavior;
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
		isDropAllowedMember,
		allowedDropPositionsMember,
		getAllowedDropPositionsCallback,
		orderMember,

		// Visual config
		orientation = $bindable('horizontal'),
		groupSiblings = $bindable(true),
		showDotGrid = $bindable(false),
		clickBehavior = $bindable('expand'),
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

		// Theme overrides
		theme: themePropOverrides,
	}: Props = $props();

	// ── Internal State ──────────────────────────────────────────────────

	let canvasEl: HTMLCanvasElement | undefined = $state();
	let containerEl: HTMLDivElement | undefined = $state();
	let ctrlRef: TreeController<T> | null = null;
	let rafId: number | null = null;

	// Layout data (non-reactive for performance)
	let layoutNodes: LayoutNode<T>[] = [];
	let groupBoxes: import('./types.js').GroupBox[] = [];
	let layoutWidth = 0;
	let layoutHeight = 0;
	let levelXArr: number[] = [0];

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
				orientation
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
		const result = computeLayout(
			ctrlRef,
			orientation,
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
			}
		);
		layoutNodes = result.nodes;
		groupBoxes = result.groupBoxes;
		layoutWidth = result.width;
		layoutHeight = result.height;
		levelXArr = result.levelXArr;
		layoutTime = result.time;
		totalCount = result.nodes.length;
	}

	// ── Draw ────────────────────────────────────────────────────────────

	function draw() {
		if (!canvasEl || !containerEl) return;
		const t0 = performance.now();
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
		if (showDotGrid) {
			drawDotGrid(ctx, cw, ch, iState.panX, iState.panY, iState.zoom, theme);
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

		const isV = orientation === 'vertical';
		const isSearchActive = matchedPaths.size > 0;

		// Connections
		drawConnections(ctx, layoutNodes, levelXArr, isV, columnGap, levelSpacingV, vl, vt, vr, vb, theme);

		// Group boxes
		drawGroupBoxes(ctx, groupBoxes, getDepthColor, zoomLodSimple, zoomLodText, iState.zoom, vl, vt, vr, vb);

		// Nodes
		const lodText = iState.zoom >= zoomLodText;
		const lodSimple = iState.zoom < zoomLodSimple;
		let visible = 0;

		const visualConfig: CanvasVisualConfig = {
			nodeHeight,
			nodeMinWidth,
			nodePaddingX,
			colorBarWidth,
			font: fontStr,
			fontBold,
			getDepthColor,
			orientation
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

		// Drop zone buttons
		if (iState.isDragging && iState.dropTarget) {
			drawDropZones(ctx, iState.dropTarget as LayoutNode<T>, iState.dropPosition, isV, theme);
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
		drawMinimap(
			ctx, layoutNodes, groupBoxes,
			layoutWidth, layoutHeight,
			getDepthColor, selectedPath,
			iState.panX, iState.panY, iState.zoom,
			cw, ch,
			theme
		);

		visibleCount = visible;
		drawTime = performance.now() - t0;
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
		doLayout();
		requestRedraw();
	}

	// ── Interaction Manager ─────────────────────────────────────────────

	const interaction = createInteractionManager<T>(
		{
			getCanvas: () => canvasEl,
			getContainer: () => containerEl,
			getLayoutNodes: () => layoutNodes,
			getLayoutSize: () => ({ width: layoutWidth, height: layoutHeight }),
			getOrientation: () => orientation,
			requestRedraw,
			onNodeClick: (ln, chevronHit) => {
				const shouldToggle = ln.node.hasChildren && (
					clickBehavior !== 'select' || chevronHit
				);
				if (shouldToggle) {
					if (ln.node.isExpanded) ctrlRef!.collapseNodes(ln.node.path);
					else ctrlRef!.expandNodes(ln.node.path);
					recomputeAndDraw();
				}
				onNodeClickCb?.(ln.node);
			},
			onDragDrop: (src, target, position) => {
				if (ctrlRef) {
					const result = ctrlRef.moveNode(src.node.path, target.node.path, position);
					if (result.success) {
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
			getNodeLabel: (ln) => getLabel(ln.node)
		},
		{
			getClickBehavior: () => clickBehavior,
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

		const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
		if (!isArrow) return;
		e.preventDefault();

		const currentLn = layoutNodes.find(ln => ln.node.path === node.path);
		if (!currentLn) return;
		const isV = orientation === 'vertical';
		const box = findContainingGroupBox(currentLn);

		if (box) {
			// ── Inside a group box: navigate like Excel within the grid ──
			const groupNodes = getNodesInGroupBox(box);
			const crossAxis = isV ? 'x' : 'y'; // Up/Down axis
			const treeAxis = isV ? 'y' : 'x';  // Left/Right axis

			if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
				const forward = e.key === 'ArrowDown';
				const neighbor = findNearest(currentLn, groupNodes, crossAxis, forward);
				if (neighbor) {
					navigateToPath(neighbor.node.path);
				} else {
					// At edge of group — escape to nearest same-depth node outside
					const outer = findSpatialNeighborAtDepth(currentLn, crossAxis, forward);
					if (outer) navigateToPath(outer.node.path);
				}
			} else if (e.key === 'ArrowRight') {
				const neighbor = findNearest(currentLn, groupNodes, treeAxis, true);
				if (neighbor) {
					navigateToPath(neighbor.node.path);
				}
				// At right edge of group → do nothing (no children to navigate to from grouped node)
			} else if (e.key === 'ArrowLeft') {
				const neighbor = findNearest(currentLn, groupNodes, treeAxis, false);
				if (neighbor) {
					navigateToPath(neighbor.node.path);
				} else if (node.parentPath) {
					// At left edge of group → go to parent
					navigateToPath(node.parentPath);
				}
			}
		} else {
			// ── Outside a group box: individually laid out nodes ──
			if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
				const axis = isV ? 'x' : 'y';
				const forward = e.key === 'ArrowDown';
				const neighbor = findSpatialNeighborAtDepth(currentLn, axis, forward);
				if (neighbor) navigateToPath(neighbor.node.path);
			} else if (e.key === 'ArrowRight') {
				// Go to first child if expanded
				if (node.hasChildren && node.isExpanded) {
					const children = ctrlRef.getChildren(node.path);
					if (children.length > 0) navigateToPath(children[0].path);
				}
			} else if (e.key === 'ArrowLeft') {
				// Go to parent
				if (node.parentPath) navigateToPath(node.parentPath);
			}
		}
	}

	function navigateToPath(path: string) {
		selectedPath = path;
		doLayout(); // ensure node is in layout (may have been expanded)
		interaction.scrollToPath(path);
	}

	// ── Effects ─────────────────────────────────────────────────────────

	// Clear text cache when font changes
	$effect(() => {
		const _font = fontStr;
		textCache.setFont(_font);
	});

	// Rebuild layout when tree or config changes
	$effect(() => {
		if (!ctrlRef || !canvasEl) return;
		const _tracker = ctrlRef.tree.changeTracker;
		const _orient = orientation;
		const _grouped = groupSiblings;
		const _dots = showDotGrid;
		// Track all layout-affecting state
		void [columnGap, gridNodeMaxW, nodeHeight, nodeGap, levelSpacingV,
			nodePaddingX, nodeMinWidth, colorBarWidth, fontSize, fontFamily,
			gridGap, groupPadding, maxGridCols, depthColors, levelConfig,
			zoomLodText, zoomLodSimple];
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

	export function focusOnPath(path: string) {
		if (!ctrlRef) return;
		const node = ctrlRef.getNodeByPath(path);
		if (!node) return;
		if (node.parentPath) {
			ctrlRef.expandNodes(node.parentPath);
			doLayout();
		}
		interaction.focusOnPath(path);
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
		ctrlRef.expandAll(nodePath);
		recomputeAndDraw();
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

	export function setOrientation(o: Orientation) {
		orientation = o;
		interaction.setPan(40, 40);
		interaction.setZoom(1);
		recomputeAndDraw();
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
	isDropAllowedMember={isDropAllowedMember}
	allowedDropPositionsMember={allowedDropPositionsMember}
	getAllowedDropPositionsCallback={getAllowedDropPositionsCallback}
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

		{@const iState = interaction.getState()}

		{#if iState.tooltipNode && !ctrl.contextMenuVisible}
			{@const tn = iState.tooltipNode as LayoutNode<T>}
			<div class="canvas-tree-tooltip" style="position: fixed; left: {iState.tooltipScreenX}px; top: {iState.tooltipScreenY}px;">
				<strong>{getLabel(tn.node)}</strong>
				<span class="canvas-tree-tooltip-meta">Path: {tn.node.path}</span>
				{#if tn.node.hasChildren}
					<span class="canvas-tree-tooltip-meta">Children: {Object.keys(tn.node.children).length}{tn.node.isExpanded ? ' (expanded)' : ''}</span>
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
