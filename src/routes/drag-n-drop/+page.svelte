<script lang="ts">
	import {type DraggableContext, TreeView} from "$lib/index.js"
	import {Card} from "@keenmate/svelte-adminlte"
	import type {SvelteComponent} from "svelte"
	import {writable} from "svelte/store"

	let leftTreeView: SvelteComponent | undefined = $state()
	let rightTreeView: SvelteComponent | undefined = $state()

	let leftTree = [
		{nodePath: "animals", title: "Animals", hasChildren: true},
		{nodePath: "animals.mammals", title: "Mammals", hasChildren: true},
		{nodePath: "animals.mammals.primates", title: "Primates"},
		{nodePath: "animals.mammals.canines", title: "Canines"},
		{nodePath: "animals.mammals.felines", title: "Felines"},
		{nodePath: "animals.birds", title: "Birds", hasChildren: true},
		{nodePath: "animals.birds.raptors", title: "Raptors"},
		{nodePath: "animals.birds.songbirds", title: "Songbirds"},
		{nodePath: "animals.reptiles", title: "Reptiles", hasChildren: true},
		{nodePath: "animals.reptiles.lizards", title: "Lizards"},
		{nodePath: "animals.reptiles.snakes", title: "Snakes"},
		{nodePath: "animals.fish", title: "Fish", hasChildren: true},
		{nodePath: "animals.fish.freshwater", title: "Freshwater Fish"},
		{nodePath: "animals.fish.saltwater", title: "Saltwater Fish"},
		{nodePath: "animals.insects", title: "Insects", hasChildren: true},
		{nodePath: "animals.insects.beetles", title: "Beetles"},
		{nodePath: "animals.insects.butterflies", title: "Butterflies"}
	]
	let rightTree = [
		{nodePath: "animals", title: "Animals", hasChildren: true},
		{nodePath: "animals.mammals", title: "Mammals", hasChildren: true},
		{nodePath: "animals.mammals.primates", title: "Primates"},
		{nodePath: "animals.mammals.canines", title: "Canines"},
		{nodePath: "animals.mammals.felines", title: "Felines"},
		{nodePath: "animals.birds", title: "Birds", hasChildren: true},
		{nodePath: "animals.birds.raptors", title: "Raptors"},
		{nodePath: "animals.birds.songbirds", title: "Songbirds"},
		{nodePath: "animals.reptiles", title: "Reptiles", hasChildren: true},
		{nodePath: "animals.reptiles.lizards", title: "Lizards"},
		{nodePath: "animals.reptiles.snakes", title: "Snakes"},
		{nodePath: "animals.fish", title: "Fish", hasChildren: true},
		{nodePath: "animals.fish.freshwater", title: "Freshwater Fish"},
		{nodePath: "animals.fish.saltwater", title: "Saltwater Fish"},
		{nodePath: "animals.insects", title: "Insects", hasChildren: true},
		{nodePath: "animals.insects.beetles", title: "Beetles"},
		{nodePath: "animals.insects.butterflies", title: "Butterflies"}
	]

	let draggableContext = writable<DraggableContext | null>(null)

	function onLeftNodeClick(node) {
		leftTreeView?.setNodeExpansion(node.nodePath, null)
	}

	function onRightNodeClick(node) {
		rightTreeView?.setNodeExpansion(node.nodePath, null)
	}
</script>

<div class="row mt-3">
	<div class="col-6">
		<Card>
			<TreeView
				bind:this={leftTreeView}
				tree={leftTree}
				treeId="my-left-tree"
				dragMode="drag_source"
				draggedContext={draggableContext}
			>
				{#snippet children({node})}
					<span onclick={() => onLeftNodeClick(node)}>
						{node.title}
					</span>
				{/snippet}
			</TreeView>
		</Card>
	</div>
	<div class="col-6">
		<Card>
			<TreeView
				bind:this={rightTreeView}
				tree={rightTree}
				treeId="my-right-tree"
				dragMode="drag_target"
				draggedContext={draggableContext}
			>
				{#snippet children({node})}
					<span onclick={() => onRightNodeClick(node)}>
						{node.title}
					</span>
				{/snippet}
			</TreeView>
		</Card>
	</div>
</div>
