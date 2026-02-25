import type {
	LayoutNode,
	GroupBox,
	CanvasRenderContext,
	CanvasVisualConfig,
	CanvasNodeState,
	CanvasNodeBounds,
	NodeRenderSlots,
	LodLevel,
	DropZoneRect,
	DropPosition
} from './types.js';
import type { CanvasTheme } from './canvas-theme.js';
import { defaultCanvasTheme } from './canvas-theme.js';
import type { TextCache } from './canvas-text.js';

// ── Drop Zone Constants ─────────────────────────────────────────────────

const DZ_W = 62;
const DZ_H = 18;
const DZ_GAP = 5;
const DZ_FONT = '10px sans-serif';

// ── Minimap Constants (non-themed layout values) ────────────────────────

const MINIMAP_MARGIN = 12;
const MINIMAP_PAD = 6;

// ── Default Slot Renderers ──────────────────────────────────────────────

/** Default background renderer: rounded rect with state-dependent colors */
export function defaultRenderBackground<T>(rctx: CanvasRenderContext<T>): void {
	const { ctx, bounds, state, theme } = rctx;
	const { x, y, w, h } = bounds;
	const r = theme.nodeRadius;

	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);

	if (state.isSearchMatch) {
		ctx.fillStyle = state.isCurrentSearchResult ? theme.nodeCurrentBg : theme.nodeMatchBg;
		ctx.fill();
		ctx.strokeStyle = state.isCurrentSearchResult ? theme.nodeCurrentBorder : theme.nodeMatchBorder;
		ctx.lineWidth = state.isCurrentSearchResult ? 2.5 : 2;
		ctx.stroke();
		ctx.shadowColor = state.isCurrentSearchResult ? theme.nodeMatchBorder : '#fbbf24';
		ctx.shadowBlur = state.isCurrentSearchResult ? 12 : 6;
		ctx.fill();
		ctx.shadowColor = 'transparent';
		ctx.shadowBlur = 0;
	} else if (state.isDropTarget) {
		ctx.fillStyle = theme.nodeDropBg;
		ctx.fill();
		ctx.strokeStyle = theme.nodeDropBorder;
		ctx.lineWidth = 2;
		ctx.stroke();
	} else if (state.isSelected) {
		ctx.fillStyle = theme.nodeSelectedBg;
		ctx.fill();
		ctx.strokeStyle = theme.nodeSelectedBorder;
		ctx.lineWidth = 2;
		ctx.stroke();
	} else if (state.isHovered) {
		ctx.fillStyle = theme.nodeHoverBg;
		ctx.fill();
		ctx.strokeStyle = theme.nodeHoverBorder;
		ctx.lineWidth = theme.nodeBorderWidth;
		ctx.stroke();
		ctx.shadowColor = 'rgba(0,0,0,0.08)';
		ctx.shadowBlur = 6;
		ctx.shadowOffsetY = 2;
		ctx.fill();
		ctx.shadowColor = 'transparent';
		ctx.shadowBlur = 0;
		ctx.shadowOffsetY = 0;
	} else {
		ctx.fillStyle = theme.nodeBg;
		ctx.fill();
		ctx.strokeStyle = theme.nodeBorder;
		ctx.lineWidth = theme.nodeBorderWidth;
		ctx.stroke();
	}
}

/** Default color bar renderer: depth-colored strip on left (H) or top (V) */
export function defaultRenderColorBar<T>(rctx: CanvasRenderContext<T>): void {
	const { ctx, bounds, depthColor, config } = rctx;
	const { x, y, w, h } = bounds;
	const isV = config.growthDirection === 'up' || config.growthDirection === 'down';

	// Color bar is drawn inside a clipped card region (see drawNode),
	// so we can use a simple fillRect — no need for roundRect corners.
	ctx.fillStyle = depthColor;
	if (isV) {
		ctx.fillRect(x, y, w, config.colorBarWidth);
	} else {
		ctx.fillRect(x, y, config.colorBarWidth, h);
	}
}

/** Default body renderer: text label with ellipsis truncation */
export function defaultRenderBody<T>(rctx: CanvasRenderContext<T>): void {
	const { ctx, node, bounds, state, config, label, theme } = rctx;
	const { x, y, w, h } = bounds;
	const isV = config.growthDirection === 'up' || config.growthDirection === 'down';

	ctx.font = state.isSelected ? config.fontBold : config.font;
	ctx.fillStyle = theme.nodeText;
	ctx.textBaseline = 'middle';

	const textOffsetX = isV ? config.nodePaddingX : config.colorBarWidth + config.nodePaddingX;
	const textX = x + textOffsetX;
	const maxTextW = w - textOffsetX - config.nodePaddingX - (node.hasChildren ? 16 : 0);
	const cy = y + h / 2;

	// Simple truncation: measure and truncate inline
	ctx.fillText(label, textX, cy, maxTextW > 0 ? maxTextW : undefined);
}

