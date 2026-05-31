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
		<p class="description">
			Override these CSS variables to customize the tree appearance. Each one chains to a
			<code>--base-*</code> token shared across other <code>@keenmate/*</code> web components
			(see "Base token integration" below), then falls back to the listed default. Sized
			values are <code>calc(N × var(--ltree-rem))</code> where <code>--ltree-rem</code>
			defaults to <code>10px</code> — change it once to scale everything.
		</p>

		<table>
			<thead>
				<tr>
					<th>Variable</th>
					<th>Default</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr class="section-row"><td colspan="3">Base sizing unit</td></tr>
				<tr><td><code>--ltree-rem</code></td><td><code>10px</code></td><td>Base unit multiplied into every size/spacing value. Set to <code>12px</code> for 20% scale, or to <code>1rem</code> to follow document font-size.</td></tr>

				<tr class="section-row"><td colspan="3">Colors</td></tr>
				<tr><td><code>--ltree-primary</code></td><td><code>var(--base-accent-color, #0d6efd)</code></td><td>Primary color (selection, highlights)</td></tr>
				<tr><td><code>--ltree-primary-rgb</code></td><td><code>var(--base-accent-color-rgb, 13, 110, 253)</code></td><td>Primary color as RGB values</td></tr>
				<tr><td><code>--ltree-success</code></td><td><code>var(--base-success-color, #198754)</code></td><td>Success color (valid drop targets)</td></tr>
				<tr><td><code>--ltree-success-rgb</code></td><td><code>25, 135, 84</code></td><td>Success RGB values</td></tr>
				<tr><td><code>--ltree-danger</code></td><td><code>var(--base-danger-color, #dc3545)</code></td><td>Danger color (invalid drops)</td></tr>
				<tr><td><code>--ltree-danger-rgb</code></td><td><code>220, 53, 69</code></td><td>Danger RGB values</td></tr>
				<tr><td><code>--ltree-light</code></td><td><code>var(--base-main-bg, #f8f9fa)</code></td><td>Light background</td></tr>
				<tr><td><code>--ltree-border</code></td><td><code>var(--base-border-color, #dee2e6)</code></td><td>Border color</td></tr>
				<tr><td><code>--ltree-body-color</code></td><td><code>var(--base-text-color-1, #212529)</code></td><td>Default text color</td></tr>

				<tr class="section-row"><td colspan="3">Typography</td></tr>
				<tr><td><code>--ltree-font-family</code></td><td><code>var(--base-font-family, system stack)</code></td><td>Font family for all tree text</td></tr>
				<tr><td><code>--ltree-node-font-size</code></td><td><code>(--base-font-size-sm, 1.4) × rem</code> (= 14px)</td><td>Node text size</td></tr>
				<tr><td><code>--ltree-node-icon-font-size</code></td><td><code>(--base-font-size-sm, 1.4) × rem</code> (= 14px)</td><td>Per-node icon font size</td></tr>
				<tr><td><code>--ltree-node-icon-margin-right</code></td><td><code>0.6 × rem</code> (= 6px)</td><td>Gap between node icon and label</td></tr>
				<tr><td><code>--ltree-node-label-font-weight</code></td><td><code>var(--base-font-weight-medium, 500)</code></td><td>Label weight</td></tr>
				<tr><td><code>--ltree-node-label-margin-right</code></td><td><code>0.8 × rem</code> (= 8px)</td><td>Gap after node label</td></tr>
				<tr><td><code>--ltree-node-path-font-size</code></td><td><code>(--base-font-size-xs, 1.2) × rem</code> (= 12px)</td><td>Path / debug text size</td></tr>
				<tr><td><code>--ltree-node-path-color</code></td><td><code>var(--base-text-color-3, #6c757d)</code></td><td>Path / muted text color</td></tr>

				<tr class="section-row"><td colspan="3">Node layout</td></tr>
				<tr><td><code>--ltree-node-indent-per-level</code></td><td><code>0.8 × rem</code> (= 8px)</td><td>Indentation per nesting level</td></tr>
				<tr><td><code>--ltree-node-content-padding</code></td><td><code>0.4 × rem / 0.8 × rem</code> (= 4px 8px)</td><td>Inner padding of a node row (V / H)</td></tr>
				<tr><td><code>--ltree-node-content-border-radius</code></td><td><code>(--base-border-radius-sm, 0) × rem</code></td><td>Node row corner rounding</td></tr>
				<tr><td><code>--ltree-node-hover-bg</code></td><td><code>var(--base-hover-bg, #f8f9fa)</code></td><td>Hover background</td></tr>
				<tr><td><code>--ltree-children-margin-top</code></td><td><code>0.2 × rem</code> (= 2px)</td><td>Top margin of child list</td></tr>

				<tr class="section-row"><td colspan="3">Toggle icon</td></tr>
				<tr><td><code>--ltree-toggle-icon-size</code></td><td><code>1.6 × rem</code> (= 16px)</td><td>SVG icon size (chevron / +/- / arrow / leaf)</td></tr>
				<tr><td><code>--ltree-toggle-icon-width</code></td><td><code>2.0 × rem</code> (= 20px)</td><td>Width reserved for the toggle column</td></tr>
				<tr><td><code>--ltree-toggle-icon-color</code></td><td><code>var(--base-text-color-3, #6c757d)</code></td><td>Icon color (via <code>currentColor</code> mask)</td></tr>
				<tr><td><code>--ltree-toggle-icon-margin-right</code></td><td><code>0.8 × rem</code> (= 8px)</td><td>Gap between toggle and node label</td></tr>
				<tr><td><code>--ltree-toggle-icon-transition</code></td><td><code>transform 0.2s</code></td><td>Rotate animation timing (does not scale)</td></tr>

				<tr class="section-row"><td colspan="3">Checkbox</td></tr>
				<tr><td><code>--ltree-checkbox-size</code></td><td><code>1.5 × rem</code> (= 15px)</td><td>Checkbox square dimension</td></tr>
				<tr><td><code>--ltree-checkbox-border-width</code></td><td><code>1.5px</code></td><td>Border thickness (hairline, does not scale)</td></tr>
				<tr><td><code>--ltree-checkbox-border-color</code></td><td><code>var(--base-border-color, #adb5bd)</code></td><td>Unchecked border</td></tr>
				<tr><td><code>--ltree-checkbox-border-radius</code></td><td><code>(--base-border-radius-sm, 0.3) × rem</code> (= 3px)</td><td>Corner rounding</td></tr>
				<tr><td><code>--ltree-checkbox-bg</code></td><td><code>var(--base-input-bg, #fff)</code></td><td>Unchecked background</td></tr>
				<tr><td><code>--ltree-checkbox-checked-bg</code></td><td><code>var(--ltree-primary)</code></td><td>Checked / indeterminate background</td></tr>
				<tr><td><code>--ltree-checkbox-checked-border-color</code></td><td><code>var(--ltree-primary)</code></td><td>Checked / indeterminate border</td></tr>
				<tr><td><code>--ltree-checkbox-checkmark-color</code></td><td><code>var(--base-text-color-on-accent, #fff)</code></td><td>Tick / dash color</td></tr>
				<tr><td><code>--ltree-checkbox-focus-ring</code></td><td><code>0 0 0 2px rgba(primary, 0.25)</code></td><td>Focus-visible box-shadow ring</td></tr>

				<tr class="section-row"><td colspan="3">Selection &amp; highlight states</td></tr>
				<tr><td><code>--ltree-highlight-bg</code></td><td><code>#cce8ff</code></td><td>Explorer-style highlight background</td></tr>
				<tr><td><code>--ltree-highlight-color</code></td><td><code>inherit</code></td><td>Highlight text color</td></tr>
				<tr><td><code>--ltree-multi-selected-bg</code></td><td><code>rgba(primary, 0.08)</code></td><td>Multi-select tint</td></tr>
				<tr><td><code>--ltree-multi-selected-outline</code></td><td><code>rgba(primary, 0.25)</code></td><td>Multi-select outline</td></tr>

				<tr class="section-row"><td colspan="3">Drag / drop states</td></tr>
				<tr><td><code>--ltree-dragover-bg</code></td><td><code>rgba(primary, 0.1)</code></td><td>Drag-over background tint</td></tr>
				<tr><td><code>--ltree-dragover-shadow</code></td><td><code>0 0 8px rgba(primary, 0.4)</code></td><td>Drag-over glow shadow</td></tr>
				<tr><td><code>--ltree-drop-placeholder-bg</code></td><td><code>rgba(primary, 0.1)</code></td><td>Empty-tree placeholder background</td></tr>
				<tr><td><code>--ltree-drop-placeholder-color</code></td><td><code>var(--ltree-primary)</code></td><td>Placeholder text color</td></tr>
				<tr><td><code>--ltree-drop-placeholder-border-radius</code></td><td><code>0.8 × rem</code> (= 8px)</td><td>Placeholder corner rounding</td></tr>
				<tr><td><code>--ltree-drop-placeholder-min-height</code></td><td><code>6.0 × rem</code> (= 60px)</td><td>Placeholder min height</td></tr>
				<tr><td><code>--tree-ghost-bg</code></td><td><code>rgba(59, 130, 246, 0.9)</code></td><td>Touch drag ghost background</td></tr>
				<tr><td><code>--tree-ghost-color</code></td><td><code>#fff</code></td><td>Touch drag ghost text color</td></tr>

				<tr class="section-row"><td colspan="3">Drop zones (pastel mode)</td></tr>
				<tr><td><code>--ltree-drop-zone-border-radius</code></td><td><code>0</code></td><td>Drop zone corner rounding</td></tr>
				<tr><td><code>--ltree-drop-zone-[before|after|child]-bg</code></td><td><code>rgba sage / coral / lavender</code></td><td>Per-zone resting background</td></tr>
				<tr><td><code>--ltree-drop-zone-[before|after|child]-color</code></td><td><code>matching dark variants</code></td><td>Per-zone resting text color</td></tr>
				<tr><td><code>--ltree-drop-zone-[before|after|child]-active-bg</code></td><td><code>~85% opacity variants</code></td><td>Active zone background</td></tr>
				<tr><td><code>--ltree-drop-zone-[before|after|child]-active-color</code></td><td><code>~darker variants</code></td><td>Active zone text color</td></tr>
				<tr><td><code>--ltree-drop-zone-[before|after|child]-active-shadow</code></td><td><code>0 2px 12px (color, 0.4)</code></td><td>Active zone shadow</td></tr>

				<tr class="section-row"><td colspan="3">Drop zones (glow mode)</td></tr>
				<tr><td><code>--ltree-drop-glow-[before|after|child]-color</code></td><td><code>0.8-alpha pastel variants</code></td><td>Glow border color per zone</td></tr>
				<tr><td><code>--ltree-drop-glow-child-bg</code></td><td><code>rgba(167, 155, 198, 0.15)</code></td><td>Glow child zone background tint</td></tr>
				<tr><td><code>--ltree-drop-glow-size</code></td><td><code>3px</code></td><td>Glow border thickness (hairline, does not scale)</td></tr>
				<tr><td><code>--ltree-drop-arrow-size</code></td><td><code>2.4 × rem</code> (= 24px)</td><td>Direction arrow size</td></tr>
				<tr><td><code>--ltree-drop-arrow-position</code></td><td><code>66%</code></td><td>Horizontal arrow position</td></tr>
				<tr><td><code>--ltree-drop-arrow-[before|after|child]-rotation</code></td><td><code>0 / 0 / 45deg</code></td><td>Arrow rotation per zone</td></tr>

				<tr class="section-row"><td colspan="3">Context menu</td></tr>
				<tr><td><code>--ltree-context-menu-bg</code></td><td><code>var(--base-dropdown-bg, #fff)</code></td><td>Menu background</td></tr>
				<tr><td><code>--ltree-context-menu-border-color</code></td><td><code>var(--ltree-border)</code></td><td>Menu border</td></tr>
				<tr><td><code>--ltree-context-menu-border-radius</code></td><td><code>(--base-border-radius-sm, 0.4) × rem</code> (= 4px)</td><td>Menu rounding</td></tr>
				<tr><td><code>--ltree-context-menu-shadow</code></td><td><code>var(--base-dropdown-box-shadow, …)</code></td><td>Menu drop shadow</td></tr>
				<tr><td><code>--ltree-context-menu-min-width</code></td><td><code>15 × rem</code> (= 150px)</td><td>Menu minimum width</td></tr>
				<tr><td><code>--ltree-context-menu-padding</code></td><td><code>0.4 × rem / 0</code></td><td>Menu inner padding</td></tr>
				<tr><td><code>--ltree-context-menu-item-padding</code></td><td><code>0.8 × rem / 1.6 × rem</code> (= 8px 16px)</td><td>Item padding</td></tr>
				<tr><td><code>--ltree-context-menu-item-font-size</code></td><td><code>(--base-font-size-sm, 1.4) × rem</code> (= 14px)</td><td>Item font size</td></tr>
				<tr><td><code>--ltree-context-menu-item-color</code></td><td><code>var(--ltree-body-color)</code></td><td>Item color</td></tr>
				<tr><td><code>--ltree-context-menu-item-hover-bg</code></td><td><code>var(--ltree-light)</code></td><td>Item hover background</td></tr>
				<tr><td><code>--ltree-context-menu-icon-size</code></td><td><code>1.6 × rem</code> (= 16px)</td><td>Icon column width</td></tr>
				<tr><td><code>--ltree-context-menu-icon-font-size</code></td><td><code>(--base-font-size-xs, 1.2) × rem</code> (= 12px)</td><td>Icon font size</td></tr>
				<tr><td><code>--ltree-context-menu-shortcut-color</code></td><td><code>var(--base-text-color-4, #9ca3af)</code></td><td>Shortcut hint color</td></tr>
				<tr><td><code>--ltree-context-menu-shortcut-font-size</code></td><td><code>(--base-font-size-xs, 1.2) × rem</code> (= 12px)</td><td>Shortcut hint size</td></tr>
				<tr><td><code>--ltree-context-menu-arrow-color</code></td><td><code>var(--base-text-color-4, #9ca3af)</code></td><td>Submenu arrow color</td></tr>
				<tr><td><code>--ltree-context-menu-divider-color</code></td><td><code>var(--ltree-border)</code></td><td>Divider line color</td></tr>
				<tr><td><code>--ltree-context-menu-divider-label-color</code></td><td><code>var(--base-text-color-4, #9ca3af)</code></td><td>Named divider label color</td></tr>

				<tr class="section-row"><td colspan="3">Loading + spinner</td></tr>
				<tr><td><code>--ltree-loading-bg</code></td><td><code>rgba(255, 255, 255, 0.8)</code></td><td>Loading overlay background</td></tr>
				<tr><td><code>--ltree-loading-color</code></td><td><code>var(--base-text-color-3, #718096)</code></td><td>"Loading more..." text color</td></tr>
				<tr><td><code>--ltree-spinner-size</code></td><td><code>3.2 × rem</code> (= 32px)</td><td>Spinner diameter</td></tr>
				<tr><td><code>--ltree-spinner-track</code></td><td><code>var(--base-border-color, #e2e8f0)</code></td><td>Spinner track (background ring)</td></tr>
				<tr><td><code>--ltree-spinner-color</code></td><td><code>var(--ltree-primary)</code></td><td>Spinner active color</td></tr>

				<tr class="section-row"><td colspan="3">Scroll highlight (after <code>scrollToPath</code>)</td></tr>
				<tr><td><code>--ltree-scroll-highlight-bg</code></td><td><code>rgba(primary, 0.3)</code></td><td>Highlight background</td></tr>
				<tr><td><code>--ltree-scroll-highlight-shadow</code></td><td><code>0 0 0.5em rgba(primary, 0.4)</code></td><td>Highlight glow</td></tr>
				<tr><td><code>--ltree-scroll-highlight-arrow-color</code></td><td><code>var(--ltree-danger)</code></td><td>Arrow icon color</td></tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`/* Override individual variables */
