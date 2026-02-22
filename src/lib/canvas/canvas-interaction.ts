import type { LayoutNode, DropPosition, ClickBehavior } from './types.js';
import {
	getDropZones,
	hitTestDropZone,
	closestDropZone,
	minimapWorldFromScreen
} from './canvas-renderer.js';

export interface InteractionConfig {
	getClickBehavior: () => ClickBehavior;
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
	let isMinimapPanning = false;

	// Tooltip
	let tooltipNode: LayoutNode<T> | null = null;
	let tooltipScreenX = 0;
	let tooltipScreenY = 0;
	let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

	// Animation
	let animFrom: { panX: number; panY: number; zoom: number } | null = null;
	let animTo: { panX: number; panY: number; zoom: number } | null = null;
	let animStartTime = 0;

	function screenToWorld(sx: number, sy: number): [number, number] {
		return [(sx - panX) / zoom, (sy - panY) / zoom];
	}

	function hitTest(wx: number, wy: number): LayoutNode<T> | null {
		const nodes = callbacks.getLayoutNodes();
		for (let i = nodes.length - 1; i >= 0; i--) {
			const n = nodes[i];
			if (wx >= n.x && wx <= n.x + n.w && wy >= n.y && wy <= n.y + n.h) {
				return n;
			}
		}
		return null;
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
		if (hit) {
			dragSrcNode = hit;
			dragStartX = mx;
			dragStartY = my;
			isDragging = false;
		} else {
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

		if (dragSrcNode && !isDragging) {
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

		// Hover
		const [wx, wy] = screenToWorld(mx, my);
		const hit = hitTest(wx, wy);

		// Update cursor for chevron hit in select mode
		if (config.getClickBehavior() === 'select' && hit) {
			canvas.style.cursor = isChevronHit(hit, wx, wy) ? 'pointer' : 'default';
		}

		if (hit !== hoveredNode) {
			hoveredNode = hit;
			clearTooltip();
			if (config.getClickBehavior() !== 'select') {
				canvas.style.cursor = hit ? 'pointer' : 'default';
			}
			if (!hit) {
				canvas.style.cursor = 'default';
			}
			callbacks.onHoverChange(hit);

			if (hit) {
				const capClientX = e.clientX;
				const capClientY = e.clientY;
				tooltipTimer = setTimeout(() => {
					tooltipNode = hit;
					tooltipScreenX = capClientX + 16;
					tooltipScreenY = capClientY - 4;
					callbacks.requestRedraw();
				}, 400);
			}

			callbacks.requestRedraw();
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

	function focusOnNode(ln: LayoutNode<T>) {
		const container = callbacks.getContainer();
		if (!container) return;
		const rect = container.getBoundingClientRect();
		const targetZoom = Math.max(0.8, Math.min(1.5, zoom));
		const targetPanX = rect.width / 2 - ln.cx * targetZoom;
		const targetPanY = rect.height / 2 - ln.cy * targetZoom;
		animFrom = { panX, panY, zoom };
		animTo = { panX: targetPanX, panY: targetPanY, zoom: targetZoom };
		animStartTime = performance.now();
		requestAnimationFrame(animateStep);
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

	function focusOnPath(path: string) {
		const nodes = callbacks.getLayoutNodes();
		const ln = nodes.find(n => n.node.path === path);
		if (ln) {
			callbacks.onSelectionChange(path);
			focusOnNode(ln);
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
		screenToWorld,
		setPan,
		setZoom,
		getState,
		destroy
	};
}

export type InteractionManager<T> = ReturnType<typeof createInteractionManager<T>>;
