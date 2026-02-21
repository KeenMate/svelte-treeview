import type { LTreeNode } from '../ltree/ltree-node.svelte.js';
import type { TreeController } from '../core/TreeController.svelte.js';
import type { LayoutNode, GroupBox, LayoutResult, LayoutConfig, CanvasLevelConfig } from './types.js';

const LEVEL_SPACING_H = 180;
const GRID_NODE_W = 120;

/** Resolve a config value for a given depth, falling back to the global value */
function resolveLevel<K extends keyof CanvasLevelConfig>(
	overrides: CanvasLevelConfig[] | undefined,
	depth: number,
	key: K,
	fallback: NonNullable<CanvasLevelConfig[K]>
): NonNullable<CanvasLevelConfig[K]> {
	return (overrides?.[depth]?.[key] ?? fallback) as NonNullable<CanvasLevelConfig[K]>;
}

/** Measure the maximum node width at each depth level */
function measureDepthWidths<T>(
	ctrl: TreeController<T>,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig
): number[] {
	const depthMaxW = new Map<number, number>();

	function measure(treeNode: LTreeNode<T>, depth: number) {
		const w = measureNodeWidth(treeNode);
		depthMaxW.set(depth, Math.max(depthMaxW.get(depth) || 0, w));
		if (treeNode.hasChildren && treeNode.isExpanded) {
			for (const child of ctrl.getChildren(treeNode.path)) {
				measure(child, depth + 1);
			}
		}
	}

	for (const root of ctrl.tree.tree) measure(root, 0);

	let maxDepth = 0;
	for (const d of depthMaxW.keys()) if (d > maxDepth) maxDepth = d;

	const levelX: number[] = [0];
	for (let d = 1; d <= maxDepth + 1; d++) {
		const prevMinW = resolveLevel(config.levelOverrides, d - 1, 'nodeMinWidth', config.nodeMinWidth);
		const prevW = depthMaxW.get(d - 1) || prevMinW;
		const gap = resolveLevel(config.levelOverrides, d - 1, 'columnGap', config.columnGap);
		levelX[d] = levelX[d - 1] + prevW + gap;
	}
	return levelX;
}

/** Calculate grid column count */
function gridCols(count: number, maxGridCols: number): number {
	if (count <= 2) return count;
	return Math.min(maxGridCols, Math.ceil(Math.sqrt(count)));
}

/** Finalize layout: compute bounding box dimensions */
function finishLayout<T>(
	nodes: LayoutNode<T>[],
	groupBoxes: GroupBox[],
	t0: number
): LayoutResult<T> {
	let maxX = 0;
	let maxY = 0;
	for (const n of nodes) {
		if (n.x + n.w > maxX) maxX = n.x + n.w;
		if (n.y + n.h > maxY) maxY = n.y + n.h;
	}
	for (const box of groupBoxes) {
		if (box.x + box.w > maxX) maxX = box.x + box.w;
		if (box.y + box.h > maxY) maxY = box.y + box.h;
	}
	return {
		nodes,
		groupBoxes,
		width: maxX,
		height: maxY,
		levelXArr: [],
		time: performance.now() - t0
	};
}

// ── Layout: horizontal (left-to-right) ──────────────────────────────────

function computeLayoutH<T>(
	ctrl: TreeController<T>,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig
): LayoutResult<T> {
	const t0 = performance.now();
	const levelXArr = measureDepthWidths(ctrl, measureNodeWidth, config);
	const nodes: LayoutNode<T>[] = [];
	let nextY = 0;

	function layout(treeNode: LTreeNode<T>, depth: number, parent: LayoutNode<T> | null): LayoutNode<T> {
		const w = measureNodeWidth(treeNode);
		const h = resolveLevel(config.levelOverrides, depth, 'nodeHeight', config.nodeHeight);
		const gap = resolveLevel(config.levelOverrides, depth, 'nodeGap', config.nodeGap);
		const ln: LayoutNode<T> = {
			node: treeNode,
			x: levelXArr[depth] ?? (depth * LEVEL_SPACING_H),
			y: 0,
			w,
			h,
			cx: 0,
			cy: 0,
			parent,
			children: [],
			depth
		};

		if (treeNode.hasChildren && treeNode.isExpanded) {
			for (const child of ctrl.getChildren(treeNode.path)) {
				ln.children.push(layout(child, depth + 1, ln));
			}
		}

		if (ln.children.length > 0) {
			ln.y = (ln.children[0].cy + ln.children[ln.children.length - 1].cy) / 2 - h / 2;
		} else {
			ln.y = nextY;
			nextY += h + gap;
		}
		ln.cx = ln.x + w / 2;
		ln.cy = ln.y + h / 2;
		nodes.push(ln);
		return ln;
	}

	for (const root of ctrl.tree.tree) layout(root, 0, null);
	const result = finishLayout(nodes, [], t0);
	result.levelXArr = levelXArr;
	return result;
}

