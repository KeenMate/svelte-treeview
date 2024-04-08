<script>
	// @ts-nocheck
	import { checkboxesType, defaultPropNames as props } from '$lib/constants.js';

	import { TreeHelper, TreeView } from '$lib/index.js';
	import {
		Card,
		InputGroup,
		InputGroupPrepend,
		TextInput,
		InputGroupAppend,
		LteButton,
		ButtonDropdownButton,
		ButtonDropdown,
		ButtonDropdownItem
	} from '@keenmate/svelte-adminlte';
	import initialTree from '../../data/dhl-scopes.js';
	import Detail from './Detail.svelte';

	let tree = initialTree;
	let filteredTree = tree;

	let showNode;
	let query = '';
	const helper = new TreeHelper();

	function showDetail(node) {
		showNode = node;
	}

	function updateSearch(q) {
		if (!q || q == '') {
			filteredTree = tree;
		}

		filteredTree = helper.searchTree(tree, (x) => x.name.includes(q));
	}

	$: updateSearch(query);
</script>

<div class="row mx-auto">
	<div class="col-6">
		<Card color="muted">
			<svelte:fragment slot="header">
				<InputGroup size="sm">
					<InputGroupPrepend text>
						<i class="fas fa-search fa-fw" />
					</InputGroupPrepend>
					<TextInput bind:value={query} placeholder="Type to search..." small />
					<InputGroupAppend>
						<LteButton color="warning" small on:click={() => (query = '')}>
							<i class="fas fa-times fa-fw" />
						</LteButton>
					</InputGroupAppend>
				</InputGroup>
			</svelte:fragment>
			<svelte:fragment slot="tools">
				<ButtonDropdownButton small color="success">Add members</ButtonDropdownButton>
				<ButtonDropdown>
					<ButtonDropdownItem>Add Nominator</ButtonDropdownItem>
					<ButtonDropdownItem>Add Overseer</ButtonDropdownItem>
					<ButtonDropdownItem>Add Trusted User</ButtonDropdownItem>
				</ButtonDropdown>
			</svelte:fragment>
			<TreeView
				bind:tree
				{filteredTree}
				treeId="tree"
				let:node
				showContexMenu
				verticalLines
				selectionMode={checkboxesType.all}
			>
				<!-- svelte-ignore a11y-missing-attribute -->
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<a class="link-primary" on:click={() => showDetail(node)}>{node.name}({node.users})</a>
			</TreeView>
		</Card>
	</div>
	<div class="col-6">
		{#if showNode}
			<Detail node={showNode} />
		{/if}
	</div>
</div>

<style lang="scss">
</style>
