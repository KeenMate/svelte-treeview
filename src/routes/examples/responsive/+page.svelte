<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';
	import type { ElementSize, DeviceClass, NodeTitleOverflow } from '$lib/index.js';
	import iscoRaw from './isco08.json' with { type: 'json' };

	// Real data — the full ISCO-08 occupation classification (619 groups):
	// 10 major → 43 sub-major → 130 minor → 436 unit. Dot-separated `path`, ISCO
	// `value` as the id. Same dataset as web-multiselect's TR09.
	type Isco = {
		label: string;
		value: string;
		path: string;
		fullTitle: string;
		selectable: boolean;
	};
	const iscoData = iscoRaw as Isco[];

	// Siblings at every level share a fixed digit-count, so a plain path compare sorts correctly.
	function sortByPath(items: LTreeNode<Isco>[]) {
		return [...items].sort((a, b) => a.path.localeCompare(b.path));
	}

	// ── RS01: bindable containerSize → a $derived setting ──────────────────
	let box = $state<ElementSize>();
	// The whole point: a plain reactive derivation over the tree's OWN box.
	const isNarrow = $derived(!!box && box.width < 460);
	let width1 = $state(620);

	// ── RS02: onContainerResize callback → device-adaptive settings ────────
	let cbWidth = $state<number | null>(null);
	let device = $state<DeviceClass | null>(null);
	let adaptiveExpandLevel = $state(2);
	let width2 = $state(620);

	const levelName: Record<number, string> = {
		1: 'major groups only',
		2: 'major → sub-major',
		3: 'down to minor groups',
		4: 'full depth (unit groups)'
	};

	// ── RS04: nodeTitleOverflow prop ───────────────────────────────────────
	let overflowMode = $state<NodeTitleOverflow>('info');
	const overflowModes: NodeTitleOverflow[] = ['wrap', 'ellipsis', 'info'];

	function onContainerResize(size: ElementSize, deviceClass: DeviceClass) {
		cbWidth = Math.round(size.width);
		device = deviceClass;
		// Pick depth by BOTH the device class (capability) and the live box width —
		// exactly the AB10 pattern, but keyed on the tree's own container instead of the window.
		if (deviceClass === 'mobile' || size.width < 380) adaptiveExpandLevel = 1;
		else if (size.width < 560) adaptiveExpandLevel = 2;
		else adaptiveExpandLevel = 3;
	}
</script>

<svelte:head>
	<title>Responsive - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>Responsive</h1>
		<p class="subtitle">
			The tree renders inline and never pops out — but it exposes a live signal of its own
			container box (and the device) so <em>you</em> can adapt settings to the available space.
			Two surfaces, one shared <code>ResizeObserver</code>: a bindable <code>containerSize</code>
			for declarative reads, and an <code>onContainerResize</code> callback for imperative reactions.
			Every demo below runs on the <strong>full ISCO-08 occupation classification</strong> — 619
			groups, four levels deep.
		</p>
	</header>

	<!-- RS01 -->
	<div class="card">
		<h2>RS01 · Container-Size Signal (bindable)</h2>
		<p class="description">
			<code>bind:containerSize</code> gives you the tree's live border-box as reactive
			<code>$state</code>. Drag the container's resize handle (or use the buttons) and watch a
			plain <code>$derived</code> flip — here, <code>box.width &lt; 460</code> drives a
			<code>compact</code> class that adapts the row itself: wide rows show the
			<strong>ISCO code + title</strong>, narrow rows drop the code and tighten indentation so the
			long occupation titles still fit. No listeners, no <code>onMount</code>, no teardown: resize →
			<code>$state</code> updates → <code>$derived</code> recomputes → the rows re-flow.
		</p>

		<div class="controls">
			<span class="controls-label">Width:</span>
			<button class="btn {width1 === 360 ? '' : 'btn-secondary'}" onclick={() => (width1 = 360)}>360px</button>
			<button class="btn {width1 === 460 ? '' : 'btn-secondary'}" onclick={() => (width1 = 460)}>460px</button>
			<button class="btn {width1 === 620 ? '' : 'btn-secondary'}" onclick={() => (width1 = 620)}>620px</button>
		</div>

		<div class="output">
			<p class="output-label">Live signal:</p>
			<pre>box = {box ? `{ width: ${Math.round(box.width)}, height: ${Math.round(box.height)} }` : '(measuring…)'}
