<script lang="ts">
	import CanvasTree from '$lib/canvas/CanvasTree.svelte';
	import type { LTreeNode } from '$lib/ltree/ltree-node.svelte.js';
	import type { GrowthDirection, LayoutMode } from '$lib/canvas/types.js';

	interface TreeItem {
		id: number;
		path: string;
		parentPath: string;
		level: number;
		name: string;
		hasChildren: boolean;
	}

	function generateTreeData(): TreeItem[] {
		const nodes: TreeItem[] = [];
		let id = 1;
		const departments = ['Engineering', 'Sales', 'Marketing', 'Finance', 'HR', 'Operations'];
		const teams = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Core'];

		for (let i = 0; i < departments.length; i++) {
			const l1Path = String(i + 1);
			nodes.push({ id: id++, path: l1Path, parentPath: '', level: 1, name: `[${l1Path}] ${departments[i]}`, hasChildren: true });
			for (let j = 0; j < teams.length; j++) {
				const l2Path = `${l1Path}.${j + 1}`;
				nodes.push({ id: id++, path: l2Path, parentPath: l1Path, level: 2, name: `[${l2Path}] ${teams[j]} Team`, hasChildren: true });
				for (let k = 0; k < 3; k++) {
					const l3Path = `${l2Path}.${k + 1}`;
					nodes.push({ id: id++, path: l3Path, parentPath: l2Path, level: 3, name: `[${l3Path}] Member ${k + 1}`, hasChildren: false });
				}
			}
		}
		return nodes;
	}

	let treeData = $state.raw<TreeItem[]>(generateTreeData());
	let layoutMode: LayoutMode = $state('tree');
	let growthDirection: GrowthDirection = $state('right');
	let balancedSplit: 'even' | 'weighted' = $state('even');
	let radialStartAngle = $state(0);
	let radialSpacing = $state(160);
	let sunburstRingWidth = $state(100);
	let groupSiblings = $state(false);
	let showDotGrid = $state(true);

	let layoutTime = $state(0);
	let drawTime = $state(0);
	let visibleCount = $state(0);
	let totalCount = $state(0);

	let canvasTree: ReturnType<typeof CanvasTree> | undefined = $state();

	const layoutModes: { value: LayoutMode; label: string; desc: string }[] = [
		{ value: 'tree', label: 'Tree', desc: 'Standard tree layout (default)' },
		{ value: 'balanced', label: 'Balanced', desc: 'Root centered, two symmetric arms' },
		{ value: 'fishbone', label: 'Fishbone', desc: 'Spine with alternating branches' },
		{ value: 'radial', label: 'Radial', desc: 'Star / concentric rings from center' },
		{ value: 'box', label: 'Box', desc: 'Space-filling treemap' },
		{ value: 'sunburst', label: 'Sunburst', desc: 'Concentric arc segments by depth' },
	];

	const directions: GrowthDirection[] = ['right', 'left', 'down', 'up'];

	function resetView() {
		canvasTree?.zoomToFit();
	}
</script>

<svelte:head>
	<title>Layout Modes — CanvasTree Dev</title>
</svelte:head>

