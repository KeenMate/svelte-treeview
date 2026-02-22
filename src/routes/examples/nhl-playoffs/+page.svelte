<script lang="ts">
	import { tick } from 'svelte';
	import CanvasTree from '$lib/canvas/CanvasTree.svelte';
	import type { TreeController } from '$lib/core/TreeController.svelte.js';
	import type { LTreeNode } from '$lib/ltree/ltree-node.svelte.js';
	import type {
		CanvasRenderContext,
		MeasureNodeWidthCallback,
		GrowthDirection
	} from '$lib/canvas/types.js';

	// ── Types ──────────────────────────────────────────────────────────────

	interface Team {
		name: string;
		abbrev: string;
		seed: number;
		wins: number;
		color: string;
	}

	interface TeamDef {
		name: string;
		abbrev: string;
		color: string;
	}

	interface PlayoffGame {
		id: number;
		path: string;
		parentPath: string;
		level: number;
		round: string;
		teamA: Team;
		teamB: Team;
		winner: 'A' | 'B' | null;
		seriesStatus: string;
		hasChildren: boolean;
	}

	// ── Seeded PRNG (Mulberry32) ─────────────────────────────────────────

	function mulberry32(seed: number) {
		return function (): number {
			seed |= 0;
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	// ── Round Config (7 levels) ──────────────────────────────────────────

	const ROUND_NAMES = [
		'Grand Final',
		'Semifinal',
		'Quarterfinal',
		'Round of 16',
		'Round of 32',
		'Round of 64',
		'Opening Round',
	];

	const ROUND_COLORS: Record<string, { bg: string; border: string; label: string }> = {
		'Grand Final':    { bg: '#fef3c7', border: '#fbbf24', label: '#92400e' },
		'Semifinal':      { bg: '#faf5ff', border: '#c4b5fd', label: '#5b21b6' },
		'Quarterfinal':   { bg: '#eef2ff', border: '#a5b4fc', label: '#3730a3' },
		'Round of 16':    { bg: '#eff6ff', border: '#93c5fd', label: '#1e40af' },
		'Round of 32':    { bg: '#f0fdfa', border: '#5eead4', label: '#115e59' },
		'Round of 64':    { bg: '#ecfdf5', border: '#6ee7b7', label: '#065f46' },
		'Opening Round':  { bg: '#f0fdf4', border: '#86efac', label: '#166534' },
	};

	// ── Card Dimensions ──────────────────────────────────────────────────

	const CARD_W = 220;
	const CARD_H = 78;
	const CARD_R = 8;
	const PAD = 10;
	const TEAM_ROW_H = 23;

	// ── Team Pool (128 teams) ────────────────────────────────────────────

	// CSV: name,abbrev,color
	const TEAM_CSV = [
		// NHL (32)
		'Florida Panthers,FLA,#C8102E',
		'Edmonton Oilers,EDM,#041E42',
		'Dallas Stars,DAL,#006847',
		'NY Rangers,NYR,#0038A8',
		'Boston Bruins,BOS,#FFB81C',
		'Colorado Avalanche,COL,#6F263D',
		'Vancouver Canucks,VAN,#00205B',
		'Carolina Hurricanes,CAR,#CC0000',
		'Toronto Maple Leafs,TOR,#00205B',
		'Tampa Bay Lightning,TBL,#002868',
		'Nashville Predators,NSH,#FFB81C',
		'Los Angeles Kings,LAK,#111111',
		'NY Islanders,NYI,#00539B',
		'Philadelphia Flyers,PHI,#F74902',
		'Vegas Golden Knights,VGK,#B4975A',
		'Winnipeg Jets,WPG,#041E42',
		'Washington Capitals,WSH,#C8102E',
		'Pittsburgh Penguins,PIT,#FCB514',
		'New Jersey Devils,NJD,#CE1126',
		'Detroit Red Wings,DET,#CE1126',
		'Ottawa Senators,OTT,#C52032',
		'Montreal Canadiens,MTL,#AF1E2D',
		'Buffalo Sabres,BUF,#003087',
		'Columbus Blue Jackets,CBJ,#002654',
		'Minnesota Wild,MIN,#154734',
		'St. Louis Blues,STL,#002F87',
		'Seattle Kraken,SEA,#99D9D9',
		'Utah Hockey Club,UTA,#69B3E7',
		'Calgary Flames,CGY,#D2001C',
		'San Jose Sharks,SJS,#006D75',
		'Anaheim Ducks,ANA,#F47A38',
		'Chicago Blackhawks,CHI,#CF0A2C',
		// AHL (32)
		'Hershey Bears,HER,#6F263D',
		'Providence Bruins,PRV,#FFB81C',
		'Springfield Thunderbirds,SPR,#236192',
		'Charlotte Checkers,CHA,#000000',
		'Rochester Americans,ROC,#003087',
		'Syracuse Crunch,SYR,#002868',
		'Lehigh Valley Phantoms,LVP,#F74902',
		'Bridgeport Islanders,BRI,#00539B',
		'Utica Comets,UTI,#006847',
		'Grand Rapids Griffins,GRR,#CE1126',
		'Rockford IceHogs,RFD,#CF0A2C',
		'Milwaukee Admirals,MIL,#041E42',
		'Iowa Wild,IOW,#154734',
		'Manitoba Moose,MAN,#041E42',
		'Texas Stars,TEX,#006847',
		'Tucson Roadrunners,TUC,#69B3E7',
		'Henderson Silver Knights,HSK,#B4975A',
		'Abbotsford Canucks,ABC,#00205B',
		'Bakersfield Condors,BAK,#041E42',
		'Ontario Reign,ONT,#111111',
		'San Diego Gulls,SDG,#F47A38',
		'Coachella Valley Firebirds,CVF,#99D9D9',
		'Belleville Senators,BEL,#C52032',
		'Laval Rocket,LAR,#AF1E2D',
		'Calgary Wranglers,CWR,#D2001C',
		'Cleveland Monsters,CLE,#002654',
		'Hartford Wolf Pack,HWP,#0038A8',
		'Wilkes-Barre Penguins,WBP,#FCB514',
		'Norfolk Admirals,NOR,#002868',
		'Binghamton Devils,BNG,#CE1126',
		'Chicago Wolves,CHW,#6F263D',
		'San Jose Barracuda,SJB,#006D75',
		// International / Historical (64)
		'Quebec Nordiques,QUE,#1C4C8C',
		'Hartford Whalers,HFD,#00843D',
		'Atlanta Thrashers,ATL,#002654',
		'Minnesota North Stars,MNS,#006847',
		'Jokerit Helsinki,JOK,#CC0000',
		'SKA St. Petersburg,SKA,#003DA5',
		'CSKA Moscow,CSK,#C8102E',
		'Metallurg Magnitogorsk,MMG,#003087',
		'Dynamo Moscow,DYN,#0065BD',
		'Ak Bars Kazan,AKB,#006847',
		'Avangard Omsk,AVG,#CF0A2C',
		'Salavat Yulaev Ufa,SYU,#154734',
		'Frölunda HC,FRO,#C8102E',
		'Växjö Lakers,VXJ,#003087',
		'Skellefteå AIK,SKE,#FFB81C',
		'Luleå Hockey,LUL,#CF0A2C',
		'Brynäs IF,BRY,#C8102E',
		'HV71 Jönköping,HV7,#003087',
		'Rögle BK,ROG,#000000',
		'Färjestad BK,FAR,#FFB81C',
		'ZSC Lions Zürich,ZSC,#0065BD',
		'SC Bern,SCB,#FFB81C',
		'HC Davos,HCD,#003087',
		'EV Zug,EVZ,#003DA5',
		'HC Lugano,HCL,#000000',
		'Genève-Servette HC,GES,#CF0A2C',
		'EHC Biel,BIE,#C8102E',
		'HC Fribourg-Gottéron,FRI,#C8102E',
		'Tampere Tappara,TAP,#003087',
		'TPS Turku,TPS,#F47A38',
		'Helsinki HIFK,HIK,#CC0000',
		'Lukko Rauma,LUK,#FFB81C',
		'Kärpät Oulu,KAR,#FFB81C',
		'Ilves Tampere,ILV,#154734',
		'JYP Jyväskylä,JYP,#003087',
		'KalPa Kuopio,KAL,#F47A38',
		'London Knights,LON,#154734',
		'Oshawa Generals,OSH,#CC0000',
		'Kingston Frontenacs,KNG,#FFB81C',
		'Barrie Colts,BAR,#003087',
		'Saginaw Spirit,SAG,#003DA5',
		'Erie Otters,ERI,#003087',
		'Kitchener Rangers,KIT,#003087',
		'Guelph Storm,GUE,#CF0A2C',
		'Windsor Spitfires,WND,#C8102E',
		'Sarnia Sting,SAR,#FFB81C',
		'Sudbury Wolves,SUD,#003087',
		'North Bay Battalion,NBO,#CF0A2C',
		'Owen Sound Attack,OWS,#000000',
		'Niagara IceDogs,NIA,#C8102E',
		'Mississauga Steelheads,MIS,#003DA5',
		'Peterborough Petes,PET,#C8102E',
		'Kelowna Rockets,KEL,#154734',
		'Kamloops Blazers,KAM,#F47A38',
		'Spokane Chiefs,SPK,#CE1126',
		'Portland Winterhawks,PWH,#CC0000',
		'Seattle Thunderbirds,SET,#002868',
		'Vancouver Giants,VGI,#000000',
		'Victoria Royals,VIC,#003DA5',
		'Prince George Cougars,PGC,#003087',
		'Red Deer Rebels,RDR,#CE1126',
		'Medicine Hat Tigers,MHT,#F47A38',
		'Lethbridge Hurricanes,LET,#CF0A2C',
		'Calgary Hitmen,HIT,#D2001C',
		'Edmonton Oil Kings,EOK,#041E42',
	];

	const ALL_TEAMS: TeamDef[] = TEAM_CSV.map(s => {
		const [name, abbrev, color] = s.split(',');
		return { name, abbrev, color };
	});

	// ── Bracket Seeding ──────────────────────────────────────────────────

	/** Standard bracket seed order: 1v128, 64v65 in same half, etc. */
	function bracketSeedOrder(n: number): number[] {
		if (n === 2) return [0, 1];
		const half = bracketSeedOrder(n / 2);
		const result: number[] = [];
		for (const s of half) {
			result.push(s, n - 1 - s);
		}
		return result;
	}

	// ── Bracket Generation ───────────────────────────────────────────────

	function generatePlayoffData(): PlayoffGame[] {
		const rng = mulberry32(2024);
		const games: PlayoffGame[] = [];
		let nextId = 1;

		function buildGame(
			path: string,
			parentPath: string,
			level: number,
			teamIndices: number[]
		): { team: TeamDef; seed: number } {
			if (teamIndices.length === 2) {
				// Leaf: Opening Round game
				const [ai, bi] = teamIndices;
				const a = ALL_TEAMS[ai];
				const b = ALL_TEAMS[bi];
				const seedA = ai + 1;
				const seedB = bi + 1;
				// Higher seed (lower number) favored 65%
				const aFavored = rng() < 0.65;
				const winner: 'A' | 'B' = aFavored ? 'A' : 'B';
				const wWins = 4;
				const lWins = Math.floor(rng() * 4);
				const winTeam = winner === 'A' ? a : b;
				games.push({
					id: nextId++, path, parentPath, level,
					round: ROUND_NAMES[level - 1] || `Round ${level}`,
					teamA: { name: a.name, abbrev: a.abbrev, seed: seedA, wins: winner === 'A' ? wWins : lWins, color: a.color },
					teamB: { name: b.name, abbrev: b.abbrev, seed: seedB, wins: winner === 'B' ? wWins : lWins, color: b.color },
					winner,
					seriesStatus: `${winTeam.abbrev} wins 4-${lWins}`,
					hasChildren: false
				});
				return { team: winTeam, seed: winner === 'A' ? seedA : seedB };
			}

			// Split and recurse
			const mid = teamIndices.length / 2;
			const leftResult = buildGame(`${path}.1`, path, level + 1, teamIndices.slice(0, mid));
			const rightResult = buildGame(`${path}.2`, path, level + 1, teamIndices.slice(mid));

			const a = leftResult.team;
			const b = rightResult.team;
			const seedA = leftResult.seed;
			const seedB = rightResult.seed;

			// Better seed favored 60%
			const aIsBetterSeed = seedA < seedB;
			const favoredWins = rng() < 0.6;
			const winner: 'A' | 'B' = (aIsBetterSeed === favoredWins) ? 'A' : 'B';
			const wWins = 4;
			const lWins = Math.floor(rng() * 4);
			const winTeam = winner === 'A' ? a : b;

			games.push({
				id: nextId++, path, parentPath, level,
				round: ROUND_NAMES[level - 1] || `Round ${level}`,
				teamA: { name: a.name, abbrev: a.abbrev, seed: seedA, wins: winner === 'A' ? wWins : lWins, color: a.color },
				teamB: { name: b.name, abbrev: b.abbrev, seed: seedB, wins: winner === 'B' ? wWins : lWins, color: b.color },
				winner,
				seriesStatus: `${winTeam.abbrev} wins 4-${lWins}`,
				hasChildren: true
			});

			return { team: winTeam, seed: winner === 'A' ? seedA : seedB };
		}

		const indices = bracketSeedOrder(128);
		buildGame('1', '', 1, indices);
		// Sort parents before children so the tree expands them correctly
		return games.sort((a, b) => a.level - b.level);
	}

	// ── State ──────────────────────────────────────────────────────────────

	let playoffData = $state.raw<PlayoffGame[]>(generatePlayoffData());
	let growthDirection: GrowthDirection = $state('left');
	let initialViewport: 'root' | 'origin' = $state('root');
	let selectedPath = $state<string | null>(null);
	let ctrlRef = $state<TreeController<PlayoffGame> | null>(null);
	let canvasTreeRef: ReturnType<typeof CanvasTree> | undefined = $state();

	// Metrics
	let layoutTime = $state(0);
	let drawTime = $state(0);
	let visibleCount = $state(0);
	let totalCount = $state(0);

	// ── Zoom to fit on initial load ──────────────────────────────────────

	// Auto zoom-to-fit disabled to test initialViewport behavior
	// let initialFitDone = false;
	// $effect(() => {
	// 	if (canvasTreeRef && totalCount > 1 && !initialFitDone) {
	// 		initialFitDone = true;
	// 		tick().then(() => canvasTreeRef?.zoomToFit());
	// 	}
	// });

	// ── Render Callbacks ──────────────────────────────────────────────────

	const measureNodeWidth: MeasureNodeWidthCallback<PlayoffGame> = () => CARD_W;

	function drawTruncated(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number) {
		if (ctx.measureText(text).width <= maxW) {
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

	function renderNode(rctx: CanvasRenderContext<PlayoffGame>) {
		const { ctx, node, bounds, state, lod } = rctx;
		const { x, y, w, h } = bounds;
		const game = node.data;
		if (!game) return;

		const rc = ROUND_COLORS[game.round] || ROUND_COLORS['Opening Round'];

		// ── LOD: simple — colored block ──
		if (lod === 'simple') {
			ctx.fillStyle = state.isSelected ? '#667eea' : rc.border;
			ctx.fillRect(x, y, w, h);
			return;
		}

		// ── LOD: medium — colored card, no text ──
		if (lod === 'medium') {
			ctx.beginPath();
			ctx.roundRect(x, y, w, h, CARD_R);
			ctx.fillStyle = state.isSelected ? '#eef2ff' : '#ffffff';
			ctx.fill();
			ctx.strokeStyle = state.isSelected ? '#667eea' : rc.border;
			ctx.lineWidth = state.isSelected ? 2 : 1;
			ctx.stroke();
			// Team color bars
			ctx.fillStyle = game.teamA.color;
			ctx.fillRect(x + PAD, y + PAD, 4, TEAM_ROW_H - 4);
			ctx.fillStyle = game.teamB.color;
			ctx.fillRect(x + PAD, y + PAD + TEAM_ROW_H, 4, TEAM_ROW_H - 4);
			return;
		}

		// ── LOD: full detail ──

		if (state.isDragSource) ctx.globalAlpha = 0.3;

		// Card background
		ctx.beginPath();
		ctx.roundRect(x, y, w, h, CARD_R);

		if (state.isSelected) {
			ctx.fillStyle = '#f5f3ff';
			ctx.fill();
			ctx.strokeStyle = '#667eea';
			ctx.lineWidth = 2;
			ctx.stroke();
		} else if (state.isHovered) {
			ctx.fillStyle = '#ffffff';
			ctx.fill();
			ctx.strokeStyle = rc.border;
			ctx.lineWidth = 1.5;
			ctx.stroke();
			ctx.shadowColor = 'rgba(0,0,0,0.08)';
			ctx.shadowBlur = 8;
			ctx.fill();
			ctx.shadowColor = 'transparent';
			ctx.shadowBlur = 0;
		} else {
			ctx.fillStyle = '#ffffff';
			ctx.fill();
			ctx.strokeStyle = '#e2e8f0';
			ctx.lineWidth = 1;
			ctx.stroke();
		}

		ctx.save();
		ctx.beginPath();
		ctx.roundRect(x, y, w, h, CARD_R);
		ctx.clip();

		// Round label bar at top
		ctx.fillStyle = rc.bg;
		ctx.fillRect(x, y, w, 18);
		ctx.fillStyle = rc.border;
		ctx.fillRect(x, y + 17, w, 1);

		const font = 'system-ui, -apple-system, sans-serif';

		ctx.font = `600 8px ${font}`;
		ctx.fillStyle = rc.label;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(game.round.toUpperCase(), x + w / 2, y + 9);

		// Team rows
		const rowTop = y + 20;
		const textMaxW = w - PAD * 2 - 50;

		for (let i = 0; i < 2; i++) {
			const t = i === 0 ? game.teamA : game.teamB;
			const isWinner = (i === 0 && game.winner === 'A') || (i === 1 && game.winner === 'B');
			const ry = rowTop + i * TEAM_ROW_H;

			// Winner highlight
			if (isWinner && game.winner) {
				ctx.fillStyle = '#f0fdf4';
				ctx.fillRect(x, ry, w, TEAM_ROW_H);
			}

			// Team color bar
			ctx.fillStyle = t.color;
			ctx.fillRect(x + 1, ry + 3, 3, TEAM_ROW_H - 6);

			// Seed
			ctx.font = `9px ${font}`;
			ctx.fillStyle = '#94a3b8';
			ctx.textAlign = 'left';
			ctx.textBaseline = 'middle';
			const seedText = `${t.seed}`;
			ctx.fillText(seedText, x + PAD, ry + TEAM_ROW_H / 2);
			const seedW = ctx.measureText(seedText).width;

			// Team name
			ctx.font = isWinner ? `600 11px ${font}` : `11px ${font}`;
			ctx.fillStyle = isWinner ? '#166534' : '#334155';
			drawTruncated(ctx, t.name, x + PAD + seedW + 4, ry + TEAM_ROW_H / 2, textMaxW - seedW);

			// Win count
			ctx.font = `bold 12px ${font}`;
			ctx.fillStyle = isWinner ? '#166534' : '#94a3b8';
			ctx.textAlign = 'right';
			ctx.fillText(`${t.wins}`, x + w - PAD, ry + TEAM_ROW_H / 2);
		}

		// Divider between teams
		ctx.fillStyle = '#e2e8f0';
		ctx.fillRect(x + PAD, rowTop + TEAM_ROW_H - 0.5, w - PAD * 2, 1);

		// Series status at bottom
		const bottomY = rowTop + TEAM_ROW_H * 2 + 4;
		if (bottomY < y + h - 2) {
			ctx.font = `8px ${font}`;
			ctx.fillStyle = '#94a3b8';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(game.seriesStatus, x + w / 2, bottomY);
		}

		ctx.restore();
		ctx.globalAlpha = 1;
	}

	// ── Sort ──────────────────────────────────────────────────────────────

	function sortCallback(items: LTreeNode<PlayoffGame>[]) {
		return [...items].sort((a, b) => (a.data?.id || 0) - (b.data?.id || 0));
	}
</script>

<svelte:head>
	<title>NHL Playoff Bracket - Svelte Treeview</title>
	<link rel="stylesheet" href="/examples-shared.css" />
</svelte:head>

<div class="container">
	<header>
		<a href="/custom-renderers" class="back-link">&larr; Back to Custom Renderers</a>
		<h1>NHL Playoff Bracket</h1>
		<p class="subtitle">
			A 128-team tournament bracket rendered with <code>&lt;CanvasTree&gt;</code> using a
			custom <code>renderNode</code> callback. 7 rounds, 127 matchup nodes with team colors,
			seeds, and series scores.
		</p>
	</header>

	<div class="card">
		<h2>128-Team Hockey Championship</h2>
		<p class="description">
			NHL, AHL, and international teams compete in a 7-round single-elimination bracket.
			Pan by dragging. Zoom with scroll wheel. Click nodes to expand/collapse rounds.
		</p>

		<div class="controls">
			<span class="orientation-toggle">
				<button class="btn orient-btn" class:orient-active={growthDirection === 'left'}
					onclick={() => { growthDirection = 'left'; console.log('direction → left, initialViewport:', initialViewport); canvasTreeRef?.setGrowthDirection('left'); }}>Left</button>
				<button class="btn orient-btn" class:orient-active={growthDirection === 'right'}
					onclick={() => { growthDirection = 'right'; console.log('direction → right, initialViewport:', initialViewport); canvasTreeRef?.setGrowthDirection('right'); }}>Right</button>
				<button class="btn orient-btn" class:orient-active={growthDirection === 'down'}
					onclick={() => { growthDirection = 'down'; console.log('direction → down, initialViewport:', initialViewport); canvasTreeRef?.setGrowthDirection('down'); }}>Down</button>
				<button class="btn orient-btn" class:orient-active={growthDirection === 'up'}
					onclick={() => { growthDirection = 'up'; console.log('direction → up, initialViewport:', initialViewport); canvasTreeRef?.setGrowthDirection('up'); }}>Up</button>
			</span>

			<span class="orientation-toggle">
				<button class="btn orient-btn" class:orient-active={initialViewport === 'root'}
					onclick={() => { initialViewport = 'root'; console.log('initialViewport → root, growthDirection:', growthDirection); canvasTreeRef?.setGrowthDirection(growthDirection); }}>Root</button>
				<button class="btn orient-btn" class:orient-active={initialViewport === 'origin'}
					onclick={() => { initialViewport = 'origin'; console.log('initialViewport → origin, growthDirection:', growthDirection); canvasTreeRef?.setGrowthDirection(growthDirection); }}>Origin</button>
			</span>

			<button class="btn" onclick={() => canvasTreeRef?.focusOnPath('1')}>Focus Final</button>
			<button class="btn" onclick={() => canvasTreeRef?.expandAll()}>Expand All</button>
			<button class="btn" onclick={() => canvasTreeRef?.collapseAll()}>Collapse All</button>
			<button class="btn secondary" onclick={() => canvasTreeRef?.zoomToFit()}>Zoom to Fit</button>
		</div>

		<div class="metrics">
			<span>Layout: <strong>{layoutTime.toFixed(1)}ms</strong></span>
			<span>Draw: <strong>{drawTime.toFixed(1)}ms</strong></span>
			<span>Visible: <strong>{visibleCount}</strong>/{totalCount}</span>
		</div>

		<div class="canvas-container">
			<CanvasTree
				bind:this={canvasTreeRef}
				data={playoffData}
				idMember="id"
				pathMember="path"
				{sortCallback}
				isSorted={true}
				expandLevel={99}
				bind:selectedPath
				bind:controller={ctrlRef}
				bind:layoutTime
				bind:drawTime
				bind:visibleCount
				bind:totalCount
				bind:growthDirection
				{initialViewport}
				groupSiblings={false}
				clickBehavior="expand-and-focus"
				nodeHeight={CARD_H}
				nodeMinWidth={CARD_W}
				nodePaddingX={PAD}
				nodeGap={12}
				columnGap={70}
				levelSpacingV={70}
				colorBarWidth={4}
				fontSize={11}
				{renderNode}
				{measureNodeWidth}
				getNodeLabel={(node) => node.data ? `${node.data.teamA.abbrev} vs ${node.data.teamB.abbrev}` : node.path}
			/>
		</div>

		{#if selectedPath && ctrlRef}
			{@const selNode = ctrlRef.getNodeByPath(selectedPath)}
			{#if selNode?.data}
				{@const game = selNode.data}
				{@const rc = ROUND_COLORS[game.round] || ROUND_COLORS['Opening Round']}
				<div class="detail-card">
					<div class="detail-header" style="background: {rc.bg}; border-color: {rc.border};">
						<span class="detail-round" style="color: {rc.label};">{game.round}</span>
						<span class="detail-status">{game.seriesStatus}</span>
					</div>
					<div class="detail-body">
						<div class="detail-team" class:detail-winner={game.winner === 'A'}>
							<span class="team-color-dot" style="background: {game.teamA.color};"></span>
							<span class="team-seed">({game.teamA.seed})</span>
							<span class="team-name">{game.teamA.name}</span>
							<span class="team-wins">{game.teamA.wins}</span>
						</div>
						<div class="detail-team" class:detail-winner={game.winner === 'B'}>
							<span class="team-color-dot" style="background: {game.teamB.color};"></span>
							<span class="team-seed">({game.teamB.seed})</span>
							<span class="team-name">{game.teamB.name}</span>
							<span class="team-wins">{game.teamB.wins}</span>
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
		height: 700px;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		overflow: hidden;
		position: relative;
		background: #fafbfc;
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

	/* ── Detail Card ──────────────────────────────────────────────────── */

	.detail-card {
		margin-top: 1rem;
		border-radius: 10px;
		overflow: hidden;
		border: 1px solid #e2e8f0;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
	}

	.detail-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1.25rem;
		border-bottom: 2px solid;
	}

	.detail-round {
		font-weight: 700;
		font-size: 0.9rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.detail-status {
		font-size: 0.85rem;
		color: #64748b;
	}

	.detail-body {
		padding: 0.75rem 1.25rem;
	}

	.detail-team {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid #f1f5f9;
	}

	.detail-team:last-child {
		border-bottom: none;
	}

	.detail-winner {
		font-weight: 600;
	}

	.detail-winner .team-name {
		color: #166534;
	}

	.detail-winner .team-wins {
		color: #166534;
		font-weight: 700;
	}

	.team-color-dot {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.team-seed {
		font-size: 0.8rem;
		color: #94a3b8;
		min-width: 28px;
	}

	.team-name {
		flex: 1;
		font-size: 0.95rem;
		color: #334155;
	}

	.team-wins {
		font-size: 1.1rem;
		font-weight: 600;
		color: #64748b;
		min-width: 20px;
		text-align: right;
	}
</style>