/** Default chevron renderer: expand/collapse indicator */
export function defaultRenderChevron<T>(rctx: CanvasRenderContext<T>): void {
	const { ctx, node, bounds, theme } = rctx;
	if (!node.hasChildren) return;

	const chevX = bounds.x + bounds.w - 14;
	ctx.fillStyle = theme.chevronColor;
	ctx.font = `${theme.chevronSize}px sans-serif`;
	ctx.textBaseline = 'middle';
	ctx.fillText(node.isExpanded ? '\u25BE' : '\u25B8', chevX, bounds.cy);
}

/** Default badge renderer: child count pill for collapsed nodes */
export function defaultRenderBadge<T>(rctx: CanvasRenderContext<T>): void {
	const { ctx, node, bounds, depthColor, config, theme } = rctx;
	if (!node.hasChildren || node.isExpanded) return;

	const count = Object.keys(node.children).length;
	if (count <= 0) return;

	const isV = config.growthDirection === 'up' || config.growthDirection === 'down';
	const badgeText = String(count);
	const digits = badgeText.length;
	const badgeW = 8 + digits * 6;
	const badgeH = theme.badgeHeight;
	const badgeR = badgeH / 2;

	let badgeX: number;
	let badgeY: number;
	if (isV) {
		badgeX = bounds.x + bounds.w / 2 - badgeW / 2;
		badgeY = bounds.y + bounds.h + 2;
	} else {
		badgeX = bounds.x + bounds.w + 3;
		badgeY = bounds.cy - badgeH / 2;
	}

	ctx.fillStyle = depthColor;
	ctx.beginPath();
	ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeR);
	ctx.fill();

	ctx.font = `${theme.badgeFontSize}px sans-serif`;
	ctx.fillStyle = theme.badgeText;
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'center';
	ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);
	ctx.textAlign = 'start';
}

// ── Node Draw Orchestrator ──────────────────────────────────────────────

/** Build a CanvasRenderContext for a layout node */
function buildRenderContext<T>(
	ctx: CanvasRenderingContext2D,
	ln: LayoutNode<T>,
	label: string,
	state: CanvasNodeState,
	lod: LodLevel,
	config: CanvasVisualConfig,
	theme: CanvasTheme
): CanvasRenderContext<T> {
	const bounds: CanvasNodeBounds = {
		x: ln.x,
		y: ln.y,
		w: ln.w,
		h: ln.h,
		cx: ln.cx,
		cy: ln.cy,
		depth: ln.depth
	};
	const depthColor = config.getDepthColor(ln.depth);
	return { ctx, node: ln.node, label, bounds, state, lod, depthColor, config, theme };
}

/** Draw a single node, delegating to slot callbacks */
export function drawNode<T>(
	ctx: CanvasRenderingContext2D,
	ln: LayoutNode<T>,
	label: string,
	state: CanvasNodeState,
	lod: LodLevel,
	config: CanvasVisualConfig,
	slots: NodeRenderSlots<T>,
	theme: CanvasTheme
): void {
	const rctx = buildRenderContext(ctx, ln, label, state, lod, config, theme);

	// Full override — no clipping (user controls everything)
	if (slots.renderNode) {
		slots.renderNode(rctx);
		return;
	}

	// Background is drawn outside clip so its stroke isn't clipped
	(slots.renderBackground ?? defaultRenderBackground)(rctx);

	// Clip to the card shape so color bar / badge / body can't escape
	ctx.save();
	ctx.beginPath();
	ctx.roundRect(ln.x, ln.y, ln.w, ln.h, theme.nodeRadius);
	ctx.clip();

	(slots.renderColorBar ?? defaultRenderColorBar)(rctx);
	(slots.renderBody ?? defaultRenderBody)(rctx);
	(slots.renderChevron ?? defaultRenderChevron)(rctx);

	ctx.restore();

	// Badge is drawn outside the card (positioned adjacent)
	(slots.renderBadge ?? defaultRenderBadge)(rctx);
}

// ── Connection Lines ────────────────────────────────────────────────────

