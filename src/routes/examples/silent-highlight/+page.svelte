<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode } from '$lib/ltree/types.js';
	import RenderModeSwitch from '../RenderModeSwitch.svelte';
	import { getTreeProps } from '../render-mode.svelte.js';

	type Item = { id: number; path: string; name: string; icon: string };

	const sampleData: Item[] = [
		{ id: 1, path: '1', name: 'Documents', icon: '📁' },
		{ id: 2, path: '1.1', name: 'Work', icon: '💼' },
		{ id: 3, path: '1.1.1', name: 'Reports', icon: '📊' },
		{ id: 4, path: '1.1.2', name: 'Presentations', icon: '📽️' },
		{ id: 5, path: '1.2', name: 'Personal', icon: '🏠' },
		{ id: 6, path: '1.2.1', name: 'Photos', icon: '📷' },
		{ id: 7, path: '1.2.2', name: 'Music', icon: '🎵' },
		{ id: 8, path: '1.2.3', name: 'Videos', icon: '🎬' },
		{ id: 9, path: '2', name: 'Downloads', icon: '⬇️' },
		{ id: 10, path: '2.1', name: 'Software', icon: '💿' },
		{ id: 11, path: '2.2', name: 'Media', icon: '🎞️' },
		{ id: 12, path: '3', name: 'Projects', icon: '🚀' },
		{ id: 13, path: '3.1', name: 'Web App', icon: '🌐' },
		{ id: 14, path: '3.1.1', name: 'Frontend', icon: '🎨' },
		{ id: 15, path: '3.1.2', name: 'Backend', icon: '⚙️' },
		{ id: 16, path: '3.2', name: 'Mobile App', icon: '📱' }
	];

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	// ── URL-restore scenario ─────────────────────────────────────────────
	// Imagine the user shares a URL like  /app?nodePath=1.2.3&detailId=42
	// On load the page parses the URL, fetches the detail record into the
	// form, and just needs the tree to scroll + highlight the matching node.
	// Firing onHighlightChange in that flow would re-trigger the form-load
	// listener and cause a loop or wipe the data the URL just supplied.

	let treeRef: Tree<Item>;
	let highlightedPaths = $state(new Set<string>());

	// "Form data" — only updated by onHighlightChange so we can see when
	// it would have been clobbered.
	let formNotes = $state<string>('(form not loaded yet)');
	let highlightChangeFires = $state(0);

	function handleHighlightChange({ paths }: { paths: Set<string> }) {
		highlightChangeFires++;
		// In a real app this is the listener that would re-fetch & overwrite
		// form data based on the newly highlighted node.
		const last = [...paths].pop();
		if (last) formNotes = `Form reloaded for ${last} (overwrote any URL-loaded data)`;
	}

	// Simulated "load from URL" — picks a path + writes some form data, then
	// asks the tree to scroll + highlight either silently or noisily.
	let pathFromUrl = $state('1.2.3');
	let silentMode = $state(true);

	async function simulateUrlLoad() {
		// 1. The page loads form data based on the URL — this is the value
		//    we want to preserve.
		formNotes = `URL-loaded data for "${pathFromUrl}" — do not overwrite`;
		highlightChangeFires = 0;

		// 2. Mark the matching tree node so the user sees what's selected.
		treeRef.highlightNode(pathFromUrl, 'replace', { silent: silentMode });

		// 3. Scroll the tree into view. scrollToPath itself never fires
		//    selection callbacks, only the visual scroll-flash highlight.
		await treeRef.scrollToPath(pathFromUrl, {
			expand: true,
			highlight: true,
			scrollOptions: { behavior: 'smooth', block: 'center' }
		});
	}

	function reset() {
		highlightedPaths = new Set();
		formNotes = '(form not loaded yet)';
		highlightChangeFires = 0;
	}
</script>

<svelte:head>
	<title>Silent Highlight - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>🔕 Silent Highlight</h1>
		<p class="subtitle">Restore tree state from URL parameters without firing selection callbacks</p>
		<RenderModeSwitch />
	</header>

	<div class="card">
		<h2>URL-restore scenario</h2>
		<p class="description">
			You share a link like <code>?nodePath=1.2.3</code>. The page loads form data from the URL,
			and the tree just needs to scroll + visually highlight the matching node.
			Firing <code>onHighlightChange</code> in that flow would re-trigger your form-loader and overwrite
			whatever the URL just supplied.
		</p>

		<p class="description">
			Pass <code>{`{ silent: true }`}</code> to <code>highlightNode()</code> /
			<code>highlightNodes()</code> / <code>clearHighlight()</code> / <code>clearSelection()</code>.
			State (<code>highlightedPaths</code>, <code>isHighlighted</code> CSS class, focused node) still
			updates — only <code>onNodeClick</code> / <code>onHighlightChange</code> / <code>onSelectionChange</code>
			are suppressed.
		</p>

		<div class="controls">
			<label>
				Path from URL:
				<input type="text" bind:value={pathFromUrl} style="width: 100px" />
			</label>
			<label>
				<input type="checkbox" bind:checked={silentMode} />
				silent: true
			</label>
			<button class="btn" onclick={simulateUrlLoad}>Simulate URL load</button>
			<button class="btn btn-secondary" onclick={reset}>Reset</button>
		</div>

		<div class="tree-container tree-container-tall">
			<Tree
				bind:this={treeRef}
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={2}
				highlightedNodeClass="stv__node-content--highlight-bold"
				bind:highlightedPaths
				onHighlightChange={handleHighlightChange}
				{...getTreeProps()}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>

		<div class="output">
			<p class="output-label">Form data (only changes when onHighlightChange fires)</p>
			<pre>{formNotes}</pre>
		</div>

		<div class="output">
			<p class="output-label">onHighlightChange fired</p>
			<pre>{highlightChangeFires} time(s)
{silentMode
	? '→ expected 0 in silent mode'
	: '→ expected 1 in loud mode (form data was overwritten)'}</pre>
		</div>

		<div class="code-block">
			<pre>{`// Restore tree state from URL params without firing onHighlightChange
function restoreFromUrl(nodePath: string) {
  // 1. Load form data based on the URL — preserve this value
  loadFormDataFromUrl(nodePath);

  // 2. Mark the matching node visually — { silent: true } skips
  //    onNodeClick / onHighlightChange so the form-load handler
  //    doesn't re-fire and clobber the data above.
  tree.highlightNode(nodePath, 'replace', { silent: true });

  // 3. Scroll into view (scrollToPath never fires selection events).
  tree.scrollToPath(nodePath, { expand: true, highlight: true });
}`}</pre>
		</div>

		<div class="note">
			<p class="note-title">Also supported</p>
			<p>
				All four methods accept <code>{`{ silent: true }`}</code>:
				<code>highlightNode(path, mode, opts)</code>,
				<code>highlightNodes(paths, opts)</code>,
				<code>clearHighlight(paths?, opts)</code>,
				<code>clearSelection(paths?, opts)</code>.
				The bindable props (<code>highlightedPaths</code>, <code>selectedPaths</code>, <code>focusedNode</code>)
				still sync back to the parent — silent only skips the explicit callbacks.
			</p>
		</div>
	</div>

	<footer>
		<p><a href="/">&larr; Back to Examples</a></p>
	</footer>
</div>
