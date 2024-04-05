<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { checkboxesTypes, type Node } from './types.js';
	import type { TreeHelper } from '$lib/index.js';

	export let checkboxes: checkboxesTypes;
	export let helper: TreeHelper;
	export let recursive: boolean;
	export let node: Node;
	export let onlyLeafCheckboxes: boolean;
	export let checkboxesDisabled: boolean;
	export let readonly = false;

	let indeterminate: boolean;
	$: {
		if (node.__visual_state == 'indeterminate') {
			indeterminate = true;
		} else {
			indeterminate = false;
		}
	}

	const dispatch = createEventDispatcher();
</script>

{#if checkboxes == checkboxesTypes.perNode || checkboxes == checkboxesTypes.all}
	{#if helper.selection.isSelectable(node, checkboxes)}
		<!-- select node -->
		{#if !recursive || (recursive && !node[helper.props.hasChildren])}
			<input
				type="checkbox"
				on:change={() => dispatch('select', node)}
				checked={node[helper.props.selected]}
				disabled={readonly}
			/>
			<!-- select children-->
		{:else if !onlyLeafCheckboxes}
			<!-- @ts-ingore -->
			<input
				type="checkbox"
				on:click={() => {
					dispatch('select-children', {
						node,
						checked: node.__visual_state == 'true'
					});
				}}
				checked={node.__visual_state == 'true'}
				bind:indeterminate
				disabled={readonly}
			/>
		{:else}
			<input
				type="checkbox"
				on:click|preventDefault={null}
				disabled={true}
				class:invisible={!checkboxesDisabled}
			/>
		{/if}
	{:else}
		<input
			type="checkbox"
			on:click|preventDefault|stopPropagation
			disabled={true}
			class:invisible={!checkboxesDisabled}
		/>
	{/if}
{/if}