export function drawConnections<T>(
	ctx: CanvasRenderingContext2D,
	layoutNodes: LayoutNode<T>[],
	levelXArr: number[],
	isVertical: boolean,
	isReversed: boolean,
	columnGap: number,
	levelSpacingV: number,
	vl: number,
	vt: number,
	vr: number,
	vb: number,
	theme: CanvasTheme
): void {
	const M = 50;
	ctx.strokeStyle = theme.connColor;
	ctx.lineWidth = theme.connWidth;

	for (const n of layoutNodes) {
		// Grouped mode: use connectionTargets
		if (n.connectionTargets && n.connectionTargets.length > 0) {
			const targets = n.connectionTargets;
			let cMinX = n.x;
			let cMaxX = n.x + n.w;
			let cMinY = n.cy;
			let cMaxY = n.cy;
			for (const t of targets) {
				if (t.x < cMinX) cMinX = t.x;
				if (t.x > cMaxX) cMaxX = t.x;
				if (t.y < cMinY) cMinY = t.y;
				if (t.y > cMaxY) cMaxY = t.y;
			}
			if (cMaxX < vl - M || cMinX > vr + M || cMaxY < vt - M || cMinY > vb + M) continue;

			if (isVertical) {
				// V-normal: parent bottom → child top; V-reversed: parent top → child bottom
				const parentEdgeY = isReversed ? n.y : n.y + n.h;
				// Find midY from parent edge toward targets
				const nearestTargetY = isReversed
					? Math.max(...targets.map(t => t.y))
					: Math.min(...targets.map(t => t.y));
				const midY = (parentEdgeY + nearestTargetY) / 2;
				ctx.beginPath();
				ctx.moveTo(n.cx, parentEdgeY);
				ctx.lineTo(n.cx, midY);
				ctx.stroke();
				if (targets.length > 1) {
					ctx.beginPath();
					ctx.moveTo(targets[0].x, midY);
					ctx.lineTo(targets[targets.length - 1].x, midY);
					ctx.stroke();
				}
				for (const t of targets) {
					ctx.beginPath();
					ctx.moveTo(t.x, midY);
					ctx.lineTo(t.x, t.y);
					ctx.stroke();
				}
			} else {
				// H-normal: parent right → child left; H-reversed: parent left → child right
				const parentEdgeX = isReversed ? n.x : n.x + n.w;
				// Find midX from parent edge toward targets
				const nearestTargetX = isReversed
					? Math.max(...targets.map(t => t.x))
					: Math.min(...targets.map(t => t.x));
				const midX = (parentEdgeX + nearestTargetX) / 2;
				ctx.beginPath();
				ctx.moveTo(parentEdgeX, n.cy);
				ctx.lineTo(midX, n.cy);
				ctx.stroke();
				if (targets.length > 1) {
					ctx.beginPath();
					ctx.moveTo(midX, targets[0].y);
					ctx.lineTo(midX, targets[targets.length - 1].y);
					ctx.stroke();
				}
				for (const t of targets) {
					ctx.beginPath();
					ctx.moveTo(midX, t.y);
					ctx.lineTo(t.x, t.y);
					ctx.stroke();
				}
			}
			continue;
		}

		// Standard mode: use children
		if (n.children.length === 0) continue;
		const first = n.children[0];
		const last = n.children[n.children.length - 1];

		if (isVertical) {
			const parentEdgeY = isReversed ? n.y : n.y + n.h;
			const childEdgeY = (c: LayoutNode<T>) => isReversed ? c.y + c.h : c.y;
			const connExtentY1 = isReversed ? Math.max(parentEdgeY, childEdgeY(first)) : Math.min(parentEdgeY, childEdgeY(first));
			const connExtentY2 = isReversed ? Math.min(parentEdgeY, childEdgeY(first)) : Math.max(parentEdgeY, childEdgeY(first));
			const connL = Math.min(n.cx, first.cx);
			const connR = Math.max(n.cx, last.cx);
			if (connR < vl - M || connL > vr + M || connExtentY1 < vt - M || connExtentY2 > vb + M) continue;

			const midY = (parentEdgeY + childEdgeY(first)) / 2;
			ctx.beginPath();
			ctx.moveTo(n.cx, parentEdgeY);
			ctx.lineTo(n.cx, midY);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(first.cx, midY);
			ctx.lineTo(last.cx, midY);
			ctx.stroke();
			for (const child of n.children) {
				ctx.beginPath();
				ctx.moveTo(child.cx, midY);
				ctx.lineTo(child.cx, childEdgeY(child));
				ctx.stroke();
			}
		} else {
			const parentEdgeX = isReversed ? n.x : n.x + n.w;
			const childEdgeX = (c: LayoutNode<T>) => isReversed ? c.x + c.w : c.x;
			const connExtentX1 = Math.min(parentEdgeX, childEdgeX(first));
			const connExtentX2 = Math.max(parentEdgeX, childEdgeX(first));
			const connTop = Math.min(n.cy, first.cy);
			const connBottom = Math.max(n.cy, last.cy);
			if (connExtentX2 < vl - M || connExtentX1 > vr + M || connBottom < vt - M || connTop > vb + M) continue;

			const midX = (parentEdgeX + childEdgeX(first)) / 2;
			ctx.beginPath();
			ctx.moveTo(parentEdgeX, n.cy);
			ctx.lineTo(midX, n.cy);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(midX, first.cy);
			ctx.lineTo(midX, last.cy);
			ctx.stroke();
			for (const child of n.children) {
				ctx.beginPath();
				ctx.moveTo(midX, child.cy);
				ctx.lineTo(childEdgeX(child), child.cy);
				ctx.stroke();
			}
		}
	}
}

// ── Balanced Layout Connections ──────────────────────────────────────────

/**
 * Draw connections for the balanced (H) layout:
 * - Root (depth 0): left arm children connected via root left edge, right arm via right edge
 * - Subtrees: standard H-tree elbows, direction auto-detected (left or right growing)
 */
