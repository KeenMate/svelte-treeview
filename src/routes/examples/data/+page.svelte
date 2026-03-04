<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode, InsertArrayResult } from '$lib/ltree/types.js';
	import RenderModeSwitch from '../RenderModeSwitch.svelte';
	import { getTreeProps } from '../render-mode.svelte.js';

	type FileItem = {
		id: number;
		path: string;
		name: string;
	};

	// Standard dot-separated paths
	const dotSeparatorData: FileItem[] = [
		{ id: 1, path: '1', name: 'Root' },
		{ id: 2, path: '1.1', name: 'Child 1' },
		{ id: 3, path: '1.2', name: 'Child 2' },
		{ id: 4, path: '1.1.1', name: 'Grandchild' }
	];

	// Slash-separated paths (like file paths)
	const slashSeparatorData = [
		{ id: 1, path: 'home', name: '/home' },
		{ id: 2, path: 'home/user', name: '/home/user' },
		{ id: 3, path: 'home/user/documents', name: '/home/user/documents' },
		{ id: 4, path: 'home/user/downloads', name: '/home/user/downloads' },
		{ id: 5, path: 'var', name: '/var' },
		{ id: 6, path: 'var/log', name: '/var/log' }
	];

	// Double-colon separated paths (like namespaces)
	const colonSeparatorData = [
		{ id: 1, path: 'App', name: 'App' },
		{ id: 2, path: 'App::Services', name: 'App::Services' },
		{ id: 3, path: 'App::Services::Auth', name: 'App::Services::Auth' },
		{ id: 4, path: 'App::Models', name: 'App::Models' },
		{ id: 5, path: 'App::Models::User', name: 'App::Models::User' }
	];

	// Data with potential issues (for insert result demo)
	const problematicData: FileItem[] = [
		{ id: 1, path: '1', name: 'Valid Root' },
		{ id: 2, path: '1.1', name: 'Valid Child' },
		{ id: 3, path: '2.1', name: 'Orphan (parent 2 missing)' },
		{ id: 4, path: '1.1', name: 'Duplicate Path' },
		{ id: 5, path: '', name: 'Empty Path' },
		{ id: 6, path: '1.2', name: 'Another Valid Child' }
	];

	let insertResult = $state<InsertArrayResult<FileItem> | null>(null);

	function sortByName(items: LTreeNode<FileItem>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}
</script>

