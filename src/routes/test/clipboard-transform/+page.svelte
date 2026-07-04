<script lang="ts">
	// Deterministic e2e fixture for the NEW clipboard data-flow (rc12+):
	//  - pasteNodeTransformationCallback (per-node derive ids/names, return null to SKIP)
	//  - copyNodeTransformationCallback (clean/redact at snapshot time)
	//  - leaf-aware paste position (paste onto a file → siblings, via allowedDropPositions)
	//  - per-entry self-paste skip + PasteResult.skipped (no silent all-or-nothing)
	//  - Delete with a "node has subnodes" guard + warning
	// Targeted by e2e/clipboard-transform.spec.ts. Uses the prop-based transform (declared
	// once on <Tree>), NOT the legacy beforePaste-mutation style (see /test/clipboard).
	import { Tree, uniqueName } from '$lib/index.js';
	import type {
		TreeController,
		NodeTransformContext
	} from '$lib/index.js';
	import type { LTreeNode, DropPosition } from '$lib/index.js';

	type Item = { id: number; path: string; name: string; type: 'folder' | 'file'; secret?: string };

	function initialData(): Item[] {
		return [
			{ id: 1, path: '1', name: 'Folder A', type: 'folder' },
			{ id: 2, path: '1.1', name: 'a1.txt', type: 'file', secret: 'top' },
			{ id: 3, path: '1.2', name: 'a2.txt', type: 'file' },
			{ id: 4, path: '1.3', name: 'locked.txt', type: 'file' },
			{ id: 5, path: '2', name: 'Folder B', type: 'folder' },
			{ id: 6, path: '2.1', name: 'b1.txt', type: 'file' }
		];
	}

	let data = $state<Item[]>(initialData());
	let treeRef: Tree<Item>;
	let focusedNode = $state<LTreeNode<Item> | null>(null);
	let highlightedPaths = $state<Set<string>>(new Set());
	let lastLog = $state('');
	let pasteCount = $state(0);
	let pasteSkipped = $state(0);
	let deleteWarning = $state('');
	let nextId = 100;

	const canHaveChildren = (node: LTreeNode<Item> | null) => node?.data?.type === 'folder';

	function sortByName(items: LTreeNode<Item>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	function clipboardPaths(controller: TreeController<Item>): string[] {
		if (controller.highlightedPaths.size > 0) return [...controller.highlightedPaths];
		return focusedNode ? [focusedNode.path] : [];
	}

	// Clean at snapshot time: redact `secret` before data lands on the shared clipboard.
	function copyTransform(item: Item, _ctx: NodeTransformContext<Item>): Item {
		return item.secret !== undefined ? { ...item, secret: 'REDACTED' } : item;
	}

	// Per-node paste derivation: fresh id, collision-free name on roots, and SKIP
	// (return null) any node named "locked.txt" to exercise per-entry skipping.
	function pasteTransform(item: Item, ctx: NodeTransformContext<Item>): Item | null {
		if (item.name === 'locked.txt') return null;
		// Landing neighbours = target.node's children for a 'child' paste, else the anchor's
		// siblings (top-level = target.siblings when there's no anchor node at the root).
		const landing =
			ctx.position === 'child' && ctx.target?.node
				? Object.values(ctx.target.node.children)
				: ctx.target?.siblings ?? [];
		const taken = landing.map((s) => s.data?.name ?? '');
		return {
			...item,
			id: nextId++,
			path: '',
			name: ctx.isRoot ? uniqueName(item.name, taken) : item.name
		};
	}

	function onTreeKeydown({
		event,
		controller
	}: {
		event: KeyboardEvent;
		focusedNode: LTreeNode<Item> | null;
		highlightedNodes: LTreeNode<Item>[];
		controller: TreeController<Item>;
	}): boolean {
		const mod = event.ctrlKey || event.metaKey;
		const key = event.key.toLowerCase();

		if (mod && key === 'c') {
			const paths = clipboardPaths(controller);
			if (!paths.length) return true;
			controller.copyNodes(paths);
			lastLog = `copied ${paths.length}`;
			return true;
		}
		if (mod && key === 'x') {
			const paths = clipboardPaths(controller);
			if (!paths.length) return true;
			controller.cutNodes(paths);
			lastLog = `cut ${paths.length}`;
			return true;
		}
		if (mod && key === 'v') {
			if (!controller.hasClipboardContent()) return true;
			const result = controller.pasteNodes(focusedNode?.path ?? '');
			pasteCount = result.count;
			pasteSkipped = result.skipped;
			lastLog = result.success
				? `pasted ${result.count} skipped ${result.skipped}`
				: `paste-failed ${result.error}`;
			return true;
		}
		if (event.key === 'Delete') {
			const paths = clipboardPaths(controller);
			if (!paths.length) return true;
			const sep = '.';
			const topLevel = paths.filter((p) => !paths.some((o) => o !== p && p.startsWith(o + sep)));
			let removed = 0;
			let blocked = 0;
			for (const p of topLevel) {
				const node = treeRef.getNodeByPath(p);
				if (node && Object.keys(node.children).length > 0) {
					blocked++;
					continue;
				}
				if (treeRef.removeNode(p).success) removed++;
			}
			controller.clearHighlight();
			focusedNode = null;
			deleteWarning = blocked > 0 ? `Cannot delete ${blocked} node(s) with subnodes` : '';
			lastLog = `deleted ${removed} blocked ${blocked}`;
			return true;
		}
		return false;
	}
</script>

<svelte:head><title>Test — Clipboard Transform</title></svelte:head>

<main>
	<h1>Clipboard transform test</h1>

	<div data-testid="last-log">{lastLog}</div>
	<div data-testid="paste-count">{pasteCount}</div>
	<div data-testid="paste-skipped">{pasteSkipped}</div>
	<div data-testid="delete-warning">{deleteWarning}</div>
	<div data-testid="focused-path">{focusedNode?.path ?? ''}</div>

	<div style="max-width: 500px; border: 1px solid #ccc;">
		<Tree
			bind:this={treeRef}
			{data}
			idMember="id"
			pathMember="path"
			sortCallback={sortByName}
			isSorted={true}
			expandLevel={3}
			clickBehavior="select"
			selectionMode="multi"
			dragDropMode="both"
			getAllowedDropPositionsCallback={(node): DropPosition[] | undefined =>
				canHaveChildren(node) ? undefined : ['before', 'after']}
			bind:focusedNode
			bind:highlightedPaths
			{onTreeKeydown}
			copyNodeTransformationCallback={copyTransform}
			pasteNodeTransformationCallback={pasteTransform}
		>
			{#snippet nodeTemplate(node: LTreeNode<Item>)}
				<span
					data-testid="ct-node-{node.path}"
					data-name={node.data?.name}
					data-path={node.path}
					data-secret={node.data?.secret ?? ''}
				>
					{node.data?.name}
				</span>
			{/snippet}
		</Tree>
	</div>
</main>

<style>
	main { padding: 1rem; font-family: system-ui, sans-serif; }
</style>
