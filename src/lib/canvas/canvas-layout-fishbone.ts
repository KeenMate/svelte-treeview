import type { LTreeNode } from '../ltree/ltree-node.svelte.js';
import type { TreeController } from '../core/TreeController.svelte.js';
import type { LayoutNode, LayoutResult, LayoutConfig, GrowthDirection } from './types.js';
import { resolveLevel, finishLayout } from './canvas-layout.js';

/**
 * Fishbone layout: a central spine runs the full length, with branches
 * alternating above and below (horizontal) or left and right (vertical).
 *
 * Each branch is a standard sub-tree growing perpendicular to the spine.
 * Uses shared counters so subtrees don't overlap.
 */
export function computeLayoutFishbone<T>(
	ctrl: TreeController<T>,
	growthDirection: GrowthDirection,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig
): LayoutResult<T> {
	const isV = growthDirection === 'up' || growthDirection === 'down';
	return isV
		? computeFishboneV(ctrl, measureNodeWidth, config)
		: computeFishboneH(ctrl, measureNodeWidth, config);
}

// ── Horizontal fishbone (spine = X axis, branches grow on Y axis) ───

function computeFishboneH<T>(
	ctrl: TreeController<T>,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig
): LayoutResult<T> {
	const t0 = performance.now();
	const nodes: LayoutNode<T>[] = [];

	const roots = ctrl.tree.tree;
	if (roots.length === 0) return finishLayout(nodes, [], t0);

	const rootNode = roots[0];
	const rootW = measureNodeWidth(rootNode);
	const rootH = resolveLevel(config.levelOverrides, 0, 'nodeHeight', config.nodeHeight);

	const allChildren = rootNode.hasChildren && rootNode.isExpanded
		? ctrl.getChildren(rootNode.path) : [];

	// First pass: measure each branch's perpendicular extent so we know
	// how far above/below the spine each branch reaches.
	// We do this by running a dry-layout with a temporary counter.
	const branchExtents: { child: LTreeNode<T>; above: boolean; crossExtent: number }[] = [];

	for (let i = 0; i < allChildren.length; i++) {
		const above = i % 2 === 0;
		const child = allChildren[i];
		const crossExtent = measureBranchCrossExtent(ctrl, child, 1, measureNodeWidth, config);
		branchExtents.push({ child, above, crossExtent });
	}

	// Compute spine Y: leave room for tallest above-branch + root half-height
	const maxAbove = branchExtents.filter(b => b.above).reduce((m, b) => Math.max(m, b.crossExtent), 0);
	const branchGap = config.levelSpacingV;
	const spineY = maxAbove + branchGap + rootH / 2;

	// Root at the start of the spine
	const rootLn: LayoutNode<T> = {
		node: rootNode, x: 0, y: spineY - rootH / 2, w: rootW, h: rootH,
		cx: rootW / 2, cy: spineY, parent: null, children: [], depth: 0
	};

	// Split children into above/below groups — each side lays out independently
	// so branches on opposite sides can overlap in X (no wasted horizontal space)
	const spineGap = config.columnGap;
	const startX = rootW + spineGap;

	const depthYsUp = buildDepthYsUp(spineY - rootH / 2 - branchGap, config);
	const depthYsDown = buildDepthYsDown(spineY + rootH / 2 + branchGap, config);

	// Above branches
	let spineXAbove = startX;
	for (const info of branchExtents) {
		if (!info.above) continue;
		const startIdx = nodes.length;
		const counter = { x: spineXAbove };
		const branchLn = layoutBranchNodeV(ctrl, info.child, 1, rootLn, measureNodeWidth, config, nodes,
			depthYsUp, counter);
		rootLn.children.push(branchLn);
		let branchMaxX = 0;
		for (let i = startIdx; i < nodes.length; i++) {
			branchMaxX = Math.max(branchMaxX, nodes[i].x + nodes[i].w);
		}
		spineXAbove = branchMaxX + spineGap;
	}

	// Below branches
	let spineXBelow = startX;
	for (const info of branchExtents) {
		if (info.above) continue;
		const startIdx = nodes.length;
		const counter = { x: spineXBelow };
		const branchLn = layoutBranchNodeV(ctrl, info.child, 1, rootLn, measureNodeWidth, config, nodes,
			depthYsDown, counter);
		rootLn.children.push(branchLn);
		let branchMaxX = 0;
		for (let i = startIdx; i < nodes.length; i++) {
			branchMaxX = Math.max(branchMaxX, nodes[i].x + nodes[i].w);
		}
		spineXBelow = branchMaxX + spineGap;
	}

	nodes.push(rootLn);
	normalize(nodes);
	mirrorX(nodes);
	const result = finishLayout(nodes, [], t0);
	result.levelXArr = [0];
	return result;
}

