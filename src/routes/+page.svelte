<script>
	import { onMount } from 'svelte';

	const version = 'v4.5.0';

	const examples = [
		{
			href: '/examples/basic',
			icon: '🌲',
			title: 'Basic Examples',
			description: 'Get started with tree rendering, expand/collapse controls, and node selection. Perfect for understanding the fundamentals.',
			features: [
				'Simple tree with sample data',
				'Expand level control',
				'Node selection and events',
				'Scroll to path demo'
			]
		},
		{
			href: '/examples/drag-drop',
			icon: '🎯',
			title: 'Drag & Drop',
			description: 'Desktop and mobile drag and drop support. Move nodes between trees with touch-friendly long-press activation.',
			features: [
				'Two trees side-by-side for drag between',
				'Touch drag with long-press (300ms)',
				'Empty tree drop placeholder',
				'onNodeDrop callback handling'
			]
		},
		{
			href: '/examples/context-menu',
			icon: '📋',
			title: 'Context Menu',
			description: 'Right-click context menus with callbacks, icons, disabled states, and dividers. Build dynamic menus based on node properties.',
			features: [
				'Callback-based context menu',
				'Dynamic menu items per node',
				'Icons, disabled states, dividers',
				'Debug mode positioning'
			]
		},
		{
			href: '/examples/search',
			icon: '🔍',
			title: 'Search & Filter',
			description: 'Internal search index for fast searching. Use searchNodes() for querying or filterNodes() for live filtering.',
			features: [
				'Internal search index demo',
				'searchNodes() vs filterNodes()',
				'Custom search value member',
				'Real-time filtering'
			]
		},
		{
			href: '/examples/theming',
			icon: '🎨',
			title: 'Theming',
			description: 'Customize the tree appearance with CSS variables. Selection styles, drag-over effects, and custom icons.',
			features: [
				'CSS variable reference table',
				'Custom styling examples',
				'Selection and drag-over styles',
				'Icon customization'
			]
		},
		{
			href: '/examples/data',
			icon: '📊',
			title: 'Data Structures',
			description: 'Understand the path-based data structure, custom separators, and insert result validation.',
			features: [
				'Path-based data structure',
				'Custom path separators',
				'Insert result validation',
				'Failed nodes handling'
			]
		},
		{
			href: '/examples/tree-editor',
			icon: '✏️',
			title: 'Tree Editor',
			description: 'Build interactive tree editors with add, move, and remove operations. Full drag-and-drop support with sibling ordering.',
			features: [
				'Add nodes programmatically',
				'Move nodes (above/below/child)',
				'Remove nodes with descendants',
				'orderMember for sibling ordering'
			]
		},
		{
			href: '/examples/scenarios',
			icon: '🏢',
			title: 'Business Scenarios',
			description: 'Real-world tree manipulation workflows with mock database integration. Five complete scenarios from full redraws to batch operations.',
			features: [
				'Full redraw with state preservation',
				'Incremental updates (recommended)',
				'Individual CRUD with DB saves',
				'Batch create then save with getAllData()'
			]
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

<div class="container-landing">
	<header class="landing-header">
		<h1>🌲 Svelte Treeview</h1>
		<p class="subtitle">Interactive examples showcasing features and capabilities</p>
		<span class="version-badge">{version}</span>
	</header>

	<div class="cards-grid">
		{#each examples as example}
			<a href={example.href} class="landing-card">
				<div class="card-icon">{example.icon}</div>
				<h2 class="card-title">{example.title}</h2>
				<p class="card-description">{example.description}</p>
				<ul class="card-features">
					{#each example.features as feature}
						<li>{feature}</li>
					{/each}
				</ul>
			</a>
		{/each}
	</div>

	<footer class="landing-footer">
		<p>
			Created by <a href="https://github.com/keenmate" target="_blank">KeenMate</a> |
			<a href="https://github.com/nicenicenice/svelte-treeview" target="_blank">GitHub</a> |
			<a href="https://www.npmjs.com/package/@keenmate/svelte-treeview" target="_blank">npm</a>
		</p>
	</footer>
</div>
