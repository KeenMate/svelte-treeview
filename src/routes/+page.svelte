<script lang="ts">
	import { Tree } from '$lib/index.js';
	import { onMount } from 'svelte';

	// Create randomized ltree data
	function generateRandomizedData() {
		const pathToName: Record<string, string> = {
			// Level 1 - Departments
			'1': 'Engineering',
			'2': 'Marketing',
			'3': 'Sales',

			// Level 2 - Teams
			'1.1': 'Frontend Development',
			'1.2': 'Backend Development',
			'1.3': 'DevOps',
			'2.1': 'Digital Marketing',
			'2.2': 'Content Marketing',
			'2.3': 'Brand Management',
			'3.1': 'Enterprise Sales',
			'3.2': 'Customer Success',
			'3.3': 'Business Development',

			// Level 3 - Sub-teams
			'1.1.1': 'React Team',
			'1.1.2': 'Vue Team',
			'1.2.1': 'API Development',
			'1.2.2': 'Database Team',
			'2.1.1': 'SEO Team',
			'2.1.2': 'Social Media',
			'2.1.3': 'Email Marketing',
			'2.1.4': 'PPC Advertising',
			'2.2.1': 'Blog Content',
			'3.1.1': 'Fortune 500 Accounts',
			'3.1.2': 'Mid-Market Sales',
			'3.1.3': 'SMB Sales',
			'3.2.1': 'Onboarding',
			'3.2.2': 'Account Management',

			// Level 4 - Individual contributors
			'1.1.2.1': 'Component Library'
		};

		const paths = [
			'3.2.1',
			'1',
			'2.1.3',
			'1.2',
			'3',
			'1.1.1',
			'2.3',
			'1.1',
			'2.1',
			'3.1',
			'2',
			'1.1.2.1',
			'3.2',
			'2.1.1',
			'1.1.2',
			'2.1.2',
			'3.1.2',
			'1.2.1',
			'3.1.1',
			'2.2',
			'1.2.2',
			'3.2.2',
			'2.2.1',
			'3.1.3',
			'1.3',
			'2.1.4',
			'3.3'
		];

		return paths.map((path, index) => ({
			id: index,
			path: path,
			name: pathToName[path] || `Unknown ${path}`,
			description: `${pathToName[path] || 'Unknown'} - Level ${path.split('.').length}`,
			employeeCount: Math.floor(Math.random() * 50) + 1,
			budget: Math.floor(Math.random() * 1000000) + 50000,
			isActive: Math.random() > 0.2
		}));
	}

	let treeData: any[] = $state([]);
	let trie: any = null;
	let searchText = $state('');

	onMount(() => {
		// Generate randomized data
		treeData = generateRandomizedData();
	});
</script>

<h1>Svelte TreeView Demo</h1>
<p>
	Company organizational structure with randomized ltree paths - data is inserted in random order
	but displayed hierarchically:
</p>

<div class="search-container">
	<input type="text" placeholder="Search nodes..." bind:value={searchText} class="search-input" />
	{#if searchText}
		<button onclick={() => (searchText = '')} class="clear-button">Clear</button>
	{/if}
</div>

{#if treeData}
	<Tree
		data={treeData}
		treeId="organization-tree"
		idMember="id"
		pathMember="path"
		displayValueMember="name"
		searchValueMember="name"
		bind:searchText
		isSorted={false}
		shouldUseInternalSearchIndex={true}
		shouldDisplayDebugInformation={true}
		expandIconClass="ltree-icon-expand-plus"
		collapseIconClass="ltree-icon-collapse-minus"
		leafIconClass="ltree-icon-leaf"
		selectedNodeClass="ltree-selected-brackets"
	>
		{#snippet nodeTemplate(node)}
			{node.data.name} (isSelected: {node.isSelected})
		{/snippet}
	</Tree>
{:else}
	<p>Loading...</p>
{/if}

<style lang="scss">
	@import '../lib/styles/main.scss';

	:global(body) {
		font-family:
			-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell',
			'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
		line-height: 1.6;
		color: #2c3e50;
		background-color: #f8f9fa;
		margin: 0;
		padding: 2rem;
	}

	:global(*) {
		box-sizing: border-box;
	}

	h1 {
		color: #2c3e50;
		font-size: 2.5rem;
		font-weight: 700;
		margin: 0 0 1rem 0;
		letter-spacing: -0.02em;
	}

	p {
		color: #6c757d;
		font-size: 1.1rem;
		margin-bottom: 2rem;
		max-width: 800px;
	}

	.search-container {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 2rem;
		max-width: 400px;
	}

	.search-input {
		flex: 1;
		padding: 0.75rem 1rem;
		border: 2px solid #e2e8f0;
		border-radius: 8px;
		font-size: 1rem;
		font-family: inherit;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;

		&:focus {
			outline: none;
			border-color: #3b82f6;
			box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
		}

		&::placeholder {
			color: #9ca3af;
		}
	}

	.clear-button {
		padding: 0.75rem 1.25rem;
		background: #6c757d;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background-color 0.2s ease;

		&:hover {
			background: #5a6268;
		}
	}

	:global(.ltree-tree) {
		background: white;
		border-radius: 12px;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		padding: 1.5rem;
		border: 1px solid #e2e8f0;
	}

	:global(.ltree-debug-info) {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none !important;
		margin-bottom: 1.5rem;

		details summary {
			color: white !important;
			font-weight: 600;
		}

		.ltree-debug-stats span {
			background-color: rgba(255, 255, 255, 0.2) !important;
			color: white !important;
			border: 1px solid rgba(255, 255, 255, 0.3) !important;
			backdrop-filter: blur(4px);
		}
	}

	:global(.ltree-node-content:hover) {
		background-color: #f1f5f9 !important;
		transition: background-color 0.2s ease;
	}

	:global(.ltree-scroll-highlight) {
		animation: highlight-pulse 2s ease-out !important;
	}

	@keyframes highlight-pulse {
		0% {
			background-color: #3b82f6;
			transform: scale(1.02);
			box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
		}
		100% {
			background-color: transparent;
			transform: scale(1);
			box-shadow: none;
		}
	}
</style>