export function drawBalancedConnections<T>(
	ctx: CanvasRenderingContext2D,
	layoutNodes: LayoutNode<T>[],
	vl: number,
	vt: number,
	vr: number,
	vb: number,
	theme: CanvasTheme,
	columnGap: number,
	levelSpacingV: number
): void {
	const M = 50;
	ctx.strokeStyle = theme.connColor;
	ctx.lineWidth = theme.connWidth;

	for (const n of layoutNodes) {
		if (n.children.length === 0) continue;

		if (n.depth === 0) {
			// Root: split children into left arm (cx < root cx) and right arm (cx > root cx)
			const leftChildren = n.children.filter(c => c.cx < n.cx);
			const rightChildren = n.children.filter(c => c.cx >= n.cx);

			// Right arm: root right edge → horizontal midpoint → vertical rail → children left edge
			if (rightChildren.length > 0) {
				const first = rightChildren[0];
				const last = rightChildren[rightChildren.length - 1];
				const parentEdgeX = n.isVirtual ? n.cx : n.x + n.w;
				const childEdgeX = first.x;
				const midX = (parentEdgeX + childEdgeX) / 2;

				ctx.beginPath();
				ctx.moveTo(parentEdgeX, n.cy);
				ctx.lineTo(midX, n.cy);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(midX, first.cy);
				ctx.lineTo(midX, last.cy);
				ctx.stroke();
				for (const child of rightChildren) {
					ctx.beginPath();
					ctx.moveTo(midX, child.cy);
					ctx.lineTo(child.x, child.cy);
					ctx.stroke();
				}
			}

			// Left arm: root left edge → horizontal midpoint → vertical rail → children right edge
			if (leftChildren.length > 0) {
				const first = leftChildren[0];
				const last = leftChildren[leftChildren.length - 1];
				const parentEdgeX = n.isVirtual ? n.cx : n.x;
				const childEdgeX = first.x + first.w; // right edge of left-arm child
				const midX = (parentEdgeX + childEdgeX) / 2;

				ctx.beginPath();
				ctx.moveTo(parentEdgeX, n.cy);
				ctx.lineTo(midX, n.cy);
				ctx.stroke();
				ctx.beginPath();
				ctx.moveTo(midX, first.cy);
				ctx.lineTo(midX, last.cy);
				ctx.stroke();
				for (const child of leftChildren) {
					ctx.beginPath();
					ctx.moveTo(midX, child.cy);
					ctx.lineTo(child.x + child.w, child.cy);
					ctx.stroke();
				}
			}
			continue;
		}

		// depth >= 1: auto-detect direction from parent-child X relationship
		const first = n.children[0];
		const last = n.children[n.children.length - 1];
		const growsRight = first.cx > n.cx;

		const parentEdgeX = growsRight ? n.x + n.w : n.x;
		const childEdgeX = growsRight ? first.x : first.x + first.w;

		const connTop = Math.min(n.cy, first.cy);
		const connBottom = Math.max(n.cy, last.cy);
		const connLeft = Math.min(parentEdgeX, childEdgeX);
		const connRight = Math.max(parentEdgeX, childEdgeX);
		if (connRight < vl - M || connLeft > vr + M || connBottom < vt - M || connTop > vb + M) continue;

		const midX = (parentEdgeX + childEdgeX) / 2;
		ctx.beginPath();
		ctx.moveTo(parentEdgeX, n.cy);
		ctx.lineTo(midX, n.cy);
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(midX, first.cy);
		ctx.lineTo(midX, last.cy);
		ctx.stroke();
		for (const child of n.children) {
			const cEdge = growsRight ? child.x : child.x + child.w;
			ctx.beginPath();
			ctx.moveTo(midX, child.cy);
			ctx.lineTo(cEdge, child.cy);
			ctx.stroke();
		}
	}
}

// ── Fishbone Layout Connections ──────────────────────────────────────────

/**
 * Ishikawa fishbone connections:
 * - Spine: horizontal (or vertical) line running from branches to root (the "head")
 * - Ribs: diagonal ~45° lines from each depth-1 branch to the spine
 * - Branch elbows: standard tree elbows within each branch subtree
 *
 * After layout mirroring, root is at the right (H) or bottom (V).
 */