<div class="page">
	<div class="controls">
		<h2>CanvasTree Layout Modes</h2>

		<fieldset>
			<legend>Layout Mode</legend>
			{#each layoutModes as mode}
				<label class="radio-label" class:active={layoutMode === mode.value}>
					<input type="radio" name="layoutMode" value={mode.value} bind:group={layoutMode} />
					<span class="radio-text">
						<strong>{mode.label}</strong>
						<small>{mode.desc}</small>
					</span>
				</label>
			{/each}
		</fieldset>

		{#if layoutMode !== 'radial' && layoutMode !== 'box' && layoutMode !== 'sunburst'}
			<fieldset>
				<legend>Growth Direction</legend>
				<div class="btn-row">
					{#each directions as dir}
						<button class:active={growthDirection === dir} onclick={() => growthDirection = dir}>
							{dir}
						</button>
					{/each}
				</div>
			</fieldset>
		{/if}

		{#if layoutMode === 'balanced'}
			<fieldset>
				<legend>Balanced Split</legend>
				<div class="btn-row">
					<button class:active={balancedSplit === 'even'} onclick={() => balancedSplit = 'even'}>Even (50/50)</button>
					<button class:active={balancedSplit === 'weighted'} onclick={() => balancedSplit = 'weighted'}>Weighted</button>
				</div>
			</fieldset>
		{/if}

		{#if layoutMode === 'radial'}
			<fieldset>
				<legend>Radial Options</legend>
				<label>
					Start angle: {radialStartAngle}°
					<input type="range" min="0" max="360" step="15" bind:value={radialStartAngle} />
				</label>
				<label>
					Ring spacing: {radialSpacing}px
					<input type="range" min="80" max="400" step="20" bind:value={radialSpacing} />
				</label>
			</fieldset>
		{/if}

		{#if layoutMode === 'sunburst'}
			<fieldset>
				<legend>Sunburst Options</legend>
				<label>
					Ring width: {sunburstRingWidth}px
					<input type="range" min="40" max="200" step="10" bind:value={sunburstRingWidth} />
				</label>
			</fieldset>
		{/if}

		{#if layoutMode === 'tree'}
			<label class="checkbox">
				<input type="checkbox" bind:checked={groupSiblings} />
				Group siblings
			</label>
		{/if}

		<label class="checkbox">
			<input type="checkbox" bind:checked={showDotGrid} />
			Dot grid
		</label>

		<button class="btn-action" onclick={resetView}>Zoom to fit</button>

		<div class="metrics">
			<div>Layout: {layoutTime.toFixed(1)} ms</div>
			<div>Draw: {drawTime.toFixed(1)} ms</div>
			<div>Visible: {visibleCount} / {totalCount}</div>
		</div>
	</div>

	<div class="canvas-container">
		<CanvasTree
			bind:this={canvasTree}
			data={treeData}
			idMember="id"
			pathMember="path"
			parentPathMember="parentPath"
			levelMember="level"
			hasChildrenMember="hasChildren"
			displayValueMember="name"
			{layoutMode}
			{growthDirection}
			{groupSiblings}
			{showDotGrid}
			{balancedSplit}
			{radialStartAngle}
			{radialSpacing}
			{sunburstRingWidth}
			expandLevel={3}
			bind:layoutTime
			bind:drawTime
			bind:visibleCount
			bind:totalCount
		/>
	</div>
</div>

<style>
	.page {
		display: flex;
		height: 100vh;
		font-family: system-ui, sans-serif;
		background: #0f172a;
		color: #e2e8f0;
	}

	.controls {
		width: 300px;
		padding: 16px;
		overflow-y: auto;
		border-right: 1px solid #1e293b;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.controls h2 {
		font-size: 1.1rem;
		margin: 0 0 4px;
		color: #f1f5f9;
	}

	fieldset {
		border: 1px solid #334155;
		border-radius: 8px;
		padding: 10px;
		margin: 0;
	}

	legend {
		font-size: 0.8rem;
		color: #94a3b8;
		font-weight: 600;
		padding: 0 6px;
	}

	.radio-label {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		padding: 6px 8px;
		border-radius: 6px;
		cursor: pointer;
	}

	.radio-label:hover { background: #1e293b; }
	.radio-label.active { background: #1e293b; }

	.radio-text {
		display: flex;
		flex-direction: column;
	}

	.radio-text strong {
		font-size: 0.85rem;
	}

	.radio-text small {
		font-size: 0.72rem;
		color: #64748b;
	}

	.btn-row {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.btn-row button {
		flex: 1;
		min-width: 60px;
		padding: 6px 10px;
		border: 1px solid #334155;
		border-radius: 6px;
		background: transparent;
		color: #e2e8f0;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.btn-row button:hover { background: #1e293b; }
	.btn-row button.active { background: #7c3aed; border-color: #7c3aed; }

	.checkbox {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.btn-action {
		padding: 8px 14px;
		border: 1px solid #334155;
		border-radius: 6px;
		background: #1e293b;
		color: #e2e8f0;
		cursor: pointer;
		font-size: 0.85rem;
	}
	.btn-action:hover { background: #334155; }

	.metrics {
		font-size: 0.75rem;
		color: #64748b;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	label input[type="range"] {
		width: 100%;
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.8rem;
	}

	.canvas-container {
		flex: 1;
		min-width: 0;
	}
</style>
