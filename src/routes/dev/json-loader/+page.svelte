<script lang="ts">
	import { onMount } from 'svelte';
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types';

	const STORAGE_KEY = 'svelte-treeview-json-loader-config';

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
		isSorted: true
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
				displayMember, sortMember, expandLevel, isSorted
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
			expandLevel, isSorted];
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
</style>
