<script lang="ts">
	// Windows File Explorer clone built on @keenmate/svelte-treeview.
	// BOTH panes are <Tree> instances with custom nodeTemplate renderers:
	//   • LEFT  — the folder navigation tree (hierarchical, folders only).
	//   • RIGHT — the details list (flat: the current folder's children rendered as
	//             a 4-column grid). Selection, keyboard nav, the context menu, and
	//             double-click-to-open all come from the library; the columns line up
	//             because each row's .stv__node-content is a CSS grid and the header
	//             shares the same track template inside one sticky-header scroll area.
	import { tick, onMount } from 'svelte';
	import { Tree } from '$lib/index.js';
	import type { LTreeNode, ContextMenuEntry } from '$lib/ltree/types.js';
	import { explorerData, DEFAULT_PATH, type FsNode } from './explorer-data.js';

	const SEP = '.';

	// Mutable filesystem (New folder / Rename / Delete operate on this).
	let fs = $state<FsNode[]>(explorerData.map((n) => ({ ...n })));

	// The folder-only slice drives the nav tree.
	const folderData = $derived(fs.filter((n) => n.kind === 'folder'));

	let navTreeRef: Tree<FsNode>;
	let focusedFolder = $state<LTreeNode<FsNode> | null>(null);

	let currentPath = $state(DEFAULT_PATH); // C:\Windows
	let filter = $state('');
	let sortKey = $state<'name' | 'modified' | 'type' | 'size'>('name');
	let sortDir = $state<'asc' | 'desc'>('asc');
	let statusInfo = $state<string | null>(null); // transient status-bar message

	// Right-pane selection lives in the right <Tree>'s highlight set. Its paths are
	// the synthetic per-row paths (see rightTreeData), not the real fs paths.
	let rightSel = $state<Set<string>>(new Set());

	let history = $state<string[]>([DEFAULT_PATH]);
	let histIndex = $state(0);

	// ── path helpers ─────────────────────────────────────────────────────────
	const byPath = (p: string) => fs.find((n) => n.path === p);
	const parentOf = (p: string) => {
		const i = p.lastIndexOf(SEP);
		return i === -1 ? '' : p.slice(0, i);
	};
	function ancestorPaths(p: string): string[] {
		const segs = p.split(SEP);
		const out: string[] = [];
		for (let i = 1; i < segs.length; i++) out.push(segs.slice(0, i).join(SEP));
		return out; // excludes p itself
	}
	function directChildren(parentPath: string, list: FsNode[]): FsNode[] {
		const prefix = parentPath ? parentPath + SEP : '';
		return list.filter((n) => {
			if (!n.path.startsWith(prefix) || n.path === parentPath) return false;
			const rest = n.path.slice(prefix.length);
			return rest.length > 0 && !rest.includes(SEP);
		});
	}
	// Everything nested under parentPath, any depth (used by recursive search).
	function descendantsOf(parentPath: string, list: FsNode[]): FsNode[] {
		const prefix = parentPath + SEP;
		return list.filter((n) => n.path.startsWith(prefix));
	}
	// Folder chain from currentPath down to an item's parent, e.g. "System32 \ drivers \ etc".
	function locationOf(p: string): string {
		const names: string[] = [];
		let cur = parentOf(p);
		while (cur && cur.length > currentPath.length && cur !== currentPath) {
			names.unshift(byPath(cur)?.name ?? cur);
			cur = parentOf(cur);
		}
		return names.join(' \\ ');
	}

	// ── formatting ─────────────────────────────────────────────────────────────
	function formatSize(b: number | null): string {
		if (b == null) return '';
		if (b < 1024) return `${b} B`;
		const kb = b / 1024;
		if (kb < 1024) return `${Math.max(1, Math.round(kb)).toLocaleString('en-US')} KB`;
		const mb = kb / 1024;
		if (mb < 1024) return `${mb.toFixed(1)} MB`;
		return `${(mb / 1024).toFixed(1)} GB`;
	}

	const TYPE_NAMES: Record<string, string> = {
		css: 'Cascading Style Sheet', js: 'JavaScript File', md: 'Markdown File',
		html: 'HTML Document', txt: 'Text Document', ini: 'Configuration settings',
		yml: 'YAML File', log: 'Text Document', json: 'JSON File', mp3: 'MP3 File',
		mp4: 'MP4 Video', mov: 'MOV Video', flac: 'FLAC File',
		jpg: 'JPG File', png: 'PNG File', ico: 'Icon', gif: 'GIF File', bmp: 'BMP File',
		exe: 'Application', dll: 'Application extension', sys: 'System file',
		ttf: 'TrueType font file', fon: 'Font file', cur: 'Cursor', ani: 'Animated Cursor',
		wav: 'Wave Sound', inf: 'Setup Information', admx: 'ADMX File', adml: 'ADML File',
		nls: 'NLS File', dat: 'DAT File', edb: 'EDB File', sdb: 'Security database',
		theme: 'Windows Theme File', msstyles: 'Visual Style', rtf: 'Rich Text Document',
		mui: 'MUI File', bin: 'BIN File', xlsx: 'Microsoft Excel Worksheet', zip: 'Compressed (zipped) Folder'
	};
	function typeLabel(n: FsNode): string {
		if (n.kind === 'folder') return 'File folder';
		if (!n.ext) return 'File';
		return TYPE_NAMES[n.ext] ?? `${n.ext.toUpperCase()} File`;
	}
	function iconFor(n: FsNode): string {
		if (n.kind === 'folder') return '📁';
		if (['jpg', 'png', 'ico', 'gif', 'bmp'].includes(n.ext)) return '🖼️';
		if (['mp3', 'wav', 'flac'].includes(n.ext)) return '🎵';
		if (['mp4', 'mov', 'avi'].includes(n.ext)) return '🎬';
		if (['zip', 'rar', '7z'].includes(n.ext)) return '🗜️';
		if (['exe'].includes(n.ext)) return '⚙️';
		if (['dll', 'sys', 'mui', 'nls', 'dat', 'bin', 'edb', 'sdb'].includes(n.ext)) return '🧩';
		if (['ttf', 'fon'].includes(n.ext)) return '🔤';
		if (['cur', 'ani'].includes(n.ext)) return '🖱️';
		if (['ini', 'inf', 'admx', 'adml', 'theme', 'msstyles'].includes(n.ext)) return '🛠️';
		return '📄';
	}
	function previewText(n: FsNode): string {
		return `${n.name} — ${typeLabel(n)}${n.size != null ? ' · ' + formatSize(n.size) : ''}`;
	}

	// ── sorting ──────────────────────────────────────────────────────────────
	const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
	function parseDate(s: string): number {
		const m = s.match(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})/);
		return m ? Number(`${m[3]}${m[2]}${m[1]}${m[4]}${m[5]}`) : 0;
	}
	function sortItems(items: FsNode[]): FsNode[] {
		const sign = sortDir === 'asc' ? 1 : -1;
		return [...items].sort((a, b) => {
			if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1; // folders first
			let r = 0;
			if (sortKey === 'name') r = collator.compare(a.name, b.name);
			else if (sortKey === 'type') r = collator.compare(typeLabel(a), typeLabel(b));
			else if (sortKey === 'size') r = (a.size ?? -1) - (b.size ?? -1);
			else r = parseDate(a.modified) - parseDate(b.modified);
			return (r || collator.compare(a.name, b.name)) * sign;
		});
	}

	// ── derived view state ─────────────────────────────────────────────────────
	const isSearching = $derived(filter.trim().length > 0);
	// Build a name predicate. A query with `*`/`?` is treated as an anchored glob
	// (so `*.dll` matches names ending in .dll); otherwise it's a substring match.
	function makeMatcher(query: string): (name: string) => boolean {
		const q = query.trim().toLowerCase();
		if (!q) return () => true;
		if (/[*?]/.test(q)) {
			const rx = new RegExp(
				'^' + q.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
			);
			return (name) => rx.test(name.toLowerCase());
		}
		return (name) => name.toLowerCase().includes(q);
	}
	const rightItems = $derived.by(() => {
		// When searching, recurse into all subfolders (like Explorer); otherwise just
		// the current folder's direct children.
		if (isSearching) {
			const match = makeMatcher(filter);
			return sortItems(descendantsOf(currentPath, fs).filter((n) => match(n.name)));
		}
		return sortItems(directChildren(currentPath, fs));
	});

	// The right <Tree> wants a path-keyed dataset. We feed it the already-sorted
	// list re-keyed to flat synthetic paths ("1", "2", …) so it renders a flat list
	// (real fs paths would imply a hierarchy). Each row keeps its real FsNode fields,
	// plus `treePath` for the tree and selection mapping.
	type RightItem = FsNode & { treePath: string };
	const rightTreeData = $derived<RightItem[]>(rightItems.map((n, i) => ({ ...n, treePath: String(i + 1) })));
	// Preserve our sort order in the tree (its sortCallback would otherwise reorder).
	const keepRightOrder = (items: LTreeNode<RightItem>[]) =>
		[...items].sort((a, b) => Number(a.data?.treePath ?? 0) - Number(b.data?.treePath ?? 0));
	// Per-row class from data — dogfoods the nodeClass hook.
	const rightNodeClass = (node: LTreeNode<RightItem>) =>
		node.data?.kind === 'folder' ? 'winx-folder' : 'winx-file';

	const selectedNodes = $derived(rightTreeData.filter((n) => rightSel.has(n.treePath)));
	const selectedCount = $derived(selectedNodes.length);

	const breadcrumb = $derived(
		[...ancestorPaths(currentPath), currentPath].map((p) => ({ path: p, name: byPath(p)?.name ?? p }))
	);
	const canBack = $derived(histIndex > 0);
	const canFwd = $derived(histIndex < history.length - 1);
	const canUp = $derived(currentPath !== '1' && !!parentOf(currentPath));

	function sortBy(key: typeof sortKey) {
		if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else { sortKey = key; sortDir = 'asc'; }
	}

	// ── navigation ─────────────────────────────────────────────────────────────
	async function revealInTree(path: string) {
		for (const a of ancestorPaths(path)) await navTreeRef?.expandNodes(a);
		if (byPath(path)?.kind === 'folder') await navTreeRef?.expandNodes(path);
		navTreeRef?.focusNode(path);
	}
	function navigateTo(path: string, opts: { pushHistory?: boolean; syncTree?: boolean } = {}) {
		const { pushHistory = true, syncTree = true } = opts;
		if (!byPath(path)) return;
		statusInfo = null;
		currentPath = path;
		filter = ''; // opening/navigating clears the active search (Explorer behaviour)
		rightSel = new Set();
		if (pushHistory) {
			history = [...history.slice(0, histIndex + 1), path];
			histIndex = history.length - 1;
		}
		if (syncTree) revealInTree(path);
	}
	const goBack = () => { if (canBack) { histIndex--; navigateTo(history[histIndex], { pushHistory: false }); } };
	const goForward = () => { if (canFwd) { histIndex++; navigateTo(history[histIndex], { pushHistory: false }); } };
	const goUp = () => { if (canUp) navigateTo(parentOf(currentPath)); };

	// ── opening (double-click / Enter via the right tree) ────────────────────────
	function open(n: FsNode) {
		if (n.kind === 'folder') navigateTo(n.path);
		else statusInfo = `Opening “${n.name}”…`;
	}

	// ── mutations ────────────────────────────────────────────────────────────────
	const nextId = () => Math.max(0, ...fs.map((n) => n.id)) + 1;
	function nextChildPath(parentPath: string): string {
		const prefix = parentPath ? parentPath + SEP : '';
		let max = 0;
		for (const k of directChildren(parentPath, fs)) {
			const seg = Number(k.path.slice(prefix.length));
			if (Number.isFinite(seg) && seg > max) max = seg;
		}
		return `${prefix}${max + 1}`;
	}
	function uniqueName(base: string, parentPath: string): string {
		const taken = new Set(directChildren(parentPath, fs).map((n) => n.name));
		if (!taken.has(base)) return base;
		let n = 2;
		while (taken.has(`${base} (${n})`)) n++;
		return `${base} (${n})`;
	}
	// Reassigning `fs` re-inits the nav tree, so snapshot + restore its expansion.
	async function withTreeState(mutate: () => void) {
		const expanded = navTreeRef?.getExpandedPaths() ?? [];
		mutate();
		await tick();
		navTreeRef?.setExpandedPaths(expanded);
		for (const a of ancestorPaths(currentPath)) await navTreeRef?.expandNodes(a);
		navTreeRef?.focusNode(currentPath);
	}
	async function newFolder() {
		const path = nextChildPath(currentPath);
		const name = uniqueName('New folder', currentPath);
		await withTreeState(() => {
			fs = [...fs, { id: nextId(), path, name, kind: 'folder', ext: '', modified: '28.06.2026 10:00', size: null }];
		});
		// Select the freshly created folder in the right pane (find its synthetic path).
		const created = rightTreeData.find((n) => n.path === path);
		rightSel = created ? new Set([created.treePath]) : new Set();
	}
	function deleteNodes(targets: FsNode[]) {
		if (!targets.length) return;
		const doomed = new Set<string>();
		for (const t of targets) {
			doomed.add(t.path);
			for (const n of fs) if (n.path.startsWith(t.path + SEP)) doomed.add(n.path);
		}
		withTreeState(() => { fs = fs.filter((n) => !doomed.has(n.path)); });
		rightSel = new Set();
	}
	function renameNode(target: FsNode) {
		const next = typeof prompt === 'function' ? prompt('Rename', target.name) : null;
		if (!next || next === target.name) return;
		withTreeState(() => {
			fs = fs.map((n) => (n.path === target.path ? { ...n, name: uniqueName(next, parentOf(target.path)) } : n));
		});
	}
	function selectAll() { rightSel = new Set(rightTreeData.map((n) => n.treePath)); }

	// Full Windows-style path, e.g. C:\Windows\System32\drivers\etc\hosts.
	function fullPathOf(p: string): string {
		return [...ancestorPaths(p), p]
			.map((q) => byPath(q)?.name ?? q)
			.filter((name) => name !== 'This PC')
			.map((name) => (name.startsWith('Local Disk') ? 'C:' : name))
			.join('\\');
	}
	async function copyPath(node: FsNode) {
		const text = fullPathOf(node.path);
		try { await navigator.clipboard?.writeText(text); } catch { /* clipboard may be blocked */ }
		statusInfo = `Path copied: ${text}`;
	}

	// Library context menu for the right pane. Acts on the current selection when the
	// right-clicked row is part of it, otherwise on just that row (Explorer behaviour).
	function rightMenu(
		node: LTreeNode<RightItem>,
		_close: () => void,
		selected?: LTreeNode<RightItem>[]
	): ContextMenuEntry[] {
		const data = node.data!;
		const inSel = rightSel.has(data.treePath);
		const targets: FsNode[] = inSel && selected?.length ? selected.map((s) => s.data!) : [data];
		return [
			{ label: 'Open', icon: data.kind === 'folder' ? '📂' : '📄', onclick: () => open(data) },
			{ divider: true },
			{ label: 'Copy path', icon: '📋', onclick: () => copyPath(data) },
			{ label: 'Rename', icon: '✎', isDisabled: targets.length !== 1, onclick: () => renameNode(targets[0]) },
			{ label: `Delete${targets.length > 1 ? ` (${targets.length})` : ''}`, icon: '🗑', className: 'danger', onclick: () => deleteNodes(targets) },
			{ divider: true },
			{ label: 'New folder', icon: '🗀', onclick: () => newFolder() },
			{ label: 'Select all', onclick: () => selectAll() }
		];
	}

	function navSort(items: LTreeNode<FsNode>[]) {
		return [...items].sort((a, b) => collator.compare(a.data?.name ?? '', b.data?.name ?? ''));
	}

	onMount(() => {
		// Reveal C:\Windows in the nav tree on first paint.
		revealInTree(currentPath);
	});
