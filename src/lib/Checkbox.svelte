<script lang="ts">
	import { createEventDispatcher, hasContext } from 'svelte';
	import { SelectionModes, VisualState, type Node } from './types.js';
	import type { TreeHelper } from '$lib/index.js';
	import { SelectionProvider, isSelectable } from '$lib/providers/selection-provider.js';

	export let checkboxes: SelectionModes;
	export let helper: TreeHelper;
	export let recursive: boolean;
	export let node: Node;
	export let onlyLeafCheckboxes: boolean;
	export let hideDisabledCheckboxes: boolean;
	export let readonly = false;

	const dispatch = createEventDispatcher();

	function onSelect(node: Node) {
		dispatch('select', { node });
	}
</script>

{#if checkboxes == SelectionModes.perNode || checkboxes == SelectionModes.all}
	{#if isSelectable(node, checkboxes)}
		{#if !recursive || (recursive && !node.hasChildren) || !onlyLeafCheckboxes}
			<input
				type="checkbox"
				on:change={() => onSelect(node)}
				checked={node.visualState === VisualState.selected}
				indeterminate={node.visualState === VisualState.indeterminate}
				disabled={readonly}
			/>
		{:else}
			<input
				type="checkbox"
				on:click={null}
				disabled={true}
				class:invisible={hideDisabledCheckboxes}
			/>
		{/if}
	{:else}
		<input
			type="checkbox"
			on:click|preventDefault|stopPropagation
			disabled={true}
			class:invisible={hideDisabledCheckboxes}
		/>
	{/if}
{/if}
