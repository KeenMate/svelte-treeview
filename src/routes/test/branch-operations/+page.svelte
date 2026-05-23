<script lang="ts">
	import Tree from '$lib/components/Tree.svelte';
	import type {
		LTreeNode,
		InsertBranchResult,
		DeleteBranchResult
	} from '$lib/ltree/types.js';

	// Deterministic e2e fixture for bulk subtree operations: insertBranch,
	// replaceBranch, deleteBranch, plus a minimal cut/paste flow and failure
	// cases. Targeted by e2e/branch-operations.spec.ts.
	//
	// Each operation routes through invokeOp() which captures the return value
	// from the lib and increments opCallCount. Specs can assert on the result
	// shape (count / removedCount / failed / error) and on call-count delta.
	//
	// Note: opCallCount is per public-method call, not per internal
	// _emitTreeChanged. The lib has no public emission hook; strict
	// single-emission verification belongs in a vitest unit test.

	type Item = {
		id: number;
		path: string;
		name: string;
		sortOrder: number;
	};

	function initialData(): Item[] {
		return [
			{ id: 1, path: '1', name: 'Root-A', sortOrder: 10 },
			{ id: 2, path: '1.1', name: 'A-child-1', sortOrder: 10 },
			{ id: 3, path: '1.2', name: 'A-child-2', sortOrder: 20 },
			{ id: 4, path: '2', name: 'Root-B', sortOrder: 20 },
			{ id: 5, path: '2.1', name: 'B-child-1', sortOrder: 10 },
			{ id: 6, path: '2.1.1', name: 'B-grand-1', sortOrder: 10 },
			{ id: 7, path: '2.1.2', name: 'B-grand-2', sortOrder: 20 },
			{ id: 8, path: '3', name: 'Root-C', sortOrder: 30 }
		];
	}

	let treeData = $state<Item[]>(initialData());
	let treeRef: Tree<Item>;
	let nextId = 1000;

	function sortByOrder(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => {
			if (a.parentPath !== b.parentPath) {
				return (a.parentPath || '').localeCompare(b.parentPath || '');
			}
			return (a.data?.sortOrder ?? 0) - (b.data?.sortOrder ?? 0);
		});
	}

	type LastOp = {
		name: string;
		success: string;
		count: string;
		removedCount: string;
		failedCount: string;
		error: string;
	};

	function emptyLastOp(): LastOp {
		return { name: '', success: '', count: '', removedCount: '', failedCount: '', error: '' };
	}

	let lastOp: LastOp = $state(emptyLastOp());
	let opCallCount = $state(0);

	function recordInsertResult(name: string, result: InsertBranchResult<Item>) {
		opCallCount++;
		lastOp = {
			name,
			success: String(result.success),
			count: String(result.count),
			removedCount: '',
			failedCount: String(result.failed.length),
			error: ''
		};
	}

	function recordDeleteResult(name: string, result: DeleteBranchResult<Item>) {
		opCallCount++;
		lastOp = {
			name,
			success: String(result.success),
			count: '',
			removedCount: String(result.removedCount),
			failedCount: '',
			error: result.error ?? ''
		};
	}

	function totalNodes(): number {
		return treeRef?.getAllData().length ?? 0;
	}

	// totalNodes is derived from a ref method, not reactive state. Expose a
	// reactive shadow that recomputes whenever opCallCount changes (i.e. after
	// every recorded op) so specs can read a steady value.
	let totalNodeCount = $state(0);
	$effect(() => {
		// Read opCallCount to declare reactivity dependency.
		opCallCount;
		totalNodeCount = totalNodes();
	});

	// ── Op buttons ─────────────────────────────────────────────────────────

	function doInsertUnder(parentPath: string) {
		const rootId = nextId++;
		const childA = nextId++;
		const childB = nextId++;
		const branch: Item[] = [
			{ id: rootId, path: `${parentPath}.${rootId}`, name: 'New-Root', sortOrder: 100 },
			{ id: childA, path: `${parentPath}.${rootId}.1`, name: 'New-Child-A', sortOrder: 10 },
			{ id: childB, path: `${parentPath}.${rootId}.2`, name: 'New-Child-B', sortOrder: 20 }
		];
		const result = treeRef.insertBranch(parentPath, branch);
		recordInsertResult('insertBranch', result);
	}

	function doReplaceUnder(parentPath: string) {
		const base = nextId;
		nextId += 4;
		const newChildren: Item[] = [
			{ id: base, path: `${parentPath}.${base}`, name: 'Replaced-1', sortOrder: 10 },
			{ id: base + 1, path: `${parentPath}.${base + 1}`, name: 'Replaced-2', sortOrder: 20 },
			{ id: base + 2, path: `${parentPath}.${base + 2}`, name: 'Replaced-3', sortOrder: 30 },
			{
				id: base + 3,
				path: `${parentPath}.${base}.1`,
				name: 'Replaced-1-child',
				sortOrder: 10
			}
		];
		const result = treeRef.replaceBranch(parentPath, newChildren);
		recordInsertResult('replaceBranch', result);
	}

	function doDelete(path: string, keepParent = false) {
		const result = treeRef.deleteBranch(path, keepParent);
		recordDeleteResult(keepParent ? 'deleteBranch(keepParent)' : 'deleteBranch', result);
	}

	function resetTree() {
		// Reassigning treeData is not sufficient on its own — once the tree has
		// been mutated via treeRef.* methods, the data effect skips re-running
		// for one tick (the _skipInsertArray guard). Use replaceBranch('') to
		// swap the entire root subtree authoritatively.
		nextId = 1000;
		const fresh = initialData();
		treeData = fresh;
		treeRef.replaceBranch('', fresh);
		lastOp = emptyLastOp();
		opCallCount = 0;
		clipboard = null;
	}

	// ── Cut / Paste flow ───────────────────────────────────────────────────

	type Clipboard = { sourcePath: string; sourceName: string; nodes: Item[] };
	let clipboard = $state<Clipboard | null>(null);

	function collectBranchData(node: LTreeNode<Item>): Item[] {
		const out: Item[] = [];
		if (!node.data) return out;
		out.push({ ...node.data });
		const walk = (n: LTreeNode<Item>) => {
			for (const child of Object.values(n.children)) {
				if (child.data) out.push({ ...child.data });
				walk(child);
			}
		};
		walk(node);
		return out;
	}

	function doCut(sourcePath: string) {
		const node = treeRef.getNodeByPath(sourcePath);
		if (!node) {
			lastOp = {
				name: 'cut',
				success: 'false',
				count: '',
				removedCount: '',
				failedCount: '',
				error: `Node not found: ${sourcePath}`
			};
			opCallCount++;
			return;
		}
		clipboard = {
			sourcePath: node.path,
			sourceName: node.data?.name ?? node.path,
			nodes: collectBranchData(node)
		};
	}

	function doPaste(targetParentPath: string) {
		if (!clipboard) {
			lastOp = {
				name: 'paste',
				success: 'false',
				count: '',
				removedCount: '',
				failedCount: '',
				error: 'Clipboard empty'
			};
			opCallCount++;
			return;
		}

		const { sourcePath, sourceName, nodes } = clipboard;
		if (targetParentPath === sourcePath || targetParentPath.startsWith(sourcePath + '.')) {
			lastOp = {
				name: 'paste',
				success: 'false',
				count: '',
				removedCount: '',
				failedCount: '',
				error: 'Cannot paste into self or descendant'
			};
			opCallCount++;
			return;
		}

		// Rewrite paths to land under targetParentPath with fresh ids.
		const oldRootPath = nodes[0].path;
		const newRootId = nextId++;
		const newRootPath = targetParentPath ? `${targetParentPath}.${newRootId}` : `${newRootId}`;
		const rewritten: Item[] = nodes.map((n) => {
			let newPath: string;
			if (n.path === oldRootPath) {
				newPath = newRootPath;
			} else {
				const suffix = n.path.substring(oldRootPath.length);
				newPath = newRootPath + suffix;
			}
			return { ...n, id: nextId++, path: newPath };
		});

		const delResult = treeRef.deleteBranch(sourcePath);
		recordDeleteResult('paste:delete', delResult);
		const insResult = treeRef.insertBranch(targetParentPath, rewritten);
		recordInsertResult('paste:insert', insResult);
		clipboard = null;
		void sourceName;
	}

	function clearClipboard() {
		clipboard = null;
	}

	// ── Failure cases ─────────────────────────────────────────────────────

	function failInsertInvalidParent() {
		const result = treeRef.insertBranch('999.999', [
			{ id: nextId++, path: '999.999.1', name: 'X', sortOrder: 10 }
		]);
		recordInsertResult('insertBranch(invalid-parent)', result);
	}

	function failInsertInvalidItems() {
		// Two valid + two invalid items so failed[] has entries but op succeeds.
		const base = nextId;
		nextId += 4;
		const items: Item[] = [
			{ id: base, path: `1.${base}`, name: 'Valid-1', sortOrder: 10 },
			// Empty path — should fail.
			{ id: base + 1, path: '', name: 'Invalid-empty', sortOrder: 20 },
			{ id: base + 2, path: `1.${base + 2}`, name: 'Valid-2', sortOrder: 30 },
			// Non-string path — should fail.
			{ id: base + 3, path: null as unknown as string, name: 'Invalid-null', sortOrder: 40 }
		];
		const result = treeRef.insertBranch('1', items);
		recordInsertResult('insertBranch(mixed-validity)', result);
	}

	function failDeleteInvalidPath() {
		const result = treeRef.deleteBranch('999.999');
		recordDeleteResult('deleteBranch(invalid-path)', result);
	}

	function failReplaceInvalidParent() {
		const result = treeRef.replaceBranch('999.999', [
			{ id: nextId++, path: '999.999.1', name: 'X', sortOrder: 10 }
		]);
		recordInsertResult('replaceBranch(invalid-parent)', result);
	}
