import type { LTreeNode } from '../ltree/ltree-node.svelte.js';
import type { TreeController } from '../core/TreeController.svelte.js';
import type { LayoutNode, LayoutResult, LayoutConfig, GrowthDirection } from './types.js';
import { resolveLevel, finishLayout } from './canvas-layout.js';

/**
 * Balanced (H-layout) — root is the horizontal crossbar of an "H":
 *
 *   D ──┐              ┌── G
 *       B ─── Root ─── C
 *   E ──┘              └── H
 *
 * - Root centered horizontally; children split into left arm and right arm.
 * - Left arm children are to the LEFT, their subtrees grow further LEFT.
 * - Right arm children are to the RIGHT, their subtrees grow further RIGHT.
 * - Both arms share a Y counter (vertical stacking) so nothing overlaps.
 * - growthDirection is ignored.
 * - Multi-root: if data has >1 level-1 node, a virtual root is created.
 */
export function computeLayoutBalanced<T>(
	ctrl: TreeController<T>,
	_growthDirection: GrowthDirection,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig,
	splitMode: 'even' | 'weighted'
): LayoutResult<T> {
	const t0 = performance.now();
	const nodes: LayoutNode<T>[] = [];

	const roots = ctrl.tree.tree;
	if (roots.length === 0) return finishLayout(nodes, [], t0);

	// Determine center node and its arm children
	let centerNode: LTreeNode<T>;
	let armChildren: LTreeNode<T>[];
	let isVirtualRoot = false;

	if (roots.length === 1) {
		centerNode = roots[0];
		armChildren = centerNode.hasChildren && centerNode.isExpanded
			? ctrl.getChildren(centerNode.path) : [];
	} else {
		centerNode = roots[0];
		armChildren = roots;
		isVirtualRoot = true;
	}

	const centerW = isVirtualRoot ? 0 : measureNodeWidth(centerNode);
	const centerH = isVirtualRoot ? 0 : resolveLevel(config.levelOverrides, 0, 'nodeHeight', config.nodeHeight);

	// Split children into left arm and right arm
	const [leftArm, rightArm] = splitChildren(ctrl, armChildren, splitMode);

	const armDepthOffset = isVirtualRoot ? 0 : 1;

	// Pre-compute max widths at each depth for column alignment
	const depthMaxW = new Map<number, number>();
	for (const child of armChildren) {
		walkMaxWidths(ctrl, child, armDepthOffset, measureNodeWidth, depthMaxW);
	}

	// ── Column X positions ──
	// Right arm: grows rightward from root's right edge
	// rightColX[d] = left edge X of nodes at depth d
	const colGap0 = resolveLevel(config.levelOverrides, 0, 'columnGap', config.columnGap);
	const rightColX: number[] = [];
	rightColX[armDepthOffset] = centerW + colGap0;
	for (let d = armDepthOffset + 1; d <= 20; d++) {
		const prevW = depthMaxW.get(d - 1) || config.nodeMinWidth;
		const gap = resolveLevel(config.levelOverrides, d - 1, 'columnGap', config.columnGap);
		rightColX[d] = rightColX[d - 1] + prevW + gap;
	}

	// Left arm: grows leftward from root's left edge
	// leftColRightEdge[d] = right edge X of nodes at depth d
	const leftColRightEdge: number[] = [];
	leftColRightEdge[armDepthOffset] = -colGap0;
	for (let d = armDepthOffset + 1; d <= 20; d++) {
		const prevW = depthMaxW.get(d - 1) || config.nodeMinWidth;
		const gap = resolveLevel(config.levelOverrides, d - 1, 'columnGap', config.columnGap);
		leftColRightEdge[d] = leftColRightEdge[d - 1] - prevW - gap;
	}

	// Center layout node at x=0
	const centerLn: LayoutNode<T> = {
		node: centerNode, x: 0, y: 0, w: centerW, h: centerH,
		cx: centerW / 2, cy: 0, parent: null, children: [], depth: 0,
		isVirtual: isVirtualRoot
	};

	// Each arm is laid out independently starting at Y=0, then shifted so
	// both arms' vertical midpoints align with the root's cy.

	// ── Layout right arm (standard rightward H-tree) ──
	const rightNodes: LayoutNode<T>[] = [];
	const rightCounter = { y: 0 };
	for (const child of rightArm) {
		const ln = layoutSubtreeH(
			ctrl, child, armDepthOffset, centerLn, measureNodeWidth, config, rightNodes,
			(d) => rightColX[d] ?? (d * 180),
			rightCounter
		);
		centerLn.children.push(ln);
	}

	// ── Layout left arm (leftward H-tree) ──
	const leftNodes: LayoutNode<T>[] = [];
	const leftCounter = { y: 0 };
	for (const child of leftArm) {
		const ln = layoutSubtreeH(
			ctrl, child, armDepthOffset, centerLn, measureNodeWidth, config, leftNodes,
			(d, w) => (leftColRightEdge[d] ?? -(d * 180)) - w,
			leftCounter
		);
		centerLn.children.push(ln);
	}

	// Compute each arm's vertical extent (height of all leaves laid out)
	const rightHeight = rightCounter.y;
	const leftHeight = leftCounter.y;
	const maxArmHeight = Math.max(rightHeight, leftHeight);

	// Center both arms vertically: shift each arm so its midpoint aligns at Y = maxArmHeight / 2
	const rightMidY = rightHeight / 2;
	const leftMidY = leftHeight / 2;
	const targetMidY = maxArmHeight / 2;

	for (const n of rightNodes) {
		n.y += targetMidY - rightMidY;
		n.cy = n.y + n.h / 2;
	}
	for (const n of leftNodes) {
		n.y += targetMidY - leftMidY;
		n.cy = n.y + n.h / 2;
	}

	// Add all arm nodes to the main list
	for (const n of rightNodes) nodes.push(n);
	for (const n of leftNodes) nodes.push(n);

	// Center root vertically on all children
	if (centerLn.children.length > 0) {
		const allCys = centerLn.children.map(c => c.cy);
		const minCy = Math.min(...allCys);
		const maxCy = Math.max(...allCys);
		centerLn.y = (minCy + maxCy) / 2 - centerH / 2;
	}
	centerLn.cy = centerLn.y + centerH / 2;
	centerLn.cx = centerLn.x + centerW / 2;
	nodes.push(centerLn);

	normalize(nodes);
	const result = finishLayout(nodes, [], t0);
	result.levelXArr = [0];
	return result;
}

