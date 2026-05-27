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

	function sortByPath(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => a.path.localeCompare(b.path));
	}

	let arrayTreeRef: Tree<Item>;
	let focusTreeRef: Tree<Item>;
</script>

<svelte:head>
	<title>Expand / Collapse - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>🌳 Expand / Collapse</h1>
		<p class="subtitle">
			Array variants and exclusive focus for <code>expandNodes</code>, <code>collapseNodes</code>,
			<code>expandAll</code>, and <code>collapseAll</code>
		</p>
		<RenderModeSwitch />
	</header>

	<div class="card">
		<h2>Array variants</h2>
		<p class="description">
			All four methods accept either a single path or an array of paths. The array form runs once
			and emits a single change notification — useful when you need to open or close several places
			in the tree at the same time.
		</p>

		<div class="controls">
			<button class="btn" onclick={() => arrayTreeRef?.collapseAll()}>Reset (collapseAll)</button>
			<button
				class="btn"
				onclick={() => arrayTreeRef?.expandNodes(['1.1.1', '3.1.2'])}
			>
				expandNodes(['1.1.1', '3.1.2'])
			</button>
			<button class="btn" onclick={() => arrayTreeRef?.expandAll(['1', '3'])}>
				expandAll(['1', '3'])
			</button>
			<button class="btn" onclick={() => arrayTreeRef?.collapseNodes(['1.1', '3.1'])}>
				collapseNodes(['1.1', '3.1'])
			</button>
			<button class="btn btn-secondary" onclick={() => arrayTreeRef?.collapseAll(['1', '3'])}>
				collapseAll(['1', '3'])
			</button>
		</div>

		<div class="tree-container tree-container-tall">
			<Tree
				bind:this={arrayTreeRef}
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByPath}
				isSorted={true}
				expandLevel={0}
				{...getTreeProps()}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>

		<div class="code-block">
			<pre>{`// Open multiple spines in one pass
tree.expandNodes(['1.1.1', '3.1.2']);

// Open entire subtrees
tree.expandAll(['1', '3']);

// Close several endpoints (spine ancestors stay open)
tree.collapseNodes(['1.1', '3.1']);

// Close entire subtrees
tree.collapseAll(['1', '3']);`}</pre>
		</div>
	</div>

	<div class="card">
		<h2>Exclusive focus</h2>
		<p class="description">
			Pass <code>{`{ exclusive: true }`}</code> to <code>expandNodes</code> or
			<code>expandAll</code> to open the target path <em>and</em> collapse everything currently
			open that isn't on its spine. Equivalent to <code>collapseAll() + expandNodes(path)</code> —
			but in a single pass with one emit, so listeners and CSS animations don't see the
			intermediate "all collapsed" state.
		</p>

		<div class="controls">
			<button class="btn" onclick={() => focusTreeRef?.expandAll()}>Open everything (reset)</button>
			<button
				class="btn"
				onclick={() => focusTreeRef?.expandNodes('1.1.1', { exclusive: true })}
			>
				Focus on 1.1.1
			</button>
			<button
				class="btn"
				onclick={() => focusTreeRef?.expandNodes(['1.1.1', '3.1.2'], { exclusive: true })}
			>
				Focus on 1.1.1 + 3.1.2
			</button>
			<button
				class="btn"
				onclick={() => focusTreeRef?.expandAll('1', { exclusive: true })}
			>
				Focus on whole "Documents" subtree
			</button>
			<button
				class="btn"
				onclick={() => focusTreeRef?.expandAll('3.1', { exclusive: true })}
			>
				Focus on "Web App" subtree
			</button>
		</div>

		<div class="tree-container tree-container-tall">
			<Tree
				bind:this={focusTreeRef}
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByPath}
				isSorted={true}
				expandLevel={3}
				{...getTreeProps()}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>

		<div class="code-block">
			<pre>{`// "Focus" — open this path, close everything else. Single emit.
tree.expandNodes('1.1.1', { exclusive: true });

// Multi-focus — union of spines stays open, rest collapses.
tree.expandNodes(['1.1.1', '3.1.2'], { exclusive: true });

// "Focus on whole subtree" — opens the spine to the target AND its
// full subtree; collapses everything outside.
tree.expandAll('1', { exclusive: true });`}</pre>
		</div>

		<div class="note">
			<p class="note-title">When to use exclusive</p>
			<p>
				Best for "spotlight" or "drill-in" UX where you want a single branch in focus. Without
				<code>exclusive</code>, doing the same thing with <code>collapseAll()</code> followed by
				<code>expandNodes(path)</code> works, but emits twice — downstream listeners (transition
				animations, sync to a URL, virtualized renderers) see the intermediate fully-collapsed
				state. <code>exclusive: true</code> walks only currently-expanded nodes (cheap) and
				emits once.
			</p>
		</div>
	</div>

	<div class="card">
		<h2>API</h2>
		<div class="code-block">
			<pre>{`expandNodes(path: string | string[], options?: { exclusive?: boolean; noEmit?: boolean })
collapseNodes(path: string | string[], options?: { noEmit?: boolean })

expandAll(nodePath?: string | string[] | null, options?: { exclusive?: boolean; noEmit?: boolean })
collapseAll(nodePath?: string | string[] | null, options?: { noEmit?: boolean })`}</pre>
		</div>
		<p class="description">
			<code>noEmit: true</code> suppresses the change notification — handy when you want to batch
			several calls and emit once at the end via <code>tree.refresh()</code>.
		</p>
	</div>

	<footer>
		<p><a href="/">&larr; Back to Examples</a></p>
	</footer>
</div>
