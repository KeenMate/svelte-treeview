import type { LTreeNode } from '../ltree/ltree-node.svelte.js';
import type { TreeController } from '../core/TreeController.svelte.js';
import type { LayoutNode, LayoutResult, LayoutConfig } from './types.js';
import type { CanvasTheme } from './canvas-theme.js';
import { finishLayout } from './canvas-layout.js';

// ── Constants ────────────────────────────────────────────────────────────

const TWO_PI = Math.PI * 2;
/** Minimum arc length (in px at midRadius) to show a text label */
const MIN_LABEL_ARC_PX = 30;
/** Minimum arc length in px — guarantees every node is readable */
const MIN_ARC_PX = 40;
/** Ellipsis character for truncation */
const ELLIPSIS = '\u2026';
/** Maximum angular sweep (radians) for any single parent's children.
 *  Beyond this, children overflow into additional sub-rings. */
const MAX_CHILD_SWEEP = Math.PI * 1.8; // 324° — leaves a small wedge gap

// ── Layout ───────────────────────────────────────────────────────────────

/**
 * Count descendant leaves for proportional angular allocation.
 * A leaf is either a node with no children, or a collapsed node.
 */
function countLeaves<T>(ctrl: TreeController<T>, node: LTreeNode<T>): number {
	if (!node.hasChildren || !node.isExpanded) return 1;
	const children = ctrl.getChildren(node.path);
	let total = 0;
	for (const child of children) total += countLeaves(ctrl, child);
	return Math.max(1, total);
}

/**
 * Sunburst layout: each node is an arc segment.
 * - Root = center circle (depth 0)
 * - Each depth forms a concentric ring
 * - Angular sweep is proportional to descendant count
 * - When a parent has too many children, they overflow into sub-rings
 * - Accordion behavior (in CanvasTree) prevents sibling overlap
 */
export function computeLayoutSunburst<T>(
	ctrl: TreeController<T>,
	measureNodeWidth: (_node: LTreeNode<T>) => number,
	config: LayoutConfig,
	ringWidth: number,
	startAngleDeg: number,
	rootTitle?: string
): LayoutResult<T> {
	const t0 = performance.now();
	const nodes: LayoutNode<T>[] = [];
	const roots = ctrl.tree.tree;
	if (roots.length === 0) return finishLayout(nodes, [], t0);

	const startAngle = (startAngleDeg * Math.PI) / 180;

	// Determine center node and effective children
	let centerNode: LTreeNode<T>;
	let effectiveChildren: LTreeNode<T>[];
	let isMultiRoot = false;

	if (roots.length === 1) {
		centerNode = roots[0];
		effectiveChildren = (centerNode.hasChildren && centerNode.isExpanded)
			? ctrl.getChildren(centerNode.path) : [];
	} else {
		// Multi-root: virtual center encompasses all roots
		centerNode = roots[0]; // used as backing node for the center LayoutNode
		effectiveChildren = roots;
		isMultiRoot = true;
	}

	// Pre-compute leaf counts for ALL roots
	const leafMap = new Map<string, number>();
	function buildLeafMap(node: LTreeNode<T>): number {
		const count = countLeaves(ctrl, node);
		leafMap.set(node.path, count);
		if (node.hasChildren && node.isExpanded) {
			for (const child of ctrl.getChildren(node.path)) {
				buildLeafMap(child);
			}
		}
		return count;
	}
	let totalLeaves = 0;
	for (const root of roots) {
		totalLeaves += buildLeafMap(root);
	}

	// Track sub-ring overflow offsets per node
	const subRingDepthOffset = new Map<string, number>();

	// Root: center circle
	const rootLn: LayoutNode<T> = {
		node: centerNode,
		x: -ringWidth, y: -ringWidth,
		w: ringWidth * 2, h: ringWidth * 2,
		cx: 0, cy: 0,
		parent: null, children: [], depth: 0,
		labelOverride: isMultiRoot ? (rootTitle || 'Root') : undefined,
		arcStartAngle: 0, arcEndAngle: TWO_PI,
		arcInnerR: 0, arcOuterR: ringWidth
	};
	nodes.push(rootLn);

	// Lay out children (all roots for multi-root, or root's children for single-root)
	if (effectiveChildren.length > 0) {
		layoutChildren(
			ctrl, effectiveChildren, 1,
			startAngle, TWO_PI, totalLeaves,
			rootLn, nodes, leafMap, ringWidth, subRingDepthOffset
		);
	}

	// Normalize: shift so min x,y = 0
	let minX = Infinity, minY = Infinity;
	for (const n of nodes) {
		if (n.x < minX) minX = n.x;
		if (n.y < minY) minY = n.y;
	}
	for (const n of nodes) {
		n.x -= minX;
		n.y -= minY;
		n.cx = n.x + n.w / 2;
		n.cy = n.y + n.h / 2;
	}

	const result = finishLayout(nodes, [], t0);
	result.levelXArr = [0];
	return result;
}