export function drawFishboneConnections<T>(
	ctx: CanvasRenderingContext2D,
	layoutNodes: LayoutNode<T>[],
	isVertical: boolean,
	vl: number,
	vt: number,
	vr: number,
	vb: number,
	theme: CanvasTheme
): void {
	const M = 50;
	ctx.strokeStyle = theme.connColor;
	ctx.lineWidth = theme.connWidth;

	// Find root (depth 0)
	let root: LayoutNode<T> | null = null;
	for (const n of layoutNodes) {
		if (n.depth === 0) { root = n; break; }
	}
	if (!root || root.children.length === 0) {
		// No root or no branches — draw standard elbows for any remaining connections
		drawFishboneBranchElbows(ctx, layoutNodes, isVertical, vl, vt, vr, vb, M);
		return;
	}

	if (!isVertical) {
		// ── Horizontal fishbone: root at right, branches to the left ──
		const spineY = root.cy;

		// Compute spine left extent: leftmost rib attachment point
		let spineLeft = root.x;
		for (const child of root.children) {
			const dy = Math.abs(child.cy - spineY);
			const attachX = child.x + child.w + dy;
			spineLeft = Math.min(spineLeft, attachX, child.x);
		}

		// Draw spine line
		ctx.beginPath();
		ctx.moveTo(spineLeft - 20, spineY);
		ctx.lineTo(root.x, spineY);
		ctx.stroke();

		// Draw diagonal ribs: child right edge → spine attachment point
		for (const child of root.children) {
			const dy = Math.abs(child.cy - spineY);
			const attachX = Math.min(child.x + child.w + dy, root.x);
			ctx.beginPath();
			ctx.moveTo(child.x + child.w, child.cy);
			ctx.lineTo(attachX, spineY);
			ctx.stroke();
		}
	} else {
		// ── Vertical fishbone: root at bottom, branches upward ──
		const spineX = root.cx;

		let spineTop = root.y;
		for (const child of root.children) {
			const dx = Math.abs(child.cx - spineX);
			const attachY = child.y + child.h + dx;
			spineTop = Math.min(spineTop, attachY, child.y);
		}

		// Draw spine line
		ctx.beginPath();
		ctx.moveTo(spineX, spineTop - 20);
		ctx.lineTo(spineX, root.y);
		ctx.stroke();

		// Draw diagonal ribs: child bottom edge → spine attachment point
		for (const child of root.children) {
			const dx = Math.abs(child.cx - spineX);
			const attachY = Math.min(child.y + child.h + dx, root.y);
			ctx.beginPath();
			ctx.moveTo(child.cx, child.y + child.h);
			ctx.lineTo(spineX, attachY);
			ctx.stroke();
		}
	}

	// Draw branch elbows for depth >= 1
	drawFishboneBranchElbows(ctx, layoutNodes, isVertical, vl, vt, vr, vb, M);
}

/** Draw standard elbow connections for fishbone branch subtrees (depth >= 1) */
function drawFishboneBranchElbows<T>(
	ctx: CanvasRenderingContext2D,
	layoutNodes: LayoutNode<T>[],
	isVertical: boolean,
	vl: number, vt: number, vr: number, vb: number,
	M: number
): void {
	for (const n of layoutNodes) {
		if (n.children.length === 0 || n.depth === 0) continue;

		const first = n.children[0];
		const last = n.children[n.children.length - 1];

		if (!isVertical) {
			// Horizontal fishbone branches grow vertically
			const growsDown = first.cy > n.cy;
			const parentEdgeY = growsDown ? n.y + n.h : n.y;
			const childEdgeY = (c: LayoutNode<T>) => growsDown ? c.y : c.y + c.h;

			const connTop = Math.min(parentEdgeY, childEdgeY(first), childEdgeY(last));
			const connBottom = Math.max(parentEdgeY, childEdgeY(first), childEdgeY(last));
			const connLeft = Math.min(n.cx, first.cx);
			const connRight = Math.max(n.cx, last.cx);
			if (connRight < vl - M || connLeft > vr + M || connBottom < vt - M || connTop > vb + M) continue;

			const midY = (parentEdgeY + childEdgeY(first)) / 2;
			ctx.beginPath(); ctx.moveTo(n.cx, parentEdgeY); ctx.lineTo(n.cx, midY); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(first.cx, midY); ctx.lineTo(last.cx, midY); ctx.stroke();
			for (const child of n.children) {
				ctx.beginPath(); ctx.moveTo(child.cx, midY); ctx.lineTo(child.cx, childEdgeY(child)); ctx.stroke();
			}
		} else {
			// Vertical fishbone branches grow horizontally
			const growsRight = first.cx > n.cx;
			const parentEdgeX = growsRight ? n.x + n.w : n.x;
			const childEdgeX = (c: LayoutNode<T>) => growsRight ? c.x : c.x + c.w;

			const connTop = Math.min(n.cy, first.cy);
			const connBottom = Math.max(n.cy, last.cy);
			const connLeft = Math.min(parentEdgeX, childEdgeX(first), childEdgeX(last));
			const connRight = Math.max(parentEdgeX, childEdgeX(first), childEdgeX(last));
			if (connRight < vl - M || connLeft > vr + M || connBottom < vt - M || connTop > vb + M) continue;

			const midX = (parentEdgeX + childEdgeX(first)) / 2;
			ctx.beginPath(); ctx.moveTo(parentEdgeX, n.cy); ctx.lineTo(midX, n.cy); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(midX, first.cy); ctx.lineTo(midX, last.cy); ctx.stroke();
			for (const child of n.children) {
				ctx.beginPath(); ctx.moveTo(midX, child.cy); ctx.lineTo(childEdgeX(child), child.cy); ctx.stroke();
			}
		}
	}
}

// ── Group Boxes ─────────────────────────────────────────────────────────

