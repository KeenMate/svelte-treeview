<script lang="ts">
	import { onMount } from 'svelte';
	import Tree from '$lib/components/Tree.svelte';
	import TreeProvider from '$lib/components/TreeProvider.svelte';
	import { TreeController } from '$lib/core/TreeController.svelte.js';
	import type { LTreeNode } from '$lib/ltree/types';

	const STORAGE_KEY = 'svelte-treeview-json-loader-config';

	type RendererType = 'tree' | 'canvas' | 'flat';

	// Default config values
	const defaultConfig = {
		idMember: 'id',
		pathMember: 'path',
		parentPathMember: '',
		levelMember: '',
		hasChildrenMember: '',
		isExpandedMember: '',
		orderMember: '',
		treePathSeparator: '.',
		displayMember: 'name',
		sortMember: 'name',
		expandLevel: 2,
		isSorted: true,
		useFlatRendering: true,
		progressiveRender: true,
		initialBatchSize: 20,
		maxBatchSize: 500,
		renderer: 'tree' as RendererType
	};

	// Configuration state - Mappings
	let idMember = $state(defaultConfig.idMember);
	let pathMember = $state(defaultConfig.pathMember);
	let parentPathMember = $state(defaultConfig.parentPathMember);
	let levelMember = $state(defaultConfig.levelMember);
	let hasChildrenMember = $state(defaultConfig.hasChildrenMember);
	let isExpandedMember = $state(defaultConfig.isExpandedMember);
	let orderMember = $state(defaultConfig.orderMember);
	let treePathSeparator = $state(defaultConfig.treePathSeparator);

	// Configuration state - Display
	let displayMember = $state(defaultConfig.displayMember);
	let sortMember = $state(defaultConfig.sortMember);
	let expandLevel = $state(defaultConfig.expandLevel);
	let isSorted = $state(defaultConfig.isSorted);

	// Configuration state - Performance
	let useFlatRendering = $state(defaultConfig.useFlatRendering);
	let progressiveRender = $state(defaultConfig.progressiveRender);
	let initialBatchSize = $state(defaultConfig.initialBatchSize);
	let maxBatchSize = $state(defaultConfig.maxBatchSize);

	// Renderer state
	let renderer: RendererType = $state(defaultConfig.renderer);

	// Canvas dendrogram UI options
	type GrowthDir = 'right' | 'left' | 'down' | 'up';
	let canvasGrowthDirection = $state<GrowthDir>('right');
	// Derived orientation for the custom canvas renderer (which only supports H/V)
	let canvasOrientation = $derived<'horizontal' | 'vertical'>(
		canvasGrowthDirection === 'up' || canvasGrowthDirection === 'down' ? 'vertical' : 'horizontal'
	);
	let canvasGroupSiblings = $state(true);
	let canvasShowDotGrid = $state(false);
	let canvasClickBehavior = $state<'select' | 'expand' | 'expand-and-focus'>('expand');
	let canvasColumnGap = $state(40);
	let canvasGridNodeMaxW = $state(260);

	// Canvas visual configuration (exposed to user)
	let canvasNodeHeight = $state(28);
	let canvasNodeGap = $state(6);
	let canvasLevelSpacingV = $state(60);
	let canvasNodePaddingX = $state(14);
	let canvasNodeMinWidth = $state(100);
	let canvasColorBarW = $state(3);
	let canvasDepthColors = $state(['#f59e0b', '#0d9488', '#7c3aed', '#ec4899']);
	let canvasFontSize = $state(12);
	let canvasFontFamily = $state('"SF Mono", "Cascadia Code", "Fira Code", monospace');
	let canvasZoomLodText = $state(0.35);
	let canvasZoomLodSimple = $state(0.12);
	let canvasGridGap = $state(4);
	let canvasGroupPadding = $state(8);
	let canvasMaxGridCols = $state(10);

	// Flat card view state
	let flatSelectedPath = $state<string | null>(null);

	// Data state
	let jsonData = $state<any[]>([]);
	let jsonError = $state<string | null>(null);
	let fileName = $state<string | null>(null);

	// Load config from localStorage on mount
	onMount(() => {
		loadConfigFromStorage();
	});

	function loadConfigFromStorage() {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const config = JSON.parse(stored);
				idMember = config.idMember ?? defaultConfig.idMember;
				pathMember = config.pathMember ?? defaultConfig.pathMember;
				parentPathMember = config.parentPathMember ?? defaultConfig.parentPathMember;
				levelMember = config.levelMember ?? defaultConfig.levelMember;
				hasChildrenMember = config.hasChildrenMember ?? defaultConfig.hasChildrenMember;
				isExpandedMember = config.isExpandedMember ?? defaultConfig.isExpandedMember;
				orderMember = config.orderMember ?? defaultConfig.orderMember;
				treePathSeparator = config.treePathSeparator ?? defaultConfig.treePathSeparator;
				displayMember = config.displayMember ?? defaultConfig.displayMember;
				sortMember = config.sortMember ?? defaultConfig.sortMember;
				expandLevel = config.expandLevel ?? defaultConfig.expandLevel;
				isSorted = config.isSorted ?? defaultConfig.isSorted;
				useFlatRendering = config.useFlatRendering ?? defaultConfig.useFlatRendering;
				progressiveRender = config.progressiveRender ?? defaultConfig.progressiveRender;
				initialBatchSize = config.initialBatchSize ?? defaultConfig.initialBatchSize;
				maxBatchSize = config.maxBatchSize ?? defaultConfig.maxBatchSize;
				renderer = config.renderer ?? defaultConfig.renderer;
				canvasColumnGap = config.canvasColumnGap ?? 40;
				canvasGridNodeMaxW = config.canvasGridNodeMaxW ?? 260;
				canvasNodeHeight = config.canvasNodeHeight ?? 28;
				canvasNodeGap = config.canvasNodeGap ?? 6;
				canvasLevelSpacingV = config.canvasLevelSpacingV ?? 60;
				canvasNodePaddingX = config.canvasNodePaddingX ?? 14;
				canvasNodeMinWidth = config.canvasNodeMinWidth ?? 100;
				canvasColorBarW = config.canvasColorBarW ?? 3;
				canvasDepthColors = config.canvasDepthColors ?? ['#f59e0b', '#0d9488', '#7c3aed', '#ec4899'];
				canvasFontSize = config.canvasFontSize ?? 12;
				canvasFontFamily = config.canvasFontFamily ?? '"SF Mono", "Cascadia Code", "Fira Code", monospace';
				canvasZoomLodText = config.canvasZoomLodText ?? 0.35;
				canvasZoomLodSimple = config.canvasZoomLodSimple ?? 0.12;
				canvasGridGap = config.canvasGridGap ?? 4;
				canvasGroupPadding = config.canvasGroupPadding ?? 8;
				canvasMaxGridCols = config.canvasMaxGridCols ?? 10;
			}
		} catch (e) {
			console.warn('Failed to load config from localStorage', e);
		}
	}

	function saveConfigToStorage() {
		try {
			const config = {
				idMember, pathMember, parentPathMember, levelMember,
				hasChildrenMember, isExpandedMember, orderMember, treePathSeparator,
				displayMember, sortMember, expandLevel, isSorted,
				useFlatRendering, progressiveRender, initialBatchSize, maxBatchSize,
				renderer, canvasColumnGap, canvasGridNodeMaxW,
				canvasNodeHeight, canvasNodeGap, canvasLevelSpacingV,
				canvasNodePaddingX, canvasNodeMinWidth, canvasColorBarW,
				canvasDepthColors, canvasFontSize, canvasFontFamily,
				canvasZoomLodText, canvasZoomLodSimple,
				canvasGridGap, canvasGroupPadding, canvasMaxGridCols
			};
			localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
		} catch (e) {
			console.warn('Failed to save config to localStorage', e);
		}
	}

	function clearConfig() {
		localStorage.removeItem(STORAGE_KEY);
		idMember = defaultConfig.idMember;
		pathMember = defaultConfig.pathMember;
		parentPathMember = defaultConfig.parentPathMember;
		levelMember = defaultConfig.levelMember;
		hasChildrenMember = defaultConfig.hasChildrenMember;
		isExpandedMember = defaultConfig.isExpandedMember;
		orderMember = defaultConfig.orderMember;
		treePathSeparator = defaultConfig.treePathSeparator;
		displayMember = defaultConfig.displayMember;
		sortMember = defaultConfig.sortMember;
		expandLevel = defaultConfig.expandLevel;
		isSorted = defaultConfig.isSorted;
		useFlatRendering = defaultConfig.useFlatRendering;
		progressiveRender = defaultConfig.progressiveRender;
		initialBatchSize = defaultConfig.initialBatchSize;
		maxBatchSize = defaultConfig.maxBatchSize;
		renderer = defaultConfig.renderer;
		canvasColumnGap = 40;
		canvasGridNodeMaxW = 260;
		canvasNodeHeight = 28;
		canvasNodeGap = 6;
		canvasLevelSpacingV = 60;
		canvasNodePaddingX = 14;
		canvasNodeMinWidth = 100;
		canvasColorBarW = 3;
		canvasDepthColors = ['#f59e0b', '#0d9488', '#7c3aed', '#ec4899'];
		canvasFontSize = 12;
		canvasFontFamily = '"SF Mono", "Cascadia Code", "Fira Code", monospace';
		canvasZoomLodText = 0.35;
		canvasZoomLodSimple = 0.12;
		canvasGridGap = 4;
		canvasGroupPadding = 8;
		canvasMaxGridCols = 10;
	}

	function redrawTree() {
		saveConfigToStorage();
		renderStartTime = performance.now();
		renderTime = null;
		treeKey++;
	}

	// Auto-save config when values change (debounced via effect)
	$effect(() => {
		// Touch all config values to track them
		void [idMember, pathMember, parentPathMember, levelMember, hasChildrenMember,
			isExpandedMember, orderMember, treePathSeparator, displayMember, sortMember,
			expandLevel, isSorted, useFlatRendering, progressiveRender, initialBatchSize, maxBatchSize,
			renderer, canvasColumnGap, canvasGridNodeMaxW,
			canvasNodeHeight, canvasNodeGap, canvasLevelSpacingV,
			canvasNodePaddingX, canvasNodeMinWidth, canvasColorBarW,
			canvasDepthColors, canvasFontSize, canvasFontFamily,
			canvasZoomLodText, canvasZoomLodSimple,
			canvasGridGap, canvasGroupPadding, canvasMaxGridCols];
		saveConfigToStorage();
	});

	// Performance metrics
	let parseTime = $state<number | null>(null);
	let renderStartTime = $state<number | null>(null);
	let renderTime = $state<number | null>(null);
	let nodeCount = $state<number>(0);

	// Tree state
	let treeRef: Tree<any>;
	let selectedNode = $state<LTreeNode<any> | null>(null);
	let insertResult = $state<any>(null);
	let treeKey = $state(0);

	// Drop zone state
	let isDragging = $state(false);
	let dropZoneRef: HTMLDivElement;

	// Sample data for quick testing
	const sampleData = [
		{ id: 1, path: '1', name: 'Root 1' },
		{ id: 2, path: '1.1', name: 'Child 1.1' },
		{ id: 3, path: '1.2', name: 'Child 1.2' },
		{ id: 4, path: '1.1.1', name: 'Grandchild 1.1.1' },
		{ id: 5, path: '2', name: 'Root 2' },
		{ id: 6, path: '2.1', name: 'Child 2.1' }
	];

	// Shared JSON parsing logic
	function parseJsonData(text: string, source: string) {
		const startParse = performance.now();
		jsonError = null;
		renderTime = null;

		try {
			const parsed = JSON.parse(text);

			// Handle both array and object with array property
			if (Array.isArray(parsed)) {
				jsonData = parsed;
			} else if (typeof parsed === 'object' && parsed !== null) {
				// Try to find an array property
				const arrayProp = Object.keys(parsed).find(key => Array.isArray(parsed[key]));
				if (arrayProp) {
					jsonData = parsed[arrayProp];
					fileName = `${source} (${arrayProp})`;
				} else {
					throw new Error('JSON must be an array or contain an array property');
				}
			} else {
				throw new Error('JSON must be an array or object');
			}

			if (!fileName || !fileName.startsWith(source)) {
				fileName = source;
			}
			parseTime = performance.now() - startParse;
			nodeCount = jsonData.length;
			renderStartTime = performance.now();
			treeKey++;
		} catch (err) {
			jsonError = err instanceof Error ? err.message : 'Failed to parse JSON';
			jsonData = [];
		}
	}

	function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		loadFile(file);
	}

	function loadFile(file: File) {
		fileName = file.name;
		jsonError = null;
		parseTime = null;
		renderTime = null;

		const reader = new FileReader();
		reader.onload = (e) => {
			const text = e.target?.result as string;
			parseJsonData(text, file.name);
		};
		reader.onerror = () => {
			jsonError = 'Failed to read file';
		};
		reader.readAsText(file);
	}

	function loadSampleData() {
		fileName = 'sample-data.json';
		jsonError = null;
		parseTime = 0;
		nodeCount = sampleData.length;
		jsonData = [...sampleData];
		renderStartTime = performance.now();
		treeKey++;
	}

	function clearData() {
		jsonData = [];
		jsonError = null;
		fileName = null;
		parseTime = null;
		renderTime = null;
		nodeCount = 0;
		insertResult = null;
		selectedNode = null;
	}

	function sortCallback(items: LTreeNode<any>[]) {
		if (!sortMember) return items;
		return [...items].sort((a, b) => {
			const aVal = a.data?.[sortMember] ?? '';
			const bVal = b.data?.[sortMember] ?? '';
			return String(aVal).localeCompare(String(bVal));
		});
	}

	function handleTreeRendered() {
		if (renderStartTime) {
			renderTime = performance.now() - renderStartTime;
			renderStartTime = null;
		}
	}

	// Drag and drop handlers
	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragging = true;
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		// Only set isDragging to false if we're leaving the drop zone entirely
		const rect = dropZoneRef?.getBoundingClientRect();
		if (rect) {
			const { clientX, clientY } = e;
			if (
				clientX < rect.left ||
				clientX > rect.right ||
				clientY < rect.top ||
				clientY > rect.bottom
			) {
				isDragging = false;
			}
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		isDragging = false;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			const file = files[0];
			if (file.type === 'application/json' || file.name.endsWith('.json')) {
				loadFile(file);
			} else {
				jsonError = 'Please drop a JSON file';
			}
		}
	}

	// Clipboard paste handler
	async function handlePaste() {
		try {
			const text = await navigator.clipboard.readText();
			if (text.trim()) {
				parseJsonData(text, 'clipboard');
			}
		} catch (err) {
			jsonError = 'Failed to read from clipboard. Make sure you have copied valid JSON.';
		}
	}

	// Global paste event listener
	function handleGlobalPaste(e: ClipboardEvent) {
		// Only handle if not focused on an input
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
			return;
		}

		const text = e.clipboardData?.getData('text');
		if (text?.trim()) {
			// Check if it looks like JSON
			const trimmed = text.trim();
			if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
				e.preventDefault();
				parseJsonData(text, 'clipboard');
			}
		}
	}

	// Detect available members from first data item
	let availableMembers = $derived(
		jsonData.length > 0 ? Object.keys(jsonData[0]) : []
	);

	// Auto-detect members when data changes
	$effect(() => {
		if (availableMembers.length > 0) {
			// Try to auto-detect common member names
			if (availableMembers.includes('id') && !idMember) idMember = 'id';
			if (availableMembers.includes('path') && !pathMember) pathMember = 'path';
			if (availableMembers.includes('name') && !displayMember) displayMember = 'name';
			if (availableMembers.includes('title') && !displayMember) displayMember = 'title';
		}
	});

	// Measure render time after tree updates
	$effect(() => {
		if (jsonData.length > 0 && renderStartTime) {
			// Use requestAnimationFrame to measure after DOM update
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					handleTreeRendered();
				});
			});
		}
	});

	// ════════════════════════════════════════════════════════════════════════
	// CANVAS DENDROGRAM RENDERER
	// ════════════════════════════════════════════════════════════════════════

	interface LayoutNode {
		node: LTreeNode<any>;
		x: number; y: number; w: number; h: number;
		cx: number; cy: number;
		parent: LayoutNode | null;
		children: LayoutNode[];
		depth: number;
		connectionTargets?: { x: number; y: number }[];
	}

	interface GroupBox {
		x: number; y: number; w: number; h: number;
		connX: number; connY: number;
		depth: number;
	}

	// Non-configurable canvas constants
	const CV_LEVEL_SPACING_H = 180;
	const CV_MINIMAP_W = 160;
	const CV_MINIMAP_H = 120;
	const CV_MINIMAP_MARGIN = 12;
	const CV_MINIMAP_PAD = 6;
	const CV_GRID_NODE_W = 120;
	const CV_ANIM_DURATION = 400;

	// Derived font strings (depend on canvasFontSize/canvasFontFamily state)
	let canvasFont = $derived(`${canvasFontSize}px ${canvasFontFamily}`);
	let canvasFontBold = $derived(`bold ${canvasFontSize}px ${canvasFontFamily}`);

	// Canvas internal state
	let canvasEl: HTMLCanvasElement | undefined = $state();
	let canvasContainerEl: HTMLDivElement | undefined = $state();
	let canvasPanX = $state(40);
	let canvasPanY = $state(40);
	let canvasZoom = $state(1);
	let canvasLayoutNodes: LayoutNode[] = [];
	let canvasGroupBoxes: GroupBox[] = [];
	let canvasLayoutWidth = 0;
	let canvasLayoutHeight = 0;
	let canvasIsPanning = $state(false);
	let canvasPanStartX = 0;
	let canvasPanStartY = 0;
	let canvasPanStartPanX = 0;
	let canvasPanStartPanY = 0;
	let canvasHoveredNode: LayoutNode | null = $state.raw(null);
	let canvasSelectedPath = $state<string | null>(null);
	let canvasLayoutTime = $state(0);
	let canvasDrawTime = $state(0);
	let canvasVisibleCount = $state(0);
	let canvasTotalCount = $state(0);
	let canvasAnimFrom: { panX: number; panY: number; zoom: number } | null = null;
	let canvasAnimTo: { panX: number; panY: number; zoom: number } | null = null;
	let canvasAnimStartTime = 0;
	let canvasIsMinimapPanning = false;
	let canvasCtrlRef: TreeController<any> | null = null;
	let canvasRafId: number | null = null;
	let canvasLevelX: number[] = [0];

	// Text width cache
	let cvTextCache = new Map<string, number>();
	let cvMeasureCtx: CanvasRenderingContext2D | null = null;

	function cvGetTextWidth(text: string): number {
		let w = cvTextCache.get(text);
		if (w !== undefined) return w;
		if (!cvMeasureCtx) {
			const c = document.createElement('canvas');
			cvMeasureCtx = c.getContext('2d')!;
			cvMeasureCtx.font = canvasFont;
		}
		w = cvMeasureCtx.measureText(text).width;
		cvTextCache.set(text, w);
		return w;
	}

	function cvNodeWidth(treeNode: LTreeNode<any>): number {
		const name = (displayMember && treeNode.data?.[displayMember]) || treeNode.path;
		const tw = cvGetTextWidth(name);
		const chevronW = treeNode.hasChildren ? 16 : 0;
		return Math.max(canvasNodeMinWidth, tw + canvasNodePaddingX * 2 + canvasColorBarW + chevronW);
	}

	// ── Canvas Layout ─────────────────────────────────────────────────────

	function cvGridCols(count: number): number {
		if (count <= 2) return count;
		return Math.min(canvasMaxGridCols, Math.ceil(Math.sqrt(count)));
	}

	function cvMeasureDepthWidths(ctrl: TreeController<any>): number[] {
		const depthMaxW = new Map<number, number>();
		function measure(treeNode: LTreeNode<any>, depth: number) {
			const w = cvNodeWidth(treeNode);
			depthMaxW.set(depth, Math.max(depthMaxW.get(depth) || 0, w));
			if (treeNode.hasChildren && treeNode.isExpanded) {
				for (const child of ctrl.getChildren(treeNode.path))
					measure(child, depth + 1);
			}
		}
		for (const root of ctrl.tree.tree) measure(root, 0);
		let maxDepth = 0;
		for (const d of depthMaxW.keys()) if (d > maxDepth) maxDepth = d;
		const levelX: number[] = [0];
		for (let d = 1; d <= maxDepth + 1; d++) {
			const prevW = depthMaxW.get(d - 1) || canvasNodeMinWidth;
			levelX[d] = levelX[d - 1] + prevW + canvasColumnGap;
		}
		return levelX;
	}

	function cvComputeLayoutH(ctrl: TreeController<any>) {
		const t0 = performance.now();
		canvasLevelX = cvMeasureDepthWidths(ctrl);
		const nodes: LayoutNode[] = [];
		let nextY = 0;

		function layout(treeNode: LTreeNode<any>, depth: number, parent: LayoutNode | null): LayoutNode {
			const w = cvNodeWidth(treeNode);
			const ln: LayoutNode = {
				node: treeNode, x: canvasLevelX[depth] ?? (depth * CV_LEVEL_SPACING_H), y: 0, w, h: canvasNodeHeight,
				cx: 0, cy: 0, parent, children: [], depth
			};
			if (treeNode.hasChildren && treeNode.isExpanded) {
				for (const child of ctrl.getChildren(treeNode.path)) {
					ln.children.push(layout(child, depth + 1, ln));
				}
			}
			if (ln.children.length > 0) {
				ln.y = (ln.children[0].cy + ln.children[ln.children.length - 1].cy) / 2 - canvasNodeHeight / 2;
			} else {
				ln.y = nextY;
				nextY += canvasNodeHeight + canvasNodeGap;
			}
			ln.cx = ln.x + w / 2;
			ln.cy = ln.y + canvasNodeHeight / 2;
			nodes.push(ln);
			return ln;
		}

		for (const root of ctrl.tree.tree) layout(root, 0, null);
		cvFinishLayout(nodes, t0);
	}

	function cvComputeLayoutV(ctrl: TreeController<any>) {
		const t0 = performance.now();
		const nodes: LayoutNode[] = [];
		let nextX = 0;

		function layout(treeNode: LTreeNode<any>, depth: number, parent: LayoutNode | null): LayoutNode {
			const w = cvNodeWidth(treeNode);
			const ln: LayoutNode = {
				node: treeNode, x: 0, y: depth * (canvasNodeHeight + canvasLevelSpacingV), w, h: canvasNodeHeight,
				cx: 0, cy: 0, parent, children: [], depth
			};
			if (treeNode.hasChildren && treeNode.isExpanded) {
				for (const child of ctrl.getChildren(treeNode.path)) {
					ln.children.push(layout(child, depth + 1, ln));
				}
			}
			if (ln.children.length > 0) {
				ln.x = (ln.children[0].cx + ln.children[ln.children.length - 1].cx) / 2 - w / 2;
			} else {
				ln.x = nextX;
				nextX += w + canvasNodeGap;
			}
			ln.cx = ln.x + w / 2;
			ln.cy = ln.y + canvasNodeHeight / 2;
			nodes.push(ln);
			return ln;
		}

		for (const root of ctrl.tree.tree) layout(root, 0, null);
		cvFinishLayout(nodes, t0);
	}

	function cvComputeLayoutGroupedH(ctrl: TreeController<any>) {
		const t0 = performance.now();
		canvasLevelX = cvMeasureDepthWidths(ctrl);
		const nodes: LayoutNode[] = [];
		const boxes: GroupBox[] = [];
		let nextY = 0;

		function layout(treeNode: LTreeNode<any>, depth: number, parent: LayoutNode | null): LayoutNode {
			const w = cvNodeWidth(treeNode);
			const ln: LayoutNode = {
				node: treeNode, x: canvasLevelX[depth] ?? (depth * CV_LEVEL_SPACING_H), y: 0, w, h: canvasNodeHeight,
				cx: 0, cy: 0, parent, children: [], depth, connectionTargets: []
			};

			if (treeNode.hasChildren && treeNode.isExpanded) {
				const allChildren = ctrl.getChildren(treeNode.path);
				const collapsed: LTreeNode<any>[] = [];
				const expanded: LTreeNode<any>[] = [];
				for (const child of allChildren) {
					if (child.hasChildren && child.isExpanded) expanded.push(child);
					else collapsed.push(child);
				}

				if (collapsed.length > 0) {
					const gridColW = Math.min(canvasGridNodeMaxW,
						Math.max(CV_GRID_NODE_W,
							collapsed.reduce((max, c) => Math.max(max, cvNodeWidth(c)), 0)));
					const cols = cvGridCols(collapsed.length);
					const rows = Math.ceil(collapsed.length / cols);
					const boxX = canvasLevelX[depth + 1] ?? ((depth + 1) * CV_LEVEL_SPACING_H);
					const boxY = nextY;
					const boxW = cols * (gridColW + canvasGridGap) - canvasGridGap + 2 * canvasGroupPadding;
					const boxH = rows * (canvasNodeHeight + canvasGridGap) - canvasGridGap + 2 * canvasGroupPadding;

					for (let i = 0; i < collapsed.length; i++) {
						const col = i % cols;
						const row = Math.floor(i / cols);
						const childLn: LayoutNode = {
							node: collapsed[i],
							x: boxX + canvasGroupPadding + col * (gridColW + canvasGridGap),
							y: boxY + canvasGroupPadding + row * (canvasNodeHeight + canvasGridGap),
							w: gridColW, h: canvasNodeHeight,
							cx: 0, cy: 0, parent: ln, children: [], depth: depth + 1
						};
						childLn.cx = childLn.x + childLn.w / 2;
						childLn.cy = childLn.y + canvasNodeHeight / 2;
						nodes.push(childLn);
					}

					boxes.push({ x: boxX, y: boxY, w: boxW, h: boxH, connX: boxX, connY: boxY + boxH / 2, depth: depth + 1 });
					ln.connectionTargets!.push({ x: boxX, y: boxY + boxH / 2 });
					nextY += boxH + canvasNodeGap;
				}

				for (const child of expanded) {
					const childLn = layout(child, depth + 1, ln);
					ln.children.push(childLn);
					ln.connectionTargets!.push({ x: childLn.x, y: childLn.cy });
				}

				if (ln.connectionTargets!.length > 0) {
					const firstCY = ln.connectionTargets![0].y;
					const lastCY = ln.connectionTargets![ln.connectionTargets!.length - 1].y;
					ln.y = (firstCY + lastCY) / 2 - canvasNodeHeight / 2;
				}
			} else {
				ln.y = nextY;
				nextY += canvasNodeHeight + canvasNodeGap;
			}

			ln.cx = ln.x + w / 2;
			ln.cy = ln.y + canvasNodeHeight / 2;
			nodes.push(ln);
			return ln;
		}

		for (const root of ctrl.tree.tree) layout(root, 0, null);
		canvasGroupBoxes = boxes;
		cvFinishLayout(nodes, t0);
	}

	function cvComputeLayoutGroupedV(ctrl: TreeController<any>) {
		const t0 = performance.now();
		const nodes: LayoutNode[] = [];
		const boxes: GroupBox[] = [];
		let nextX = 0;

		function layout(treeNode: LTreeNode<any>, depth: number, parent: LayoutNode | null): LayoutNode {
			const w = cvNodeWidth(treeNode);
			const ln: LayoutNode = {
				node: treeNode, x: 0, y: depth * (canvasNodeHeight + canvasLevelSpacingV), w, h: canvasNodeHeight,
				cx: 0, cy: 0, parent, children: [], depth, connectionTargets: []
			};

			if (treeNode.hasChildren && treeNode.isExpanded) {
				const allChildren = ctrl.getChildren(treeNode.path);
				const collapsed: LTreeNode<any>[] = [];
				const expanded: LTreeNode<any>[] = [];
				for (const child of allChildren) {
					if (child.hasChildren && child.isExpanded) expanded.push(child);
					else collapsed.push(child);
				}

				if (collapsed.length > 0) {
					const gridColW = Math.min(canvasGridNodeMaxW,
						Math.max(CV_GRID_NODE_W,
							collapsed.reduce((max, c) => Math.max(max, cvNodeWidth(c)), 0)));
					const cols = cvGridCols(collapsed.length);
					const rows = Math.ceil(collapsed.length / cols);
					const boxX = nextX;
					const boxY = (depth + 1) * (canvasNodeHeight + canvasLevelSpacingV);
					const boxW = cols * (gridColW + canvasGridGap) - canvasGridGap + 2 * canvasGroupPadding;
					const boxH = rows * (canvasNodeHeight + canvasGridGap) - canvasGridGap + 2 * canvasGroupPadding;

					for (let i = 0; i < collapsed.length; i++) {
						const col = i % cols;
						const row = Math.floor(i / cols);
						const childLn: LayoutNode = {
							node: collapsed[i],
							x: boxX + canvasGroupPadding + col * (gridColW + canvasGridGap),
							y: boxY + canvasGroupPadding + row * (canvasNodeHeight + canvasGridGap),
							w: gridColW, h: canvasNodeHeight,
							cx: 0, cy: 0, parent: ln, children: [], depth: depth + 1
						};
						childLn.cx = childLn.x + childLn.w / 2;
						childLn.cy = childLn.y + canvasNodeHeight / 2;
						nodes.push(childLn);
					}

					boxes.push({ x: boxX, y: boxY, w: boxW, h: boxH, connX: boxX + boxW / 2, connY: boxY, depth: depth + 1 });
					ln.connectionTargets!.push({ x: boxX + boxW / 2, y: boxY });
					nextX += boxW + canvasNodeGap;
				}

				for (const child of expanded) {
					const childLn = layout(child, depth + 1, ln);
					ln.children.push(childLn);
					ln.connectionTargets!.push({ x: childLn.cx, y: childLn.y });
				}

				if (ln.connectionTargets!.length > 0) {
					const firstCX = ln.connectionTargets![0].x;
					const lastCX = ln.connectionTargets![ln.connectionTargets!.length - 1].x;
					ln.x = (firstCX + lastCX) / 2 - w / 2;
				} else {
					ln.x = nextX;
					nextX += w + canvasNodeGap;
				}
			} else {
				ln.x = nextX;
				nextX += w + canvasNodeGap;
			}

			ln.cx = ln.x + w / 2;
			ln.cy = ln.y + canvasNodeHeight / 2;
			nodes.push(ln);
			return ln;
		}

		for (const root of ctrl.tree.tree) layout(root, 0, null);
		canvasGroupBoxes = boxes;
		cvFinishLayout(nodes, t0);
	}

	function cvFinishLayout(nodes: LayoutNode[], t0: number) {
		canvasLayoutNodes = nodes;
		canvasTotalCount = nodes.length;
		let maxX = 0, maxY = 0;
		for (const n of nodes) {
			if (n.x + n.w > maxX) maxX = n.x + n.w;
			if (n.y + n.h > maxY) maxY = n.y + n.h;
		}
		for (const box of canvasGroupBoxes) {
			if (box.x + box.w > maxX) maxX = box.x + box.w;
			if (box.y + box.h > maxY) maxY = box.y + box.h;
		}
		canvasLayoutWidth = maxX;
		canvasLayoutHeight = maxY;
		canvasLayoutTime = performance.now() - t0;
	}

	function computeCanvasLayout(ctrl: TreeController<any>) {
		canvasGroupBoxes = [];
		if (canvasGroupSiblings) {
			if (canvasOrientation === 'vertical') cvComputeLayoutGroupedV(ctrl);
			else cvComputeLayoutGroupedH(ctrl);
		} else {
			if (canvasOrientation === 'vertical') cvComputeLayoutV(ctrl);
			else cvComputeLayoutH(ctrl);
		}
	}

	// ── Canvas coordinate transforms & hit testing ────────────────────────

	function cvScreenToWorld(sx: number, sy: number): [number, number] {
		return [(sx - canvasPanX) / canvasZoom, (sy - canvasPanY) / canvasZoom];
	}

	function cvHitTest(wx: number, wy: number): LayoutNode | null {
		for (let i = canvasLayoutNodes.length - 1; i >= 0; i--) {
			const n = canvasLayoutNodes[i];
			if (wx >= n.x && wx <= n.x + n.w && wy >= n.y && wy <= n.y + n.h) return n;
		}
		return null;
	}

	function cvIsChevronHit(ln: LayoutNode, wx: number, wy: number): boolean {
		if (!ln.node.hasChildren) return false;
		const chevLeft = ln.x + ln.w - 20;
		return wx >= chevLeft && wx <= ln.x + ln.w && wy >= ln.y && wy <= ln.y + ln.h;
	}

	// ── Canvas drawing ────────────────────────────────────────────────────

	function canvasDraw() {
		if (!canvasEl || !canvasContainerEl) return;
		const t0 = performance.now();
		const ctx = canvasEl.getContext('2d')!;
		const dpr = window.devicePixelRatio || 1;
		const rect = canvasContainerEl.getBoundingClientRect();
		const cw = rect.width;
		const ch = rect.height;
		console.log('[json-loader] draw: cw=', cw, 'ch=', ch, 'nodes=', canvasLayoutNodes.length, 'panX=', canvasPanX, 'panY=', canvasPanY, 'zoom=', canvasZoom);

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

		// Background
		ctx.fillStyle = '#f8fafc';
		ctx.fillRect(0, 0, cw, ch);
		const gridSize = 20 * canvasZoom;
		if (canvasShowDotGrid && gridSize > 6) {
			ctx.fillStyle = '#cbd5e1';
			ctx.beginPath();
			const startX = canvasPanX % gridSize;
			const startY = canvasPanY % gridSize;
			for (let gx = startX; gx < cw; gx += gridSize) {
				for (let gy = startY; gy < ch; gy += gridSize) {
					ctx.moveTo(gx + 0.75, gy);
					ctx.arc(gx, gy, 0.75, 0, Math.PI * 2);
				}
			}
			ctx.fill();
		}

		ctx.save();
		ctx.translate(canvasPanX, canvasPanY);
		ctx.scale(canvasZoom, canvasZoom);

		// Viewport bounds for culling
		const vl = -canvasPanX / canvasZoom;
		const vt = -canvasPanY / canvasZoom;
		const vr = vl + cw / canvasZoom;
		const vb = vt + ch / canvasZoom;
		const M = 50;
		console.log('[json-loader] viewport: vl=', vl, 'vt=', vt, 'vr=', vr, 'vb=', vb, 'first node:', canvasLayoutNodes[0]?.x, canvasLayoutNodes[0]?.y);

		let visible = 0;
		const isV = canvasOrientation === 'vertical';

		// ── Draw connections ──
		ctx.strokeStyle = '#94a3b8';
		ctx.lineWidth = 1.5;
		for (const n of canvasLayoutNodes) {
			if (n.connectionTargets && n.connectionTargets.length > 0) {
				const targets = n.connectionTargets;
				let cMinX = n.x, cMaxX = n.x + n.w, cMinY = n.cy, cMaxY = n.cy;
				for (const t of targets) {
					if (t.x < cMinX) cMinX = t.x;
					if (t.x > cMaxX) cMaxX = t.x;
					if (t.y < cMinY) cMinY = t.y;
					if (t.y > cMaxY) cMaxY = t.y;
				}
				if (cMaxX < vl - M || cMinX > vr + M || cMaxY < vt - M || cMinY > vb + M) continue;

				if (isV) {
					const midY = n.y + n.h + canvasLevelSpacingV / 2;
					ctx.beginPath(); ctx.moveTo(n.cx, n.y + n.h); ctx.lineTo(n.cx, midY); ctx.stroke();
					if (targets.length > 1) {
						ctx.beginPath(); ctx.moveTo(targets[0].x, midY); ctx.lineTo(targets[targets.length - 1].x, midY); ctx.stroke();
					}
					for (const t of targets) {
						ctx.beginPath(); ctx.moveTo(t.x, midY); ctx.lineTo(t.x, t.y); ctx.stroke();
					}
				} else {
					const nextColX = canvasLevelX[n.depth + 1] ?? (n.x + n.w + canvasColumnGap);
					const midX = (n.x + n.w + nextColX) / 2;
					ctx.beginPath(); ctx.moveTo(n.x + n.w, n.cy); ctx.lineTo(midX, n.cy); ctx.stroke();
					if (targets.length > 1) {
						ctx.beginPath(); ctx.moveTo(midX, targets[0].y); ctx.lineTo(midX, targets[targets.length - 1].y); ctx.stroke();
					}
					for (const t of targets) {
						ctx.beginPath(); ctx.moveTo(midX, t.y); ctx.lineTo(t.x, t.y); ctx.stroke();
					}
				}
				continue;
			}

			if (n.children.length === 0) continue;
			const first = n.children[0];
			const last = n.children[n.children.length - 1];

			if (isV) {
				const connTop = n.y + n.h;
				const connBot = first.y;
				const connL = Math.min(n.cx, first.cx);
				const connR = Math.max(n.cx, last.cx);
				if (connR < vl - M || connL > vr + M || connBot < vt - M || connTop > vb + M) continue;

				const midY = n.y + n.h + canvasLevelSpacingV / 2;
				ctx.beginPath(); ctx.moveTo(n.cx, n.y + n.h); ctx.lineTo(n.cx, midY); ctx.stroke();
				ctx.beginPath(); ctx.moveTo(first.cx, midY); ctx.lineTo(last.cx, midY); ctx.stroke();
				for (const child of n.children) {
					ctx.beginPath(); ctx.moveTo(child.cx, midY); ctx.lineTo(child.cx, child.y); ctx.stroke();
				}
			} else {
				const connLeft = n.x + n.w;
				const connRight = first.x;
				const connTop = Math.min(n.cy, first.cy);
				const connBottom = Math.max(n.cy, last.cy);
				if (connRight < vl - M || connLeft > vr + M || connBottom < vt - M || connTop > vb + M) continue;

				const nextColX = canvasLevelX[n.depth + 1] ?? (n.x + n.w + canvasColumnGap);
				const midX = (n.x + n.w + nextColX) / 2;
				ctx.beginPath(); ctx.moveTo(n.x + n.w, n.cy); ctx.lineTo(midX, n.cy); ctx.stroke();
				ctx.beginPath(); ctx.moveTo(midX, first.cy); ctx.lineTo(midX, last.cy); ctx.stroke();
				for (const child of n.children) {
					ctx.beginPath(); ctx.moveTo(midX, child.cy); ctx.lineTo(child.x, child.cy); ctx.stroke();
				}
			}
		}

		// ── Draw group boxes ──
		for (const box of canvasGroupBoxes) {
			if (box.x + box.w < vl - M || box.x > vr + M || box.y + box.h < vt - M || box.y > vb + M) continue;
			const color = canvasDepthColors[Math.min(box.depth, canvasDepthColors.length - 1)];

			if (canvasZoom < canvasZoomLodSimple) {
				ctx.fillStyle = color + '10';
				ctx.fillRect(box.x, box.y, box.w, box.h);
			} else if (canvasZoom < canvasZoomLodText) {
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

		// ── Draw nodes (LOD-aware) ──
		const lodText = canvasZoom >= canvasZoomLodText;
		const lodSimple = canvasZoom < canvasZoomLodSimple;

		for (const n of canvasLayoutNodes) {
			if (n.x + n.w < vl - M || n.x > vr + M || n.y + n.h < vt - M || n.y > vb + M) continue;
			visible++;

			const depthColor = canvasDepthColors[Math.min(n.depth, canvasDepthColors.length - 1)];

			// LOD: simple colored rectangles
			if (lodSimple) {
				const isSelected = n.node.path === canvasSelectedPath;
				ctx.fillStyle = isSelected ? '#667eea' : depthColor + '90';
				ctx.fillRect(n.x, n.y, n.w, n.h);
				continue;
			}

			const isSelected = n.node.path === canvasSelectedPath;

			// LOD: medium — boxes + color bar, no text
			if (!lodText) {
				ctx.fillStyle = isSelected ? '#f0f4ff' : '#ffffff';
				ctx.fillRect(n.x, n.y, n.w, n.h);
				ctx.strokeStyle = isSelected ? '#667eea' : '#e2e8f0';
				ctx.lineWidth = 1;
				ctx.strokeRect(n.x, n.y, n.w, n.h);
				ctx.fillStyle = depthColor;
				if (isV) ctx.fillRect(n.x, n.y, n.w, canvasColorBarW);
				else ctx.fillRect(n.x, n.y, canvasColorBarW, n.h);
				continue;
			}

			// LOD: full detail
			const isHovered = canvasHoveredNode?.node.path === n.node.path;
			const r = 5;
			ctx.beginPath();
			ctx.roundRect(n.x, n.y, n.w, n.h, r);

			if (isSelected) {
				ctx.fillStyle = '#f0f4ff'; ctx.fill();
				ctx.strokeStyle = '#667eea'; ctx.lineWidth = 2; ctx.stroke();
			} else if (isHovered) {
				ctx.fillStyle = '#fafbff'; ctx.fill();
				ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5; ctx.stroke();
				ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
				ctx.fill();
				ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
			} else {
				ctx.fillStyle = '#ffffff'; ctx.fill();
				ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5; ctx.stroke();
			}

			// Depth color bar
			ctx.fillStyle = depthColor;
			ctx.beginPath();
			if (isV) {
				ctx.roundRect(n.x, n.y, n.w, canvasColorBarW, [r, r, 0, 0]);
			} else {
				ctx.roundRect(n.x, n.y, canvasColorBarW, n.h, [r, 0, 0, r]);
			}
			ctx.fill();

			// Node text
			const name = (displayMember && n.node.data?.[displayMember]) || n.node.path;
			ctx.font = isSelected ? canvasFontBold : canvasFont;
			ctx.fillStyle = '#334155';
			ctx.textBaseline = 'middle';
			const textOffsetX = isV ? canvasNodePaddingX : canvasColorBarW + canvasNodePaddingX;
			const textX = n.x + textOffsetX;
			const maxTextW = n.w - textOffsetX - canvasNodePaddingX - (n.node.hasChildren ? 16 : 0);
			let drawText = name;
			const textW = cvGetTextWidth(name);
			if (textW > maxTextW) {
				const ellipsis = '\u2026';
				const ellipsisW = cvGetTextWidth(ellipsis);
				const avail = maxTextW - ellipsisW;
				let lo = 0, hi = drawText.length;
				while (lo < hi) {
					const mid = (lo + hi + 1) >> 1;
					if (cvGetTextWidth(drawText.slice(0, mid)) <= avail) lo = mid;
					else hi = mid - 1;
				}
				drawText = drawText.slice(0, lo) + ellipsis;
			}
			ctx.fillText(drawText, textX, n.cy);

			// Chevron
			if (n.node.hasChildren) {
				const chevX = n.x + n.w - 14;
				ctx.fillStyle = '#94a3b8';
				ctx.font = '10px sans-serif';
				ctx.fillText(n.node.isExpanded ? '\u25BE' : '\u25B8', chevX, n.cy);
			}

			// Badge: child count for collapsed nodes
			if (n.node.hasChildren && !n.node.isExpanded) {
				const count = Object.keys(n.node.children).length;
				if (count > 0) {
					const badgeText = String(count);
					const digits = badgeText.length;
					const badgeW = 8 + digits * 6;
					const badgeH = 14;
					const badgeR = badgeH / 2;
					let badgeX: number, badgeY: number;
					if (isV) {
						badgeX = n.x + n.w / 2 - badgeW / 2;
						badgeY = n.y + n.h + 2;
					} else {
						badgeX = n.x + n.w + 3;
						badgeY = n.cy - badgeH / 2;
					}
					ctx.fillStyle = depthColor;
					ctx.beginPath();
					ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeR);
					ctx.fill();
					ctx.font = '9px sans-serif';
					ctx.fillStyle = '#ffffff';
					ctx.textBaseline = 'middle';
					ctx.textAlign = 'center';
					ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);
					ctx.textAlign = 'start';
				}
			}
		}

		ctx.restore();

		// ── Minimap ──
		if (canvasLayoutNodes.length > 0 && canvasLayoutWidth > 0 && canvasLayoutHeight > 0) {
			const mmX = cw - CV_MINIMAP_W - CV_MINIMAP_MARGIN;
			const mmY = ch - CV_MINIMAP_H - CV_MINIMAP_MARGIN;

			ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
			ctx.strokeStyle = '#e2e8f0';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.roundRect(mmX, mmY, CV_MINIMAP_W, CV_MINIMAP_H, 4);
			ctx.fill();
			ctx.stroke();

			const mmScaleX = (CV_MINIMAP_W - CV_MINIMAP_PAD * 2) / (canvasLayoutWidth + 40);
			const mmScaleY = (CV_MINIMAP_H - CV_MINIMAP_PAD * 2) / (canvasLayoutHeight + 40);
			const mmScale = Math.min(mmScaleX, mmScaleY);

			ctx.save();
			ctx.beginPath();
			ctx.roundRect(mmX, mmY, CV_MINIMAP_W, CV_MINIMAP_H, 4);
			ctx.clip();

			for (const box of canvasGroupBoxes) {
				const bx = mmX + CV_MINIMAP_PAD + box.x * mmScale;
				const by = mmY + CV_MINIMAP_PAD + box.y * mmScale;
				const bw = box.w * mmScale;
				const bh = box.h * mmScale;
				const color = canvasDepthColors[Math.min(box.depth, canvasDepthColors.length - 1)];
				ctx.strokeStyle = color + '30';
				ctx.lineWidth = 0.5;
				ctx.strokeRect(bx, by, bw, bh);
			}

			for (const n of canvasLayoutNodes) {
				const nx = mmX + CV_MINIMAP_PAD + n.x * mmScale;
				const ny = mmY + CV_MINIMAP_PAD + n.y * mmScale;
				const nw = Math.max(1.5, n.w * mmScale);
				const nh = Math.max(1, n.h * mmScale);
				const color = canvasDepthColors[Math.min(n.depth, canvasDepthColors.length - 1)];
				ctx.fillStyle = n.node.path === canvasSelectedPath ? '#667eea' : color + '80';
				ctx.fillRect(nx, ny, nw, nh);
			}

			const vpX = mmX + CV_MINIMAP_PAD + (-canvasPanX / canvasZoom) * mmScale;
			const vpY = mmY + CV_MINIMAP_PAD + (-canvasPanY / canvasZoom) * mmScale;
			const vpW = (cw / canvasZoom) * mmScale;
			const vpH = (ch / canvasZoom) * mmScale;

			ctx.fillStyle = 'rgba(102, 126, 234, 0.08)';
			ctx.fillRect(vpX, vpY, vpW, vpH);
			ctx.strokeStyle = '#667eea';
			ctx.lineWidth = 1.5;
			ctx.strokeRect(vpX, vpY, vpW, vpH);

			ctx.restore();
		}

		canvasVisibleCount = visible;
		canvasDrawTime = performance.now() - t0;
		console.log('[json-loader] draw done: visible=', visible, '/', canvasTotalCount);
	}

	function canvasRequestRedraw() {
		if (canvasRafId != null) return;
		canvasRafId = requestAnimationFrame(() => { canvasRafId = null; canvasDraw(); });
	}

	// ── Canvas event handlers ─────────────────────────────────────────────

	function canvasOnWheel(e: WheelEvent) {
		e.preventDefault();
		const rect = canvasEl!.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;
		const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
		const newZoom = Math.max(0.05, Math.min(3, canvasZoom * factor));
		const ratio = newZoom / canvasZoom;
		canvasPanX = mx - (mx - canvasPanX) * ratio;
		canvasPanY = my - (my - canvasPanY) * ratio;
		canvasZoom = newZoom;
		canvasRequestRedraw();
	}

	function canvasOnMouseDown(e: MouseEvent) {
		if (e.button !== 0) return;
		const rect = canvasEl!.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		// Minimap click
		const mmWorld = cvMinimapWorldFromScreen(mx, my);
		if (mmWorld) {
			canvasIsMinimapPanning = true;
			canvasPanX = rect.width / 2 - mmWorld[0] * canvasZoom;
			canvasPanY = rect.height / 2 - mmWorld[1] * canvasZoom;
			canvasRequestRedraw();
			return;
		}

		canvasIsPanning = true;
		canvasPanStartX = mx;
		canvasPanStartY = my;
		canvasPanStartPanX = canvasPanX;
		canvasPanStartPanY = canvasPanY;
	}

	function canvasOnMouseMove(e: MouseEvent) {
		const rect = canvasEl!.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		if (canvasIsMinimapPanning) {
			const mmWorld = cvMinimapWorldFromScreen(mx, my);
			if (mmWorld) {
				canvasPanX = rect.width / 2 - mmWorld[0] * canvasZoom;
				canvasPanY = rect.height / 2 - mmWorld[1] * canvasZoom;
			}
			canvasRequestRedraw();
			return;
		}

		if (canvasIsPanning) {
			canvasPanX = canvasPanStartPanX + (mx - canvasPanStartX);
			canvasPanY = canvasPanStartPanY + (my - canvasPanStartY);
			canvasRequestRedraw();
			return;
		}

		// Hover
		const [wx, wy] = cvScreenToWorld(mx, my);
		const hit = cvHitTest(wx, wy);
		if (canvasEl && canvasClickBehavior === 'select' && hit) {
			canvasEl.style.cursor = cvIsChevronHit(hit, wx, wy) ? 'pointer' : 'default';
		}
		if (hit !== canvasHoveredNode) {
			canvasHoveredNode = hit;
			if (canvasEl && canvasClickBehavior !== 'select') {
				canvasEl.style.cursor = hit ? 'pointer' : 'default';
			}
			if (canvasEl && !hit) {
				canvasEl.style.cursor = 'default';
			}
			canvasRequestRedraw();
		}
	}

	function canvasOnMouseUp(e: MouseEvent) {
		const rect = canvasEl!.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		if (canvasIsMinimapPanning) { canvasIsMinimapPanning = false; return; }

		if (canvasIsPanning) {
			canvasIsPanning = false;
			// If panning was very small, treat as click
			const dx = Math.abs(mx - canvasPanStartX);
			const dy = Math.abs(my - canvasPanStartY);
			if (dx > 3 || dy > 3) return;
		}

		// Click on node
		if (!canvasCtrlRef) return;
		const [wx, wy] = cvScreenToWorld(mx, my);
		const hit = cvHitTest(wx, wy);
		if (hit) {
			canvasSelectedPath = hit.node.path;

			const shouldToggle = hit.node.hasChildren && (
				canvasClickBehavior !== 'select' || cvIsChevronHit(hit, wx, wy)
			);

			if (shouldToggle) {
				if (hit.node.isExpanded) canvasCtrlRef.collapseNodes(hit.node.path);
				else canvasCtrlRef.expandNodes(hit.node.path);
				canvasRecomputeAndDraw();
			}

			if (canvasClickBehavior === 'expand-and-focus') {
				const ln = canvasLayoutNodes.find(n => n.node.path === hit.node.path);
				if (ln) canvasFocusOnNode(ln);
			}

			canvasRequestRedraw();
		}
	}

	function canvasOnMouseLeave() {
		if (canvasIsPanning) canvasIsPanning = false;
		if (canvasHoveredNode) { canvasHoveredNode = null; canvasRequestRedraw(); }
	}

	// ── Canvas actions ────────────────────────────────────────────────────

	function canvasRecomputeAndDraw() {
		if (!canvasCtrlRef) return;
		computeCanvasLayout(canvasCtrlRef);
		canvasRequestRedraw();
	}

	function canvasExpandAll() { if (!canvasCtrlRef) return; canvasCtrlRef.expandAll(); canvasRecomputeAndDraw(); }
	function canvasCollapseAll() { if (!canvasCtrlRef) return; canvasCtrlRef.collapseAll(); canvasRecomputeAndDraw(); }

	function canvasZoomToFit() {
		if (!canvasContainerEl || canvasLayoutNodes.length === 0) return;
		const rect = canvasContainerEl.getBoundingClientRect();
		const pad = 60;
		const scaleX = (rect.width - pad * 2) / (canvasLayoutWidth + 40);
		const scaleY = (rect.height - pad * 2) / (canvasLayoutHeight + 40);
		canvasZoom = Math.max(0.05, Math.min(1, Math.min(scaleX, scaleY)));
		canvasPanX = pad; canvasPanY = pad;
		canvasRequestRedraw();
	}

	function canvasSetGrowthDirection(dir: GrowthDir) {
		canvasGrowthDirection = dir;
		canvasPanX = 40; canvasPanY = 40; canvasZoom = 1;
		canvasRecomputeAndDraw();
	}

	// ── Canvas animation ──────────────────────────────────────────────────

	function cvEaseOutCubic(t: number): number {
		return 1 - Math.pow(1 - t, 3);
	}

	function cvAnimateStep() {
		if (!canvasAnimFrom || !canvasAnimTo) return;
		const elapsed = performance.now() - canvasAnimStartTime;
		const t = Math.min(1, elapsed / CV_ANIM_DURATION);
		const e = cvEaseOutCubic(t);
		canvasPanX = canvasAnimFrom.panX + (canvasAnimTo.panX - canvasAnimFrom.panX) * e;
		canvasPanY = canvasAnimFrom.panY + (canvasAnimTo.panY - canvasAnimFrom.panY) * e;
		canvasZoom = canvasAnimFrom.zoom + (canvasAnimTo.zoom - canvasAnimFrom.zoom) * e;
		canvasDraw();
		if (t < 1) {
			requestAnimationFrame(cvAnimateStep);
		} else {
			canvasAnimFrom = null;
			canvasAnimTo = null;
		}
	}

	function canvasFocusOnNode(ln: LayoutNode) {
		if (!canvasContainerEl) return;
		const rect = canvasContainerEl.getBoundingClientRect();
		const targetZoom = Math.max(0.8, Math.min(1.5, canvasZoom));
		const targetPanX = rect.width / 2 - ln.cx * targetZoom;
		const targetPanY = rect.height / 2 - ln.cy * targetZoom;
		canvasAnimFrom = { panX: canvasPanX, panY: canvasPanY, zoom: canvasZoom };
		canvasAnimTo = { panX: targetPanX, panY: targetPanY, zoom: targetZoom };
		canvasAnimStartTime = performance.now();
		requestAnimationFrame(cvAnimateStep);
	}

	function cvMinimapWorldFromScreen(mx: number, my: number): [number, number] | null {
		if (!canvasContainerEl || canvasLayoutNodes.length === 0) return null;
		const rect = canvasContainerEl.getBoundingClientRect();
		const cw = rect.width;
		const ch = rect.height;
		const mmX = cw - CV_MINIMAP_W - CV_MINIMAP_MARGIN;
		const mmY = ch - CV_MINIMAP_H - CV_MINIMAP_MARGIN;
		if (mx < mmX || mx > mmX + CV_MINIMAP_W || my < mmY || my > mmY + CV_MINIMAP_H) return null;
		const scaleX = (CV_MINIMAP_W - CV_MINIMAP_PAD * 2) / (canvasLayoutWidth + 40);
		const scaleY = (CV_MINIMAP_H - CV_MINIMAP_PAD * 2) / (canvasLayoutHeight + 40);
		const mmScale = Math.min(scaleX, scaleY);
		const wx = (mx - mmX - CV_MINIMAP_PAD) / mmScale;
		const wy = (my - mmY - CV_MINIMAP_PAD) / mmScale;
		return [wx, wy];
	}

	function captureCanvasCtrl(ctrl: TreeController<any>) { canvasCtrlRef = ctrl; }

	// ── Canvas reactive effects ───────────────────────────────────────────

	// Clear text width cache when font changes
	$effect(() => {
		const _font = canvasFont;
		cvTextCache.clear();
		if (cvMeasureCtx) cvMeasureCtx.font = _font;
	});

	$effect(() => {
		console.log('[json-loader] $effect: renderer=', renderer, 'ctrlRef=', !!canvasCtrlRef, 'canvasEl=', !!canvasEl);
		if (renderer !== 'canvas' || !canvasCtrlRef || !canvasEl) return;
		const _tracker = canvasCtrlRef.tree.changeTracker;
		const _orient = canvasOrientation;
		const _grouped = canvasGroupSiblings;
		const _dots = canvasShowDotGrid;
		// Track all layout-affecting state
		void [canvasColumnGap, canvasGridNodeMaxW, canvasNodeHeight, canvasNodeGap,
			canvasLevelSpacingV, canvasNodePaddingX, canvasNodeMinWidth, canvasColorBarW,
			canvasFontSize, canvasFontFamily, canvasGridGap, canvasGroupPadding, canvasMaxGridCols,
			canvasDepthColors, canvasZoomLodText, canvasZoomLodSimple];
		console.log('[json-loader] tree.tree length=', canvasCtrlRef.tree.tree.length, 'tracker=', _tracker);
		computeCanvasLayout(canvasCtrlRef);
		console.log('[json-loader] after layout: totalCount=', canvasTotalCount, 'nodes=', canvasLayoutNodes.length);
		canvasRequestRedraw();
	});

	$effect(() => {
		if (renderer !== 'canvas' || !canvasContainerEl) return;
		const ro = new ResizeObserver(() => canvasRequestRedraw());
		ro.observe(canvasContainerEl);
		return () => ro.disconnect();
	});

	$effect(() => {
		return () => { if (canvasRafId != null) cancelAnimationFrame(canvasRafId); };
	});