/**
 * Lay out children as arc segments within a parent's angular sweep.
 * If children don't fit in one ring, overflow into sub-rings.
 * Two-pass allocation: guarantee minimum readable arc, then distribute rest.
 */
function layoutChildren<T>(
	ctrl: TreeController<T>,
	children: LTreeNode<T>[],
	depth: number,
	parentStart: number,
	parentSweep: number,
	parentLeaves: number,
	parentLn: LayoutNode<T>,
	nodes: LayoutNode<T>[],
	leafMap: Map<string, number>,
	ringWidth: number,
	subRingDepthOffset: Map<string, number>
): void {
	const parentExtraRings = subRingDepthOffset.get(parentLn.node.path) ?? 0;

	const baseInnerR = (depth + parentExtraRings) * ringWidth;
	const midR = baseInnerR + ringWidth / 2;

	// Minimum arc angle based on readable arc size
	const minChildArc = midR > 0 ? (MIN_ARC_PX / midR) : 0.1;

	// Only cap the sweep when children need to overflow into sub-rings
	const totalMinSweep = children.length * minChildArc;
	const needsOverflow = totalMinSweep > parentSweep;
	const effectiveSweep = needsOverflow ? Math.min(parentSweep, MAX_CHILD_SWEEP) : parentSweep;

	const maxChildrenPerRow = Math.max(1, Math.floor(effectiveSweep / minChildArc));
	const numRows = Math.ceil(children.length / maxChildrenPerRow);
	const childrenPerRow = Math.ceil(children.length / numRows);

	for (let row = 0; row < numRows; row++) {
		const rowStart = row * childrenPerRow;
		const rowEnd = Math.min(rowStart + childrenPerRow, children.length);
		const rowChildren = children.slice(rowStart, rowEnd);
		if (rowChildren.length === 0) break;

		const innerR = (depth + parentExtraRings + row) * ringWidth;
		const outerR = innerR + ringWidth;
		const rowMidR = (innerR + outerR) / 2;
		const minArcAngle = rowMidR > 0 ? (MIN_ARC_PX / rowMidR) : 0.1;

		// Two-pass allocation: guarantee minimum arc, then distribute remaining space
		const leafCounts: number[] = [];
		let totalLeafWeight = 0;
		let minClampedSweep = 0;

		for (const child of rowChildren) {
			const leaves = leafMap.get(child.path) || 1;
			leafCounts.push(leaves);
			totalLeafWeight += leaves;
		}

		const sweeps = new Array<number>(rowChildren.length);
		let remainingLeaves = 0;

		for (let i = 0; i < rowChildren.length; i++) {
			const proportional = (leafCounts[i] / Math.max(1, totalLeafWeight)) * effectiveSweep;
			if (proportional < minArcAngle) {
				sweeps[i] = minArcAngle;
				minClampedSweep += minArcAngle;
			} else {
				sweeps[i] = 0;
				remainingLeaves += leafCounts[i];
			}
		}

		const remainingSweep = effectiveSweep - minClampedSweep;
		if (remainingSweep > 0 && remainingLeaves > 0) {
			for (let i = 0; i < rowChildren.length; i++) {
				if (sweeps[i] === 0) {
					sweeps[i] = (leafCounts[i] / remainingLeaves) * remainingSweep;
				}
			}
		} else {
			const even = effectiveSweep / rowChildren.length;
			for (let i = 0; i < rowChildren.length; i++) {
				sweeps[i] = even;
			}
		}

		let currentAngle = parentStart;
		for (let i = 0; i < rowChildren.length; i++) {
			const child = rowChildren[i];
			const childSweep = sweeps[i];
			const childLeaves = leafCounts[i];

			const arcStart = currentAngle;
			const arcEnd = currentAngle + childSweep;
			const midAngle = (arcStart + arcEnd) / 2;
			const arcMidR = (innerR + outerR) / 2;

			const cx = Math.cos(midAngle) * arcMidR;
			const cy = Math.sin(midAngle) * arcMidR;
			const bbox = arcBoundingBox(0, 0, innerR, outerR, arcStart, arcEnd);

			const ln: LayoutNode<T> = {
				node: child,
				x: bbox.x, y: bbox.y,
				w: bbox.w, h: bbox.h,
				cx, cy,
				parent: parentLn,
				children: [],
				depth,
				arcStartAngle: arcStart,
				arcEndAngle: arcEnd,
				arcInnerR: innerR,
				arcOuterR: outerR
			};

			nodes.push(ln);
			parentLn.children.push(ln);

			subRingDepthOffset.set(child.path, parentExtraRings + numRows - 1);

			if (child.hasChildren && child.isExpanded) {
				const grandchildren = ctrl.getChildren(child.path);
				if (grandchildren.length > 0) {
					layoutChildren(
						ctrl, grandchildren, depth + 1,
						arcStart, childSweep, childLeaves,
						ln, nodes, leafMap, ringWidth, subRingDepthOffset
					);
				}
			}

			currentAngle += childSweep;
		}
	}
}

