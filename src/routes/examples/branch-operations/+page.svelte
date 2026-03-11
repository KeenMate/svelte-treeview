<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode, InsertBranchResult, DeleteBranchResult, ContextMenuEntry } from '$lib/ltree/types.js';
	import { setClipboard, getClipboard, clearClipboard, hasClipboard, getClipboardOperation } from '$lib/index.js';
	import type { ClipboardEntry } from '$lib/index.js';
	import RenderModeSwitch from '../RenderModeSwitch.svelte';
	import { getTreeProps } from '../render-mode.svelte.js';

	type DemoNode = {
		id: number;
		path: string;
		name: string;
		icon: string;
		sortOrder: number;
		isExpanded?: boolean;
		isCollapsible?: boolean;
	};

	// ── Initial tree data ──────────────────────────────────────────────

	function createInitialData(): DemoNode[] {
		return [
			{ id: 1, path: '1', name: 'Company', icon: '🏢', sortOrder: 10 },
			{ id: 2, path: '1.1', name: 'Engineering', icon: '⚙️', sortOrder: 10 },
			{ id: 3, path: '1.1.1', name: 'Frontend', icon: '🎨', sortOrder: 10 },
			{ id: 4, path: '1.1.1.1', name: 'Alice', icon: '👤', sortOrder: 10 },
			{ id: 5, path: '1.1.1.2', name: 'Bob', icon: '👤', sortOrder: 20 },
			{ id: 6, path: '1.1.2', name: 'Backend', icon: '🔧', sortOrder: 20 },
			{ id: 7, path: '1.1.2.1', name: 'Charlie', icon: '👤', sortOrder: 10 },
			{ id: 8, path: '1.2', name: 'Design', icon: '🎯', sortOrder: 20 },
			{ id: 9, path: '1.2.1', name: 'Diana', icon: '👤', sortOrder: 10 },
			{ id: 10, path: '1.2.2', name: 'Eve', icon: '👤', sortOrder: 20 },
			{ id: 11, path: '2', name: 'Operations', icon: '📋', sortOrder: 20 },
			{ id: 12, path: '2.1', name: 'HR', icon: '🤝', sortOrder: 10 },
			{ id: 13, path: '2.1.1', name: 'Frank', icon: '👤', sortOrder: 10 },
			{ id: 14, path: '2.2', name: 'Finance', icon: '💰', sortOrder: 20 },
			{ id: 15, path: '2.2.1', name: 'Grace', icon: '👤', sortOrder: 10 },
		];
	}

	// ── State ──────────────────────────────────────────────────────────

	let treeData = $state<DemoNode[]>(createInitialData());
	let treeRef: Tree<DemoNode>;
	let selectedNode = $state<LTreeNode<DemoNode> | null>(null);
	let activityLog = $state<string[]>([]);
	let nextId = 100;

	function sortByOrder(items: LTreeNode<DemoNode>[]) {
		return [...items].sort((a, b) => {
			if (a.parentPath !== b.parentPath) {
				return (a.parentPath || '').localeCompare(b.parentPath || '');
			}
			return (a.data?.sortOrder ?? 0) - (b.data?.sortOrder ?? 0);
		});
	}

	function addLog(message: string) {
		activityLog = [...activityLog.slice(-14), `${new Date().toLocaleTimeString()} - ${message}`];
	}

	function resetTree() {
		nextId = 100;
		treeData = createInitialData();
		selectedNode = null;
		activityLog = [];
	}

	// ── Clipboard helpers ──────────────────────────────────────────────

	function collectClipboardEntry(node: LTreeNode<DemoNode>): ClipboardEntry<DemoNode> {
		const descendants: { data: DemoNode; relativePath: string }[] = [];
		const walk = (n: LTreeNode<DemoNode>) => {
			for (const child of Object.values(n.children)) {
				if (child.data) {
					const relativePath = child.path.startsWith(node.path + '.')
						? child.path.substring(node.path.length)
						: '.' + child.pathSegment;
					descendants.push({ data: { ...child.data }, relativePath });
				}
				walk(child);
			}
		};
		walk(node);
		return { sourcePath: node.path, sourceTreeId: 'branch-demo', data: { ...node.data! }, descendants };
	}

	function doCopy(node: LTreeNode<DemoNode>, close: () => void) {
		setClipboard<DemoNode>({ operation: 'copy', entries: [collectClipboardEntry(node)], sourceTreeId: 'branch-demo' });
		addLog(`Copied "${node.data?.name}" + descendants`);
		close();
	}

	function doCut(node: LTreeNode<DemoNode>, close: () => void) {
		setClipboard<DemoNode>({ operation: 'cut', entries: [collectClipboardEntry(node)], sourceTreeId: 'branch-demo' });
		addLog(`Cut "${node.data?.name}" + descendants`);
		close();
	}

	function doPaste(targetPath: string, targetName: string, close: () => void) {
		const clip = getClipboard<DemoNode>();
		if (!clip || clip.entries.length === 0) return;

		const allNodes: DemoNode[] = [];
		for (const entry of clip.entries) {
			const newData = { ...entry.data, id: nextId++, path: '' };
			const basePath = targetPath ? `${targetPath}.${newData.id}` : `${newData.id}`;
			newData.path = basePath;
			allNodes.push(newData);

			for (const desc of entry.descendants) {
				const descData = { ...desc.data, id: nextId++ };
				descData.path = basePath + desc.relativePath;
				allNodes.push(descData);
			}
		}

		const result = treeRef.insertBranch(targetPath, allNodes);

		// If cut, remove source nodes
		if (clip.operation === 'cut') {
			for (const entry of clip.entries) {
				treeRef.deleteBranch(entry.sourcePath);
			}
		}

		clearClipboard();
		addLog(`Pasted ${result.count} nodes under "${targetName}" (${clip.operation})`);
		close();
	}

	function doCopyMulti(nodes: LTreeNode<DemoNode>[], close: () => void) {
		const entries = nodes.map(n => collectClipboardEntry(n));
		setClipboard<DemoNode>({ operation: 'copy', entries, sourceTreeId: 'branch-demo' });
		addLog(`Copied ${nodes.length} nodes`);
		close();
	}

	function doCutMulti(nodes: LTreeNode<DemoNode>[], close: () => void) {
		const entries = nodes.map(n => collectClipboardEntry(n));
		setClipboard<DemoNode>({ operation: 'cut', entries, sourceTreeId: 'branch-demo' });
		addLog(`Cut ${nodes.length} nodes`);
		close();
	}

	// ── Context menu ───────────────────────────────────────────────────

	function getContextMenu(node: LTreeNode<DemoNode>, close: () => void, selectedNodes?: LTreeNode<DemoNode>[]): ContextMenuEntry[] {
		const items: ContextMenuEntry[] = [];
		const selCount = selectedNodes?.length ?? 0;
		const isMulti = selCount > 1;

		if (isMulti) {
			// ── Multi-selection context menu ─────────────────────────────
			items.push({
				icon: '📋', label: `Copy ${selCount} nodes`, shortcut: 'Ctrl+C',
				onclick: () => doCopyMulti(selectedNodes!, close)
			});
			items.push({
				icon: '✂️', label: `Cut ${selCount} nodes`, shortcut: 'Ctrl+X',
				onclick: () => doCutMulti(selectedNodes!, close)
			});
			if (hasClipboard()) {
				items.push({
					icon: '📌', label: `Paste under first selected`, shortcut: 'Ctrl+V',
					onclick: () => doPaste(selectedNodes![0].path, selectedNodes![0].data?.name || '', close)
				});
			}
			items.push({ divider: true, label: 'Branch Ops' });
			items.push({
				icon: '🗑️', label: `Delete ${selCount} branches`, className: 'danger',
				onclick: () => {
					let total = 0;
					for (const n of selectedNodes!) {
						const r = treeRef.deleteBranch(n.path);
						if (r.success) total += r.removedCount;
					}
					addLog(`deleteBranch: Removed ${total} nodes from ${selCount} branches`);
					selectedNode = null;
					close();
				}
			});
			return items;
		}

		// ── Single-node context menu ─────────────────────────────────

		// Clipboard
		items.push({
			icon: '📋', label: 'Copy', shortcut: 'Ctrl+C',
			onclick: () => doCopy(node, close)
		});
		items.push({
			icon: '✂️', label: 'Cut', shortcut: 'Ctrl+X',
			onclick: () => doCut(node, close)
		});
		items.push({
			icon: '📌', label: 'Paste as child', shortcut: 'Ctrl+V',
			isDisabled: !hasClipboard(),
			onclick: () => doPaste(node.path, node.data?.name || '', close)
		});

		items.push({ divider: true, label: 'Branch Ops' });

		// insertBranch via context menu
		items.push({
			icon: '➕', label: 'Insert branch (7 nodes)',
			onclick: () => {
				const basePath = `${node.path}.${nextId}`;
				const newNodes: DemoNode[] = [
					{ id: nextId++, path: basePath, name: 'New Team', icon: '📁', sortOrder: 50 },
					{ id: nextId++, path: `${basePath}.1`, name: 'Member A', icon: '👤', sortOrder: 10 },
					{ id: nextId++, path: `${basePath}.2`, name: 'Member B', icon: '👤', sortOrder: 20 },
					{ id: nextId++, path: `${basePath}.3`, name: 'Sub-group', icon: '📂', sortOrder: 30 },
					{ id: nextId++, path: `${basePath}.3.1`, name: 'Member C', icon: '👤', sortOrder: 10 },
					{ id: nextId++, path: `${basePath}.3.2`, name: 'Member D', icon: '👤', sortOrder: 20 },
				];
				// Skip first id since we used it for basePath calculation
				const result = treeRef.insertBranch(node.path, newNodes);
				addLog(`insertBranch: Added ${result.count} nodes under "${node.data?.name}"`);
				close();
			}
		});

		// replaceBranch
		if (node.hasChildren) {
			items.push({
				icon: '🔄', label: 'Replace children',
				onclick: () => {
					const newChildren: DemoNode[] = [
						{ id: nextId++, path: `${node.path}.r1`, name: 'Replaced A', icon: '🔴', sortOrder: 10 },
						{ id: nextId++, path: `${node.path}.r2`, name: 'Replaced B', icon: '🟢', sortOrder: 20 },
						{ id: nextId++, path: `${node.path}.r3`, name: 'Replaced C', icon: '🔵', sortOrder: 30 },
					];
					const result = treeRef.replaceBranch(node.path, newChildren);
					addLog(`replaceBranch: Replaced children of "${node.data?.name}" with ${result.count} nodes`);
					close();
				}
			});
		}

		items.push({ divider: true, label: 'Delete' });

		// deleteBranch
		items.push({
			icon: '🗑️', label: 'Delete branch', className: 'danger',
			onclick: () => {
				const result = treeRef.deleteBranch(node.path);
				addLog(`deleteBranch: Removed "${node.data?.name}" (${result.removedCount} nodes)`);
				selectedNode = null;
				close();
			}
		});

		if (node.hasChildren) {
			items.push({
				icon: '🧹', label: 'Clear children only',
				onclick: () => {
					const result = treeRef.deleteBranch(node.path, true);
					addLog(`deleteBranch (keepParent): Cleared ${result.removedCount} children from "${node.data?.name}"`);
					close();
				}
			});
		}

		return items;
	}

	// ── insertBranch ───────────────────────────────────────────────────

	function handleInsertBranch() {
		const parentPath = selectedNode?.path || '';
		const parentName = selectedNode?.data?.name || 'Root';

		// Generate a batch of new nodes under the selected parent
		const baseId = nextId;
		const basePath = parentPath ? `${parentPath}.${baseId}` : `${baseId}`;
		const newNodes: DemoNode[] = [
			{ id: nextId++, path: basePath, name: 'New Team', icon: '📁', sortOrder: 50 },
			{ id: nextId++, path: `${basePath}.1`, name: 'Member A', icon: '👤', sortOrder: 10 },
			{ id: nextId++, path: `${basePath}.2`, name: 'Member B', icon: '👤', sortOrder: 20 },
			{ id: nextId++, path: `${basePath}.3`, name: 'Sub-group', icon: '📂', sortOrder: 30 },
			{ id: nextId++, path: `${basePath}.3.1`, name: 'Member C', icon: '👤', sortOrder: 10 },
			{ id: nextId++, path: `${basePath}.3.2`, name: 'Member D', icon: '👤', sortOrder: 20 },
		];

		const result: InsertBranchResult<DemoNode> = treeRef.insertBranch(parentPath, newNodes);

		if (result.success) {
			addLog(`insertBranch: Added ${result.count} nodes under "${parentName}"`);
		} else {
			addLog(`insertBranch: Failed - ${result.failed.map(f => f.error).join(', ')}`);
		}
	}

	function handleInsertLargeBranch() {
		const parentPath = selectedNode?.path || '';
		const parentName = selectedNode?.data?.name || 'Root';

		const nodes: DemoNode[] = [];
		const baseId = nextId;

		// Generate 3 departments x 10 teams x 5 members = 165 nodes
		// Demonstrates isExpanded and isCollapsible members:
		//  - Even-numbered departments start collapsed
		//  - Dept 3 is non-collapsible (always expanded, user can't collapse)
		for (let dept = 1; dept <= 3; dept++) {
			const deptPath = parentPath ? `${parentPath}.${baseId + dept}` : `${baseId + dept}`;
			const deptCollapsed = dept % 2 === 0;
			const deptLocked = dept === 3;
			nodes.push({
				id: nextId++, path: deptPath,
				name: `Department ${dept}${deptCollapsed ? ' (collapsed)' : ''}${deptLocked ? ' (locked open)' : ''}`,
				icon: '🏛️', sortOrder: dept * 10,
				isExpanded: !deptCollapsed,
				isCollapsible: !deptLocked,
			});

			for (let team = 1; team <= 10; team++) {
				const teamPath = `${deptPath}.${team}`;
				const teamCollapsed = team % 2 === 0;
				nodes.push({
					id: nextId++, path: teamPath,
					name: `Team ${dept}-${team}${teamCollapsed ? ' (collapsed)' : ''}`,
					icon: '📁', sortOrder: team * 10,
					isExpanded: !teamCollapsed,
				});

				for (let member = 1; member <= 5; member++) {
					const memberPath = `${teamPath}.${member}`;
					nodes.push({ id: nextId++, path: memberPath, name: `Person ${dept}-${team}-${member}`, icon: '👤', sortOrder: member * 10 });
				}
			}
		}

		const start = performance.now();
		const result = treeRef.insertBranch(parentPath, nodes);
		const elapsed = (performance.now() - start).toFixed(1);

		if (result.success) {
			addLog(`insertBranch (large): Added ${result.count} nodes under "${parentName}" in ${elapsed}ms`);
		} else {
			addLog(`insertBranch (large): ${result.count} added, ${result.failed.length} failed in ${elapsed}ms`);
		}
	}

	// ── replaceBranch ──────────────────────────────────────────────────

	function handleReplaceBranch() {
		if (!selectedNode) {
			addLog('replaceBranch: Select a node first');
			return;
		}

		const parentPath = selectedNode.path;
		const parentName = selectedNode.data?.name || parentPath;

		// Replace all children with a new set
		const basePath = parentPath;
		const newChildren: DemoNode[] = [
			{ id: nextId++, path: `${basePath}.r1`, name: 'Replaced Alpha', icon: '🔴', sortOrder: 10 },
			{ id: nextId++, path: `${basePath}.r2`, name: 'Replaced Beta', icon: '🟢', sortOrder: 20 },
			{ id: nextId++, path: `${basePath}.r3`, name: 'Replaced Gamma', icon: '🔵', sortOrder: 30 },
			{ id: nextId++, path: `${basePath}.r3.1`, name: 'Sub-item 1', icon: '⭐', sortOrder: 10 },
			{ id: nextId++, path: `${basePath}.r3.2`, name: 'Sub-item 2', icon: '⭐', sortOrder: 20 },
		];

		const result = treeRef.replaceBranch(parentPath, newChildren);

		if (result.success) {
			addLog(`replaceBranch: Replaced children of "${parentName}" with ${result.count} new nodes`);
		} else {
			addLog(`replaceBranch: Failed`);
		}
	}

	function handleReplaceWithEmpty() {
		if (!selectedNode) {
			addLog('replaceBranch (empty): Select a node first');
			return;
		}

		const parentPath = selectedNode.path;
		const parentName = selectedNode.data?.name || parentPath;

		const result = treeRef.replaceBranch(parentPath, []);

		if (result.success) {
			addLog(`replaceBranch: Cleared all children of "${parentName}"`);
		} else {
			addLog(`replaceBranch: Failed`);
		}
	}

	// ── deleteBranch ───────────────────────────────────────────────────

	function handleDeleteBranch() {
		if (!selectedNode) {
			addLog('deleteBranch: Select a node first');
			return;
		}

		const path = selectedNode.path;
		const name = selectedNode.data?.name || path;

		const result: DeleteBranchResult<DemoNode> = treeRef.deleteBranch(path, false);

		if (result.success) {
			addLog(`deleteBranch: Removed "${name}" + ${result.removedCount - 1} descendants (${result.removedCount} total)`);
			selectedNode = null;
		} else {
			addLog(`deleteBranch: ${result.error}`);
		}
	}

	function handleDeleteKeepParent() {
		if (!selectedNode) {
			addLog('deleteBranch (keepParent): Select a node first');
			return;
		}

		const path = selectedNode.path;
		const name = selectedNode.data?.name || path;

		const result = treeRef.deleteBranch(path, true);

		if (result.success) {
			addLog(`deleteBranch (keepParent): Cleared ${result.removedCount} children from "${name}"`);
		} else {
			addLog(`deleteBranch: ${result.error}`);
		}
	}

	// ── Comparison: addNode x N ────────────────────────────────────────

	function handleAddNodeLoop() {
		const parentPath = selectedNode?.path || '';
		const parentName = selectedNode?.data?.name || 'Root';

		const start = performance.now();
		let count = 0;
		for (let i = 0; i < 50; i++) {
			const result = treeRef.addNode(parentPath, {
				id: nextId++,
				path: '',
				name: `Individual ${i + 1}`,
				icon: '👤',
				sortOrder: i * 10
			});
			if (result.success) count++;
		}
		const elapsed = (performance.now() - start).toFixed(1);
		addLog(`addNode x50: Added ${count} nodes under "${parentName}" in ${elapsed}ms (50 emissions)`);
	}
