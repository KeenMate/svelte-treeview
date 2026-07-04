<script lang="ts">
	// Deterministic e2e fixture that captures the EXACT context object each on* EVENT
	// receives, serialized to the DOM so a spec can assert field-by-field:
	//   - onNodeClick / onNodeDoubleClick (NodeRef)
	//   - onNodeDragStart / onNodeDragOver (NodeDragContext: NodeRef + event + dragged)
	//   - onNodeDrop (NodeDropContext: source, target, dragged, dropped, position, operation)
	//   - onHighlightChange / onSelectionChange ({ paths, nodes })
	//   - onCopy / onCut / onDelete ({ operation?, paths, nodes })
	// Two trees (treeA source / treeB target) exercise same-tree vs cross-tree drops.
	// Targeted by e2e/event-context.spec.ts.
	import { Tree } from '$lib/index.js';
	import type {
		NodeRef,
		NodeDragContext,
		NodeDropContext,
		ClipboardEventContext,
		SelectionChangeContext,
		LTreeNode
	} from '$lib/index.js';

	type Item = { id: number; path: string; name: string };

	function dataA(): Item[] {
		return [
			{ id: 1, path: '1', name: 'A' },
			{ id: 2, path: '1.1', name: 'A1' },
			{ id: 3, path: '1.2', name: 'A2' },
			{ id: 4, path: '2', name: 'B' },
			{ id: 5, path: '2.1', name: 'B1' }
		];
	}
	function dataB(): Item[] {
		return [{ id: 20, path: '1', name: 'T' }];
	}

	let treeAData = $state<Item[]>(dataA());
	let treeBData = $state<Item[]>(dataB());
	let focusedA = $state<LTreeNode<Item> | null>(null);
	let focusedB = $state<LTreeNode<Item> | null>(null);
	let highlightedA = $state<Set<string>>(new Set());
	let highlightedB = $state<Set<string>>(new Set());

	// Captured-context logs (serialized node refs → paths so JSON is cycle-free).
	let clickLog = $state<any[]>([]);
	let dblclickLog = $state<any[]>([]);
	let dragStartLog = $state<any[]>([]);
	let dragOverLog = $state<any[]>([]);
	let dropLog = $state<any[]>([]);
	let highlightLog = $state<any[]>([]);
	let selectionLog = $state<any[]>([]);
	let copyLog = $state<any[]>([]);
	let cutLog = $state<any[]>([]);
	let deleteLog = $state<any[]>([]);

	function clearLogs() {
		clickLog = [];
		dblclickLog = [];
		dragStartLog = [];
		dragOverLog = [];
		dropLog = [];
		highlightLog = [];
		selectionLog = [];
		copyLog = [];
		cutLog = [];
		deleteLog = [];
	}

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	// Serialize a NodeRef to plain, path-only JSON.
	function ref(r: NodeRef<Item> | null) {
		if (!r) return null;
		return {
			path: r.path,
			node: r.node?.path ?? null,
			parent: r.parent?.path ?? null,
			siblings: r.siblings.map((n) => n.path)
		};
	}
	const refs = (rs: NodeRef<Item>[]) => rs.map(ref);

	function logClick(ctx: NodeRef<Item>) {
		clickLog = [...clickLog, ref(ctx)];
	}
	function logDblClick(ctx: NodeRef<Item>) {
		dblclickLog = [...dblclickLog, ref(ctx)];
	}
	function logDragStart(ctx: NodeDragContext<Item>) {
		dragStartLog = [
			...dragStartLog,
			{ ...ref(ctx), hasEvent: !!ctx.event, dragged: refs(ctx.dragged) }
		];
	}
	function logDragOver(ctx: NodeDragContext<Item>) {
		dragOverLog = [
			...dragOverLog,
			{ ...ref(ctx), hasEvent: !!ctx.event, dragged: refs(ctx.dragged) }
		];
	}
	function logDrop(ctx: NodeDropContext<Item>) {
		dropLog = [
			...dropLog,
			{
				source: ref(ctx.source),
				target: ref(ctx.target),
				dragged: refs(ctx.dragged),
				dropped: ctx.dropped ? refs(ctx.dropped) : null,
				position: ctx.position,
				operation: ctx.operation,
				hasEvent: !!ctx.event
			}
		];
	}
	function logHighlight(ctx: SelectionChangeContext<Item>) {
		highlightLog = [...highlightLog, { paths: [...ctx.paths], nodes: ctx.nodes.map((n) => n.path) }];
	}
	function logSelection(ctx: SelectionChangeContext<Item>) {
		selectionLog = [...selectionLog, { paths: [...ctx.paths], nodes: ctx.nodes.map((n) => n.path) }];
	}
	function logCopy(ctx: ClipboardEventContext<Item>) {
		copyLog = [...copyLog, { operation: ctx.operation, paths: ctx.paths, nodes: ctx.nodes.map((n) => n.path) }];
	}
	function logCut(ctx: ClipboardEventContext<Item>) {
		cutLog = [...cutLog, { operation: ctx.operation, paths: ctx.paths, nodes: ctx.nodes.map((n) => n.path) }];
	}
	function logDelete(ctx: ClipboardEventContext<Item>) {
		deleteLog = [...deleteLog, { operation: ctx.operation ?? null, paths: ctx.paths, nodes: ctx.nodes.map((n) => n.path) }];
	}
