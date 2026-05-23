<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode, InsertArrayResult } from '$lib/ltree/types.js';

	// Deterministic e2e fixture for path/separator/insertResult features.
	// Targeted by e2e/data.spec.ts. Mirrors /examples/data without tutorial
	// copy, separator config tables, or API reference panels.

	type FileItem = { id: number; path: string; name: string };

	const dotSeparatorData: FileItem[] = [
		{ id: 1, path: '1', name: 'Root' },
		{ id: 2, path: '1.1', name: 'Child 1' },
		{ id: 3, path: '1.2', name: 'Child 2' },
		{ id: 4, path: '1.1.1', name: 'Grandchild' }
	];

	const slashSeparatorData: FileItem[] = [
		{ id: 1, path: 'home', name: '/home' },
		{ id: 2, path: 'home/user', name: '/home/user' },
		{ id: 3, path: 'home/user/documents', name: '/home/user/documents' },
		{ id: 4, path: 'home/user/downloads', name: '/home/user/downloads' },
		{ id: 5, path: 'var', name: '/var' },
		{ id: 6, path: 'var/log', name: '/var/log' }
	];

	const colonSeparatorData: FileItem[] = [
		{ id: 1, path: 'App', name: 'App' },
		{ id: 2, path: 'App::Services', name: 'App::Services' },
		{ id: 3, path: 'App::Services::Auth', name: 'App::Services::Auth' },
		{ id: 4, path: 'App::Models', name: 'App::Models' },
		{ id: 5, path: 'App::Models::User', name: 'App::Models::User' }
	];

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
	<title>Test — Data Fixture</title>
</svelte:head>

<main>
	<h1>Data Test Fixture</h1>

	<div class="card">
		<h2>Path-Based Data Structure</h2>
		<div class="tree-container">
			<Tree
				data={dotSeparatorData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={3}
			>
				{#snippet nodeTemplate(node: LTreeNode<FileItem>)}
					<span>{node.data?.name} <code>({node.path})</code></span>
				{/snippet}
			</Tree>
		</div>
	</div>

	<div class="card">
		<h2>Custom Path Separators</h2>
		<div class="two-up">
			<div class="tree-container">
				<Tree
					data={slashSeparatorData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={3}
					treePathSeparator="/"
				>
					{#snippet nodeTemplate(node: LTreeNode<FileItem>)}
						<span>{node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
			<div class="tree-container">
				<Tree
					data={colonSeparatorData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByName}
					isSorted={true}
					expandLevel={3}
					treePathSeparator="::"
				>
					{#snippet nodeTemplate(node: LTreeNode<FileItem>)}
						<span>{node.data?.name}</span>
					{/snippet}
				</Tree>
			</div>
		</div>
	</div>

	<div class="card">
		<h2>Insert Result and Validation</h2>
		<div class="tree-container">
			<Tree
				data={problematicData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={3}
				bind:insertResult
			>
				{#snippet nodeTemplate(node: LTreeNode<FileItem>)}
					<span>{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>

		{#if insertResult}
			<div class="output">
				<p class="output-label">Insert Result:</p>
				<pre>{JSON.stringify({
					successful: insertResult.successful,
					failed: insertResult.failed.length,
					total: insertResult.total,
					failedDetails: insertResult.failed.map((f) => ({
						originalData: f.originalData,
						error: f.error
					}))
				}, null, 2)}</pre>
			</div>
		{/if}
	</div>
</main>

<style>
	main {
		padding: 1rem;
		font-family: sans-serif;
	}
	h1 {
		margin: 0 0 1rem;
		font-size: 1.2rem;
	}
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
	}
	.card {
		border: 1px solid #ccc;
		padding: 0.75rem;
		margin-bottom: 0.75rem;
		border-radius: 4px;
	}
	.two-up {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.tree-container {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		min-height: 80px;
	}
	.output {
		margin-top: 0.5rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 3px;
		padding: 0.5rem;
	}
	.output-label {
		margin: 0 0 0.25rem;
		font-size: 0.8rem;
		font-weight: 600;
	}
	.output pre {
		margin: 0;
		font-size: 0.8rem;
		white-space: pre-wrap;
	}
</style>