/** Build depth→Y mapping for upward branches (Y decreases) */
function buildDepthYsUp(startBottom: number, config: LayoutConfig): (d: number, h: number) => number {
	const cache = new Map<number, number>();
	return (depth: number, h: number): number => {
		let cached = cache.get(depth);
		if (cached !== undefined) return cached - h;

		// Compute bottom edge Y for this depth
		let y = startBottom;
		for (let d = 1; d < depth; d++) {
			const dh = resolveLevel(config.levelOverrides, d, 'nodeHeight', config.nodeHeight);
			const sp = resolveLevel(config.levelOverrides, d, 'levelSpacingV', config.levelSpacingV);
			y -= dh + sp;
		}
		cache.set(depth, y);
		return y - h;
	};
}

/** Build depth→Y mapping for downward branches (Y increases) */
function buildDepthYsDown(startTop: number, config: LayoutConfig): (d: number, h: number) => number {
	const cache = new Map<number, number>();
	return (depth: number, _h: number): number => {
		let cached = cache.get(depth);
		if (cached !== undefined) return cached;

		let y = startTop;
		for (let d = 1; d < depth; d++) {
			const dh = resolveLevel(config.levelOverrides, d, 'nodeHeight', config.nodeHeight);
			const sp = resolveLevel(config.levelOverrides, d, 'levelSpacingV', config.levelSpacingV);
			y += dh + sp;
		}
		cache.set(depth, y);
		return y;
	};
}

/** Layout a node in a vertical branch, sharing X counter */
function layoutBranchNodeV<T>(
	ctrl: TreeController<T>,
	treeNode: LTreeNode<T>,
	depth: number,
	parent: LayoutNode<T>,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig,
	nodes: LayoutNode<T>[],
	getY: (depth: number, h: number) => number,
	counter: { x: number }
): LayoutNode<T> & { _nextX: number } {
	const w = measureNodeWidth(treeNode);
	const h = resolveLevel(config.levelOverrides, depth, 'nodeHeight', config.nodeHeight);
	const gap = resolveLevel(config.levelOverrides, depth, 'nodeGap', config.nodeGap);

	const ln: LayoutNode<T> & { _nextX: number } = {
		node: treeNode, x: 0, y: getY(depth, h), w, h,
		cx: 0, cy: 0, parent, children: [], depth, _nextX: 0
	};

	if (treeNode.hasChildren && treeNode.isExpanded) {
		for (const child of ctrl.getChildren(treeNode.path)) {
			ln.children.push(layoutBranchNodeV(ctrl, child, depth + 1, ln, measureNodeWidth, config, nodes, getY, counter));
		}
	}

	if (ln.children.length > 0) {
		ln.x = (ln.children[0].cx + ln.children[ln.children.length - 1].cx) / 2 - w / 2;
	} else {
		ln.x = counter.x;
		counter.x += w + gap;
	}

	ln.cx = ln.x + w / 2;
	ln.cy = ln.y + h / 2;
	ln._nextX = counter.x;
	nodes.push(ln);
	return ln;
}

// ── Vertical fishbone (spine = Y axis, branches grow on X axis) ─────

function computeFishboneV<T>(
	ctrl: TreeController<T>,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig
): LayoutResult<T> {
	const t0 = performance.now();
	const nodes: LayoutNode<T>[] = [];

	const roots = ctrl.tree.tree;
	if (roots.length === 0) return finishLayout(nodes, [], t0);

	const rootNode = roots[0];
	const rootW = measureNodeWidth(rootNode);
	const rootH = resolveLevel(config.levelOverrides, 0, 'nodeHeight', config.nodeHeight);

	const allChildren = rootNode.hasChildren && rootNode.isExpanded
		? ctrl.getChildren(rootNode.path) : [];

	const branchExtents: { child: LTreeNode<T>; left: boolean; crossExtent: number }[] = [];
	for (let i = 0; i < allChildren.length; i++) {
		const left = i % 2 === 0;
		const crossExtent = measureBranchCrossExtentH(ctrl, allChildren[i], 1, measureNodeWidth, config);
		branchExtents.push({ child: allChildren[i], left, crossExtent });
	}

	const maxLeft = branchExtents.filter(b => b.left).reduce((m, b) => Math.max(m, b.crossExtent), 0);
	const branchGap = config.columnGap;
	const spineX = maxLeft + branchGap + rootW / 2;

	const rootLn: LayoutNode<T> = {
		node: rootNode, x: spineX - rootW / 2, y: 0, w: rootW, h: rootH,
		cx: spineX, cy: rootH / 2, parent: null, children: [], depth: 0
	};

	// Split children into left/right groups — each side lays out independently
	const spineGap = config.levelSpacingV;
	const startY = rootH + spineGap;

	const depthXsL = buildDepthXsLeft(spineX - rootW / 2 - branchGap, measureNodeWidth, config);
	const depthXsR = buildDepthXsRight(spineX + rootW / 2 + branchGap, measureNodeWidth, config);

	// Left branches
	let spineYLeft = startY;
	for (const info of branchExtents) {
		if (!info.left) continue;
		const startIdx = nodes.length;
		const counter = { y: spineYLeft };
		const branchLn = layoutBranchNodeH(ctrl, info.child, 1, rootLn, measureNodeWidth, config, nodes,
			depthXsL, counter);
		rootLn.children.push(branchLn);
		let branchMaxY = 0;
		for (let i = startIdx; i < nodes.length; i++) {
			branchMaxY = Math.max(branchMaxY, nodes[i].y + nodes[i].h);
		}
		spineYLeft = branchMaxY + spineGap;
	}

	// Right branches
	let spineYRight = startY;
	for (const info of branchExtents) {
		if (info.left) continue;
		const startIdx = nodes.length;
		const counter = { y: spineYRight };
		const branchLn = layoutBranchNodeH(ctrl, info.child, 1, rootLn, measureNodeWidth, config, nodes,
			depthXsR, counter);
		rootLn.children.push(branchLn);
		let branchMaxY = 0;
		for (let i = startIdx; i < nodes.length; i++) {
			branchMaxY = Math.max(branchMaxY, nodes[i].y + nodes[i].h);
		}
		spineYRight = branchMaxY + spineGap;
	}

	nodes.push(rootLn);
	normalize(nodes);
	mirrorY(nodes);
	const result = finishLayout(nodes, [], t0);
	result.levelXArr = [0];
	return result;
}

