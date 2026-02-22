<script lang="ts">
	import CanvasTree from '$lib/canvas/CanvasTree.svelte';
	import { TreeController } from '$lib/core/TreeController.svelte.js';
	import type { LTreeNode } from '$lib/ltree/ltree-node.svelte.js';
	import type { ContextMenuItem, DropPosition } from '$lib/ltree/types.js';
	import type { GrowthDirection, ClickBehavior, CanvasLevelConfig, InitialViewport } from '$lib/canvas/types.js';

	// ── Types ──────────────────────────────────────────────────────────────

	interface TreeItem {
		id: number;
		path: string;
		parentPath: string;
		level: number;
		name: string;
		hasChildren: boolean;
	}

	// ── Data generation ───────────────────────────────────────────────────
	const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations', 'Legal', 'Support', 'Product', 'Design'];
	const TEAM_PREFIXES = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Core', 'Platform', 'Growth', 'Enterprise', 'Mobile', 'Cloud'];
	const TEAM_SUFFIXES = ['Team', 'Squad', 'Group', 'Unit', 'Division'];

	function generateName(level: number, index: number): string {
		if (level === 1) return DEPARTMENTS[index % DEPARTMENTS.length];
		if (level === 2) return `${TEAM_PREFIXES[index % TEAM_PREFIXES.length]} ${TEAM_SUFFIXES[index % TEAM_SUFFIXES.length]}`;
		return `Member ${index + 1}`;
	}

	function generateTreeData(targetCount: number): TreeItem[] {
		const nodes: TreeItem[] = [];
		let id = 1;
		const l1Count = Math.min(10, Math.ceil(targetCount / 100));
		const l2PerL1 = Math.min(15, Math.ceil(targetCount / (l1Count * 10)));
		const l3PerL2 = Math.max(1, Math.floor((targetCount - l1Count - l1Count * l2PerL1) / (l1Count * l2PerL1)));

		for (let i = 0; i < l1Count; i++) {
			const l1Path = String(i + 1);
			nodes.push({ id: id++, path: l1Path, parentPath: '', level: 1, name: generateName(1, i), hasChildren: true });
			for (let j = 0; j < l2PerL1; j++) {
				const l2Path = `${l1Path}.${j + 1}`;
				nodes.push({ id: id++, path: l2Path, parentPath: l1Path, level: 2, name: generateName(2, j), hasChildren: l3PerL2 > 0 });
				for (let k = 0; k < l3PerL2; k++) {
					const l3Path = `${l2Path}.${k + 1}`;
					nodes.push({ id: id++, path: l3Path, parentPath: l2Path, level: 3, name: `${generateName(2, j)} - ${generateName(3, k)}`, hasChildren: false });
					if (nodes.length >= targetCount) break;
				}
				if (nodes.length >= targetCount) break;
			}
			if (nodes.length >= targetCount) break;
		}
		return nodes;
	}

	// ── State ──────────────────────────────────────────────────────────────
	let nodeCountTarget = $state(5000);
	let treeData = $state.raw<TreeItem[]>(generateTreeData(5000));
	let treeKey = $state(0);
	let growthDirection: GrowthDirection = $state('right');
	let initialViewport: InitialViewport = $state('root');
	let groupSiblings = $state(true);
	let showDotGrid = $state(false);
	let focusPath = $state('1.1');

	let clickBehavior: ClickBehavior = $state('expand');
	let columnGap = $state(40);
	let gridNodeMaxW = $state(260);
	let showAdvancedConfig = $state(false);

	// Visual configuration
	let nodeHeight = $state(28);
	let nodeGap = $state(6);
	let levelSpacingV = $state(60);
	let nodePaddingX = $state(14);
	let nodeMinWidth = $state(100);
	let colorBarW = $state(3);
	let depthColors = $state(['#f59e0b', '#0d9488', '#7c3aed', '#ec4899']);
	let fontSize = $state(12);
	let fontFamily = $state('"SF Mono", "Cascadia Code", "Fira Code", monospace');
	let zoomLodText = $state(0.35);
	let zoomLodSimple = $state(0.12);
	let gridGap = $state(4);
	let groupPadding = $state(8);
	let maxGridCols = $state(10);

	// Level overrides
	let showLevelConfig = $state(false);
	let levelConfigEnabled = $state([false, false, false, false]);
	let levelConfigValues = $state<CanvasLevelConfig[]>([
		{ color: '#ef4444', nodeHeight: 36, groupSiblings: true, nodeGap: 6 },
		{ color: '#3b82f6', nodeHeight: 28, groupSiblings: true, nodeGap: 6 },
		{ color: '#10b981', nodeHeight: 24, groupSiblings: false, nodeGap: 6 },
		{ color: '#8b5cf6', nodeHeight: 22, groupSiblings: true, nodeGap: 4 }
	]);

	let levelConfig = $derived(
		levelConfigEnabled.some(Boolean)
			? levelConfigEnabled.map((enabled, i) => enabled ? levelConfigValues[i] : {})
			: undefined
	);

	let selectedPath = $state<string | null>(null);
	let ctrlRef = $state<TreeController<TreeItem> | null>(null);

	// Metrics
	let layoutTime = $state(0);
	let drawTime = $state(0);
	let visibleCount = $state(0);
	let totalCount = $state(0);

	// Drop log
	let dropLog = $state<string[]>([]);

	// Search & filter
	type SearchMode = 'search' | 'filter';
	let searchMode: SearchMode = $state('search');
	let searchQuery = $state('');
	let searchResults = $state<LTreeNode<TreeItem>[]>([]);
	let currentResultIndex = $state(-1);

	// Canvas tree component reference
	let canvasTreeRef: ReturnType<typeof CanvasTree> | undefined = $state();

	// ── Callbacks ─────────────────────────────────────────────────────────

	function sortCallback(items: LTreeNode<TreeItem>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	function getCanvasContextMenu(node: LTreeNode<TreeItem>): ContextMenuItem[] {
		const items: ContextMenuItem[] = [];

		items.push({
			icon: '\u{1F3AF}',
			title: 'Focus on node',
			callback: () => {
				canvasTreeRef?.focusOnPath(node.path);
			}
		});

		if (node.hasChildren) {
			items.push({ isDivider: true, title: '', callback: () => {} });
			if (node.isExpanded) {
				items.push({
					icon: '\u{1F4C1}',
					title: 'Collapse',
					callback: () => { ctrlRef?.collapseNodes(node.path); }
				});
			} else {
				items.push({
					icon: '\u{1F4C2}',
					title: 'Expand',
					callback: () => { ctrlRef?.expandNodes(node.path); }
				});
			}
			items.push({
				icon: '\u{1F4C2}',
				title: 'Expand subtree',
				callback: () => { canvasTreeRef?.expandAll(node.path); }
			});
			items.push({
				icon: '\u{1F4C1}',
				title: 'Collapse subtree',
				callback: () => { canvasTreeRef?.collapseAll(node.path); }
			});
		}

		items.push({ isDivider: true, title: '', callback: () => {} });
		items.push({
			icon: '\u{1F4CB}',
			title: 'Copy path',
			callback: () => navigator.clipboard.writeText(node.path)
		});

		return items;
	}

	function onNodeDrop(source: LTreeNode<TreeItem>, target: LTreeNode<TreeItem>, position: DropPosition) {
		dropLog = [`Moved "${source.data?.name}" ${position} "${target.data?.name}"`, ...dropLog.slice(0, 9)];
	}

	// ── Actions ───────────────────────────────────────────────────────────

	function generateAndReset() {
		treeData = generateTreeData(nodeCountTarget);
		treeKey++;
		selectedPath = null;
		dropLog = [];
		searchQuery = '';
		searchResults = [];
		currentResultIndex = -1;
	}

	function setGrowthDirection(dir: GrowthDirection) {
		growthDirection = dir;
		canvasTreeRef?.setGrowthDirection(dir);
	}

	function doExpandAll() {
		canvasTreeRef?.expandAll();
	}

	function doCollapseAll() {
		canvasTreeRef?.collapseAll();
	}

	function doZoomToFit() {
		canvasTreeRef?.zoomToFit();
	}

	function doFocusOnPath() {
		canvasTreeRef?.focusOnPath(focusPath);
	}

	// ── Search & filter ──────────────────────────────────────────────────

	function executeSearch() {
		if (!canvasTreeRef) return;
		const query = searchQuery.trim();

		if (!query) {
			canvasTreeRef.clearSearch();
			searchResults = [];
			currentResultIndex = -1;
			return;
		}

		if (searchMode === 'search') {
			canvasTreeRef.filterNodes('');
			searchResults = canvasTreeRef.searchNodes(query) as LTreeNode<TreeItem>[];
			const sr = canvasTreeRef.getSearchResults();
			currentResultIndex = sr.currentIndex;
		} else {
			searchResults = [];
			currentResultIndex = -1;
			canvasTreeRef.filterNodes(query);
		}
	}

	function nextResult() {
		canvasTreeRef?.nextResult();
		const sr = canvasTreeRef?.getSearchResults();
		if (sr) currentResultIndex = sr.currentIndex;
	}

	function prevResult() {
		canvasTreeRef?.prevResult();
		const sr = canvasTreeRef?.getSearchResults();
		if (sr) currentResultIndex = sr.currentIndex;
	}

	function clearSearch() {
		searchQuery = '';
		searchResults = [];
		currentResultIndex = -1;
		canvasTreeRef?.clearSearch();
	}

	function onSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && searchMode === 'search') {
			if (e.shiftKey) prevResult();
			else if (searchResults.length > 0) nextResult();
			else executeSearch();
			e.preventDefault();
		} else if (e.key === 'Escape') {
			clearSearch();
			(e.target as HTMLInputElement)?.blur();
		}
	}

	function setSearchMode(mode: SearchMode) {
		if (mode === searchMode) return;
		if (searchMode === 'filter') {
			canvasTreeRef?.filterNodes('');
		}
		searchResults = [];
		currentResultIndex = -1;
		searchMode = mode;
		if (searchQuery.trim()) executeSearch();
	}
