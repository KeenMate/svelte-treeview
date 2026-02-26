<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';

	type FileItem = {
		id: number;
		path: string;
		name: string;
		icon: string;
	};

	const sampleData: FileItem[] = [
		{ id: 1, path: '1', name: 'Documents', icon: '📁' },
		{ id: 2, path: '1.1', name: 'Work', icon: '💼' },
		{ id: 3, path: '1.1.1', name: 'Reports', icon: '📊' },
		{ id: 4, path: '1.2', name: 'Personal', icon: '🏠' },
		{ id: 5, path: '2', name: 'Downloads', icon: '⬇️' },
		{ id: 6, path: '2.1', name: 'Software', icon: '💿' }
	];

	function sortByName(items: LTreeNode<FileItem>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}
</script>

<svelte:head>
	<title>Theming Examples - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>🎨 Theming Examples</h1>
		<p class="subtitle">CSS variables, custom styles, and visual customization</p>
	</header>

	<!-- CSS Variables Reference -->
	<div class="card">
		<h2>CSS Variables Reference</h2>
		<p class="description">Override these CSS variables to customize the tree appearance.</p>

		<table>
			<thead>
				<tr>
					<th>Variable</th>
					<th>Default</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td><code>--tree-node-indent-per-level</code></td>
					<td><code>0.5rem</code></td>
					<td>Indentation per nesting level</td>
				</tr>
				<tr>
					<td><code>--ltree-primary</code></td>
					<td><code>#0d6efd</code></td>
					<td>Primary color (selection, highlights)</td>
				</tr>
				<tr>
					<td><code>--ltree-primary-rgb</code></td>
					<td><code>13, 110, 253</code></td>
					<td>Primary color as RGB values</td>
				</tr>
				<tr>
					<td><code>--ltree-success</code></td>
					<td><code>#198754</code></td>
					<td>Success color (valid drop targets)</td>
				</tr>
				<tr>
					<td><code>--ltree-danger</code></td>
					<td><code>#dc3545</code></td>
					<td>Danger color (invalid drops, warnings)</td>
				</tr>
				<tr>
					<td><code>--ltree-light</code></td>
					<td><code>#f8f9fa</code></td>
					<td>Light background color</td>
				</tr>
				<tr>
					<td><code>--ltree-border</code></td>
					<td><code>#dee2e6</code></td>
					<td>Border color</td>
				</tr>
				<tr>
					<td><code>--ltree-body-color</code></td>
					<td><code>#212529</code></td>
					<td>Default text color</td>
				</tr>
				<tr>
					<td><code>--tree-ghost-bg</code></td>
					<td><code>rgba(59, 130, 246, 0.9)</code></td>
					<td>Touch drag ghost background</td>
				</tr>
				<tr>
					<td><code>--tree-ghost-color</code></td>
					<td><code>white</code></td>
					<td>Touch drag ghost text color</td>
				</tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`:root {
  --ltree-primary: #667eea;
  --ltree-primary-rgb: 102, 126, 234;
  --ltree-success: #10b981;
  --ltree-danger: #ef4444;
}`}</pre>
		</div>
	</div>

	<!-- Theme Examples -->
	<div class="card">
		<h2>Theme Examples</h2>
		<p class="description">Different visual themes using CSS variables.</p>

		<div class="grid-2">
			<!-- Default Theme -->
			<div>
				<h3>Default Theme</h3>
				<div class="tree-container">
					<Tree
						data={sampleData}
						idMember="id"
						pathMember="path"
						sortCallback={sortByName}
						isSorted={true}
						expandLevel={3}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.icon} {node.data?.name}</span>
						{/snippet}
					</Tree>
				</div>
			</div>

			<!-- Purple Theme -->
			<div class="purple-theme">
				<h3>Purple Theme</h3>
				<div class="tree-container">
					<Tree
						data={sampleData}
						idMember="id"
						pathMember="path"
						sortCallback={sortByName}
						isSorted={true}
						expandLevel={3}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.icon} {node.data?.name}</span>
						{/snippet}
					</Tree>
				</div>
			</div>
		</div>

		<div class="grid-2" style="margin-top: 2rem;">
			<!-- Dark Theme -->
			<div class="dark-theme">
				<h3 style="color: white;">Dark Theme</h3>
				<div class="tree-container" style="background: #1a1a2e; border-color: #333;">
					<Tree
						data={sampleData}
						idMember="id"
						pathMember="path"
						sortCallback={sortByName}
						isSorted={true}
						expandLevel={3}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.icon} {node.data?.name}</span>
						{/snippet}
					</Tree>
				</div>
			</div>

			<!-- Green Theme -->
			<div class="green-theme">
				<h3>Green Theme</h3>
				<div class="tree-container">
					<Tree
						data={sampleData}
						idMember="id"
						pathMember="path"
						sortCallback={sortByName}
						isSorted={true}
						expandLevel={3}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.icon} {node.data?.name}</span>
						{/snippet}
					</Tree>
				</div>
			</div>
		</div>
	</div>

	<!-- Selection Styles -->
	<div class="card">
		<h2>Selection Styles</h2>
		<p class="description">Built-in classes for styling selected nodes.</p>

		<table>
			<thead>
				<tr>
					<th>Class</th>
					<th>Effect</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td><code>ltree-selected-bold</code></td>
					<td>Bold text with primary color</td>
				</tr>
				<tr>
					<td><code>ltree-selected-border</code></td>
					<td>Border with light background</td>
				</tr>
				<tr>
					<td><code>ltree-selected-brackets</code></td>
					<td>Chevron brackets around content</td>
				</tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`<Tree ...>
  {#snippet nodeTemplate(node: any)}
    <span class:ltree-selected-bold={node.isSelected}>
      {node.data?.name}
    </span>
  {/snippet}
</Tree>`}</pre>
		</div>
	</div>

	<!-- Icon Classes -->
	<div class="card">
		<h2>Expand/Collapse Icons</h2>
		<p class="description">Alternative icon sets for expand/collapse indicators.</p>

		<table>
			<thead>
				<tr>
					<th>Icon Set</th>
					<th>Expand Class</th>
					<th>Collapse Class</th>
					<th>Preview</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td>Default (triangles)</td>
					<td><code>ltree-icon-expand</code></td>
					<td><code>ltree-icon-collapse</code></td>
					<td><span class="ltree-icon-expand"></span> / <span class="ltree-icon-collapse"></span></td>
				</tr>
				<tr>
					<td>Alternative</td>
					<td><code>ltree-icon-expand-alt</code></td>
					<td><code>ltree-icon-collapse-alt</code></td>
					<td><span class="ltree-icon-expand-alt"></span> / <span class="ltree-icon-collapse-alt"></span></td>
				</tr>
				<tr>
					<td>Plus/Minus</td>
					<td><code>ltree-icon-expand-plus</code></td>
					<td><code>ltree-icon-collapse-minus</code></td>
					<td><span class="ltree-icon-expand-plus"></span> / <span class="ltree-icon-collapse-minus"></span></td>
				</tr>
				<tr>
					<td>Arrows</td>
					<td><code>ltree-icon-expand-arrow</code></td>
					<td><code>ltree-icon-collapse-arrow</code></td>
					<td><span class="ltree-icon-expand-arrow"></span> / <span class="ltree-icon-collapse-arrow"></span></td>
				</tr>
			</tbody>
		</table>
	</div>

	<!-- Drag Over Styles -->
	<div class="card">
		<h2>Drag-Over Styles</h2>
		<p class="description">Classes applied when dragging nodes over drop targets.</p>

		<table>
			<thead>
				<tr>
					<th>Class</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td><code>ltree-dragover-highlight</code></td>
					<td>Dashed border with light green background</td>
				</tr>
				<tr>
					<td><code>ltree-dragover-glow</code></td>
					<td>Glowing box-shadow effect</td>
				</tr>
				<tr>
					<td><code>ltree-drag-over</code></td>
					<td>Applied to node content during drag</td>
				</tr>
				<tr>
					<td><code>ltree-drop-valid</code></td>
					<td>Green styling for valid drop target</td>
				</tr>
				<tr>
					<td><code>ltree-drop-invalid</code></td>
					<td>Red styling for invalid drop target</td>
				</tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`/* Customize drag-over appearance */
:global(.ltree-dragover-highlight) {
  background-color: rgba(16, 185, 129, 0.15) !important;
  border: 2px dashed #10b981 !important;
}

:global(.ltree-dragover-glow) {
  box-shadow: 0 0 12px rgba(102, 126, 234, 0.5) !important;
}`}</pre>
		</div>
	</div>

	<!-- Complete Theme Example -->
	<div class="card">
		<h2>Complete Theme Example</h2>
		<p class="description">Copy this CSS to create a custom theme.</p>

		<div class="code-block">
			<pre>{`/* Custom Purple Theme */
.my-custom-theme {
  --ltree-primary: #667eea;
  --ltree-primary-rgb: 102, 126, 234;
  --ltree-success: #10b981;
  --ltree-success-rgb: 16, 185, 129;
  --ltree-danger: #ef4444;
  --ltree-danger-rgb: 239, 68, 68;
  --ltree-light: #f3f4f6;
  --ltree-border: #e5e7eb;
  --ltree-body-color: #1f2937;
  --tree-node-indent-per-level: 1rem;
  --tree-ghost-bg: rgba(102, 126, 234, 0.9);
  --tree-ghost-color: white;
}

/* Apply to container */
.my-custom-theme .ltree-node-content:hover {
  background-color: rgba(102, 126, 234, 0.1);
}

/* Dark mode variant */
.my-dark-theme {
  --ltree-primary: #818cf8;
  --ltree-primary-rgb: 129, 140, 248;
  --ltree-light: #374151;
  --ltree-border: #4b5563;
  --ltree-body-color: #f9fafb;
  background-color: #1f2937;
}`}</pre>
		</div>
	</div>

	<footer>
		<p><a href="/">&larr; Back to Examples</a></p>
	</footer>
