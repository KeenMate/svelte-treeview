<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';
	import type { ClickBehavior, CheckboxMode } from '$lib/ltree/types.js';
	import RenderModeSwitch from '../RenderModeSwitch.svelte';
	import { getTreeProps } from '../render-mode.svelte.js';

	const STORAGE_KEY = 'svelte-treeview-interaction-settings';

	// Sample hierarchical data
	const sampleData = [
		{ id: 1, path: '1', name: 'Documents', icon: '📁' },
		{ id: 2, path: '1.1', name: 'Work', icon: '💼' },
		{ id: 3, path: '1.1.1', name: 'Reports', icon: '📊' },
		{ id: 4, path: '1.1.2', name: 'Presentations', icon: '📽️' },
		{ id: 5, path: '1.1.3', name: 'Spreadsheets', icon: '📈' },
		{ id: 6, path: '1.2', name: 'Personal', icon: '🏠' },
		{ id: 7, path: '1.2.1', name: 'Photos', icon: '📷' },
		{ id: 8, path: '1.2.2', name: 'Music', icon: '🎵' },
		{ id: 9, path: '1.2.3', name: 'Videos', icon: '🎬' },
		{ id: 10, path: '2', name: 'Downloads', icon: '⬇️' },
		{ id: 11, path: '2.1', name: 'Software', icon: '💿' },
		{ id: 12, path: '2.2', name: 'Media', icon: '🎞️' },
		{ id: 13, path: '2.3', name: 'Archives', icon: '📦' },
		{ id: 14, path: '3', name: 'Projects', icon: '🚀' },
		{ id: 15, path: '3.1', name: 'Web App', icon: '🌐' },
		{ id: 16, path: '3.1.1', name: 'Frontend', icon: '🎨' },
		{ id: 17, path: '3.1.2', name: 'Backend', icon: '⚙️' },
		{ id: 18, path: '3.1.3', name: 'Tests', icon: '🧪' },
		{ id: 19, path: '3.2', name: 'Mobile App', icon: '📱' },
		{ id: 20, path: '3.2.1', name: 'iOS', icon: '🍎' },
		{ id: 21, path: '3.2.2', name: 'Android', icon: '🤖' }
	];

	type Item = typeof sampleData[0];

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	// ── Persisted settings ───────────────────────────────────────────
	interface Settings {
		clickBehavior: ClickBehavior;
		selectedNodeClass: string;
		showCheckboxes: boolean;
		checkboxMode: CheckboxMode;
		rangeSelectionMode: 'visual' | 'logical';
	}

	const defaultSettings: Settings = {
		clickBehavior: 'expand-and-focus',
		selectedNodeClass: 'ltree-selected-bold',
		showCheckboxes: false,
		checkboxMode: 'independent',
		rangeSelectionMode: 'visual'
	};

	function loadSettings(): Settings {
		try {
			const raw = localStorage?.getItem(STORAGE_KEY);
			if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
		} catch {}
		return { ...defaultSettings };
	}

	const saved = loadSettings();

	function saveSettings() {
		try {
			localStorage?.setItem(STORAGE_KEY, JSON.stringify({
				clickBehavior,
				selectedNodeClass,
				showCheckboxes,
				checkboxMode,
				rangeSelectionMode
			}));
		} catch {}
	}

	const selectedNodeClassOptions = [
		{ value: 'ltree-selected-bold', label: 'Bold (ltree-selected-bold)' },
		{ value: 'ltree-selected-border', label: 'Border (ltree-selected-border)' },
		{ value: 'ltree-selected-brackets', label: 'Brackets (ltree-selected-brackets)' }
	];

	// ── Click Behavior demo ──────────────────────────────────────────
	let clickBehavior = $state<ClickBehavior>(saved.clickBehavior);
	let selectedNodeClass = $state(saved.selectedNodeClass);
	let showCheckboxes = $state(saved.showCheckboxes);
	let checkboxMode = $state<CheckboxMode>(saved.checkboxMode);
	let clickSelectedNode = $state<LTreeNode<Item> | null>(null);
	let clickLog = $state<string[]>([]);

	$effect(() => { clickBehavior; selectedNodeClass; showCheckboxes; checkboxMode; rangeSelectionMode; saveSettings(); });

	function onClickDemoNodeClick(node: LTreeNode<Item>) {
		clickLog = [`Selected: ${node.data?.name} (${node.path})`, ...clickLog.slice(0, 9)];
	}

	// ── Multi-select demo ────────────────────────────────────────────
	let rangeSelectionMode = $state<'visual' | 'logical'>(saved.rangeSelectionMode);
	let multiSelectedPaths = $state(new Set<string>());
	let multiSelectedNode = $state<LTreeNode<Item> | null>(null);
	let selectionLog = $state<string[]>([]);

	function onSelectionChange(paths: Set<string>, nodes: LTreeNode<Item>[]) {
		selectionLog = [
			`${nodes.length} node(s): ${nodes.map(n => n.data?.name).join(', ')}`,
			...selectionLog.slice(0, 9)
		];
	}

	// ── Keyboard navigation demo ─────────────────────────────────────
	let navSelectedNode = $state<LTreeNode<Item> | null>(null);
	let navLog = $state<string[]>([]);

	function onNavNodeClick(node: LTreeNode<Item>) {
		navLog = [`Navigated to: ${node.data?.name} (${node.path})`, ...navLog.slice(0, 9)];
	}