</script>

<svelte:head>
	<title>Canvas Dendrogram - Svelte Treeview</title>
	<link rel="stylesheet" href="/examples-shared.css" />
</svelte:head>

<div class="container">
	<header>
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>Canvas Dendrogram</h1>
		<p class="subtitle">
			Canvas 2D dendrogram rendering 5000+ nodes on a single <code>&lt;canvas&gt;</code> element.
			Pan by dragging empty space. Zoom with scroll wheel. Click nodes to expand/collapse.
			Right-click for context menu. Drag nodes to rearrange.
		</p>
	</header>

	<div class="card">
		<h2>Canvas Dendrogram</h2>
		<p class="description">
			All nodes are drawn on a single <code>&lt;canvas&gt;</code> element with viewport culling.
			Uses the <code>&lt;CanvasTree&gt;</code> component.
		</p>

		<div class="controls">
			<label>
				Nodes:
				<select bind:value={nodeCountTarget}>
					<option value={1000}>1,000</option>
					<option value={2000}>2,000</option>
					<option value={5000}>5,000</option>
					<option value={10000}>10,000</option>
				</select>
			</label>
			<button class="btn" onclick={generateAndReset}>Generate</button>
			<button class="btn" onclick={doExpandAll}>Expand All</button>
			<button class="btn" onclick={doCollapseAll}>Collapse All</button>
			<button class="btn secondary" onclick={doZoomToFit}>Zoom to Fit</button>

			<span class="orientation-toggle">
				<button class="btn orient-btn" class:orient-active={growthDirection === 'right'} onclick={() => setGrowthDirection('right')}>Right</button>
				<button class="btn orient-btn" class:orient-active={growthDirection === 'left'} onclick={() => setGrowthDirection('left')}>Left</button>
				<button class="btn orient-btn" class:orient-active={growthDirection === 'down'} onclick={() => setGrowthDirection('down')}>Down</button>
				<button class="btn orient-btn" class:orient-active={growthDirection === 'up'} onclick={() => setGrowthDirection('up')}>Up</button>
			</span>

			<span class="orientation-toggle">
				<button class="btn orient-btn" class:orient-active={initialViewport === 'root'} onclick={() => initialViewport = 'root'}>Root</button>
				<button class="btn orient-btn" class:orient-active={initialViewport === 'origin'} onclick={() => initialViewport = 'origin'}>Origin</button>
			</span>

			<label class="group-toggle">
				<input type="checkbox" bind:checked={groupSiblings} />
				Group siblings
			</label>
			<label class="group-toggle">
				<input type="checkbox" bind:checked={showDotGrid} />
				Dot grid
			</label>

			<label class="group-toggle">
				Click:
				<select class="click-select" bind:value={clickBehavior}>
					<option value="select">Select only</option>
					<option value="expand">Expand</option>
					<option value="expand-and-focus">Expand & Focus</option>
				</select>
			</label>

			<label class="group-toggle">
				Col Gap:
				<input type="number" class="click-select" bind:value={columnGap} min="10" max="200" step="5" style="width: 50px" />
			</label>
			<label class="group-toggle">
				Grid max W:
				<input type="number" class="click-select" bind:value={gridNodeMaxW} min="100" max="500" step="10" style="width: 60px" />
			</label>

			<button class="btn secondary" onclick={() => showAdvancedConfig = !showAdvancedConfig} style="font-size: 0.75em; padding: 2px 8px;">
				{showAdvancedConfig ? 'Hide' : 'More'} Options
			</button>

			<span class="focus-path-group">
				<input
					type="text"
					class="focus-path-input"
					bind:value={focusPath}
					placeholder="e.g. 1.2.3"
					onkeydown={(e) => { if (e.key === 'Enter') doFocusOnPath(); }}
				/>
				<button class="btn secondary" onclick={doFocusOnPath}>Focus</button>
			</span>
		</div>

		{#if showAdvancedConfig}
			<div class="advanced-config">
				<div class="config-section">
					<strong>Nodes</strong>
					<label>Height <input type="number" class="click-select" bind:value={nodeHeight} min="16" max="60" step="1" style="width: 45px" /></label>
					<label>Min W <input type="number" class="click-select" bind:value={nodeMinWidth} min="40" max="300" step="10" style="width: 50px" /></label>
					<label>Gap <input type="number" class="click-select" bind:value={nodeGap} min="0" max="20" step="1" style="width: 40px" /></label>
					<label>Pad X <input type="number" class="click-select" bind:value={nodePaddingX} min="2" max="30" step="1" style="width: 40px" /></label>
					<label>Bar W <input type="number" class="click-select" bind:value={colorBarW} min="0" max="10" step="1" style="width: 40px" /></label>
					<label>V-Space <input type="number" class="click-select" bind:value={levelSpacingV} min="20" max="200" step="5" style="width: 50px" /></label>
				</div>
				<div class="config-section">
					<strong>Font</strong>
					<label>Size <input type="number" class="click-select" bind:value={fontSize} min="8" max="24" step="1" style="width: 40px" /></label>
					<label>Family
						<select class="click-select" bind:value={fontFamily} style="width: 120px">
							<option value='"SF Mono", "Cascadia Code", "Fira Code", monospace'>SF Mono</option>
							<option value='"Fira Code", "Source Code Pro", monospace'>Fira Code</option>
							<option value='"Consolas", "Courier New", monospace'>Consolas</option>
							<option value='system-ui, -apple-system, sans-serif'>System UI</option>
							<option value='"Segoe UI", Roboto, sans-serif'>Segoe UI</option>
						</select>
					</label>
				</div>
				<div class="config-section">
					<strong>Grid</strong>
					<label>Grid Gap <input type="number" class="click-select" bind:value={gridGap} min="0" max="20" step="1" style="width: 40px" /></label>
					<label>Grp Pad <input type="number" class="click-select" bind:value={groupPadding} min="0" max="20" step="1" style="width: 40px" /></label>
					<label>Max Cols <input type="number" class="click-select" bind:value={maxGridCols} min="2" max="20" step="1" style="width: 40px" /></label>
				</div>
				<div class="config-section">
					<strong>Colors</strong>
					{#each depthColors as color, i}
						<label>D{i} <input type="color" value={color} oninput={(e) => {
							const c = [...depthColors]; c[i] = (e.target as HTMLInputElement).value; depthColors = c;
						}} style="width: 30px; height: 22px; padding: 0; border: none; cursor: pointer;" /></label>
					{/each}
				</div>
				<div class="config-section">
					<strong>LOD</strong>
					<label>Text <input type="range" bind:value={zoomLodText} min="0.1" max="1" step="0.05" style="width: 60px" /> {zoomLodText}</label>
					<label>Simple <input type="range" bind:value={zoomLodSimple} min="0.01" max="0.5" step="0.01" style="width: 60px" /> {zoomLodSimple}</label>
				</div>
			</div>

			<div class="level-config-section">
				<button class="btn secondary" onclick={() => showLevelConfig = !showLevelConfig} style="font-size: 0.75em; padding: 2px 8px; margin-bottom: 0.4rem;">
					{showLevelConfig ? 'Hide' : 'Show'} Per-Level Overrides
				</button>

				{#if showLevelConfig}
					<div class="level-config-grid">
						{#each [0, 1, 2, 3] as lvl}
							<div class="level-row" class:level-row-enabled={levelConfigEnabled[lvl]}>
								<label class="level-enable">
									<input type="checkbox" bind:checked={levelConfigEnabled[lvl]} />
									<strong>Level {lvl}</strong>
								</label>
								{#if levelConfigEnabled[lvl]}
									<label>Color <input type="color" value={levelConfigValues[lvl].color} oninput={(e) => {
										levelConfigValues[lvl] = { ...levelConfigValues[lvl], color: (e.target as HTMLInputElement).value };
									}} style="width: 28px; height: 20px; padding: 0; border: none; cursor: pointer;" /></label>
									<label>Height <input type="number" class="click-select" value={levelConfigValues[lvl].nodeHeight} oninput={(e) => {
										levelConfigValues[lvl] = { ...levelConfigValues[lvl], nodeHeight: +(e.target as HTMLInputElement).value };
									}} min="14" max="60" step="1" style="width: 42px" /></label>
									<label>Gap <input type="number" class="click-select" value={levelConfigValues[lvl].nodeGap} oninput={(e) => {
										levelConfigValues[lvl] = { ...levelConfigValues[lvl], nodeGap: +(e.target as HTMLInputElement).value };
									}} min="0" max="20" step="1" style="width: 38px" /></label>
									<label class="level-group-toggle">
										<input type="checkbox" checked={levelConfigValues[lvl].groupSiblings ?? true} onchange={(e) => {
											levelConfigValues[lvl] = { ...levelConfigValues[lvl], groupSiblings: (e.target as HTMLInputElement).checked };
										}} />
										Group
									</label>
								{:else}
									<span class="level-disabled-text">Using global defaults</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<div class="search-bar">
			<span class="orientation-toggle">
				<button
					class="btn orient-btn"
					class:orient-active={searchMode === 'search'}
					onclick={() => setSearchMode('search')}
				>Search</button>
				<button
					class="btn orient-btn"
					class:orient-active={searchMode === 'filter'}
					onclick={() => setSearchMode('filter')}
				>Filter</button>
			</span>

			<input
				type="text"
				class="search-input"
				placeholder="Search nodes..."
				bind:value={searchQuery}
				onkeydown={onSearchKeydown}
				oninput={() => executeSearch()}
			/>

			{#if searchMode === 'search' && searchQuery.trim()}
				{#if searchResults.length > 0}
					<button class="btn search-nav-btn" onclick={prevResult} title="Previous (Shift+Enter)">&blacktriangle;</button>
					<span class="search-count">{currentResultIndex + 1}/{searchResults.length}</span>
					<button class="btn search-nav-btn" onclick={nextResult} title="Next (Enter)">&blacktriangledown;</button>
				{:else}
					<span class="search-count no-results">No results</span>
				{/if}
			{/if}

			{#if searchMode === 'filter' && searchQuery.trim()}
				<span class="search-count">Filtered view</span>
			{/if}

			{#if searchQuery.trim()}
				<button class="btn search-nav-btn" onclick={clearSearch} title="Clear (Escape)">&times;</button>
			{/if}
		</div>

		<div class="metrics">
			<span>Layout: <strong>{layoutTime.toFixed(1)}ms</strong></span>
			<span>Draw: <strong>{drawTime.toFixed(1)}ms</strong></span>
			<span>Visible: <strong>{visibleCount}</strong>/{totalCount}</span>
		</div>

		{#key treeKey}
			<div class="canvas-container">
				<CanvasTree
					bind:this={canvasTreeRef}
					data={treeData}
					idMember="id"
					pathMember="path"
					{sortCallback}
					isSorted={true}
					expandLevel={1}
					dragDropMode="self"
					shouldUseInternalSearchIndex={true}
					searchValueMember="name"
					bind:selectedPath
					bind:controller={ctrlRef}
					bind:layoutTime
					bind:drawTime
					bind:visibleCount
					bind:totalCount
					bind:growthDirection
					{initialViewport}
					bind:groupSiblings
					bind:showDotGrid
					bind:clickBehavior
					bind:nodeHeight
					bind:nodeMinWidth
					bind:nodePaddingX
					bind:nodeGap
					bind:columnGap
					bind:levelSpacingV
					colorBarWidth={colorBarW}
					bind:depthColors
					bind:fontSize
					bind:fontFamily
					bind:zoomLodText
					bind:zoomLodSimple
					bind:gridGap
					bind:groupPadding
					bind:maxGridCols
					bind:gridNodeMaxW
					{levelConfig}
					getNodeLabel={(node) => node.data?.name || node.path}
					onNodeContextMenu={getCanvasContextMenu}
					{onNodeDrop}
				/>
			</div>
		{/key}

		<div class="info-row">
			{#if selectedPath && ctrlRef}
				{@const selNode = ctrlRef.getNodeByPath(selectedPath)}
				{#if selNode}
					<div class="info-panel">
						<h3>Selected Node</h3>
						<p><strong>{selNode.data?.name}</strong></p>
						<p class="info-meta">Path: {selNode.path} | Level: {selNode.level} | Children: {selNode.hasChildren ? 'yes' : 'no'}</p>
						<button class="btn secondary" style="margin-top: 0.4rem; font-size: 0.8rem; padding: 0.25rem 0.6rem;" onclick={() => canvasTreeRef?.focusOnPath(selectedPath!)}>Focus</button>
					</div>
				{/if}
			{/if}
			{#if dropLog.length > 0}
				<div class="info-panel">
					<h3>Drop Log</h3>
					{#each dropLog as entry}
						<p class="log-entry">{entry}</p>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.advanced-config {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		background: #f1f5f9;
		border-radius: 6px;
		margin-bottom: 0.5rem;
		font-size: 0.75rem;
	}
	.config-section {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.config-section strong {
		color: #475569;
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.config-section label {
		display: flex;
		align-items: center;
		gap: 3px;
		color: #64748b;
		white-space: nowrap;
	}
	.metrics {
		display: flex;
		gap: 1rem;
		font-size: 0.85rem;
		color: #718096;
		margin-bottom: 1rem;
	}

	.metrics strong {
		color: #2d3748;
	}

	.focus-path-group {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin-left: 0.75rem;
	}

	.focus-path-input {
		width: 100px;
		padding: 0.35rem 0.5rem;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		font-size: 0.85rem;
		font-family: 'SF Mono', 'Cascadia Code', monospace;
	}

	.click-select {
		padding: 0.3rem 0.4rem;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		font-size: 0.8rem;
		background: white;
	}

	.group-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin-left: 0.75rem;
		font-size: 0.85rem;
		color: #4a5568;
		cursor: pointer;
	}

	.orientation-toggle {
		display: inline-flex;
		gap: 0;
		margin-left: 0.5rem;
	}

	.orient-btn {
		background: #e2e8f0;
		color: #4a5568;
		border-radius: 0;
		padding: 0.4rem 0.75rem;
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

	.canvas-container {
		width: 100%;
		height: 600px;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		overflow: hidden;
		position: relative;
	}

	.info-row {
		display: flex;
		gap: 1rem;
		margin-top: 1rem;
	}

	.info-panel {
		flex: 1;
		background: #f7fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 0.75rem 1rem;
	}

	.info-panel h3 {
		margin: 0 0 0.4rem;
		font-size: 0.9rem;
		color: #4a5568;
	}

	.info-panel p {
		margin: 0.15rem 0;
		font-size: 0.85rem;
		color: #2d3748;
	}

	.info-meta {
		color: #718096 !important;
		font-size: 0.8rem !important;
	}

	.log-entry {
		font-family: 'SF Mono', 'Cascadia Code', monospace;
		font-size: 0.8rem !important;
		color: #4a5568 !important;
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.search-input {
		width: 200px;
		padding: 0.35rem 0.5rem;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		font-size: 0.85rem;
		font-family: 'SF Mono', 'Cascadia Code', monospace;
	}

	.search-input:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15);
	}

	.search-nav-btn {
		padding: 0.2rem 0.5rem;
		font-size: 0.85rem;
		min-width: unset;
		line-height: 1;
	}

	.search-count {
		font-size: 0.8rem;
		font-family: 'SF Mono', 'Cascadia Code', monospace;
		color: #4a5568;
		white-space: nowrap;
	}

	.search-count.no-results {
		color: #e53e3e;
	}

	/* ── Level Config ──────────────────────────────────────────────────── */

	.level-config-section {
		margin-bottom: 0.5rem;
	}

	.level-config-grid {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		background: #f1f5f9;
		border-radius: 6px;
		padding: 0.5rem 0.75rem;
		font-size: 0.75rem;
	}

	.level-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.3rem 0.5rem;
		border-radius: 4px;
		background: #e2e8f0;
		opacity: 0.6;
		transition: opacity 0.15s, background 0.15s;
	}

	.level-row-enabled {
		opacity: 1;
		background: #dbeafe;
	}

	.level-enable {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		min-width: 70px;
		cursor: pointer;
	}

	.level-enable strong {
		color: #334155;
		font-size: 0.75rem;
	}

	.level-row label {
		display: flex;
		align-items: center;
		gap: 3px;
		color: #475569;
		white-space: nowrap;
	}

	.level-group-toggle {
		cursor: pointer;
	}

	.level-disabled-text {
		color: #94a3b8;
		font-style: italic;
		font-size: 0.7rem;
	}
</style>
