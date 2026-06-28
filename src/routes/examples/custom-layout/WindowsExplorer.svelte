<script lang="ts">
	// Windows File Explorer clone built on @keenmate/svelte-treeview.
	// The LEFT nav pane is a <Tree> (folders only); the RIGHT contents pane is a
	// custom sortable details list showing the selected folder's children (folders
	// + files). They stay in sync via the tree's expandNodes()/focusNode() API.
	import { tick, onMount } from 'svelte';
	import { Tree } from '$lib/index.js';
	import type { LTreeNode } from '$lib/ltree/types.js';
	import { explorerData, DEFAULT_PATH, type FsNode } from './explorer-data.js';

	const SEP = '.';

	// Mutable filesystem (New folder / Rename / Delete operate on this).
	let fs = $state<FsNode[]>(explorerData.map((n) => ({ ...n })));

	// The folder-only slice drives the nav tree.
	const folderData = $derived(fs.filter((n) => n.kind === 'folder'));

	let treeRef: Tree<FsNode>;
	let focusedFolder = $state<LTreeNode<FsNode> | null>(null);

	let currentPath = $state(DEFAULT_PATH); // C:\Windows
	let rightSelection = $state<Set<string>>(new Set());
	let lastClickedPath = $state<string | null>(null);
	let filter = $state('');
	let sortKey = $state<'name' | 'modified' | 'type' | 'size'>('name');
	let sortDir = $state<'asc' | 'desc'>('asc');

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
	const breadcrumb = $derived(
		[...ancestorPaths(currentPath), currentPath].map((p) => ({ path: p, name: byPath(p)?.name ?? p }))
	);
	const canBack = $derived(histIndex > 0);
	const canFwd = $derived(histIndex < history.length - 1);
	const canUp = $derived(currentPath !== '1' && !!parentOf(currentPath));
	const selectedCount = $derived(rightSelection.size);

	function sortBy(key: typeof sortKey) {
		if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else { sortKey = key; sortDir = 'asc'; }
	}

	// ── navigation ─────────────────────────────────────────────────────────────
	async function revealInTree(path: string) {
		for (const a of ancestorPaths(path)) await treeRef?.expandNodes(a);
		if (byPath(path)?.kind === 'folder') await treeRef?.expandNodes(path);
		treeRef?.focusNode(path);
	}
	function navigateTo(path: string, opts: { pushHistory?: boolean; syncTree?: boolean } = {}) {
		const { pushHistory = true, syncTree = true } = opts;
		if (!byPath(path)) return;
		closeMenu();
		statusInfo = null;
		currentPath = path;
		filter = ''; // opening/navigating clears the active search (Explorer behaviour)
		rightSelection = new Set();
		lastClickedPath = null;
		if (pushHistory) {
			history = [...history.slice(0, histIndex + 1), path];
			histIndex = history.length - 1;
		}
		if (syncTree) revealInTree(path);
	}
	const goBack = () => { if (canBack) { histIndex--; navigateTo(history[histIndex], { pushHistory: false }); } };
	const goForward = () => { if (canFwd) { histIndex++; navigateTo(history[histIndex], { pushHistory: false }); } };
	const goUp = () => { if (canUp) navigateTo(parentOf(currentPath)); };

	// ── right-pane interactions ──────────────────────────────────────────────
	let statusInfo = $state<string | null>(null); // transient status-bar message
	// `click` always precedes `dblclick`, so a lone single-click action must be
	// deferred (~220ms) and cancelled when a double-click lands. Selection itself
	// is safe to run immediately — it's the same whether or not a 2nd click comes.
	let clickTimer: ReturnType<typeof setTimeout> | null = null;
	const DBLCLICK_MS = 220;

	function applySelection(n: FsNode, e: MouseEvent) {
		if (e.ctrlKey || e.metaKey) {
			const next = new Set(rightSelection);
			next.has(n.path) ? next.delete(n.path) : next.add(n.path);
			rightSelection = next;
		} else if (e.shiftKey && lastClickedPath) {
			const paths = rightItems.map((i) => i.path);
			const a = paths.indexOf(lastClickedPath), b = paths.indexOf(n.path);
			if (a !== -1 && b !== -1) {
				const [lo, hi] = a < b ? [a, b] : [b, a];
				rightSelection = new Set(paths.slice(lo, hi + 1));
			}
		} else {
			rightSelection = new Set([n.path]);
		}
		lastClickedPath = n.path;
	}
	function rowClick(n: FsNode, e: MouseEvent) {
		applySelection(n, e); // immediate — never waits on the double-click window
		if (clickTimer) clearTimeout(clickTimer);
		// Single-click-only action: preview the item. Cancelled by rowOpen() below.
		clickTimer = setTimeout(() => {
			clickTimer = null;
			statusInfo = `${n.name} — ${typeLabel(n)}${n.size != null ? ' · ' + formatSize(n.size) : ''}`;
		}, DBLCLICK_MS);
	}
	function rowOpen(n: FsNode) {
		if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; } // beat the single-click action
		closeMenu();
		if (n.kind === 'folder') navigateTo(n.path);
		else statusInfo = `Opening “${n.name}”…`;
	}
	function rowKey(e: KeyboardEvent, n: FsNode) {
		if (e.key === 'Enter') { e.preventDefault(); rowOpen(n); }
		else if (e.key === ' ') { e.preventDefault(); rightSelection = new Set([n.path]); lastClickedPath = n.path; }
	}

	// ── context menu ───────────────────────────────────────────────────────────
	let menu = $state<{ x: number; y: number; target: FsNode | null } | null>(null);
	function openMenu(e: MouseEvent, target: FsNode | null) {
		e.preventDefault();
		e.stopPropagation(); // keep a row's menu from also firing the background menu
		// Right-clicking an unselected item selects just it first (Explorer behaviour).
		if (target && !rightSelection.has(target.path)) {
			rightSelection = new Set([target.path]);
			lastClickedPath = target.path;
		}
		let x = e.clientX, y = e.clientY;
		const W = 210, H = 300;
		if (typeof window !== 'undefined') {
			if (x + W > window.innerWidth) x = window.innerWidth - W - 6;
			if (y + H > window.innerHeight) y = window.innerHeight - H - 6;
		}
		menu = { x, y, target };
	}
	function closeMenu() { menu = null; }
	function selectAll() { rightSelection = new Set(rightItems.map((i) => i.path)); }

	// Full Windows-style path, e.g. C:\Windows\System32\drivers\etc\hosts.
	function fullPathOf(p: string): string {
		return [...ancestorPaths(p), p]
			.map((q) => byPath(q)?.name ?? q)
			.filter((name) => name !== 'This PC')
			.map((name) => (name.startsWith('Local Disk') ? 'C:' : name))
			.join('\\');
	}
	async function copyPath(node: FsNode | null) {
		if (!node) return;
		const text = fullPathOf(node.path);
		try { await navigator.clipboard?.writeText(text); } catch { /* clipboard may be blocked */ }
		statusInfo = `Path copied: ${text}`;
		closeMenu();
	}

	// ── mutations (toolbar) ────────────────────────────────────────────────────
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
		const expanded = treeRef?.getExpandedPaths() ?? [];
		mutate();
		await tick();
		treeRef?.setExpandedPaths(expanded);
		for (const a of ancestorPaths(currentPath)) await treeRef?.expandNodes(a);
		treeRef?.focusNode(currentPath);
	}
	function newFolder() {
		const path = nextChildPath(currentPath);
		const name = uniqueName('New folder', currentPath);
		withTreeState(() => {
			fs = [...fs, { id: nextId(), path, name, kind: 'folder', ext: '', modified: '28.06.2026 10:00', size: null }];
		});
		rightSelection = new Set([path]);
	}
	function deleteSelected() {
		if (rightSelection.size === 0) return;
		const doomed = new Set<string>();
		for (const p of rightSelection) {
			doomed.add(p);
			for (const n of fs) if (n.path.startsWith(p + SEP)) doomed.add(n.path);
		}
		withTreeState(() => { fs = fs.filter((n) => !doomed.has(n.path)); });
		rightSelection = new Set();
	}
	function renameSelected() {
		if (rightSelection.size !== 1) return;
		const p = [...rightSelection][0];
		const node = byPath(p);
		if (!node) return;
		const next = typeof prompt === 'function' ? prompt('Rename', node.name) : null;
		if (!next || next === node.name) return;
		withTreeState(() => {
			fs = fs.map((n) => (n.path === p ? { ...n, name: uniqueName(next, parentOf(p)) } : n));
		});
	}

	function sortByName(items: LTreeNode<FsNode>[]) {
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
		<button class="winx__action" disabled={selectedCount !== 1} onclick={renameSelected}>✎ Rename</button>
		<button class="winx__action winx__action--danger" disabled={selectedCount === 0} onclick={deleteSelected}>🗑 Delete</button>
	</div>

	<!-- Body: nav pane + contents pane -->
	<div class="winx__body">
		<div class="winx__nav">
			<Tree
				bind:this={treeRef}
				data={folderData}
				idMember="id"
				pathMember="path"
				sortCallback={sortByName}
				isSorted={true}
				expandLevel={2}
				clickBehavior="select"
				leafIconClass=""
				bind:focusedNode={focusedFolder}
				onNodeClick={(node) => navigateTo(node.path, { syncTree: false })}
				onNodeDoubleClick={(node) => navigateTo(node.path)}
			>
				{#snippet nodeTemplate(node: LTreeNode<FsNode>)}
					<span class="winx__navrow">
						<span class="winx__navicon">📁</span>{node.data?.name}
					</span>
				{/snippet}
			</Tree>
		</div>

		<div class="winx__contents">
			<!-- column header -->
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

			<!-- rows -->
			<div
				class="winx__rows"
				role="listbox"
				aria-label="Folder contents"
				tabindex="-1"
				oncontextmenu={(e) => openMenu(e, null)}
			>
				{#each rightItems as item (item.path)}
					<div
						class="winx__row"
						class:winx__row--selected={rightSelection.has(item.path)}
						role="option"
						aria-selected={rightSelection.has(item.path)}
						tabindex="-1"
						onclick={(e) => rowClick(item, e)}
						ondblclick={() => rowOpen(item)}
						oncontextmenu={(e) => openMenu(e, item)}
						onkeydown={(e) => rowKey(e, item)}
					>
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
					</div>
				{/each}
				{#if rightItems.length === 0}
					<div class="winx__empty">
						{filter ? `No items match "${filter}".` : 'This folder is empty.'}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Status bar -->
	<div class="winx__status">
		<span>{rightItems.length} item{rightItems.length === 1 ? '' : 's'}</span>
		{#if selectedCount > 0}<span class="winx__status-sel">{selectedCount} item{selectedCount === 1 ? '' : 's'} selected</span>{/if}
		{#if statusInfo}<span class="winx__status-info">{statusInfo}</span>{/if}
	</div>

	<!-- Right-click context menu -->
	{#if menu}
		<button
			type="button"
			class="winx__menu-backdrop"
			aria-label="Close menu"
			onclick={closeMenu}
			oncontextmenu={(e) => { e.preventDefault(); closeMenu(); }}
		></button>
		<div class="winx__menu" style="left: {menu.x}px; top: {menu.y}px;" role="menu">
			{#if menu.target}
				{@const t = menu.target}
				<button class="winx__menu-item" role="menuitem" onclick={() => { closeMenu(); rowOpen(t); }}>
					<span class="winx__menu-ico">{t.kind === 'folder' ? '📂' : '📄'}</span> Open
				</button>
				<div class="winx__menu-sep"></div>
				<button class="winx__menu-item" role="menuitem" onclick={() => copyPath(t)}>
					<span class="winx__menu-ico">📋</span> Copy path
				</button>
				<button class="winx__menu-item" role="menuitem" disabled={selectedCount !== 1} onclick={() => { closeMenu(); renameSelected(); }}>
					<span class="winx__menu-ico">✎</span> Rename
				</button>
				<button class="winx__menu-item winx__menu-item--danger" role="menuitem" onclick={() => { closeMenu(); deleteSelected(); }}>
					<span class="winx__menu-ico">🗑</span> Delete{selectedCount > 1 ? ` (${selectedCount})` : ''}
				</button>
				<div class="winx__menu-sep"></div>
			{/if}
			<button class="winx__menu-item" role="menuitem" onclick={() => { closeMenu(); newFolder(); }}>
				<span class="winx__menu-ico">🗀</span> New folder
			</button>
			<button class="winx__menu-item" role="menuitem" onclick={() => { closeMenu(); selectAll(); }}>
				<span class="winx__menu-ico">▦</span> Select all
			</button>
		</div>
	{/if}
</div>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') closeMenu(); }} />

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

	.winx__contents { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #fff; }

	/* Column header */
	.winx__cols {
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

	/* Rows */
	.winx__rows { flex: 1; overflow: auto; }
	.winx__row {
		display: grid; grid-template-columns: minmax(180px, 2fr) 1.2fr 1.2fr 0.8fr;
		align-items: center; cursor: default; border: 1px solid transparent;
	}
	.winx__row:hover { background: #f2f7fd; }
	.winx__row--selected { background: #cfe5fb; border-color: #a8cef0; }
	.winx__row--selected:hover { background: #c3ddf8; }
	.winx__cell { padding: 3px 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #1b1b1b; }
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

	/* Context menu */
	.winx__menu-backdrop {
		position: fixed; inset: 0; z-index: 40;
		border: none; background: transparent; padding: 0; margin: 0; cursor: default;
	}
	.winx__menu {
		position: fixed; z-index: 41; min-width: 200px;
		background: #fff; border: 1px solid #e2e2e2; border-radius: 8px;
		box-shadow: 0 10px 32px rgba(0, 0, 0, 0.20); padding: 5px;
	}
	.winx__menu-item {
		display: flex; align-items: center; gap: 10px; width: 100%;
		border: none; background: transparent; border-radius: 5px;
		padding: 7px 12px; font: inherit; font-size: 13px; color: #1b1b1b;
		text-align: left; cursor: pointer; white-space: nowrap;
	}
	.winx__menu-item:hover:not(:disabled) { background: #eaf2fb; }
	.winx__menu-item:disabled { color: #b3b3b3; cursor: default; }
	.winx__menu-item--danger:hover:not(:disabled) { background: #fdeaea; color: #b42318; }
	.winx__menu-ico { width: 16px; text-align: center; }
	.winx__menu-sep { height: 1px; background: #ececec; margin: 5px 6px; }
</style>
