<script lang="ts">
	import CanvasTree from '$lib/canvas/CanvasTree.svelte';
	import type { TreeController } from '$lib/core/TreeController.svelte.js';
	import type { LTreeNode } from '$lib/ltree/ltree-node.svelte.js';
	import type { ContextMenuItem } from '$lib/ltree/types.js';
	import type {
		CanvasRenderContext,
		MeasureNodeWidthCallback,
		GrowthDirection,
		LayoutMode,
		ClickBehavior,
		InitialViewport
	} from '$lib/canvas/types.js';
	import type { CanvasTheme } from '$lib/canvas/canvas-theme.js';

	// ── Types ──────────────────────────────────────────────────────────────

	interface Person {
		id: number;
		path: string;
		parentPath: string;
		level: number;
		name: string;
		title: string;
		department: string;
		email: string;
		avatar: string; // initials-based
		hasChildren: boolean;
		reports: number;
		location: string;
		status: 'active' | 'away' | 'busy' | 'offline';
	}

	// ── Color Palettes ────────────────────────────────────────────────────

	const DEPT_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
		'Executive':   { bg: '#1e1b4b', text: '#e0e7ff', accent: '#818cf8' },
		'Engineering': { bg: '#0c4a6e', text: '#e0f2fe', accent: '#38bdf8' },
		'Product':     { bg: '#134e4a', text: '#ccfbf1', accent: '#2dd4bf' },
		'Design':      { bg: '#581c87', text: '#f3e8ff', accent: '#c084fc' },
		'Marketing':   { bg: '#9a3412', text: '#ffedd5', accent: '#fb923c' },
		'Sales':       { bg: '#166534', text: '#dcfce7', accent: '#4ade80' },
		'Finance':     { bg: '#92400e', text: '#fef3c7', accent: '#fbbf24' },
		'HR':          { bg: '#9f1239', text: '#ffe4e6', accent: '#fb7185' },
		'Operations':  { bg: '#1e3a5f', text: '#dbeafe', accent: '#60a5fa' },
		'Legal':       { bg: '#3f3f46', text: '#f4f4f5', accent: '#a1a1aa' },
	};

	const STATUS_COLORS: Record<string, string> = {
		active:  '#22c55e',
		away:    '#f59e0b',
		busy:    '#ef4444',
		offline: '#94a3b8',
	};

	const AVATAR_COLORS = [
		'#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
		'#ec4899', '#f43f5e', '#ef4444', '#f97316',
		'#eab308', '#84cc16', '#22c55e', '#14b8a6',
		'#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
	];

	// ── Card Dimensions ───────────────────────────────────────────────────

	const CARD_W = 220;
	const CARD_H = 80;
	const CARD_H_COMPACT = 56;
	const CARD_R = 10;
	const AVATAR_R = 18;
	const AVATAR_R_COMPACT = 14;
	const PAD = 12;

	// ── Data ──────────────────────────────────────────────────────────────

	const TITLES: Record<string, string[]> = {
		Executive: ['CEO', 'COO', 'CTO', 'CFO', 'CMO'],
		Engineering: ['VP Engineering', 'Director Engineering', 'Staff Engineer', 'Senior Engineer', 'Engineer', 'Junior Engineer'],
		Product: ['VP Product', 'Director Product', 'Senior PM', 'Product Manager', 'Associate PM'],
		Design: ['Head of Design', 'Design Lead', 'Senior Designer', 'UX Designer', 'UI Designer'],
		Marketing: ['VP Marketing', 'Marketing Director', 'Marketing Manager', 'Content Lead', 'Social Media Mgr'],
		Sales: ['VP Sales', 'Sales Director', 'Account Executive', 'Sales Rep', 'SDR'],
		Finance: ['VP Finance', 'Controller', 'Senior Accountant', 'Financial Analyst', 'Accountant'],
		HR: ['VP People', 'HR Director', 'HR Manager', 'Recruiter', 'HR Coordinator'],
		Operations: ['VP Operations', 'Ops Director', 'Ops Manager', 'Systems Admin', 'Support Lead'],
		Legal: ['General Counsel', 'Senior Attorney', 'Legal Counsel', 'Paralegal', 'Legal Coordinator'],
	};

	const FIRST_NAMES = ['Alex', 'Jordan', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Avery', 'Quinn',
		'Drew', 'Blake', 'Charlie', 'Dakota', 'Emery', 'Finley', 'Harper', 'Jamie',
		'Kennedy', 'Logan', 'Nico', 'Parker', 'Reese', 'Sage', 'Skyler', 'Toby',
		'Val', 'Wren', 'Zara', 'Ash', 'Brook', 'Cameron', 'Devon', 'Ellis'];

	const LAST_NAMES = ['Chen', 'Patel', 'Garcia', 'Kim', 'Nguyen', 'Mueller', 'Santos', 'Wilson',
		'Anderson', 'Thompson', 'Rodriguez', 'Martinez', 'Williams', 'Brown', 'Jones', 'Davis',
		'Miller', 'Taylor', 'Moore', 'Jackson', 'Lee', 'Walker', 'Harris', 'Clark',
		'Robinson', 'Lewis', 'Young', 'King', 'Wright', 'Scott', 'Hill', 'Green'];

	const LOCATIONS = ['San Francisco', 'New York', 'London', 'Berlin', 'Tokyo', 'Singapore', 'Remote'];
	const STATUSES: Person['status'][] = ['active', 'active', 'active', 'active', 'active', 'away', 'busy', 'offline'];

	function generateOrgData(): Person[] {
		const nodes: Person[] = [];
		let id = 1;
		let firstIdx = 0;
		let lastIdx = 0;

		function nextName() {
			const first = FIRST_NAMES[firstIdx % FIRST_NAMES.length];
			const last = LAST_NAMES[lastIdx % LAST_NAMES.length];
			firstIdx += 7; // prime-ish step for variety
			lastIdx += 11;
			return { first, last, full: `${first} ${last}`, initials: `${first[0]}${last[0]}` };
		}

		// CEO
		const ceo = nextName();
		nodes.push({
			id: id++, path: '1', parentPath: '', level: 1,
			name: ceo.full, title: 'CEO', department: 'Executive',
			email: `${ceo.first.toLowerCase()}.${ceo.last.toLowerCase()}@acme.com`,
			avatar: ceo.initials, hasChildren: true, reports: 0,
			location: 'San Francisco', status: 'active'
		});

		const departments = Object.keys(TITLES).filter(d => d !== 'Executive');

		departments.forEach((dept, di) => {
			const deptPath = `1.${di + 1}`;
			const head = nextName();
			const titles = TITLES[dept];

			// Department head
			nodes.push({
				id: id++, path: deptPath, parentPath: '1', level: 2,
				name: head.full, title: titles[0], department: dept,
				email: `${head.first.toLowerCase()}.${head.last.toLowerCase()}@acme.com`,
				avatar: head.initials, hasChildren: true, reports: 0,
				location: LOCATIONS[di % LOCATIONS.length], status: STATUSES[di % STATUSES.length]
			});

			// Team leads (2-3 per department)
			const leadCount = 2 + (di % 2);
			for (let li = 0; li < leadCount; li++) {
				const leadPath = `${deptPath}.${li + 1}`;
				const lead = nextName();
				const memberCount = 2 + ((di + li) % 3);

				nodes.push({
					id: id++, path: leadPath, parentPath: deptPath, level: 3,
					name: lead.full, title: titles[1 + (li % (titles.length - 2))], department: dept,
					email: `${lead.first.toLowerCase()}.${lead.last.toLowerCase()}@acme.com`,
					avatar: lead.initials, hasChildren: true, reports: memberCount,
					location: LOCATIONS[(di + li + 2) % LOCATIONS.length],
					status: STATUSES[(di + li) % STATUSES.length]
				});

				// Team members
				for (let mi = 0; mi < memberCount; mi++) {
					const memberPath = `${leadPath}.${mi + 1}`;
					const member = nextName();
					const titleIdx = Math.min(2 + li + mi, titles.length - 1);

					nodes.push({
						id: id++, path: memberPath, parentPath: leadPath, level: 4,
						name: member.full, title: titles[titleIdx], department: dept,
						email: `${member.first.toLowerCase()}.${member.last.toLowerCase()}@acme.com`,
						avatar: member.initials, hasChildren: false, reports: 0,
						location: LOCATIONS[(di + li + mi) % LOCATIONS.length],
						status: STATUSES[(di + li + mi + 1) % STATUSES.length]
					});
				}
			}
		});

		// Fix reports counts
		for (const node of nodes) {
			if (node.hasChildren) {
				node.reports = nodes.filter(n => n.parentPath === node.path).length;
			}
		}

		return nodes;
	}

	// ── State ──────────────────────────────────────────────────────────────

	let orgData = $state.raw<Person[]>(generateOrgData());
	let layoutMode: LayoutMode = $state('tree');
	let growthDirection: GrowthDirection = $state('right');
	let initialViewport: InitialViewport = $state('root');
	let clickBehavior: ClickBehavior = $state('expand-and-focus');
	let groupSiblings = $state(true);
	let compactMode = $state(false);
	let selectedPath = $state<string | null>(null);
	let ctrlRef = $state<TreeController<Person> | null>(null);
	let canvasTreeRef: ReturnType<typeof CanvasTree> | undefined = $state();

	// Metrics
	let layoutTime = $state(0);
	let drawTime = $state(0);
	let visibleCount = $state(0);
	let totalCount = $state(0);

	// Theme
	type ThemeName = 'default' | 'futuristic';
	let activeTheme: ThemeName = $state('default');

	const futuristicTheme: Partial<CanvasTheme> = {
		bg: '#080c14',
		connColor: '#00e5ff40',
		connWidth: 1,
		gridColor: '#00e5ff18',
		gridSize: 24,
		minimapBg: 'rgba(8,12,20,0.95)',
		minimapBorder: '#00e5ff30',
		minimapViewport: '#00e5ff',
		ghostBg: '#0d1117',
		ghostBorder: '#00e5ff',
		ghostOpacity: 0.85,
		tooltipBg: '#0d1420',
		tooltipText: '#00e5ff',
		tooltipRadius: '2px',
		menuBg: '#0d1420',
		menuText: '#c0f0ff',
		menuHover: '#00e5ff18',
		menuRadius: '2px',
		dzBefore: '#00e5ff',
		dzAfter: '#ff2d55',
		dzChild: '#bf5af2',
		dzRadius: 2,
		nodeRadius: 2,
	};

	let themeOverrides = $derived<Partial<CanvasTheme> | undefined>(
		activeTheme === 'futuristic' ? futuristicTheme : undefined
	);

	let isFuturistic = $derived(activeTheme === 'futuristic');

	// Search
	let searchQuery = $state('');

	// ── Derived dimensions ────────────────────────────────────────────────

	let cardH = $derived(compactMode ? CARD_H_COMPACT : CARD_H);
	let avatarR = $derived(compactMode ? AVATAR_R_COMPACT : AVATAR_R);

	// ── Render Callbacks ──────────────────────────────────────────────────

	function getAvatarColor(name: string): string {
		let hash = 0;
		for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
		return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
	}

	const measureNodeWidth: MeasureNodeWidthCallback<Person> = (node) => {
		return CARD_W;
	};

	function renderNode(rctx: CanvasRenderContext<Person>) {
		const { ctx, node, bounds, state, lod, config, theme } = rctx;
		const { x, y, w, h } = bounds;
		const person = node.data;
		if (!person) return;

		const dept = DEPT_COLORS[person.department] || DEPT_COLORS['Operations'];
		const isV = config.growthDirection === 'up' || config.growthDirection === 'down';
		const isCompact = h <= CARD_H_COMPACT;
		const ar = isCompact ? AVATAR_R_COMPACT : AVATAR_R;
		const dark = theme.bg.startsWith('#0'); // detect dark theme
		const r = dark ? 2 : CARD_R;
		const monoFont = dark
			? '"SF Mono", "Cascadia Code", "Fira Code", monospace'
			: 'system-ui, -apple-system, sans-serif';

		// ── LOD: simple — tiny colored blocks ──
		if (lod === 'simple') {
			ctx.fillStyle = state.isSelected ? (dark ? '#00e5ff' : '#667eea') : dept.accent + '80';
			ctx.fillRect(x, y, w, h);
			return;
		}

		// ── LOD: medium — colored card, no text ──
		if (lod === 'medium') {
			ctx.beginPath();
			ctx.roundRect(x, y, w, h, r);
			ctx.fillStyle = state.isSelected ? dept.bg : (dark ? '#0d1420' : '#ffffff');
			ctx.fill();
			ctx.strokeStyle = dark ? dept.accent + '40' : dept.accent + '60';
			ctx.lineWidth = 1;
			ctx.stroke();
			// Avatar
			const acx = x + PAD + ar;
			const acy = y + h / 2;
			if (dark) {
				ctx.beginPath();
				ctx.roundRect(acx - ar, acy - ar, ar * 2, ar * 2, 2);
				ctx.fillStyle = getAvatarColor(person.name);
				ctx.fill();
			} else {
				ctx.beginPath();
				ctx.arc(acx, acy, ar, 0, Math.PI * 2);
				ctx.fillStyle = getAvatarColor(person.name);
				ctx.fill();
			}
			return;
		}

		// ── LOD: full detail — business card ──

		const isDimmed = state.isSearchDimmed;
		if (isDimmed) ctx.globalAlpha = dark ? 0.12 : 0.2;
		if (state.isDragSource) ctx.globalAlpha = 0.3;

		// Card background
		ctx.beginPath();
		ctx.roundRect(x, y, w, h, r);

		if (dark) {
			// Futuristic dark card
			if (state.isSelected) {
				ctx.fillStyle = '#0a1628';
				ctx.fill();
				ctx.strokeStyle = '#00e5ff';
				ctx.lineWidth = 1.5;
				ctx.stroke();
				ctx.shadowColor = '#00e5ff';
				ctx.shadowBlur = 16;
				ctx.fill();
				ctx.shadowColor = 'transparent';
				ctx.shadowBlur = 0;
			} else if (state.isDropTarget) {
				ctx.fillStyle = '#0d1a2a';
				ctx.fill();
				ctx.strokeStyle = '#00e5ff80';
				ctx.lineWidth = 1.5;
				ctx.stroke();
			} else if (state.isHovered) {
				ctx.fillStyle = '#0f1926';
				ctx.fill();
				ctx.strokeStyle = dept.accent + '60';
				ctx.lineWidth = 1;
				ctx.stroke();
				ctx.shadowColor = dept.accent + '30';
				ctx.shadowBlur = 12;
				ctx.fill();
				ctx.shadowColor = 'transparent';
				ctx.shadowBlur = 0;
			} else if (state.isSearchMatch) {
				ctx.fillStyle = '#1a1400';
				ctx.fill();
				ctx.strokeStyle = state.isCurrentSearchResult ? '#ffb800' : '#ffb80060';
				ctx.lineWidth = state.isCurrentSearchResult ? 2 : 1;
				ctx.stroke();
			} else {
				ctx.fillStyle = '#0d1420';
				ctx.fill();
				ctx.strokeStyle = '#1a2540';
				ctx.lineWidth = 1;
				ctx.stroke();
			}
		} else {
			// Default light card
			if (state.isSelected) {
				ctx.fillStyle = dept.bg;
				ctx.fill();
				ctx.strokeStyle = dept.accent;
				ctx.lineWidth = 2;
				ctx.stroke();
				ctx.shadowColor = dept.accent;
				ctx.shadowBlur = 12;
				ctx.fill();
				ctx.shadowColor = 'transparent';
				ctx.shadowBlur = 0;
			} else if (state.isDropTarget) {
				ctx.fillStyle = '#eff6ff';
				ctx.fill();
				ctx.strokeStyle = '#3b82f6';
				ctx.lineWidth = 2;
				ctx.stroke();
			} else if (state.isHovered) {
				ctx.fillStyle = '#ffffff';
				ctx.fill();
				ctx.strokeStyle = dept.accent + '80';
				ctx.lineWidth = 1.5;
				ctx.stroke();
				ctx.shadowColor = 'rgba(0,0,0,0.1)';
				ctx.shadowBlur = 10;
				ctx.shadowOffsetY = 3;
				ctx.fill();
				ctx.shadowColor = 'transparent';
				ctx.shadowBlur = 0;
				ctx.shadowOffsetY = 0;
			} else if (state.isSearchMatch) {
				ctx.fillStyle = state.isCurrentSearchResult ? '#fffbeb' : '#fefce8';
				ctx.fill();
				ctx.strokeStyle = state.isCurrentSearchResult ? '#d97706' : '#f59e0b';
				ctx.lineWidth = state.isCurrentSearchResult ? 2.5 : 2;
				ctx.stroke();
			} else {
				ctx.fillStyle = '#ffffff';
				ctx.fill();
				ctx.strokeStyle = '#e2e8f0';
				ctx.lineWidth = 1;
				ctx.stroke();
			}
		}

		const isSel = state.isSelected;

		// Clip to card shape so accent bar doesn't protrude beyond corners
		ctx.save();
		ctx.beginPath();
		ctx.roundRect(x, y, w, h, r);
		ctx.clip();

		// Department accent bar (left or top)
		ctx.fillStyle = dept.accent;
		if (isV) {
			ctx.fillRect(x, y, w, dark ? 2 : 3);
		} else {
			ctx.fillRect(x, y, dark ? 2 : 4, h);
		}

		// Futuristic: subtle scanline overlay
		if (dark) {
			ctx.fillStyle = 'rgba(0,229,255,0.015)';
			for (let sy = y; sy < y + h; sy += 3) {
				ctx.fillRect(x, sy, w, 1);
			}
		}

		// Avatar
		const avatarX = x + PAD + ar + (isV ? 0 : (dark ? 0 : 2));
		const avatarY = y + h / 2;
		const avatarColor = getAvatarColor(person.name);

		if (dark) {
			// Square avatar with clipped corners
			ctx.beginPath();
			ctx.roundRect(avatarX - ar, avatarY - ar, ar * 2, ar * 2, 2);
			ctx.fillStyle = avatarColor + '30';
			ctx.fill();
			ctx.strokeStyle = avatarColor + '80';
			ctx.lineWidth = 1;
			ctx.stroke();
		} else {
			ctx.beginPath();
			ctx.arc(avatarX, avatarY, ar, 0, Math.PI * 2);
			ctx.fillStyle = avatarColor;
			ctx.fill();
		}

		// Avatar initials
		ctx.fillStyle = dark ? avatarColor : '#ffffff';
		ctx.font = `bold ${isCompact ? 10 : 12}px ${monoFont}`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(person.avatar, avatarX, avatarY);

		// Status indicator
		const statusR = isCompact ? 4 : 5;
		const statusX = avatarX + ar * 0.7;
		const statusY = avatarY + ar * 0.7;
		if (dark) {
			// Square status dot
			const sd = statusR * 2;
			ctx.fillStyle = '#080c14';
			ctx.fillRect(statusX - sd / 2 - 1, statusY - sd / 2 - 1, sd + 2, sd + 2);
			ctx.fillStyle = STATUS_COLORS[person.status];
			ctx.fillRect(statusX - sd / 2, statusY - sd / 2, sd, sd);
		} else {
			ctx.beginPath();
			ctx.arc(statusX, statusY, statusR + 1.5, 0, Math.PI * 2);
			ctx.fillStyle = isSel ? dept.bg : '#ffffff';
			ctx.fill();
			ctx.beginPath();
			ctx.arc(statusX, statusY, statusR, 0, Math.PI * 2);
			ctx.fillStyle = STATUS_COLORS[person.status];
			ctx.fill();
		}

		// Text colors
		const nameColor = dark
			? (isSel ? '#00e5ff' : '#e0f0ff')
			: (isSel ? '#ffffff' : '#1e293b');
		const titleColor = dark
			? (isSel ? '#80f0ff' : '#6b8aaa')
			: (isSel ? dept.text : (isCompact ? '#64748b' : '#475569'));
		const metaColor = dark
			? (isSel ? dept.accent + 'cc' : '#3a5068')
			: (isSel ? dept.accent + 'cc' : '#94a3b8');

		// Text area
		const textX = avatarX + ar + 10;
		const maxTextW = w - (textX - x) - PAD;
		ctx.textAlign = 'left';

		if (isCompact) {
			ctx.font = `600 11px ${monoFont}`;
			ctx.fillStyle = nameColor;
			ctx.textBaseline = 'middle';
			drawTruncated(ctx, person.name, textX, y + h / 2 - 7, maxTextW);

			ctx.font = `10px ${monoFont}`;
			ctx.fillStyle = titleColor;
			drawTruncated(ctx, person.title, textX, y + h / 2 + 7, maxTextW);
		} else {
			ctx.font = `600 12px ${monoFont}`;
			ctx.fillStyle = nameColor;
			ctx.textBaseline = 'top';
			drawTruncated(ctx, dark ? person.name.toUpperCase() : person.name, textX, y + 12, maxTextW);

			ctx.font = `11px ${monoFont}`;
			ctx.fillStyle = titleColor;
			drawTruncated(ctx, person.title, textX, y + 28, maxTextW);

			ctx.font = `10px ${monoFont}`;
			ctx.fillStyle = metaColor;
			drawTruncated(ctx, `${person.department} · ${person.location}`, textX, y + 44, maxTextW);

			// Reports badge
			if (node.hasChildren && !node.isExpanded && person.reports > 0) {
				const badgeText = `${person.reports}`;
				const badgeW = 10 + badgeText.length * 6;
				const badgeH = 16;
				const badgeX = x + w - PAD - badgeW;
				const badgeY = y + h - 22;

				ctx.beginPath();
				ctx.roundRect(badgeX, badgeY, badgeW, badgeH, dark ? 2 : badgeH / 2);
				ctx.fillStyle = dark
					? (isSel ? '#00e5ff20' : dept.accent + '15')
					: (isSel ? dept.accent : dept.accent + '20');
				ctx.fill();
				if (dark) {
					ctx.strokeStyle = dept.accent + '40';
					ctx.lineWidth = 0.5;
					ctx.stroke();
				}

				ctx.font = `bold 9px ${monoFont}`;
				ctx.fillStyle = dark
					? (isSel ? '#00e5ff' : dept.accent + 'aa')
					: (isSel ? '#ffffff' : dept.accent);
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);
				ctx.textAlign = 'left';
			}
		}

		// Chevron (expand/collapse)
		if (node.hasChildren) {
			const chevX = x + w - 14;
			const chevY = y + 12;
			ctx.font = `11px ${monoFont}`;
			ctx.fillStyle = dark
				? (isSel ? '#00e5ff' : '#3a5068')
				: (isSel ? dept.accent : '#94a3b8');
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(node.isExpanded ? '\u25BE' : '\u25B8', chevX, chevY);
			ctx.textAlign = 'left';
		}

		ctx.restore(); // End card clipping
		ctx.globalAlpha = 1;
	}

	function drawTruncated(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number) {
		const measured = ctx.measureText(text).width;
		if (measured <= maxW) {
			ctx.fillText(text, x, y);
			return;
		}
		const ellipsis = '\u2026';
		const ellW = ctx.measureText(ellipsis).width;
		let lo = 0, hi = text.length;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (ctx.measureText(text.slice(0, mid)).width <= maxW - ellW) lo = mid;
			else hi = mid - 1;
		}
		ctx.fillText(text.slice(0, lo) + ellipsis, x, y);
	}

	// ── Sort ──────────────────────────────────────────────────────────────

	function sortCallback(items: LTreeNode<Person>[]) {
		return [...items].sort((a, b) => (a.data?.name || '').localeCompare(b.data?.name || ''));
	}

	// ── Context Menu ──────────────────────────────────────────────────────

	function getContextMenu(node: LTreeNode<Person>): ContextMenuItem[] {
		const person = node.data;
		if (!person) return [];

		const items: ContextMenuItem[] = [];

		items.push({
			icon: '\u{1F3AF}',
			title: 'Focus on person',
			callback: () => canvasTreeRef?.focusOnPath(node.path)
		});

		items.push({
			icon: '\u{1F4E7}',
			title: `Email ${person.name.split(' ')[0]}`,
			callback: () => {}
		});

		if (node.hasChildren) {
			items.push({ isDivider: true, title: '', callback: () => {} });
			items.push({
				icon: node.isExpanded ? '\u{1F4C1}' : '\u{1F4C2}',
				title: node.isExpanded ? 'Collapse team' : 'Expand team',
				callback: () => {
					if (node.isExpanded) canvasTreeRef?.collapseAll(node.path);
					else canvasTreeRef?.expandAll(node.path);
				}
			});
		}

		items.push({ isDivider: true, title: '', callback: () => {} });
		items.push({
			icon: '\u{1F4CB}',
			title: 'Copy email',
			callback: () => navigator.clipboard.writeText(person.email)
		});

		return items;
	}

	// ── Search ────────────────────────────────────────────────────────────

	let searchResults = $state<LTreeNode<Person>[]>([]);
	let currentResultIndex = $state(-1);

	function executeSearch() {
		if (!canvasTreeRef) return;
		const query = searchQuery.trim();
		if (!query) {
			canvasTreeRef.clearSearch();
			searchResults = [];
			currentResultIndex = -1;
			return;
		}
		searchResults = canvasTreeRef.searchNodes(query) as LTreeNode<Person>[];
		const sr = canvasTreeRef.getSearchResults();
		currentResultIndex = sr.currentIndex;
	}

	function onSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			if (e.shiftKey) { canvasTreeRef?.prevResult(); }
			else if (searchResults.length > 0) { canvasTreeRef?.nextResult(); }
			else { executeSearch(); }
			const sr = canvasTreeRef?.getSearchResults();
			if (sr) currentResultIndex = sr.currentIndex;
			e.preventDefault();
		} else if (e.key === 'Escape') {
			searchQuery = '';
			searchResults = [];
			currentResultIndex = -1;
			canvasTreeRef?.clearSearch();
			(e.target as HTMLInputElement)?.blur();
		}
	}