// ── Layout: vertical (top-to-bottom) ────────────────────────────────────

function computeLayoutV<T>(
	ctrl: TreeController<T>,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig
): LayoutResult<T> {
	const t0 = performance.now();
	const nodes: LayoutNode<T>[] = [];
	let nextX = 0;

	// Pre-compute cumulative Y offsets per depth
	// Each level's Y = sum of (nodeHeight + levelSpacingV) for all levels above
	const depthY = new Map<number, number>();
	function getDepthY(depth: number): number {
		if (depth === 0) return 0;
		let cached = depthY.get(depth);
		if (cached !== undefined) return cached;
		let y = 0;
		for (let d = 0; d < depth; d++) {
			const h = resolveLevel(config.levelOverrides, d, 'nodeHeight', config.nodeHeight);
			const spacing = resolveLevel(config.levelOverrides, d, 'levelSpacingV', config.levelSpacingV);
			y += h + spacing;
		}
		depthY.set(depth, y);
		return y;
	}

	function layout(treeNode: LTreeNode<T>, depth: number, parent: LayoutNode<T> | null): LayoutNode<T> {
		const w = measureNodeWidth(treeNode);
		const h = resolveLevel(config.levelOverrides, depth, 'nodeHeight', config.nodeHeight);
		const gap = resolveLevel(config.levelOverrides, depth, 'nodeGap', config.nodeGap);
		const ln: LayoutNode<T> = {
			node: treeNode,
			x: 0,
			y: getDepthY(depth),
			w,
			h,
			cx: 0,
			cy: 0,
			parent,
			children: [],
			depth
		};

		if (treeNode.hasChildren && treeNode.isExpanded) {
			for (const child of ctrl.getChildren(treeNode.path)) {
				ln.children.push(layout(child, depth + 1, ln));
			}
		}

		if (ln.children.length > 0) {
			const firstCx = ln.children[0].cx;
			const lastCx = ln.children[ln.children.length - 1].cx;
			ln.x = (firstCx + lastCx) / 2 - w / 2;
		} else {
			ln.x = nextX;
			nextX += w + gap;
		}
		ln.cx = ln.x + w / 2;
		ln.cy = ln.y + h / 2;
		nodes.push(ln);
		return ln;
	}

	for (const root of ctrl.tree.tree) layout(root, 0, null);
	const result = finishLayout(nodes, [], t0);
	result.levelXArr = [0];
	return result;
}

// ── Layout: horizontal grouped ──────────────────────────────────────────

