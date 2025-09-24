<script>
	import { page } from '$app/stores';

	// Import the treeview styles from source during development
	import '$lib/styles/main.scss';

	const navItems = [
		{ href: '/', label: 'Home', icon: '🏠' },
		{ href: '/dev', label: 'Development', icon: '⚙️' },
		{ href: '/dev/context-menu', label: 'Context Menu', icon: '📋' }
	];
</script>

<!-- Simple Top Navigation -->
<nav class="navbar navbar-expand-lg navbar-dark" style="background-color: #00171F;">
	<div class="container-fluid">
		<a class="navbar-brand" href="/">
			<strong>Svelte Treeview</strong> v4
		</a>

		<div class="navbar-nav ms-auto flex-row">
			{#each navItems as item}
				<a
					href={item.href}
					class="nav-link mx-2"
					class:active={$page.url.pathname === item.href}
				>
					{item.icon} {item.label}
				</a>
			{/each}
			<a
				href="https://github.com/keenmate/svelte-treeview"
				class="nav-link ms-3"
				target="_blank"
			>
				<i class="fab fa-github"></i> GitHub
			</a>
		</div>
	</div>
</nav>

<!-- Main Content -->
<main class="mt-3">
	<slot />
</main>

<!-- Simple Footer -->
<footer class="text-center py-3 mt-5" style="background-color: #f8f9fa;">
	<div class="container">
		<small class="text-muted">
			&copy; 2025 <a href="https://keenmate.com" class="text-decoration-none">KeenMate</a> -
			Svelte Treeview Component
		</small>
	</div>
</footer>

<style>
	:global(body) {
		padding-top: 0;
	}

	.nav-link.active {
		background-color: rgba(255, 255, 255, 0.1);
		border-radius: 0.25rem;
	}

	.nav-link:hover {
		background-color: rgba(255, 255, 255, 0.1);
		border-radius: 0.25rem;
	}
</style>