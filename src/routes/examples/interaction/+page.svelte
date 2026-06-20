<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';
	import type { ClickBehavior, CheckboxMode, SelectionMode } from '$lib/ltree/types.js';
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
		{ id: 50, path: '1.1.4', name: 'Invoices', icon: '🧾' },
		{ id: 51, path: '1.1.5', name: 'Contracts', icon: '📜' },
		{ id: 52, path: '1.1.6', name: 'Budgets', icon: '💰' },
		{ id: 53, path: '1.1.7', name: 'Meeting Notes', icon: '📝' },
		{ id: 54, path: '1.1.8', name: 'Templates', icon: '📄' },
		{ id: 6, path: '1.2', name: 'Personal', icon: '🏠' },
		{ id: 7, path: '1.2.1', name: 'Photos', icon: '📷' },
		{ id: 8, path: '1.2.2', name: 'Music', icon: '🎵' },
		{ id: 9, path: '1.2.3', name: 'Videos', icon: '🎬' },
		{ id: 55, path: '1.2.4', name: 'Recipes', icon: '🍳' },
		{ id: 56, path: '1.2.5', name: 'Travel', icon: '✈️' },
		{ id: 57, path: '1.2.6', name: 'Fitness', icon: '🏋️' },
		{ id: 58, path: '1.2.7', name: 'Books', icon: '📚' },
		{ id: 10, path: '2', name: 'Downloads', icon: '⬇️' },
		{ id: 11, path: '2.1', name: 'Software', icon: '💿' },
		{ id: 12, path: '2.2', name: 'Media', icon: '🎞️' },
		{ id: 13, path: '2.3', name: 'Archives', icon: '📦' },
		{ id: 60, path: '2.4', name: 'Documents', icon: '📃' },
		{ id: 61, path: '2.5', name: 'Images', icon: '🖼️' },
		{ id: 62, path: '2.6', name: 'Fonts', icon: '🔤' },
		{ id: 63, path: '2.7', name: 'Plugins', icon: '🔌' },
		{ id: 64, path: '2.8', name: 'Drivers', icon: '🖨️' },
		{ id: 14, path: '3', name: 'Projects', icon: '🚀' },
		{ id: 15, path: '3.1', name: 'Web App', icon: '🌐' },
		{ id: 16, path: '3.1.1', name: 'Frontend', icon: '🎨' },
		{ id: 17, path: '3.1.2', name: 'Backend', icon: '⚙️' },
		{ id: 18, path: '3.1.3', name: 'Tests', icon: '🧪' },
		{ id: 70, path: '3.1.4', name: 'DevOps', icon: '🔧' },
		{ id: 71, path: '3.1.5', name: 'Docs', icon: '📖' },
		{ id: 19, path: '3.2', name: 'Mobile App', icon: '📱' },
		{ id: 20, path: '3.2.1', name: 'iOS', icon: '🍎' },
		{ id: 21, path: '3.2.2', name: 'Android', icon: '🤖' },
		{ id: 72, path: '3.2.3', name: 'Flutter', icon: '🦋' },
		{ id: 73, path: '3.2.4', name: 'React Native', icon: '⚛️' },
		{ id: 74, path: '3.3', name: 'CLI Tools', icon: '⌨️' },
		{ id: 75, path: '3.3.1', name: 'Linter', icon: '🔍' },
		{ id: 76, path: '3.3.2', name: 'Formatter', icon: '✨' },
		{ id: 77, path: '3.3.3', name: 'Bundler', icon: '📦' },
		{ id: 78, path: '3.3.4', name: 'Compiler', icon: '🏗️' }
	];

	type Item = typeof sampleData[0];

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	// ── Persisted settings ───────────────────────────────────────────
	interface Settings {
		clickBehavior: ClickBehavior;
		selectionMode: SelectionMode;
		highlightedNodeClass: string;
		focusedNodeClass: string;
		shouldShowCheckboxes: boolean;
		checkboxMode: CheckboxMode;
		shouldClickToggleCheckbox: boolean;
		rangeSelectionMode: 'visual' | 'logical';
	}

	const defaultSettings: Settings = {
		clickBehavior: 'expand-and-focus',
		// Default this demo to multi so Ctrl/Shift+click work out of the box —
		// the library default is 'single'.
		selectionMode: 'multi',
		highlightedNodeClass: 'stv__node-content--highlight-bold',
		focusedNodeClass: 'demo-focused-outline',
		shouldShowCheckboxes: false,
		checkboxMode: 'independent',
		shouldClickToggleCheckbox: false,
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
				selectionMode,
				highlightedNodeClass,
				focusedNodeClass,
				shouldShowCheckboxes,
				checkboxMode,
				shouldClickToggleCheckbox,
				rangeSelectionMode
			}));
		} catch {}
	}

	const highlightedNodeClassOptions = [
		{ value: 'stv__node-content--highlight-bold', label: 'Bold' },
		{ value: 'stv__node-content--highlight-border', label: 'Border' },
		{ value: 'stv__node-content--highlight-brackets', label: 'Brackets' },
		{ value: 'stv__node-content--highlight-fill', label: 'Highlight (Explorer-style)' }
	];

	// Focused-style options are page-scoped demo classes (see the style block below).
	// In production you'd define your own .my-focused class and pass it via the
	// focusedNodeClass prop — there's no built-in default focus styling.
	const focusedNodeClassOptions = [
		{ value: '', label: 'None (invisible focus)' },
		{ value: 'demo-focused-outline', label: 'Outline (left-border)' },
		{ value: 'demo-focused-underline', label: 'Underline' },
		{ value: 'demo-focused-bg', label: 'Background tint' }
	];

	// ── Click Behavior demo ──────────────────────────────────────────
	let clickBehavior = $state<ClickBehavior>(saved.clickBehavior);
	let selectionMode = $state<SelectionMode>(saved.selectionMode);
	let highlightedNodeClass = $state(saved.highlightedNodeClass);
	let focusedNodeClass = $state(saved.focusedNodeClass);
	let shouldShowCheckboxes = $state(saved.shouldShowCheckboxes);
	let checkboxMode = $state<CheckboxMode>(saved.checkboxMode);
	let shouldClickToggleCheckbox = $state(saved.shouldClickToggleCheckbox);

	// Three-level state
	let focusedNode1 = $state<LTreeNode<Item> | null>(null);
	let highlightedPaths1 = $state(new Set<string>());
	let selectedPaths1 = $state(new Set<string>());

	$effect(() => { clickBehavior; selectionMode; highlightedNodeClass; focusedNodeClass; shouldShowCheckboxes; checkboxMode; shouldClickToggleCheckbox; rangeSelectionMode; saveSettings(); });

	function onClickDemoNodeClick(node: LTreeNode<Item>) {
	}

	// ── Multi-select demo ────────────────────────────────────────────
	let rangeSelectionMode = $state<'visual' | 'logical'>(saved.rangeSelectionMode);
	let focusedNode2 = $state<LTreeNode<Item> | null>(null);
	let highlightedPaths2 = $state(new Set<string>());
	let selectedPaths2 = $state(new Set<string>());

	// ── Keyboard navigation demo ─────────────────────────────────────
	let navFocusedNode = $state<LTreeNode<Item> | null>(null);
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
				Selection Mode:
				<select bind:value={selectionMode}>
					<option value="single">single (Ctrl/Shift+click = plain click)</option>
					<option value="multi">multi (Ctrl-toggle, Shift-range, Shift+Arrow)</option>
				</select>
			</label>
			<label>
				Highlighted Style:
				<select bind:value={highlightedNodeClass}>
					{#each highlightedNodeClassOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</label>
			<label>
				Focused Style:
				<select bind:value={focusedNodeClass}>
					{#each focusedNodeClassOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</label>
			<label>
				<input type="checkbox" bind:checked={shouldShowCheckboxes} />
				Show Checkboxes
			</label>
			{#if shouldShowCheckboxes}
				<label>
					Checkbox Mode:
					<select bind:value={checkboxMode}>
						<option value="independent">independent (each checkbox standalone)</option>
						<option value="cascade">cascade (parent toggles all children)</option>
					</select>
				</label>
				<label>
					<input type="checkbox" bind:checked={shouldClickToggleCheckbox} />
					Click row toggles checkbox
				</label>
			{/if}
			<button class="btn btn-secondary" onclick={() => { highlightedPaths1 = new Set(); selectedPaths1 = new Set(); }}>Clear All</button>
		</div>

		<div class="note">
			<p class="note-title">How the styles stack</p>
			<p>
				<strong>Highlighted Style</strong> applies to every row in <code>highlightedPaths</code>.
				<strong>Focused Style</strong> is <em>additive</em> — it stacks on top of the highlight, only on
				the single row in <code>focusedNode</code>. After a plain click the same row is both highlighted
				and focused, so you'll see both styles on it. After a <kbd>Shift</kbd>+click range, the anchor and
				intermediate rows are highlighted only, while the row you clicked last is highlighted <em>and</em>
				focused. After <kbd>Ctrl</kbd>+click (or Arrow over an unselectable row) the focused row can have
				no highlight at all — that's when Focused Style alone shows.
			</p>
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
					{highlightedNodeClass}
					{focusedNodeClass}
					{clickBehavior}
					{selectionMode}
					{shouldShowCheckboxes}
					{checkboxMode}
					{shouldClickToggleCheckbox}
					bind:focusedNode={focusedNode1}
					bind:highlightedPaths={highlightedPaths1}
					bind:selectedPaths={selectedPaths1}
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
					<p class="output-label">Focused Node</p>
					<pre>{focusedNode1 ? `${focusedNode1.data?.icon} ${focusedNode1.data?.name} (${focusedNode1.path})` : '(none)'}</pre>
				</div>
				<div class="output">
					<p class="output-label">Highlighted ({highlightedPaths1.size})</p>
					<pre>{highlightedPaths1.size > 0 ? [...highlightedPaths1].join(', ') : '(none — try Ctrl+click or Shift+click)'}</pre>
				</div>
				<div class="output">
					<p class="output-label">Selected / Checked ({selectedPaths1.size})</p>
					<pre>{selectedPaths1.size > 0 ? [...selectedPaths1].join(', ') : '(none — use checkboxes)'}</pre>
				</div>
			</div>
		</div>

		<div class="code-block">
			<pre>{`<Tree
  clickBehavior="${clickBehavior}"
  selectionMode="${selectionMode}"
  highlightedNodeClass="${highlightedNodeClass}"${focusedNodeClass ? `\n  focusedNodeClass="${focusedNodeClass}"` : ''}
  shouldShowCheckboxes={${shouldShowCheckboxes}}${shouldShowCheckboxes ? `\n  checkboxMode="${checkboxMode}"` : ''}${shouldShowCheckboxes && shouldClickToggleCheckbox ? `\n  shouldClickToggleCheckbox` : ''}
  ...
/>

<!-- clickBehavior options:
  'expand-and-focus' — click selects + expands (default)
  'select'           — click selects, double-click expands
  'expand'           — click expands only, no selection

<!-- selectionMode options:
  'single' — plain click only; Ctrl/Shift+click degrade to plain click (default)
  'multi'  — Ctrl-toggle, Shift-range, Shift+Arrow extends, Enter toggles

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
			Requires <code>selectionMode="multi"</code> (set above). Then hold <code>Ctrl</code> (or
			<code>Cmd</code>) and click to toggle individual nodes, or hold <code>Shift</code> and
			click to select a range. <code>Shift+ArrowUp/Down</code> extends the range from the
			focused node. <code>Enter</code> toggles the focused node in/out of the highlight set.
			Enable checkboxes for a click-friendly variant. The <code>rangeSelectionMode</code>
			prop controls whether range selection includes collapsed children.
		</p>

		<div class="controls">
			<label>
				Range Selection Mode:
				<select bind:value={rangeSelectionMode}>
					<option value="visual">visual (only visible/expanded nodes)</option>
					<option value="logical">logical (all nodes in tree order)</option>
				</select>
			</label>
			<button class="btn btn-secondary" onclick={() => { highlightedPaths2 = new Set(); selectedPaths2 = new Set(); }}>Clear All</button>
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
					{highlightedNodeClass}
					{focusedNodeClass}
					{selectionMode}
					{shouldShowCheckboxes}
					{checkboxMode}
					{rangeSelectionMode}
					bind:focusedNode={focusedNode2}
					bind:highlightedPaths={highlightedPaths2}
					bind:selectedPaths={selectedPaths2}
					{...getTreeProps()}
				>
					{#snippet nodeTemplate(node: any)}
						<span>{node.data?.icon} {node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
			<div>
				<div class="output">
					<p class="output-label">Focused Node</p>
					<pre>{focusedNode2 ? `${focusedNode2.data?.icon} ${focusedNode2.data?.name} (${focusedNode2.path})` : '(none)'}</pre>
				</div>
				<div class="output">
					<p class="output-label">Highlighted ({highlightedPaths2.size})</p>
					<pre>{highlightedPaths2.size > 0 ? [...highlightedPaths2].join(', ') : '(none — try Ctrl+click or Shift+click)'}</pre>
				</div>
				<div class="output">
					<p class="output-label">Selected / Checked ({selectedPaths2.size})</p>
					<pre>{selectedPaths2.size > 0 ? [...selectedPaths2].join(', ') : '(none — use checkboxes)'}</pre>
				</div>
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
  shouldShowCheckboxes={true}
  rangeSelectionMode="${rangeSelectionMode}"
  bind:highlightedPaths={selectedPaths}
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
					{highlightedNodeClass}
					{focusedNodeClass}
					bind:focusedNode={navFocusedNode}
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
				{#if navFocusedNode}
					<div class="output">
						<p class="output-label">Focused Node</p>
						<pre>{navFocusedNode.data?.icon} {navFocusedNode.data?.name} ({navFocusedNode.path})</pre>
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

<style>
	/* Demo focus styles. The component itself ships no default for the focused
	   row — applications define their own and pass via `focusedNodeClass`.
	   These are :global so they apply to nodes rendered inside <Tree>. */
	:global(.demo-focused-outline) {
		box-shadow: inset 3px 0 0 0 var(--stv-primary, #0d6efd);
	}
	:global(.demo-focused-underline) {
		text-decoration: underline;
		text-decoration-color: var(--stv-primary, #0d6efd);
		text-decoration-thickness: 2px;
		text-underline-offset: 3px;
	}
	:global(.demo-focused-bg) {
		background-color: color-mix(in srgb, var(--stv-primary, #0d6efd) 12%, transparent);
	}
</style>