</script>

<svelte:head>
	<title>Org Chart - Svelte Treeview</title>
	<link rel="stylesheet" href="/examples-shared.css" />
</svelte:head>

<div class="container">
	<header>
		<a href="/custom-renderers" class="back-link">&larr; Back to Custom Renderers</a>
		<h1>Org Chart</h1>
		<p class="subtitle">
			A management org chart rendered with <code>&lt;CanvasTree&gt;</code> using custom
			<code>renderNode</code> callbacks to draw business-card-style nodes with avatars,
			titles, departments, and status indicators.
		</p>
	</header>

	<div class="card">
		<h2>Company Org Chart</h2>
		<p class="description">
			Each node is a custom-drawn business card with avatar, name, title, department, and online status.
			Pan by dragging. Zoom with scroll wheel. Click to expand teams. Right-click for options.
		</p>

		<div class="controls">
			<span class="orientation-toggle">
				<button class="btn orient-btn" class:orient-active={activeTheme === 'default'}
					onclick={() => activeTheme = 'default'}>
					Default
				</button>
				<button class="btn orient-btn futuristic-btn" class:orient-active={activeTheme === 'futuristic'}
					onclick={() => activeTheme = 'futuristic'}>
					Futuristic
				</button>
			</span>

			<span class="orientation-toggle">
				{#each /** @type {LayoutMode[]} */ (['tree', 'balanced', 'fishbone', 'radial', 'box']) as mode}
					<button class="btn orient-btn" class:orient-active={layoutMode === mode}
						onclick={() => layoutMode = mode}>{mode[0].toUpperCase() + mode.slice(1)}</button>
				{/each}
			</span>

			{#if layoutMode !== 'radial' && layoutMode !== 'box'}
				<span class="orientation-toggle">
					<button class="btn orient-btn" class:orient-active={growthDirection === 'right'}
						onclick={() => { growthDirection = 'right'; canvasTreeRef?.setGrowthDirection('right'); }}>Right</button>
					<button class="btn orient-btn" class:orient-active={growthDirection === 'left'}
						onclick={() => { growthDirection = 'left'; canvasTreeRef?.setGrowthDirection('left'); }}>Left</button>
					<button class="btn orient-btn" class:orient-active={growthDirection === 'down'}
						onclick={() => { growthDirection = 'down'; canvasTreeRef?.setGrowthDirection('down'); }}>Down</button>
					<button class="btn orient-btn" class:orient-active={growthDirection === 'up'}
						onclick={() => { growthDirection = 'up'; canvasTreeRef?.setGrowthDirection('up'); }}>Up</button>
				</span>
			{/if}

			<span class="orientation-toggle">
				<button class="btn orient-btn" class:orient-active={initialViewport === 'root'} onclick={() => initialViewport = 'root'}>Root</button>
				<button class="btn orient-btn" class:orient-active={initialViewport === 'origin'} onclick={() => initialViewport = 'origin'}>Origin</button>
			</span>

			<button class="btn" onclick={() => canvasTreeRef?.expandAll()}>Expand All</button>
			<button class="btn" onclick={() => canvasTreeRef?.collapseAll()}>Collapse All</button>
			<button class="btn secondary" onclick={() => canvasTreeRef?.zoomToFit()}>Zoom to Fit</button>

			<label class="group-toggle">
				<input type="checkbox" bind:checked={groupSiblings} />
				Group peers
			</label>

			<label class="group-toggle">
				<input type="checkbox" bind:checked={compactMode} />
				Compact
			</label>

			<label class="group-toggle">
				Click:
				<select class="click-select" bind:value={clickBehavior}>
					<option value="select">Select only</option>
					<option value="expand">Expand</option>
					<option value="expand-and-focus">Expand & Focus</option>
				</select>
			</label>
		</div>

		<div class="search-bar">
			<input
				type="text"
				class="search-input"
				placeholder="Search by name..."
				bind:value={searchQuery}
				onkeydown={onSearchKeydown}
				oninput={() => executeSearch()}
			/>
			{#if searchQuery.trim()}
				{#if searchResults.length > 0}
					<button class="btn search-nav-btn" onclick={() => { canvasTreeRef?.prevResult(); const sr = canvasTreeRef?.getSearchResults(); if (sr) currentResultIndex = sr.currentIndex; }} title="Previous">&blacktriangle;</button>
					<span class="search-count">{currentResultIndex + 1}/{searchResults.length}</span>
					<button class="btn search-nav-btn" onclick={() => { canvasTreeRef?.nextResult(); const sr = canvasTreeRef?.getSearchResults(); if (sr) currentResultIndex = sr.currentIndex; }} title="Next">&blacktriangledown;</button>
				{:else}
					<span class="search-count no-results">No results</span>
				{/if}
				<button class="btn search-nav-btn" onclick={() => { searchQuery = ''; searchResults = []; currentResultIndex = -1; canvasTreeRef?.clearSearch(); }} title="Clear">&times;</button>
			{/if}
		</div>

		<div class="metrics">
			<span>Layout: <strong>{layoutTime.toFixed(1)}ms</strong></span>
			<span>Draw: <strong>{drawTime.toFixed(1)}ms</strong></span>
			<span>Visible: <strong>{visibleCount}</strong>/{totalCount}</span>
		</div>

		<div class="canvas-container" class:canvas-dark={isFuturistic}>
			<CanvasTree
				bind:this={canvasTreeRef}
				data={orgData}
				idMember="id"
				pathMember="path"
				{sortCallback}
				isSorted={true}
				expandLevel={2}
				dragDropMode="self"
				getIsCollapsibleCallback={(node) => (node.level ?? 0) > 2}
				shouldUseInternalSearchIndex={true}
				searchValueMember="name"
				bind:selectedPath
				bind:controller={ctrlRef}
				bind:layoutTime
				bind:drawTime
				bind:visibleCount
				bind:totalCount
				{layoutMode}
				bind:growthDirection
				{initialViewport}
				bind:groupSiblings
				bind:clickBehavior
				nodeHeight={cardH}
				nodeMinWidth={CARD_W}
				nodePaddingX={PAD}
				nodeGap={10}
				columnGap={50}
				levelSpacingV={70}
				colorBarWidth={4}
				depthColors={isFuturistic
					? ['#00e5ff', '#00b8d4', '#00e676', '#bf5af2', '#ff2d55', '#ff9500', '#ffcc00', '#5ac8fa', '#64d2ff']
					: ['#818cf8', '#38bdf8', '#2dd4bf', '#c084fc', '#fb923c', '#4ade80', '#fbbf24', '#fb7185', '#60a5fa']}
				fontSize={12}
				gridNodeMaxW={CARD_W}
				gridGap={6}
				groupPadding={10}
				maxGridCols={4}
				showDotGrid={isFuturistic}
				theme={themeOverrides}
				{renderNode}
				{measureNodeWidth}
				getNodeLabel={(node) => node.data?.name || node.path}
				onNodeContextMenu={getContextMenu}
			/>
		</div>

		{#if selectedPath && ctrlRef}
			{@const selNode = ctrlRef.getNodeByPath(selectedPath)}
			{#if selNode?.data}
				{@const person = selNode.data}
				{@const dept = DEPT_COLORS[person.department] || DEPT_COLORS['Operations']}
				<div class="detail-card" class:detail-dark={isFuturistic}>
					<div class="detail-header" style="background: {isFuturistic ? '#0a1628' : dept.bg};">
						<div class="detail-avatar" style="background: {isFuturistic ? getAvatarColor(person.name) + '30' : getAvatarColor(person.name)}; {isFuturistic ? 'border-radius: 2px; border-color: ' + getAvatarColor(person.name) + '80;' : ''}">
							{person.avatar}
						</div>
						<div class="detail-info">
							<div class="detail-name">{person.name}</div>
							<div class="detail-title">{person.title}</div>
						</div>
						<div class="detail-status">
							<span class="status-dot" style="background: {STATUS_COLORS[person.status]};"></span>
							{person.status}
						</div>
					</div>
					<div class="detail-body">
						<div class="detail-row">
							<span class="detail-label">Department</span>
							<span class="detail-dept-tag" style="background: {dept.accent}20; color: {dept.accent};">{person.department}</span>
						</div>
						<div class="detail-row">
							<span class="detail-label">Email</span>
							<span class="detail-value">{person.email}</span>
						</div>
						<div class="detail-row">
							<span class="detail-label">Location</span>
							<span class="detail-value">{person.location}</span>
						</div>
						{#if person.reports > 0}
							<div class="detail-row">
								<span class="detail-label">Direct reports</span>
								<span class="detail-value">{person.reports}</span>
							</div>
						{/if}
						<div class="detail-row">
							<span class="detail-label">Path</span>
							<span class="detail-value mono">{person.path}</span>
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.metrics {
		display: flex;
		gap: 1rem;
		font-size: 0.85rem;
		color: #718096;
		margin-bottom: 1rem;
	}

	.metrics strong {
		color: #2d3748;
	}

	.canvas-container {
		width: 100%;
		height: 620px;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		overflow: hidden;
		position: relative;
		background: #f8fafc;
		transition: border-color 0.3s, background 0.3s;
	}

	.canvas-dark {
		border-color: #1a2540;
		background: #080c14;
	}

	.orientation-toggle {
		display: inline-flex;
		gap: 0;
	}

	.orient-btn {
		background: #e2e8f0;
		color: #4a5568;
		border-radius: 0;
		padding: 0.4rem 0.75rem;
		font-size: 0.8rem;
	}
	.orient-btn:first-child { border-radius: 6px 0 0 6px; }
	.orient-btn:last-child { border-radius: 0 6px 6px 0; }
	.orient-btn:hover { background: #cbd5e0; }
	.orient-active { background: #667eea !important; color: white !important; }
	.futuristic-btn.orient-active { background: #00e5ff !important; color: #080c14 !important; }

	.group-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		margin-left: 0.75rem;
		font-size: 0.85rem;
		color: #4a5568;
		cursor: pointer;
	}

	.click-select {
		padding: 0.3rem 0.4rem;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		font-size: 0.8rem;
		background: white;
	}

	.search-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.search-input {
		width: 220px;
		padding: 0.4rem 0.6rem;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		font-size: 0.85rem;
	}

	.search-input:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.15);
	}

	.search-nav-btn {
		padding: 0.2rem 0.5rem;
		font-size: 0.85rem;
		min-width: unset;
		line-height: 1;
	}

	.search-count {
		font-size: 0.8rem;
		font-family: 'SF Mono', 'Cascadia Code', monospace;
		color: #4a5568;
		white-space: nowrap;
	}

	.search-count.no-results { color: #e53e3e; }

	/* ── Detail Card ──────────────────────────────────────────────────── */

	.detail-card {
		margin-top: 1rem;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid #e2e8f0;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
	}

	.detail-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.25rem;
		color: white;
	}

	.detail-avatar {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 1.1rem;
		color: white;
		flex-shrink: 0;
		border: 2px solid rgba(255, 255, 255, 0.3);
	}

	.detail-info {
		flex: 1;
		min-width: 0;
	}

	.detail-name {
		font-weight: 700;
		font-size: 1.1rem;
		line-height: 1.3;
	}

	.detail-title {
		font-size: 0.85rem;
		opacity: 0.85;
	}

	.detail-status {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.8rem;
		opacity: 0.9;
		text-transform: capitalize;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		display: inline-block;
	}

	.detail-body {
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.detail-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.detail-label {
		font-size: 0.8rem;
		color: #94a3b8;
		width: 100px;
		flex-shrink: 0;
	}

	.detail-value {
		font-size: 0.85rem;
		color: #334155;
	}

	.detail-value.mono {
		font-family: 'SF Mono', 'Cascadia Code', monospace;
		font-size: 0.8rem;
	}

	.detail-dept-tag {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 10px;
	}

	/* ── Futuristic Detail Card ──────────────────────────────────────── */

	.detail-dark {
		border-color: #1a2540;
		background: #0d1420;
	}

	.detail-dark .detail-header {
		border-bottom: 1px solid #1a2540;
	}

	.detail-dark .detail-name {
		color: #00e5ff;
		font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.detail-dark .detail-title {
		color: #6b8aaa;
	}

	.detail-dark .detail-status {
		color: #6b8aaa;
	}

	.detail-dark .detail-body {
		background: #0d1420;
	}

	.detail-dark .detail-label {
		color: #3a5068;
		font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
		text-transform: uppercase;
		font-size: 0.7rem;
		letter-spacing: 0.05em;
	}

	.detail-dark .detail-value {
		color: #8ab4d0;
	}

	.detail-dark .detail-dept-tag {
		border-radius: 2px;
	}
</style>
