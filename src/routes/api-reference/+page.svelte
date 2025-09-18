<script lang="ts">
	let activeTab = $state(0);

	const examples = [
		{
			title: "Basic Tree Setup",
			description: "Minimal configuration with just the required properties. Shows a simple file/folder structure with custom sorting by name.",
			code: `<Tree
  data={treeData}
  idMember="id"
  pathMember="path"
  sortCallback={(nodes) => nodes.sort((a, b) =>
    a.data.name.localeCompare(b.data.name)
  )}
>
  {#snippet nodeTemplate(node)}
    {node.data.name}
  {/snippet}
</Tree>`
		},
		{
			title: "With Search & Events",
			description: "Interactive tree with search filtering and drag-and-drop functionality. Demonstrates two-way data binding and event handling.",
			code: `<Tree
  data={treeData}
  idMember="id"
  pathMember="path"
  bind:searchText
  bind:selectedNode
  onNodeClicked={(node) => console.log('Clicked:', node.data)}
  onNodeDrop={(drop, dragged) => handleMove(dragged, drop)}
>
  {#snippet nodeTemplate(node)}
    📁 {node.data.name}
  {/snippet}
</Tree>`
		},
		{
			title: "With Custom Templates",
			description: "Advanced templating with header/footer snippets and custom node rendering. Shows how to add toolbars and handle empty states.",
			code: `<Tree data={treeData} idMember="id" pathMember="path">
  {#snippet treeHeader()}
    <div class="tree-toolbar">
      <button onclick={() => tree.expandAll()}>Expand All</button>
      <button onclick={() => tree.collapseAll()}>Collapse All</button>
    </div>
  {/snippet}

  {#snippet nodeTemplate(node)}
    <div class="custom-node">
      <span class="icon">{node.data.icon}</span>
      <span class="name">{node.data.name}</span>
      <span class="count">({node.data.count})</span>
    </div>
  {/snippet}

  {#snippet noDataFound()}
    <div class="empty-state">No data available</div>
  {/snippet}
</Tree>`
		},
		{
			title: "Real-World Organization Tree",
			description: "Enterprise-grade configuration with custom field mappings for existing data structures. Shows advanced styling, conditional search, and component reference binding for programmatic control.",
			code: `<Tree
  bind:this={treeElement}
  data={treeData}
  treeId="organization-tree"
  idMember="organizationTreeNodeId"
  levelMember="level"
  pathMember="nodePath"
  parentPathMember="parentNodePath"
  hasChildrenMember="hasChildren"
  displayValueMember="organizationTitle"
  searchValueMember="organizationTitle"
  onNodeClicked={onTreeNodeClick}
  shouldToggleOnNodeClick={false}
  shouldUseInternalSearchIndex={true}
  shouldDisplayDebugInformation={false}
  expandLevel={2}
  isSorted={true}
  selectedNodeClass="ltree-selected-brackets"
  scrollHighlightTimeout={2000}
  scrollHighlightClass="ltree-scroll-highlight-arrow"
  searchText={searchType === "filter" && searchText}
/>`
		}
	];
</script>

<h1>Tree Component API Reference</h1>
<p class="description">
	Complete reference for all properties, methods, events, and templates available in the svelte-treeview component.
