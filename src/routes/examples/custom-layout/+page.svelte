<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import TreeProvider from '$lib/components/TreeProvider.svelte';
	import Node from '$lib/components/Node.svelte';
	import { TreeController } from '$lib/core/TreeController.svelte.js';
	import type { LTreeNode } from '$lib/ltree/types.js';
	import type { DropPosition } from '$lib/ltree/types.js';

	// ── Sample data ────────────────────────────────────────────────────────
	const sampleData = [
		{ id: 1, path: '1', name: 'Documents', icon: '📁', size: '2.4 GB', order: 10 },
		{ id: 2, path: '1.1', name: 'Work', icon: '💼', size: '1.1 GB', order: 10 },
		{ id: 3, path: '1.1.1', name: 'Reports', icon: '📊', size: '340 MB', order: 10 },
		{ id: 4, path: '1.1.2', name: 'Presentations', icon: '📽️', size: '780 MB', order: 20 },
		{ id: 5, path: '1.2', name: 'Personal', icon: '🏠', size: '1.3 GB', order: 20 },
		{ id: 6, path: '1.2.1', name: 'Photos', icon: '📷', size: '950 MB', order: 10 },
		{ id: 7, path: '1.2.2', name: 'Music', icon: '🎵', size: '380 MB', order: 20 },
		{ id: 8, path: '2', name: 'Downloads', icon: '⬇️', size: '5.1 GB', order: 20 },
		{ id: 9, path: '2.1', name: 'Software', icon: '💿', size: '3.2 GB', order: 10 },
		{ id: 10, path: '2.2', name: 'Media', icon: '🎬', size: '1.9 GB', order: 20 },
		{ id: 11, path: '3', name: 'Projects', icon: '🚀', size: '890 MB', order: 30 },
		{ id: 12, path: '3.1', name: 'Web App', icon: '🌐', size: '540 MB', order: 10 },
		{ id: 13, path: '3.1.1', name: 'Frontend', icon: '🎨', size: '210 MB', order: 10 },
		{ id: 14, path: '3.1.2', name: 'Backend', icon: '⚙️', size: '330 MB', order: 20 },
		{ id: 15, path: '3.2', name: 'Mobile App', icon: '📱', size: '350 MB', order: 20 }
	];

	type Item = (typeof sampleData)[0];

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) =>
			(a.data?.name || '').localeCompare(b.data?.name || '')
		);
	}

	function sortByOrder(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) =>
			(a.data?.order ?? 0) - (b.data?.order ?? 0)
		);
	}

	// ── Standard Tree (for comparison) ─────────────────────────────────────
	let selectedStd = $state<LTreeNode<Item> | null>(null);

	// ── Breadcrumb rendering state ─────────────────────────────────────────
	let breadcrumbPath = $state<string[]>([]);
	let breadcrumbSelected = $state<LTreeNode<Item> | null>(null);

	// ── Badge / tag cloud state ────────────────────────────────────────────
	let badgeSelected = $state<string | null>(null);

	// ── Dendrogram state ──────────────────────────────────────────────────
	let dendroExpanded = $state(new Set<string>(['1', '2', '3']));

	function toggleDendro(path: string) {
		const next = new Set(dendroExpanded);
		if (next.has(path)) next.delete(path);
		else next.add(path);
		dendroExpanded = next;
	}

	// Drag-drop log for dendrogram
	let dendroDropLog = $state<string[]>([]);

	function expandAllDendro() {
		dendroExpanded = new Set(sampleData.map(d => d.path));
	}

	function collapseAllDendro() {
		dendroExpanded = new Set<string>();
	}
</script>

<svelte:head>
	<title>Custom Layout - Svelte Treeview</title>
</svelte:head>