/**
 * Compute the axis-aligned bounding box of an arc segment.
 */
function arcBoundingBox(
	cx: number, cy: number,
	innerR: number, outerR: number,
	startAngle: number, endAngle: number
): { x: number; y: number; w: number; h: number } {
	// Sample the four corners of the arc plus any axis crossings
	const points: [number, number][] = [];
	points.push(
		[cx + Math.cos(startAngle) * innerR, cy + Math.sin(startAngle) * innerR],
		[cx + Math.cos(startAngle) * outerR, cy + Math.sin(startAngle) * outerR],
		[cx + Math.cos(endAngle) * innerR, cy + Math.sin(endAngle) * innerR],
		[cx + Math.cos(endAngle) * outerR, cy + Math.sin(endAngle) * outerR]
	);

	// Check axis-aligned extremes (0, π/2, π, 3π/2)
	const axes = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
	for (const a of axes) {
		if (isAngleInRange(a, startAngle, endAngle)) {
			points.push(
				[cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR],
				[cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR]
			);
		}
	}

	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (const [px, py] of points) {
		if (px < minX) minX = px;
		if (py < minY) minY = py;
		if (px > maxX) maxX = px;
		if (py > maxY) maxY = py;
	}

	return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Check if an angle falls within [start, end) accounting for wrapping */
function isAngleInRange(angle: number, start: number, end: number): boolean {
	// Normalize to [0, 2π)
	const norm = (a: number) => ((a % TWO_PI) + TWO_PI) % TWO_PI;
	const a = norm(angle);
	const s = norm(start);
	const e = norm(end);
	if (s <= e) return a >= s && a <= e;
	return a >= s || a <= e; // wraps around 0
}

// ── Text Truncation ──────────────────────────────────────────────────────

/** Truncate text with ellipsis to fit within maxWidth.
 *  Never uses fillText's maxWidth param (which squishes/distorts). */
function truncateText(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number
): string {
	if (maxWidth <= 0) return '';
	if (ctx.measureText(text).width <= maxWidth) return text;
	const ellW = ctx.measureText(ELLIPSIS).width;
	// Binary search for longest prefix that fits
	let lo = 0, hi = text.length;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (ctx.measureText(text.slice(0, mid)).width <= maxWidth - ellW) lo = mid;
		else hi = mid - 1;
	}
	return lo > 0 ? text.slice(0, lo) + ELLIPSIS : ELLIPSIS;
}

// ── Rendering ────────────────────────────────────────────────────────────

/**
 * Draw all sunburst arc segments.
 * Handles fill, stroke, labels, hover highlighting, and selection.
 */
