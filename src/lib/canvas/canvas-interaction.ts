import type { LayoutNode, DropPosition, ClickBehavior, FocusOptions, FocusAnchor, FocusZoom } from './types.js';
import {
	getDropZones,
	hitTestDropZone,
	closestDropZone,
	minimapWorldFromScreen
} from './canvas-renderer.js';

export interface InteractionConfig {
	getClickBehavior: () => ClickBehavior;
	getDragDropMode: () => string;
	animDuration: number;
}

export interface InteractionCallbacks<T> {
	getCanvas: () => HTMLCanvasElement | undefined;
	getContainer: () => HTMLDivElement | undefined;
	getLayoutNodes: () => LayoutNode<T>[];
	getLayoutSize: () => { width: number; height: number };
	getDirection: () => { isV: boolean; isReversed: boolean };
	requestRedraw: () => void;
	onNodeClick: (ln: LayoutNode<T>, chevronHit: boolean) => void;
	onDragDrop: (src: LayoutNode<T>, target: LayoutNode<T>, position: DropPosition) => void;
	onContextMenu: (ln: LayoutNode<T>, clientX: number, clientY: number) => void;
	onCloseContextMenu: () => void;
	onHoverChange: (ln: LayoutNode<T> | null) => void;
	onSelectionChange: (path: string | null) => void;
	getNodeLabel: (ln: LayoutNode<T>) => string;
	hitTestOverride?: () => ((wx: number, wy: number) => LayoutNode<T> | null) | null;
	/** Update tooltip position without triggering a full canvas redraw */
	onTooltipPositionChange?: (node: LayoutNode<T>, x: number, y: number) => void;
}

export interface InteractionState {
	panX: number;
	panY: number;
	zoom: number;
	hoveredNode: LayoutNode<any> | null;
	dragSrcNode: LayoutNode<any> | null;
	isDragging: boolean;
	dragX: number;
	dragY: number;
	dropTarget: LayoutNode<any> | null;
	dropPosition: DropPosition;
	isPanning: boolean;
	tooltipNode: LayoutNode<any> | null;
	tooltipScreenX: number;
	tooltipScreenY: number;
}