export function drawGroupBoxes(
	ctx: CanvasRenderingContext2D,
	groupBoxes: GroupBox[],
	getDepthColor: (depth: number) => string,
	zoomLodSimple: number,
	zoomLodText: number,
	zoom: number,
	vl: number,
	vt: number,
	vr: number,
	vb: number
): void {
	const M = 50;
	for (const box of groupBoxes) {
		if (box.x + box.w < vl - M || box.x > vr + M || box.y + box.h < vt - M || box.y > vb + M) continue;
		const color = getDepthColor(box.depth);

		if (zoom < zoomLodSimple) {
			ctx.fillStyle = color + '10';
			ctx.fillRect(box.x, box.y, box.w, box.h);
		} else if (zoom < zoomLodText) {
			ctx.fillStyle = color + '0A';
			ctx.fillRect(box.x, box.y, box.w, box.h);
			ctx.strokeStyle = color + '30';
			ctx.lineWidth = 1;
			ctx.strokeRect(box.x, box.y, box.w, box.h);
		} else {
			ctx.fillStyle = color + '0A';
			ctx.beginPath();
			ctx.roundRect(box.x, box.y, box.w, box.h, 8);
			ctx.fill();
			ctx.strokeStyle = color + '40';
			ctx.lineWidth = 1.5;
			ctx.setLineDash([4, 3]);
			ctx.stroke();
			ctx.setLineDash([]);
		}
	}
}

// ── Dot Grid Background ─────────────────────────────────────────────────

export function drawDotGrid(
	ctx: CanvasRenderingContext2D,
	cw: number,
	ch: number,
	panX: number,
	panY: number,
	zoom: number,
	theme: CanvasTheme
): void {
	const gridSize = theme.gridSize * zoom;
	if (gridSize <= 6) return;

	// Cap total dots to prevent freeze at intermediate zoom levels
	const cols = Math.ceil(cw / gridSize);
	const rows = Math.ceil(ch / gridSize);
	if (cols * rows > 10000) return;

	ctx.fillStyle = theme.gridColor;
	const startX = panX % gridSize;
	const startY = panY % gridSize;
	// Use fillRect instead of arc — direct draw, no path accumulation
	for (let gx = startX; gx < cw; gx += gridSize) {
		for (let gy = startY; gy < ch; gy += gridSize) {
			ctx.fillRect(gx - 0.75, gy - 0.75, 1.5, 1.5);
		}
	}
}

// ── Minimap ─────────────────────────────────────────────────────────────

export function drawMinimap<T>(
	ctx: CanvasRenderingContext2D,
	layoutNodes: LayoutNode<T>[],
	groupBoxes: GroupBox[],
	layoutWidth: number,
	layoutHeight: number,
	getDepthColor: (depth: number) => string,
	selectedPath: string | null,
	panX: number,
	panY: number,
	zoom: number,
	cw: number,
	ch: number,
	theme: CanvasTheme
): void {
	if (layoutNodes.length === 0 || layoutWidth <= 0 || layoutHeight <= 0) return;

	const mmW = theme.minimapWidth;
	const mmH = theme.minimapHeight;
	const mmX = cw - mmW - MINIMAP_MARGIN;
	const mmY = ch - mmH - MINIMAP_MARGIN;

	// Background
	ctx.fillStyle = theme.minimapBg;
	ctx.strokeStyle = theme.minimapBorder;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.roundRect(mmX, mmY, mmW, mmH, 4);
	ctx.fill();
	ctx.stroke();

	// Scale to fit layout in minimap
	const mmScaleX = (mmW - MINIMAP_PAD * 2) / (layoutWidth + 40);
	const mmScaleY = (mmH - MINIMAP_PAD * 2) / (layoutHeight + 40);
	const mmScale = Math.min(mmScaleX, mmScaleY);

	// Clip to minimap bounds
	ctx.save();
	ctx.beginPath();
	ctx.roundRect(mmX, mmY, mmW, mmH, 4);
	ctx.clip();

	// Group boxes as faint outlines
	for (const box of groupBoxes) {
		const bx = mmX + MINIMAP_PAD + box.x * mmScale;
		const by = mmY + MINIMAP_PAD + box.y * mmScale;
		const bw = box.w * mmScale;
		const bh = box.h * mmScale;
		const color = getDepthColor(box.depth);
		ctx.strokeStyle = color + '30';
		ctx.lineWidth = 0.5;
		ctx.strokeRect(bx, by, bw, bh);
	}

	// Nodes as tiny rectangles
	for (const n of layoutNodes) {
		if (n.isVirtual) continue;
		const nx = mmX + MINIMAP_PAD + n.x * mmScale;
		const ny = mmY + MINIMAP_PAD + n.y * mmScale;
		const nw = Math.max(1.5, n.w * mmScale);
		const nh = Math.max(1, n.h * mmScale);
		const color = getDepthColor(n.depth);
		ctx.fillStyle = n.node.path === selectedPath ? theme.minimapViewport : color + '80';
		ctx.fillRect(nx, ny, nw, nh);
	}

	// Viewport rectangle
	const vpX = mmX + MINIMAP_PAD + (-panX / zoom) * mmScale;
	const vpY = mmY + MINIMAP_PAD + (-panY / zoom) * mmScale;
	const vpW = (cw / zoom) * mmScale;
	const vpH = (ch / zoom) * mmScale;

	ctx.fillStyle = theme.minimapViewport + '14';
	ctx.fillRect(vpX, vpY, vpW, vpH);
	ctx.strokeStyle = theme.minimapViewport;
	ctx.lineWidth = 1.5;
	ctx.strokeRect(vpX, vpY, vpW, vpH);

	ctx.restore();
}

