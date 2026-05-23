<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import ContextMenuItemC from '$lib/components/ContextMenuItem.svelte';
	import ContextMenuDividerC from '$lib/components/ContextMenuDivider.svelte';
	import type { LTreeNode, ContextMenuEntry } from '$lib/ltree/types.js';

	// Deterministic e2e fixture for the context-menu feature. Targeted by
	// e2e/context-menu.spec.ts. Mirrors the menu logic from
	// /examples/context-menu but strips tutorial copy, render-mode switch,
	// offset inputs, and API reference panels — only the surface the spec
	// asserts on is rendered.

	type FileItem = {
		id: number;
		path: string;
		name: string;
		icon: string;
		type: 'folder' | 'file';
		readonly?: boolean;
	};

	const sampleData: FileItem[] = [
		{ id: 1, path: '1', name: 'Documents', icon: '📁', type: 'folder' },
		{ id: 2, path: '1.1', name: 'Reports', icon: '📊', type: 'folder' },
		{ id: 3, path: '1.1.1', name: 'Q1 Report.pdf', icon: '📄', type: 'file' },
		{ id: 4, path: '1.1.2', name: 'Q2 Report.pdf', icon: '📄', type: 'file', readonly: true },
		{ id: 5, path: '1.2', name: 'Notes.txt', icon: '📝', type: 'file' },
		{ id: 6, path: '2', name: 'Images', icon: '🖼️', type: 'folder' },
		{ id: 7, path: '2.1', name: 'Photo.jpg', icon: '📷', type: 'file' },
		{ id: 8, path: '2.2', name: 'Logo.png', icon: '🎨', type: 'file' }
	];

	let activityLog = $state<string[]>([]);
	let snippetLog = $state<string[]>([]);
	let debugMode = $state(false);

	function sortByName(items: LTreeNode<FileItem>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	function addLog(message: string) {
		activityLog = [...activityLog.slice(-9), message];
	}

	function addSnippetLog(message: string) {
		snippetLog = [...snippetLog.slice(-9), message];
	}

	function clearLog() {
		activityLog = [];
	}

	function clearSnippetLog() {
		snippetLog = [];
	}

	function getContextMenu(node: LTreeNode<FileItem>, close: () => void): ContextMenuEntry[] {
		const isFolder = node.data?.type === 'folder';
		const isReadonly = node.data?.readonly;
		const entries: ContextMenuEntry[] = [];

		if (isFolder) {
			entries.push({
				icon: '📄',
				label: 'New File',
				shortcut: 'N',
				onclick: () => { addLog(`New file in "${node.data?.name}"`); close(); }
			});
			entries.push({
				icon: '📁',
				label: 'New Folder',
				shortcut: 'Shift+N',
				onclick: () => { addLog(`New folder in "${node.data?.name}"`); close(); }
			});
			entries.push({ divider: true });
		}

		entries.push({
			icon: '📋',
			label: 'Copy',
			shortcut: 'C',
			onclick: () => { addLog(`Copied "${node.data?.name}"`); close(); }
		});

		entries.push({
			icon: '✂️',
			label: 'Cut',
			shortcut: 'X',
			isDisabled: isReadonly,
			onclick: () => { addLog(`Cut "${node.data?.name}"`); close(); }
		});

		entries.push({
			icon: '📥',
			label: 'Paste',
			shortcut: 'V',
			isDisabled: !isFolder,
			onclick: () => { addLog(`Paste into "${node.data?.name}"`); close(); }
		});

		entries.push({
			icon: '📤',
			label: 'Export As...',
			children: [
				{ label: 'JSON', shortcut: 'J', onclick: () => { addLog(`Export "${node.data?.name}" as JSON`); close(); } },
				{ label: 'XML', shortcut: 'X', onclick: () => { addLog(`Export "${node.data?.name}" as XML`); close(); } },
				{ label: 'CSV', shortcut: 'C', onclick: () => { addLog(`Export "${node.data?.name}" as CSV`); close(); } }
			]
		});

		entries.push({ divider: true, label: 'Danger zone' });

		entries.push({
			icon: '✏️',
			label: 'Rename',
			shortcut: 'F2',
			isDisabled: isReadonly,
			onclick: () => { addLog(`Rename "${node.data?.name}"`); close(); }
		});

		entries.push({
			icon: '🗑️',
			label: 'Delete',
			className: 'danger',
			isDisabled: isReadonly,
			onclick: () => { addLog(`Delete "${node.data?.name}"`); close(); }
		});

		entries.push({
			icon: '🔒',
			label: 'Read-only file',
			isDisabled: true,
			isVisible: !!isReadonly
		});

		return entries;
	}
</script>

<svelte:head>
	<title>Test — Context Menu Fixture</title>
</svelte:head>

<main>
	<h1>Context Menu Test Fixture</h1>

	<div class="card">
		<h2>Callback Approach</h2>
		<div class="controls">
			<label>
				<input type="checkbox" bind:checked={debugMode} />
				Debug Mode (menu appears at fixed position)
			</label>
			<button onclick={clearLog}>Clear Log</button>
		</div>

		<div class="tree-container">
			<Tree
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={3}
				getContextMenuItemsCallback={getContextMenu}
				shouldDisplayContextMenuInDebugMode={debugMode}
			>
				{#snippet nodeTemplate(node: LTreeNode<FileItem>)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>

		{#if activityLog.length > 0}
			<div class="output">
				<pre>{activityLog.join('\n')}</pre>
			</div>
		{/if}
	</div>

	<div class="card">
		<h2>Snippet + Component Approach</h2>
		<div class="controls">
			<button onclick={clearSnippetLog}>Clear Log</button>
		</div>

		<div class="tree-container">
			<Tree
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={3}
			>
				{#snippet nodeTemplate(node: LTreeNode<FileItem>)}
					<span>{node.data?.icon} {node.data?.name}</span>
				{/snippet}
				{#snippet contextMenu(node: LTreeNode<FileItem>, close: () => void)}
					<ContextMenuItemC
						label="Copy"
						icon="📋"
						shortcut="C"
						onclick={() => { addSnippetLog(`Copied "${node.data?.name}"`); close(); }}
					/>
					<ContextMenuItemC
						label="Cut"
						icon="✂️"
						shortcut="X"
						isDisabled={!!node.data?.readonly}
						onclick={() => { addSnippetLog(`Cut "${node.data?.name}"`); close(); }}
					/>
					{#if node.data?.type === 'folder'}
						<ContextMenuItemC label="Export As..." icon="📤">
							<ContextMenuItemC
								label="JSON"
								shortcut="J"
								onclick={() => { addSnippetLog(`Export "${node.data?.name}" as JSON`); close(); }}
							/>
							<ContextMenuItemC
								label="XML"
								shortcut="X"
								onclick={() => { addSnippetLog(`Export "${node.data?.name}" as XML`); close(); }}
							/>
						</ContextMenuItemC>
					{/if}
					<ContextMenuDividerC label="Danger zone" />
					<ContextMenuItemC
						label="Delete"
						icon="🗑️"
						className="danger"
						isDisabled={!!node.data?.readonly}
						onclick={() => { addSnippetLog(`Delete "${node.data?.name}"`); close(); }}
					/>
				{/snippet}
			</Tree>
		</div>

		{#if snippetLog.length > 0}
			<div class="output">
				<pre>{snippetLog.join('\n')}</pre>
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
	.controls {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
		font-size: 0.85rem;
	}
	.tree-container {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		min-height: 80px;
		max-width: 480px;
	}
	.output {
		margin-top: 0.5rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 3px;
		padding: 0.5rem;
	}
	.output pre {
		margin: 0;
		font-size: 0.8rem;
		white-space: pre-wrap;
	}
</style>
