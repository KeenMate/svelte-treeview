<script>
	import { page } from '$app/stores';
	
	// Import the treeview styles from source during development
	import '$lib/styles/main.scss';
	
	const navItems = [
		{ href: '/', label: 'Home', icon: '🏠' },
		{ href: '/basic', label: 'Basic', icon: '🌳' },
		{ href: '/data-structure', label: 'Data Structure', icon: '🗂️' },
		{ href: '/search', label: 'Search', icon: '🔍' },
		{ href: '/drag-drop', label: 'Drag & Drop', icon: '🔄' },
		{ href: '/drag-highlight', label: 'Drag Highlight', icon: '✨' },
		{ href: '/context-menu', label: 'Context Menu', icon: '📝' },
		{ href: '/custom-styling', label: 'Custom Styling', icon: '🎨' },
		{ href: '/performance', label: 'Performance', icon: '⚡' }
	];
</script>

<div class="d-flex vh-100">
	<!-- Sidebar -->
	<nav class="bg-dark text-white p-0" style="width: 250px;">
		<div class="p-3 border-bottom border-secondary">
			<h5 class="mb-0">Svelte Treeview v4</h5>
			<small class="text-muted">Feature Showcase</small>
		</div>
		
		<div class="nav nav-pills flex-column p-3">
			{#each navItems as item}
				<a 
					href={item.href} 
					class="nav-link text-white mb-2 {$page.url.pathname === item.href ? 'active bg-primary' : ''}"
					style="border-radius: 0.5rem;"
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

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}
	
	nav .nav-link {
		transition: all 0.2s ease;
	}
	
	nav .nav-link:hover:not(.active) {
		background-color: rgba(255, 255, 255, 0.1) !important;
	}
</style>