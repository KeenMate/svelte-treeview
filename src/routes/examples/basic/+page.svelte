<script lang="ts">
	import { tick } from 'svelte';
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';
	import type { NodeRef } from '$lib/index.js';
	import RenderModeSwitch from '../RenderModeSwitch.svelte';
	import { getTreeProps } from '../render-mode.svelte.js';

	// Sample hierarchical data
	const sampleData = [
		{ id: 1, path: '1', name: 'Documents', icon: '📁' },
		{ id: 2, path: '1.1', name: 'Work', icon: '💼' },
		{ id: 3, path: '1.1.1', name: 'Reports', icon: '📊' },
		{ id: 4, path: '1.1.2', name: 'Presentations', icon: '📽️' },
		{ id: 5, path: '1.2', name: 'Personal', icon: '🏠' },
		{ id: 6, path: '1.2.1', name: 'Photos', icon: '📷' },
		{ id: 7, path: '1.2.2', name: 'Music', icon: '🎵' },
		{ id: 8, path: '2', name: 'Downloads', icon: '⬇️' },
		{ id: 9, path: '2.1', name: 'Software', icon: '💿' },
		{ id: 10, path: '2.2', name: 'Media', icon: '🎬' },
		{ id: 11, path: '3', name: 'Projects', icon: '🚀' },
		{ id: 12, path: '3.1', name: 'Web App', icon: '🌐' },
		{ id: 13, path: '3.1.1', name: 'Frontend', icon: '🎨' },
		{ id: 14, path: '3.1.2', name: 'Backend', icon: '⚙️' },
		{ id: 15, path: '3.2', name: 'Mobile App', icon: '📱' }
	];

	// State for demos
	let expandLevel = $state(2);
	let isAccordionExpand = $state(false);
	let selectedNode = $state<LTreeNode<typeof sampleData[0]> | null>(null);
	let scrollPath = $state('1.2.1');
	let scrollTreeRef: Tree<typeof sampleData[0]>;
	let expandCollapseTreeRef: Tree<typeof sampleData[0]>;
	let clickedNode = $state<string | null>(null);

	// Indentation demo: --stv-node-indent-per-level is the only knob. It's declared
	// ON .stv__container (the tree root), so a value must be set there — an ancestor
	// wrapper is shadowed by the tree's own declaration. The buttons swap a class
	// (indent-condensed/compact/generous) whose CSS rule targets .stv__container.
	const indentPresets = { condensed: '0.35rem', compact: '0.8rem', generous: '1.75rem' } as const;
	type IndentPreset = keyof typeof indentPresets;
	let indentPreset = $state<IndentPreset>('compact');

	// Live readout of the spacing-related CSS variables. They're declared on
	// .stv__container, so we read the *resolved px* off the real tree elements
	// (reading them from anywhere else would report the wrong value).
	let simpleTreeWrap = $state<HTMLDivElement | null>(null);
	let cssReadout = $state<{ name: string; value: string }[]>([]);

	function measureSpacing(retries = 10) {
		const container = simpleTreeWrap?.querySelector('.stv__container');
		const toggle = container?.querySelector('.stv__toggle-icon') as HTMLElement | null;
		const content = container?.querySelector('.stv__node-content') as HTMLElement | null;
		if (!container || !toggle || !content) {
			// Tree nodes may not be in the DOM yet on first paint — retry briefly.
			if (retries > 0) requestAnimationFrame(() => measureSpacing(retries - 1));
			return;
		}

		const ts = getComputedStyle(toggle);
		const cs = getComputedStyle(content);

		// Per-level indent = difference in margin-left between a level-1 and level-2 node.
		const n1 = container.querySelector('.stv__node[data-tree-path="1"]') as HTMLElement | null;
		const n2 = container.querySelector('.stv__node[data-tree-path="1.1"]') as HTMLElement | null;
		const indentPx =
			n1 && n2
				? `${parseFloat(getComputedStyle(n2).marginLeft) - parseFloat(getComputedStyle(n1).marginLeft)}px`
				: indentPresets[indentPreset];

		cssReadout = [
			{ name: '--stv-node-indent-per-level', value: indentPx },
			{ name: '--stv-toggle-icon-size', value: ts.fontSize },
			{ name: '--stv-toggle-icon-width', value: ts.width },
			{ name: '--stv-toggle-icon-margin-right', value: ts.marginRight },
			{ name: '--stv-node-content-padding (left)', value: cs.paddingLeft }
		];
	}

	$effect(() => {
		indentPreset; // re-measure when the preset changes
		tick().then(() => measureSpacing());
	});

	function sortByName(items: LTreeNode<typeof sampleData[0]>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	function handleNodeClick({ node, path }: NodeRef<typeof sampleData[0]>) {
		clickedNode = `${node?.data?.name} (path: ${path})`;
	}

	function scrollToPath() {
		scrollTreeRef?.scrollToPath(scrollPath, { scrollOptions: { behavior: 'smooth', block: 'center' } });
	}
</script>

<svelte:head>
	<title>Basic Examples - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>🌲 Basic Examples</h1>
		<p class="subtitle">Tree rendering, expand/collapse, and node selection</p>
		<RenderModeSwitch />
	</header>

	<!-- Simple Tree -->
	<div class="card">
		<h2>Simple Tree</h2>
		<p class="description">A basic tree with hierarchical data. Click nodes to select them.</p>

		<div class="controls">
			<span class="controls-label">Indentation:</span>
			<button
				class="btn {indentPreset === 'condensed' ? '' : 'btn-secondary'}"
				onclick={() => (indentPreset = 'condensed')}
			>Condensed</button>
			<button
				class="btn {indentPreset === 'compact' ? '' : 'btn-secondary'}"
				onclick={() => (indentPreset = 'compact')}
			>Compact</button>
			<button
				class="btn {indentPreset === 'generous' ? '' : 'btn-secondary'}"
				onclick={() => (indentPreset = 'generous')}
			>Generous</button>
		</div>

		<div class="css-readout">
			{#each cssReadout as v (v.name)}
				<code><span class="css-readout-name">{v.name}</span>: <span class="css-readout-value">{v.value}</span></code>
			{/each}
		</div>

		<div class="tree-container tree-container-tall indent-{indentPreset}" bind:this={simpleTreeWrap}>
			<Tree
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={2}
				bind:focusedNode={selectedNode}
				onNodeClick={handleNodeClick}
				{...getTreeProps()}
			>
				{#snippet nodeTemplate(node: any)}
					<!-- "Work" (1.1) and "Reports" (1.1.1) intentionally have no icon to show label alignment for icon-less nodes -->
					<span>{#if node.path !== '1.1' && node.path !== '1.1.1'}{node.data?.icon} {/if}{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>

		<div class="note">
			<p class="note-title">Adjusting indentation</p>
			<p>Indent width is a single CSS variable — <code>--stv-node-indent-per-level</code> (default <code>0.8rem</code>). There's no prop for it. It's declared <em>on</em> the tree's root element (<code>.stv__container</code>), so you must set your value there too — a value on an ancestor wrapper is shadowed by the tree's own declaration. Just target <code>.stv__container</code> in your CSS:</p>
			<div class="code-block">
				<pre>{`/* one instance — scope by a wrapper class */
.my-tree .stv__container { --stv-node-indent-per-level: ${indentPresets[indentPreset]}; }

/* every tree on the page */
.stv__container { --stv-node-indent-per-level: ${indentPresets[indentPreset]}; }`}</pre>
			</div>
			<p>The buttons above swap a wrapper class (<code>indent-{indentPreset}</code>) whose rule sets the variable on the nested <code>.stv__container</code>.</p>
		</div>

		{#if selectedNode}
			<div class="output">
				<p class="output-label">Selected Node:</p>
				<pre>{JSON.stringify({ path: selectedNode.path, name: selectedNode.data?.name }, null, 2)}</pre>
			</div>
		{/if}

		{#if clickedNode}
			<div class="output">
				<p class="output-label">Last Clicked:</p>
				<pre>{clickedNode}</pre>
			</div>
		{/if}
	</div>

	<!-- Expand Controls -->
	<div class="card">
		<h2>Expand Controls</h2>
		<p class="description">Control how many levels are expanded by default using the <code>expandLevel</code> prop. Enable <code>isAccordionExpand</code> to auto-collapse siblings when a node is expanded.</p>

		<div class="controls">
			<label>
				Expand Level:
				<input type="number" bind:value={expandLevel} min="0" max="5" style="width: 60px" />
			</label>
			<label>
				<input type="checkbox" bind:checked={isAccordionExpand} />
				Accordion Expand
			</label>
		</div>

		<div class="tree-container">
			{#key expandLevel}
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					{expandLevel}
					{isAccordionExpand}
					{...getTreeProps()}
				>
					{#snippet nodeTemplate(node: any)}
						<span>{node.data?.icon} {node.data?.name} <code style="font-size: 0.8em; color: #718096;">({node.path})</code></span>
					{/snippet}
				</Tree>
			{/key}
		</div>

		<div class="code-block">
			<pre>{`<Tree
  data={sampleData}
  idMember="id"
  pathMember="path"
  sortCallback={sortByName}
  expandLevel={${expandLevel}}
  isAccordionExpand={${isAccordionExpand}}
/>`}</pre>
		</div>
	</div>

	<!-- Scroll to Path -->
	<div class="card">
		<h2>Scroll to Path</h2>
		<p class="description">Use <code>scrollToPath()</code> to programmatically scroll to and highlight a specific node. Enter a path from the tree below.</p>

		<div class="controls">
			<input type="text" bind:value={scrollPath} placeholder="Enter path (e.g., 1.2.1)" />
			<button class="btn" onclick={scrollToPath}>Scroll to Path</button>
		</div>

		<div class="tree-container tree-container-tall">
			<Tree
				bind:this={scrollTreeRef}
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={3}
				{...getTreeProps()}
			>
				{#snippet nodeTemplate(node: any)}
					<span>{node.data?.icon} {node.data?.name} <code style="font-size: 0.8em; color: #718096;">({node.path})</code></span>
				{/snippet}
			</Tree>
		</div>

		<div class="note">
			<p class="note-title">Note</p>
			<p>The <code>scrollToPath()</code> method accepts scroll options like <code>behavior</code> and <code>block</code> for smooth scrolling and positioning.</p>
		</div>
	</div>

	<!-- Programmatic Expand/Collapse -->
	<div class="card">
		<h2>Programmatic Expand/Collapse</h2>
		<p class="description">Use <code>expandAll()</code>, <code>collapseAll()</code>, <code>expandNodes(path)</code>, and <code>collapseNodes(path)</code> to control the tree programmatically.</p>

		<div class="controls">
			<button class="btn" onclick={() => expandCollapseTreeRef?.expandAll()}>Expand All</button>
			<button class="btn btn-secondary" onclick={() => expandCollapseTreeRef?.collapseAll()}>Collapse All</button>
			<button class="btn" onclick={() => expandCollapseTreeRef?.expandNodes('1')}>Expand "Documents" (1)</button>
			<button class="btn btn-secondary" onclick={() => expandCollapseTreeRef?.collapseNodes('1')}>Collapse "Documents" (1)</button>
		</div>

		<div class="tree-container tree-container-tall">
			<Tree
				bind:this={expandCollapseTreeRef}
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={1}
				{...getTreeProps()}
			>
				{#snippet nodeTemplate(node: any)}
					<span>{node.data?.icon} {node.data?.name} <code style="font-size: 0.8em; color: #718096;">({node.path})</code></span>
				{/snippet}
			</Tree>
		</div>

		<div class="code-block">
			<pre>{`// Get tree reference
let treeRef: Tree;

// Expand/collapse methods
treeRef.expandAll();
treeRef.collapseAll();
treeRef.expandNodes('1');      // Expand specific path
treeRef.collapseNodes('1');    // Collapse specific path`}</pre>
		</div>
	</div>

	<footer>
		<p><a href="/">&larr; Back to Examples</a></p>
	</footer>
</div>

<style>
	.controls-label {
		font-weight: 600;
		color: #4a5568;
		margin-right: 0.25rem;
	}

	.css-readout {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0.75rem 0 1rem;
	}

	.css-readout code {
		font-size: 0.8em;
		background: #f7fafc;
		border: 1px solid #e2e8f0;
		border-radius: 4px;
		padding: 0.15rem 0.5rem;
	}

	.css-readout-name {
		color: #718096;
	}

	.css-readout-value {
		color: #2b6cb0;
		font-weight: 600;
	}

	/* The variable is declared on .stv__container, so the override must target it
	   directly — setting it on the .tree-container wrapper alone would be shadowed. */
	:global(.indent-condensed .stv__container) {
		--stv-node-indent-per-level: 0.35rem;
	}
	:global(.indent-compact .stv__container) {
		--stv-node-indent-per-level: 0.8rem;
	}
	:global(.indent-generous .stv__container) {
		--stv-node-indent-per-level: 1.75rem;
	}
</style>