function computeLayoutGroupedH<T>(
	ctrl: TreeController<T>,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig
): LayoutResult<T> {
	const t0 = performance.now();
	const levelXArr = measureDepthWidths(ctrl, measureNodeWidth, config);
	const nodes: LayoutNode<T>[] = [];
	const boxes: GroupBox[] = [];
	let nextY = 0;

	function layout(treeNode: LTreeNode<T>, depth: number, parent: LayoutNode<T> | null): LayoutNode<T> {
		const w = measureNodeWidth(treeNode);
		const h = resolveLevel(config.levelOverrides, depth, 'nodeHeight', config.nodeHeight);
		const gap = resolveLevel(config.levelOverrides, depth, 'nodeGap', config.nodeGap);
		const ln: LayoutNode<T> = {
			node: treeNode,
			x: levelXArr[depth] ?? (depth * LEVEL_SPACING_H),
			y: 0,
			w,
			h,
			cx: 0,
			cy: 0,
			parent,
			children: [],
			depth,
			connectionTargets: []
		};

		if (treeNode.hasChildren && treeNode.isExpanded) {
			const allChildren = ctrl.getChildren(treeNode.path);
			const childDepth = depth + 1;
			const childH = resolveLevel(config.levelOverrides, childDepth, 'nodeHeight', config.nodeHeight);
			const childGap = resolveLevel(config.levelOverrides, childDepth, 'nodeGap', config.nodeGap);
			const childMaxGridCols = resolveLevel(config.levelOverrides, childDepth, 'maxGridCols', config.maxGridCols);
			const childGridNodeMaxW = resolveLevel(config.levelOverrides, childDepth, 'gridNodeMaxW', config.gridNodeMaxW);
			const childGroupSiblings = resolveLevel(config.levelOverrides, childDepth, 'groupSiblings', true);

			const collapsed: LTreeNode<T>[] = [];
			const expanded: LTreeNode<T>[] = [];
			for (const child of allChildren) {
				if (!childGroupSiblings) {
					// When grouping is disabled for this child level, treat all as expanded (laid out individually)
					expanded.push(child);
				} else if (child.hasChildren && child.isExpanded) {
					expanded.push(child);
				} else {
					collapsed.push(child);
				}
			}

			const startY = nextY;

			// Group box for collapsed children
			if (collapsed.length > 0) {
				const gridColW = Math.min(
					childGridNodeMaxW,
					Math.max(GRID_NODE_W, collapsed.reduce((max, c) => Math.max(max, measureNodeWidth(c)), 0))
				);
				const cols = gridCols(collapsed.length, childMaxGridCols);
				const rows = Math.ceil(collapsed.length / cols);
				const boxX = levelXArr[childDepth] ?? (childDepth * LEVEL_SPACING_H);
				const boxY = nextY;
				const boxW = cols * (gridColW + config.gridGap) - config.gridGap + 2 * config.groupPadding;
				const boxH = rows * (childH + config.gridGap) - config.gridGap + 2 * config.groupPadding;

				for (let i = 0; i < collapsed.length; i++) {
					// Column-major order: fill top-to-bottom, then next column
					const col = Math.floor(i / rows);
					const row = i % rows;
					const childLn: LayoutNode<T> = {
						node: collapsed[i],
						x: boxX + config.groupPadding + col * (gridColW + config.gridGap),
						y: boxY + config.groupPadding + row * (childH + config.gridGap),
						w: gridColW,
						h: childH,
						cx: 0,
						cy: 0,
						parent: ln,
						children: [],
						depth: childDepth
					};
					childLn.cx = childLn.x + childLn.w / 2;
					childLn.cy = childLn.y + childH / 2;
					nodes.push(childLn);
				}

				boxes.push({
					x: boxX,
					y: boxY,
					w: boxW,
					h: boxH,
					connX: boxX,
					connY: boxY + boxH / 2,
					depth: childDepth
				});
				ln.connectionTargets!.push({ x: boxX, y: boxY + boxH / 2 });
				nextY += boxH + childGap;
			}

			// Expanded children (laid out individually)
			for (const child of expanded) {
				const childLn = layout(child, childDepth, ln);
				ln.children.push(childLn);
				ln.connectionTargets!.push({ x: childLn.x, y: childLn.cy });
			}

			// Center parent on connection targets
			if (ln.connectionTargets!.length > 0) {
				const firstCY = ln.connectionTargets![0].y;
				const lastCY = ln.connectionTargets![ln.connectionTargets!.length - 1].y;
				ln.y = (firstCY + lastCY) / 2 - h / 2;
			} else {
				ln.y = startY;
			}
		} else {
			ln.y = nextY;
			nextY += h + gap;
		}

		ln.cx = ln.x + w / 2;
		ln.cy = ln.y + h / 2;
		nodes.push(ln);
		return ln;
	}

	for (const root of ctrl.tree.tree) layout(root, 0, null);
	const result = finishLayout(nodes, boxes, t0);
	result.levelXArr = levelXArr;
	return result;
}

// ── Layout: vertical grouped ────────────────────────────────────────────

