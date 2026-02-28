<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types';
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
	let selectedNode = $state<LTreeNode<typeof sampleData[0]> | null>(null);
	let scrollPath = $state('1.2.1');
	let scrollTreeRef: Tree<typeof sampleData[0]>;
	let expandCollapseTreeRef: Tree<typeof sampleData[0]>;
	let clickedNode = $state<string | null>(null);

	function sortByName(items: LTreeNode<typeof sampleData[0]>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	function handleNodeClick(node: LTreeNode<typeof sampleData[0]>) {
		clickedNode = `${node.data?.name} (path: ${node.path})`;
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

		<div class="tree-container" class:tree-container-tall={!getTreeProps().virtualScroll}>
			<Tree
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={2}
				bind:selectedNode
				onNodeClicked={handleNodeClick}
				{...getTreeProps()}
			>
				{#snippet nodeTemplate(node)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
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

	<!-- Expand Level Control -->
	<div class="card">
		<h2>Expand Level Control</h2>
		<p class="description">Control how many levels are expanded by default using the <code>expandLevel</code> prop. Change the value to see the tree re-render with different expansion levels.</p>

		<div class="controls">
			<label>
				Expand Level:
				<input type="number" bind:value={expandLevel} min="0" max="5" style="width: 60px" />
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
					{...getTreeProps()}
				>
					{#snippet nodeTemplate(node)}
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

		<div class="tree-container" class:tree-container-tall={!getTreeProps().virtualScroll}>
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
				{#snippet nodeTemplate(node)}
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

		<div class="tree-container" class:tree-container-tall={!getTreeProps().virtualScroll}>
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
				{#snippet nodeTemplate(node)}
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