/** Convert screen coordinates to world coordinates within the minimap */
export function minimapWorldFromScreen(
	mx: number,
	my: number,
	layoutWidth: number,
	layoutHeight: number,
	cw: number,
	ch: number,
	mmW: number = 160,
	mmH: number = 120
): [number, number] | null {
	const mmX = cw - mmW - MINIMAP_MARGIN;
	const mmY = ch - mmH - MINIMAP_MARGIN;
	if (mx < mmX || mx > mmX + mmW || my < mmY || my > mmY + mmH) return null;
	const scaleX = (mmW - MINIMAP_PAD * 2) / (layoutWidth + 40);
	const scaleY = (mmH - MINIMAP_PAD * 2) / (layoutHeight + 40);
	const mmScale = Math.min(scaleX, scaleY);
	const wx = (mx - mmX - MINIMAP_PAD) / mmScale;
	const wy = (my - mmY - MINIMAP_PAD) / mmScale;
	return [wx, wy];
}

// ── Drop Zone Geometry ──────────────────────────────────────────────────

export function getDropZones<T>(dt: LayoutNode<T>, isV: boolean, isReversed: boolean = false, theme: CanvasTheme = defaultCanvasTheme): DropZoneRect[] {
	const dzColors = {
		before: { bg: theme.dzBefore, active: darkenColor(theme.dzBefore) },
		after: { bg: theme.dzAfter, active: darkenColor(theme.dzAfter) },
		child: { bg: theme.dzChild, active: darkenColor(theme.dzChild) },
	};

	if (isV) {
		// Vertical layout: before/after on cross-axis (left/right), child on tree-axis
		const childY = isReversed ? dt.y - DZ_H - DZ_GAP : dt.y + dt.h + DZ_GAP;
		const childLabel = isReversed ? '\u2191 Child' : '\u2193 Child';
		return [
			{ position: 'before', x: dt.x - DZ_W - DZ_GAP, y: dt.cy - DZ_H / 2, w: DZ_W, h: DZ_H, label: '\u2190 Before', color: dzColors.before.bg, activeColor: dzColors.before.active },
			{ position: 'after', x: dt.x + dt.w + DZ_GAP, y: dt.cy - DZ_H / 2, w: DZ_W, h: DZ_H, label: 'After \u2192', color: dzColors.after.bg, activeColor: dzColors.after.active },
			{ position: 'child', x: dt.cx - DZ_W / 2, y: childY, w: DZ_W, h: DZ_H, label: childLabel, color: dzColors.child.bg, activeColor: dzColors.child.active }
		];
	}
	// Horizontal layout: before/after on cross-axis (top/bottom), child on tree-axis
	const childX = isReversed ? dt.x - DZ_W - DZ_GAP : dt.x + dt.w + DZ_GAP;
	const childLabel = isReversed ? '\u2190 Child' : '\u2192 Child';
	return [
		{ position: 'before', x: dt.cx - DZ_W / 2, y: dt.y - DZ_H - DZ_GAP, w: DZ_W, h: DZ_H, label: '\u2191 Before', color: dzColors.before.bg, activeColor: dzColors.before.active },
		{ position: 'after', x: dt.cx - DZ_W / 2, y: dt.y + dt.h + DZ_GAP, w: DZ_W, h: DZ_H, label: '\u2193 After', color: dzColors.after.bg, activeColor: dzColors.after.active },
		{ position: 'child', x: childX, y: dt.cy - DZ_H / 2, w: DZ_W, h: DZ_H, label: childLabel, color: dzColors.child.bg, activeColor: dzColors.child.active }
	];
}

export function hitTestDropZone(wx: number, wy: number, zones: DropZoneRect[]): DropPosition | null {
	for (const z of zones) {
		if (wx >= z.x && wx <= z.x + z.w && wy >= z.y && wy <= z.y + z.h) return z.position;
	}
	return null;
}

export function closestDropZone(wx: number, wy: number, zones: DropZoneRect[]): DropPosition {
	let best: DropPosition = 'child';
	let bestDist = Infinity;
	for (const z of zones) {
		const dx = wx - (z.x + z.w / 2);
		const dy = wy - (z.y + z.h / 2);
		const d = dx * dx + dy * dy;
		if (d < bestDist) {
			bestDist = d;
			best = z.position;
		}
	}
	return best;
}

