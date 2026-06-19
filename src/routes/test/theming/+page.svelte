<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';

	// Deterministic e2e fixture for theming. Each "scenario" card shows the SAME
	// Debug brand theme under one dark-mode signal. The Debug theme's colors are
	// intentionally stark: RED surface in light mode, GREEN surface in dark mode,
	// black/white border, yellow/cyan accent. Visual or programmatic inspection
	// makes it trivial to verify which signal is winning.
	//
	// Targeted by e2e/theming.spec.ts.

	type Item = { id: number; path: string; name: string };

	const sampleData: Item[] = [
		{ id: 1, path: '1', name: 'Documents' },
		{ id: 2, path: '1.1', name: 'Work' },
		{ id: 3, path: '1.2', name: 'Personal' },
		{ id: 4, path: '2', name: 'Downloads' }
	];

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	let pageScheme = $state<'normal' | 'dark' | 'light'>('normal');

	$effect(() => {
		if (typeof document === 'undefined') return;
		const html = document.documentElement;
		const prev = html.style.colorScheme;
		html.style.colorScheme = pageScheme === 'normal' ? '' : pageScheme;
		return () => { html.style.colorScheme = prev; };
	});
</script>

<svelte:head>
	<title>Test — Theming Scenarios</title>
</svelte:head>

