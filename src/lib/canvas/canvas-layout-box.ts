import type { LTreeNode } from '../ltree/ltree-node.svelte.js';
import type { TreeController } from '../core/TreeController.svelte.js';
import type { LayoutNode, GroupBox, LayoutResult, LayoutConfig } from './types.js';
import { resolveLevel, finishLayout } from './canvas-layout.js';

/**
 * Box (treemap) layout: space-filling nested rectangles.
 * Parent area is subdivided among children proportionally based on
 * visible descendant count. Deeper nesting = smaller rectangles.
 * No connection lines — hierarchy shown by nesting + depth coloring.
 */
export function computeLayoutBox<T>(
	ctrl: TreeController<T>,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig
): LayoutResult<T> {
	const t0 = performance.now();
	const nodes: LayoutNode<T>[] = [];
	const boxes: GroupBox[] = [];

	const roots = ctrl.tree.tree;
	if (roots.length === 0) return finishLayout(nodes, [], t0);

	// Count visible descendants for weighting
	const weights = new Map<string, number>();
	function countWeight(node: LTreeNode<T>): number {
		if (!node.hasChildren || !node.isExpanded) {
			weights.set(node.path, 1);
			return 1;
		}
		const children = ctrl.getChildren(node.path);
		let total = 0;
		for (const child of children) {
			total += countWeight(child);
		}
		const w = Math.max(1, total);
		weights.set(node.path, w);
		return w;
	}

	// Compute total weight across all roots
	let totalWeight = 0;
	for (const root of roots) {
		totalWeight += countWeight(root);
	}

	// Determine canvas bounds: use a reasonable default area
	// proportional to total node count
	const totalNodes = weights.size;
	const nodeArea = config.nodeMinWidth * config.nodeHeight * 4; // approx area per node
	const totalArea = totalNodes * nodeArea;
	const aspect = 16 / 9; // target aspect ratio
	const canvasW = Math.sqrt(totalArea * aspect);
	const canvasH = canvasW / aspect;

	// Layout all roots using squarified treemap
	if (roots.length === 1) {
		// Single root: it gets the entire canvas
		layoutTreemapNode(ctrl, roots[0], 0, 0, 0, canvasW, canvasH, measureNodeWidth, config, nodes, boxes, weights, null);
	} else {
		// Multiple roots: split top-level space proportionally
		const rootWeights = roots.map(r => weights.get(r.path) || 1);
		const rects = squarify(rootWeights, 0, 0, canvasW, canvasH);
		for (let i = 0; i < roots.length; i++) {
			const r = rects[i];
			layoutTreemapNode(ctrl, roots[i], 0, r.x, r.y, r.w, r.h, measureNodeWidth, config, nodes, boxes, weights, null);
		}
	}

	const result = finishLayout(nodes, boxes, t0);
	result.levelXArr = [0];
	return result;
}

