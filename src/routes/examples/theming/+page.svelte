<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';
	import RenderModeSwitch from '../RenderModeSwitch.svelte';
	import { getTreeProps } from '../render-mode.svelte.js';

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

	// Toggle icon demo state
	const iconSets = {
		default: { expand: 'ltree-icon-expand', collapse: 'ltree-icon-collapse', label: 'Chevron' },
		alt: { expand: 'ltree-icon-expand-alt', collapse: 'ltree-icon-collapse-alt', label: 'Filled triangle' },
		plusminus: { expand: 'ltree-icon-expand-plus', collapse: 'ltree-icon-collapse-minus', label: 'Plus / Minus' },
		arrows: { expand: 'ltree-icon-expand-arrow', collapse: 'ltree-icon-collapse-arrow', label: 'Arrows' }
	} as const;
	type IconSetKey = keyof typeof iconSets;

	let iconSet = $state<IconSetKey>('default');
	let toggleIconMode = $state<'rotate' | 'swap'>('rotate');
	const activeIcons = $derived(iconSets[iconSet]);
</script>

<svelte:head>
	<title>Theming Examples - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>🎨 Theming Examples</h1>
		<p class="subtitle">CSS variables, custom styles, and visual customization</p>
		<RenderModeSwitch />
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
					<td><code>--ltree-toggle-icon-size</code></td>
					<td><code>16px</code></td>
					<td>Toggle icon (chevron / +/- / arrow) size — scales the built-in SVG icons</td>
				</tr>
				<tr>
					<td><code>--ltree-toggle-icon-width</code></td>
					<td><code>20px</code></td>
					<td>Width reserved for the toggle column</td>
				</tr>
				<tr>
					<td><code>--ltree-toggle-icon-color</code></td>
					<td><code>#6c757d</code></td>
					<td>Toggle icon color (uses <code>currentColor</code> via mask)</td>
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
						{...getTreeProps()}
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
						{...getTreeProps()}
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
						{...getTreeProps()}
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
						{...getTreeProps()}
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

	<!-- Toggle Icon Live Demo -->
	<div class="card">
		<h2>Toggle Icon — Live Demo</h2>
		<p class="description">
			Customize the expand/collapse toggle via four props:
			<code>expandIconClass</code>, <code>collapseIconClass</code>, <code>leafIconClass</code>,
			and <code>toggleIconMode</code> (<code>'rotate'</code> or <code>'swap'</code>).
		</p>

		<div class="toggle-demo">
			<div class="toggle-controls">
				<fieldset>
					<legend>Icon set</legend>
					{#each Object.entries(iconSets) as [key, set] (key)}
						<label class="radio-row">
							<input
								type="radio"
								name="icon-set"
								value={key}
								checked={iconSet === key}
								onchange={() => (iconSet = key as IconSetKey)}
							/>
							<span class="preview"
								><span class={set.expand}></span> / <span class={set.collapse}></span></span
							>
							<span>{set.label}</span>
						</label>
					{/each}
				</fieldset>

				<fieldset>
					<legend>toggleIconMode</legend>
					<label class="radio-row">
						<input
							type="radio"
							name="toggle-mode"
							value="rotate"
							checked={toggleIconMode === 'rotate'}
							onchange={() => (toggleIconMode = 'rotate')}
						/>
						<span><code>rotate</code> — rotate expand icon 90°</span>
					</label>
					<label class="radio-row">
						<input
							type="radio"
							name="toggle-mode"
							value="swap"
							checked={toggleIconMode === 'swap'}
							onchange={() => (toggleIconMode = 'swap')}
						/>
						<span><code>swap</code> — swap expand ↔ collapse class</span>
					</label>
				</fieldset>
			</div>

			<div class="tree-container toggle-demo-tree">
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={3}
					expandIconClass={activeIcons.expand}
					collapseIconClass={activeIcons.collapse}
					{toggleIconMode}
					{...getTreeProps()}
				>
					{#snippet nodeTemplate(node: any)}
						<span>{node.data?.icon} {node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
		</div>

		<div class="code-block">
			<pre>{`<Tree
  ...
  expandIconClass="${activeIcons.expand}"
  collapseIconClass="${activeIcons.collapse}"
  toggleIconMode="${toggleIconMode}"
/>`}</pre>
		</div>

		<p class="hint">
			Tip: <code>rotate</code> works best with chevron/arrow sets where the same glyph
			points in two directions. <code>swap</code> is required for sets where expand and
			collapse use visually different glyphs (plus/minus). All built-in icons are
			Lucide SVGs rendered via <code>mask-image</code>, so they inherit
			<code>currentColor</code> from the surrounding text.
		</p>
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

	/* Toggle icon live demo */
	.toggle-demo {
		display: grid;
		grid-template-columns: minmax(220px, 320px) 1fr;
		gap: 1.5rem;
		align-items: start;
	}

	.toggle-demo-tree {
		min-height: 220px;
	}

	.toggle-controls fieldset {
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 0.75rem 1rem 0.9rem;
		margin: 0 0 1rem;
	}

	.toggle-controls legend {
		padding: 0 0.4rem;
		font-weight: 600;
		font-size: 0.85rem;
		color: #374151;
	}

	.toggle-controls .radio-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.15rem 0;
		font-size: 0.9rem;
		cursor: pointer;
	}

	.toggle-controls .preview {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		min-width: 2.5rem;
		color: #6b7280;
	}

	.hint {
		margin-top: 0.75rem;
		font-size: 0.85rem;
		color: #6b7280;
	}

	@media (max-width: 720px) {
		.toggle-demo {
			grid-template-columns: 1fr;
		}
	}

	/* Lucide SVG icons — applied via mask-image so currentColor still works */
	:global(.demo-lucide-expand::before),
	:global(.demo-lucide-collapse::before),
	:global(.demo-lucide-leaf::before) {
		content: '';
		display: inline-block;
		width: 1em;
		height: 1em;
		background-color: currentColor;
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-position: center;
		mask-position: center;
		-webkit-mask-size: contain;
		mask-size: contain;
		vertical-align: -0.15em;
	}

	:global(.demo-lucide-expand::before) {
		-webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m9 18 6-6-6-6'/></svg>");
		mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m9 18 6-6-6-6'/></svg>");
	}

	:global(.demo-lucide-collapse::before) {
		-webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>");
		mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>");
	}

	:global(.demo-lucide-leaf::before) {
		-webkit-mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z'/><path d='M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'/></svg>");
		mask-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z'/><path d='M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'/></svg>");
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