</script>

<svelte:head><title>Test — Event Context</title></svelte:head>

<main>
	<h1>Event context test</h1>

	<div class="controls">
		<button data-testid="clear" onclick={clearLogs}>Clear logs</button>
	</div>

	<pre data-testid="click-ctx">{JSON.stringify(clickLog)}</pre>
	<pre data-testid="dblclick-ctx">{JSON.stringify(dblclickLog)}</pre>
	<pre data-testid="dragstart-ctx">{JSON.stringify(dragStartLog)}</pre>
	<pre data-testid="dragover-ctx">{JSON.stringify(dragOverLog)}</pre>
	<pre data-testid="drop-ctx">{JSON.stringify(dropLog)}</pre>
	<pre data-testid="highlight-ctx">{JSON.stringify(highlightLog)}</pre>
	<pre data-testid="selection-ctx">{JSON.stringify(selectionLog)}</pre>
	<pre data-testid="copy-ctx">{JSON.stringify(copyLog)}</pre>
	<pre data-testid="cut-ctx">{JSON.stringify(cutLog)}</pre>
	<pre data-testid="delete-ctx">{JSON.stringify(deleteLog)}</pre>

	<div class="trees">
		<div class="tree" data-testid="tree-a" style="max-width: 360px; border: 1px solid #ccc;">
			<Tree
				treeId="treeA"
				data={treeAData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={3}
				clickBehavior="select"
				selectionMode="multi"
				shouldShowCheckboxes={true}
				dragDropMode="both"
				isFlatRenderingEnabled={true}
				getIsDraggableCallback={() => true}
				getIsDropAllowedCallback={() => true}
				shouldHandleKeyboardShortcuts={true}
				bind:focusedNode={focusedA}
				bind:highlightedPaths={highlightedA}
				onNodeClick={logClick}
				onNodeDoubleClick={logDblClick}
				onNodeDragStart={logDragStart}
				onNodeDragOver={logDragOver}
				onNodeDrop={logDrop}
				onHighlightChange={logHighlight}
				onSelectionChange={logSelection}
				onCopy={logCopy}
				onCut={logCut}
				onDelete={logDelete}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span data-name={node.data?.name} data-path={node.path}>{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>

		<div class="tree" data-testid="tree-b" style="max-width: 360px; border: 1px solid #ccc;">
			<Tree
				treeId="treeB"
				data={treeBData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={3}
				clickBehavior="select"
				selectionMode="multi"
				dragDropMode="both"
				isFlatRenderingEnabled={true}
				getIsDraggableCallback={() => true}
				getIsDropAllowedCallback={() => true}
				bind:focusedNode={focusedB}
				bind:highlightedPaths={highlightedB}
				onNodeDrop={logDrop}
			>
				{#snippet nodeTemplate(node: LTreeNode<Item>)}
					<span data-name={node.data?.name} data-path={node.path}>{node.data?.name}</span>
				{/snippet}
			</Tree>
		</div>
	</div>
</main>

<style>
	main { padding: 1rem; font-family: system-ui, sans-serif; }
	.controls { display: flex; gap: 1rem; align-items: center; margin-bottom: 0.5rem; }
	.trees { display: flex; gap: 1rem; }
	pre { font-size: 11px; white-space: pre-wrap; word-break: break-all; margin: 2px 0; }
</style>