function buildDepthXsRight(startLeft: number, measureNodeWidth: (node: any) => number, config: LayoutConfig): (d: number, w: number) => number {
	const cache = new Map<number, number>();
	return (depth: number, _w: number): number => {
		let cached = cache.get(depth);
		if (cached !== undefined) return cached;
		let x = startLeft;
		for (let d = 1; d < depth; d++) {
			const dw = config.nodeMinWidth;
			const gap = resolveLevel(config.levelOverrides, d, 'columnGap', config.columnGap);
			x += dw + gap;
		}
		cache.set(depth, x);
		return x;
	};
}

function buildDepthXsLeft(startRight: number, measureNodeWidth: (node: any) => number, config: LayoutConfig): (d: number, w: number) => number {
	const cache = new Map<number, number>();
	return (depth: number, w: number): number => {
		let cached = cache.get(depth);
		if (cached !== undefined) return cached - w;
		let x = startRight;
		for (let d = 1; d < depth; d++) {
			const dw = config.nodeMinWidth;
			const gap = resolveLevel(config.levelOverrides, d, 'columnGap', config.columnGap);
			x -= dw + gap;
		}
		cache.set(depth, x);
		return x - w;
	};
}

function layoutBranchNodeH<T>(
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
			ln.children.push(layoutBranchNodeH(ctrl, child, depth + 1, ln, measureNodeWidth, config, nodes, getX, counter));
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

/** Measure total cross-axis (Y) extent of a branch for horizontal fishbone */
function measureBranchCrossExtent<T>(
	ctrl: TreeController<T>,
	node: LTreeNode<T>,
	depth: number,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig
): number {
	const h = resolveLevel(config.levelOverrides, depth, 'nodeHeight', config.nodeHeight);
	const gap = resolveLevel(config.levelOverrides, depth, 'nodeGap', config.nodeGap);

	if (!node.hasChildren || !node.isExpanded) return h;

	const children = ctrl.getChildren(node.path);
	let totalChildCross = 0;
	for (const child of children) {
		totalChildCross += measureBranchCrossExtent(ctrl, child, depth + 1, measureNodeWidth, config);
	}
	totalChildCross += Math.max(0, children.length - 1) * gap;
	const spacing = resolveLevel(config.levelOverrides, depth, 'levelSpacingV', config.levelSpacingV);
	return h + spacing + totalChildCross;
}

/** Measure total cross-axis (X) extent of a branch for vertical fishbone */
function measureBranchCrossExtentH<T>(
	ctrl: TreeController<T>,
	node: LTreeNode<T>,
	depth: number,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig
): number {
	const w = measureNodeWidth(node);
	const gap = resolveLevel(config.levelOverrides, depth, 'nodeGap', config.nodeGap);

	if (!node.hasChildren || !node.isExpanded) return w;

	const children = ctrl.getChildren(node.path);
	let totalChildCross = 0;
	for (const child of children) {
		totalChildCross += measureBranchCrossExtentH(ctrl, child, depth + 1, measureNodeWidth, config);
	}
	totalChildCross += Math.max(0, children.length - 1) * gap;
	const colGap = resolveLevel(config.levelOverrides, depth, 'columnGap', config.columnGap);
	return w + colGap + totalChildCross;
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

/** Mirror X so the root (originally at left) ends up at the right — Ishikawa head position */
function mirrorX<T>(nodes: LayoutNode<T>[]): void {
	let maxR = 0;
	for (const n of nodes) {
		const r = n.x + n.w;
		if (r > maxR) maxR = r;
	}
	for (const n of nodes) {
		n.x = maxR - n.x - n.w;
		n.cx = n.x + n.w / 2;
	}
}

/** Mirror Y so the root (originally at top) ends up at the bottom — vertical Ishikawa head */
function mirrorY<T>(nodes: LayoutNode<T>[]): void {
	let maxB = 0;
	for (const n of nodes) {
		const b = n.y + n.h;
		if (b > maxB) maxB = b;
	}
	for (const n of nodes) {
		n.y = maxB - n.y - n.h;
		n.cy = n.y + n.h / 2;
	}
}
