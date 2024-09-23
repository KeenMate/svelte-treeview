<script lang="ts">
	import {createEventDispatcher} from "svelte"
	import {type Node, SelectionModes, VisualState} from "./types.js"
	import {isSelectable} from "$lib/providers/selection-provider.js"

	export let checkboxes: SelectionModes
	export let recursive: boolean
	export let node: Node
	export let onlyLeafCheckboxes: boolean
	export let hideDisabledCheckboxes: boolean
	export let readonly = false

	const dispatch = createEventDispatcher()

	function onSelect(e: Event, node: Node) {
		// e.preventDefault();
		dispatch("select", {node})
		return false
	}
</script>

{#if checkboxes == SelectionModes.perNode || checkboxes == SelectionModes.all}
	{#if isSelectable(node, checkboxes)}
		{#if !recursive || (recursive && !node.hasChildren) || !onlyLeafCheckboxes}
			<input
				tabindex="-1"
				type="checkbox"
				class="arrow"
				on:click={(e) => onSelect(e, node)}
				on:keypress={(e) => e.key === 'Enter' && onSelect(e, node)}
				checked={node.visualState === VisualState.selected}
				indeterminate={node.visualState === VisualState.indeterminate}
				disabled={readonly}
			/>
		{:else}
			<input
				tabindex="-1"
				class="arrow"
				type="checkbox"
				on:click={null}
				disabled={true}
				checked={node.visualState === VisualState.selected}
				indeterminate={node.visualState === VisualState.indeterminate}
				class:invisible={hideDisabledCheckboxes}
			/>
		{/if}
	{:else}
		<input
			tabindex="-1"
			class="arrow"
			type="checkbox"
			on:click|preventDefault|stopPropagation
			disabled={true}
			class:invisible={hideDisabledCheckboxes}
		/>
	{/if}
{/if}
