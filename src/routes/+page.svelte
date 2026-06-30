<script>
	import { onMount } from 'svelte';
	import { VERSION } from '$lib/constants.generated.js';

	const version = `v${VERSION}`;

	const examples = [
		{
			href: '/examples/basic',
			icon: '🌲',
			title: 'Basic Examples',
			description: 'Tree rendering, expand/collapse controls, node selection, and scroll to path.'
		},
		{
			href: '/examples/interaction',
			icon: '🖱️',
			title: 'Interaction',
			description: 'Click behavior modes, multi-select with range selection, and keyboard navigation.'
		},
		{
			href: '/examples/drag-drop',
			icon: '🎯',
			title: 'Drag & Drop',
			description: 'Desktop and mobile drag and drop with touch-friendly long-press activation.'
		},
		{
			href: '/examples/context-menu',
			icon: '📋',
			title: 'Context Menu',
			description: 'Right-click context menus with icons, disabled states, dividers, and dynamic items.'
		},
		{
			href: '/examples/search',
			icon: '🔍',
			title: 'Search & Filter',
			description: 'Internal search index for fast searching with searchNodes() and filterNodes().'
		},
		{
			href: '/examples/theming',
			icon: '🎨',
			title: 'Theming',
			description: 'Customize appearance with CSS variables for selection, drag-over, and icons.'
		},
		{
			href: '/examples/data',
			icon: '📊',
			title: 'Data Structures',
			description: 'Path-based data structure, custom separators, and insert result validation.'
		},
		{
			href: '/examples/tree-editor',
			icon: '✏️',
			title: 'Tree Editor',
			description: 'Interactive tree editing with add, move, remove operations and drag-and-drop.'
		},
		{
			href: '/examples/scenarios',
			icon: '🏢',
			title: 'Business Scenarios',
			description: 'Real-world workflows with mock database integration and batch operations.'
		},
		{
			href: '/examples/branch-operations',
			icon: '🌿',
			title: 'Branch Operations',
			description: 'Bulk subtree operations — insertBranch, replaceBranch, deleteBranch — with single emission.'
		},
		{
			href: '/examples/performance',
			icon: '⚡',
			title: 'Performance Test',
			description: 'Compare recursive vs flat rendering modes with configurable node counts.'
		},
		{
			href: '/examples/custom-layout',
			icon: '🧩',
			title: 'Custom Layout',
			description: 'Build custom UIs (breadcrumbs, badge clouds) on the headless TreeController via TreeProvider.'
		},
		{
			href: '/examples/silent-highlight',
			icon: '🔕',
			title: 'Silent Highlight',
			description: 'Restore tree state from URL params (deep links) without firing onHighlightChange / onSelectionChange.'
		},
		{
			href: '/examples/expand-collapse',
			icon: '🌳',
			title: 'Expand / Collapse',
			description: 'Array variants and exclusive focus mode for expandNodes / collapseNodes / expandAll / collapseAll.'
		},
		{
			href: '/dev/logging',
			icon: '📝',
			title: 'Logging',
			badge: 'debug',
			description: 'Test logging infrastructure with categorized loggers and configurable log levels.'
		}
	];

	onMount(() => {
		document.body.classList.add('landing-body');
		return () => {
			document.body.classList.remove('landing-body');
		};
	});
</script>

<svelte:head>
	<title>Svelte Treeview Examples</title>
</svelte:head>

<div class="page-container">
	<header class="header-card">
		<h1>Svelte Treeview</h1>
		<p class="subtitle">Hierarchical tree component for Svelte 5 with path-based data structure</p>
		<span class="version-badge">{version}</span>
	</header>

	<div class="cards">
		{#each examples as example}
			<a href={example.href} class="card-link">
				<div class="card-icon">{example.icon}</div>
				<h2 class="card-title">
					{example.title}
					{#if example.badge}
						<span class="badge">{example.badge}</span>
					{/if}
				</h2>
				<p class="card-description">{example.description}</p>
			</a>
		{/each}
	</div>

	<footer>
		<p>
			Created by <a href="https://github.com/keenmate" target="_blank">KeenMate</a> |
			<a href="https://github.com/nicenicenice/svelte-treeview" target="_blank">GitHub</a> |
			<a href="https://www.npmjs.com/package/@keenmate/svelte-treeview" target="_blank">npm</a>
		</p>
	</footer>
</div>