<svelte:head>
	<title>Data Structure Examples - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>📊 Data Structure Examples</h1>
		<p class="subtitle">Path-based hierarchy, custom separators, and validation</p>
		<RenderModeSwitch />
	</header>

	<!-- Path-Based Data Structure -->
	<div class="card">
		<h2>Path-Based Data Structure</h2>
		<p class="description">The tree uses path strings to define hierarchy. Each item needs a unique path that encodes its position in the tree.</p>

		<div class="grid-2">
			<div>
				<h3>Data Structure</h3>
				<div class="code-block">
					<pre>{`// Your data items
const data = [
  { id: 1, path: '1', name: 'Root' },
  { id: 2, path: '1.1', name: 'Child 1' },
  { id: 3, path: '1.2', name: 'Child 2' },
  { id: 4, path: '1.1.1', name: 'Grandchild' }
];

// Tree component
<Tree
  data={data}
  idMember="id"
  pathMember="path"
  sortCallback={sortByName}
/>`}</pre>
				</div>
			</div>

			<div>
				<h3>Result</h3>
				<div class="tree-container">
					<Tree
						data={dotSeparatorData}
						idMember="id"
						pathMember="path"
						sortCallback={sortByName}
						isSorted={true}
						expandLevel={3}
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.name} <code style="font-size: 0.8em;">({node.path})</code></span>
						{/snippet}
					</Tree>
				</div>
			</div>
		</div>

		<div class="note">
			<p class="note-title">How Paths Work</p>
			<ul>
				<li><strong>Path "1"</strong> is a root node</li>
				<li><strong>Path "1.1"</strong> is a child of "1"</li>
				<li><strong>Path "1.1.1"</strong> is a child of "1.1" (grandchild of "1")</li>
				<li>The separator (default ".") splits path into segments</li>
			</ul>
		</div>
	</div>

	<!-- Custom Path Separators -->
	<div class="card">
		<h2>Custom Path Separators</h2>
		<p class="description">Use <code>treePathSeparator</code> to change the path delimiter.</p>

		<div class="grid-2">
			<!-- Slash separator (file paths) -->
			<div>
				<h3>Slash Separator (File Paths)</h3>
				<div class="tree-container">
					<Tree
						data={slashSeparatorData}
						idMember="id"
						pathMember="path"
						sortCallback={sortByName}
						isSorted={true}
						expandLevel={3}
						treePathSeparator="/"
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.name}</span>
						{/snippet}
					</Tree>
				</div>
				<div class="code-block">
					<pre>{`<Tree
  treePathSeparator="/"
  ...
/>`}</pre>
				</div>
			</div>

			<!-- Double-colon separator (namespaces) -->
			<div>
				<h3>Double-Colon Separator (Namespaces)</h3>
				<div class="tree-container">
					<Tree
						data={colonSeparatorData}
						idMember="id"
						pathMember="path"
						sortCallback={sortByName}
						isSorted={true}
						expandLevel={3}
						treePathSeparator="::"
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.name}</span>
						{/snippet}
					</Tree>
				</div>
				<div class="code-block">
					<pre>{`<Tree
  treePathSeparator="::"
  ...
/>`}</pre>
				</div>
			</div>
		</div>
	</div>

	<!-- Required Props -->
	<div class="card">
		<h2>Required Props</h2>
		<p class="description">These props are required for the tree to work.</p>

		<table>
			<thead>
				<tr>
					<th>Prop</th>
					<th>Type</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td><code>data</code></td>
					<td><code>T[]</code></td>
					<td>Array of data items to display in the tree</td>
				</tr>
				<tr>
					<td><code>idMember</code></td>
					<td><code>string</code></td>
					<td>Property name for the unique identifier</td>
				</tr>
				<tr>
					<td><code>pathMember</code></td>
					<td><code>string</code></td>
					<td>Property name for the hierarchy path</td>
				</tr>
				<tr>
					<td><code>sortCallback</code></td>
					<td><code>(items: LTreeNode&lt;T&gt;[]) =&gt; LTreeNode&lt;T&gt;[]</code></td>
					<td>Function to sort sibling nodes</td>
				</tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`// Minimal required props
<Tree
  data={myData}
  idMember="id"
  pathMember="path"
  sortCallback={(items) => [...items].sort((a, b) =>
    (a.data?.name || '').localeCompare(b.data?.name || '')
  )}
/>`}</pre>
		</div>
	</div>

	<!-- Insert Result and Validation -->
	<div class="card">
		<h2>Insert Result and Validation</h2>
		<p class="description">Use the <code>insertResult</code> bindable prop to get information about data insertion, including any failed items.</p>

		<div class="grid-2">
			<div>
				<h3>Problematic Data</h3>
				<div class="code-block">
					<pre>{`const data = [
  { id: 1, path: '1', name: 'Valid Root' },
  { id: 2, path: '1.1', name: 'Valid Child' },
  // Orphan - parent '2' doesn't exist
  { id: 3, path: '2.1', name: 'Orphan' },
  // Duplicate path
  { id: 4, path: '1.1', name: 'Duplicate' },
  // Empty path
  { id: 5, path: '', name: 'Empty Path' },
  { id: 6, path: '1.2', name: 'Valid Child 2' }
];`}</pre>
				</div>
			</div>

			<div>
				<h3>Tree (valid items only)</h3>
				<div class="tree-container">
					<Tree
						data={problematicData}
						idMember="id"
						pathMember="path"
						sortCallback={sortByName}
						isSorted={true}
						expandLevel={3}
						bind:insertResult
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.name}</span>
						{/snippet}
					</Tree>
				</div>
			</div>
		</div>

		{#if insertResult}
			<div class="output">
				<p class="output-label">Insert Result:</p>
				<pre>{JSON.stringify({
					successful: insertResult.successful,
					failed: insertResult.failed.length,
					total: insertResult.total,
					failedDetails: insertResult.failed.map((f: any) => ({
						originalData: f.originalData,
						error: f.error
					}))
				}, null, 2)}</pre>
			</div>
		{/if}

		<div class="code-block">
			<pre>{`${"<"}script>
  let insertResult;
${"<"}/script>

<Tree
  data={data}
  bind:insertResult
  ...
/>

{#if insertResult?.failedNodesCount > 0}
  <p>Failed to insert {insertResult.failedNodesCount} items:</p>
  {#each insertResult.failedNodes as failed}
    <p>{failed.item.name}: {failed.reason}</p>
  {/each}
{/if}`}</pre>
		</div>
	</div>

	<!-- LTreeNode Interface -->
	<div class="card">
		<h2>LTreeNode Interface</h2>
		<p class="description">Each node in the tree has these properties.</p>

		<table>
			<thead>
				<tr>
					<th>Property</th>
					<th>Type</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td><code>path</code></td>
					<td><code>string</code></td>
					<td>The full path of the node</td>
				</tr>
				<tr>
					<td><code>pathSegment</code></td>
					<td><code>string</code></td>
					<td>The last segment of the path</td>
				</tr>
				<tr>
					<td><code>parentPath</code></td>
					<td><code>string | null</code></td>
					<td>The parent's path (null for root nodes)</td>
				</tr>
				<tr>
					<td><code>level</code></td>
					<td><code>number | null</code></td>
					<td>Nesting depth (1 for root, 2 for children, etc.)</td>
				</tr>
				<tr>
					<td><code>data</code></td>
					<td><code>T | null</code></td>
					<td>Your original data item</td>
				</tr>
				<tr>
					<td><code>children</code></td>
					<td><code>Record&lt;string, LTreeNode&lt;T&gt;&gt;</code></td>
					<td>Child nodes (keyed by path segment)</td>
				</tr>
				<tr>
					<td><code>isExpanded</code></td>
					<td><code>boolean</code></td>
					<td>Whether children are visible</td>
				</tr>
				<tr>
					<td><code>isSelected</code></td>
					<td><code>boolean</code></td>
					<td>Whether this node is selected</td>
				</tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`// Accessing node properties in nodeContent snippet
{#snippet nodeTemplate(node: any)}
  <span>
    {node.data?.name}
    <small>Level: {node.level}, Path: {node.path}</small>
    {#if node.isSelected}
      <strong>(Selected)</strong>
    {/if}
  </span>
{/snippet}`}</pre>
		</div>
	</div>

	<!-- Best Practices -->
	<div class="card">
		<h2>Best Practices</h2>
		<p class="description">Tips for working with tree data.</p>

		<div class="note">
			<p class="note-title">Data Preparation</p>
			<ul>
				<li>Ensure all items have unique <code>id</code> values</li>
				<li>Ensure all items have unique <code>path</code> values</li>
				<li>Parent nodes should be included before children (or order doesn't matter for flat arrays)</li>
				<li>Avoid empty or null paths</li>
				<li>Choose a path separator that doesn't appear in your segment values</li>
			</ul>
		</div>

		<div class="note" style="margin-top: 1rem;">
			<p class="note-title">Performance Tips</p>
			<ul>
				<li>For large datasets, consider pagination or lazy loading</li>
				<li>Use <code>expandLevel</code> to limit initial expansion</li>
				<li>Enable search indexing only when needed (<code>shouldUseInternalSearchIndex</code>)</li>
				<li>Avoid recreating the data array on every render</li>
			</ul>
		</div>
	</div>

	<footer>
		<p><a href="/">&larr; Back to Examples</a></p>
	</footer>
</div>