<!-- Recursive dendrogram node renderer (with explicit drop zone pills) -->
{#snippet dendroNode(node: LTreeNode<Item>, getChildrenFn: (path: string) => LTreeNode<Item>[], ctrl: TreeController<Item>)}
	{@const depth = Math.min(node.path.split('.').length - 1, 3)}
	{@const isOpen = dendroExpanded.has(node.path)}
	{@const isDragging = ctrl.draggedNode?.path === node.path}
	{@const isDropTarget = ctrl.hoveredNodeForDrop?.path === node.path}
	{@const dropPos = isDropTarget ? ctrl.activeDropPosition : null}
	{@const showZones = isDropTarget && !isDragging}
	<div class="dg-row">
		<div class="dg-node-wrapper"
			ondragover={() => { if (ctrl.isDragInProgress && !isDragging) ctrl.hoveredNodeForDrop = node; }}
			ondragleave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as globalThis.Node)) { ctrl.hoveredNodeForDrop = null; ctrl.activeDropPosition = null; } }}
		>
			{#if showZones}<div class="dg-hitbox"></div>{/if}
			<button
				class="dg-label dg-depth-{depth}"
				class:dg-expandable={node.hasChildren}
				class:dg-dragging={isDragging}
				draggable={true}
				onclick={() => { if (node.hasChildren) toggleDendro(node.path); }}
				ondragstart={(e) => ctrl.startDrag(node, e)}
			>
				<span class="dg-node-icon">{node.data?.icon}</span>
				<span class="dg-node-name">{node.data?.name}</span>
				{#if node.hasChildren}
					<span class="dg-chevron" class:dg-open={isOpen}>&#x25B8;</span>
				{/if}
			</button>
			{#if showZones}
				<div class="dg-zone dg-zone-before"
					ondragover={(e) => { e.preventDefault(); e.stopPropagation(); ctrl.hoveredNodeForDrop = node; ctrl.activeDropPosition = 'before'; }}
					ondrop={(e) => { e.stopPropagation(); ctrl.dropAt(node, 'before', e); }}
					class:dg-zone-active={dropPos === 'before'}
				>Before</div>
				<div class="dg-zone dg-zone-after"
					ondragover={(e) => { e.preventDefault(); e.stopPropagation(); ctrl.hoveredNodeForDrop = node; ctrl.activeDropPosition = 'after'; }}
					ondrop={(e) => { e.stopPropagation(); ctrl.dropAt(node, 'after', e); }}
					class:dg-zone-active={dropPos === 'after'}
				>After</div>
				<div class="dg-zone dg-zone-child"
					ondragover={(e) => { e.preventDefault(); e.stopPropagation(); ctrl.hoveredNodeForDrop = node; ctrl.activeDropPosition = 'child'; }}
					ondrop={(e) => { e.stopPropagation(); ctrl.dropAt(node, 'child', e); }}
					class:dg-zone-active={dropPos === 'child'}
				>Child</div>
			{/if}
		</div>
		{#if node.hasChildren && isOpen}
			<div class="dg-bridge"></div>
			<div class="dg-children">
				{#each getChildrenFn(node.path) as child (child.id)}
					<div class="dg-branch">
						{@render dendroNode(child, getChildrenFn, ctrl)}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

<!-- Recursive vertical dendrogram node renderer (top-to-bottom, with explicit drop zone pills) -->
{#snippet vertDendroNode(node: LTreeNode<Item>, getChildrenFn: (path: string) => LTreeNode<Item>[], ctrl: TreeController<Item>)}
	{@const depth = Math.min(node.path.split('.').length - 1, 3)}
	{@const isOpen = dendroExpanded.has(node.path)}
	{@const isDragging = ctrl.draggedNode?.path === node.path}
	{@const isDropTarget = ctrl.hoveredNodeForDrop?.path === node.path}
	{@const dropPos = isDropTarget ? ctrl.activeDropPosition : null}
	{@const showZones = isDropTarget && !isDragging}
	<div class="vdg-subtree">
		<div class="vdg-node-wrapper"
			ondragover={() => { if (ctrl.isDragInProgress && !isDragging) ctrl.hoveredNodeForDrop = node; }}
			ondragleave={(e) => { if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as globalThis.Node)) { ctrl.hoveredNodeForDrop = null; ctrl.activeDropPosition = null; } }}
		>
			{#if showZones}<div class="vdg-hitbox"></div>{/if}
			<button
				class="vdg-label vdg-depth-{depth}"
				class:vdg-expandable={node.hasChildren}
				class:vdg-dragging={isDragging}
				draggable={true}
				onclick={() => { if (node.hasChildren) toggleDendro(node.path); }}
				ondragstart={(e) => ctrl.startDrag(node, e)}
			>
				<span class="vdg-node-icon">{node.data?.icon}</span>
				<span class="vdg-node-name">{node.data?.name}</span>
				{#if node.hasChildren}
					<span class="vdg-chevron" class:vdg-open={isOpen}>&#x25B8;</span>
				{/if}
			</button>
			{#if showZones}
				<div class="vdg-zone vdg-zone-before"
					ondragover={(e) => { e.preventDefault(); e.stopPropagation(); ctrl.hoveredNodeForDrop = node; ctrl.activeDropPosition = 'before'; }}
					ondrop={(e) => { e.stopPropagation(); ctrl.dropAt(node, 'before', e); }}
					class:vdg-zone-active={dropPos === 'before'}
				>Before</div>
				<div class="vdg-zone vdg-zone-after"
					ondragover={(e) => { e.preventDefault(); e.stopPropagation(); ctrl.hoveredNodeForDrop = node; ctrl.activeDropPosition = 'after'; }}
					ondrop={(e) => { e.stopPropagation(); ctrl.dropAt(node, 'after', e); }}
					class:vdg-zone-active={dropPos === 'after'}
				>After</div>
				<div class="vdg-zone vdg-zone-child"
					ondragover={(e) => { e.preventDefault(); e.stopPropagation(); ctrl.hoveredNodeForDrop = node; ctrl.activeDropPosition = 'child'; }}
					ondrop={(e) => { e.stopPropagation(); ctrl.dropAt(node, 'child', e); }}
					class:vdg-zone-active={dropPos === 'child'}
				>Child</div>
			{/if}
		</div>
		{#if node.hasChildren && isOpen}
			<div class="vdg-stem"></div>
			<div class="vdg-children">
				{#each getChildrenFn(node.path) as child (child.id)}
					<div class="vdg-branch">
						{@render vertDendroNode(child, getChildrenFn, ctrl)}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/snippet}

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>Custom Layout (TreeProvider)</h1>
		<p class="subtitle">
			Build entirely different UIs on the same core TreeController.
			Compare the standard <code>&lt;Tree&gt;</code> with custom layouts using <code>&lt;TreeProvider&gt;</code>.
		</p>
	</header>

	<!-- ================================================================== -->
	<!-- 1. Standard <Tree> for comparison                                  -->
	<!-- ================================================================== -->
	<div class="card">
		<h2>1. Standard &lt;Tree&gt; (reference)</h2>
		<p class="description">
			This is the default <code>&lt;Tree&gt;</code> component rendering. Everything below uses the same
			data but renders it differently via <code>&lt;TreeProvider&gt;</code>.
		</p>
		<div class="tree-container tree-container-tall">
			<Tree
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={3}
				bind:selectedNode={selectedStd}
			>
				{#snippet nodeTemplate(node: any)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
		{#if selectedStd}
			<div class="output">
				<p class="output-label">Selected:</p>
				<p>{selectedStd.data?.icon} {selectedStd.data?.name} &mdash; {selectedStd.path}</p>
			</div>
		{/if}
	</div>

	<!-- ================================================================== -->
	<!-- 2. Flat list / breadcrumb explorer                                 -->
	<!-- ================================================================== -->
	<div class="card">
		<h2>2. Breadcrumb Explorer (custom layout)</h2>
		<p class="description">
			A flat list + breadcrumb navigation built with <code>&lt;TreeProvider&gt;</code>.
			Click a folder to drill in; click breadcrumbs to go back.
			Same data, same core, completely different UI.
		</p>

		<TreeProvider
			data={sampleData}
			idMember="id"
			pathMember="path"
			sortCallback={sortByName}
			isSorted={true}
			expandLevel={99}
		>
			{#snippet children(ctrl: any)}
				{@const currentPath = breadcrumbPath.join('.')}
				{@const parentNode = currentPath ? ctrl.getNodeByPath(currentPath) : null}
				{@const visibleNodes = currentPath
					? ctrl.getChildren(currentPath)
					: ctrl.tree.tree}

				<!-- Breadcrumb bar -->
				<div class="breadcrumb-bar">
					<button
						class="breadcrumb-item"
						class:active={breadcrumbPath.length === 0}
						onclick={() => { breadcrumbPath = []; breadcrumbSelected = null; }}
					>
						Root
					</button>
					{#each breadcrumbPath as segment, i}
						{@const partialPath = breadcrumbPath.slice(0, i + 1).join('.')}
						{@const node = ctrl.getNodeByPath(partialPath)}
						<span class="breadcrumb-sep">/</span>
						<button
							class="breadcrumb-item"
							class:active={i === breadcrumbPath.length - 1}
							onclick={() => {
								breadcrumbPath = breadcrumbPath.slice(0, i + 1);
								breadcrumbSelected = null;
							}}
						>
							{node?.data?.icon} {node?.data?.name}
						</button>
					{/each}
				</div>

				<!-- Flat list of children -->
				<div class="flat-list">
					{#each visibleNodes as node (node.id)}
						<button
							class="flat-item"
							class:selected={breadcrumbSelected?.path === node.path}
							onclick={() => {
								if (node.hasChildren) {
									breadcrumbPath = node.path.split('.');
									breadcrumbSelected = null;
								} else {
									breadcrumbSelected = node;
								}
							}}
						>
							<span class="flat-icon">{node.data?.icon}</span>
							<span class="flat-name">{node.data?.name}</span>
							<span class="flat-meta">{node.data?.size}</span>
							{#if node.hasChildren}
								<span class="flat-arrow">&#x276F;</span>
							{/if}
						</button>
					{:else}
						<div class="flat-empty">No items</div>
					{/each}
				</div>

				{#if breadcrumbSelected}
					<div class="output">
						<p class="output-label">Selected file:</p>
						<p>
							{breadcrumbSelected.data?.icon}
							{breadcrumbSelected.data?.name} &mdash;
							{breadcrumbSelected.data?.size}
							(path: {breadcrumbSelected.path})
						</p>
					</div>
				{/if}
			{/snippet}
		</TreeProvider>
	</div>

	<!-- ================================================================== -->
	<!-- 3. Badge / tag cloud                                               -->
	<!-- ================================================================== -->
	<div class="card">
		<h2>3. Badge Cloud (custom layout)</h2>
		<p class="description">
			All leaf nodes rendered as badges in a tag cloud. Hover shows the full path.
			Built with <code>&lt;TreeProvider&gt;</code> &mdash; the controller's
			<code>tree.visibleFlatNodes</code> provides the flat node list.
		</p>

		<TreeProvider
			data={sampleData}
			idMember="id"
			pathMember="path"
			sortCallback={sortByName}
			isSorted={true}
			expandLevel={99}
		>
			{#snippet children(ctrl: any)}
				{@const leaves = ctrl.tree.visibleFlatNodes.filter((n: any) => !n.hasChildren)}
				<div class="badge-cloud">
					{#each leaves as node (node.id)}
						<button
							class="badge"
							class:badge-active={badgeSelected === node.path}
							title="Path: {node.path}"
							onclick={() => { badgeSelected = node.path; }}
						>
							{node.data?.icon} {node.data?.name}
							<span class="badge-size">{node.data?.size}</span>
						</button>
					{/each}
				</div>

				{#if badgeSelected}
					{@const node = ctrl.getNodeByPath(badgeSelected)}
					{#if node}
						<div class="output">
							<p class="output-label">Selected badge:</p>
							<p>{node.data?.icon} {node.data?.name} &mdash; path: {node.path}, size: {node.data?.size}</p>
						</div>
					{/if}
				{/if}
			{/snippet}
		</TreeProvider>
	</div>

	<!-- ================================================================== -->
	<!-- 4. Controller API demo                                             -->
	<!-- ================================================================== -->
	<div class="card">
		<h2>4. Controller API (programmatic access)</h2>
		<p class="description">
			Demonstrates using the <code>TreeController</code> methods directly:
			<code>expandAll</code>, <code>collapseAll</code>, <code>searchNodes</code>,
			<code>getChildren</code>, and <code>statistics</code>.
		</p>

		<TreeProvider
			data={sampleData}
			idMember="id"
			pathMember="path"
			sortCallback={sortByName}
			isSorted={true}
			expandLevel={2}
			shouldUseInternalSearchIndex={true}
			searchValueMember="name"
		>
			{#snippet children(ctrl: any)}
				{@const stats = ctrl.statistics}
				<div class="api-grid">
					<div class="api-panel">
						<h3>Statistics</h3>
						<ul class="stat-list">
							<li><strong>Total nodes:</strong> {stats?.nodeCount ?? 0}</li>
							<li><strong>Max depth:</strong> {stats?.maxLevel ?? 0}</li>
							<li><strong>Root children:</strong> {ctrl.tree.tree.length}</li>
						</ul>
					</div>

					<div class="api-panel">
						<h3>Actions</h3>
						<div class="api-buttons">
							<button class="btn" onclick={() => ctrl.expandAll()}>Expand All</button>
							<button class="btn" onclick={() => ctrl.collapseAll()}>Collapse All</button>
							<button class="btn" onclick={() => ctrl.expandNodes('3.1')}>Expand 3.1</button>
						</div>
					</div>

					<div class="api-panel">
						<h3>getChildren("1")</h3>
						<ul class="stat-list">
							{#each ctrl.getChildren('1') as child}
								<li>{child.data?.icon} {child.data?.name} ({child.path})</li>
							{/each}
						</ul>
					</div>
				</div>

				<!-- Still render a normal-looking tree using the Node component from context -->
				<div class="tree-container">
					<div class="ltree-container">
						<div class="ltree-tree ltree-flat-mode">
							{#each ctrl.flatNodesToRender as node (node.id + '|' + node.path + '|' + node.hasChildren)}
								<Node
									{node}
									isDraggedNode={false}
									isDragInProgress={false}
									hoveredNodeForDropPath={null}
									activeDropPosition={null}
									dropOperation={'move'}
									flatMode={true}
								>
									{#snippet children(nodeData: any)}
										<span>{nodeData.data?.icon} {nodeData.data?.name}</span>
									{/snippet}
								</Node>
							{/each}
						</div>
					</div>
				</div>
			{/snippet}
		</TreeProvider>
	</div>

	<!-- ================================================================== -->
	<!-- 5. Dendrogram (horizontal tree)                                    -->
	<!-- ================================================================== -->
	<div class="card">
		<h2>5. Dendrogram (horizontal tree with drag-and-drop)</h2>
		<p class="description">
			A horizontal org-chart layout with CSS-drawn connecting lines and <strong>drag-and-drop</strong>
			powered by the controller's public API.
			Drag a node, then hover over another node to see <strong>drop zone pills</strong> appear around it.
			Move onto a zone to select <em>Before</em>, <em>After</em>, or <em>Child</em> position, then drop.
			Click any node with children to expand or collapse.
		</p>

		<TreeProvider
			data={sampleData}
			idMember="id"
			pathMember="path"
			orderMember="order"
			sortCallback={sortByOrder}
			isSorted={true}
			expandLevel={1}
			dragDropMode="self"
			onNodeDrop={(dropNode, draggedNode, position) => {
				const msg = `Moved "${draggedNode.data?.name}" ${position} "${dropNode?.data?.name ?? 'root'}"`;
				dendroDropLog = [msg, ...dendroDropLog.slice(0, 4)];
				// Expand target if dropping as child
				if (position === 'child' && dropNode) {
					dendroExpanded = new Set([...dendroExpanded, dropNode.path]);
				}
			}}
		>
			{#snippet children(ctrl: any)}
				<div class="dg-controls">
					<button class="btn" onclick={() => expandAllDendro()}>Expand All</button>
					<button class="btn secondary" onclick={() => collapseAllDendro()}>Collapse All</button>
				</div>
				<div class="dg-viewport" ondragend={ctrl._onNodeDragEnd}>
					<div class="dg-canvas">
						{#key ctrl.tree.changeTracker}
							{#each ctrl.tree.tree as rootNode (rootNode.id)}
								<div class="dg-root-branch">
									{@render dendroNode(rootNode, (path: string) => ctrl.getChildren(path), ctrl)}
								</div>
							{/each}
						{/key}
					</div>
				</div>
				{#if dendroDropLog.length > 0}
					<div class="output">
						<p class="output-label">Drop log:</p>
						{#each dendroDropLog as entry}
							<p class="drop-log-entry">{entry}</p>
						{/each}
					</div>
				{/if}
			{/snippet}
		</TreeProvider>
	</div>

	<!-- ================================================================== -->
	<!-- 6. Vertical Dendrogram (top to bottom)                             -->
	<!-- ================================================================== -->
	<div class="card">
		<h2>6. Vertical Dendrogram (top to bottom)</h2>
		<p class="description">
			Top-to-bottom org-chart layout with <strong>drag-and-drop</strong>.
			Drag a node, then hover over another node to see <strong>drop zone pills</strong> appear around it.
			Move onto a zone to select <em>Before</em>, <em>After</em>, or <em>Child</em> position, then drop.
		</p>

		<TreeProvider
			data={sampleData}
			idMember="id"
			pathMember="path"
			orderMember="order"
			sortCallback={sortByOrder}
			isSorted={true}
			expandLevel={1}
			dragDropMode="self"
			onNodeDrop={(dropNode, draggedNode, position) => {
				const msg = `Moved "${draggedNode.data?.name}" ${position} "${dropNode?.data?.name ?? 'root'}"`;
				dendroDropLog = [msg, ...dendroDropLog.slice(0, 4)];
				if (position === 'child' && dropNode) {
					dendroExpanded = new Set([...dendroExpanded, dropNode.path]);
				}
			}}
		>
			{#snippet children(ctrl: any)}
				<div class="dg-controls">
					<button class="btn" onclick={() => expandAllDendro()}>Expand All</button>
					<button class="btn secondary" onclick={() => collapseAllDendro()}>Collapse All</button>
				</div>
				<div class="vdg-viewport" ondragend={ctrl._onNodeDragEnd}>
					<!-- Virtual root connecting all top-level nodes -->
					<div class="vdg-subtree">
						<div class="vdg-label vdg-root-label">
							<span class="vdg-node-icon">🗂️</span>
							<span class="vdg-node-name">File System</span>
						</div>
						<div class="vdg-stem"></div>
						<div class="vdg-children">
							{#key ctrl.tree.changeTracker}
								{#each ctrl.tree.tree as rootNode (rootNode.id)}
									<div class="vdg-branch">
										{@render vertDendroNode(rootNode, (path: string) => ctrl.getChildren(path), ctrl)}
									</div>
								{/each}
							{/key}
						</div>
					</div>
				</div>
				{#if dendroDropLog.length > 0}
					<div class="output">
						<p class="output-label">Drop log:</p>
						{#each dendroDropLog as entry}
							<p class="drop-log-entry">{entry}</p>
						{/each}
					</div>
				{/if}
			{/snippet}
		</TreeProvider>
	</div>

	<!-- ================================================================== -->
	<!-- Code hint                                                          -->
	<!-- ================================================================== -->
	<div class="card">
		<h2>How it works</h2>
		<p class="description">
			<code>&lt;TreeProvider&gt;</code> creates a <code>TreeController</code> and provides it
			via a snippet parameter. The controller holds all tree state (expand/collapse, search,
			drag-drop) while you render however you like.
		</p>
		<div class="code-block">
<pre>{`<TreeProvider data={myData} idMember="id" pathMember="path" ...>
  {#snippet children(controller)}
    <!-- controller.tree.tree        → root nodes -->
    <!-- controller.flatNodesToRender → all visible nodes -->
    <!-- controller.getChildren(path) → children of a path -->
    <!-- controller.expandAll()       → expand everything -->

    {#each controller.flatNodesToRender as node}
      <div style="padding-left: {node.level}rem">
        {node.data?.name}
      </div>
    {/each}
  {/snippet}
</TreeProvider>`}</pre>
		</div>
	</div>
</div>

<style>
	/* ── Breadcrumb explorer ─────────────────────────────────────────── */
	.breadcrumb-bar {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.75rem 1rem;
		background: #edf2f7;
		border-radius: 8px;
		margin-bottom: 0.75rem;
		flex-wrap: wrap;
	}
	.breadcrumb-item {
		background: none;
		border: none;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		color: #4a5568;
		transition: background 0.15s;
	}
	.breadcrumb-item:hover {
		background: #e2e8f0;
	}
	.breadcrumb-item.active {
		font-weight: 600;
		color: #2d3748;
		background: white;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}
	.breadcrumb-sep {
		color: #a0aec0;
		font-size: 0.8rem;
	}

	.flat-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.flat-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s;
		text-align: left;
		font-size: 0.95rem;
		width: 100%;
	}
	.flat-item:hover {
		background: #f7fafc;
		border-color: #cbd5e0;
	}
	.flat-item.selected {
		background: #ebf4ff;
		border-color: #667eea;
	}
	.flat-icon {
		font-size: 1.2rem;
		flex-shrink: 0;
	}
	.flat-name {
		flex: 1;
		font-weight: 500;
	}
	.flat-meta {
		color: #718096;
		font-size: 0.85rem;
	}
	.flat-arrow {
		color: #a0aec0;
		font-size: 0.8rem;
	}
	.flat-empty {
		text-align: center;
		padding: 2rem;
		color: #a0aec0;
	}

	/* ── Badge cloud ─────────────────────────────────────────────────── */
	.badge-cloud {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 1rem 0;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 0.85rem;
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 999px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.15s;
	}
	.badge:hover {
		border-color: #667eea;
		box-shadow: 0 2px 4px rgba(102, 126, 234, 0.15);
	}
	.badge-active {
		background: #667eea;
		color: white;
		border-color: #667eea;
	}
	.badge-active .badge-size {
		color: rgba(255, 255, 255, 0.8);
	}
	.badge-size {
		font-size: 0.75rem;
		color: #a0aec0;
	}

	/* ── API grid ────────────────────────────────────────────────────── */
	.api-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.api-panel {
		background: #f7fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 1rem;
	}
	.api-panel h3 {
		font-size: 0.9rem;
		color: #4a5568;
		margin-bottom: 0.5rem;
	}
	.stat-list {
		list-style: none;
		padding: 0;
		margin: 0;
		font-size: 0.9rem;
	}
	.stat-list li {
		padding: 0.25rem 0;
	}
	.api-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	/* ── Dendrogram ─────────────────────────────────────────────────── */
	.dg-controls {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.dg-viewport {
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 1.5rem 2rem;
		overflow-x: auto;
		background:
			radial-gradient(circle, #cbd5e1 0.75px, transparent 0.75px),
			#f8fafc;
		background-size: 20px 20px;
	}

	.dg-canvas {
		display: flex;
		flex-direction: column;
		min-width: fit-content;
	}

	.dg-root-branch + .dg-root-branch {
		margin-top: 0.75rem;
	}

	.dg-row {
		display: flex;
		align-items: flex-start;
	}

	.dg-label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		height: 36px;
		padding: 0 0.75rem;
		background: white;
		border: 1.5px solid #e2e8f0;
		border-left: 3px solid #94a3b8;
		border-radius: 6px;
		font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
		font-size: 0.82rem;
		color: #334155;
		white-space: nowrap;
		cursor: default;
		transition: all 0.15s ease;
		flex-shrink: 0;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}

	.dg-label.dg-expandable {
		cursor: pointer;
	}

	.dg-label.dg-expandable:hover {
		border-color: #94a3b8;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
		transform: translateX(1px);
	}

	.dg-depth-0 { border-left-color: #f59e0b; }
	.dg-depth-1 { border-left-color: #0d9488; }
	.dg-depth-2 { border-left-color: #7c3aed; }
	.dg-depth-3 { border-left-color: #ec4899; }

	.dg-node-icon {
		font-size: 1rem;
		line-height: 1;
	}

	.dg-node-name {
		font-weight: 500;
	}

	.dg-chevron {
		font-size: 0.7rem;
		color: #94a3b8;
		transition: transform 0.2s ease;
		margin-left: 0.15rem;
	}

	.dg-chevron.dg-open {
		transform: rotate(90deg);
	}

	.dg-bridge {
		width: 28px;
		height: 0;
		border-top: 1.5px solid #94a3b8;
		margin-top: 18px;
		flex-shrink: 0;
	}

	.dg-children {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		animation: dg-expand 0.2s ease-out;
	}

	@keyframes dg-expand {
		from { opacity: 0; transform: translateX(-8px); }
		to { opacity: 1; transform: translateX(0); }
	}

	.dg-branch {
		position: relative;
		padding-left: 28px;
	}

	/* Horizontal connector from rail to child node */
	.dg-branch::before {
		content: '';
		position: absolute;
		left: 0;
		top: 18px;
		width: 28px;
		height: 0;
		border-top: 1.5px solid #94a3b8;
		pointer-events: none;
	}

	/* Vertical rail segment — extends into gap above to connect siblings */
	.dg-branch::after {
		content: '';
		position: absolute;
		left: 0;
		top: -0.75rem;
		bottom: 0;
		width: 0;
		border-left: 1.5px solid #94a3b8;
		pointer-events: none;
	}

	/* First child: rail starts at node center */
	.dg-branch:first-child::after {
		top: 18px;
	}

	/* Last child: rail from gap above down to node center */
	.dg-branch:last-child::after {
		top: -0.75rem;
		bottom: auto;
		height: calc(19px + 0.75rem);
	}

	/* Only child: no vertical rail */
	.dg-branch:only-child::after {
		display: none;
	}

	/* ── Dendrogram drag-and-drop ──────────────────────────────────── */
	.dg-label[draggable="true"] {
		cursor: grab;
	}

	.dg-label[draggable="true"]:active {
		cursor: grabbing;
	}

	.dg-dragging {
		opacity: 0.4;
		box-shadow: none !important;
	}

	.dg-node-wrapper {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	/* Invisible expanded hitbox — catches drag events in the gap between button and zones */
	.dg-hitbox {
		position: absolute;
		inset: -28px;
	}

	/* ── Zone pills (horizontal dendrogram) ────────────────────────── */
	.dg-zone {
		position: absolute;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 5px 14px;
		border-radius: 999px;
		white-space: nowrap;
		pointer-events: all;
		cursor: default;
		opacity: 0.85;
		transition: opacity 0.1s, box-shadow 0.1s, transform 0.1s;
		z-index: 21;
		user-select: none;
		animation: dg-zone-in 0.15s ease-out;
	}

	@keyframes dg-zone-in {
		from { opacity: 0; }
		to { opacity: 0.85; }
	}

	.dg-zone-before {
		bottom: calc(100% + 4px);
		left: 50%;
		transform: translateX(-50%);
		background: #bbf7d0;
		color: #14532d;
		border: 2px solid #4ade80;
	}

	.dg-zone-after {
		top: calc(100% + 4px);
		left: 50%;
		transform: translateX(-50%);
		background: #fed7aa;
		color: #7c2d12;
		border: 2px solid #fb923c;
	}

	.dg-zone-child {
		left: calc(100% + 4px);
		top: 50%;
		transform: translateY(-50%);
		background: #ddd6fe;
		color: #4c1d95;
		border: 2px solid #a78bfa;
	}

	.dg-zone-active {
		opacity: 1 !important;
		transform: scale(1.08);
	}

	.dg-zone-before.dg-zone-active {
		transform: translateX(-50%) scale(1.08);
		box-shadow: 0 0 12px rgba(34, 197, 94, 0.6);
	}

	.dg-zone-after.dg-zone-active {
		transform: translateX(-50%) scale(1.08);
		box-shadow: 0 0 12px rgba(249, 115, 22, 0.6);
	}

	.dg-zone-child.dg-zone-active {
		transform: translateY(-50%) scale(1.08);
		box-shadow: 0 0 12px rgba(139, 92, 246, 0.6);
	}

	.drop-log-entry {
		font-size: 0.85rem;
		color: #4a5568;
		padding: 0.15rem 0;
	}

	/* ── Vertical Dendrogram (top-to-bottom) ────────────────────────── */
	.vdg-viewport {
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 2rem;
		overflow: auto;
		background:
			radial-gradient(circle, #cbd5e1 0.75px, transparent 0.75px),
			#f8fafc;
		background-size: 20px 20px;
		display: flex;
		justify-content: center;
	}

	.vdg-subtree {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.vdg-label {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		height: 36px;
		padding: 0 0.75rem;
		background: white;
		border: 1.5px solid #e2e8f0;
		border-top: 3px solid #94a3b8;
		border-radius: 6px;
		font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
		font-size: 0.82rem;
		color: #334155;
		white-space: nowrap;
		cursor: default;
		transition: all 0.15s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}

	.vdg-label.vdg-expandable {
		cursor: pointer;
	}

	.vdg-label.vdg-expandable:hover {
		border-color: #94a3b8;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
		transform: translateY(-1px);
	}

	.vdg-root-label {
		border-top-color: #334155;
		font-weight: 600;
	}

	.vdg-depth-0 { border-top-color: #f59e0b; }
	.vdg-depth-1 { border-top-color: #0d9488; }
	.vdg-depth-2 { border-top-color: #7c3aed; }
	.vdg-depth-3 { border-top-color: #ec4899; }

	.vdg-node-icon {
		font-size: 1rem;
		line-height: 1;
	}

	.vdg-node-name {
		font-weight: 500;
	}

	.vdg-chevron {
		font-size: 0.7rem;
		color: #94a3b8;
		transition: transform 0.2s ease;
		margin-left: 0.15rem;
	}

	.vdg-chevron.vdg-open {
		transform: rotate(90deg);
	}

	.vdg-stem {
		width: 0;
		height: 16px;
		border-left: 1.5px solid #94a3b8;
	}

	.vdg-children {
		display: flex;
		justify-content: center;
		animation: vdg-expand 0.2s ease-out;
	}

	@keyframes vdg-expand {
		from { opacity: 0; transform: translateY(-6px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.vdg-branch {
		position: relative;
		padding: 16px 6px 0;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	/* Horizontal rail segment */
	.vdg-branch::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 0;
		border-top: 1.5px solid #94a3b8;
		pointer-events: none;
	}

	/* Vertical connector from rail down to child node */
	.vdg-branch::after {
		content: '';
		position: absolute;
		top: 0;
		left: 50%;
		height: 16px;
		width: 0;
		border-left: 1.5px solid #94a3b8;
		pointer-events: none;
	}

	/* First child: rail from center to right only */
	.vdg-branch:first-child::before {
		left: 50%;
	}

	/* Last child: rail from left to center only */
	.vdg-branch:last-child::before {
		right: 50%;
	}

	/* Only child: no horizontal rail */
	.vdg-branch:only-child::before {
		display: none;
	}

	/* ── Vertical Dendrogram drag-and-drop ─────────────────────────── */
	.vdg-label[draggable="true"] {
		cursor: grab;
	}

	.vdg-label[draggable="true"]:active {
		cursor: grabbing;
	}

	.vdg-dragging {
		opacity: 0.4;
		box-shadow: none !important;
	}

	.vdg-node-wrapper {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	/* Invisible expanded hitbox — catches drag events in the gap between button and zones */
	.vdg-hitbox {
		position: absolute;
		inset: -28px;
	}

	/* ── Zone pills (vertical dendrogram) ──────────────────────────── */
	.vdg-zone {
		position: absolute;
		font-size: 0.75rem;
		font-weight: 700;
		padding: 5px 14px;
		border-radius: 999px;
		white-space: nowrap;
		pointer-events: all;
		cursor: default;
		opacity: 0.85;
		transition: opacity 0.1s, box-shadow 0.1s, transform 0.1s;
		z-index: 21;
		user-select: none;
		animation: vdg-zone-in 0.15s ease-out;
	}

	@keyframes vdg-zone-in {
		from { opacity: 0; }
		to { opacity: 0.85; }
	}

	/* Before = left of sibling (siblings are horizontal) */
	.vdg-zone-before {
		right: calc(100% + 4px);
		top: 50%;
		transform: translateY(-50%);
		background: #bbf7d0;
		color: #14532d;
		border: 2px solid #4ade80;
	}

	/* After = right of sibling */
	.vdg-zone-after {
		left: calc(100% + 4px);
		top: 50%;
		transform: translateY(-50%);
		background: #fed7aa;
		color: #7c2d12;
		border: 2px solid #fb923c;
	}

	/* Child = below */
	.vdg-zone-child {
		top: calc(100% + 4px);
		left: 50%;
		transform: translateX(-50%);
		background: #ddd6fe;
		color: #4c1d95;
		border: 2px solid #a78bfa;
	}

	.vdg-zone-active {
		opacity: 1 !important;
		transform: scale(1.08);
	}

	.vdg-zone-before.vdg-zone-active {
		transform: translateY(-50%) scale(1.08);
		box-shadow: 0 0 12px rgba(34, 197, 94, 0.6);
	}

	.vdg-zone-after.vdg-zone-active {
		transform: translateY(-50%) scale(1.08);
		box-shadow: 0 0 12px rgba(249, 115, 22, 0.6);
	}

	.vdg-zone-child.vdg-zone-active {
		transform: translateX(-50%) scale(1.08);
		box-shadow: 0 0 12px rgba(139, 92, 246, 0.6);
	}
</style>