export function createInteractionManager<T>(
	callbacks: InteractionCallbacks<T>,
	config: InteractionConfig
) {
	// Internal state
	let panX = 40;
	let panY = 40;
	let zoom = 1;
	let isPanning = false;
	let panStartX = 0;
	let panStartY = 0;
	let panStartPanX = 0;
	let panStartPanY = 0;

	let dragSrcNode: LayoutNode<T> | null = null;
	let dragStartX = 0;
	let dragStartY = 0;
	let isDragging = false;
	let dragX = 0;
	let dragY = 0;
	let dropTarget: LayoutNode<T> | null = null;
	let dropPosition: DropPosition = 'child';

	let hoveredNode: LayoutNode<T> | null = null;
	let panClickNode: LayoutNode<T> | null = null;
	let isMinimapPanning = false;

	// Tooltip
	let tooltipNode: LayoutNode<T> | null = null;
	let tooltipScreenX = 0;
	let tooltipScreenY = 0;
	let tooltipTimer: ReturnType<typeof setTimeout> | null = null;
	let lastClientX = 0;
	let lastClientY = 0;

	// Hover throttle: only run hit test once per animation frame
	let hoverRafPending = false;
	let pendingHoverEvent: MouseEvent | null = null;

	// Animation
	let animFrom: { panX: number; panY: number; zoom: number } | null = null;
	let animTo: { panX: number; panY: number; zoom: number } | null = null;
	let animStartTime = 0;

	function screenToWorld(sx: number, sy: number): [number, number] {
		return [(sx - panX) / zoom, (sy - panY) / zoom];
	}

	let _hitTestCount = 0;
	let _hitTestTime = 0;
	let _hitTestLogTimer: ReturnType<typeof setInterval> | null = null;

	function _startHitTestLog() {
		if (_hitTestLogTimer) return;
		_hitTestLogTimer = setInterval(() => {
			if (_hitTestCount > 0) {
				console.log(`[hitTest] ${_hitTestCount} calls in 1s, total=${_hitTestTime.toFixed(1)}ms, avg=${(_hitTestTime / _hitTestCount).toFixed(2)}ms`);
				_hitTestCount = 0;
				_hitTestTime = 0;
			}
		}, 1000);
	}

	function hitTest(wx: number, wy: number): LayoutNode<T> | null {
		const ht0 = performance.now();
		const override = callbacks.hitTestOverride?.();
		let result: LayoutNode<T> | null;
		if (override) {
			result = override(wx, wy);
		} else {
			result = null;
			const nodes = callbacks.getLayoutNodes();
			for (let i = nodes.length - 1; i >= 0; i--) {
				const n = nodes[i];
				if (n.isVirtual) continue;
				if (wx >= n.x && wx <= n.x + n.w && wy >= n.y && wy <= n.y + n.h) {
					result = n;
					break;
				}
			}
		}
		_hitTestCount++;
		_hitTestTime += performance.now() - ht0;
		_startHitTestLog();
		return result;
	}

	function isChevronHit(ln: LayoutNode<T>, wx: number, wy: number): boolean {
		if (!ln.node.hasChildren) return false;
		const chevLeft = ln.x + ln.w - 20;
		return wx >= chevLeft && wx <= ln.x + ln.w && wy >= ln.y && wy <= ln.y + ln.h;
	}

	function clearTooltip() {
		if (tooltipTimer) {
			clearTimeout(tooltipTimer);
			tooltipTimer = null;
		}
		tooltipNode = null;
	}

	function easeOutCubic(t: number): number {
		return 1 - Math.pow(1 - t, 3);
	}

	function animateStep() {
		if (!animFrom || !animTo) return;
		const elapsed = performance.now() - animStartTime;
		const t = Math.min(1, elapsed / config.animDuration);
		const e = easeOutCubic(t);
		panX = animFrom.panX + (animTo.panX - animFrom.panX) * e;
		panY = animFrom.panY + (animTo.panY - animFrom.panY) * e;
		zoom = animFrom.zoom + (animTo.zoom - animFrom.zoom) * e;
		callbacks.requestRedraw();
		if (t < 1) {
			requestAnimationFrame(animateStep);
		} else {
			animFrom = null;
			animTo = null;
		}
	}

	// ── Public Event Handlers ───────────────────────────────────────────

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		clearTooltip();
		callbacks.onCloseContextMenu();
		const canvas = callbacks.getCanvas();
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;
		const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
		const newZoom = Math.max(0.05, Math.min(3, zoom * factor));
		const ratio = newZoom / zoom;
		panX = mx - (mx - panX) * ratio;
		panY = my - (my - panY) * ratio;
		zoom = newZoom;
		callbacks.requestRedraw();
	}

	function onMouseDown(e: MouseEvent) {
		if (e.button !== 0) return;
		callbacks.onCloseContextMenu();
		const canvas = callbacks.getCanvas();
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		const { width: lw, height: lh } = callbacks.getLayoutSize();
		const mmWorld = minimapWorldFromScreen(mx, my, lw, lh, rect.width, rect.height);
		if (mmWorld) {
			isMinimapPanning = true;
			panX = rect.width / 2 - mmWorld[0] * zoom;
			panY = rect.height / 2 - mmWorld[1] * zoom;
			callbacks.requestRedraw();
			return;
		}

		const [wx, wy] = screenToWorld(mx, my);
		const hit = hitTest(wx, wy);
		if (hit && config.getDragDropMode() !== 'none') {
			dragSrcNode = hit;
			dragStartX = mx;
			dragStartY = my;
			isDragging = false;
		} else {
			// No hit or drag-drop disabled: pan the canvas
			// Track the hit node so a click (no movement) still fires node selection
			panClickNode = hit;
			isPanning = true;
			panStartX = mx;
			panStartY = my;
			panStartPanX = panX;
			panStartPanY = panY;
		}
	}

	function onMouseMove(e: MouseEvent) {
		const canvas = callbacks.getCanvas();
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		if (isMinimapPanning) {
			const { width: lw, height: lh } = callbacks.getLayoutSize();
			const mmWorld = minimapWorldFromScreen(mx, my, lw, lh, rect.width, rect.height);
			if (mmWorld) {
				panX = rect.width / 2 - mmWorld[0] * zoom;
				panY = rect.height / 2 - mmWorld[1] * zoom;
			}
			callbacks.requestRedraw();
			return;
		}

		if (isPanning) {
			panX = panStartPanX + (mx - panStartX);
			panY = panStartPanY + (my - panStartY);
			callbacks.requestRedraw();
			return;
		}

		if (dragSrcNode && !isDragging && config.getDragDropMode() !== 'none') {
			if (Math.abs(mx - dragStartX) > 5 || Math.abs(my - dragStartY) > 5) isDragging = true;
		}

		if (isDragging) {
			dragX = mx;
			dragY = my;
			const [wx, wy] = screenToWorld(mx, my);
			const { isV, isReversed } = callbacks.getDirection();
			const hit = hitTest(wx, wy);

			if (hit && hit.node.path !== dragSrcNode?.node.path) {
				dropTarget = hit;
			} else if (dropTarget) {
				const zones = getDropZones(dropTarget, isV, isReversed);
				if (!hitTestDropZone(wx, wy, zones)) {
					dropTarget = null;
				}
			}

			if (dropTarget) {
				const zones = getDropZones(dropTarget, isV, isReversed);
				const exact = hitTestDropZone(wx, wy, zones);
				dropPosition = exact ?? closestDropZone(wx, wy, zones);
			}

			callbacks.requestRedraw();
			return;
		}

		// Hover — throttle hit test to once per animation frame
		lastClientX = e.clientX;
		lastClientY = e.clientY;

		// Fast path: tooltip follow doesn't need hit test or redraw
		if (tooltipNode && !hoverRafPending) {
			tooltipScreenX = e.clientX + 16;
			tooltipScreenY = e.clientY - 4;
			callbacks.onTooltipPositionChange?.(tooltipNode, tooltipScreenX, tooltipScreenY);
		}

		// Throttle hit test: queue one per animation frame
		pendingHoverEvent = e;
		if (!hoverRafPending) {
			hoverRafPending = true;
			requestAnimationFrame(() => {
				hoverRafPending = false;
				const pe = pendingHoverEvent;
				if (!pe) return;
				pendingHoverEvent = null;

				const c = callbacks.getCanvas();
				if (!c) return;
				const r = c.getBoundingClientRect();
				const hmx = pe.clientX - r.left;
				const hmy = pe.clientY - r.top;
				const [wx, wy] = screenToWorld(hmx, hmy);
				const hit = hitTest(wx, wy);

				// Update cursor for chevron hit in select mode
				if (config.getClickBehavior() === 'select' && hit) {
					c.style.cursor = isChevronHit(hit, wx, wy) ? 'pointer' : 'default';
				}

				if (hit !== hoveredNode) {
					hoveredNode = hit;
					clearTooltip();
					if (config.getClickBehavior() !== 'select') {
						c.style.cursor = hit ? 'pointer' : 'default';
					}
					if (!hit) {
						c.style.cursor = 'default';
					}
					callbacks.onHoverChange(hit);

					if (hit) {
						tooltipTimer = setTimeout(() => {
							tooltipNode = hit;
							tooltipScreenX = lastClientX + 16;
							tooltipScreenY = lastClientY - 4;
							callbacks.requestRedraw();
						}, 400);
					}

					callbacks.requestRedraw();
				}
			});
		}
	}

	function onMouseUp(e: MouseEvent) {
		const canvas = callbacks.getCanvas();
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		if (isMinimapPanning) {
			isMinimapPanning = false;
			return;
		}
		if (isPanning) {
			isPanning = false;
			const panDist = Math.abs(mx - panStartX) + Math.abs(my - panStartY);
			if (panDist < 5 && panClickNode) {
				// No real pan movement — treat as a click on the node
				const hit = panClickNode;
				panClickNode = null;
				callbacks.onSelectionChange(hit.node.path);
				clearTooltip();
				callbacks.onCloseContextMenu();
				const [cwx, cwy] = screenToWorld(mx, my);
				const chevronHit = isChevronHit(hit, cwx, cwy);
				callbacks.onNodeClick(hit, chevronHit);
				if (config.getClickBehavior() === 'expand-and-focus') {
					focusOnNode(hit);
				}
				callbacks.requestRedraw();
			}
			panClickNode = null;
			return;
		}

		if (isDragging && dragSrcNode && dropTarget) {
			callbacks.onDragDrop(dragSrcNode, dropTarget, dropPosition);
		} else if (dragSrcNode && !isDragging) {
			const [wx, wy] = screenToWorld(mx, my);
			const hit = hitTest(wx, wy);
			if (hit) {
				callbacks.onSelectionChange(hit.node.path);
				clearTooltip();
				callbacks.onCloseContextMenu();

				const chevronHit = isChevronHit(hit, wx, wy);
				callbacks.onNodeClick(hit, chevronHit);

				if (config.getClickBehavior() === 'expand-and-focus') {
					focusOnNode(hit);
				}

				callbacks.requestRedraw();
			}
		}

		dragSrcNode = null;
		isDragging = false;
		dropTarget = null;
	}

	function onMouseLeave() {
		if (isPanning) isPanning = false;
		clearTooltip();
		if (hoveredNode) {
			hoveredNode = null;
			callbacks.onHoverChange(null);
			callbacks.requestRedraw();
		}
	}

	function onContextMenu(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		const canvas = callbacks.getCanvas();
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;
		const [wx, wy] = screenToWorld(mx, my);
		const hit = hitTest(wx, wy);
		if (hit) {
			callbacks.onContextMenu(hit, e.clientX, e.clientY);
			callbacks.onSelectionChange(hit.node.path);
			callbacks.requestRedraw();
		} else {
			callbacks.onCloseContextMenu();
		}
	}

	// ── Public Methods ──────────────────────────────────────────────────

	function zoomToFit() {
		const container = callbacks.getContainer();
		const nodes = callbacks.getLayoutNodes();
		if (!container || nodes.length === 0) return;
		const rect = container.getBoundingClientRect();
		const { width: lw, height: lh } = callbacks.getLayoutSize();
		const pad = 60;
		const scaleX = (rect.width - pad * 2) / (lw + 40);
		const scaleY = (rect.height - pad * 2) / (lh + 40);
		zoom = Math.max(0.05, Math.min(1, Math.min(scaleX, scaleY)));
		panX = pad;
		panY = pad;
		callbacks.requestRedraw();
	}

	function resolveAnchor(
		anchor: FocusAnchor,
		viewportW: number,
		viewportH: number,
		padding: number,
		nodeScreenW: number,
		nodeScreenH: number
	): { screenX: number; screenY: number } {
		// Half-node offsets so the full card stays inside the viewport
		const hw = nodeScreenW / 2;
		const hh = nodeScreenH / 2;

		if (typeof anchor === 'object') {
			// Normalized 0–1 coordinates, interpolated within padded viewport
			const usableW = viewportW - padding * 2 - nodeScreenW;
			const usableH = viewportH - padding * 2 - nodeScreenH;
			return {
				screenX: padding + hw + anchor.x * usableW,
				screenY: padding + hh + anchor.y * usableH
			};
		}
		const cx = viewportW / 2;
		const cy = viewportH / 2;
		switch (anchor) {
			case 'top-left':       return { screenX: padding + hw,              screenY: padding + hh };
			case 'top-center':     return { screenX: cx,                        screenY: padding + hh };
			case 'top-right':      return { screenX: viewportW - padding - hw,  screenY: padding + hh };
			case 'center-left':    return { screenX: padding + hw,              screenY: cy };
			case 'center-right':   return { screenX: viewportW - padding - hw,  screenY: cy };
			case 'bottom-left':    return { screenX: padding + hw,              screenY: viewportH - padding - hh };
			case 'bottom-center':  return { screenX: cx,                        screenY: viewportH - padding - hh };
			case 'bottom-right':   return { screenX: viewportW - padding - hw,  screenY: viewportH - padding - hh };
			case 'center':
			default:               return { screenX: cx,                        screenY: cy };
		}
	}

	function resolveZoom(zoomOption: FocusZoom, currentZoom: number): number {
		if (typeof zoomOption === 'number') {
			return Math.max(0.05, Math.min(3.0, zoomOption));
		}
		if (zoomOption === 'keep') return currentZoom;
		// 'auto' — clamp to [0.8, 1.5]
		return Math.max(0.8, Math.min(1.5, currentZoom));
	}

	function focusOnNode(ln: LayoutNode<T>, options?: FocusOptions) {
		const container = callbacks.getContainer();
		if (!container) return;
		const rect = container.getBoundingClientRect();

		const anchor = options?.anchor ?? 'center';
		const zoomOpt = options?.zoom ?? 'auto';
		const padding = options?.padding ?? 40;
		const animate = options?.animate ?? true;
		const select = options?.select ?? true;

		if (select) {
			callbacks.onSelectionChange(ln.node.path);
		}

		const targetZoom = resolveZoom(zoomOpt, zoom);
		const { screenX, screenY } = resolveAnchor(
			anchor, rect.width, rect.height, padding,
			ln.w * targetZoom, ln.h * targetZoom
		);
		const targetPanX = screenX - ln.cx * targetZoom;
		const targetPanY = screenY - ln.cy * targetZoom;

		if (animate) {
			animFrom = { panX, panY, zoom };
			animTo = { panX: targetPanX, panY: targetPanY, zoom: targetZoom };
			animStartTime = performance.now();
			requestAnimationFrame(animateStep);
		} else {
			panX = targetPanX;
			panY = targetPanY;
			zoom = targetZoom;
			callbacks.requestRedraw();
		}
	}

	/** Scroll to a node without changing the level-axis pan.
	 *  In horizontal layout: only adjusts Y. In vertical: only adjusts X.
	 *  If the node is already visible, does nothing. */
	function scrollToNode(ln: LayoutNode<T>) {
		const container = callbacks.getContainer();
		if (!container) return;
		const rect = container.getBoundingClientRect();
		const { isV } = callbacks.getDirection();

		// Check if node is already visible in the cross-axis
		const nodeScreenX = ln.x * zoom + panX;
		const nodeScreenY = ln.y * zoom + panY;
		const nodeScreenR = (ln.x + ln.w) * zoom + panX;
		const nodeScreenB = (ln.y + ln.h) * zoom + panY;
		const margin = 40;

		if (isV) {
			// Vertical layout: level axis is Y, cross axis is X
			const visible = nodeScreenX >= margin && nodeScreenR <= rect.width - margin;
			if (visible) { callbacks.requestRedraw(); return; }
			const targetPanX = rect.width / 2 - ln.cx * zoom;
			animFrom = { panX, panY, zoom };
			animTo = { panX: targetPanX, panY, zoom };
		} else {
			// Horizontal layout: level axis is X, cross axis is Y
			const visible = nodeScreenY >= margin && nodeScreenB <= rect.height - margin;
			if (visible) { callbacks.requestRedraw(); return; }
			const targetPanY = rect.height / 2 - ln.cy * zoom;
			animFrom = { panX, panY, zoom };
			animTo = { panX, panY: targetPanY, zoom };
		}
		animStartTime = performance.now();
		requestAnimationFrame(animateStep);
	}

	/** Pan the minimum amount needed to make the node fully visible on both axes.
	 *  If already visible, does nothing. Does not change zoom. */
	function ensureVisible(ln: LayoutNode<T>) {
		const container = callbacks.getContainer();
		if (!container) return;
		const rect = container.getBoundingClientRect();
		const margin = 40;

		const nodeL = ln.x * zoom + panX;
		const nodeT = ln.y * zoom + panY;
		const nodeR = (ln.x + ln.w) * zoom + panX;
		const nodeB = (ln.y + ln.h) * zoom + panY;

		let targetPanX = panX;
		let targetPanY = panY;

		// Horizontal: nudge just enough so the full node + margin is visible
		if (nodeL < margin) {
			targetPanX = panX + (margin - nodeL);
		} else if (nodeR > rect.width - margin) {
			targetPanX = panX - (nodeR - (rect.width - margin));
		}

		// Vertical: same
		if (nodeT < margin) {
			targetPanY = panY + (margin - nodeT);
		} else if (nodeB > rect.height - margin) {
			targetPanY = panY - (nodeB - (rect.height - margin));
		}

		if (targetPanX === panX && targetPanY === panY) {
			callbacks.requestRedraw();
			return;
		}

		animFrom = { panX, panY, zoom };
		animTo = { panX: targetPanX, panY: targetPanY, zoom };
		animStartTime = performance.now();
		requestAnimationFrame(animateStep);
	}

	function ensurePathVisible(path: string) {
		const nodes = callbacks.getLayoutNodes();
		const ln = nodes.find(n => n.node.path === path);
		if (ln) {
			ensureVisible(ln);
		}
	}

	function focusOnPath(path: string, options?: FocusOptions) {
		const nodes = callbacks.getLayoutNodes();
		const ln = nodes.find(n => n.node.path === path);
		if (ln) {
			focusOnNode(ln, options);
		}
	}

	function scrollToPath(path: string) {
		const nodes = callbacks.getLayoutNodes();
		const ln = nodes.find(n => n.node.path === path);
		if (ln) {
			callbacks.onSelectionChange(path);
			scrollToNode(ln);
		}
	}

	function setPan(x: number, y: number) {
		panX = x;
		panY = y;
	}

	function setZoom(z: number) {
		zoom = z;
	}

	function getState(): InteractionState {
		return {
			panX,
			panY,
			zoom,
			hoveredNode,
			dragSrcNode,
			isDragging,
			dragX,
			dragY,
			dropTarget,
			dropPosition,
			isPanning,
			tooltipNode,
			tooltipScreenX,
			tooltipScreenY
		};
	}

	function destroy() {
		clearTooltip();
	}

	return {
		// Event handlers
		onWheel,
		onMouseDown,
		onMouseMove,
		onMouseUp,
		onMouseLeave,
		onContextMenu,
		// Methods
		zoomToFit,
		focusOnNode,
		focusOnPath,
		scrollToNode,
		scrollToPath,
		ensureVisible,
		ensurePathVisible,
		screenToWorld,
		setPan,
		setZoom,
		getState,
		destroy
	};
}

export type InteractionManager<T> = ReturnType<typeof createInteractionManager<T>>;
