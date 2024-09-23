<script lang="ts">
	import {TreeView} from "$lib/index.js"
	import {Card} from "@keenmate/svelte-adminlte"

	let tree = [
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
</script>

<div class="row mt-3">
	<div class="col-lg-8 col-12">
		<Card>
			<TreeView {tree} treeId="my-tree" let:node>
				{node.title}
			</TreeView>
		</Card>
	</div>
	<div class="col-lg-4 col-12">
		<Card>
			<p>This is minimal usage of treeview</p>
		</Card>
	</div>
</div>
