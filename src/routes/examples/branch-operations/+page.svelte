<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type { LTreeNode, ContextMenuEntry } from '$lib/ltree/types.js';
	import RenderModeSwitch from '../RenderModeSwitch.svelte';
	import { getTreeProps } from '../render-mode.svelte.js';

	type DemoNode = {
		id: number;
		path: string;
		name: string;
		icon: string;
		sortOrder: number;
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
			{ id: 8, path: '1.1.2.2', name: 'Dave', icon: '👤', sortOrder: 20 },
			{ id: 9, path: '1.2', name: 'Design', icon: '🎯', sortOrder: 20 },
			{ id: 10, path: '1.2.1', name: 'UX', icon: '✏️', sortOrder: 10 },
			{ id: 11, path: '1.2.1.1', name: 'Diana', icon: '👤', sortOrder: 10 },
			{ id: 12, path: '1.2.1.2', name: 'Frank', icon: '👤', sortOrder: 20 },
			{ id: 13, path: '1.2.2', name: 'Visual', icon: '🖼️', sortOrder: 20 },
			{ id: 14, path: '1.2.2.1', name: 'Grace', icon: '👤', sortOrder: 10 },
			{ id: 15, path: '2', name: 'Operations', icon: '📋', sortOrder: 20 },
			{ id: 16, path: '2.1', name: 'HR', icon: '🤝', sortOrder: 10 },
			{ id: 17, path: '2.1.1', name: 'Recruiting', icon: '📣', sortOrder: 10 },
			{ id: 18, path: '2.1.1.1', name: 'Hank', icon: '👤', sortOrder: 10 },
			{ id: 19, path: '2.1.2', name: 'Culture', icon: '🎭', sortOrder: 20 },
			{ id: 20, path: '2.2', name: 'Finance', icon: '💰', sortOrder: 20 },
			{ id: 21, path: '2.2.1', name: 'Accounting', icon: '📊', sortOrder: 10 },
			{ id: 22, path: '2.2.2', name: 'Payroll', icon: '💳', sortOrder: 20 },
			{ id: 23, path: '3', name: 'Sales', icon: '📈', sortOrder: 30 },
			{ id: 24, path: '3.1', name: 'Enterprise', icon: '🏛️', sortOrder: 10 },
			{ id: 25, path: '3.1.1', name: 'EMEA', icon: '🌍', sortOrder: 10 },
			{ id: 26, path: '3.1.2', name: 'APAC', icon: '🌏', sortOrder: 20 },
			{ id: 27, path: '3.1.3', name: 'Americas', icon: '🌎', sortOrder: 30 },
			{ id: 28, path: '3.2', name: 'SMB', icon: '🏪', sortOrder: 20 },
			{ id: 29, path: '3.2.1', name: 'Inbound', icon: '📥', sortOrder: 10 },
			{ id: 30, path: '3.2.2', name: 'Outbound', icon: '📤', sortOrder: 20 },
		];
	}

	// ── State ──────────────────────────────────────────────────────────

	let treeData = $state<DemoNode[]>(createInitialData());
	let treeRef: Tree<DemoNode>;
	let selectedNode = $state<LTreeNode<DemoNode> | null>(null);
	let activityLog = $state<string[]>([]);
	let nextId = 200;

	// Server simulation
	let serverDelay = $state(1500);
	let isProcessing = $state(false);
	let processingMessage = $state('');

	// Cut clipboard — snapshot of branch data for server request
	interface CutClipboard {
		sourcePath: string;
		sourceName: string;
		nodes: DemoNode[];
	}
	let cutClipboard = $state<CutClipboard | null>(null);

	function sortByOrder(items: LTreeNode<DemoNode>[]) {
		return [...items].sort((a, b) => {
			if (a.parentPath !== b.parentPath) {
				return (a.parentPath || '').localeCompare(b.parentPath || '');
			}
			return (a.data?.sortOrder ?? 0) - (b.data?.sortOrder ?? 0);
		});
	}

	function addLog(message: string) {
		activityLog = [`${new Date().toLocaleTimeString()} - ${message}`, ...activityLog.slice(0, 19)];
	}

	function resetTree() {
		nextId = 200;
		treeData = createInitialData();
		selectedNode = null;
		cutClipboard = null;
		isProcessing = false;
		activityLog = [];
	}

	// ── Collect branch data (snapshot for "server" request) ───────────

	function collectBranchData(node: LTreeNode<DemoNode>): DemoNode[] {
		const result: DemoNode[] = [];
		if (!node.data) return result;
		result.push({ ...node.data });

		const walkChildren = (n: LTreeNode<DemoNode>) => {
			for (const child of Object.values(n.children)) {
				if (child.data) result.push({ ...child.data });
				walkChildren(child);
			}
		};
		walkChildren(node);
		return result;
	}

	// ── Simulated server: recalculate paths for moved branch ─────────

	function simulateServerMoveBranch(
		sourceNodes: DemoNode[],
		targetParentPath: string
	): Promise<DemoNode[]> {
		return new Promise((resolve) => {
			setTimeout(() => {
				const oldRootPath = sourceNodes[0].path;
				const newRootId = nextId++;
				const newRootPath = targetParentPath
					? `${targetParentPath}.${newRootId}`
					: `${newRootId}`;

				const result: DemoNode[] = sourceNodes.map((n) => {
					let newPath: string;

					if (n.path === oldRootPath) {
						newPath = newRootPath;
					} else {
						const suffix = n.path.substring(oldRootPath.length);
						newPath = newRootPath + suffix;
					}

					return {
						...n,
						id: nextId++,
						path: newPath,
						sortOrder: n.sortOrder,
					};
				});

				resolve(result);
			}, serverDelay);
		});
	}

	// ── Cut operation ────────────────────────────────────────────────

	function doCut(node: LTreeNode<DemoNode>, close: () => void) {
		const nodes = collectBranchData(node);
		cutClipboard = {
			sourcePath: node.path,
			sourceName: node.data?.name || node.path,
			nodes,
		};
		addLog(`Cut "${node.data?.name}" (${nodes.length} node${nodes.length > 1 ? 's' : ''})`);
		close();
	}

	// ── Paste operation (server-simulated) ────────────────────────────

	async function doPaste(targetNode: LTreeNode<DemoNode>, close: () => void) {
		if (!cutClipboard) return;

		const { sourcePath, sourceName, nodes: sourceNodes } = cutClipboard;
		const targetPath = targetNode.path;
		const targetName = targetNode.data?.name || targetPath;

		// Prevent pasting into self or descendants
		if (targetPath === sourcePath || targetPath.startsWith(sourcePath + '.')) {
			addLog(`Cannot paste "${sourceName}" into itself or its own descendant`);
			close();
			return;
		}

		cutClipboard = null;
		close();
		isProcessing = true;
		processingMessage = `Moving "${sourceName}" under "${targetName}"...`;
		addLog(`Sending move request to server: "${sourceName}" -> "${targetName}" (${sourceNodes.length} nodes)`);

		const startTime = performance.now();

		try {
			// 1. Simulate server call
			const serverResult = await simulateServerMoveBranch(sourceNodes, targetPath);
			const serverTime = (performance.now() - startTime).toFixed(0);

			processingMessage = `Server responded (${serverTime}ms). Applying changes...`;

			// 2. Delete old branch
			const deleteResult = treeRef.deleteBranch(sourcePath);
			if (!deleteResult.success) {
				addLog(`Failed to remove source: ${deleteResult.error}`);
				isProcessing = false;
				return;
			}

			// 3. Insert new branch at target with server-recalculated data
			const insertResult = treeRef.insertBranch(targetPath, serverResult);

			// 4. Expand the target so pasted branch is visible
			treeRef.expandNodes(targetPath);

			const totalTime = (performance.now() - startTime).toFixed(0);

			addLog(
				`Moved "${sourceName}" under "${targetName}": ` +
				`deleted ${deleteResult.removedCount}, inserted ${insertResult.count} nodes. ` +
				`Server: ${serverTime}ms, total: ${totalTime}ms`
			);
		} catch (err) {
			addLog(`Server error: ${err}`);
		} finally {
			isProcessing = false;
			processingMessage = '';
		}
	}

	// ── Context menu ───────────────────────────────────────────────────

	function getContextMenu(node: LTreeNode<DemoNode>, close: () => void): ContextMenuEntry[] {
		const items: ContextMenuEntry[] = [];

		// Cut
		items.push({
			icon: '✂️', label: 'Cut branch',
			isDisabled: isProcessing,
			onclick: () => doCut(node, close)
		});

		// Paste
		if (cutClipboard) {
			const canPaste = node.path !== cutClipboard.sourcePath &&
				!node.path.startsWith(cutClipboard.sourcePath + '.');
			items.push({
				icon: '📌', label: `Paste "${cutClipboard.sourceName}" here`,
				isDisabled: !canPaste || isProcessing,
				onclick: () => doPaste(node, close)
			});
		}

		if (cutClipboard) {
			items.push({
				icon: '❌', label: 'Cancel cut',
				onclick: () => { cutClipboard = null; addLog('Cut cancelled'); close(); }
			});
		}

		items.push({ divider: true, label: 'Branch Ops' });

		// Insert branch
		items.push({
			icon: '➕', label: 'Insert branch (7 nodes)',
			isDisabled: isProcessing,
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
				const result = treeRef.insertBranch(node.path, newNodes);
				addLog(`insertBranch: Added ${result.count} nodes under "${node.data?.name}"`);
				close();
			}
		});

		// Delete
		items.push({
			icon: '🗑️', label: 'Delete branch', className: 'danger',
			isDisabled: isProcessing,
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
				isDisabled: isProcessing,
				onclick: () => {
					const result = treeRef.deleteBranch(node.path, true);
					addLog(`Cleared ${result.removedCount} children from "${node.data?.name}"`);
					close();
				}
			});
		}

		return items;
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
			Cut a branch, paste it onto another node. The move is processed by a simulated
			server (configurable delay), which recalculates paths and IDs. The tree updates
			via <code>deleteBranch</code> + <code>insertBranch</code> with a single emission each.
		</p>
	</header>

	<!-- Workflow -->
	<section class="card workflow-card">
		<h2>Workflow</h2>
		<div class="workflow-steps">
			<div class="step">
				<span class="step-num">1</span>
				<div>
					<strong>Right-click a node</strong> and select <em>Cut branch</em>.
					The branch data is snapshot for the server request.
				</div>
			</div>
			<div class="step">
				<span class="step-num">2</span>
				<div>
					<strong>Right-click the target node</strong> and select <em>Paste "..." here</em>.
					This sends the move request to the simulated server.
				</div>
			</div>
			<div class="step">
				<span class="step-num">3</span>
				<div>
					<strong>Server processes</strong> the move ({serverDelay}ms): recalculates paths,
					assigns new IDs, validates the operation.
				</div>
			</div>
			<div class="step">
				<span class="step-num">4</span>
				<div>
					<strong>Tree updates</strong>: <code>deleteBranch(sourcePath)</code> removes the old branch,
					<code>insertBranch(targetPath, serverData)</code> inserts the recalculated result.
				</div>
			</div>
		</div>
	</section>

	<!-- Tree + controls -->
	<section class="card">
		<div class="tree-header">
			<h2>
				Org Chart
				{#if cutClipboard}
					<span class="cut-badge">Cut: {cutClipboard.sourceName} ({cutClipboard.nodes.length} nodes)</span>
				{/if}
			</h2>
			<button class="btn btn-secondary" onclick={resetTree} disabled={isProcessing}>Reset Tree</button>
		</div>

		<div class="tree-wrapper" class:tree-processing={isProcessing}>
			<div class="tree-container tree-container-tall">
				<Tree
					bind:this={treeRef}
					data={treeData}
					idMember="id"
					pathMember="path"
					sortCallback={sortByOrder}
					isSorted={true}
					expandLevel={3}
					getContextMenuItemsCallback={getContextMenu}
					bind:selectedNode
					{...getTreeProps()}
				>
					{#snippet nodeTemplate(node: any)}
						<span class:cut-node={cutClipboard?.sourcePath === node.path || (cutClipboard && node.path.startsWith(cutClipboard.sourcePath + '.'))}>
							{node.data?.icon} {node.data?.name}
						</span>
					{/snippet}
				</Tree>
			</div>

			{#if isProcessing}
				<div class="processing-overlay">
					<div class="processing-spinner"></div>
					<p>{processingMessage}</p>
				</div>
			{/if}
		</div>
	</section>

	<!-- Server config + activity log -->
	<div class="bottom-grid">
		<section class="card">
			<h3>Server Simulation</h3>
			<label class="delay-control">
				<span>Response delay:</span>
				<input type="range" min="200" max="5000" step="100" bind:value={serverDelay} disabled={isProcessing} />
				<span class="delay-value">{serverDelay}ms</span>
			</label>
			<p class="hint">
				Simulates the time a real server would take to validate the move,
				recalculate paths/IDs in the database, and return the result.
			</p>

			<div class="code-block">
				<pre><code>{`// 1. User cuts a branch via context menu
const branchData = collectBranchData(node);

// 2. User pastes on target — send to server
const serverResult = await api.moveBranch(
  branchData, targetPath
);

// 3. Apply server response to tree
treeRef.deleteBranch(sourcePath);
treeRef.insertBranch(targetPath, serverResult);`}</code></pre>
			</div>
		</section>

		<section class="card">
			<h3>Activity Log</h3>
			<div class="log-entries">
				{#if activityLog.length === 0}
					<p class="hint">Right-click a node to start. Cut a branch, then paste it on another node.</p>
				{:else}
					{#each activityLog as entry}
						<p class="log-entry">{entry}</p>
					{/each}
				{/if}
			</div>
		</section>
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

	.subtitle code {
		font-size: 0.85em;
		background: #f1f5f9;
		padding: 0.1em 0.3em;
		border-radius: 3px;
		color: #6366f1;
	}

	/* Workflow */

	.workflow-card h2 {
		margin: 0 0 0.75rem;
	}

	.workflow-steps {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 0.75rem;
	}

	.step {
		display: flex;
		gap: 0.6rem;
		font-size: 0.85rem;
		color: #475569;
		line-height: 1.5;
	}

	.step-num {
		flex-shrink: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: #6366f1;
		color: white;
		font-size: 0.75rem;
		font-weight: 700;
		margin-top: 1px;
	}

	.step code {
		font-size: 0.8em;
		background: #f1f5f9;
		padding: 0.1em 0.3em;
		border-radius: 3px;
		color: #6366f1;
	}

	/* Tree */

	.tree-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.tree-header h2 {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin: 0;
	}

	.cut-badge {
		font-size: 0.75rem;
		font-weight: 500;
		background: #fef3c7;
		color: #92400e;
		padding: 0.2rem 0.6rem;
		border-radius: 12px;
		border: 1px solid #fcd34d;
	}

	.tree-wrapper {
		position: relative;
		transition: border-color 0.3s;
	}

	.tree-processing .tree-container {
		border-color: #818cf8;
	}

	.processing-overlay {
		position: absolute;
		inset: 0;
		background: rgba(15, 23, 42, 0.5);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		z-index: 10;
		border-radius: 8px;
		backdrop-filter: blur(2px);
	}

	.processing-overlay p {
		color: white;
		font-size: 0.95rem;
		font-weight: 500;
		margin: 0;
		text-shadow: 0 1px 3px rgba(0,0,0,0.4);
	}

	.processing-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid rgba(255,255,255,0.3);
		border-top-color: white;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.cut-node {
		opacity: 0.4;
		text-decoration: line-through;
	}

	/* Bottom grid */

	.bottom-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1rem;
	}

	@media (max-width: 800px) {
		.bottom-grid {
			grid-template-columns: 1fr;
		}
	}

	.delay-control {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.9rem;
		margin-bottom: 0.75rem;
	}

	.delay-control input[type="range"] {
		flex: 1;
		accent-color: #6366f1;
	}

	.delay-value {
		min-width: 55px;
		text-align: right;
		font-weight: 600;
		color: #334155;
		font-variant-numeric: tabular-nums;
	}

	.hint {
		font-size: 0.8rem;
		color: #94a3b8;
		margin: 0 0 0.75rem;
	}

	.log-entries {
		max-height: 240px;
		overflow-y: auto;
	}

	.log-entry {
		font-size: 0.8rem;
		font-family: 'SF Mono', 'Cascadia Code', monospace;
		color: #475569;
		margin: 0.15rem 0;
		padding: 0.15rem 0;
		border-bottom: 1px solid #f1f5f9;
	}

	.code-block {
		background: #1e293b;
		color: #e2e8f0;
		padding: 1rem;
		border-radius: 8px;
		overflow-x: auto;
		font-size: 0.8rem;
		line-height: 1.5;
	}

	.code-block pre {
		margin: 0;
	}

	.code-block code {
		font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
	}
</style>
