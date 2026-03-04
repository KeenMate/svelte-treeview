<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode, ContextMenuItem } from '$lib/ltree/types.js';
	import RenderModeSwitch from '../RenderModeSwitch.svelte';
	import { getTreeProps } from '../render-mode.svelte.js';

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
	let debugMode = $state(false);

	function sortByName(items: LTreeNode<FileItem>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	function addLog(message: string) {
		activityLog = [...activityLog.slice(-9), `${new Date().toLocaleTimeString()} - ${message}`];
	}

	function clearLog() {
		activityLog = [];
	}

	// Context menu callback - returns different menus based on node type
	function getContextMenu(node: LTreeNode<FileItem>): ContextMenuItem[] {
		const isFolder = node.data?.type === 'folder';
		const isReadonly = node.data?.readonly;

		const items: ContextMenuItem[] = [];

		if (isFolder) {
			items.push({
				icon: '📄',
				title: 'New File',
				callback: () => addLog(`New file in "${node.data?.name}"`)
			});
			items.push({
				icon: '📁',
				title: 'New Folder',
				callback: () => addLog(`New folder in "${node.data?.name}"`)
			});
			items.push({ isDivider: true, title: '', callback: () => {} });
		}

		items.push({
			icon: '📋',
			title: 'Copy',
			callback: () => addLog(`Copied "${node.data?.name}"`)
		});

		items.push({
			icon: '✂️',
			title: 'Cut',
			isDisabled: isReadonly,
			callback: () => addLog(`Cut "${node.data?.name}"`)
		});

		items.push({
			icon: '📥',
			title: 'Paste',
			isDisabled: !isFolder,
			callback: () => addLog(`Paste into "${node.data?.name}"`)
		});

		items.push({ isDivider: true, title: '', callback: () => {} });

		items.push({
			icon: '✏️',
			title: 'Rename',
			isDisabled: isReadonly,
			callback: () => addLog(`Rename "${node.data?.name}"`)
		});

		items.push({
			icon: '🗑️',
			title: 'Delete',
			isDisabled: isReadonly,
			callback: () => addLog(`Delete "${node.data?.name}"`)
		});

		if (isReadonly) {
			items.push({ isDivider: true, title: '', callback: () => {} });
			items.push({
				icon: '🔒',
				title: 'Read-only file',
				isDisabled: true,
				callback: () => {}
			});
		}

		return items;
	}
</script>

<svelte:head>
	<title>Context Menu Examples - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>📋 Context Menu Examples</h1>
		<p class="subtitle">Right-click context menus with callbacks, icons, and dynamic items</p>
		<RenderModeSwitch />
	</header>

	<!-- Dynamic Context Menu -->
	<div class="card">
		<h2>Dynamic Context Menu</h2>
		<p class="description">Right-click on any node to see a context menu. The menu items change based on whether it's a folder or file, and whether it's read-only.</p>

		<div class="controls">
			<label>
				<input type="checkbox" bind:checked={debugMode} />
				Debug Mode (menu appears at fixed position)
			</label>
			<button class="btn btn-secondary" onclick={clearLog}>Clear Log</button>
		</div>

		<div class="tree-container tree-container-tall">
			<Tree
				data={sampleData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={3}
				contextMenuCallback={getContextMenu}
				shouldDisplayContextMenuInDebugMode={debugMode}
				{...getTreeProps()}
			>
				{#snippet nodeTemplate(node: any)}
					<span>
						{node.data?.icon} {node.data?.name}
						{#if node.data?.readonly}
							<span style="color: #999; font-size: 0.8em;">(read-only)</span>
						{/if}
					</span>
				{/snippet}
			</Tree>
		</div>

		{#if activityLog.length > 0}
			<div class="output">
				<p class="output-label">Activity Log:</p>
				<pre>{activityLog.join('\n')}</pre>
			</div>
		{/if}
	</div>

	<!-- Context Menu Callback -->
	<div class="card">
		<h2>Context Menu Callback</h2>
		<p class="description">Use <code>contextMenuCallback</code> to dynamically generate menu items based on the node.</p>

		<div class="code-block">
			<pre>{`import type { ContextMenuItem } from '@keenmate/svelte-treeview';

function getContextMenu(node: LTreeNode<FileItem>): ContextMenuItem[] {
  const isFolder = node.data?.type === 'folder';
  const isReadonly = node.data?.readonly;

  return [
    {
      icon: '📋',
      title: 'Copy',
      callback: () => console.log('Copy', node.data?.name)
    },
    {
      icon: '✂️',
      title: 'Cut',
      isDisabled: isReadonly,  // Disabled for read-only files
      callback: () => console.log('Cut', node.data?.name)
    },
    { isDivider: true, title: '', callback: () => {} },  // Divider
    {
      icon: '🗑️',
      title: 'Delete',
      isDisabled: isReadonly,
      callback: () => console.log('Delete', node.data?.name)
    }
  ];
}`}</pre>
		</div>
	</div>

	<!-- ContextMenuItem Interface -->
	<div class="card">
		<h2>ContextMenuItem Interface</h2>
		<p class="description">The structure of each menu item.</p>

		<table>
			<thead>
				<tr>
					<th>Property</th>
					<th>Type</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td><code>title</code></td>
					<td><code>string</code></td>
					<td>The text displayed in the menu item (required)</td>
				</tr>
				<tr>
					<td><code>callback</code></td>
					<td><code>() =&gt; void</code></td>
					<td>Function called when item is clicked (required)</td>
				</tr>
				<tr>
					<td><code>icon</code></td>
					<td><code>string</code></td>
					<td>Emoji or text icon shown before the title</td>
				</tr>
				<tr>
					<td><code>isDisabled</code></td>
					<td><code>boolean</code></td>
					<td>If true, item is grayed out and not clickable</td>
				</tr>
				<tr>
					<td><code>isDivider</code></td>
					<td><code>boolean</code></td>
					<td>If true, renders a horizontal line divider</td>
				</tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`interface ContextMenuItem {
  icon?: string;
  title: string;
  isDisabled?: boolean;
  callback: () => void;
  isDivider?: boolean;
}`}</pre>
		</div>
	</div>

	<!-- Menu Position Offset -->
	<div class="card">
		<h2>Menu Position Offset</h2>
		<p class="description">Adjust the context menu position relative to the cursor using <code>contextMenuXOffset</code> and <code>contextMenuYOffset</code>.</p>

		<div class="code-block">
			<pre>{`<Tree
  data={data}
  contextMenuCallback={getContextMenu}
  contextMenuXOffset={8}   // Default: 8px right of cursor
  contextMenuYOffset={0}   // Default: 0px below cursor
/>`}</pre>
		</div>

		<div class="note">
			<p class="note-title">Debug Mode</p>
			<p>Enable <code>shouldDisplayContextMenuInDebugMode</code> to display the context menu at a fixed position (200px right, 100px down from tree container). Useful for development and testing.</p>
		</div>
	</div>

	<!-- CSS Customization -->
	<div class="card">
		<h2>CSS Customization</h2>
		<p class="description">Style the context menu using these CSS classes.</p>

		<table>
			<thead>
				<tr>
					<th>Class</th>
					<th>Description</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td><code>.ltree-context-menu</code></td>
					<td>The menu container</td>
				</tr>
				<tr>
					<td><code>.ltree-context-menu-item</code></td>
					<td>Each menu item</td>
				</tr>
				<tr>
					<td><code>.ltree-context-menu-item.disabled</code></td>
					<td>Disabled menu items</td>
				</tr>
				<tr>
					<td><code>.ltree-context-menu-divider</code></td>
					<td>Divider lines</td>
				</tr>
			</tbody>
		</table>

		<div class="code-block">
			<pre>{`/* Custom context menu styling */
:global(.ltree-context-menu) {
  background: #2d3748;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
}

:global(.ltree-context-menu-item) {
  color: white;
  padding: 10px 16px;
}

:global(.ltree-context-menu-item:hover:not(.disabled)) {
  background: #667eea;
}

:global(.ltree-context-menu-item.disabled) {
  color: #718096;
}`}</pre>
		</div>
	</div>

	<footer>
		<p><a href="/">&larr; Back to Examples</a></p>
	</footer>
</div>