function computeLayoutGroupedV<T>(
	ctrl: TreeController<T>,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig
): LayoutResult<T> {
	const t0 = performance.now();
	const nodes: LayoutNode<T>[] = [];
	const boxes: GroupBox[] = [];
	let nextX = 0;

	// Pre-compute cumulative Y offsets per depth
	const depthY = new Map<number, number>();
	function getDepthY(depth: number): number {
		if (depth === 0) return 0;
		let cached = depthY.get(depth);
		if (cached !== undefined) return cached;
		let y = 0;
		for (let d = 0; d < depth; d++) {
			const h = resolveLevel(config.levelOverrides, d, 'nodeHeight', config.nodeHeight);
			const spacing = resolveLevel(config.levelOverrides, d, 'levelSpacingV', config.levelSpacingV);
			y += h + spacing;
		}
		depthY.set(depth, y);
		return y;
	}

	function layout(treeNode: LTreeNode<T>, depth: number, parent: LayoutNode<T> | null): LayoutNode<T> {
		const w = measureNodeWidth(treeNode);
		const h = resolveLevel(config.levelOverrides, depth, 'nodeHeight', config.nodeHeight);
		const gap = resolveLevel(config.levelOverrides, depth, 'nodeGap', config.nodeGap);
		const ln: LayoutNode<T> = {
			node: treeNode,
			x: 0,
			y: getDepthY(depth),
			w,
			h,
			cx: 0,
			cy: 0,
			parent,
			children: [],
			depth,
			connectionTargets: []
		};

		if (treeNode.hasChildren && treeNode.isExpanded) {
			const allChildren = ctrl.getChildren(treeNode.path);
			const childDepth = depth + 1;
			const childH = resolveLevel(config.levelOverrides, childDepth, 'nodeHeight', config.nodeHeight);
			const childGap = resolveLevel(config.levelOverrides, childDepth, 'nodeGap', config.nodeGap);
			const childMaxGridCols = resolveLevel(config.levelOverrides, childDepth, 'maxGridCols', config.maxGridCols);
			const childGridNodeMaxW = resolveLevel(config.levelOverrides, childDepth, 'gridNodeMaxW', config.gridNodeMaxW);
			const childGroupSiblings = resolveLevel(config.levelOverrides, childDepth, 'groupSiblings', true);

			const collapsed: LTreeNode<T>[] = [];
			const expanded: LTreeNode<T>[] = [];
			for (const child of allChildren) {
				if (!childGroupSiblings) {
					expanded.push(child);
				} else if (child.hasChildren && child.isExpanded) {
					expanded.push(child);
				} else {
					collapsed.push(child);
				}
			}

			// Group box for collapsed children
			if (collapsed.length > 0) {
				const gridColW = Math.min(
					childGridNodeMaxW,
					Math.max(GRID_NODE_W, collapsed.reduce((max, c) => Math.max(max, measureNodeWidth(c)), 0))
				);
				const cols = gridCols(collapsed.length, childMaxGridCols);
				const rows = Math.ceil(collapsed.length / cols);
				const boxX = nextX;
				const boxY = getDepthY(childDepth);
				const boxW = cols * (gridColW + config.gridGap) - config.gridGap + 2 * config.groupPadding;
				const boxH = rows * (childH + config.gridGap) - config.gridGap + 2 * config.groupPadding;

				for (let i = 0; i < collapsed.length; i++) {
					// Column-major order: fill top-to-bottom, then next column
					const col = Math.floor(i / rows);
					const row = i % rows;
					const childLn: LayoutNode<T> = {
						node: collapsed[i],
						x: boxX + config.groupPadding + col * (gridColW + config.gridGap),
						y: boxY + config.groupPadding + row * (childH + config.gridGap),
						w: gridColW,
						h: childH,
						cx: 0,
						cy: 0,
						parent: ln,
						children: [],
						depth: childDepth
					};
					childLn.cx = childLn.x + childLn.w / 2;
					childLn.cy = childLn.y + childH / 2;
					nodes.push(childLn);
				}

				boxes.push({
					x: boxX,
					y: boxY,
					w: boxW,
					h: boxH,
					connX: boxX + boxW / 2,
					connY: boxY,
					depth: childDepth
				});
				ln.connectionTargets!.push({ x: boxX + boxW / 2, y: boxY });
				nextX += boxW + childGap;
			}

			// Expanded children
			for (const child of expanded) {
				const childLn = layout(child, childDepth, ln);
				ln.children.push(childLn);
				ln.connectionTargets!.push({ x: childLn.cx, y: childLn.y });
			}

			// Center parent
			if (ln.connectionTargets!.length > 0) {
				const firstCX = ln.connectionTargets![0].x;
				const lastCX = ln.connectionTargets![ln.connectionTargets!.length - 1].x;
				ln.x = (firstCX + lastCX) / 2 - w / 2;
			} else {
				ln.x = nextX;
				nextX += w + gap;
			}
		} else {
			ln.x = nextX;
			nextX += w + gap;
		}

		ln.cx = ln.x + w / 2;
		ln.cy = ln.y + h / 2;
		nodes.push(ln);
		return ln;
	}

	for (const root of ctrl.tree.tree) layout(root, 0, null);
	const result = finishLayout(nodes, boxes, t0);
	result.levelXArr = [0];
	return result;
}

// ── Public API ──────────────────────────────────────────────────────────

/** Compute layout for the tree using the specified orientation and grouping */
export function computeLayout<T>(
	ctrl: TreeController<T>,
	orientation: 'horizontal' | 'vertical',
	grouped: boolean,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig
): LayoutResult<T> {
	// Use grouped layout if global groupSiblings is true OR any level overrides it to true
	const anyLevelGrouped = config.levelOverrides?.some(l => l.groupSiblings === true) ?? false;
	const useGrouped = grouped || anyLevelGrouped;

	if (useGrouped) {
		if (orientation === 'vertical') return computeLayoutGroupedV(ctrl, measureNodeWidth, config);
		return computeLayoutGroupedH(ctrl, measureNodeWidth, config);
	}
	if (orientation === 'vertical') return computeLayoutV(ctrl, measureNodeWidth, config);
	return computeLayoutH(ctrl, measureNodeWidth, config);
}