.my-tree {
  --ltree-primary: #667eea;
  --ltree-primary-rgb: 102, 126, 234;
  --ltree-success: #10b981;
  --ltree-danger: #ef4444;
}

/* Scale everything proportionally with one knob */
.my-bigger-tree {
  --ltree-rem: 12px;   /* 20% larger — all dimensions follow */
}

/* Or scale with document font-size (Pure Admin pattern) */
.my-tree {
  --ltree-rem: 1rem;   /* now respects html { font-size: ... } */
}`}</pre>
		</div>
	</div>

	<!-- Base token integration -->
	<div class="card">
		<h2>Base token integration (<code>--base-*</code>)</h2>
		<p class="description">
			If you're using svelte-treeview alongside other <code>@keenmate/*</code> components
			(<code>web-multiselect</code>, <code>web-daterangepicker</code>, etc.), set the shared
			<code>--base-*</code> tokens once at <code>:root</code> and every component picks them
			up automatically. Each <code>--ltree-*</code> variable resolves to
			<code>--base-{`{token}`}</code> first, then to its hardcoded default.
		</p>

		<div class="code-block">
			<pre>{`/* One theme, every KM component.
   --base-font-size-* and --base-border-radius-* are UNITLESS multipliers
   that the component multiplies by its own --*-rem unit. */