</script>

<svelte:head>
	<title>Test — Branch Operations Fixture</title>
</svelte:head>

<main>
	<h1>Branch Operations Test Fixture</h1>

	<section data-testid="section-state">
		<h2>State</h2>
		<div class="state-row">
			<span>opCallCount: <b data-testid="op-call-count">{opCallCount}</b></span>
			<span>totalNodes: <b data-testid="total-node-count">{totalNodeCount}</b></span>
			<span
				>clipboard: <b data-testid="clipboard-source">{clipboard?.sourcePath ?? '(empty)'}</b
				></span
			>
		</div>
		<div class="state-row">
			<span>lastOp.name: <b data-testid="last-op-name">{lastOp.name}</b></span>
			<span>success: <b data-testid="last-op-success">{lastOp.success}</b></span>
			<span>count: <b data-testid="last-op-count">{lastOp.count}</b></span>
			<span>removed: <b data-testid="last-op-removed">{lastOp.removedCount}</b></span>
			<span>failed: <b data-testid="last-op-failed-count">{lastOp.failedCount}</b></span>
			<span>error: <b data-testid="last-op-error">{lastOp.error}</b></span>
		</div>
	</section>

	<section data-testid="section-controls">
		<h2>Controls</h2>
		<div class="btn-row">
			<button data-testid="btn-reset" onclick={resetTree}>Reset Tree</button>
		</div>
		<div class="btn-row">
			<strong>insertBranch:</strong>
			<button data-testid="btn-insert-under-1" onclick={() => doInsertUnder('1')}
				>Insert 3 under '1'</button
			>
			<button data-testid="btn-insert-under-3" onclick={() => doInsertUnder('3')}
				>Insert 3 under '3'</button
			>
		</div>
		<div class="btn-row">
			<strong>replaceBranch:</strong>
			<button data-testid="btn-replace-1" onclick={() => doReplaceUnder('1')}
				>Replace children of '1'</button
			>
			<button data-testid="btn-replace-2.1" onclick={() => doReplaceUnder('2.1')}
				>Replace children of '2.1'</button
			>
		</div>
		<div class="btn-row">
			<strong>deleteBranch:</strong>
			<button data-testid="btn-delete-2.1" onclick={() => doDelete('2.1')}
				>Delete '2.1' (incl. self)</button
			>
			<button data-testid="btn-delete-2.1-keepParent" onclick={() => doDelete('2.1', true)}
				>Delete '2.1' children only</button
			>
			<button data-testid="btn-delete-3" onclick={() => doDelete('3')}>Delete '3'</button>
		</div>
		<div class="btn-row">
			<strong>Cut/Paste:</strong>
			<button data-testid="btn-cut-2.1" onclick={() => doCut('2.1')}>Cut '2.1'</button>
			<button data-testid="btn-cut-1.1" onclick={() => doCut('1.1')}>Cut '1.1'</button>
			<button data-testid="btn-paste-3" onclick={() => doPaste('3')}>Paste under '3'</button>
			<button data-testid="btn-paste-1" onclick={() => doPaste('1')}>Paste under '1'</button>
			<button data-testid="btn-paste-into-self" onclick={() => doPaste('2.1')}
				>Paste under '2.1' (into self)</button
			>
			<button data-testid="btn-clear-clipboard" onclick={clearClipboard}>Clear clipboard</button>
		</div>
		<div class="btn-row">
			<strong>Failure cases:</strong>
			<button data-testid="btn-fail-insert-parent" onclick={failInsertInvalidParent}
				>insertBranch invalid parent</button
			>
			<button data-testid="btn-fail-insert-items" onclick={failInsertInvalidItems}
				>insertBranch mixed validity</button
			>
			<button data-testid="btn-fail-replace-parent" onclick={failReplaceInvalidParent}
				>replaceBranch invalid parent</button
			>
			<button data-testid="btn-fail-delete-path" onclick={failDeleteInvalidPath}
				>deleteBranch invalid path</button
			>
		</div>
	</section>

	<section data-testid="section-tree">
		<h2>Tree</h2>
		<div class="tree-box">
			<Tree
				bind:this={treeRef}
				treeId="branch-ops"
				data={treeData}
				idMember="id"
				pathMember="path"
				orderMember="sortOrder"
				sortCallback={sortByOrder}
				isSorted={true}
				expandLevel={10}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span data-testid="node-{node.path}">{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
	</section>
</main>

<style>
	main {
		padding: 1rem;
		font-family: sans-serif;
	}
	h1 {
		margin: 0 0 1rem;
	}
	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.05rem;
	}
	section {
		border: 1px solid #ccc;
		padding: 0.75rem;
		margin-bottom: 0.75rem;
		border-radius: 4px;
	}
	.state-row {
		font-size: 0.85rem;
		margin-bottom: 0.4rem;
	}
	.state-row span {
		display: inline-block;
		margin-right: 0.75rem;
		padding: 0.1rem 0.35rem;
		background: #f1f5f9;
		border-radius: 3px;
	}
	.state-row b {
		font-family: monospace;
		color: #1e293b;
	}
	.btn-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		margin-bottom: 0.5rem;
		font-size: 0.85rem;
	}
	.btn-row strong {
		min-width: 110px;
	}
	.btn-row button {
		padding: 0.25rem 0.6rem;
		border: 1px solid #cbd5e1;
		background: white;
		border-radius: 3px;
		cursor: pointer;
		font-size: 0.8rem;
	}
	.btn-row button:hover {
		background: #f1f5f9;
	}
	.tree-box {
		border: 1px solid #e2e8f0;
		padding: 0.5rem;
		max-width: 480px;
	}
</style>