</script>

<div class="container">
	<header class="page-header">
		<div class="header-top">
			<a href="/examples" class="back-link">Examples</a>
			<RenderModeSwitch />
		</div>
		<h1>Branch Operations</h1>
		<p class="subtitle">
			Bulk subtree operations with <strong>single tree emission</strong> — insertBranch, replaceBranch, deleteBranch.
		</p>
	</header>

	<!-- insertBranch Section -->
	<section class="card">
		<h2>insertBranch(parentPath, data[])</h2>
		<p>Insert multiple nodes under a parent in a single operation. Only <strong>1 _emitTreeChanged()</strong> call regardless of node count.</p>

		<div class="grid-2">
			<div>
				<div class="tree-container tree-container-tall">
					<Tree
						bind:this={treeRef}
						data={treeData}
						idMember="id"
						pathMember="path"
						isExpandedMember="isExpanded"
						isCollapsibleMember="isCollapsible"
						sortCallback={sortByOrder}
						isSorted={true}
						expandLevel={3}
						rangeSelectionMode="visual"
						getContextMenuItemsCallback={getContextMenu}
						bind:selectedNode
						{...getTreeProps()}
					>
						{#snippet nodeTemplate(node: any)}
							<span>{node.data?.icon} {node.data?.name}</span>
						{/snippet}
					</Tree>
				</div>

				<div class="controls" style="margin-top: 0.75rem;">
					<button class="btn" onclick={handleInsertBranch}>
						Insert 6 nodes (small branch)
					</button>
					<button class="btn" onclick={handleInsertLargeBranch}>
						Insert ~165 nodes (large branch)
					</button>
					<button class="btn btn-secondary" onclick={handleAddNodeLoop}>
						addNode x50 (comparison)
					</button>
				</div>

				<div class="note" style="margin-top: 0.75rem;">
					<strong>Tip:</strong> Select a node first, then click a button to insert under it. Leave unselected to insert at root.
				</div>
			</div>

			<div>
				<h3>Activity Log</h3>
				<div class="output">
					{#if activityLog.length === 0}
						<span class="muted">No operations yet. Click a button to start.</span>
					{:else}
						{#each activityLog as entry}
							<div>{entry}</div>
						{/each}
					{/if}
				</div>

				<h3 style="margin-top: 1rem;">Selected Node</h3>
				<div class="output">
					{#if selectedNode}
						<pre>{JSON.stringify({ path: selectedNode.path, name: selectedNode.data?.name, hasChildren: selectedNode.hasChildren }, null, 2)}</pre>
					{:else}
						<span class="muted">Click a node to select it</span>
					{/if}
				</div>

				<div class="code-block" style="margin-top: 1rem;">
					<pre><code>{`// Insert 6 nodes in a single operation
const result = treeRef.insertBranch(parentPath, [
  { id: 1, path: '1.1.3', name: 'New Team', ... },
  { id: 2, path: '1.1.3.1', name: 'Member A', ... },
  { id: 3, path: '1.1.3.2', name: 'Member B', ... },
  // ...
]);
// result: { success, count, failed, parentNode }`}</code></pre>
				</div>
			</div>
		</div>
	</section>

	<!-- replaceBranch Section -->
	<section class="card">
		<h2>replaceBranch(parentPath, data[])</h2>
		<p>Clear all children under a parent, then insert new ones — in a <strong>single operation</strong>. Useful for refreshing a subtree from server data.</p>

		<div class="grid-2">
			<div>
				<div class="controls">
					<button class="btn" onclick={handleReplaceBranch}>
						Replace children (5 new nodes)
					</button>
					<button class="btn btn-secondary" onclick={handleReplaceWithEmpty}>
						Replace with empty (clear children)
					</button>
				</div>
				<div class="note" style="margin-top: 0.75rem;">
					<strong>Select a node</strong> first. Its children will be removed and replaced with new ones.
				</div>

				<div class="code-block" style="margin-top: 1rem;">
					<pre><code>{`// Replace all children of a node
const result = treeRef.replaceBranch(
  selectedNode.path,
  newChildrenArray
);
// Old children removed, new ones inserted
// result: { success, count, failed, parentNode }

// Clear all children (replace with empty)
treeRef.replaceBranch(selectedNode.path, []);`}</code></pre>
				</div>
			</div>

			<div>
				<h3>How it works</h3>
				<ol class="steps-list">
					<li>Counts and collects all existing descendants</li>
					<li>Removes them from the flat node index</li>
					<li>Clears <code>parent.children</code></li>
					<li>Adjusts <code>nodeCount</code></li>
					<li>Delegates to <code>insertBranch()</code> for new data</li>
					<li>Single <code>_emitTreeChanged()</code></li>
				</ol>
			</div>
		</div>
	</section>

	<!-- deleteBranch Section -->
	<section class="card">
		<h2>deleteBranch(path, keepParent?)</h2>
		<p>Remove a node and all its descendants, or keep the parent and clear only its children. Single emission.</p>

		<div class="grid-2">
			<div>
				<div class="controls">
					<button class="btn danger" onclick={handleDeleteBranch}>
						Delete node + descendants
					</button>
					<button class="btn btn-secondary" onclick={handleDeleteKeepParent}>
						Clear children only (keep parent)
					</button>
				</div>
				<div class="note" style="margin-top: 0.75rem;">
					<strong>Select a node</strong> first.
					"Delete node + descendants" removes the node itself and everything below it.
					"Clear children only" keeps the selected node but removes all its children.
				</div>

				<div class="code-block" style="margin-top: 1rem;">
					<pre><code>{`// Remove node + all descendants
const result = treeRef.deleteBranch(path);
// result: { success, removedCount, error? }

// Keep parent, clear its children
const result = treeRef.deleteBranch(path, true);
// Node stays, children removed`}</code></pre>
				</div>
			</div>

			<div>
				<h3>keepParent comparison</h3>
				<div class="comparison-table">
					<table>
						<thead>
							<tr>
								<th></th>
								<th><code>keepParent = false</code></th>
								<th><code>keepParent = true</code></th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>Target node</td>
								<td>Removed</td>
								<td>Kept</td>
							</tr>
							<tr>
								<td>Children</td>
								<td>Removed</td>
								<td>Removed</td>
							</tr>
							<tr>
								<td>Parent updated</td>
								<td>hasChildren synced</td>
								<td>hasChildren = false</td>
							</tr>
							<tr>
								<td>Use case</td>
								<td>Delete a subtree</td>
								<td>Refresh / lazy-load</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>
	</section>

	<!-- Performance comparison -->
	<section class="card">
		<h2>Performance: insertBranch vs addNode loop</h2>
		<p>With large trees, the difference is dramatic. Each <code>addNode()</code> call triggers <code>refreshSiblings()</code> + <code>_emitTreeChanged()</code>.</p>

		<div class="comparison-table">
			<table>
				<thead>
					<tr>
						<th></th>
						<th><code>addNode() x 200</code></th>
						<th><code>insertBranch()</code></th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>_emitTreeChanged()</code> calls</td>
						<td>400</td>
						<td><strong>1</strong></td>
					</tr>
					<tr>
						<td><code>visibleFlatNodes</code> recomputes</td>
						<td>400 full tree walks</td>
						<td><strong>1</strong> full tree walk</td>
					</tr>
					<tr>
						<td><code>refreshSiblings</code> sorts</td>
						<td>200</td>
						<td><strong>~3-5</strong> (unique parents)</td>
					</tr>
					<tr>
						<td>DOM diff rounds</td>
						<td>400</td>
						<td><strong>1</strong></td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="note" style="margin-top: 0.75rem;">
			Try "Insert ~165 nodes" vs "addNode x50" on the tree above and compare the times in the activity log.
		</div>
	</section>

	<!-- API Reference -->
	<section class="card">
		<h2>API Reference</h2>

		<div class="api-grid">
			<div class="api-item">
				<h3>insertBranch</h3>
				<code>insertBranch(parentPath: string, data: T[]): InsertBranchResult&lt;T&gt;</code>
				<p>Bulk insert nodes under a parent. Data is converted, sorted, and inserted with a single emission.</p>
			</div>

			<div class="api-item">
				<h3>replaceBranch</h3>
				<code>replaceBranch(parentPath: string, data: T[]): InsertBranchResult&lt;T&gt;</code>
				<p>Remove all children of a parent, then insert new ones. Pass empty array to clear children.</p>
			</div>

			<div class="api-item">
				<h3>deleteBranch</h3>
				<code>deleteBranch(path: string, keepParent?: boolean): DeleteBranchResult&lt;T&gt;</code>
				<p>Remove a node + descendants (default), or clear children only when <code>keepParent = true</code>.</p>
			</div>
		</div>

		<h3 style="margin-top: 1.5rem;">Result Types</h3>
		<div class="code-block">
			<pre><code>{`interface InsertBranchResult<T> {
  success: boolean;
  count: number;                        // nodes inserted
  failed: Array<{ data: T; error: string }>;
  parentNode: LTreeNode<T> | null;
}

interface DeleteBranchResult<T> {
  success: boolean;
  removedCount: number;
  error?: string;
}`}</code></pre>
		</div>
	</section>

	<div class="controls" style="justify-content: center; margin-top: 1rem;">
		<button class="btn btn-secondary" onclick={resetTree}>
			Reset Tree
		</button>
	</div>
</div>

<style>
	.page-header {
		margin-bottom: 2rem;
	}

	.header-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.back-link {
		color: var(--accent, #667eea);
		text-decoration: none;
		font-size: 0.9rem;
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.subtitle {
		color: #64748b;
		font-size: 1rem;
		margin-top: 0.5rem;
	}

	.muted {
		color: #94a3b8;
		font-style: italic;
	}

	.steps-list {
		padding-left: 1.25rem;
		line-height: 1.8;
	}

	.steps-list code {
		background: #f1f5f9;
		padding: 0.1em 0.4em;
		border-radius: 3px;
		font-size: 0.85em;
		color: #6366f1;
	}

	.comparison-table {
		overflow-x: auto;
	}

	.comparison-table table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	.comparison-table th,
	.comparison-table td {
		padding: 0.5rem 0.75rem;
		text-align: left;
		border-bottom: 1px solid #e2e8f0;
	}

	.comparison-table th {
		background: #f8fafc;
		font-weight: 600;
		color: #475569;
	}

	.comparison-table td:first-child {
		font-weight: 500;
		color: #334155;
	}

	.comparison-table strong {
		color: #16a34a;
	}

	.danger {
		background: #ef4444 !important;
		border-color: #dc2626 !important;
	}

	.danger:hover {
		background: #dc2626 !important;
	}

	.api-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 1rem;
	}

	.api-item {
		padding: 1rem;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		background: #f8fafc;
	}

	.api-item h3 {
		margin: 0 0 0.5rem;
		font-size: 1rem;
		color: #1e293b;
	}

	.api-item code {
		display: block;
		background: #1e293b;
		color: #e2e8f0;
		padding: 0.5rem;
		border-radius: 4px;
		font-size: 0.8rem;
		margin-bottom: 0.5rem;
		overflow-x: auto;
	}

	.api-item p {
		margin: 0;
		font-size: 0.85rem;
		color: #64748b;
	}
</style>
