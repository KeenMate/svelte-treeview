<script lang="ts">
	import {type DragData, type DraggableContext, InsertionType, TreeView} from "$lib/index.js"
	import {Card} from "@keenmate/svelte-adminlte"
	import type {SvelteComponent} from "svelte"
	import {writable} from "svelte/store"

	let leftTreeView: SvelteComponent | undefined = $state()
	let rightTreeView: SvelteComponent | undefined = $state()

	let leftTree = $state([
			{nodePath: "left", title: "Animals", hasChildren: true},
			{nodePath: "left.mammals", title: "Mammals", hasChildren: true},
			{nodePath: "left.mammals.primates", title: "Primates"},
			{nodePath: "left.mammals.canines", title: "Canines"},
			{nodePath: "left.mammals.felines", title: "Felines"},
			{nodePath: "left.birds", title: "Birds", hasChildren: true},
			{nodePath: "left.birds.raptors", title: "Raptors"},
			{nodePath: "left.birds.songbirds", title: "Songbirds"},
			{nodePath: "left.reptiles", title: "Reptiles", hasChildren: true},
			{nodePath: "left.reptiles.lizards", title: "Lizards"},
			{nodePath: "left.reptiles.snakes", title: "Snakes"},
			{nodePath: "left.fish", title: "Fish", hasChildren: true},
			{nodePath: "left.fish.freshwater", title: "Freshwater Fish"},
			{nodePath: "left.fish.saltwater", title: "Saltwater Fish"},
			{nodePath: "left.insects", title: "Insects", hasChildren: true},
			{nodePath: "left.insects.beetles", title: "Beetles"},
			{nodePath: "left.insects.butterflies", title: "Butterflies"}
		]
	)
	let rightTree = $state([
			{nodePath: "right", title: "Animals", hasChildren: true},
			{nodePath: "right.mammals", title: "Mammals", hasChildren: true},
			{nodePath: "right.mammals.primates", title: "Primates"},
			{nodePath: "right.mammals.canines", title: "Canines"},
			{nodePath: "right.mammals.felines", title: "Felines"},
			{nodePath: "right.birds", title: "Birds", hasChildren: true},
			{nodePath: "right.birds.raptors", title: "Raptors"},
			{nodePath: "right.birds.songbirds", title: "Songbirds"},
			{nodePath: "right.reptiles", title: "Reptiles", hasChildren: true},
			{nodePath: "right.reptiles.lizards", title: "Lizards"},
			{nodePath: "right.reptiles.snakes", title: "Snakes"},
			{nodePath: "right.fish", title: "Fish", hasChildren: true},
			{nodePath: "right.fish.freshwater", title: "Freshwater Fish"},
			{nodePath: "right.fish.saltwater", title: "Saltwater Fish"},
			{nodePath: "right.insects", title: "Insects", hasChildren: true},
			{nodePath: "right.insects.beetles", title: "Beetles"},
			{nodePath: "right.insects.butterflies", title: "Butterflies"}
		]
	)
	let draggableContext = writable<DraggableContext | null>(null)

	$inspect("rightTree", rightTree)

	function onLeftNodeClick(node) {
		leftTreeView?.setNodeExpansion(node.nodePath, null)
	}

	function onRightNodeClick(node) {
		rightTreeView?.setNodeExpansion(node.nodePath, null)
	}

	function addRightNode() {
		const val = Math.random()
		rightTree.push({
			nodePath: `right.insects.${val}`,
			title:    `Insects ${val}`,
			hasChildren: false
		})

		rightTree = rightTree
	}

	function onNodeMoved(payload: DragData) {
		console.log("Node moved", payload)

		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const originalSourceNode = leftTree.find(x => x.nodePath === payload.node.path)!
		const newLeftTree = leftTree.filter(x => x !== originalSourceNode)
		const targetIndex = rightTree.findIndex(x => x.nodePath === payload.target.path)
		if (targetIndex !== -1) {
			switch (payload.insertType) {
				case InsertionType.nest: {
					const target = rightTree[targetIndex]
					const basePath = target.nodePath
					const newNodePath = originalSourceNode.nodePath.substring(originalSourceNode.nodePath.lastIndexOf(".") + 1)

					rightTree.splice(targetIndex, 0, {
						...originalSourceNode,
						nodePath: `${basePath}${basePath ? "." : ""}${newNodePath}_${Math.random().toString().substring(2)}`,
						moved:    true
					})
					leftTree = newLeftTree
					rightTree = rightTree
					break
				}
				case InsertionType.insertAbove: {
					const target = rightTree[targetIndex]
					const basePath = target.nodePath.substring(0, target.nodePath.lastIndexOf("."))
					const newNodePath = originalSourceNode.nodePath.substring(originalSourceNode.nodePath.lastIndexOf(".") + 1)

					rightTree.splice(targetIndex, 1, {
						...originalSourceNode,
						nodePath: `${basePath}${basePath ? "." : ""}${newNodePath}_${Math.random().toString().substring(2)}`,
						moved:    true
					}, target)
					leftTree = newLeftTree
					rightTree = rightTree
					break
				}
				case InsertionType.insertBelow: {

					const target = rightTree[targetIndex]
					const basePath = target.nodePath.substring(0, target.nodePath.lastIndexOf("."))
					const newNodePath = originalSourceNode.nodePath.substring(originalSourceNode.nodePath.lastIndexOf(".") + 1)

					rightTree.splice(targetIndex, 0, {
						...originalSourceNode,
						nodePath: `${basePath}${basePath ? "." : ""}${newNodePath}_${Math.random().toString().substring(2)}`,
						moved:    true
					})
					leftTree = newLeftTree
					rightTree = rightTree
					break
				}
				case InsertionType.none:
					break
			}

			console.log("New trees", {
				leftTree:  $state.snapshot(leftTree),
				rightTree: $state.snapshot(rightTree),
			})
		}
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
				onMoved={onNodeMoved}
			>
				{#snippet children({node})}
					<span onclick={() => onRightNodeClick(node)}>
						{node.title}
					</span>
				{/snippet}
			</TreeView>
		</Card>
	</div>

	<button onclick={addRightNode}>
		Add
	</button>
</div>
