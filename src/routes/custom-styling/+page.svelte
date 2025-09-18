<script lang="ts">
	import { Tree } from '$lib/index.js';
	import ShowcaseSection from '../ShowcaseSection.svelte';

	// Sample data
	const styleData = [
		{ id: '1', path: '1', name: 'Design System', type: 'category', priority: 'high' },
		{ id: '1.1', path: '1.1', name: 'Colors', type: 'section', priority: 'high' },
		{ id: '1.1.1', path: '1.1.1', name: 'Primary Blue #0066CC', type: 'color', priority: 'high' },
		{ id: '1.1.2', path: '1.1.2', name: 'Success Green #28A745', type: 'color', priority: 'medium' },
		{ id: '1.1.3', path: '1.1.3', name: 'Warning Orange #FD7E14', type: 'color', priority: 'medium' },
		{ id: '1.2', path: '1.2', name: 'Typography', type: 'section', priority: 'high' },
		{ id: '1.2.1', path: '1.2.1', name: 'Headings', type: 'element', priority: 'high' },
		{ id: '1.2.2', path: '1.2.2', name: 'Body Text', type: 'element', priority: 'medium' },
		{ id: '1.2.3', path: '1.2.3', name: 'Code Blocks', type: 'element', priority: 'low' },
		{ id: '2', path: '2', name: 'Components', type: 'category', priority: 'medium' },
		{ id: '2.1', path: '2.1', name: 'Buttons', type: 'component', priority: 'high' },
		{ id: '2.2', path: '2.2', name: 'Forms', type: 'component', priority: 'medium' },
		{ id: '2.3', path: '2.3', name: 'Navigation', type: 'component', priority: 'low' }
	];

	// Styling options
	let selectedNodeClass = $state('ltree-selected-bold');
	let expandIconClass = $state('ltree-icon-expand');
	let collapseIconClass = $state('ltree-icon-collapse');
	let leafIconClass = $state('ltree-icon-leaf');
	let scrollHighlightClass = $state('ltree-scroll-highlight');
	let scrollHighlightTimeout = $state(4000);
	let customTheme = $state('default');

	// Available options
	const selectedNodeStyles = [
		{ value: 'ltree-selected-bold', label: 'Bold Primary', description: 'Bold text in primary color' },
		{ value: 'ltree-selected-border', label: 'Border Highlight', description: 'Border and background highlight' },
		{ value: 'ltree-selected-brackets', label: 'Decorative Brackets', description: 'Brackets around text' },
		{ value: 'custom-gradient', label: 'Custom Gradient', description: 'Custom gradient background' }
	];

	const highlightStyles = [
		{ value: 'ltree-scroll-highlight', label: 'Background Glow', description: 'Blue background glow' },
		{ value: 'ltree-scroll-highlight-arrow', label: 'Arrow Indicator', description: 'Red arrow on the left' },
		{ value: 'custom-pulse', label: 'Custom Pulse', description: 'Custom pulse animation' }
	];

	const themes = [
		{ value: 'default', label: 'Default', description: 'Standard tree styling' },
		{ value: 'dark', label: 'Dark Mode', description: 'Dark background theme' },
		{ value: 'minimal', label: 'Minimal', description: 'Clean, minimal styling' },
		{ value: 'colorful', label: 'Colorful', description: 'Vibrant color scheme' }
	];

	// Tree reference for scrollToPath demo
	let treeRef = $state();

	// Scroll to path demo
	async function scrollToPath() {
		if (treeRef) {
			await treeRef.scrollToPath('1.2.3', {
				highlight: true,
				expand: true
			});
		}
	}

	// Sort callback
	const sortCallback = (items) => {
		return items.sort((a, b) => {
			const typeOrder = { category: 0, section: 1, component: 1, element: 2, color: 2 };
			const aOrder = typeOrder[a.data.type] || 3;
			const bOrder = typeOrder[b.data.type] || 3;

			if (aOrder !== bOrder) {
				return aOrder - bOrder;
			}
			return a.data.name.localeCompare(b.data.name);
		});
	};
</script>

