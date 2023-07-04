<script>
	// @ts-nocheck
	import { checkboxesType, defaultPropNames as props } from '$lib/consts.js';

	import { TreeHelper, TreeView } from '$lib/index.js';
	import initialTree from '../../data/dhl-scopes.js';

	let tree = initialTree;
	let filteredTree = tree;

	let showNode;
	let query = '';

	function showDetail(node) {
		showNode = node;
	}

	function handleSelected() {
		const selectedItems = tree.filter((x) => x[props.selected]);

		console.log(selectedItems);
	}

	function updateSearch() {
		if (!query || query == '') {
			filteredTree = tree;
		}

		const helper = new TreeHelper();
		filteredTree = helper.searchTree(tree, (x) => x.name.includes(query));
	}
</script>

<div class="row mx-auto">
	<div class="col-6">
		<div class="card">
			<div class="card-header bg-gray d-flex">
				<input
					bind:value={query}
					class="form-control form-control-sm me-4"
					placeholder="Type to search..."
					on:input={updateSearch}
				/>
				<div class="card-tools pull-right ms-auto">
					<button
						type="button"
						class="btn btn-success btn-sm"
						on:click={handleSelected}
						style="white-space: nowrap;">Add trusted users</button
					>
				</div>
			</div>
			<div class="card-body">
				<TreeView
					bind:tree
					{filteredTree}
					treeId="tree"
					let:node
					showContexMenu
					enableVerticalLines
					checkboxes={checkboxesType.all}
				>
					<a class="link-primary" on:click={() => showDetail(node)}>{node.name}</a>
				</TreeView>
			</div>
		</div>
	</div>
	<div class="col-6">
		{#if showNode}
			<div class="card">
				<div class="card-header bg-gray"><h3 class="card-title">{showNode.name}</h3></div>
				<div class="card-body">
					{#if showNode.templates}
						<h4>Templates</h4>
						<ul>
							{#each showNode.templates as template}
								<li>
									{template}
								</li>
							{/each}
						</ul>
					{/if}

					{#if showNode.members}
						<h4>Member</h4>
						<ul>
							{#each showNode.members as member}
								<li>
									{member}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
