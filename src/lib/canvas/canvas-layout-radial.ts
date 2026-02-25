import type { LTreeNode } from '../ltree/ltree-node.svelte.js';
import type { TreeController } from '../core/TreeController.svelte.js';
import type { LayoutNode, LayoutResult, LayoutConfig } from './types.js';
import type { CanvasTheme } from './canvas-theme.js';
import { resolveLevel, finishLayout } from './canvas-layout.js';

/**
 * Collect the total arc length needed at each depth level.
 * Arc per node = max(w, h) + gap. Summed across all visible nodes at that depth.
 */
function collectDepthArcs<T>(
	ctrl: TreeController<T>,
	rootNode: LTreeNode<T>,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig
): Map<number, number> {
	const arcSums = new Map<number, number>();

	function walk(node: LTreeNode<T>, depth: number): void {
		if (depth > 0) {
			const w = measureNodeWidth(node);
			const h = resolveLevel(config.levelOverrides, depth, 'nodeHeight', config.nodeHeight);
			const gap = resolveLevel(config.levelOverrides, depth, 'nodeGap', config.nodeGap);
			const arc = Math.max(w, h) + gap;
			arcSums.set(depth, (arcSums.get(depth) || 0) + arc);
		}
		if (node.hasChildren && node.isExpanded) {
			for (const child of ctrl.getChildren(node.path)) {
				walk(child, depth + 1);
			}
		}
	}
	walk(rootNode, 0);
	return arcSums;
}

/**
 * Compute adaptive per-depth radii so each ring has enough circumference
 * for all nodes at that depth. Falls back to linear spacing when rings
 * are already large enough.
 */
function computeDepthRadii(
	arcSums: Map<number, number>,
	ringSpacing: number
): number[] {
	let maxDepth = 0;
	for (const d of arcSums.keys()) if (d > maxDepth) maxDepth = d;

	const radii: number[] = [0]; // depth 0 = center
	for (let d = 1; d <= maxDepth; d++) {
		const totalArc = arcSums.get(d) || 0;
		const minRadiusForFit = totalArc / (2 * Math.PI);
		const minRadiusForSpacing = radii[d - 1] + ringSpacing;
		radii[d] = Math.max(minRadiusForFit, minRadiusForSpacing);
	}
	return radii;
}

/**
 * Radial layout: root at center, branches fan out in all directions.
 * Each depth level forms a concentric ring with adaptive radii that
 * ensure enough circumference for all nodes at that depth.
 * Angle allocation uses a two-pass algorithm:
 *   1. Bottom-up: compute minimum angular extent per subtree so nodes
 *      don't overlap at their ring radius.
 *   2. Top-down: allocate max(proportional, minimum) angles, then normalize.
 * Nodes remain upright (no rotated text).
 */