/** Layout a single treemap node and its children recursively */
function layoutTreemapNode<T>(
	ctrl: TreeController<T>,
	node: LTreeNode<T>,
	depth: number,
	x: number,
	y: number,
	w: number,
	h: number,
	measureNodeWidth: (node: LTreeNode<T>) => number,
	config: LayoutConfig,
	nodes: LayoutNode<T>[],
	boxes: GroupBox[],
	weights: Map<string, number>,
	parent: LayoutNode<T> | null
): void {
	const nodeH = resolveLevel(config.levelOverrides, depth, 'nodeHeight', config.nodeHeight);
	const padding = config.groupPadding;

	// The node itself occupies a header strip at the top
	const headerH = Math.min(nodeH, h * 0.3); // header takes at most 30% of available height
	const ln: LayoutNode<T> = {
		node,
		x, y,
		w, h: headerH,
		cx: x + w / 2,
		cy: y + headerH / 2,
		parent,
		children: [],
		depth
	};

	nodes.push(ln);

	// Add a group box for the full cell area (shows nesting borders)
	if (node.hasChildren && node.isExpanded) {
		boxes.push({
			x, y, w, h,
			connX: x + w / 2,
			connY: y + h / 2,
			depth
		});

		const children = ctrl.getChildren(node.path);
		if (children.length > 0) {
			const contentX = x + padding;
			const contentY = y + headerH + padding / 2;
			const contentW = w - padding * 2;
			const contentH = h - headerH - padding * 1.5;

			if (contentW > 20 && contentH > 10) {
				const childWeights = children.map(c => weights.get(c.path) || 1);
				const rects = squarify(childWeights, contentX, contentY, contentW, contentH);

				for (let i = 0; i < children.length; i++) {
					const r = rects[i];
					if (r.w >= 10 && r.h >= 10) {
						layoutTreemapNode(
							ctrl, children[i], depth + 1,
							r.x, r.y, r.w, r.h,
							measureNodeWidth, config, nodes, boxes, weights, ln
						);
					}
				}
			}
		}
	}
}

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * Squarified treemap algorithm.
 * Subdivides a rectangle into sub-rectangles proportional to weights,
 * optimizing for aspect ratios closest to 1 (square).
 */
function squarify(
	weights: number[],
	x: number,
	y: number,
	w: number,
	h: number
): Rect[] {
	const total = weights.reduce((a, b) => a + b, 0);
	if (total <= 0 || weights.length === 0) return [];

	const result: Rect[] = new Array(weights.length);

	// Normalize weights to areas
	const areas = weights.map(wt => (wt / total) * w * h);

	// Indices into areas array, sorted by descending area
	const indices = weights.map((_, i) => i);
	indices.sort((a, b) => areas[b] - areas[a]);

	let cx = x, cy = y, cw = w, ch = h;
	let i = 0;

	while (i < indices.length) {
		// Determine row direction
		const isHorizontal = cw >= ch;
		const sideLength = isHorizontal ? ch : cw;

		// Greedily add items to the current row until aspect ratio worsens
		const row: number[] = [indices[i]];
		let rowArea = areas[indices[i]];
		i++;

		while (i < indices.length) {
			const testArea = rowArea + areas[indices[i]];
			const worstBefore = worstAspectRatio(row.map(j => areas[j]), sideLength, rowArea);
			const worstAfter = worstAspectRatio([...row.map(j => areas[j]), areas[indices[i]]], sideLength, testArea);

			if (worstAfter <= worstBefore) {
				row.push(indices[i]);
				rowArea = testArea;
				i++;
			} else {
				break;
			}
		}

		// Layout the row
		const rowThickness = sideLength > 0 ? rowArea / sideLength : 0;

		let offset = 0;
		for (const idx of row) {
			const itemLength = rowArea > 0 ? (areas[idx] / rowArea) * sideLength : 0;
			if (isHorizontal) {
				result[idx] = {
					x: cx,
					y: cy + offset,
					w: rowThickness,
					h: itemLength
				};
			} else {
				result[idx] = {
					x: cx + offset,
					y: cy,
					w: itemLength,
					h: rowThickness
				};
			}
			offset += itemLength;
		}

		// Shrink remaining area
		if (isHorizontal) {
			cx += rowThickness;
			cw -= rowThickness;
		} else {
			cy += rowThickness;
			ch -= rowThickness;
		}
	}

	return result;
}

/** Compute the worst (highest) aspect ratio in a row of rectangles */
function worstAspectRatio(areas: number[], sideLength: number, totalArea: number): number {
	if (sideLength <= 0 || totalArea <= 0) return Infinity;
	const rowThickness = totalArea / sideLength;
	let worst = 0;
	for (const area of areas) {
		const itemLength = area / rowThickness;
		const ratio = itemLength > rowThickness
			? itemLength / rowThickness
			: rowThickness / itemLength;
		if (ratio > worst) worst = ratio;
	}
	return worst;
}