/** Draw drop zone buttons around the drop target */
export function drawDropZones<T>(
	ctx: CanvasRenderingContext2D,
	dropTarget: LayoutNode<T>,
	dropPosition: DropPosition,
	isVertical: boolean,
	isReversed: boolean,
	theme: CanvasTheme
): void {
	const dt = dropTarget;
	const zones = getDropZones(dt, isVertical, isReversed, theme);
	const dzR = theme.dzRadius;

	// Dashed outline around target node
	ctx.strokeStyle = theme.connColor;
	ctx.lineWidth = theme.connWidth;
	ctx.setLineDash([4, 3]);
	ctx.beginPath();
	ctx.roundRect(dt.x - 1, dt.y - 1, dt.w + 2, dt.h + 2, 6);
	ctx.stroke();
	ctx.setLineDash([]);

	// Draw each zone button
	ctx.font = DZ_FONT;
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'center';
	for (const z of zones) {
		const isActive = dropPosition === z.position;
		ctx.beginPath();
		ctx.roundRect(z.x, z.y, z.w, z.h, dzR);
		if (isActive) {
			ctx.fillStyle = z.activeColor;
			ctx.fill();
			ctx.shadowColor = z.activeColor;
			ctx.shadowBlur = 6;
			ctx.fill();
			ctx.shadowColor = 'transparent';
			ctx.shadowBlur = 0;
		} else {
			ctx.fillStyle = z.color + '18';
			ctx.fill();
			ctx.strokeStyle = z.color + '70';
			ctx.lineWidth = 1;
			ctx.stroke();
		}
		ctx.fillStyle = isActive ? '#ffffff' : z.color;
		ctx.fillText(z.label, z.x + z.w / 2, z.y + z.h / 2);
	}
	ctx.textAlign = 'start';
}

/** Draw drag ghost at screen coordinates */
export function drawDragGhost<T>(
	ctx: CanvasRenderingContext2D,
	dragSrcNode: LayoutNode<T>,
	dragX: number,
	dragY: number,
	font: string,
	colorBarWidth: number,
	paddingX: number,
	getLabel: (node: LayoutNode<T>) => string,
	theme: CanvasTheme
): void {
	ctx.globalAlpha = theme.ghostOpacity;
	const gw = dragSrcNode.w;
	const gh = dragSrcNode.h;
	const gx = dragX - gw / 2;
	const gy = dragY - gh / 2;
	ctx.beginPath();
	ctx.roundRect(gx, gy, gw, gh, theme.nodeRadius);
	ctx.fillStyle = theme.ghostBg;
	ctx.fill();
	ctx.strokeStyle = theme.ghostBorder;
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.font = font;
	ctx.fillStyle = theme.nodeText;
	ctx.textBaseline = 'middle';
	ctx.fillText(getLabel(dragSrcNode), gx + colorBarWidth + paddingX, gy + gh / 2);
	ctx.globalAlpha = 1;
}

// ── LOD: Simple & Medium Renderers ──────────────────────────────────────

/** Draw a node at the simple LOD level (just a colored rectangle) */
export function drawNodeSimple<T>(
	ctx: CanvasRenderingContext2D,
	ln: LayoutNode<T>,
	depthColor: string,
	isSelected: boolean,
	isSearchMatch: boolean,
	isCurrentResult: boolean,
	isSearchDimmed: boolean,
	theme: CanvasTheme
): void {
	if (isSearchDimmed) {
		ctx.fillStyle = depthColor + '25';
	} else if (isCurrentResult) {
		ctx.fillStyle = theme.nodeCurrentBorder;
	} else if (isSearchMatch) {
		ctx.fillStyle = '#fbbf24';
	} else {
		ctx.fillStyle = isSelected ? theme.nodeSelectedBorder : depthColor + '90';
	}
	ctx.fillRect(ln.x, ln.y, ln.w, ln.h);
}

/** Draw a node at the medium LOD level (box + color bar, no text) */
export function drawNodeMedium<T>(
	ctx: CanvasRenderingContext2D,
	ln: LayoutNode<T>,
	depthColor: string,
	isSelected: boolean,
	isDropTarget: boolean,
	isSearchMatch: boolean,
	isCurrentResult: boolean,
	colorBarWidth: number,
	isVertical: boolean,
	theme: CanvasTheme
): void {
	ctx.fillStyle = isSelected ? theme.nodeSelectedBg : isDropTarget ? theme.nodeDropBg : theme.nodeBg;
	ctx.fillRect(ln.x, ln.y, ln.w, ln.h);
	if (isSearchMatch) {
		ctx.strokeStyle = isCurrentResult ? theme.nodeCurrentBorder : theme.nodeMatchBorder;
		ctx.lineWidth = isCurrentResult ? 2.5 : 2;
	} else {
		ctx.strokeStyle = isSelected ? theme.nodeSelectedBorder : isDropTarget ? theme.nodeDropBorder : theme.nodeBorder;
		ctx.lineWidth = 1;
	}
	ctx.strokeRect(ln.x, ln.y, ln.w, ln.h);
	ctx.fillStyle = depthColor;
	if (isVertical) {
		ctx.fillRect(ln.x, ln.y, ln.w, colorBarWidth);
	} else {
		ctx.fillRect(ln.x, ln.y, colorBarWidth, ln.h);
	}
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Darken a hex color for active states */
function darkenColor(hex: string): string {
	const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
	if (!m) return hex;
	const r = Math.max(0, parseInt(m[1], 16) - 30);
	const g = Math.max(0, parseInt(m[2], 16) - 30);
	const b = Math.max(0, parseInt(m[3], 16) - 30);
	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