<h1>Custom Styling</h1>
<p class="lead">Visual customization, theming options, and CSS class configurations.</p>

	<ShowcaseSection
		title="Selected Node Styles"
		subtitle="Different ways to highlight selected nodes">
		{#snippet demo()}
			<div class="tree-container {customTheme}">
				<Tree
					bind:this={treeRef}
					data={styleData}
					idMember="id"
					pathMember="path"
					displayValueMember="name"
					expandLevel={2}
					selectedNodeClass={selectedNodeClass}
					expandIconClass={expandIconClass}
					collapseIconClass={collapseIconClass}
					leafIconClass={leafIconClass}
					scrollHighlightClass={scrollHighlightClass}
					scrollHighlightTimeout={scrollHighlightTimeout}
					sortCallback={sortCallback}
				>
					{#snippet nodeTemplate(node)}
						<div class="custom-node priority-{node.data.priority}">
							<span class="node-icon">
								{#if node.data.type === 'category'}🏷️
								{:else if node.data.type === 'section'}📂
								{:else if node.data.type === 'component'}🧩
								{:else if node.data.type === 'element'}📄
								{:else if node.data.type === 'color'}🎨
								{:else}📄{/if}
							</span>
							<span class="node-name">{node.data.name}</span>
							<span class="priority-badge badge-{node.data.priority}">{node.data.priority}</span>
						</div>
					{/snippet}
				</Tree>
			</div>
		{/snippet}

		{#snippet controls()}
			<div class="form-group mb-3">
				<label class="form-label">Selected Node Style</label>
				<select class="form-select form-select-sm" bind:value={selectedNodeClass}>
					{#each selectedNodeStyles as style}
						<option value={style.value}>{style.label}</option>
					{/each}
				</select>
				<small class="text-muted">
					{selectedNodeStyles.find(s => s.value === selectedNodeClass)?.description}
				</small>
			</div>

			<div class="form-group mb-3">
				<label class="form-label">Theme</label>
				<select class="form-select form-select-sm" bind:value={customTheme}>
					{#each themes as theme}
						<option value={theme.value}>{theme.label}</option>
					{/each}
				</select>
				<small class="text-muted">
					{themes.find(t => t.value === customTheme)?.description}
				</small>
			</div>

			<div class="form-group mb-3">
				<label class="form-label">Scroll Highlight</label>
				<select class="form-select form-select-sm" bind:value={scrollHighlightClass}>
					{#each highlightStyles as style}
						<option value={style.value}>{style.label}</option>
					{/each}
				</select>
				<small class="text-muted">
					{highlightStyles.find(s => s.value === scrollHighlightClass)?.description}
				</small>
			</div>

			<div class="form-group mb-3">
				<label class="form-label">Highlight Duration (ms)</label>
				<input
					type="number"
					class="form-control form-control-sm"
					bind:value={scrollHighlightTimeout}
					min="1000"
					max="10000"
					step="500"
				/>
			</div>

			<button class="btn btn-primary btn-sm" onclick={scrollToPath}>
				Test Scroll Highlight
			</button>
		{/snippet}

		{#snippet description()}
			<h6>Pre-built Selected Node Classes</h6>
			<p><code>ltree-selected-bold</code> - Bold text with primary color</p>
			<p><code>ltree-selected-border</code> - Border and background highlight</p>
			<p><code>ltree-selected-brackets</code> - Decorative brackets around text</p>

			<h6>Scroll Highlight Effects</h6>
			<p><code>ltree-scroll-highlight</code> - Background glow animation</p>
			<p><code>ltree-scroll-highlight-arrow</code> - Arrow indicator</p>

			<h6>Icon Customization</h6>
			<p>Configure expand, collapse, and leaf icons via CSS classes.</p>

			<h6>Node Templates</h6>
			<p>Use the <code>nodeTemplate</code> snippet for complete custom rendering.</p>
		{/snippet}
	</ShowcaseSection>

	<ShowcaseSection
		title="CSS Variables & Theming"
		subtitle="Customize colors and spacing with CSS custom properties">
		{#snippet demo()}
			<div class="css-variables-demo">
				<h6>Available CSS Variables:</h6>
				<div class="variables-grid">
					<div class="variable-item">
						<code>--tree-node-indent-per-level</code>
						<small>Indentation per level</small>
					</div>
					<div class="variable-item">
						<code>--ltree-primary</code>
						<small>Primary color</small>
					</div>
					<div class="variable-item">
						<code>--ltree-success</code>
						<small>Success color</small>
					</div>
					<div class="variable-item">
						<code>--ltree-danger</code>
						<small>Danger color</small>
					</div>
					<div class="variable-item">
						<code>--ltree-light</code>
						<small>Light background</small>
					</div>
					<div class="variable-item">
						<code>--ltree-border</code>
						<small>Border color</small>
					</div>
				</div>
			</div>
		{/snippet}

		{#snippet controls()}
			<div class="code-example">
				<h6>CSS Variable Override Example:</h6>
				<pre class="bg-dark text-light p-3 rounded small"><code>{`:root {
  --tree-node-indent-per-level: 1rem;
  --ltree-primary: #0066cc;
  --ltree-success: #28a745;
  --ltree-danger: #dc3545;
  --ltree-light: #f8f9fa;
  --ltree-border: #dee2e6;
  --ltree-body-color: #212529;
}

/* Dark theme example */
[data-theme="dark"] {
  --ltree-primary: #66b3ff;
  --ltree-light: #2d3748;
  --ltree-border: #4a5568;
  --ltree-body-color: #e2e8f0;
}`}</code></pre>
			</div>
		{/snippet}

		{#snippet description()}
			<h6>CSS Custom Properties</h6>
			<p>Override default colors and spacing using CSS variables for consistent theming.</p>

			<h6>SCSS Variables</h6>
			<p>When building from SCSS source, override variables before importing library styles.</p>

			<h6>Theme Implementation</h6>
			<p>Use CSS classes or data attributes to implement theme switching.</p>

			<h6>Component-Specific Styling</h6>
			<ul class="small">
				<li><code>.ltree-tree</code> - Main container</li>
				<li><code>.ltree-node</code> - Node wrapper</li>
				<li><code>.ltree-node-content</code> - Content area</li>
				<li><code>.ltree-toggle-icon</code> - Expand/collapse icons</li>
			</ul>
		{/snippet}
	</ShowcaseSection>

<style>
	.tree-container {
		border-radius: 0.5rem;
		padding: 1rem;
		transition: all 0.3s ease;
	}

	.tree-container.default {
		background: #ffffff;
		border: 1px solid #dee2e6;
	}

	.tree-container.dark {
		background: #2d3748;
		border: 1px solid #4a5568;
		color: #e2e8f0;
	}

	.tree-container.minimal {
		background: #fafafa;
		border: none;
		box-shadow: 0 1px 3px rgba(0,0,0,0.1);
	}

	.tree-container.colorful {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border: none;
		color: white;
	}

	.custom-node {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.node-icon {
		font-size: 1rem;
	}

	.node-name {
		flex: 1;
		font-weight: 500;
	}

	.priority-badge {
		font-size: 0.7rem;
		padding: 0.2rem 0.4rem;
		border-radius: 0.3rem;
		text-transform: uppercase;
		font-weight: 600;
	}

	.badge-high {
		background: #dc3545;
		color: white;
	}

	.badge-medium {
		background: #fd7e14;
		color: white;
	}

	.badge-low {
		background: #6c757d;
		color: white;
	}

	.priority-high .node-name {
		font-weight: 600;
	}

	/* Custom selected node style */
	:global(.custom-gradient.ltree-selected) {
		background: linear-gradient(90deg, #667eea, #764ba2);
		color: white;
		border-radius: 0.25rem;
		padding: 0.25rem 0.5rem;
	}

	/* Custom pulse animation */
	:global(.custom-pulse) {
		animation: customPulse 2s infinite;
		background: linear-gradient(45deg, #ff6b6b, #ffd93d);
		border-radius: 0.5rem;
		padding: 0.5rem;
		transform: scale(1.05);
	}

	@keyframes customPulse {
		0%, 100% {
			box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.7);
		}
		50% {
			box-shadow: 0 0 0 10px rgba(255, 107, 107, 0);
		}
	}

	.css-variables-demo {
		background: #f8f9fa;
		border-radius: 0.5rem;
		padding: 1rem;
	}

	.variables-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
		margin-top: 1rem;
	}

	.variable-item {
		background: white;
		padding: 0.75rem;
		border-radius: 0.25rem;
		border: 1px solid #dee2e6;
	}

	.variable-item code {
		display: block;
		font-weight: 600;
		color: #0066cc;
		margin-bottom: 0.25rem;
	}

	.variable-item small {
		color: #6c757d;
	}

	.code-example pre {
		font-size: 0.8rem;
		line-height: 1.4;
		white-space: pre-wrap;
		max-height: 300px;
		overflow-y: auto;
	}

	/* Dark theme styles */
	.dark :global(.ltree-node-content) {
		color: #e2e8f0;
	}

	.dark :global(.ltree-node-content:hover) {
		background-color: rgba(255, 255, 255, 0.1);
	}

	/* Colorful theme styles */
	.colorful :global(.ltree-node-content) {
		color: white;
	}

	.colorful :global(.ltree-selected-bold) {
		color: #ffd93d;
		font-weight: 700;
	}
</style>