// ── Subtree Layout ──────────────────────────────────────────────────

/**
 * Lay out a subtree as an H-tree using a shared Y counter.
 * getX(depth, nodeWidth) returns the left edge X for a node at that depth.
 * For right arm: getX returns increasing X. For left arm: decreasing X.
 */
function layoutSubtreeH<T>(
	ctrl: TreeController<T>,
	treeNode: LTreeNode<T>,
	depth: number,
	parent: LayoutNode<T>,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig,
	nodes: LayoutNode<T>[],
	getX: (depth: number, w: number) => number,
	counter: { y: number }
): LayoutNode<T> & { _nextY: number } {
	const w = measureNodeWidth(treeNode);
	const h = resolveLevel(config.levelOverrides, depth, 'nodeHeight', config.nodeHeight);
	const gap = resolveLevel(config.levelOverrides, depth, 'nodeGap', config.nodeGap);

	const ln: LayoutNode<T> & { _nextY: number } = {
		node: treeNode, x: getX(depth, w), y: 0, w, h,
		cx: 0, cy: 0, parent, children: [], depth, _nextY: 0
	};

	if (treeNode.hasChildren && treeNode.isExpanded) {
		for (const child of ctrl.getChildren(treeNode.path)) {
			const childLn = layoutSubtreeH(ctrl, child, depth + 1, ln, measureNodeWidth, config, nodes, getX, counter);
			ln.children.push(childLn);
		}
	}

	if (ln.children.length > 0) {
		ln.y = (ln.children[0].cy + ln.children[ln.children.length - 1].cy) / 2 - h / 2;
	} else {
		ln.y = counter.y;
		counter.y += h + gap;
	}

	ln.cx = ln.x + w / 2;
	ln.cy = ln.y + h / 2;
	ln._nextY = counter.y;
	nodes.push(ln);
	return ln;
}

// ── Helpers ─────────────────────────────────────────────────────────

function walkMaxWidths<T>(
	ctrl: TreeController<T>,
	node: LTreeNode<T>,
	depth: number,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	depthMaxW: Map<number, number>
): void {
	const w = measureNodeWidth(node);
	depthMaxW.set(depth, Math.max(depthMaxW.get(depth) || 0, w));
	if (node.hasChildren && node.isExpanded) {
		for (const child of ctrl.getChildren(node.path)) {
			walkMaxWidths(ctrl, child, depth + 1, measureNodeWidth, depthMaxW);
		}
	}
}

function splitChildren<T>(
	ctrl: TreeController<T>,
	children: LTreeNode<T>[],
	mode: 'even' | 'weighted'
): [LTreeNode<T>[], LTreeNode<T>[]] {
	if (children.length === 0) return [[], []];
	const midIdx = Math.ceil(children.length / 2);

	if (mode === 'weighted') {
		const sizes = children.map(c => countVisibleNodes(ctrl, c));
		const totalSize = sizes.reduce((a, b) => a + b, 0);
		const halfTarget = totalSize / 2;
		let cumSize = 0;
		let splitAt = midIdx;
		for (let i = 0; i < sizes.length; i++) {
			cumSize += sizes[i];
			if (cumSize >= halfTarget) { splitAt = i + 1; break; }
		}
		return [children.slice(0, splitAt), children.slice(splitAt)];
	}
	return [children.slice(0, midIdx), children.slice(midIdx)];
}

function countVisibleNodes<T>(ctrl: TreeController<T>, node: LTreeNode<T>): number {
	let count = 1;
	if (node.hasChildren && node.isExpanded) {
		for (const child of ctrl.getChildren(node.path)) count += countVisibleNodes(ctrl, child);
	}
	return count;
}

function normalize<T>(nodes: LayoutNode<T>[]): void {
	let minX = Infinity, minY = Infinity;
	for (const n of nodes) {
		if (n.x < minX) minX = n.x;
		if (n.y < minY) minY = n.y;
	}
	if (minX !== 0 || minY !== 0) {
		for (const n of nodes) {
			n.x -= minX;
			n.y -= minY;
			n.cx = n.x + n.w / 2;
			n.cy = n.y + n.h / 2;
		}
	}
}