export function drawSunburstNodes<T>(
	ctx: CanvasRenderingContext2D,
	layoutNodes: LayoutNode<T>[],
	sunburstCenterX: number,
	sunburstCenterY: number,
	getDepthColor: (depth: number) => string,
	getLabel: (node: LTreeNode<T>, ln?: LayoutNode<T>) => string,
	hoveredNode: LayoutNode<T> | null,
	selectedPath: string | null,
	fontStr: string,
	zoom: number,
	vl: number, vt: number, vr: number, vb: number,
	theme: CanvasTheme
): number {
	const M = 50;
	let visible = 0;

	// Build ancestor set for hover highlighting
	const hoveredAncestors = new Set<string>();
	if (hoveredNode) {
		let n: LayoutNode<T> | null = hoveredNode;
		while (n) {
			hoveredAncestors.add(n.node.path);
			n = n.parent;
		}
	}

	// Derive a compact font for arc labels:
	// Extract size from fontStr (e.g. "12px ...") → use 2px smaller, with condensed family
	const sizeMatch = fontStr.match(/^(bold\s+)?(\d+(?:\.\d+)?)px\s+(.*)/);
	const baseFontSize = sizeMatch ? parseFloat(sizeMatch[2]) : 12;
	const arcFontSize = Math.max(8, baseFontSize - 1);
	const arcFontFamily = '"Fira Sans Condensed", "Fira Code", "SF Mono", "Cascadia Code", system-ui, sans-serif';
	const arcFont = `${arcFontSize}px ${arcFontFamily}`;
	const arcFontBold = `bold ${arcFontSize}px ${arcFontFamily}`;

	ctx.font = arcFont;
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'center';

	for (const ln of layoutNodes) {
		if (ln.isVirtual) continue;
		// Viewport culling using bounding box
		if (ln.x + ln.w < vl - M || ln.x > vr + M || ln.y + ln.h < vt - M || ln.y > vb + M) continue;
		visible++;

		const depth = ln.depth;
		const baseColor = getDepthColor(depth);
		const isSelected = ln.node.path === selectedPath;
		const isHovered = hoveredNode?.node.path === ln.node.path;
		const isAncestor = hoveredAncestors.has(ln.node.path);
		const isDimmed = hoveredNode !== null && !isAncestor;

		if (depth === 0) {
			// Root: filled circle
			drawRootCircle(ctx, sunburstCenterX, sunburstCenterY,
				ln.arcOuterR!, baseColor, isSelected, isHovered, isDimmed,
				getLabel(ln.node, ln), arcFontBold, theme);
			continue;
		}

		// Arc segment
		const startAngle = ln.arcStartAngle!;
		const endAngle = ln.arcEndAngle!;
		const innerR = ln.arcInnerR!;
		const outerR = ln.arcOuterR!;

		// Fill color: parent nodes solid, leaf nodes lighter
		const isLeaf = !ln.node.hasChildren;
		const alpha = isDimmed ? (isLeaf ? 0.3 : 0.65) : isHovered ? 1.0 : isLeaf ? 0.55 : 0.85;
		ctx.globalAlpha = alpha;

		ctx.beginPath();
		ctx.arc(sunburstCenterX, sunburstCenterY, outerR, startAngle, endAngle);
		ctx.arc(sunburstCenterX, sunburstCenterY, innerR, endAngle, startAngle, true);
		ctx.closePath();

		ctx.fillStyle = baseColor;
		ctx.fill();

		// Border stroke separates adjacent arcs (replaces angular gap)
		ctx.globalAlpha = isDimmed ? 0.6 : 1;
		ctx.strokeStyle = theme.bg;
		ctx.lineWidth = 1;
		ctx.stroke();

		// Hover highlight border
		if (isHovered) {
			ctx.strokeStyle = theme.nodeSelectedBorder;
			ctx.lineWidth = 2;
			ctx.stroke();
		}

		// Selection highlight border
		if (isSelected) {
			ctx.strokeStyle = theme.nodeSelectedBorder;
			ctx.lineWidth = 2.5;
			ctx.stroke();
		}

		ctx.globalAlpha = 1;

		// Label text
		const sweep = endAngle - startAngle;
		const midR = (innerR + outerR) / 2;
		const arcLenPx = sweep * midR;
		const ringWidthPx = outerR - innerR;

		if (arcLenPx * zoom >= MIN_LABEL_ARC_PX && ringWidthPx * zoom >= 10) {
			const label = getLabel(ln.node, ln);
			const midAngle = (startAngle + endAngle) / 2;
			const tx = sunburstCenterX + Math.cos(midAngle) * midR;
			const ty = sunburstCenterY + Math.sin(midAngle) * midR;

			ctx.save();
			ctx.translate(tx, ty);
			// Flip text in left hemisphere so never upside-down
			const flip = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5;
			ctx.rotate(flip ? midAngle + Math.PI : midAngle);

			ctx.fillStyle = isDimmed ? theme.nodeText + '90' : theme.nodeText;
			ctx.font = isSelected ? arcFontBold : arcFont;
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'center';

			// Manually truncate label to fit within ring width (no maxWidth squish)
			const maxTextW = ringWidthPx - 8;
			const truncated = truncateText(ctx, label, maxTextW);
			ctx.fillText(truncated, 0, 0);

			ctx.restore();
		}
	}

	return visible;
}