:root {
  /* Colors — direct values */
  --base-accent-color: #10b981;
  --base-accent-color-rgb: 16, 185, 129;
  --base-text-color-1: #111827;
  --base-text-color-3: #6b7280;
  --base-text-color-4: #9ca3af;
  --base-border-color: #e5e7eb;
  --base-hover-bg: #f3f4f6;
  --base-dropdown-bg: #ffffff;

  /* Typography — unitless multipliers (× --ltree-rem) */
  --base-font-family: 'Inter', system-ui, sans-serif;
  --base-font-size-xs: 1.2;       /* 12px at default --ltree-rem: 10px */
  --base-font-size-sm: 1.4;       /* 14px */
  --base-font-weight-medium: 500;

  /* Radii — unitless multipliers (× --ltree-rem) */
  --base-border-radius-sm: 0.4;   /* 4px */
}`}</pre>
		</div>

		<p class="hint">
			<code>--ltree-*</code> overrides on the tree element itself take precedence over
			<code>--base-*</code> tokens, so you can still tweak a single tree without affecting the
			global theme.
		</p>
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

	/* Section header rows in the CSS variable reference table */
	tbody .section-row td {
		background: #f3f4f6;
		font-weight: 600;
		color: #374151;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: 0.78rem;
		padding: 0.6rem 0.75rem;
		border-top: 2px solid #e5e7eb;
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
