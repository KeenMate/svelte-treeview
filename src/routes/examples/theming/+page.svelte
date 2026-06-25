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
		default: { expand: 'stv__toggle-icon--expand', collapse: 'stv__toggle-icon--collapse', label: 'Chevron' },
		alt: { expand: 'stv__toggle-icon--expand-alt', collapse: 'stv__toggle-icon--collapse-alt', label: 'Filled triangle' },
		plusminus: { expand: 'stv__toggle-icon--expand-plus', collapse: 'stv__toggle-icon--collapse-minus', label: 'Plus / Minus' },
		arrows: { expand: 'stv__toggle-icon--expand-arrow', collapse: 'stv__toggle-icon--collapse-arrow', label: 'Arrows' }
	} as const;
	type IconSetKey = keyof typeof iconSets;

	let iconSet = $state<IconSetKey>('default');
	let toggleIconMode = $state<'rotate' | 'swap'>('rotate');
	const activeIcons = $derived(iconSets[iconSet]);

	// ---- Dark Mode Playground state -----------------------------------------
	type PageScheme = 'normal' | 'light dark' | 'dark' | 'light';
	type AncestorSignal = 'none' | 'data-theme-dark' | 'data-bs-theme-dark' | 'dark-class' | 'data-theme-light';
	type InstanceTheme = 'none' | 'dark' | 'light';
	type BrandTheme = 'default' | 'material' | 'neon' | 'sharp' | 'soft' | 'glass' | 'forest';

	let pageScheme = $state<PageScheme>('normal');
	let ancestorSignal = $state<AncestorSignal>('none');
	let instanceTheme = $state<InstanceTheme>('none');
	let brandTheme = $state<BrandTheme>('default');
	// Pre-highlight a node so the accent (multi-select bg + outline, both derived
	// from --stv-primary via color-mix) is visible at rest — otherwise switching
	// brand themes only changes interaction states the user has to trigger.
	let playgroundHighlight = $state<Set<string>>(new Set(['1.1']));

	// User-driven INPUT: sets color-scheme on <html> via the page-scheme radio.
	// This is the consumer side of the contract (a hand-rolled theme toggle would
	// do the same). It is NOT detection — CSS resolves everything from here on.
	$effect(() => {
		if (typeof document === 'undefined') return;
		const html = document.documentElement;
		const prev = html.style.colorScheme;
		html.style.colorScheme = pageScheme === 'normal' ? '' : pageScheme;
		return () => { html.style.colorScheme = prev; };
	});

	// Brand theme is applied as a class on the playground wrapper. Because the
	// library now declares its --stv-* variables on .stv__container (not on
	// :root), setting --base-* on the wrapper correctly re-tints the descendant
	// .stv__container — no document-level hackery needed.

	const wrapperClass = $derived(ancestorSignal === 'dark-class' ? 'dark' : '');
	const wrapperDataTheme = $derived(
		ancestorSignal === 'data-theme-dark' ? 'dark'
		: ancestorSignal === 'data-theme-light' ? 'light'
		: undefined
	);
	const wrapperBsTheme = $derived(ancestorSignal === 'data-bs-theme-dark' ? 'dark' : undefined);
	const treeTheme = $derived<'dark' | 'light' | undefined>(
		instanceTheme === 'dark' ? 'dark' : instanceTheme === 'light' ? 'light' : undefined
	);

	const winningSignal = $derived.by(() => {
		if (instanceTheme !== 'none') return `Per-instance: <Tree theme="${instanceTheme}" />`;
		if (ancestorSignal !== 'none') {
			if (ancestorSignal === 'dark-class') return 'Ancestor class: .dark (Tailwind)';
			if (ancestorSignal === 'data-theme-dark') return 'Ancestor attr: [data-theme="dark"]';
			if (ancestorSignal === 'data-theme-light') return 'Ancestor attr: [data-theme="light"]';
			if (ancestorSignal === 'data-bs-theme-dark') return 'Ancestor attr: [data-bs-theme="dark"] (Bootstrap)';
		}
		if (pageScheme === 'dark') return 'Page color-scheme: dark (light-dark() resolves to dark branch)';
		if (pageScheme === 'light') return 'Page color-scheme: light';
		if (pageScheme === 'light dark') return 'Page color-scheme: light dark (follows OS preference via light-dark())';
		return 'No signal active — hardcoded light defaults';
	});

	// ---- Dynamic Theme Switching (bottom-of-page picker) --------------------
	// Mirrors web-daterangepicker's examples-theming.html "Dynamic Theme Switching"
	// section: one demo tree, a row of color-coded buttons that hot-swap the
	// brand theme class, plus a dark/light toggle for the per-instance theme prop.
	let dynamicBrand = $state<BrandTheme>('default');
	let dynamicMode = $state<'inherit' | 'dark' | 'light'>('inherit');
	const dynamicTreeTheme = $derived<'dark' | 'light' | undefined>(
		dynamicMode === 'dark' ? 'dark' : dynamicMode === 'light' ? 'light' : undefined
	);
	let dynamicHighlight = $state<Set<string>>(new Set(['1.1']));
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

	<!-- Dark mode playground (interactive control panel) -->
	<div class="card">
		<h2>Dark Mode Playground</h2>
		<p class="description">
			Toggle each signal independently and watch the demo tree react. The
			"winning signal" line shows which input the CSS is actually responding to
			based on the precedence order from <code>color-scheme.md</code>.
			OS <code>prefers-color-scheme</code> can't be controlled from JavaScript —
			flip your OS or browser dev-tools setting to test that path.
		</p>

		<div class="playground-controls">
			<fieldset>
				<legend>1. Page <code>color-scheme</code> (applied to <code>&lt;html&gt;</code>)</legend>
				<label><input type="radio" bind:group={pageScheme} value="normal" /> none</label>
				<label><input type="radio" bind:group={pageScheme} value="light dark" /> <code>light dark</code> (OS-aware)</label>
				<label><input type="radio" bind:group={pageScheme} value="dark" /> <code>dark</code> (force)</label>
				<label><input type="radio" bind:group={pageScheme} value="light" /> <code>light</code> (force)</label>
			</fieldset>

			<fieldset>
				<legend>2. Ancestor theme class / attribute (wraps the demo tree)</legend>
				<label><input type="radio" bind:group={ancestorSignal} value="none" /> none</label>
				<label><input type="radio" bind:group={ancestorSignal} value="data-theme-dark" /> <code>[data-theme="dark"]</code></label>
				<label><input type="radio" bind:group={ancestorSignal} value="data-bs-theme-dark" /> <code>[data-bs-theme="dark"]</code></label>
				<label><input type="radio" bind:group={ancestorSignal} value="dark-class" /> <code>.dark</code> (Tailwind)</label>
				<label><input type="radio" bind:group={ancestorSignal} value="data-theme-light" /> <code>[data-theme="light"]</code> (force light)</label>
			</fieldset>

			<fieldset>
				<legend>3. Per-instance <code>theme</code> prop (highest precedence)</legend>
				<label><input type="radio" bind:group={instanceTheme} value="none" /> inherit</label>
				<label><input type="radio" bind:group={instanceTheme} value="dark" /> <code>theme="dark"</code></label>
				<label><input type="radio" bind:group={instanceTheme} value="light" /> <code>theme="light"</code></label>
			</fieldset>

			<fieldset>
				<legend>4. Brand theme — sets <code>--base-*</code> tokens on the wrapper</legend>
				<label><input type="radio" bind:group={brandTheme} value="default" /> Default (Bootstrap blue)</label>
				<label><input type="radio" bind:group={brandTheme} value="material" /> Material (calm blue, soft shadows)</label>
				<label><input type="radio" bind:group={brandTheme} value="neon" /> Neon (dark, magenta + cyan glow)</label>
				<label><input type="radio" bind:group={brandTheme} value="sharp" /> Sharp (high-contrast, brutalist)</label>
				<label><input type="radio" bind:group={brandTheme} value="soft" /> Soft (peach + pink, very rounded)</label>
				<label><input type="radio" bind:group={brandTheme} value="glass" /> Glass (translucent, blurred)</label>
				<label><input type="radio" bind:group={brandTheme} value="forest" /> Forest (earth tones, cream ↔ deep forest)</label>
			</fieldset>
		</div>

		<p class="winning-signal">
			<strong>Winning signal:</strong> {@html winningSignal}
		</p>

		<div
			class={['playground-wrapper', wrapperClass, `brand-${brandTheme}`]}
			data-theme={wrapperDataTheme}
			data-bs-theme={wrapperBsTheme}
		>
			<div class="tree-container playground-tree">
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={3}
					theme={treeTheme}
					selectionMode="multi"
					bind:highlightedPaths={playgroundHighlight}
					{...getTreeProps()}
				>
					{#snippet nodeTemplate(node: any)}
						<span>{node.data?.icon} {node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
		</div>

		<p class="hint">
			Tip: combine signals to verify precedence. Set <code>theme="light"</code>
			with all ancestor classes also set to dark — the per-instance prop should
			win and the tree stays light.
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
			<!-- Dark Theme (via theme="dark" prop — no CSS overrides needed) -->
			<div class="dark-card">
				<h3 style="color: white;">Dark Theme <code class="hint-code">theme="dark"</code></h3>
				<div class="tree-container">
					<Tree
						data={sampleData}
						idMember="id"
						pathMember="path"
						sortCallback={sortByName}
						isSorted={true}
						expandLevel={3}
						theme="dark"
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
					<td><code>stv__node-content--highlight-bold</code></td>
					<td>Bold text with primary color</td>
				</tr>
				<tr>
					<td><code>stv__node-content--highlight-border</code></td>
					<td>Border with light background</td>
				</tr>
				<tr>
					<td><code>stv__node-content--highlight-brackets</code></td>
					<td>Chevron brackets around content</td>
				</tr>
				<tr>
					<td><code>stv__node-content--highlight-fill</code></td>
					<td>Explorer-style solid fill background</td>
				</tr>
				<tr>
					<td><code>stv__node-content--highlight-glow</code></td>
					<td>Tinted background with a soft primary-colored glow ring</td>
				</tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`<Tree ...>
  {#snippet nodeTemplate(node: any)}
    <span class:stv__node-content--highlight-bold={node.isSelected}>
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
					<td><code>stv__toggle-icon--expand</code></td>
					<td><code>stv__toggle-icon--collapse</code></td>
					<td><span class="stv__toggle-icon--expand"></span> / <span class="stv__toggle-icon--collapse"></span></td>
				</tr>
				<tr>
					<td>Alternative</td>
					<td><code>stv__toggle-icon--expand-alt</code></td>
					<td><code>stv__toggle-icon--collapse-alt</code></td>
					<td><span class="stv__toggle-icon--expand-alt"></span> / <span class="stv__toggle-icon--collapse-alt"></span></td>
				</tr>
				<tr>
					<td>Plus/Minus</td>
					<td><code>stv__toggle-icon--expand-plus</code></td>
					<td><code>stv__toggle-icon--collapse-minus</code></td>
					<td><span class="stv__toggle-icon--expand-plus"></span> / <span class="stv__toggle-icon--collapse-minus"></span></td>
				</tr>
				<tr>
					<td>Arrows</td>
					<td><code>stv__toggle-icon--expand-arrow</code></td>
					<td><code>stv__toggle-icon--collapse-arrow</code></td>
					<td><span class="stv__toggle-icon--expand-arrow"></span> / <span class="stv__toggle-icon--collapse-arrow"></span></td>
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
					<td><code>stv__node-content--dragover-highlight</code></td>
					<td>Dashed border with light green background</td>
				</tr>
				<tr>
					<td><code>stv__node-content--dragover-glow</code></td>
					<td>Glowing box-shadow effect</td>
				</tr>
				<tr>
					<td><code>stv__node-content--drag-over</code></td>
					<td>Applied to node content during drag</td>
				</tr>
				<tr>
					<td><code>stv__node-content--drop-valid</code></td>
					<td>Green styling for valid drop target</td>
				</tr>
				<tr>
					<td><code>stv__node-content--drop-invalid</code></td>
					<td>Red styling for invalid drop target</td>
				</tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`/* Customize drag-over appearance */
:global(.stv__node-content--dragover-highlight) {
  background-color: rgba(16, 185, 129, 0.15) !important;
  border: 2px dashed #10b981 !important;
}

:global(.stv__node-content--dragover-glow) {
  box-shadow: 0 0 12px rgba(102, 126, 234, 0.5) !important;
}`}</pre>
		</div>
	</div>

	<!-- Complete Theme Example -->
	<div class="card">
		<h2>Complete Theme Example</h2>
		<p class="description">Copy this CSS to create a custom theme.</p>

		<div class="code-block">
			<pre>{`/* Custom Purple Theme — set primary once, tints follow via color-mix() */
.my-custom-theme {
  --stv-primary: #667eea;
  --stv-success: #10b981;
  --stv-danger: #ef4444;
  --stv-light: #f3f4f6;
  --stv-border: #e5e7eb;
  --stv-body-color: #1f2937;
  --stv-node-indent-per-level: calc(1.0 * var(--stv-rem));
  --tree-ghost-bg: color-mix(in srgb, #667eea 90%, transparent);
  --tree-ghost-color: white;
}

/* Dark mode variant */
.my-dark-theme {
  --stv-primary: #818cf8;
  --stv-light: #374151;
  --stv-border: #4b5563;
  --stv-body-color: #f9fafb;
  background-color: #1f2937;
}`}</pre>
		</div>
	</div>

	<!-- ====== CSS reference (moved below the demos for scannability) ====== -->

	<!-- CSS Variables Reference -->
	<div class="card">
		<h2>CSS Variables Reference</h2>
		<p class="description">
			Override these CSS variables to customize the tree appearance. Each one chains to a
			<code>--base-*</code> token shared across other <code>@keenmate/*</code> web components
			(see "Base token integration" below), then falls back to the listed default. Sized
			values are <code>calc(N × var(--stv-rem))</code> where <code>--stv-rem</code>
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
				<tr><td><code>--stv-rem</code></td><td><code>10px</code></td><td>Base unit multiplied into every size/spacing value. Set to <code>12px</code> for 20% scale, or to <code>1rem</code> to follow document font-size.</td></tr>

				<tr class="section-row"><td colspan="3">Colors</td></tr>
				<tr><td><code>--stv-primary</code></td><td><code>var(--base-accent-color, #0d6efd)</code></td><td>Primary color (selection, highlights). Tints derived via <code>color-mix()</code>.</td></tr>
				<tr><td><code>--stv-success</code></td><td><code>var(--base-success-color, #198754)</code></td><td>Success color (valid drop targets)</td></tr>
				<tr><td><code>--stv-danger</code></td><td><code>var(--base-danger-color, #dc3545)</code></td><td>Danger color (invalid drops)</td></tr>
				<tr><td><code>--stv-light</code></td><td><code>var(--base-main-bg, #f8f9fa)</code></td><td>Light background</td></tr>
				<tr><td><code>--stv-border</code></td><td><code>var(--base-border-color, #dee2e6)</code></td><td>Border color</td></tr>
				<tr><td><code>--stv-body-color</code></td><td><code>var(--base-text-color-1, #212529)</code></td><td>Default text color</td></tr>

				<tr class="section-row"><td colspan="3">Typography</td></tr>
				<tr><td><code>--stv-font-family</code></td><td><code>var(--base-font-family, system stack)</code></td><td>Font family for all tree text</td></tr>
				<tr><td><code>--stv-node-font-size</code></td><td><code>(--base-font-size-sm, 1.4) × rem</code> (= 14px)</td><td>Node text size</td></tr>
				<tr><td><code>--stv-node-icon-font-size</code></td><td><code>(--base-font-size-sm, 1.4) × rem</code> (= 14px)</td><td>Per-node icon font size</td></tr>
				<tr><td><code>--stv-node-icon-margin-right</code></td><td><code>0.6 × rem</code> (= 6px)</td><td>Gap between node icon and label</td></tr>
				<tr><td><code>--stv-node-path-font-size</code></td><td><code>(--base-font-size-xs, 1.2) × rem</code> (= 12px)</td><td>Path / debug text size</td></tr>
				<tr><td><code>--stv-node-path-color</code></td><td><code>var(--base-text-color-3, #6c757d)</code></td><td>Path / muted text color</td></tr>

				<tr class="section-row"><td colspan="3">Node layout</td></tr>
				<tr><td><code>--stv-node-indent-per-level</code></td><td><code>0.8 × rem</code> (= 8px)</td><td>Indentation per nesting level</td></tr>
				<tr><td><code>--stv-node-content-padding</code></td><td><code>0.4 × rem / 0.8 × rem</code> (= 4px 8px)</td><td>Inner padding of a node row (V / H)</td></tr>
				<tr><td><code>--stv-node-content-border-radius</code></td><td><code>(--base-border-radius-sm, 0) × rem</code></td><td>Node row corner rounding</td></tr>
				<tr><td><code>--stv-node-hover-bg</code></td><td><code>var(--base-hover-bg, color-mix(primary 8%, transparent))</code></td><td>Hover background — follows <code>--stv-primary</code> by default</td></tr>
				<tr><td><code>--stv-children-margin-top</code></td><td><code>0.2 × rem</code> (= 2px)</td><td>Top margin of child list</td></tr>

				<tr class="section-row"><td colspan="3">Toggle icon</td></tr>
				<tr><td><code>--stv-toggle-icon-size</code></td><td><code>1.6 × rem</code> (= 16px)</td><td>SVG icon size (chevron / +/- / arrow / leaf)</td></tr>
				<tr><td><code>--stv-toggle-icon-width</code></td><td><code>2.0 × rem</code> (= 20px)</td><td>Width reserved for the toggle column</td></tr>
				<tr><td><code>--stv-toggle-icon-color</code></td><td><code>var(--base-text-color-3, #6c757d)</code></td><td>Icon color (via <code>currentColor</code> mask)</td></tr>
				<tr><td><code>--stv-toggle-icon-margin-right</code></td><td><code>0.8 × rem</code> (= 8px)</td><td>Gap between toggle and node label</td></tr>
				<tr><td><code>--stv-toggle-icon-transition</code></td><td><code>transform 0.2s</code></td><td>Rotate animation timing (does not scale)</td></tr>

				<tr class="section-row"><td colspan="3">Checkbox</td></tr>
				<tr><td><code>--stv-checkbox-size</code></td><td><code>1.5 × rem</code> (= 15px)</td><td>Checkbox square dimension</td></tr>
				<tr><td><code>--stv-checkbox-border-width</code></td><td><code>1.5px</code></td><td>Border thickness (hairline, does not scale)</td></tr>
				<tr><td><code>--stv-checkbox-border-color</code></td><td><code>var(--base-border-color, #adb5bd)</code></td><td>Unchecked border</td></tr>
				<tr><td><code>--stv-checkbox-border-radius</code></td><td><code>(--base-border-radius-sm, 0.3) × rem</code> (= 3px)</td><td>Corner rounding</td></tr>
				<tr><td><code>--stv-checkbox-bg</code></td><td><code>var(--base-input-bg, #fff)</code></td><td>Unchecked background</td></tr>
				<tr><td><code>--stv-checkbox-checked-bg</code></td><td><code>var(--stv-primary)</code></td><td>Checked / indeterminate background</td></tr>
				<tr><td><code>--stv-checkbox-checked-border-color</code></td><td><code>var(--stv-primary)</code></td><td>Checked / indeterminate border</td></tr>
				<tr><td><code>--stv-checkbox-checkmark-color</code></td><td><code>var(--base-text-color-on-accent, #fff)</code></td><td>Tick / dash color</td></tr>
				<tr><td><code>--stv-checkbox-focus-ring-width</code></td><td><code>2px</code></td><td>Focus-visible ring thickness</td></tr>
				<tr><td><code>--stv-checkbox-focus-ring-color</code></td><td><code>color-mix(primary 25%, transparent)</code></td><td>Focus-visible ring color</td></tr>
				<tr><td><code>--stv-checkbox-focus-ring</code></td><td><code>0 0 0 [ring-width] [ring-color]</code></td><td>Composed box-shadow; override directly for full control, or tune the two parts above</td></tr>

				<tr class="section-row"><td colspan="3">Selection &amp; highlight states</td></tr>
				<tr><td><code>--stv-highlight-bg</code></td><td><code>#cce8ff</code></td><td>Explorer-style highlight background</td></tr>
				<tr><td><code>--stv-highlight-color</code></td><td><code>inherit</code></td><td>Highlight text color</td></tr>
				<tr><td><code>--stv-multi-selected-bg</code></td><td><code>color-mix(primary 8%, transparent)</code></td><td>Multi-select tint</td></tr>
				<tr><td><code>--stv-multi-selected-outline</code></td><td><code>color-mix(primary 25%, transparent)</code></td><td>Multi-select outline</td></tr>

				<tr class="section-row"><td colspan="3">Drag / drop states</td></tr>
				<tr><td><code>--stv-dragover-bg</code></td><td><code>color-mix(primary 10%, transparent)</code></td><td>Drag-over background tint</td></tr>
				<tr><td><code>--stv-dragover-shadow</code></td><td><code>0 0 8px color-mix(primary 40%, transparent)</code></td><td>Drag-over glow shadow</td></tr>
				<tr><td><code>--stv-drop-placeholder-bg</code></td><td><code>color-mix(primary 10%, transparent)</code></td><td>Empty-tree placeholder background</td></tr>
				<tr><td><code>--stv-drop-placeholder-color</code></td><td><code>var(--stv-primary)</code></td><td>Placeholder text color</td></tr>
				<tr><td><code>--stv-drop-placeholder-border-radius</code></td><td><code>0.8 × rem</code> (= 8px)</td><td>Placeholder corner rounding</td></tr>
				<tr><td><code>--stv-drop-placeholder-min-height</code></td><td><code>6.0 × rem</code> (= 60px)</td><td>Placeholder min height</td></tr>
				<tr><td><code>--tree-ghost-bg</code></td><td><code>rgba(59, 130, 246, 0.9)</code></td><td>Touch drag ghost background</td></tr>
				<tr><td><code>--tree-ghost-color</code></td><td><code>#fff</code></td><td>Touch drag ghost text color</td></tr>

				<tr class="section-row"><td colspan="3">Drop zones (pastel mode)</td></tr>
				<tr><td><code>--stv-drop-zone-border-radius</code></td><td><code>0</code></td><td>Drop zone corner rounding</td></tr>
				<tr><td><code>--stv-drop-zone-[before|after|child]-bg</code></td><td><code>rgba sage / coral / lavender</code></td><td>Per-zone resting background</td></tr>
				<tr><td><code>--stv-drop-zone-[before|after|child]-color</code></td><td><code>matching dark variants</code></td><td>Per-zone resting text color</td></tr>
				<tr><td><code>--stv-drop-zone-[before|after|child]-active-bg</code></td><td><code>~85% opacity variants</code></td><td>Active zone background</td></tr>
				<tr><td><code>--stv-drop-zone-[before|after|child]-active-color</code></td><td><code>~darker variants</code></td><td>Active zone text color</td></tr>
				<tr><td><code>--stv-drop-zone-[before|after|child]-active-shadow</code></td><td><code>0 2px 12px (color, 0.4)</code></td><td>Active zone shadow</td></tr>

				<tr class="section-row"><td colspan="3">Drop zones (glow mode)</td></tr>
				<tr><td><code>--stv-drop-glow-[before|after|child]-color</code></td><td><code>0.8-alpha pastel variants</code></td><td>Glow border color per zone</td></tr>
				<tr><td><code>--stv-drop-glow-child-bg</code></td><td><code>rgba(167, 155, 198, 0.15)</code></td><td>Glow child zone background tint</td></tr>
				<tr><td><code>--stv-drop-glow-size</code></td><td><code>3px</code></td><td>Glow border thickness (hairline, does not scale)</td></tr>
				<tr><td><code>--stv-drop-arrow-size</code></td><td><code>2.4 × rem</code> (= 24px)</td><td>Direction arrow size</td></tr>
				<tr><td><code>--stv-drop-arrow-position</code></td><td><code>66%</code></td><td>Horizontal arrow position</td></tr>
				<tr><td><code>--stv-drop-arrow-[before|after|child]-rotation</code></td><td><code>0 / 0 / 45deg</code></td><td>Arrow rotation per zone</td></tr>

				<tr class="section-row"><td colspan="3">Context menu</td></tr>
				<tr><td><code>--stv-context-menu-bg</code></td><td><code>var(--base-dropdown-bg, #fff)</code></td><td>Menu background</td></tr>
				<tr><td><code>--stv-context-menu-border-color</code></td><td><code>var(--stv-border)</code></td><td>Menu border</td></tr>
				<tr><td><code>--stv-context-menu-border-radius</code></td><td><code>(--base-border-radius-sm, 0.4) × rem</code> (= 4px)</td><td>Menu rounding</td></tr>
				<tr><td><code>--stv-context-menu-shadow</code></td><td><code>var(--base-dropdown-box-shadow, …)</code></td><td>Menu drop shadow</td></tr>
				<tr><td><code>--stv-context-menu-min-width</code></td><td><code>15 × rem</code> (= 150px)</td><td>Menu minimum width</td></tr>
				<tr><td><code>--stv-context-menu-padding</code></td><td><code>0.4 × rem / 0</code></td><td>Menu inner padding</td></tr>
				<tr><td><code>--stv-context-menu-item-padding</code></td><td><code>0.8 × rem / 1.6 × rem</code> (= 8px 16px)</td><td>Item padding</td></tr>
				<tr><td><code>--stv-context-menu-item-font-size</code></td><td><code>(--base-font-size-sm, 1.4) × rem</code> (= 14px)</td><td>Item font size</td></tr>
				<tr><td><code>--stv-context-menu-item-color</code></td><td><code>var(--stv-body-color)</code></td><td>Item color</td></tr>
				<tr><td><code>--stv-context-menu-item-hover-bg</code></td><td><code>var(--stv-light)</code></td><td>Item hover background</td></tr>
				<tr><td><code>--stv-context-menu-icon-size</code></td><td><code>1.6 × rem</code> (= 16px)</td><td>Icon column width</td></tr>
				<tr><td><code>--stv-context-menu-icon-font-size</code></td><td><code>(--base-font-size-xs, 1.2) × rem</code> (= 12px)</td><td>Icon font size</td></tr>
				<tr><td><code>--stv-context-menu-shortcut-color</code></td><td><code>var(--base-text-color-4, #9ca3af)</code></td><td>Shortcut hint color</td></tr>
				<tr><td><code>--stv-context-menu-shortcut-font-size</code></td><td><code>(--base-font-size-xs, 1.2) × rem</code> (= 12px)</td><td>Shortcut hint size</td></tr>
				<tr><td><code>--stv-context-menu-arrow-color</code></td><td><code>var(--base-text-color-4, #9ca3af)</code></td><td>Submenu arrow color</td></tr>
				<tr><td><code>--stv-context-menu-divider-color</code></td><td><code>var(--stv-border)</code></td><td>Divider line color</td></tr>
				<tr><td><code>--stv-context-menu-divider-label-color</code></td><td><code>var(--base-text-color-4, #9ca3af)</code></td><td>Named divider label color</td></tr>

				<tr class="section-row"><td colspan="3">Loading + spinner</td></tr>
				<tr><td><code>--stv-loading-bg</code></td><td><code>rgba(255, 255, 255, 0.8)</code></td><td>Loading overlay background</td></tr>
				<tr><td><code>--stv-loading-color</code></td><td><code>var(--base-text-color-3, #718096)</code></td><td>"Loading more..." text color</td></tr>
				<tr><td><code>--stv-spinner-size</code></td><td><code>3.2 × rem</code> (= 32px)</td><td>Spinner diameter</td></tr>
				<tr><td><code>--stv-spinner-track</code></td><td><code>var(--base-border-color, #e2e8f0)</code></td><td>Spinner track (background ring)</td></tr>
				<tr><td><code>--stv-spinner-color</code></td><td><code>var(--stv-primary)</code></td><td>Spinner active color</td></tr>

				<tr class="section-row"><td colspan="3">Scroll highlight (after <code>scrollToPath</code>)</td></tr>
				<tr><td><code>--stv-scroll-highlight-bg</code></td><td><code>color-mix(primary 30%, transparent)</code></td><td>Highlight background</td></tr>
				<tr><td><code>--stv-scroll-highlight-shadow</code></td><td><code>0 0 0.5em color-mix(primary 40%, transparent)</code></td><td>Highlight glow</td></tr>
				<tr><td><code>--stv-scroll-highlight-arrow-color</code></td><td><code>var(--stv-danger)</code></td><td>Arrow icon color</td></tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`/* Override individual variables — tints follow automatically */
.my-tree {
  --stv-primary: #667eea;   /* hover/dragover/multi-select tints
                                  derived via color-mix() */
  --stv-success: #10b981;
  --stv-danger: #ef4444;
}

/* Scale everything proportionally with one knob */
.my-bigger-tree {
  --stv-rem: 12px;   /* 20% larger — all dimensions follow */
}

/* Or scale with document font-size (Pure Admin pattern) */
.my-tree {
  --stv-rem: 1rem;   /* now respects html { font-size: ... } */
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
			up automatically. Each <code>--stv-*</code> variable resolves to
			<code>--base-{`{token}`}</code> first, then to its hardcoded default.
		</p>

		<div class="code-block">
			<pre>{`/* One theme, every KM component.
   --base-font-size-* and --base-border-radius-* are UNITLESS multipliers
   that the component multiplies by its own --*-rem unit. */
:root {
  /* Colors — direct values; tints derived via color-mix() */
  --base-accent-color: #10b981;
  --base-text-color-1: #111827;
  --base-text-color-3: #6b7280;
  --base-text-color-4: #9ca3af;
  --base-border-color: #e5e7eb;
  --base-hover-bg: #f3f4f6;
  --base-dropdown-bg: #ffffff;

  /* Typography — unitless multipliers (× --stv-rem) */
  --base-font-family: 'Inter', system-ui, sans-serif;
  --base-font-size-xs: 1.2;       /* 12px at default --stv-rem: 10px */
  --base-font-size-sm: 1.4;       /* 14px */
  --base-font-weight-medium: 500;

  /* Radii — unitless multipliers (× --stv-rem) */
  --base-border-radius-sm: 0.4;   /* 4px */
}`}</pre>
		</div>

		<p class="hint">
			<code>--stv-*</code> overrides on the tree element itself take precedence over
			<code>--base-*</code> tokens, so you can still tweak a single tree without affecting the
			global theme.
		</p>
	</div>

	<!-- Dynamic Theme Switching — ported from web-daterangepicker -->
	<div class="card">
		<h2>Dynamic Theme Switching</h2>
		<p class="description">
			Change themes at runtime with JavaScript. The brand buttons swap a class
			on the wrapper (which re-tints the tree via <code>--base-*</code>); the
			light / dark / inherit buttons drive the per-instance <code>theme</code>
			prop on <code>&lt;Tree&gt;</code>.
		</p>

		<div
			class={['playground-wrapper', `brand-${dynamicBrand}`]}
		>
			<div class="tree-container playground-tree">
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={3}
					theme={dynamicTreeTheme}
					selectionMode="multi"
					bind:highlightedPaths={dynamicHighlight}
					{...getTreeProps()}
				>
					{#snippet nodeTemplate(node: any)}
						<span>{node.data?.icon} {node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
		</div>

		<div class="theme-switcher-row" aria-label="Brand theme">
			<button
				type="button"
				class="theme-btn theme-btn--default"
				class:is-active={dynamicBrand === 'default'}
				onclick={() => (dynamicBrand = 'default')}
			>Default</button>
			<button
				type="button"
				class="theme-btn theme-btn--material"
				class:is-active={dynamicBrand === 'material'}
				onclick={() => (dynamicBrand = 'material')}
			>Material</button>
			<button
				type="button"
				class="theme-btn theme-btn--neon"
				class:is-active={dynamicBrand === 'neon'}
				onclick={() => (dynamicBrand = 'neon')}
			>Neon</button>
			<button
				type="button"
				class="theme-btn theme-btn--sharp"
				class:is-active={dynamicBrand === 'sharp'}
				onclick={() => (dynamicBrand = 'sharp')}
			>Sharp</button>
			<button
				type="button"
				class="theme-btn theme-btn--soft"
				class:is-active={dynamicBrand === 'soft'}
				onclick={() => (dynamicBrand = 'soft')}
			>Soft</button>
			<button
				type="button"
				class="theme-btn theme-btn--forest"
				class:is-active={dynamicBrand === 'forest'}
				onclick={() => (dynamicBrand = 'forest')}
			>Forest</button>
			<button
				type="button"
				class="theme-btn theme-btn--glass"
				class:is-active={dynamicBrand === 'glass'}
				onclick={() => (dynamicBrand = 'glass')}
			>Glass</button>
		</div>

		<div class="theme-switcher-row theme-switcher-row--mode" aria-label="Color scheme">
			<button
				type="button"
				class="theme-btn theme-btn--inherit"
				class:is-active={dynamicMode === 'inherit'}
				onclick={() => (dynamicMode = 'inherit')}
			>Inherit</button>
			<button
				type="button"
				class="theme-btn theme-btn--light"
				class:is-active={dynamicMode === 'light'}
				onclick={() => (dynamicMode = 'light')}
			>Light</button>
			<button
				type="button"
				class="theme-btn theme-btn--dark"
				class:is-active={dynamicMode === 'dark'}
				onclick={() => (dynamicMode = 'dark')}
			>Dark</button>
		</div>

		<div class="code-block">
			<pre>{`// Brand theme: a class on the wrapper that sets --base-* tokens
wrapper.className = 'brand-${dynamicBrand}';

// Color scheme: forwarded to the inner Tree as data-theme
<Tree theme={${dynamicMode === 'inherit' ? 'undefined' : `'${dynamicMode}'`}} ... />`}</pre>
		</div>
	</div>

	<footer>
		<p><a href="/">&larr; Back to Examples</a></p>
	</footer>
</div>

<style>
	/* Purple theme — sets --base-accent-color on the wrapper. The tree's
	   .stv__container inherits it and re-substitutes --stv-primary on its
	   own scope; every primary-derived tint (hover, multi-select, dragover,
	   focus ring) follows via color-mix(). */
	.purple-theme {
		--base-accent-color: #667eea;
	}

	/* Green theme */
	.green-theme {
		--base-accent-color: #10b981;
	}

	/* Dark theme card — the tree flips via theme="dark"; the card just paints a
	   dark background so the embedded tree blends with the surrounding chrome. */
	.dark-card {
		background: #1f2937;
		padding: 1rem;
		border-radius: 8px;
	}
	.hint-code {
		font-size: 0.75em;
		opacity: 0.7;
		font-weight: normal;
		color: #c4b5fd;
		background: rgba(255, 255, 255, 0.08);
		padding: 0.1em 0.35em;
		border-radius: 3px;
	}

	/* Dark mode playground — interactive controls + live demo tree */
	.playground-controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 1rem;
		margin: 1rem 0;
	}
	.playground-controls fieldset {
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		padding: 0.75rem 1rem;
		margin: 0;
		background: #f9fafb;
	}
	.playground-controls legend {
		font-weight: 600;
		font-size: 0.85rem;
		color: #374151;
		padding: 0 0.4rem;
	}
	.playground-controls legend code {
		font-size: 0.95em;
	}
	.playground-controls label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.2rem 0;
		font-size: 0.875rem;
		cursor: pointer;
		line-height: 1.4;
	}
	.playground-controls label code {
		font-size: 0.85em;
		background: #f3f4f6;
		padding: 0.05em 0.3em;
		border-radius: 3px;
	}
	.winning-signal {
		padding: 0.6rem 1rem;
		background: #eff6ff;
		border-left: 4px solid #3b82f6;
		border-radius: 4px;
		font-size: 0.9rem;
		color: #1e3a8a;
		margin: 0.5rem 0 1rem;
	}
	/* Playground surfaces — pure CSS theme detection (no JS matchMedia).
	   Mirrors the precedence in color-scheme.md:
	     :has(.stv__container[data-theme]) > [data-theme] on wrapper > light-dark()
	   Cascade order matters: per-instance :has() rules come last so they win at
	   equal specificity against the wrapper attribute selectors. */

	/* === WRAPPER === */
	.playground-wrapper {
		padding: 1rem;
		border-radius: 8px;
		transition: background 0.15s ease;
		/* OS preference + page color-scheme — light-dark() resolves the branch
		   from the nearest declared color-scheme (set on <html> by the page-scheme radio). */
		background: light-dark(#f9fafb, #1f2937);
	}
	/* Belt-and-suspenders: catch OS dark even when no page color-scheme is set. */
	@media (prefers-color-scheme: dark) {
		.playground-wrapper { background: #1f2937; }
	}
	/* Signal #2 — framework theme class/attr set on the wrapper itself. */
	.playground-wrapper[data-theme='dark'],
	.playground-wrapper[data-bs-theme='dark'],
	.playground-wrapper.dark {
		background: #1f2937;
	}
	.playground-wrapper[data-theme='light'] {
		background: #f9fafb;
	}
	/* Signal #3 — per-instance theme on the inner tree. The Tree component
	   forwards `theme` as `data-theme` on its internal .stv__container. :has()
	   lets the wrapper react to that without JS. :global() so Svelte's CSS
	   scoper doesn't drop the selector as unused. */
	:global(.playground-wrapper:has(.stv__container[data-theme='dark'])) {
		background: #1f2937;
	}
	:global(.playground-wrapper:has(.stv__container[data-theme='light'])) {
		background: #f9fafb;
	}

	/* === INNER TREE SURFACE ===
	   The library never paints a background on .stv__container — that's the
	   consumer's job. The demo provides one so dark text remains readable.

	   The border uses var(--stv-primary) so the active brand theme is visible
	   at rest (the library's accent normally only shows in interaction states).
	   We also bump --stv-multi-selected-bg / outline locally so the pre-
	   highlighted "Work" node reads strongly against either surface — the
	   library defaults (8% bg, 25% outline) are intentionally subtle and don't
	   make a great demo. */
	.playground-tree {
		border-radius: 6px;
		padding: 0.5rem;
		background: light-dark(#ffffff, #1a1a1a);
		border: 2px solid var(--stv-primary);
		transition: background 0.15s ease;
		--stv-multi-selected-bg: color-mix(in srgb, var(--stv-primary) 18%, transparent);
		--stv-multi-selected-outline: color-mix(in srgb, var(--stv-primary) 50%, transparent);
	}
	@media (prefers-color-scheme: dark) {
		.playground-tree { background: #1a1a1a; }
	}
	.playground-wrapper[data-theme='dark'] .playground-tree,
	.playground-wrapper[data-bs-theme='dark'] .playground-tree,
	.playground-wrapper.dark .playground-tree {
		background: #1a1a1a;
	}
	.playground-wrapper[data-theme='light'] .playground-tree {
		background: #ffffff;
	}
	/* Per-instance wins via :has() on the tree-container's own data-theme.
	   :global() so Svelte's scoper doesn't drop the selector as unused. */
	:global(.playground-tree:has(.stv__container[data-theme='dark'])) {
		background: #1a1a1a;
	}
	:global(.playground-tree:has(.stv__container[data-theme='light'])) {
		background: #ffffff;
	}

	/* === BRAND THEMES ===
	   Each theme sets `--base-*` tokens on the playground wrapper. Because the
	   library declares its --stv-* variables on .stv__container (a descendant
	   of the wrapper), the wrapper's --base-* overrides flow through inheritance
	   into the tree's scope and re-substitute at the descendant. Modeled on
	   web-multiselect's examples-theming.html — each theme is a full visual
	   identity, not just an accent swap. */

	/* === Default — no overrides; relies on --base-accent-color default (#0d6efd). */

	/* === Material — soft shadows, calm blue accent.
	   Light: light blue + lavender gradient, dark slate text.
	   Dark: deep indigo gradient, brighter blue accent, light blue text.

	   All theme selectors are wrapped in :global() because Svelte's CSS scoper
	   otherwise (a) appends a scope hash that inflates the base rule's
	   specificity above the dark-variant rules, and (b) prunes :has() as
	   "unused" because static analysis can't see runtime data-theme on the
	   inner Tree component. With :global, every selector is plain CSS.

	   --base-* color values use light-dark() so the page color-scheme signal
	   flips them. @media catches OS preference and swaps the gradient (which
	   can't sit inside light-dark()). The explicit attribute / :has() selectors
	   catch framework class on the wrapper and per-instance theme on the tree. */
	:global(.playground-wrapper.brand-material) {
		--base-accent-color: light-dark(#1976d2, #64b5f6);
		--base-border-radius-sm: 0.4;
		--base-text-color-1: light-dark(#212121, #e3f2fd);
		--base-text-color-3: light-dark(#757575, #90caf9);
		--base-border-color: light-dark(#e0e0e0, #3949ab);
		--base-hover-bg: light-dark(#f5f5f5, #283593);
		background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
	}
	:global(.playground-wrapper.brand-material .playground-tree) {
		box-shadow: 0 4px 16px rgba(25, 118, 210, 0.12);
		border: 1px solid transparent;
	}
	@media (prefers-color-scheme: dark) {
		:global(.playground-wrapper.brand-material) {
			--base-main-bg: #1a237e;
			--base-elevated-bg: #283593;
			--base-input-bg: #1a237e;
			background: linear-gradient(135deg, #0d1654 0%, #1a237e 100%);
		}
		:global(.playground-wrapper.brand-material .playground-tree) {
			box-shadow: 0 4px 16px rgba(100, 181, 246, 0.18);
		}
	}
	:global(.playground-wrapper.brand-material[data-theme="dark"]),
	:global(.playground-wrapper.brand-material[data-bs-theme="dark"]),
	:global(.playground-wrapper.brand-material.dark),
	:global(.playground-wrapper.brand-material:has(.stv__container[data-theme="dark"])) {
		--base-accent-color: #64b5f6;
		--base-text-color-1: #e3f2fd;
		--base-text-color-3: #90caf9;
		--base-border-color: #3949ab;
		--base-hover-bg: #283593;
		--base-main-bg: #1a237e;
		--base-elevated-bg: #283593;
		--base-input-bg: #1a237e;
		background: linear-gradient(135deg, #0d1654 0%, #1a237e 100%);
	}
	:global(.playground-wrapper.brand-material[data-theme="dark"] .playground-tree),
	:global(.playground-wrapper.brand-material[data-bs-theme="dark"] .playground-tree),
	:global(.playground-wrapper.brand-material.dark .playground-tree),
	:global(.playground-wrapper.brand-material:has(.stv__container[data-theme="dark"]) .playground-tree) {
		box-shadow: 0 4px 16px rgba(100, 181, 246, 0.18);
	}

	/* === Neon — cyberpunk: deep purple-black surface, magenta + cyan accents,
	   glowing borders. Intrinsically dark in both modes — its identity is dark.
	   :global() escapes Svelte's CSS scoper (matches the other themes). */
	:global(.playground-wrapper.brand-neon) {
		--base-accent-color: #ff00ff;
		--base-main-bg: #1a0a1a;
		--base-elevated-bg: #2a1a2a;
		--base-input-bg: #1a0a1a;
		--base-text-color-1: #00ffff;
		--base-text-color-3: #ff8aff;
		--base-text-color-4: #cc99cc;
		--base-border-color: #ff00ff;
		background: #0a0a0a;
		background-image: linear-gradient(45deg, rgba(255, 0, 255, 0.1), rgba(0, 255, 255, 0.08));
	}
	:global(.playground-wrapper.brand-neon .playground-tree) {
		background: transparent;
		border: 1px solid #ff00ff;
		box-shadow: 0 0 24px rgba(255, 0, 255, 0.3), 0 0 8px rgba(0, 255, 255, 0.2);
	}

	/* === Sharp — brutalist high-contrast: square corners, thick borders, hard
	   offset shadow.
	   Light: black-on-white.
	   Dark: white-on-black (full inversion — same brutalist DNA, opposite ink). */
	:global(.playground-wrapper.brand-sharp) {
		--base-accent-color: light-dark(#000000, #ffffff);
		--base-text-color-1: light-dark(#000000, #ffffff);
		--base-text-color-3: light-dark(#333333, #cccccc);
		--base-border-color: light-dark(#000000, #ffffff);
		--base-border-radius-sm: 0;
		--base-font-weight-medium: 700;
		background: #ffffff;
		border: 2px solid #000000;
		border-radius: 0;
		box-shadow: 6px 6px 0 0 #000000;
	}
	:global(.playground-wrapper.brand-sharp .playground-tree) {
		border: 2px solid #000000;
		border-radius: 0;
	}
	@media (prefers-color-scheme: dark) {
		:global(.playground-wrapper.brand-sharp) {
			--base-main-bg: #000000;
			--base-elevated-bg: #000000;
			--base-input-bg: #000000;
			background: #000000;
			border-color: #ffffff;
			box-shadow: 6px 6px 0 0 #ffffff;
		}
		:global(.playground-wrapper.brand-sharp .playground-tree) {
			border-color: #ffffff;
		}
	}
	:global(.playground-wrapper.brand-sharp[data-theme="dark"]),
	:global(.playground-wrapper.brand-sharp[data-bs-theme="dark"]),
	:global(.playground-wrapper.brand-sharp.dark),
	:global(.playground-wrapper.brand-sharp:has(.stv__container[data-theme="dark"])) {
		--base-accent-color: #ffffff;
		--base-text-color-1: #ffffff;
		--base-text-color-3: #cccccc;
		--base-main-bg: #000000;
		--base-elevated-bg: #000000;
		--base-input-bg: #000000;
		--base-border-color: #ffffff;
		background: #000000;
		border-color: #ffffff;
		box-shadow: 6px 6px 0 0 #ffffff;
	}
	:global(.playground-wrapper.brand-sharp[data-theme="dark"] .playground-tree),
	:global(.playground-wrapper.brand-sharp[data-bs-theme="dark"] .playground-tree),
	:global(.playground-wrapper.brand-sharp.dark .playground-tree),
	:global(.playground-wrapper.brand-sharp:has(.stv__container[data-theme="dark"]) .playground-tree) {
		border-color: #ffffff;
	}

	/* === Soft — extra-rounded, warm.
	   Light: peach + apricot gradient, pink accent, earth-tone text.
	   Dark: deep wine/burgundy gradient, dusty rose accent, pale rose text. */
	:global(.playground-wrapper.brand-soft) {
		--base-accent-color: light-dark(#ff6b9d, #e88aa8);
		--base-text-color-1: light-dark(#5a3e36, #f5d4dc);
		--base-text-color-3: light-dark(#8a6f6a, #c8a0ad);
		--base-border-color: light-dark(#f0d0c0, #5a3a45);
		--base-hover-bg: light-dark(#fff5f0, #3d2530);
		--base-border-radius-sm: 1.2;
		background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
		border-radius: 20px;
	}
	:global(.playground-wrapper.brand-soft .playground-tree) {
		border: 1px solid #ffc0dd;
		border-radius: 16px;
		box-shadow: 0 8px 24px rgba(252, 182, 159, 0.3);
	}
	@media (prefers-color-scheme: dark) {
		:global(.playground-wrapper.brand-soft) {
			--base-main-bg: #2c1820;
			--base-elevated-bg: #3d2530;
			--base-input-bg: #2c1820;
			background: linear-gradient(135deg, #1a0f15 0%, #3a2530 100%);
		}
		:global(.playground-wrapper.brand-soft .playground-tree) {
			border-color: #5a3a45;
			box-shadow: 0 8px 24px rgba(232, 138, 168, 0.25);
		}
	}
	:global(.playground-wrapper.brand-soft[data-theme="dark"]),
	:global(.playground-wrapper.brand-soft[data-bs-theme="dark"]),
	:global(.playground-wrapper.brand-soft.dark),
	:global(.playground-wrapper.brand-soft:has(.stv__container[data-theme="dark"])) {
		--base-accent-color: #e88aa8;
		--base-text-color-1: #f5d4dc;
		--base-text-color-3: #c8a0ad;
		--base-border-color: #5a3a45;
		--base-hover-bg: #3d2530;
		--base-main-bg: #2c1820;
		--base-elevated-bg: #3d2530;
		--base-input-bg: #2c1820;
		background: linear-gradient(135deg, #1a0f15 0%, #3a2530 100%);
	}
	:global(.playground-wrapper.brand-soft[data-theme="dark"] .playground-tree),
	:global(.playground-wrapper.brand-soft[data-bs-theme="dark"] .playground-tree),
	:global(.playground-wrapper.brand-soft.dark .playground-tree),
	:global(.playground-wrapper.brand-soft:has(.stv__container[data-theme="dark"]) .playground-tree) {
		border-color: #5a3a45;
		box-shadow: 0 8px 24px rgba(232, 138, 168, 0.25);
	}

	/* === Forest — nature-inspired earth tones.
	   Light: warm cream surface, deep forest text, dark green accent.
	   Dark: deep forest surface, pale mint text, brighter green accent. */
	:global(.playground-wrapper.brand-forest) {
		--base-accent-color: light-dark(#2d6a4f, #74c69d);
		--base-main-bg: light-dark(#f0ebe0, #1b2e23);
		--base-elevated-bg: light-dark(#e8e1d0, #2d4a3a);
		--base-text-color-1: light-dark(#1b4332, #d8f3dc);
		--base-text-color-3: light-dark(#4a7c5e, #95d5b2);
		--base-text-color-4: light-dark(#6a9b80, #6f9a82);
		--base-border-color: light-dark(#c9b896, #2d4a3a);
		--base-input-bg: light-dark(#f0ebe0, #1b2e23);
		--base-hover-bg: light-dark(#e0d8c4, #243d2e);
		--base-border-radius-sm: 0.6;
		background: linear-gradient(135deg, #f5f0e8 0%, #d9d0b8 100%);
		border-radius: 10px;
	}
	:global(.playground-wrapper.brand-forest .playground-tree) {
		background: transparent;
		border: 1px solid #c9b896;
		box-shadow: 0 4px 16px rgba(45, 106, 79, 0.15);
	}
	/* @media swaps the gradient + dark-tone border/shadow that can't sit in light-dark(). */
	@media (prefers-color-scheme: dark) {
		:global(.playground-wrapper.brand-forest) {
			background: linear-gradient(135deg, #0d1f15 0%, #1b2e23 100%);
		}
		:global(.playground-wrapper.brand-forest .playground-tree) {
			border-color: #2d4a3a;
			box-shadow: 0 4px 24px rgba(116, 198, 157, 0.2);
		}
	}
	:global(.playground-wrapper.brand-forest[data-theme="dark"]),
	:global(.playground-wrapper.brand-forest[data-bs-theme="dark"]),
	:global(.playground-wrapper.brand-forest.dark),
	:global(.playground-wrapper.brand-forest:has(.stv__container[data-theme="dark"])) {
		--base-accent-color: #74c69d;
		--base-main-bg: #1b2e23;
		--base-elevated-bg: #2d4a3a;
		--base-text-color-1: #d8f3dc;
		--base-text-color-3: #95d5b2;
		--base-text-color-4: #6f9a82;
		--base-border-color: #2d4a3a;
		--base-input-bg: #1b2e23;
		--base-hover-bg: #243d2e;
		background: linear-gradient(135deg, #0d1f15 0%, #1b2e23 100%);
	}
	:global(.playground-wrapper.brand-forest[data-theme="dark"] .playground-tree),
	:global(.playground-wrapper.brand-forest[data-bs-theme="dark"] .playground-tree),
	:global(.playground-wrapper.brand-forest.dark .playground-tree),
	:global(.playground-wrapper.brand-forest:has(.stv__container[data-theme="dark"]) .playground-tree) {
		border-color: #2d4a3a;
		box-shadow: 0 4px 24px rgba(116, 198, 157, 0.2);
	}

	/* === Glass — translucent surfaces, frosted backdrop blur.
	   Light: bold purple→violet gradient with translucent white panels.
	   Dark: deep midnight gradient with the same translucent palette — same
	   glass feel, dramatically deeper backdrop. */
	:global(.playground-wrapper.brand-glass) {
		--base-accent-color: #ffffff;
		--base-main-bg: rgba(255, 255, 255, 0.15);
		--base-elevated-bg: rgba(255, 255, 255, 0.2);
		--base-input-bg: rgba(255, 255, 255, 0.15);
		--base-text-color-1: #ffffff;
		--base-text-color-3: rgba(255, 255, 255, 0.75);
		--base-text-color-4: rgba(255, 255, 255, 0.55);
		--base-border-color: rgba(255, 255, 255, 0.4);
		--base-hover-bg: rgba(255, 255, 255, 0.25);
		--base-border-radius-sm: 1.2;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border-radius: 16px;
	}
	:global(.playground-wrapper.brand-glass .playground-tree) {
		background: rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 14px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
	}
	@media (prefers-color-scheme: dark) {
		:global(.playground-wrapper.brand-glass) {
			background: linear-gradient(135deg, #1a1f4d 0%, #2d1b4d 100%);
		}
	}
	:global(.playground-wrapper.brand-glass[data-theme="dark"]),
	:global(.playground-wrapper.brand-glass[data-bs-theme="dark"]),
	:global(.playground-wrapper.brand-glass.dark),
	:global(.playground-wrapper.brand-glass:has(.stv__container[data-theme="dark"])) {
		background: linear-gradient(135deg, #1a1f4d 0%, #2d1b4d 100%);
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
	.stv__toggle-icon--expand::before,
	.stv__toggle-icon--collapse::before,
	.stv__toggle-icon--expand-alt::before,
	.stv__toggle-icon--collapse-alt::before,
	.stv__toggle-icon--expand-plus::before,
	.stv__toggle-icon--collapse-minus::before,
	.stv__toggle-icon--expand-arrow::before,
	.stv__toggle-icon--collapse-arrow::before {
		font-size: 14px;
		color: #6b7280;
	}

	/* === Dynamic Theme Switching — button row ===
	   Each .theme-btn renders in the accent color of the theme it switches to,
	   so the row reads visually as a color palette. .is-active gets a ring. */
	.theme-switcher-row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-top: 1rem;
	}
	.theme-switcher-row--mode {
		margin-top: 0.5rem;
	}
	.theme-btn {
		padding: 0.5rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 0.375rem;
		cursor: pointer;
		font-weight: 600;
		color: #ffffff;
		transition: transform 0.12s, box-shadow 0.12s, outline 0.12s;
	}
	.theme-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 4px 10px rgba(0, 0, 0, 0.12);
	}
	.theme-btn.is-active {
		outline: 2px solid #1f2937;
		outline-offset: 2px;
	}
	.theme-btn--default  { background: #0d6efd; }
	.theme-btn--material { background: #1976d2; }
	.theme-btn--neon     { background: linear-gradient(135deg, #ff00ff 0%, #00ffff 100%); }
	.theme-btn--sharp    { background: #000000; }
	.theme-btn--soft     { background: #ff6b9d; }
	.theme-btn--forest   { background: #2d6a4f; }
	.theme-btn--glass    {
		background: rgba(255, 255, 255, 0.55);
		color: #1f2937;
		backdrop-filter: blur(6px);
		border: 1px solid rgba(31, 41, 55, 0.2);
	}
	.theme-btn--inherit  { background: #6b7280; }
	.theme-btn--light    {
		background: #ffffff;
		color: #1f2937;
		border: 1px solid #d1d5db;
	}
	.theme-btn--dark     { background: #1f2937; }
</style>
