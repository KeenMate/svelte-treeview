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

	let treeData: any[] = [];
	let trie: any = null;

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

{#if treeData}
	<Tree
		data={treeData}
		treeId="organization-tree"
		idMember="id"
		pathMember="path"
		displayValueMember="name"
		isSorted={false}
shouldDisplayDebugInformation={true}
	/>
{:else}
	<p>Loading...</p>
{/if}

<style lang="scss">
	@import '../lib/styles.scss';

	h1 {
		color: #333;
		font-size: 2rem;
		margin-bottom: 1rem;
	}

	p {
		color: #666;
		margin-bottom: 2rem;
	}
</style>