<main>
	<h1>Theming Scenarios — Debug brand theme</h1>
	<p>
		Same Debug brand theme in every card. Light = <strong>RED surface</strong>,
		dark = <strong>GREEN surface</strong>. The card heading tells you which
		signal is meant to be winning.
	</p>

	<div class="page-controls">
		<fieldset>
			<legend>Page <code>color-scheme</code> on <code>&lt;html&gt;</code></legend>
			<label><input type="radio" bind:group={pageScheme} value="normal" /> normal</label>
			<label><input type="radio" bind:group={pageScheme} value="dark" /> dark</label>
			<label><input type="radio" bind:group={pageScheme} value="light" /> light</label>
		</fieldset>
	</div>

	<div class="grid">
		<!-- 1. No signal — should be LIGHT (red surface) -->
		<div class="card" data-scenario="baseline-light">
			<h2>1. No signal (baseline light)</h2>
			<p>No prop, no ancestor class. Expected: <strong>RED</strong>.</p>
			<div class="wrapper brand-debug">
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={2}
				>
					{#snippet nodeTemplate(node: LTreeNode<Item>)}
						<span>{node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
		</div>

		<!-- 2. Per-instance theme="dark" — should be DARK (green surface) -->
		<div class="card" data-scenario="per-instance-dark">
			<h2>2. Per-instance <code>theme="dark"</code></h2>
			<p>Forwarded as <code>data-theme="dark"</code> on <code>.stv__container</code>. Expected: <strong>GREEN</strong>.</p>
			<div class="wrapper brand-debug">
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={2}
					theme="dark"
				>
					{#snippet nodeTemplate(node: LTreeNode<Item>)}
						<span>{node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
		</div>

		<!-- 3. Per-instance theme="light" — should be LIGHT (red surface) -->
		<div class="card" data-scenario="per-instance-light">
			<h2>3. Per-instance <code>theme="light"</code></h2>
			<p>Force light on a dark page would also use this. Expected: <strong>RED</strong>.</p>
			<div class="wrapper brand-debug">
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={2}
					theme="light"
				>
					{#snippet nodeTemplate(node: LTreeNode<Item>)}
						<span>{node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
		</div>

		<!-- 4. Ancestor [data-theme="dark"] — should be DARK -->
		<div class="card" data-scenario="ancestor-data-theme-dark">
			<h2>4. Ancestor <code>[data-theme="dark"]</code></h2>
			<p>Generic framework theme convention. Expected: <strong>GREEN</strong>.</p>
			<div class="wrapper brand-debug" data-theme="dark">
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={2}
				>
					{#snippet nodeTemplate(node: LTreeNode<Item>)}
						<span>{node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
		</div>

		<!-- 5. Ancestor [data-bs-theme="dark"] — Bootstrap 5.3+ -->
		<div class="card" data-scenario="ancestor-data-bs-theme-dark">
			<h2>5. Ancestor <code>[data-bs-theme="dark"]</code></h2>
			<p>Bootstrap 5.3+ convention. Expected: <strong>GREEN</strong>.</p>
			<div class="wrapper brand-debug" data-bs-theme="dark">
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={2}
				>
					{#snippet nodeTemplate(node: LTreeNode<Item>)}
						<span>{node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
		</div>

		<!-- 6. Ancestor .dark — Tailwind -->
		<div class="card" data-scenario="ancestor-dark-class">
			<h2>6. Ancestor <code>.dark</code> (Tailwind)</h2>
			<p>Tailwind class-mode dark convention. Expected: <strong>GREEN</strong>.</p>
			<div class="wrapper brand-debug dark">
				<Tree
					data={sampleData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={2}
				>
					{#snippet nodeTemplate(node: LTreeNode<Item>)}
						<span>{node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
		</div>
	</div>
</main>

<style>
	main {
		max-width: 1400px;
		margin: 0 auto;
		padding: 1.5rem;
		font-family: system-ui, sans-serif;
	}
	h1 {
		margin: 0 0 0.5rem;
	}
	.page-controls fieldset {
		display: inline-flex;
		gap: 1rem;
		padding: 0.5rem 1rem;
		border: 1px solid #ccc;
		border-radius: 6px;
		margin: 1rem 0;
	}
	.page-controls legend {
		font-weight: 600;
		font-size: 0.85rem;
	}
	.page-controls label {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.875rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
		gap: 1rem;
	}
	.card {
		border: 1px solid #ccc;
		border-radius: 6px;
		padding: 0.75rem;
	}
	.card h2 {
		margin: 0 0 0.25rem;
		font-size: 1rem;
	}
	.card p {
		margin: 0 0 0.75rem;
		font-size: 0.85rem;
		color: #555;
	}
	.wrapper {
		padding: 0.75rem;
		border-radius: 6px;
	}

	/* ============================================================================
	   DEBUG BRAND THEME — intentionally stark, easy to verify visually and in tests.
	   ============================================================================
	   Light mode: RED surface, WHITE text, YELLOW accent, BLACK border.
	   Dark mode:  GREEN surface, WHITE text, CYAN accent, WHITE border.

	   The theme uses BOTH approaches so all four dark-mode signals are exercised:
	     (1) light-dark() in --base-* values for page color-scheme + OS preference
	     (2) Explicit dark-variant rules keyed to ancestor classes + per-instance
	         theme prop (these don't set color-scheme, so light-dark() can't catch
	         them).
	   ============================================================================ */

	/* Wrapped in :global() because Svelte's CSS scoper otherwise (a) appends a
	   scope hash that varies the specificity unpredictably between the base and
	   dark-variant rules, and (b) drops :has() + ancestor :is() selectors as
	   "unused" because static analysis can't see runtime data-theme attributes
	   on the inner Tree component. With :global, every selector is plain CSS. */

	:global(.wrapper.brand-debug) {
		/* Approach (1): light-dark() — catches signals #1 (OS) and #3 (page scheme). */
		--base-accent-color: light-dark(#fbbf24, #06b6d4);
		--base-main-bg: light-dark(#dc2626, #16a34a);
		--base-elevated-bg: light-dark(#ef4444, #22c55e);
		--base-input-bg: light-dark(#dc2626, #16a34a);
		--base-text-color-1: light-dark(#ffffff, #ffffff);
		--base-text-color-3: light-dark(#fef2f2, #f0fdf4);
		--base-text-color-4: light-dark(#fee2e2, #dcfce7);
		--base-border-color: light-dark(#000000, #ffffff);
		--base-hover-bg: light-dark(#b91c1c, #15803d);
		--base-border-radius-sm: 0.6;
	}

	/* OS preference — light-dark() above won't flip without color-scheme declared,
	   so this @media block forces the dark palette when the OS prefers dark. */
	@media (prefers-color-scheme: dark) {
		:global(.wrapper.brand-debug) {
			--base-accent-color: #06b6d4;
			--base-main-bg: #16a34a;
			--base-elevated-bg: #22c55e;
			--base-input-bg: #16a34a;
			--base-text-color-1: #ffffff;
			--base-text-color-3: #f0fdf4;
			--base-text-color-4: #dcfce7;
			--base-border-color: #ffffff;
			--base-hover-bg: #15803d;
		}
	}

	/* Approach (2): explicit dark variant — catches signals #2 (framework class on
	   ancestor), #4 (ancestor attribute), #5 (per-instance prop on tree). These
	   selectors don't change color-scheme, so light-dark() stays on its light
	   branch; this rule overrides with the dark values directly. */
	:global(.wrapper.brand-debug[data-theme="dark"]),
	:global(.wrapper.brand-debug[data-bs-theme="dark"]),
	:global(.wrapper.brand-debug.dark),
	:global([data-theme="dark"] .wrapper.brand-debug),
	:global([data-bs-theme="dark"] .wrapper.brand-debug),
	:global(.dark .wrapper.brand-debug),
	:global(.wrapper.brand-debug:has(.stv__container[data-theme="dark"])) {
		--base-accent-color: #06b6d4;
		--base-main-bg: #16a34a;
		--base-elevated-bg: #22c55e;
		--base-input-bg: #16a34a;
		--base-text-color-1: #ffffff;
		--base-text-color-3: #f0fdf4;
		--base-text-color-4: #dcfce7;
		--base-border-color: #ffffff;
		--base-hover-bg: #15803d;
	}
</style>
