<script lang="ts">
	import { onMount } from 'svelte';
	import { MenuDivider, MenuOption, TreeView } from '../../lib/index.js';
	import Files from '../../data/files.js';
	import { Card } from '@keenmate/svelte-adminlte';
	import { SelectionModes, type Node } from '$lib/types.js';
	import GithubButton from '../../components/GithubButton.svelte';

	type file = { path: string; hasChildren: boolean; name: string; selected: boolean };

	let tree: file[] = [];
	let showObject: boolean;
	let lastSelectedNodePath: string;
	let searchText = '';
	let selectedNodes: string[] = [];

	$: filterFunc = (node: any) => node.originalNode.name.includes(searchText);

	onMount(() => {
		tree = Files.map((n) => {
			return {
				...n,
				path: n.path.replaceAll('\\', '/'),
				checkbox: !n.path.startsWith('.'),
				dragDisabled: n.path.startsWith('.'),
				selected: false,
				nestAllowed: n.hasChildren
			};
		});
		console.log('MountedTree', tree);
	});

	function onSelectRandomNode() {
		const idx = Math.floor(Math.random() * tree.length);
		const node = tree[idx];

		selectedNodes = [...selectedNodes, node.path];
		lastSelectedNodePath = node.path;
	}

	function onChange(e: CustomEvent<string[]>) {
		console.log('selection changed ', e.detail);
		selectedNodes = e.detail;
	}
</script>

<div class="row mt-3">
	<div class="col-lg-8 col-12">
		<Card>
			<TreeView
				{tree}
				treeId="tree"
				let:node
				value={selectedNodes}
				on:change={onChange}
				on:expansion={(e) => console.log(e.detail)}
				on:moved={(e) => console.log(e.detail)}
				props={{ nodePath: 'path', nodeId: 'path' }}
				separator="/"
				showContextMenu
				recursiveSelection
				expandTo={1}
				selectionMode={SelectionModes.all}
				verticalLines
				logger={(...data) => console.debug('treeview: ', ...data)}
				filter={filterFunc}
			>
				{#if showObject}
					{JSON.stringify(node)}
				{:else}
					{#if node.hasChildren}
						<img
							src="https://static.vecteezy.com/system/resources/thumbnails/000/439/792/small/Basic_Ui__28178_29.jpg"
							alt="folder"
							height="20"
						/>
					{:else}
						<img
							src="https://cdn-icons-png.flaticon.com/512/124/124837.png"
							alt="folder"
							height="20"
						/>
					{/if}
					{node.name}
				{/if}

				<svelte:fragment slot="context-menu" let:node>
					<MenuOption text={node.path} isDisabled />
					<MenuDivider />
					<MenuOption
						on:click={() =>
							window.open(
								'https://github.com/KeenMate/phoenix-svelte-adminlte/blob/sveltekit/' + node.path
							)}
					>
						Open on github
					</MenuOption>
				</svelte:fragment>
				<svelte:fragment slot="nest-highlight">Place into folder</svelte:fragment>
			</TreeView>
		</Card>
	</div>
	<div class="col-lg-4 col-12">
		<Card>
			<svelte:fragment slot="tools">
				<GithubButton relativePath="src/routes/files/+page.svelte" />
			</svelte:fragment>
			<svelte:fragment slot="header">Files demo</svelte:fragment>
			<p>This demo shows how treeview can be used to browse files.</p>

			<br />

			<label for="showObjects">Show node objects</label>
			<input id="showObjects" type="checkbox" bind:checked={showObject} />

			<br />

			<label for="showObjects">SerachTree</label>
			<input bind:value={searchText} />

			<br />

			<button class="btn btn-primary" on:click={onSelectRandomNode}> Select random node </button>

			<br />
			selected nodes:
			<ul>
				{#each selectedNodes as nodePath}
					<li>{nodePath}</li>
				{/each}
			</ul>
		</Card>
	</div>
</div>