export function computeLayoutRadial<T>(
	ctrl: TreeController<T>,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig,
	startAngleDeg: number,
	ringSpacing: number
): LayoutResult<T> {
	const t0 = performance.now();
	const nodes: LayoutNode<T>[] = [];

	const roots = ctrl.tree.tree;
	if (roots.length === 0) return finishLayout(nodes, [], t0);

	const rootNode = roots[0];
	const rootW = measureNodeWidth(rootNode);
	const rootH = resolveLevel(config.levelOverrides, 0, 'nodeHeight', config.nodeHeight);

	// Pre-pass: compute adaptive per-depth radii
	const arcSums = collectDepthArcs(ctrl, rootNode, measureNodeWidth, config);
	const depthRadii = computeDepthRadii(arcSums, ringSpacing);

	// Pass 1: count leaves for proportional angle allocation
	const leafCounts = new Map<string, number>();
	function countLeaves(node: LTreeNode<T>): number {
		if (!node.hasChildren || !node.isExpanded) {
			leafCounts.set(node.path, 1);
			return 1;
		}
		const children = ctrl.getChildren(node.path);
		let total = 0;
		for (const child of children) total += countLeaves(child);
		const count = Math.max(1, total);
		leafCounts.set(node.path, count);
		return count;
	}
	const totalLeaves = countLeaves(rootNode);

	// Pass 2 (bottom-up): compute minimum angular extent for each subtree.
	// At radius r, a node needs at least (maxDim + gap) / r radians
	// of angular space. A parent needs at least the sum of its children's min angles.
	const minAngles = new Map<string, number>();
	function computeMinAngle(node: LTreeNode<T>, depth: number): number {
		const w = measureNodeWidth(node);
		const h = resolveLevel(config.levelOverrides, depth, 'nodeHeight', config.nodeHeight);
		const gap = resolveLevel(config.levelOverrides, depth, 'nodeGap', config.nodeGap);
		const radius = depthRadii[depth] ?? depth * ringSpacing;

		// Own minimum angle at this radius
		const nodeSize = Math.max(w, h);
		const ownMinAngle = radius > 0 ? (nodeSize + gap) / radius : 0;

		if (!node.hasChildren || !node.isExpanded) {
			minAngles.set(node.path, ownMinAngle);
			return ownMinAngle;
		}

		const children = ctrl.getChildren(node.path);
		let childrenTotal = 0;
		for (const child of children) {
			childrenTotal += computeMinAngle(child, depth + 1);
		}

		const result = Math.max(ownMinAngle, childrenTotal);
		minAngles.set(node.path, result);
		return result;
	}

	const allChildren = rootNode.hasChildren && rootNode.isExpanded
		? ctrl.getChildren(rootNode.path) : [];

	for (const child of allChildren) {
		computeMinAngle(child, 1);
	}

	// Root at center (0,0) — normalized later
	const rootLn: LayoutNode<T> = {
		node: rootNode,
		x: -rootW / 2, y: -rootH / 2,
		w: rootW, h: rootH,
		cx: 0, cy: 0,
		parent: null, children: [], depth: 0
	};

	// Pass 3 (top-down): allocate angles with dimension-aware spacing
	const startAngle = (startAngleDeg * Math.PI) / 180;
	const fullAngle = 2 * Math.PI;

	if (allChildren.length > 0) {
		layoutRadialChildren(
			ctrl, allChildren, 1,
			measureNodeWidth, config, nodes,
			rootLn, leafCounts, minAngles,
			startAngle, fullAngle, totalLeaves,
			depthRadii, ringSpacing
		);
	}

	nodes.push(rootLn);

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
 * Top-down radial layout: allocate each child max(proportional, minimum) angle,
 * then normalize so total equals parent's sweep.
 */
function layoutRadialChildren<T>(
	ctrl: TreeController<T>,
	children: LTreeNode<T>[],
	depth: number,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig,
	nodes: LayoutNode<T>[],
	parentLn: LayoutNode<T>,
	leafCounts: Map<string, number>,
	minAngles: Map<string, number>,
	startAngle: number,
	sweepAngle: number,
	parentLeaves: number,
	depthRadii: number[],
	ringSpacing: number
): void {
	// Compute effective weight for each child: max of proportional and minimum
	const effectiveWeights: number[] = [];
	let totalWeight = 0;

	for (const child of children) {
		const childLeaves = leafCounts.get(child.path) || 1;
		const proportionalAngle = (childLeaves / parentLeaves) * sweepAngle;
		const minAngle = minAngles.get(child.path) || 0;
		const weight = Math.max(proportionalAngle, minAngle);
		effectiveWeights.push(weight);
		totalWeight += weight;
	}

	// Normalize weights to fit within sweepAngle
	let currentAngle = startAngle;

	for (let i = 0; i < children.length; i++) {
		const child = children[i];
		const childSweep = totalWeight > 0
			? (effectiveWeights[i] / totalWeight) * sweepAngle
			: sweepAngle / children.length;
		const midAngle = currentAngle + childSweep / 2;

		const w = measureNodeWidth(child);
		const h = resolveLevel(config.levelOverrides, depth, 'nodeHeight', config.nodeHeight);
		const radius = depthRadii[depth] ?? depth * ringSpacing;

		// Polar → Cartesian
		const cx = Math.cos(midAngle) * radius;
		const cy = Math.sin(midAngle) * radius;

		const ln: LayoutNode<T> = {
			node: child,
			x: cx - w / 2,
			y: cy - h / 2,
			w, h,
			cx, cy,
			parent: parentLn,
			children: [],
			depth
		};

		// Recurse into children
		if (child.hasChildren && child.isExpanded) {
			const grandchildren = ctrl.getChildren(child.path);
			const childLeaves = leafCounts.get(child.path) || 1;
			layoutRadialChildren(
				ctrl, grandchildren, depth + 1,
				measureNodeWidth, config, nodes,
				ln, leafCounts, minAngles,
				currentAngle, childSweep, childLeaves,
				depthRadii, ringSpacing
			);
		}

		nodes.push(ln);
		parentLn.children.push(ln);
		currentAngle += childSweep;
	}
}

/**
 * Draw bezier connections for radial layout.
 * Curves from parent center to child center with a control point
 * pulled slightly toward the parent for a natural curve.
 */
export function drawRadialConnections<T>(
	ctx: CanvasRenderingContext2D,
	layoutNodes: LayoutNode<T>[],
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
		if (n.children.length === 0) continue;

		for (const child of n.children) {
			// Quick viewport culling
			const minX = Math.min(n.cx, child.cx);
			const maxX = Math.max(n.cx, child.cx);
			const minY = Math.min(n.cy, child.cy);
			const maxY = Math.max(n.cy, child.cy);
			if (maxX < vl - M || minX > vr + M || maxY < vt - M || minY > vb + M) continue;

			const dx = child.cx - n.cx;
			const dy = child.cy - n.cy;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < 1) continue;

			// Control point: midpoint pulled toward parent
			const midX = (n.cx + child.cx) / 2;
			const midY = (n.cy + child.cy) / 2;
			const pull = 0.3;
			const cpX = midX + (n.cx - midX) * pull;
			const cpY = midY + (n.cy - midY) * pull;

			ctx.beginPath();
			ctx.moveTo(n.cx, n.cy);
			ctx.quadraticCurveTo(cpX, cpY, child.cx, child.cy);
			ctx.stroke();
		}
	}
}
