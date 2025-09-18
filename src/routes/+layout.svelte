<script>
	import { page } from '$app/stores';

	// Import the treeview styles from source during development
	import '$lib/styles/main.scss';

	let sidebarVisible = $state(true); // Start visible by default

	const navItems = [
		{ href: '/', label: 'Home', icon: '🏠' },
		{ href: '/api-reference', label: 'API Reference', icon: '📚' },
		{ href: '/basic', label: 'Basic', icon: '🌳' },
		{ href: '/data-structure', label: 'Data Structure', icon: '🗂️' },
		{ href: '/search', label: 'Search', icon: '🔍' },
		{ href: '/drag-drop', label: 'Drag & Drop', icon: '🔄' },
		{ href: '/drag-highlight', label: 'Drag Highlight', icon: '✨' },
		{ href: '/context-menu', label: 'Context Menu', icon: '📝' },
		{ href: '/custom-styling', label: 'Custom Styling', icon: '🎨' },
		{ href: '/performance', label: 'Performance', icon: '⚡' }
	];

	function toggleSidebar() {
		sidebarVisible = !sidebarVisible;
		console.log('Sidebar toggled:', sidebarVisible);
	}
</script>

<!-- Top Navigation Bar -->
<nav class="navbar navbar-expand-lg navbar-dark fixed-top" style="background-color: #00171F;">
	<div class="container-fluid">
		<!-- Burger menu button -->
		<button
			class="navbar-toggler me-2"
			onclick={toggleSidebar}
			aria-label="Toggle navigation"
			type="button"
		>
			<span class="navbar-toggler-icon"></span>
		</button>

		<!-- Brand -->
		<a class="navbar-brand text-white" href="/">
			<strong>Svelte Treeview v4</strong>
			<small class="text-white-50 ms-2">Feature Showcase</small>
		</a>

		<!-- GitHub link -->
		<div class="navbar-nav ms-auto">
			<a
				class="nav-link text-white"
				href="https://github.com/KeenMate/svelte-treeview"
				target="_blank"
				rel="noopener noreferrer"
			>
				<svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
					<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
				</svg>
				<span class="ms-1 d-none d-md-inline">GitHub</span>
			</a>
		</div>
	</div>
</nav>

<div class="d-flex main-wrapper">
	<!-- Backdrop for mobile -->
	{#if sidebarVisible}
		<div class="sidebar-backdrop d-lg-none" onclick={toggleSidebar}></div>
	{/if}

	<!-- Sidebar -->
	<nav class="sidebar text-white p-0 {sidebarVisible ? 'd-block' : 'd-none'}" style="background-color: #003459;">
		<div class="nav nav-pills flex-column p-3">
			{#each navItems as item}
				<a
					href={item.href}
					class="nav-link text-white mb-2 {$page.url.pathname === item.href ? 'active bg-primary' : ''}"
					style="border-radius: 0.5rem;"
					onclick={() => {
						// Close sidebar on mobile when clicking a link
						if (window.innerWidth < 992) {
							sidebarVisible = false;
						}
					}}
				>
					<span class="me-2">{item.icon}</span>
					{item.label}
				</a>
			{/each}
		</div>
	</nav>

	<!-- Main content -->
	<main class="flex-fill overflow-auto">
		<div class="container-fluid p-4">
			<slot />
		</div>
	</main>
</div>

<!-- Footer -->
<footer class="text-white text-center py-3" style="background-color: #007EA7;">
	<div class="container-fluid">
		<small>
			Made with ❤️ by
			<a href="https://keenmate.com" target="_blank" rel="noopener noreferrer" class="text-decoration-none">
				<strong>KeenMate</strong>
			</a>
		</small>
	</div>
</footer>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		padding-top: 56px; /* Account for fixed navbar */
	}

	.main-wrapper {
		min-height: calc(100vh - 56px - 60px); /* Subtract navbar and footer height */
	}

	.sidebar {
		width: 280px !important;
		min-width: 280px;
		max-width: 280px;
		flex-shrink: 0;
		position: relative;
		padding-top: 1rem;
	}

	.sidebar-backdrop {
		position: fixed;
		top: 56px; /* Start below navbar */
		left: 0;
		width: 100vw;
		height: calc(100vh - 56px);
		background-color: rgba(0, 0, 0, 0.5);
		z-index: 1040;
	}

	/* Mobile overlay */
	@media (max-width: 991.98px) {
		.sidebar {
			position: fixed;
			top: 56px; /* Start below navbar */
			left: 0;
			height: calc(100vh - 56px);
			z-index: 1050;
			box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
			padding-top: 1rem;
		}
	}

	/* Navigation styles */
	.navbar-brand {
		font-size: 1.25rem;
	}

	.navbar-brand small {
		font-size: 0.75rem;
		opacity: 0.8;
	}

	/* Custom burger menu icon for dark navbar - always visible */
	.navbar-toggler {
		border: 1px solid rgba(0, 167, 225, 0.5);
		padding: 0.375rem 0.5rem;
		display: block !important; /* Always visible */
		background-color: rgba(0, 167, 225, 0.05);
	}

	.navbar-toggler:focus {
		box-shadow: 0 0 0 0.2rem rgba(0, 167, 225, 0.25);
		outline: none;
	}

	.navbar-toggler:hover {
		border-color: #00A7E1;
		background-color: rgba(0, 167, 225, 0.15);
	}

	.navbar-toggler-icon {
		background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%28255, 255, 255, 1%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
	}

	/* Enhanced color scheme using Coolors palette */
	.sidebar {
		background: linear-gradient(180deg, #003459 0%, #00171F 100%) !important;
	}

	.sidebar .nav-link.active {
		background: linear-gradient(135deg, #00A7E1 0%, #007EA7 100%) !important;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		color: #FFFFFF !important;
	}

	.sidebar .nav-link {
		color: rgba(255, 255, 255, 0.9) !important;
	}

	.sidebar .nav-link:hover:not(.active) {
		background-color: rgba(0, 167, 225, 0.15) !important;
		color: #00A7E1 !important;
	}

	.sidebar .nav-link {
		transition: all 0.2s ease;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sidebar .nav-link span:first-child {
		display: inline-block;
		width: 1.5rem;
		text-align: center;
	}


	/* Footer styles */
	footer {
		margin-top: auto;
	}

	/* GitHub link */
	.navbar-nav .nav-link {
		display: flex;
		align-items: center;
		color: rgba(255, 255, 255, 0.9) !important;
		transition: all 0.2s ease;
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
	}

	.navbar-nav .nav-link:hover {
		color: #00A7E1 !important;
		background-color: rgba(0, 167, 225, 0.1);
		transform: translateY(-1px);
	}

	/* Enhanced footer with Coolors palette */
	footer {
		background: linear-gradient(135deg, #007EA7 0%, #003459 100%) !important;
		box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.2);
	}

	footer a {
		color: #FFFFFF !important;
		transition: all 0.2s ease;
	}

	footer a:hover {
		color: #00A7E1 !important;
		text-shadow: 0 0 8px rgba(0, 167, 225, 0.5);
	}

	/* Navbar enhancement with Coolors palette */
	.navbar {
		background: linear-gradient(135deg, #00171F 0%, #003459 100%) !important;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
		border-bottom: 2px solid #00A7E1;
	}

	/* Brand styling */
	.navbar-brand {
		color: #FFFFFF !important;
	}

	.navbar-brand:hover {
		color: #00A7E1 !important;
	}

	.navbar-brand small {
		color: rgba(0, 167, 225, 0.8) !important;
	}
</style>