</script>

<div class="winx" role="application" aria-label="File Explorer">
	<!-- Title bar -->
	<div class="winx__titlebar">
		<span class="winx__title">📁 {byPath(currentPath)?.name ?? 'Explorer'}</span>
		<div class="winx__winbtns" aria-hidden="true">
			<span class="winx__winbtn">—</span>
			<span class="winx__winbtn">▢</span>
			<span class="winx__winbtn winx__winbtn--close">✕</span>
		</div>
	</div>

	<!-- Command bar -->
	<div class="winx__commandbar">
		<button class="winx__navbtn" disabled={!canBack} onclick={goBack} title="Back" aria-label="Back">←</button>
		<button class="winx__navbtn" disabled={!canFwd} onclick={goForward} title="Forward" aria-label="Forward">→</button>
		<button class="winx__navbtn" disabled={!canUp} onclick={goUp} title="Up" aria-label="Up">↑</button>

		<!-- Address bar / breadcrumb -->
		<div class="winx__address">
			{#each breadcrumb as crumb, i (crumb.path)}
				<button class="winx__crumb" onclick={() => navigateTo(crumb.path)}>{crumb.name}</button>
				{#if i < breadcrumb.length - 1}<span class="winx__crumb-sep">›</span>{/if}
			{/each}
		</div>

		<div class="winx__search">
			<span class="winx__search-icon" aria-hidden="true">🔎</span>
			<input
				type="text"
				placeholder="Search {byPath(currentPath)?.name ?? ''}"
				bind:value={filter}
				aria-label="Search current folder and subfolders"
			/>
		</div>
	</div>

	<!-- Action bar -->
	<div class="winx__actionbar">
		<button class="winx__action" onclick={newFolder}>🗀 New folder</button>
		<span class="winx__sep"></span>
		<button class="winx__action" disabled={selectedCount !== 1} onclick={() => renameNode(selectedNodes[0])}>✎ Rename</button>
		<button class="winx__action winx__action--danger" disabled={selectedCount === 0} onclick={() => deleteNodes(selectedNodes)}>🗑 Delete</button>
	</div>

	<!-- Body: nav pane + contents pane -->
	<div class="winx__body">
		<div class="winx__nav">
			<Tree
				bind:this={navTreeRef}
				data={folderData}
				idMember="id"
				pathMember="path"
				sortCallback={navSort}
				isSorted={true}
				expandLevel={2}
				clickBehavior="select"
				leafIconClass=""
				bind:focusedNode={focusedFolder}
				onNodeClick={({ node }) => { if (node) navigateTo(node.path, { syncTree: false }); }}
				onNodeDoubleClick={({ node }) => { if (node) navigateTo(node.path); }}
			>
				{#snippet nodeTemplate(node: LTreeNode<FsNode>)}
					<span class="winx__navrow">
						<span class="winx__navicon">📁</span>{node.data?.name}
					</span>
				{/snippet}
			</Tree>
		</div>

		<!-- Right pane: a second <Tree> rendering the details list -->
		<div class="winx__contents">
			<!-- column header (sticky; shares the row grid template) -->
			<div class="winx__cols">
				<button class="winx__col winx__col--name" onclick={() => sortBy('name')}>
					Name {sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
				</button>
				<button class="winx__col winx__col--date" onclick={() => sortBy('modified')}>
					Date modified {sortKey === 'modified' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
				</button>
				<button class="winx__col winx__col--type" onclick={() => sortBy('type')}>
					Type {sortKey === 'type' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
				</button>
				<button class="winx__col winx__col--size" onclick={() => sortBy('size')}>
					Size {sortKey === 'size' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
				</button>
			</div>

			<div class="winx-right" aria-label="Folder contents">
				<Tree
					data={rightTreeData}
					idMember="id"
					pathMember="treePath"
					sortCallback={keepRightOrder}
					isSorted={true}
					expandLevel={1}
					clickBehavior="select"
					selectionMode="multi"
					leafIconClass=""
					nodeClass={rightNodeClass}
					bind:highlightedPaths={rightSel}
					onNodeClick={({ node }) => { if (node?.data) statusInfo = previewText(node.data); }}
					onNodeDoubleClick={({ node }) => { if (node?.data) open(node.data); }}
					getContextMenuItemsCallback={rightMenu}
				>
					{#snippet nodeTemplate(node: LTreeNode<RightItem>)}
						{@const item = node.data!}
						<span class="winx__cell winx__cell--name">
							<span class="winx__rowicon">{iconFor(item)}</span>
							<span class="winx__namebox">
								<span class="winx__rowname">{item.name}</span>
								{#if isSearching}
									<span class="winx__rowloc">in {byPath(currentPath)?.name}{locationOf(item.path) ? ' \\ ' + locationOf(item.path) : ''}</span>
								{/if}
							</span>
						</span>
						<span class="winx__cell winx__cell--date">{item.modified}</span>
						<span class="winx__cell winx__cell--type">{typeLabel(item)}</span>
						<span class="winx__cell winx__cell--size">{formatSize(item.size)}</span>
					{/snippet}
				</Tree>

				{#if rightTreeData.length === 0}
					<div class="winx__empty">
						{filter ? `No items match "${filter}".` : 'This folder is empty.'}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Status bar -->
	<div class="winx__status">
		<span>{rightTreeData.length} item{rightTreeData.length === 1 ? '' : 's'}</span>
		{#if selectedCount > 0}<span class="winx__status-sel">{selectedCount} item{selectedCount === 1 ? '' : 's'} selected</span>{/if}
		{#if statusInfo}<span class="winx__status-info">{statusInfo}</span>{/if}
	</div>
</div>

<style>
	.winx {
		--winx-accent: #0067c0;
		--winx-border: #d9d9d9;
		font-family: 'Segoe UI', system-ui, sans-serif;
		font-size: 13px;
		color: #1b1b1b;
		background: #f3f3f3;
		border: 1px solid #c8c8c8;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
		display: flex;
		flex-direction: column;
		height: 620px;
		user-select: none;
	}

	/* Title bar */
	.winx__titlebar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 32px;
		padding: 0 0 0 12px;
		background: linear-gradient(180deg, #d23b3b 0%, #c42d2d 100%);
		color: #fff;
	}
	.winx__title { font-size: 12.5px; font-weight: 500; }
	.winx__winbtns { display: flex; height: 100%; }
	.winx__winbtn {
		display: flex; align-items: center; justify-content: center;
		width: 46px; height: 100%; font-size: 12px;
	}
	.winx__winbtn--close { background: rgba(255, 255, 255, 0.08); }

	/* Command bar */
	.winx__commandbar {
		display: flex; align-items: center; gap: 4px;
		padding: 6px 8px; background: #fafafa; border-bottom: 1px solid var(--winx-border);
	}
	.winx__navbtn {
		width: 30px; height: 28px; border: none; background: transparent; border-radius: 4px;
		font-size: 15px; color: #444; cursor: pointer;
	}
	.winx__navbtn:hover:not(:disabled) { background: #eaeaea; }
	.winx__navbtn:disabled { color: #bbb; cursor: default; }

	.winx__address {
		flex: 1; display: flex; align-items: center; gap: 1px; min-width: 0;
		height: 28px; padding: 0 8px; margin: 0 4px;
		background: #fff; border: 1px solid var(--winx-border); border-radius: 4px;
		overflow: hidden; white-space: nowrap;
	}
	.winx__crumb {
		border: none; background: transparent; cursor: pointer; padding: 3px 6px;
		border-radius: 3px; font-size: 13px; color: #1b1b1b;
	}
	.winx__crumb:hover { background: #eef5fd; }
	.winx__crumb-sep { color: #999; font-size: 12px; }

	.winx__search {
		display: flex; align-items: center; gap: 4px; width: 200px; height: 28px;
		padding: 0 8px; background: #fff; border: 1px solid var(--winx-border); border-radius: 4px;
	}
	.winx__search-icon { font-size: 11px; opacity: 0.6; }
	.winx__search input { flex: 1; border: none; outline: none; font: inherit; background: transparent; }

	/* Action bar */
	.winx__actionbar {
		display: flex; align-items: center; gap: 2px;
		padding: 4px 8px; background: #f3f3f3; border-bottom: 1px solid var(--winx-border);
	}
	.winx__action {
		display: inline-flex; align-items: center; gap: 6px;
		border: 1px solid transparent; background: transparent; border-radius: 4px;
		padding: 4px 10px; font: inherit; color: #1b1b1b; cursor: pointer;
	}
	.winx__action:hover:not(:disabled) { background: #eaf2fb; border-color: #cfe3f7; }
	.winx__action:disabled { color: #b0b0b0; cursor: default; }
	.winx__action--danger:hover:not(:disabled) { background: #fdeaea; border-color: #f3caca; }
	.winx__sep { width: 1px; height: 20px; background: var(--winx-border); margin: 0 6px; }

	/* Body */
	.winx__body { flex: 1; display: flex; min-height: 0; }
	.winx__nav {
		width: 250px; flex-shrink: 0; overflow: auto;
		background: #fbfbfb; border-right: 1px solid var(--winx-border); padding: 6px 4px;
		/* tighten the tree to Explorer density + Windows-blue selection */
		--stv-node-content-padding: 2px 6px;
		--stv-node-font-size: 13px;
		--stv-primary: var(--winx-accent);
		--stv-node-content-border-radius: 4px;
	}
	.winx__navrow { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
	.winx__navicon { font-size: 13px; }

	/* Right pane: header + the details <Tree> share ONE sticky-header scroll area,
	   so the column tracks line up regardless of the scrollbar. */
	.winx__contents { flex: 1; min-width: 0; overflow: auto; background: #fff; }

	/* Column header (sticky, same 4-track template as each row) */
	.winx__cols {
		position: sticky; top: 0; z-index: 2;
		display: grid; grid-template-columns: minmax(180px, 2fr) 1.2fr 1.2fr 0.8fr;
		border-bottom: 1px solid var(--winx-border); background: #fff;
	}
	.winx__col {
		text-align: left; border: none; background: transparent; cursor: pointer;
		padding: 6px 10px; font: inherit; font-weight: 500; color: #444;
		border-right: 1px solid #eee; white-space: nowrap; overflow: hidden;
	}
	.winx__col:hover { background: #f5f5f5; }
	.winx__col--size { text-align: right; }

	/* The right <Tree>: flatten the row chrome and turn each row's content into the
	   same 4-track grid as the header so columns align. */
	.winx-right {
		--stv-node-indent-per-level: 0; /* flat list — no indentation */
	}
	.winx-right :global(.stv__toggle-icon) { display: none; }       /* no chevrons in a flat list */
	.winx-right :global(.stv__node) { margin-left: 0 !important; }
	.winx-right :global(.stv__node-row) { display: block; }
	.winx-right :global(.stv__node-content) {
		display: grid;
		grid-template-columns: minmax(180px, 2fr) 1.2fr 1.2fr 0.8fr;
		align-items: center;
		width: 100%;
		padding: 0;
		border: 0;
		border-radius: 0;
	}
	.winx-right :global(.stv__node-content:hover) { background: #f2f7fd; }
	/* library highlight = our selection look (background-only so the grid never shifts) */
	.winx-right :global(.stv__node-content--highlighted) { background: #cfe5fb; box-shadow: inset 0 0 0 1px #a8cef0; }
	.winx-right :global(.stv__node-content--highlighted:hover) { background: #c3ddf8; }

	.winx__cell { padding: 3px 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #1b1b1b; min-width: 0; }
	.winx__cell--name { display: flex; align-items: center; gap: 8px; }
	.winx__cell--date, .winx__cell--type { color: #444; }
	.winx__cell--size { text-align: right; color: #444; }
	.winx__rowicon { font-size: 14px; }
	.winx__namebox { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
	.winx__rowname { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.winx__rowloc { font-size: 11px; color: #8a8a8a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.winx__empty { padding: 24px; text-align: center; color: #888; }

	/* Status bar */
	.winx__status {
		display: flex; align-items: center; gap: 16px; height: 26px;
		padding: 0 12px; background: #f3f3f3; border-top: 1px solid var(--winx-border);
		font-size: 12px; color: #444;
	}
	.winx__status-sel { color: #1b1b1b; }
	.winx__status-info { color: var(--winx-accent); margin-left: auto; }
</style>