/** Draw the root as a filled circle with centered label */
function drawRootCircle(
	ctx: CanvasRenderingContext2D,
	cx: number, cy: number, radius: number,
	color: string,
	isSelected: boolean, isHovered: boolean, isDimmed: boolean,
	label: string, rootFont: string,
	theme: CanvasTheme
): void {
	ctx.globalAlpha = isDimmed ? 0.6 : 1;
	ctx.beginPath();
	ctx.arc(cx, cy, radius, 0, TWO_PI);
	ctx.fillStyle = isHovered ? color : color + 'CC';
	ctx.fill();
	ctx.strokeStyle = isSelected ? theme.nodeSelectedBorder : theme.bg;
	ctx.lineWidth = isSelected ? 2.5 : 1.5;
	ctx.stroke();

	ctx.globalAlpha = isDimmed ? 0.7 : 1;
	ctx.fillStyle = theme.nodeText;
	ctx.font = rootFont;
	ctx.textBaseline = 'middle';
	ctx.textAlign = 'center';
	const truncated = truncateText(ctx, label, radius * 1.6);
	ctx.fillText(truncated, cx, cy);
	ctx.globalAlpha = 1;
}

// ── Hit Testing ──────────────────────────────────────────────────────────

/**
 * Build a ring-indexed hit tester for sunburst layout.
 * Pre-groups nodes by their radial ring (innerR/outerR pair) so that
 * hit testing only checks nodes in the matching ring instead of all nodes.
 * With 8000 nodes across ~10 rings, this reduces iterations from 8000 to ~800.
 *
 * Call once after layout; returns a closure for repeated hit testing.
 */
export function buildSunburstHitTester<T>(
	layoutNodes: LayoutNode<T>[],
	centerX: number,
	centerY: number
): (wx: number, wy: number) => LayoutNode<T> | null {
	// Group non-root nodes by ring
	interface Ring { innerR: number; outerR: number; nodes: LayoutNode<T>[]; maxDepth: number }
	const ringMap = new Map<number, Ring>();
	let rootNode: LayoutNode<T> | null = null;

	for (const ln of layoutNodes) {
		if (ln.isVirtual) continue;
		if (ln.arcInnerR === undefined) continue;

		if (ln.depth === 0) {
			rootNode = ln;
			continue;
		}

		// Key by innerR (rings share innerR/outerR, and innerR uniquely identifies the ring band)
		const key = ln.arcInnerR!;
		let ring = ringMap.get(key);
		if (!ring) {
			ring = { innerR: ln.arcInnerR!, outerR: ln.arcOuterR!, nodes: [], maxDepth: 0 };
			ringMap.set(key, ring);
		}
		ring.nodes.push(ln);
		if (ln.depth > ring.maxDepth) ring.maxDepth = ln.depth;
	}

	// Sort rings by innerR for fast iteration
	const rings = Array.from(ringMap.values()).sort((a, b) => a.innerR - b.innerR);
	const rootOuterR = rootNode?.arcOuterR ?? 0;

	return (wx: number, wy: number): LayoutNode<T> | null => {
		const dx = wx - centerX;
		const dy = wy - centerY;
		const dist = Math.sqrt(dx * dx + dy * dy);

		let bestNode: LayoutNode<T> | null = null;
		let bestDepth = -1;

		// Check root circle
		if (rootNode && dist <= rootOuterR) {
			bestNode = rootNode;
			bestDepth = 0;
		}

		let angle = Math.atan2(dy, dx);
		if (angle < 0) angle += TWO_PI;

		// Check only the ring(s) that match the distance
		for (const ring of rings) {
			if (dist < ring.innerR || dist > ring.outerR) continue;

			for (const ln of ring.nodes) {
				if (isAngleInRange(angle, ln.arcStartAngle!, ln.arcEndAngle!) && ln.depth > bestDepth) {
					bestNode = ln;
					bestDepth = ln.depth;
				}
			}
		}

		return bestNode;
	};
}
