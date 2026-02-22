<script>
	import { onMount } from 'svelte';

	const examples = [
		{
			href: '/examples/org-chart',
			icon: '🏢',
			title: 'Org Chart',
			description: 'Management org chart with business-card nodes featuring avatars, departments, status indicators, and two visual themes.'
		},
		{
			href: '/examples/nhl-playoffs',
			icon: '🏒',
			title: 'NHL Playoff Bracket',
			description: 'Tournament bracket with custom matchup cards showing team names, seeds, series scores, and round labels.'
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
	<title>Custom Canvas Renderers - Svelte Treeview</title>
	<link rel="stylesheet" href="/examples-shared.css" />
</svelte:head>

<div class="page-container">
	<header class="header-card">
		<a href="/" class="back-link-landing">&larr; Back to all examples</a>
		<h1>Custom Canvas Renderers</h1>
		<p class="subtitle">CanvasTree examples using custom <code>renderNode</code> callbacks to draw domain-specific node visuals</p>
	</header>

	<div class="cards">
		{#each examples as example}
			<a href={example.href} class="card-link">
				<div class="card-icon">{example.icon}</div>
				<h2 class="card-title">{example.title}</h2>
				<p class="card-description">{example.description}</p>
			</a>
		{/each}
	</div>

	<footer>
		<p>
			<a href="/">&larr; Back to all examples</a>
		</p>
	</footer>
</div>

<style>
	.back-link-landing {
		display: inline-block;
		color: white;
		text-decoration: none;
		margin-bottom: 1rem;
		opacity: 0.8;
		transition: opacity 0.2s;
		font-size: 0.95rem;
	}
	.back-link-landing:hover {
		opacity: 1;
		text-decoration: none;
	}
	code {
		background: rgba(255, 255, 255, 0.2);
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
		font-size: 0.9em;
		color: white;
	}
</style>