</script>

<svelte:window onpaste={handleGlobalPaste} />

<svelte:head>
	<title>JSON Loader - Svelte Treeview Debug</title>
</svelte:head>

<div class="container">
	<header>
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>JSON Loader</h1>
		<p class="subtitle">Load custom JSON files and test tree rendering performance</p>
	</header>

	<!-- Configuration -->
	<div class="card">
		<div class="card-header">
			<div>
				<h2>Configuration</h2>
				<p class="description">Configure how the tree interprets your JSON data.</p>
			</div>
			<div class="card-header-actions">
				<button class="btn" onclick={redrawTree} disabled={jsonData.length === 0}>Redraw Tree</button>
				<button class="btn secondary" onclick={clearConfig}>Reset Config</button>
			</div>
		</div>

		<h3>Required Mappings</h3>
		<div class="config-grid">
			<div class="form-group">
				<label for="idMember">ID Member *</label>
				<input type="text" id="idMember" bind:value={idMember} placeholder="id" />
			</div>

			<div class="form-group">
				<label for="pathMember">Path Member *</label>
				<input type="text" id="pathMember" bind:value={pathMember} placeholder="path" />
			</div>

			<div class="form-group">
				<label for="treePathSeparator">Path Separator</label>
				<input type="text" id="treePathSeparator" bind:value={treePathSeparator} placeholder="." style="width: 80px" />
			</div>
		</div>

		<h3>Optional Mappings</h3>
		<div class="config-grid">
			<div class="form-group">
				<label for="parentPathMember">Parent Path Member</label>
				<input type="text" id="parentPathMember" bind:value={parentPathMember} placeholder="parentPath" />
			</div>

			<div class="form-group">
				<label for="levelMember">Level Member</label>
				<input type="text" id="levelMember" bind:value={levelMember} placeholder="level" />
			</div>

			<div class="form-group">
				<label for="hasChildrenMember">Has Children Member</label>
				<input type="text" id="hasChildrenMember" bind:value={hasChildrenMember} placeholder="hasChildren" />
			</div>

			<div class="form-group">
				<label for="isExpandedMember">Is Expanded Member</label>
				<input type="text" id="isExpandedMember" bind:value={isExpandedMember} placeholder="isExpanded" />
			</div>

			<div class="form-group">
				<label for="orderMember">Order Member</label>
				<input type="text" id="orderMember" bind:value={orderMember} placeholder="order" />
			</div>
		</div>

		<h3>Display Options</h3>
		<div class="config-grid">
			<div class="form-group">
				<label for="displayMember">Display Member</label>
				<input type="text" id="displayMember" bind:value={displayMember} placeholder="name" />
			</div>

			<div class="form-group">
				<label for="sortMember">Sort Member</label>
				<input type="text" id="sortMember" bind:value={sortMember} placeholder="name" />
			</div>

			<div class="form-group">
				<label for="expandLevel">Expand Level</label>
				<input type="number" id="expandLevel" bind:value={expandLevel} min="0" max="10" style="width: 80px" />
			</div>

			<div class="form-group">
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={isSorted} />
					Data is pre-sorted
				</label>
			</div>
		</div>

		<h3>Renderer</h3>
		<div class="config-grid">
			<div class="form-group" style="grid-column: 1 / -1;">
				<label for="renderer">Renderer</label>
				<select id="renderer" bind:value={renderer}>
					<option value="tree">Standard Tree (DOM)</option>
					<option value="canvas">Canvas Dendrogram</option>
					<option value="flat">Flat Card View</option>
				</select>
			</div>
		</div>

		{#if renderer === 'tree'}
			<h3>Performance Options</h3>
			<div class="config-grid">
				<div class="form-group">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={useFlatRendering} />
						Use Flat Rendering
					</label>
				</div>

				<div class="form-group">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={progressiveRender} />
						Progressive Render
					</label>
				</div>

				<div class="form-group">
					<label for="initialBatchSize">Initial Batch</label>
					<input type="number" id="initialBatchSize" bind:value={initialBatchSize} min="5" max="200" step="5" style="width: 80px" />
				</div>

				<div class="form-group">
					<label for="maxBatchSize">Max Batch</label>
					<input type="number" id="maxBatchSize" bind:value={maxBatchSize} min="100" max="2000" step="100" style="width: 80px" />
				</div>
			</div>
		{:else if renderer === 'canvas'}
			<h3>Canvas Options</h3>
			<div class="config-grid">
				<div class="form-group">
					<label>Growth Direction</label>
					<span class="orientation-toggle">
						<button class="btn orient-btn" class:orient-active={canvasGrowthDirection === 'right'} onclick={() => canvasSetGrowthDirection('right')}>Right</button>
						<button class="btn orient-btn" class:orient-active={canvasGrowthDirection === 'left'} onclick={() => canvasSetGrowthDirection('left')}>Left</button>
						<button class="btn orient-btn" class:orient-active={canvasGrowthDirection === 'down'} onclick={() => canvasSetGrowthDirection('down')}>Down</button>
						<button class="btn orient-btn" class:orient-active={canvasGrowthDirection === 'up'} onclick={() => canvasSetGrowthDirection('up')}>Up</button>
					</span>
				</div>

				<div class="form-group">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={canvasGroupSiblings} />
						Group siblings
					</label>
				</div>

				<div class="form-group">
					<label class="checkbox-label">
						<input type="checkbox" bind:checked={canvasShowDotGrid} />
						Dot grid
					</label>
				</div>

				<div class="form-group">
					<label for="canvasClickBehavior">Click Behavior</label>
					<select id="canvasClickBehavior" bind:value={canvasClickBehavior}>
						<option value="select">Select only</option>
						<option value="expand">Expand</option>
						<option value="expand-and-focus">Expand & Focus</option>
					</select>
				</div>

				<div class="form-group">
					<label for="canvasColumnGap">Column Gap</label>
					<input type="number" id="canvasColumnGap" bind:value={canvasColumnGap} min="10" max="200" step="5" style="width: 80px" />
				</div>

				<div class="form-group">
					<label for="canvasGridNodeMaxW">Grid Node Max W</label>
					<input type="number" id="canvasGridNodeMaxW" bind:value={canvasGridNodeMaxW} min="100" max="500" step="10" style="width: 80px" />
				</div>
			</div>

			<h3>Node Appearance</h3>
			<div class="config-grid">
				<div class="form-group">
					<label for="canvasNodeHeight">Node Height</label>
					<input type="number" id="canvasNodeHeight" bind:value={canvasNodeHeight} min="16" max="60" step="1" style="width: 60px" />
				</div>

				<div class="form-group">
					<label for="canvasNodeMinWidth">Min Width</label>
					<input type="number" id="canvasNodeMinWidth" bind:value={canvasNodeMinWidth} min="40" max="300" step="10" style="width: 60px" />
				</div>

				<div class="form-group">
					<label for="canvasNodeGap">Node Gap</label>
					<input type="number" id="canvasNodeGap" bind:value={canvasNodeGap} min="0" max="20" step="1" style="width: 60px" />
				</div>

				<div class="form-group">
					<label for="canvasNodePaddingX">Padding X</label>
					<input type="number" id="canvasNodePaddingX" bind:value={canvasNodePaddingX} min="2" max="30" step="1" style="width: 60px" />
				</div>

				<div class="form-group">
					<label for="canvasColorBarW">Color Bar W</label>
					<input type="number" id="canvasColorBarW" bind:value={canvasColorBarW} min="0" max="10" step="1" style="width: 60px" />
				</div>

				<div class="form-group">
					<label for="canvasLevelSpacingV">V-Spacing</label>
					<input type="number" id="canvasLevelSpacingV" bind:value={canvasLevelSpacingV} min="20" max="200" step="5" style="width: 60px" />
				</div>

				<div class="form-group">
					<label for="canvasFontSize">Font Size</label>
					<input type="number" id="canvasFontSize" bind:value={canvasFontSize} min="8" max="24" step="1" style="width: 60px" />
				</div>

				<div class="form-group">
					<label for="canvasFontFamily">Font</label>
					<select id="canvasFontFamily" bind:value={canvasFontFamily} style="width: 140px">
						<option value='"SF Mono", "Cascadia Code", "Fira Code", monospace'>SF Mono / Cascadia</option>
						<option value='"Fira Code", "Source Code Pro", monospace'>Fira Code</option>
						<option value='"Consolas", "Courier New", monospace'>Consolas</option>
						<option value='system-ui, -apple-system, sans-serif'>System UI</option>
						<option value='"Segoe UI", Roboto, sans-serif'>Segoe UI</option>
						<option value='"Inter", sans-serif'>Inter</option>
					</select>
				</div>
			</div>

			<h3>Grid & Groups</h3>
			<div class="config-grid">
				<div class="form-group">
					<label for="canvasGridGap">Grid Gap</label>
					<input type="number" id="canvasGridGap" bind:value={canvasGridGap} min="0" max="20" step="1" style="width: 60px" />
				</div>

				<div class="form-group">
					<label for="canvasGroupPadding">Group Padding</label>
					<input type="number" id="canvasGroupPadding" bind:value={canvasGroupPadding} min="0" max="20" step="1" style="width: 60px" />
				</div>

				<div class="form-group">
					<label for="canvasMaxGridCols">Max Grid Cols</label>
					<input type="number" id="canvasMaxGridCols" bind:value={canvasMaxGridCols} min="2" max="20" step="1" style="width: 60px" />
				</div>
			</div>

			<h3>Depth Colors</h3>
			<div class="config-grid">
				{#each canvasDepthColors as color, i}
					<div class="form-group">
						<label>Depth {i}</label>
						<input type="color" value={color} oninput={(e) => {
							const newColors = [...canvasDepthColors];
							newColors[i] = (e.target as HTMLInputElement).value;
							canvasDepthColors = newColors;
						}} />
					</div>
				{/each}
			</div>

			<h3>LOD Thresholds</h3>
			<div class="config-grid">
				<div class="form-group">
					<label for="canvasZoomLodText">Text LOD</label>
					<input type="range" id="canvasZoomLodText" bind:value={canvasZoomLodText} min="0.1" max="1" step="0.05" style="width: 100px" />
					<span style="font-size: 0.75em">{canvasZoomLodText}</span>
				</div>

				<div class="form-group">
					<label for="canvasZoomLodSimple">Simple LOD</label>
					<input type="range" id="canvasZoomLodSimple" bind:value={canvasZoomLodSimple} min="0.01" max="0.5" step="0.01" style="width: 100px" />
					<span style="font-size: 0.75em">{canvasZoomLodSimple}</span>
				</div>
			</div>
		{/if}

		{#if availableMembers.length > 0}
			<div class="note">
				<p class="note-title">Detected Members</p>
				<p>Available properties in your data: <code>{availableMembers.join(', ')}</code></p>
			</div>
		{/if}
	</div>

	<!-- File Upload -->
	<div class="card">
		<h2>Load Data</h2>
		<p class="description">Drop a JSON file, paste from clipboard, or use the buttons below.</p>

		<!-- Drop Zone -->
		<div
			bind:this={dropZoneRef}
			class="drop-zone"
			class:drop-zone-active={isDragging}
			ondragenter={handleDragEnter}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
			role="button"
			tabindex="0"
		>
			<div class="drop-zone-content">
				{#if isDragging}
					<span class="drop-zone-icon">📥</span>
					<span class="drop-zone-text">Drop JSON file here</span>
				{:else}
					<span class="drop-zone-icon">📄</span>
					<span class="drop-zone-text">Drop JSON file or Ctrl+V to paste</span>
				{/if}
			</div>
		</div>

		<div class="controls" style="margin-top: 1rem;">
			<label class="btn file-input-label">
				Choose File
				<input type="file" accept=".json" onchange={handleFileUpload} style="display: none" />
			</label>
			<button class="btn" onclick={handlePaste}>Paste from Clipboard</button>
			<button class="btn secondary" onclick={loadSampleData}>Load Sample Data</button>
			<button class="btn secondary" onclick={clearData} disabled={jsonData.length === 0}>Clear</button>
		</div>

		{#if fileName}
			<p style="margin-top: 0.5rem; color: #4a5568;">
				Loaded: <strong>{fileName}</strong> ({nodeCount} items)
			</p>
		{/if}

		{#if jsonError}
			<div class="note warning">
				<p class="note-title">Error</p>
				<p>{jsonError}</p>
			</div>
		{/if}
	</div>

	<!-- Performance Metrics -->
	{#if jsonData.length > 0}
		<div class="card">
			<h2>Performance</h2>
			<div class="metrics-grid">
				<div class="metric">
					<span class="metric-value">{nodeCount.toLocaleString()}</span>
					<span class="metric-label">Total Items</span>
				</div>
				<div class="metric">
					<span class="metric-value">{parseTime !== null ? parseTime.toFixed(2) : '-'} ms</span>
					<span class="metric-label">Parse Time</span>
				</div>
				<div class="metric">
					<span class="metric-value">{renderTime !== null ? renderTime.toFixed(2) : 'measuring...'} ms</span>
					<span class="metric-label">Render Time</span>
				</div>
			</div>

			{#if insertResult?.failedNodes?.length > 0}
				<div class="note warning" style="margin-top: 1rem;">
					<p class="note-title">Insert Warnings</p>
					<p>{insertResult.failedNodes.length} nodes failed to insert:</p>
					<ul style="margin-left: 1.5rem; margin-top: 0.5rem;">
						{#each insertResult.failedNodes.slice(0, 5) as failed}
							<li><code>{failed.path}</code>: {failed.reason}</li>
						{/each}
						{#if insertResult.failedNodes.length > 5}
							<li>...and {insertResult.failedNodes.length - 5} more</li>
						{/if}
					</ul>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Tree Display -->
	{#if jsonData.length > 0 && !jsonError}
		<div class="card">
			<h2>Tree Preview</h2>

			{#if renderer === 'tree'}
				<div class="controls">
					<button class="btn" onclick={() => treeRef?.expandAll()}>Expand All</button>
					<button class="btn secondary" onclick={() => treeRef?.collapseAll()}>Collapse All</button>
				</div>

				<div class="tree-container tree-container-tall">
					{#key treeKey}
						<Tree
							bind:this={treeRef}
							data={jsonData}
							{idMember}
							{pathMember}
							parentPathMember={parentPathMember || null}
							levelMember={levelMember || null}
							hasChildrenMember={hasChildrenMember || null}
							isExpandedMember={isExpandedMember || null}
							orderMember={orderMember || null}
							{treePathSeparator}
							{sortCallback}
							{isSorted}
							{expandLevel}
							{useFlatRendering}
							{progressiveRender}
							{initialBatchSize}
							{maxBatchSize}
							bind:selectedNode
							bind:insertResult
						>
							{#snippet nodeTemplate(node)}
								<span>
									{#if displayMember && node.data?.[displayMember]}
										{node.data[displayMember]}
									{:else}
										{node.path}
									{/if}
									<code style="font-size: 0.75em; color: #718096; margin-left: 0.5rem;">
										({node.path})
									</code>
								</span>
							{/snippet}
						</Tree>
					{/key}
				</div>

				{#if selectedNode}
					<div class="output" style="margin-top: 1rem;">
						<p class="output-label">Selected Node Data:</p>
						<pre>{JSON.stringify(selectedNode.data, null, 2)}</pre>
					</div>
				{/if}

			{:else if renderer === 'canvas'}
				<div class="controls">
					<button class="btn" onclick={canvasExpandAll}>Expand All</button>
					<button class="btn" onclick={canvasCollapseAll}>Collapse All</button>
					<button class="btn secondary" onclick={canvasZoomToFit}>Zoom to Fit</button>
				</div>

				<div class="canvas-metrics">
					<span>Layout: <strong>{canvasLayoutTime.toFixed(1)}ms</strong></span>
					<span>Draw: <strong>{canvasDrawTime.toFixed(1)}ms</strong></span>
					<span>Visible: <strong>{canvasVisibleCount}</strong>/{canvasTotalCount}</span>
					<span>Zoom: <strong>{(canvasZoom * 100).toFixed(0)}%</strong></span>
				</div>

				{#key treeKey}
					<TreeProvider
						data={jsonData}
						{idMember}
						{pathMember}
						parentPathMember={parentPathMember || null}
						levelMember={levelMember || null}
						hasChildrenMember={hasChildrenMember || null}
						isExpandedMember={isExpandedMember || null}
						orderMember={orderMember || null}
						{treePathSeparator}
						{sortCallback}
						{isSorted}
						{expandLevel}
					>
						{#snippet children(ctrl)}
							{@const _init = captureCanvasCtrl(ctrl)}
							<div class="canvas-wrapper" bind:this={canvasContainerEl}>
								<canvas
									bind:this={canvasEl}
									onwheel={canvasOnWheel}
									onmousedown={canvasOnMouseDown}
									onmousemove={canvasOnMouseMove}
									onmouseup={canvasOnMouseUp}
									onmouseleave={canvasOnMouseLeave}
								></canvas>
							</div>

							{#if canvasSelectedPath}
								{@const selNode = ctrl.getNodeByPath(canvasSelectedPath)}
								{#if selNode}
									<div class="output" style="margin-top: 1rem;">
										<p class="output-label">Selected Node Data:</p>
										<pre>{JSON.stringify(selNode.data, null, 2)}</pre>
									</div>
								{/if}
							{/if}
						{/snippet}
					</TreeProvider>
				{/key}

			{:else if renderer === 'flat'}
				{#key treeKey}
					<TreeProvider
						data={jsonData}
						{idMember}
						{pathMember}
						parentPathMember={parentPathMember || null}
						levelMember={levelMember || null}
						hasChildrenMember={hasChildrenMember || null}
						isExpandedMember={isExpandedMember || null}
						orderMember={orderMember || null}
						{treePathSeparator}
						{sortCallback}
						{isSorted}
						expandLevel={99}
					>
						{#snippet children(ctrl)}
							<div class="flat-card-list">
								{#each ctrl.tree.visibleFlatNodes as node}
									<button
										class="flat-card"
										class:flat-card-selected={flatSelectedPath === node.path}
										style="padding-left: {(node.level ?? 0) * 1.5 + 0.75}rem"
										onclick={() => { flatSelectedPath = node.path; }}
									>
										<span class="flat-card-name">
											{#if displayMember && node.data?.[displayMember]}
												{node.data[displayMember]}
											{:else}
												{node.path}
											{/if}
										</span>
										<code class="flat-card-path">{node.path}</code>
									</button>
								{/each}
							</div>

							{#if flatSelectedPath}
								{@const selNode = ctrl.getNodeByPath(flatSelectedPath)}
								{#if selNode}
									<div class="output" style="margin-top: 1rem;">
										<p class="output-label">Selected Node Data:</p>
										<pre>{JSON.stringify(selNode.data, null, 2)}</pre>
									</div>
								{/if}
							{/if}
						{/snippet}
					</TreeProvider>
				{/key}
			{/if}
		</div>
	{/if}

	<!-- Data Preview -->
	{#if jsonData.length > 0}
		<div class="card">
			<h2>Raw Data Preview</h2>
			<p class="description">First 5 items from your JSON data:</p>
			<pre>{JSON.stringify(jsonData.slice(0, 5), null, 2)}</pre>
			{#if jsonData.length > 5}
				<p style="color: #718096; margin-top: 0.5rem;">...and {jsonData.length - 5} more items</p>
			{/if}
		</div>
	{/if}

	<footer>
		<p><a href="/">&larr; Back to Examples</a></p>
	</footer>
</div>

<style>
	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.card-header h2 {
		margin-bottom: 0.25rem;
	}

	.card-header .description {
		margin-bottom: 0;
	}

	.card-header-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	.card h3 {
		margin-top: 1.5rem;
		margin-bottom: 0.75rem;
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #718096;
	}

	.card h3:first-of-type {
		margin-top: 0;
	}

	.config-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0.75rem;
	}

	.form-group {
		margin-bottom: 0;
	}

	.form-group label {
		display: block;
		font-size: 0.8rem;
		font-weight: 500;
		color: #4a5568;
		margin-bottom: 0.25rem;
	}

	.form-group input[type="text"],
	.form-group input[type="number"] {
		width: 100%;
		padding: 0.4rem 0.5rem;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		font-size: 0.875rem;
	}

	.checkbox-label {
		display: flex !important;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		padding-top: 0.5rem;
	}

	.checkbox-label input[type="checkbox"] {
		width: 16px;
		height: 16px;
	}

	.file-input-label {
		display: inline-block;
	}

	/* Drop Zone */
	.drop-zone {
		border: 2px dashed #cbd5e0;
		border-radius: 8px;
		padding: 0.75rem 1rem;
		text-align: center;
		transition: all 0.2s ease;
		background: #f7fafc;
		cursor: pointer;
	}

	.drop-zone:hover {
		border-color: #667eea;
		background: #eef2ff;
	}

	.drop-zone-active {
		border-color: #667eea;
		background: #eef2ff;
		border-style: solid;
	}

	.drop-zone-content {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		pointer-events: none;
	}

	.drop-zone-icon {
		font-size: 1.25rem;
	}

	.drop-zone-text {
		font-size: 0.875rem;
		font-weight: 500;
		color: #4a5568;
	}

	.drop-zone-hint {
		font-size: 0.75rem;
		color: #718096;
	}

	.metrics-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
	}

	.metric {
		background: #f7fafc;
		padding: 1rem;
		border-radius: 8px;
		text-align: center;
	}

	.metric-value {
		display: block;
		font-size: 1.5rem;
		font-weight: 600;
		color: #667eea;
	}

	.metric-label {
		display: block;
		font-size: 0.875rem;
		color: #718096;
		margin-top: 0.25rem;
	}

	.note.warning {
		background: #fef3c7;
		border-left-color: #f59e0b;
	}

	.note.warning .note-title {
		color: #b45309;
	}

	/* Renderer select */
	.form-group select {
		width: 100%;
		padding: 0.4rem 0.5rem;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		font-size: 0.875rem;
		background: white;
	}

	/* Canvas renderer */
	.canvas-wrapper {
		width: 100%;
		height: 500px;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		overflow: hidden;
		position: relative;
	}

	.canvas-wrapper canvas {
		display: block;
		width: 100%;
		height: 100%;
	}

	.canvas-metrics {
		display: flex;
		gap: 1rem;
		font-size: 0.85rem;
		color: #718096;
		margin-bottom: 0.75rem;
	}

	.canvas-metrics strong {
		color: #2d3748;
	}

	/* Canvas orientation toggle */
	.orientation-toggle {
		display: inline-flex;
		gap: 0;
	}

	.orient-btn {
		background: #e2e8f0;
		color: #4a5568;
		border-radius: 0;
		padding: 0.35rem 0.65rem;
		font-size: 0.8rem;
	}

	.orient-btn:first-child {
		border-radius: 6px 0 0 6px;
	}

	.orient-btn:last-child {
		border-radius: 0 6px 6px 0;
	}

	.orient-btn:hover {
		background: #cbd5e0;
	}

	.orient-active {
		background: #667eea !important;
		color: white !important;
	}

	/* Flat card view */
	.flat-card-list {
		max-height: 500px;
		overflow-y: auto;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
	}

	.flat-card {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 0.4rem 0.75rem;
		border: none;
		border-bottom: 1px solid #f1f5f9;
		background: white;
		cursor: pointer;
		text-align: left;
		font-size: 0.85rem;
	}

	.flat-card:hover {
		background: #f8fafc;
	}

	.flat-card-selected {
		background: #eef2ff !important;
	}

	.flat-card-name {
		color: #2d3748;
	}

	.flat-card-path {
		font-size: 0.75rem;
		color: #94a3b8;
		flex-shrink: 0;
		margin-left: 1rem;
	}
</style>