isNarrow = {isNarrow}   →   {isNarrow ? 'compact rows (title only)' : 'comfortable rows (code + title)'}</pre>
		</div>

		<div class="resize-box" style="width: {width1}px;" class:compact={isNarrow}>
			<Tree
				data={iscoData}
				idMember="value"
				pathMember="path"
				sortCallback={sortByPath}
				isSorted={true}
				displayValueMember="label"
				expandLevel={2}
				bind:containerSize={box}
			>
				{#snippet nodeTemplate(node: any)}
					<span class="isco-row">
						<span class="isco-code">{node.data?.value}</span>
						<span class="isco-label">{node.data?.label}</span>
					</span>
				{/snippet}
			</Tree>
		</div>
		<p class="hint">↔ The box has a native resize handle (bottom-right) — drag it to cross 460px.</p>

		<div class="code-block"><pre>{`<` + `script lang="ts">
  import { Tree } from '@keenmate/svelte-treeview';
  import type { ElementSize } from '@keenmate/svelte-treeview';

  let box = $state<ElementSize>();
  // A plain reactive derivation over the tree's OWN container box:
  const isNarrow = $derived(!!box && box.width < 460);
<` + `/script>

<div class:compact={isNarrow}>
  <Tree data={iscoData} idMember="value" pathMember="path" {sortCallback}
        displayValueMember="label" bind:containerSize={box}>
    {#snippet nodeTemplate(node)}
      <span class="isco-row">
        <span class="isco-code">{node.data.value}</span>   <!-- hidden by .compact -->
        <span class="isco-label">{node.data.label}</span>
      </span>
    {/snippet}
  </Tree>
</div>`}</pre></div>
	</div>

	<!-- RS02 -->
	<div class="card">
		<h2>RS02 · Device-Adaptive Depth (callback)</h2>
		<p class="description">
			The <code>onContainerResize(size, deviceClass)</code> callback is the imperative twin —
			fired immediately on mount, then on every (throttled) resize. It also hands you the
			<strong>device class</strong> (<code>classifyDevice</code>: capability + physical size,
			orientation-robust), so you can pick settings by <em>both</em> device and width — the AB10
			pattern, keyed on the tree's own container. With 619 groups the natural knob is how much of
			the hierarchy to reveal by default: a roomy box opens to minor groups, a tight one shows only
			the ten major groups.
		</p>

		<div class="controls">
			<span class="controls-label">Width:</span>
			<button class="btn {width2 === 360 ? '' : 'btn-secondary'}" onclick={() => (width2 = 360)}>360px</button>
			<button class="btn {width2 === 500 ? '' : 'btn-secondary'}" onclick={() => (width2 = 500)}>500px</button>
			<button class="btn {width2 === 620 ? '' : 'btn-secondary'}" onclick={() => (width2 = 620)}>620px</button>
		</div>

		<div class="output">
			<p class="output-label">Resolved config:</p>
			<pre>container = {cbWidth ?? '–'}px   ·   deviceClass = {device ?? '–'}
→ expandLevel = {adaptiveExpandLevel}   ({levelName[adaptiveExpandLevel]})</pre>
		</div>

		<div class="resize-box" style="width: {width2}px;">
			<Tree
				data={iscoData}
				idMember="value"
				pathMember="path"
				sortCallback={sortByPath}
				isSorted={true}
				displayValueMember="label"
				expandLevel={adaptiveExpandLevel}
				{onContainerResize}
			>
				{#snippet nodeTemplate(node: any)}
					<span class="isco-row">
						<span class="isco-code">{node.data?.value}</span>
						<span class="isco-label">{node.data?.label}</span>
					</span>
				{/snippet}
			</Tree>
		</div>

		<div class="code-block"><pre>{`import type { ElementSize, DeviceClass } from '@keenmate/svelte-treeview';

let expandLevel = $state(2);

function onContainerResize(size: ElementSize, deviceClass: DeviceClass) {
  // capability first, then width — same decision shape as AB10
  if (deviceClass === 'mobile' || size.width < 380) expandLevel = 1; // major groups
  else if (size.width < 560)                        expandLevel = 2; // + sub-major
  else                                              expandLevel = 3; // + minor
}

// <Tree data={iscoData} idMember="value" pathMember="path"
//       {expandLevel} {onContainerResize} />`}</pre></div>
	</div>

	<!-- RS03 -->
	<div class="card">
		<h2>RS03 · Label Overflow — wrap / ellipsis / info</h2>
		<p class="description">
			The companion to the responsive signal: what a single node label does when it's wider than
			the row. <code>nodeTitleOverflow</code> takes <code>wrap</code> (default — the label wraps,
			the row grows taller), <code>ellipsis</code> (one line, clipped with …), or
			<code>info</code> (ellipsis <em>plus</em> a trailing ⓘ that appears <strong>only on rows whose
			label is actually clipped</strong> — click it to reveal the full title). ISCO occupation
			titles are long, so in this deliberately narrow box the difference is obvious. The ⓘ is the
			touch/no-hover substitute for the native <code>title</code> tooltip (which <code>info</code>
			mode also sets on clipped rows).
		</p>

		<div class="controls">
			<span class="controls-label">nodeTitleOverflow:</span>
			{#each overflowModes as m (m)}
				<button
					class="btn {overflowMode === m ? '' : 'btn-secondary'}"
					onclick={() => (overflowMode = m)}
				>{m}</button>
			{/each}
		</div>

		<div class="resize-box" style="width: 340px;">
			<Tree
				data={iscoData}
				idMember="value"
				pathMember="path"
				sortCallback={sortByPath}
				isSorted={true}
				displayValueMember="label"
				expandLevel={3}
				nodeTitleOverflow={overflowMode}
			/>
		</div>
		<p class="hint">
			In <code>info</code> mode, expand a group and click the ⓘ on a long occupation title.
		</p>

		<div class="code-block"><pre>{`<Tree data={iscoData} idMember="value" pathMember="path" {sortCallback}
      displayValueMember="label"
      nodeTitleOverflow="info" />   <!-- 'wrap' | 'ellipsis' | 'info' -->`}</pre></div>
	</div>

	<!-- RS04 -->
	<div class="card">
		<h2>RS04 · App-Level Signal (raw observers)</h2>
		<p class="description">
			The same primitives are re-exported for use <em>outside</em> a Svelte component — the exact
			signal the tree consumes internally, so an app reacts to the <em>event that tells it the
			device and width</em> and configures accordingly (true AB10 parity). Zero-dependency,
			SSR-safe, and ref-counted (one shared <code>matchMedia</code>/<code>ResizeObserver</code>
			for the whole page).
		</p>

		<div class="code-block"><pre>{`import {
  observeViewport,     // continuous window size (throttled ~30ms)
  observeEnvironment,  // discrete flips only: breakpoint / orientation / pointer / hover
  observeElementSize,  // one element's border-box (shared ResizeObserver)
  classifyDevice       // 'mobile' | 'tablet' | 'desktop' (capability + size)
} from '@keenmate/svelte-treeview';

// Window + device (AB10):
const stop = observeViewport((env) => {
  const device = classifyDevice(env);          // orientation-robust
  toolbar = device === 'mobile' ? essentials : fullToolbar;
  layout  = env.viewportWidth <= 600 ? 'wrap' : 'nowrap';
});

// A specific element's box (container queries in JS):
const stopBox = observeElementSize(el, ({ width }) => {
  el.classList.toggle('compact', width < 460);
});

// each returns an unsubscribe → call on teardown
stop(); stopBox();`}</pre></div>

		<div class="note">
			<p class="note-title">How it works</p>
			<p>
				These primitives are transferred 1:1 from <code>@keenmate/web-components-core</code>
				(the same device/viewport engine our web components use) and vendored under
				<code>src/lib/vendor/environment</code>. Detection is <strong>feature detection</strong>
				(media queries), not UA sniffing, so it reacts to orientation flips, a resize, or plugging
				in a mouse. The runes bridge (<code>containerSize</code>/<code>environmentState</code>)
				turns each imperative <code>subscribe → unsubscribe</code> into reactive
				<code>$state</code>: the subscription's unsubscribe becomes the <code>$effect</code>
				cleanup, so lifetime management is automatic. The tree itself changes nothing on this
				signal — it only surfaces it.
			</p>
		</div>
	</div>
</div>

<style>
	.resize-box {
		border: 1px solid var(--border-color, #d1d5db);
		border-radius: 8px;
		padding: 0.5rem;
		background: var(--stv-bg, #fff);
		overflow: auto;
		resize: horizontal;
		height: 380px;
		min-width: 280px;
		max-width: 100%;
	}
	.isco-row {
		display: inline-flex;
		align-items: baseline;
		gap: 0.5rem;
		min-width: 0;
	}
	.isco-code {
		flex: none;
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		color: #fff;
		background: var(--accent-color, #6366f1);
		border-radius: 4px;
		padding: 0.05rem 0.35rem;
	}
	.isco-label {
		min-width: 0;
	}
	/* RS01: the $derived flips this class, which adapts the rows to a tight box. */
	.resize-box.compact :global(.stv__container) {
		--stv-node-indent-per-level: 0.45rem;
		font-size: 0.85rem;
	}
	.resize-box.compact .isco-code {
		display: none;
	}
	.hint {
		font-size: 0.85rem;
		color: var(--text-muted, #6b7280);
		margin: 0.4rem 0 0;
	}
</style>