</p>

	<section class="api-section">
		<h2>Properties</h2>
		<div class="api-table-container">
			<table class="api-table">
				<thead>
					<tr>
						<th>Property</th>
						<th>Description</th>
						<th>Type / Options</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>data</code> <span class="required">*</span></td>
						<td>Array of data objects to display in the tree</td>
						<td><code>T[]</code></td>
					</tr>
					<tr>
						<td><code>idMember</code> <span class="required">*</span></td>
						<td>Property name for unique identifier in data objects</td>
						<td><code>string</code></td>
					</tr>
					<tr>
						<td><code>pathMember</code> <span class="required">*</span></td>
						<td>Property name for hierarchical path (e.g., "1.2.3")</td>
						<td><code>string</code></td>
					</tr>
					<tr>
						<td><code>sortCallback</code> <span class="required">*</span></td>
						<td>Function to sort nodes at each level</td>
						<td><code>(items: LTreeNode&lt;T&gt;[]) => LTreeNode&lt;T&gt;[]</code></td>
					</tr>
					<tr>
						<td><code>searchText</code></td>
						<td>Text to filter/search nodes (bindable)</td>
						<td><code>string</code></td>
					</tr>
					<tr>
						<td><code>selectedNode</code></td>
						<td>Currently selected node (bindable)</td>
						<td><code>LTreeNode&lt;T&gt; | null</code></td>
					</tr>
					<tr>
						<td><code>insertResult</code></td>
						<td>Result of data insertion with failed nodes info (bindable)</td>
						<td><code>InsertArrayResult&lt;T&gt;</code></td>
					</tr>
					<tr>
						<td><code>expandLevel</code></td>
						<td>Default expansion depth for tree nodes</td>
						<td><code>number</code> (default: 2)</td>
					</tr>
					<tr>
						<td><code>treePathSeparator</code></td>
						<td>Character used to separate path segments</td>
						<td><code>string</code> (default: ".")</td>
					</tr>
					<tr>
						<td><code>shouldUseInternalSearchIndex</code></td>
						<td>Enable internal search indexing for performance</td>
						<td><code>boolean</code> (default: true)</td>
					</tr>
					<tr>
						<td><code>shouldDisplayDebugInformation</code></td>
						<td>Show debug information panel</td>
						<td><code>boolean</code> (default: false)</td>
					</tr>
					<tr>
						<td><code>shouldToggleOnNodeClick</code></td>
						<td>Toggle node expansion on click</td>
						<td><code>boolean</code> (default: true)</td>
					</tr>
					<tr>
						<td><code>displayValueMember</code></td>
						<td>Property name for display text</td>
						<td><code>string</code></td>
					</tr>
					<tr>
						<td><code>getDisplayValueCallback</code></td>
						<td>Function to get display text from node</td>
						<td><code>(node: LTreeNode&lt;T&gt;) => string</code></td>
					</tr>
					<tr>
						<td><code>searchValueMember</code></td>
						<td>Property name for search text</td>
						<td><code>string</code></td>
					</tr>
					<tr>
						<td><code>getSearchValueCallback</code></td>
						<td>Function to get searchable text from node</td>
						<td><code>(node: LTreeNode&lt;T&gt;) => string</code></td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<section class="api-section">
		<h2>Methods</h2>
		<div class="api-table-container">
			<table class="api-table">
				<thead>
					<tr>
						<th>Method</th>
						<th>Description</th>
						<th>Parameters / Return Type</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>expandNodes(path)</code></td>
						<td>Expand all nodes up to the specified path</td>
						<td><code>path: string</code> → <code>Promise&lt;void&gt;</code></td>
					</tr>
					<tr>
						<td><code>collapseNodes(path)</code></td>
						<td>Collapse the node at the specified path</td>
						<td><code>path: string</code> → <code>Promise&lt;void&gt;</code></td>
					</tr>
					<tr>
						<td><code>expandAll(path?)</code></td>
						<td>Expand all nodes, optionally from a specific path</td>
						<td><code>path?: string</code> → <code>void</code></td>
					</tr>
					<tr>
						<td><code>collapseAll(path?)</code></td>
						<td>Collapse all nodes, optionally from a specific path</td>
						<td><code>path?: string</code> → <code>void</code></td>
					</tr>
					<tr>
						<td><code>searchNodes(text, options?)</code></td>
						<td>Search nodes using internal index and return matches</td>
						<td><code>text: string, options?: SearchOptions</code> → <code>LTreeNode&lt;T&gt;[]</code></td>
					</tr>
					<tr>
						<td><code>filterNodes(text, options?)</code></td>
						<td>Filter the tree display based on search text</td>
						<td><code>text: string, options?: SearchOptions</code> → <code>void</code></td>
					</tr>
					<tr>
						<td><code>scrollToPath(path, options?)</code></td>
						<td>Scroll to and optionally highlight a specific node</td>
						<td><code>path: string, options?: ScrollToOptions</code> → <code>Promise&lt;boolean&gt;</code></td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<section class="api-section">
		<h2>Events</h2>
		<div class="api-table-container">
			<table class="api-table">
				<thead>
					<tr>
						<th>Event</th>
						<th>Description</th>
						<th>Callback Signature</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>onNodeClicked</code></td>
						<td>Fired when a node is clicked</td>
						<td><code>(node: LTreeNode&lt;T&gt;) => void</code></td>
					</tr>
					<tr>
						<td><code>onNodeDragStart</code></td>
						<td>Fired when drag operation starts on a node</td>
						<td><code>(node: LTreeNode&lt;T&gt;, event: DragEvent) => void</code></td>
					</tr>
					<tr>
						<td><code>onNodeDragOver</code></td>
						<td>Fired when dragging over a node</td>
						<td><code>(node: LTreeNode&lt;T&gt;, event: DragEvent) => void</code></td>
					</tr>
					<tr>
						<td><code>onNodeDrop</code></td>
						<td>Fired when a node is dropped onto another node</td>
						<td><code>(dropNode: LTreeNode&lt;T&gt;, draggedNode: LTreeNode&lt;T&gt;, event: DragEvent) => void</code></td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<section class="api-section">
		<h2>Templates (Snippets)</h2>
		<div class="api-table-container">
			<table class="api-table">
				<thead>
					<tr>
						<th>Template</th>
						<th>Description</th>
						<th>Parameters</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>nodeTemplate</code></td>
						<td>Custom template for rendering individual tree nodes</td>
						<td><code>node: LTreeNode&lt;T&gt;</code></td>
					</tr>
					<tr>
						<td><code>treeHeader</code></td>
						<td>Content displayed above the tree</td>
						<td>None</td>
					</tr>
					<tr>
						<td><code>treeBody</code></td>
						<td>Wrapper around the entire tree structure</td>
						<td>Tree content</td>
					</tr>
					<tr>
						<td><code>treeFooter</code></td>
						<td>Content displayed below the tree</td>
						<td>None</td>
					</tr>
					<tr>
						<td><code>noDataFound</code></td>
						<td>Content shown when tree has no data or filtered results</td>
						<td>None</td>
					</tr>
					<tr>
						<td><code>contextMenu</code></td>
						<td>Custom context menu template for right-click</td>
						<td><code>node: LTreeNode&lt;T&gt;, closeMenu: () => void</code></td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>

	<section class="api-section">
		<h2>Usage Examples</h2>
		<div class="tabs-container">
			<div class="tabs-nav">
				{#each examples as example, index}
					<button
						class="tab-button"
						class:active={activeTab === index}
						onclick={() => activeTab = index}
					>
						{example.title}
					</button>
				{/each}
			</div>

			<div class="tabs-content">
				{#each examples as example, index}
					<div class="tab-pane" class:active={activeTab === index}>
						<p class="example-description">{example.description}</p>
						<pre class="code-example"><code>{example.code}</code></pre>
					</div>
				{/each}
			</div>
		</div>
	</section>

<style>
	h1 {
		color: #333;
		margin-bottom: 0.5rem;
	}

	.description {
		color: #666;
		margin-bottom: 2rem;
		font-size: 1.1rem;
	}

	/* API Sections */
	.api-section {
		margin-bottom: 3rem;
	}

	.api-section h2 {
		color: #333;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid #e0e0e0;
	}

	/* API Tables */
	.api-table-container {
		overflow-x: auto;
		margin: 1rem 0;
		border-radius: 8px;
		border: 1px solid #e0e0e0;
		background: #fff;
	}

	.api-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9rem;
	}

	.api-table th {
		background: #f5f5f5;
		border: 1px solid #e0e0e0;
		padding: 1rem;
		text-align: left;
		font-weight: 600;
		color: #333;
		white-space: nowrap;
	}

	.api-table td {
		border: 1px solid #e0e0e0;
		padding: 1rem;
		vertical-align: top;
		line-height: 1.5;
	}

	.api-table tr:nth-child(even) {
		background: #fafafa;
	}

	.api-table tr:hover {
		background: #f0f7ff;
	}

	.api-table code {
		background: #f3f4f6;
		color: #1976d2;
		padding: 0.2rem 0.4rem;
		border-radius: 4px;
		font-family: 'Courier New', Monaco, monospace;
		font-size: 0.85rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.api-table .required {
		color: #dc2626;
		font-weight: bold;
		font-size: 0.8rem;
	}

	/* Tabs */
	.tabs-container {
		margin-top: 1rem;
	}

	.tabs-nav {
		display: flex;
		flex-wrap: wrap;
		border-bottom: 2px solid #e0e0e0;
		margin-bottom: 0;
	}

	.tab-button {
		background: none;
		border: none;
		padding: 1rem 1.5rem;
		cursor: pointer;
		font-size: 0.9rem;
		color: #666;
		border-bottom: 3px solid transparent;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.tab-button:hover {
		background: #f8f9fa;
		color: #333;
	}

	.tab-button.active {
		color: #1976d2;
		border-bottom-color: #1976d2;
		background: #f8f9fa;
	}

	.tabs-content {
		position: relative;
	}

	.tab-pane {
		display: none;
	}

	.tab-pane.active {
		display: block;
	}

	.example-description {
		background: #f8f9fa;
		border: 1px solid #e9ecef;
		border-radius: 6px 6px 0 0;
		padding: 1rem 1.5rem;
		margin: 0 0 -1px 0;
		color: #495057;
		font-size: 0.9rem;
		line-height: 1.5;
	}

	.code-example {
		background: #2d2d2d;
		color: #f8f8f2;
		padding: 1.5rem;
		overflow-x: auto;
		margin: 0;
		font-size: 0.85rem;
		line-height: 1.6;
		border-radius: 0 0 6px 6px;
	}

	.code-example code {
		font-family: 'Courier New', Monaco, monospace;
		background: none;
		color: inherit;
		padding: 0;
	}

	/* Responsive Design */
	@media (max-width: 1024px) {
		.api-table {
			font-size: 0.8rem;
		}

		.api-table th,
		.api-table td {
			padding: 0.75rem;
		}

		.tabs-nav {
			flex-direction: column;
		}

		.tab-button {
			text-align: left;
			border-bottom: 1px solid #e0e0e0;
		}

		.tab-button.active {
			border-bottom-color: #1976d2;
		}
	}

	@media (max-width: 768px) {
		.api-table-container {
			font-size: 0.75rem;
		}

		.api-table th,
		.api-table td {
			padding: 0.5rem;
		}

		.api-table code {
			font-size: 0.75rem;
			padding: 0.1rem 0.2rem;
		}

		.tabs-nav {
			flex-direction: column;
		}

		.tab-button {
			text-align: left;
			border-bottom: 1px solid #e0e0e0;
		}

		.tab-button.active {
			border-bottom-color: #1976d2;
		}

	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.api-table-container {
			background: #1a1a1a;
			border-color: #333;
		}

		.api-table th {
			background: #2d2d2d;
			color: #e5e5e5;
			border-color: #444;
		}

		.api-table td {
			border-color: #444;
			color: #d1d5db;
		}

		.api-table tr:nth-child(even) {
			background: #1f1f1f;
		}

		.api-table tr:hover {
			background: #2a2a2a;
		}

		.api-table code {
			background: #374151;
			color: #60a5fa;
		}

		.tabs-nav {
			border-bottom-color: #444;
		}

		.tab-button {
			color: #d1d5db;
		}

		.tab-button:hover {
			background: #2a2a2a;
			color: #e5e5e5;
		}

		.tab-button.active {
			background: #2a2a2a;
			color: #60a5fa;
			border-bottom-color: #60a5fa;
		}

		.example-description {
			background: #2d2d2d;
			border-color: #444;
			color: #d1d5db;
		}
	}
</style>