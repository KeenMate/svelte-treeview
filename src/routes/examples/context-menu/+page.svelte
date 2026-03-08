<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import ContextMenuItemC from '$lib/components/ContextMenuItem.svelte';
	import ContextMenuDividerC from '$lib/components/ContextMenuDivider.svelte';
	import type { LTreeNode, ContextMenuEntry } from '$lib/ltree/types.js';
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
	let snippetLog = $state<string[]>([]);
	let debugMode = $state(false);
	let xOffset = $state(8);
	let yOffset = $state(0);

	function sortByName(items: LTreeNode<FileItem>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	function addLog(message: string) {
		activityLog = [...activityLog.slice(-9), `${new Date().toLocaleTimeString()} - ${message}`];
	}

	function addSnippetLog(message: string) {
		snippetLog = [...snippetLog.slice(-9), `${new Date().toLocaleTimeString()} - ${message}`];
	}

	function clearLog() {
		activityLog = [];
	}

	function clearSnippetLog() {
		snippetLog = [];
	}

	// Context menu callback using the new unified ContextMenuEntry type
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

		// Submenu example: Export As...
		entries.push({
			icon: '📤',
			label: 'Export As...',
			children: [
				{ label: 'JSON', shortcut: 'J', onclick: () => { addLog(`Export "${node.data?.name}" as JSON`); close(); } },
				{ label: 'XML', shortcut: 'X', onclick: () => { addLog(`Export "${node.data?.name}" as XML`); close(); } },
				{ label: 'CSV', shortcut: 'C', onclick: () => { addLog(`Export "${node.data?.name}" as CSV`); close(); } },
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

		// isVisible example: only show lock info for readonly
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
	<title>Context Menu Examples - Svelte Treeview</title>
</svelte:head>

<div class="container">
	<header class="example-header">
		<a href="/" class="back-link">&larr; Back to Examples</a>
		<h1>📋 Context Menu Examples</h1>
		<p class="subtitle">Right-click context menus with callbacks, snippets, shortcuts, submenus, and named dividers</p>
		<RenderModeSwitch />
	</header>

	<!-- Dynamic Context Menu (Callback approach) -->
	<div class="card">
		<h2>Callback Approach</h2>
		<p class="description">Right-click on any node. Demonstrates shortcuts, submenus, named dividers, <code>className="danger"</code>, and <code>isVisible</code>.</p>

		<div class="controls">
			<label>
				<input type="checkbox" bind:checked={debugMode} />
				Debug Mode (menu appears at fixed position)
			</label>
			<label>
				X Offset:
				<input type="number" bind:value={xOffset} style="width: 70px;" />
				<span class="hint">px</span>
			</label>
			<label>
				Y Offset:
				<input type="number" bind:value={yOffset} style="width: 70px;" />
				<span class="hint">px</span>
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
				contextMenuXOffset={xOffset}
				contextMenuYOffset={yOffset}
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

	<!-- Snippet Approach -->
	<div class="card">
		<h2>Snippet + Component Approach</h2>
		<p class="description">Uses <code>ContextMenuItemC</code> and <code>ContextMenuDividerC</code> Svelte components inside a <code>contextMenu</code> snippet for declarative menus with conditional rendering.</p>

		<div class="controls">
			<button class="btn btn-secondary" onclick={clearSnippetLog}>Clear Log</button>
		</div>

		<div class="tree-container tree-container-tall">
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
					<span>
						{node.data?.icon} {node.data?.name}
						{#if node.data?.readonly}
							<span style="color: #999; font-size: 0.8em;">(read-only)</span>
						{/if}
					</span>
				{/snippet}
				{#snippet contextMenu(node: LTreeNode<FileItem>, close: () => void)}
					<ContextMenuItemC label="Copy" icon="📋" shortcut="C" onclick={() => { addSnippetLog(`Copied "${node.data?.name}"`); close(); }} />
					<ContextMenuItemC label="Cut" icon="✂️" shortcut="X" isDisabled={!!node.data?.readonly} onclick={() => { addSnippetLog(`Cut "${node.data?.name}"`); close(); }} />
					{#if node.data?.type === 'folder'}
						<ContextMenuItemC label="Export As..." icon="📤">
							<ContextMenuItemC label="JSON" shortcut="J" onclick={() => { addSnippetLog(`Export "${node.data?.name}" as JSON`); close(); }} />
							<ContextMenuItemC label="XML" shortcut="X" onclick={() => { addSnippetLog(`Export "${node.data?.name}" as XML`); close(); }} />
						</ContextMenuItemC>
					{/if}
					<ContextMenuDividerC label="Danger zone" />
					<ContextMenuItemC label="Delete" icon="🗑️" className="danger" isDisabled={!!node.data?.readonly} onclick={() => { addSnippetLog(`Delete "${node.data?.name}"`); close(); }} />
				{/snippet}
			</Tree>
		</div>

		{#if snippetLog.length > 0}
			<div class="output">
				<p class="output-label">Activity Log:</p>
				<pre>{snippetLog.join('\n')}</pre>
			</div>
		{/if}
	</div>

	<!-- Callback API Reference -->
	<div class="card">
		<h2>Callback API</h2>
		<p class="description">Use <code>contextMenuCallback</code> to dynamically generate menu entries based on the node.</p>

		<div class="code-block">
			<pre>{`import type { ContextMenuEntry } from '@keenmate/svelte-treeview';

function getContextMenu(node: LTreeNode<FileItem>, close: () => void): ContextMenuEntry[] {
  return [
    { label: 'Copy', icon: '📋', shortcut: 'C',
      onclick: () => { copy(node); close(); } },
    { label: 'Edit', icon: '✏️',
      onclick: () => { edit(node); close(); } },
    { label: 'Export As...', icon: '📤', children: [
        { label: 'JSON', shortcut: 'J', onclick: () => { exportAs(node, 'json'); close(); } },
        { label: 'XML', shortcut: 'X', onclick: () => { exportAs(node, 'xml'); close(); } },
    ]},
    { divider: true, label: 'Danger zone' },
    { label: 'Delete', className: 'danger', isDisabled: node.data.readonly,
      onclick: () => { del(node); close(); } },
  ];
}`}</pre>
		</div>
	</div>

	<!-- Snippet API Reference -->
	<div class="card">
		<h2>Snippet + Component API</h2>
		<p class="description">Use <code>ContextMenuItemC</code> and <code>ContextMenuDividerC</code> components inside the <code>contextMenu</code> snippet.</p>

		<div class="code-block">
			<pre>{'<'}script{'>'}
  import {"{"} ContextMenuItemC, ContextMenuDividerC {"}"} from '@keenmate/svelte-treeview';
{'<'}/script{'>'}

{`<Tree {data} ...>
  {#snippet contextMenu(node, close)}
    <ContextMenuItemC label="Copy" icon="📋" shortcut="C"
      onclick={() => { copy(node); close(); }} />
    {#if node.data.canExport}
      <ContextMenuItemC label="Export As..." icon="📤">
        <ContextMenuItemC label="JSON"
          onclick={() => { exportAs(node, 'json'); close(); }} />
        <ContextMenuItemC label="XML"
          onclick={() => { exportAs(node, 'xml'); close(); }} />
      </ContextMenuItemC>
    {/if}
    <ContextMenuDividerC label="Danger zone" />
    <ContextMenuItemC label="Delete" className="danger"
      isDisabled={node.data.readonly}
      onclick={() => { del(node); close(); }} />
  {/snippet}
</Tree>`}</pre>
		</div>
	</div>

	<!-- ContextMenuEntry Types -->
	<div class="card">
		<h2>ContextMenuEntry Types</h2>
		<p class="description">The unified type definition shared across svelte-treeview and canvas-tree.</p>

		<div class="code-block">
			<pre>{`// Divider (simple or named)
interface ContextMenuDivider {
  divider: true;
  label?: string;  // named: ──── [label] ────
}

// Menu item
interface ContextMenuItem {
  id?: string;
  label: string;
  icon?: string;
  shortcut?: string;
  isDisabled?: boolean;
  isVisible?: boolean;       // false = skip rendering
  className?: string;        // e.g. "danger"
  onclick?: () => void | Promise<void>;
  children?: ContextMenuEntry[];  // nested submenus
}

type ContextMenuEntry = ContextMenuItem | ContextMenuDivider;`}</pre>
		</div>

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
					<td><code>label</code></td>
					<td><code>string</code></td>
					<td>Display text (required for items, optional for dividers)</td>
				</tr>
				<tr>
					<td><code>onclick</code></td>
					<td><code>() =&gt; void | Promise</code></td>
					<td>Click handler (optional: parent items with children may omit)</td>
				</tr>
				<tr>
					<td><code>icon</code></td>
					<td><code>string</code></td>
					<td>Emoji or text icon shown before the label</td>
				</tr>
				<tr>
					<td><code>shortcut</code></td>
					<td><code>string</code></td>
					<td>Keyboard shortcut hint (right-aligned, muted)</td>
				</tr>
				<tr>
					<td><code>isDisabled</code></td>
					<td><code>boolean</code></td>
					<td>If true, item is grayed out and not clickable</td>
				</tr>
				<tr>
					<td><code>isVisible</code></td>
					<td><code>boolean</code></td>
					<td>If false, item is not rendered (callback approach)</td>
				</tr>
				<tr>
					<td><code>className</code></td>
					<td><code>string</code></td>
					<td>CSS class name (e.g. "danger" for red styling)</td>
				</tr>
				<tr>
					<td><code>children</code></td>
					<td><code>ContextMenuEntry[]</code></td>
					<td>Nested submenu items (opens on hover)</td>
				</tr>
				<tr>
					<td><code>divider</code></td>
					<td><code>true</code></td>
					<td>Type discriminator for divider entries</td>
				</tr>
			</tbody>
		</table>
	</div>

	<!-- Menu Position Offset -->
	<div class="card">
		<h2>Menu Position Offset</h2>
		<p class="description">Adjust the context menu position relative to the cursor using <code>contextMenuXOffset</code> and <code>contextMenuYOffset</code>.</p>

		<div class="code-block">
			<pre>{`<Tree
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
					<td><code>.ltree-context-menu-item-disabled</code></td>
					<td>Disabled menu items</td>
				</tr>
				<tr>
					<td><code>.ltree-context-menu-label</code></td>
					<td>Label text span</td>
				</tr>
				<tr>
					<td><code>.ltree-context-menu-shortcut</code></td>
					<td>Right-aligned shortcut hint</td>
				</tr>
				<tr>
					<td><code>.ltree-context-menu-arrow</code></td>
					<td>Submenu arrow indicator</td>
				</tr>
				<tr>
					<td><code>.ltree-context-menu-divider</code></td>
					<td>Divider lines</td>
				</tr>
				<tr>
					<td><code>.ltree-context-menu-divider-label</code></td>
					<td>Named divider label text</td>
				</tr>
				<tr>
					<td><code>.ltree-context-submenu</code></td>
					<td>Nested submenu container</td>
				</tr>
				<tr>
					<td><code>.danger</code></td>
					<td>Danger-styled item (red text)</td>
				</tr>
			</tbody>
		</table>
	</div>

	<footer>
		<p><a href="/">&larr; Back to Examples</a></p>
	</footer>
</div>