</div>

<style>
	/* Purple theme */
	.purple-theme {
		--ltree-primary: #667eea;
		--ltree-primary-rgb: 102, 126, 234;
	}

	.purple-theme :global(.ltree-node-content:hover) {
		background-color: rgba(102, 126, 234, 0.1) !important;
	}

	/* Dark theme */
	.dark-theme {
		--ltree-primary: #818cf8;
		--ltree-primary-rgb: 129, 140, 248;
		--ltree-body-color: #f9fafb;
		--ltree-light: #374151;
		--ltree-border: #4b5563;
		background: #1f2937;
		padding: 1rem;
		border-radius: 8px;
	}

	.dark-theme :global(.ltree-node-content:hover) {
		background-color: rgba(129, 140, 248, 0.2) !important;
	}

	.dark-theme :global(.ltree-toggle-icon) {
		color: #9ca3af !important;
	}

	/* Green theme */
	.green-theme {
		--ltree-primary: #10b981;
		--ltree-primary-rgb: 16, 185, 129;
	}

	.green-theme :global(.ltree-node-content:hover) {
		background-color: rgba(16, 185, 129, 0.1) !important;
	}

	/* Icon preview styles */
	.ltree-icon-expand::before,
	.ltree-icon-collapse::before,
	.ltree-icon-expand-alt::before,
	.ltree-icon-collapse-alt::before,
	.ltree-icon-expand-plus::before,
	.ltree-icon-collapse-minus::before,
	.ltree-icon-expand-arrow::before,
	.ltree-icon-collapse-arrow::before {
		font-size: 14px;
		color: #6b7280;
	}
</style>
