<script lang="ts">
	import { createBubbler, preventDefault, stopPropagation } from 'svelte/legacy';

	const bubble = createBubbler();
	import {createEventDispatcher} from "svelte"
	import {type Node, SelectionModes, VisualState} from "./types.js"
	import {isSelectable} from "$lib/providers/selection-provider.js"

	interface Props {
		checkboxes: SelectionModes;
		recursive: boolean;
		node: Node;
		onlyLeafCheckboxes: boolean;
		hideDisabledCheckboxes: boolean;
		readonly?: boolean;
	}

	let {
		checkboxes,
		recursive,
		node,
		onlyLeafCheckboxes,
		hideDisabledCheckboxes,
		readonly = false
	}: Props = $props();

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
				onclick={(e) => onSelect(e, node)}
				onkeypress={(e) => e.key === 'Enter' && onSelect(e, node)}
				checked={node.visualState === VisualState.selected}
				indeterminate={node.visualState === VisualState.indeterminate}
				disabled={readonly}
			/>
		{:else}
			<input
				tabindex="-1"
				class="arrow"
				type="checkbox"
				onclick={null}
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
			onclick={stopPropagation(preventDefault(bubble('click')))}
			disabled={true}
			class:invisible={hideDisabledCheckboxes}
		/>
	{/if}
{/if}