</script>

<svelte:head>
	<title>Interaction - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>🖱️ Interaction</h1>
		<p class="subtitle">Click behavior, checkboxes, multi-select, and keyboard navigation</p>
		<RenderModeSwitch />
	</header>

	<!-- Click Behavior -->
	<div class="card">
		<h2>Click Behavior</h2>
		<p class="description">
			The <code>clickBehavior</code> prop controls what happens when you click a node.
			Try switching between modes and clicking nodes to see the difference.
		</p>

		<div class="controls">
			<label>
				Click Behavior:
				<select bind:value={clickBehavior}>
					<option value="expand-and-focus">expand-and-focus (select + expand)</option>
					<option value="select">select (dbl-click to expand)</option>
					<option value="expand">expand (no selection)</option>
				</select>
			</label>
			<label>
				Selected Style:
				<select bind:value={selectedNodeClass}>
					{#each selectedNodeClassOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</label>
			<label>
				<input type="checkbox" bind:checked={showCheckboxes} />
				Show Checkboxes
			</label>
			{#if showCheckboxes}
				<label>
					Checkbox Mode:
					<select bind:value={checkboxMode}>
						<option value="independent">independent (each checkbox standalone)</option>
						<option value="cascade">cascade (parent toggles all children)</option>
					</select>
				</label>
			{/if}
			<button class="btn btn-secondary" onclick={() => { clickLog = []; }}>Clear Log</button>
		</div>

		<div class="grid-2">
			<div class="tree-container tree-container-tall">
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={2}
					{selectedNodeClass}
					{clickBehavior}
					{showCheckboxes}
					{checkboxMode}
					bind:selectedNode={clickSelectedNode}
					onNodeClick={onClickDemoNodeClick}
					{...getTreeProps()}
				>
					{#snippet nodeTemplate(node: any)}
						<span>{node.data?.icon} {node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
			<div>
				<div class="output">
					<p class="output-label">Current Mode</p>
					<pre>{clickBehavior === 'expand-and-focus'
	? 'Single click selects AND expands/collapses'
	: clickBehavior === 'select'
		? 'Single click selects only\nDouble-click expands/collapses'
		: 'Single click expands/collapses only\nNo selection on click'}{showCheckboxes ? '\n+ Checkboxes toggle selection' : ''}</pre>
				</div>
				{#if clickSelectedNode}
					<div class="output">
						<p class="output-label">Selected Node</p>
						<pre>{clickSelectedNode.data?.icon} {clickSelectedNode.data?.name} ({clickSelectedNode.path})</pre>
					</div>
				{/if}
				{#if clickLog.length > 0}
					<div class="output">
						<p class="output-label">Event Log</p>
						<pre>{clickLog.join('\n')}</pre>
					</div>
				{/if}
			</div>
		</div>

		<div class="code-block">
			<pre>{`<Tree
  clickBehavior="${clickBehavior}"
  selectedNodeClass="${selectedNodeClass}"
  showCheckboxes={${showCheckboxes}}${showCheckboxes ? `\n  checkboxMode="${checkboxMode}"` : ''}
  ...
/>

<!-- clickBehavior options:
  'expand-and-focus' — click selects + expands (default)
  'select'           — click selects, double-click expands
  'expand'           — click expands only, no selection

<!-- checkboxMode options:
  'independent' — each checkbox standalone (default)
  'cascade'     — parent toggles all descendants
-->`}</pre>
		</div>
	</div>

	<!-- Multi-Select -->
	<div class="card">
		<h2>Multi-Select</h2>
		<p class="description">
			Hold <code>Ctrl</code> (or <code>Cmd</code>) and click to toggle individual nodes.
			Hold <code>Shift</code> and click to select a range.
			Enable checkboxes above for a click-friendly multi-select experience.
			The <code>rangeSelectionMode</code> prop controls whether range selection includes collapsed children.
		</p>

		<div class="controls">
			<label>
				Range Selection Mode:
				<select bind:value={rangeSelectionMode}>
					<option value="visual">visual (only visible/expanded nodes)</option>
					<option value="logical">logical (all nodes in tree order)</option>
				</select>
			</label>
			<button class="btn btn-secondary" onclick={() => { multiSelectedPaths = new Set(); selectionLog = []; }}>Clear Selection</button>
		</div>

		<div class="grid-2">
			<div class="tree-container tree-container-tall">
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={3}
					{selectedNodeClass}
					{showCheckboxes}
					{checkboxMode}
					{rangeSelectionMode}
					bind:selectedNode={multiSelectedNode}
					bind:selectedPaths={multiSelectedPaths}
					{onSelectionChange}
					{...getTreeProps()}
				>
					{#snippet nodeTemplate(node: any)}
						<span>{node.data?.icon} {node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
			<div>
				<div class="output">
					<p class="output-label">Selected ({multiSelectedPaths.size} nodes)</p>
					<pre>{multiSelectedPaths.size > 0
	? [...multiSelectedPaths].join(', ')
	: '(none — try Ctrl+click, Shift+click, or checkboxes)'}</pre>
				</div>
				{#if selectionLog.length > 0}
					<div class="output">
						<p class="output-label">Selection Log</p>
						<pre>{selectionLog.join('\n')}</pre>
					</div>
				{/if}
			</div>
		</div>

		<div class="note">
			<p class="note-title">Visual vs Logical</p>
			<p>
				In <strong>visual</strong> mode, Shift+click selects only the nodes you can see between the anchor and the clicked node.
				In <strong>logical</strong> mode, it selects all nodes in depth-first order — including children inside collapsed parents.
			</p>
		</div>

		<div class="code-block">
			<pre>{`<Tree
  showCheckboxes={true}
  rangeSelectionMode="${rangeSelectionMode}"
  bind:selectedPaths={selectedPaths}
  onSelectionChange={(paths, nodes) => { ... }}
  ...
/>`}</pre>
		</div>
	</div>

	<!-- Keyboard Navigation -->
	<div class="card">
		<h2>Keyboard Navigation</h2>
		<p class="description">
			Click a node to focus the tree, then use arrow keys to navigate.
			The tree supports full keyboard control out of the box.
		</p>

		<div class="grid-2">
			<div class="tree-container tree-container-tall">
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={2}
					{selectedNodeClass}
					bind:selectedNode={navSelectedNode}
					onNodeClick={onNavNodeClick}
					{...getTreeProps()}
				>
					{#snippet nodeTemplate(node: any)}
						<span>{node.data?.icon} {node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
			<div>
				<div class="output">
					<p class="output-label">Keyboard Shortcuts</p>
					<pre>&#8593; &#8595;    Navigate between siblings
&#8594;      Expand node / go to first child
&#8592;      Collapse node / go to parent
Enter  Toggle expand/collapse
Space  Toggle expand/collapse
Home   Go to first node
End    Go to last visible node
&#9003;   Collapse and go to parent</pre>
				</div>
				{#if navSelectedNode}
					<div class="output">
						<p class="output-label">Current Node</p>
						<pre>{navSelectedNode.data?.icon} {navSelectedNode.data?.name} ({navSelectedNode.path})</pre>
					</div>
				{/if}
				{#if navLog.length > 0}
					<div class="output">
						<p class="output-label">Navigation Log</p>
						<pre>{navLog.join('\n')}</pre>
					</div>
				{/if}
			</div>
		</div>

		<div class="note">
			<p class="note-title">Custom Navigation</p>
			<p>
				You can override individual navigation methods via the <code>navigationOverrides</code> prop.
				This accepts a partial <code>TreeNavigationOverrides&lt;T&gt;</code> object — override only the methods you need,
				the rest fall back to the default implementation.
			</p>
		</div>

		<div class="code-block">
			<pre>{`<!-- Override specific navigation methods -->
<Tree
  navigationOverrides={{
    navInto: (node) => { /* custom expand behavior */ },
    navOut: (node) => { /* custom collapse behavior */ },
  }}
  ...
/>`}</pre>
		</div>
	</div>

	<footer>
		<p><a href="/">&larr; Back to Examples</a></p>
	</footer>
</div>
