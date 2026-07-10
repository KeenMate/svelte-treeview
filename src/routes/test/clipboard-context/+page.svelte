<script lang="ts">
	// Deterministic e2e fixture that captures the EXACT context object each clipboard
	// callback receives, serialized to the DOM so a spec can assert field-by-field:
	//   - nodeOutputTransformationCallback / nodeInputTransformationCallback (NodeTransformContext)
	//   - beforeCopyCallback / beforeCutCallback (BeforeCopyContext)
	//   - beforePasteCallback (BeforePasteContext) / beforeDeleteCallback (BeforeDeleteContext)
	//   - onTreeKeydown ({ event, focusedNode, highlightedNodes, controller })
	// Two trees (treeA source / treeB target) exercise same-tree vs cross-tree source refs.
	// Targeted by e2e/clipboard-context.spec.ts.
	import { Tree, uniqueName } from '$lib/index.js';
	import type {
		TreeController,
		NodeTransformContext,
		BeforeCopyContext,
		BeforePasteContext,
		BeforeDeleteContext,
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
	let nextId = 100;

	// Paste knobs the spec flips before pressing Ctrl+V.
	let pastePosition = $state<'child' | 'before' | 'after'>('child');
	let pasteAtRoot = $state(false);

	// Captured-context logs (serialized node refs → paths so JSON is cycle-free).
	let copyCtxLog = $state<any[]>([]);
	let pasteCtxLog = $state<any[]>([]);
	let beforeCopyLog = $state<any[]>([]);
	let beforeCutLog = $state<any[]>([]);
	let beforePasteLog = $state<any[]>([]);
	let beforeDeleteLog = $state<any[]>([]);
	let keydownLog = $state<any[]>([]);

	function clearLogs() {
		copyCtxLog = [];
		pasteCtxLog = [];
		beforeCopyLog = [];
		beforeCutLog = [];
		beforePasteLog = [];
		beforeDeleteLog = [];
		keydownLog = [];
	}

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	// Serialize one source/target side to plain, path-only JSON. childrenOfNode is the
	// batch-aware landing set for a 'child' paste (Object.values(node.children)).
	function side(s: NodeTransformContext<Item>['source'] | NodeTransformContext<Item>['target']) {
		if (!s) return null;
		return {
			path: s.path,
			node: s.node?.path ?? null,
			parent: s.parent?.path ?? null,
			siblings: s.siblings.map((n) => n.path),
			childrenOfNode: s.node ? Object.values(s.node.children).map((c) => c.path) : null
		};
	}
	function serializeCtx(data: Item, ctx: NodeTransformContext<Item>) {
		return {
			operation: ctx.operation,
			phase: ctx.phase,
			isRoot: ctx.isRoot,
			index: ctx.index,
			position: ctx.position,
			dataName: data.name,
			source: side(ctx.source),
			target: side(ctx.target)
		};
	}

	function copyTransform(data: Item, ctx: NodeTransformContext<Item>): Item {
		copyCtxLog = [...copyCtxLog, serializeCtx(data, ctx)];
		return data;
	}
	function pasteTransform(data: Item, ctx: NodeTransformContext<Item>): Item {
		pasteCtxLog = [...pasteCtxLog, serializeCtx(data, ctx)];
		const landing =
			ctx.position === 'child' && ctx.target?.node
				? Object.values(ctx.target.node.children)
				: ctx.target?.siblings ?? [];
		return {
			...data,
			id: nextId++,
			path: '',
			name: ctx.isRoot ? uniqueName(data.name, landing.map((s) => s.data?.name ?? '')) : data.name
		};
	}

	function beforeCopy(ctx: BeforeCopyContext<Item>) {
		beforeCopyLog = [...beforeCopyLog, { operation: ctx.operation, paths: ctx.paths, nodes: ctx.nodes.map((n) => n.path) }];
	}
	function beforeCut(ctx: BeforeCopyContext<Item>) {
		beforeCutLog = [...beforeCutLog, { operation: ctx.operation, paths: ctx.paths, nodes: ctx.nodes.map((n) => n.path) }];
	}
	function beforePaste(ctx: BeforePasteContext<Item>) {
		beforePasteLog = [
			...beforePasteLog,
			{
				operation: ctx.operation,
				target: { path: ctx.target.path, node: ctx.target.node?.path ?? null },
				entries: ctx.entries.map((e) => e.sourcePath)
			}
		];
	}
	function beforeDelete(ctx: BeforeDeleteContext<Item>) {
		beforeDeleteLog = [...beforeDeleteLog, { paths: ctx.paths, nodes: ctx.nodes.map((n) => n.path) }];
	}

	function clipPaths(controller: TreeController<Item>, focused: LTreeNode<Item> | null): string[] {
		if (controller.highlightedPaths.size > 0) return [...controller.highlightedPaths];
		return focused ? [focused.path] : [];
	}

	function makeKeydown(getFocused: () => LTreeNode<Item> | null) {
		return function ({
			event,
			focusedNode,
			highlightedNodes,
			controller
		}: {
			event: KeyboardEvent;
			focusedNode: LTreeNode<Item> | null;
			highlightedNodes: LTreeNode<Item>[];
			controller: TreeController<Item>;
		}): boolean {
			keydownLog = [
				...keydownLog,
				{
					key: event.key,
					ctrl: event.ctrlKey || event.metaKey,
					focusedNode: focusedNode?.path ?? null,
					highlightedNodes: highlightedNodes.map((n) => n.path)
				}
			];
			const focused = getFocused();
			const mod = event.ctrlKey || event.metaKey;
			const key = event.key.toLowerCase();
			if (mod && key === 'c') {
				const p = clipPaths(controller, focused);
				if (p.length) controller.copyNodes(p);
				return true;
			}
			if (mod && key === 'x') {
				const p = clipPaths(controller, focused);
				if (p.length) controller.cutNodes(p);
				return true;
			}
			if (mod && key === 'v') {
				if (!controller.hasClipboardContent()) return true;
				const targetPath = pasteAtRoot ? '' : focused?.path ?? '';
				controller.pasteNodes(targetPath, undefined, pastePosition);
				return true;
			}
			if (event.key === 'Delete') {
				const p = clipPaths(controller, focused);
				if (p.length) controller.deleteNodes(p);
				return true;
			}
			return false;
		};
	}
	const onKeydownA = makeKeydown(() => focusedA);
	const onKeydownB = makeKeydown(() => focusedB);
</script>

<svelte:head><title>Test — Clipboard Context</title></svelte:head>

<main>
	<h1>Clipboard context test</h1>

	<div class="controls">
		<button data-testid="clear" onclick={clearLogs}>Clear logs</button>
		<label><input type="radio" data-testid="pos-child" name="pos" value="child" bind:group={pastePosition} /> child</label>
		<label><input type="radio" data-testid="pos-before" name="pos" value="before" bind:group={pastePosition} /> before</label>
		<label><input type="radio" data-testid="pos-after" name="pos" value="after" bind:group={pastePosition} /> after</label>
		<label><input type="checkbox" data-testid="paste-at-root" bind:checked={pasteAtRoot} /> paste at root</label>
	</div>

	<pre data-testid="copy-ctx">{JSON.stringify(copyCtxLog)}</pre>
	<pre data-testid="paste-ctx">{JSON.stringify(pasteCtxLog)}</pre>
	<pre data-testid="before-copy-ctx">{JSON.stringify(beforeCopyLog)}</pre>
	<pre data-testid="before-cut-ctx">{JSON.stringify(beforeCutLog)}</pre>
	<pre data-testid="before-paste-ctx">{JSON.stringify(beforePasteLog)}</pre>
	<pre data-testid="before-delete-ctx">{JSON.stringify(beforeDeleteLog)}</pre>
	<pre data-testid="keydown-ctx">{JSON.stringify(keydownLog)}</pre>

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
				bind:focusedNode={focusedA}
				bind:highlightedPaths={highlightedA}
				onTreeKeydown={onKeydownA}
				beforeCopyCallback={beforeCopy}
				beforeCutCallback={beforeCut}
				beforePasteCallback={beforePaste}
				beforeDeleteCallback={beforeDelete}
				nodeOutputTransformationCallback={copyTransform}
				nodeInputTransformationCallback={pasteTransform}
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
				bind:focusedNode={focusedB}
				bind:highlightedPaths={highlightedB}
				onTreeKeydown={onKeydownB}
				beforeCopyCallback={beforeCopy}
				beforeCutCallback={beforeCut}
				beforePasteCallback={beforePaste}
				beforeDeleteCallback={beforeDelete}
				nodeOutputTransformationCallback={copyTransform}
				nodeInputTransformationCallback={pasteTransform}
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
