<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { SelectionModes, VisualState, type Node } from './types.js';
	import type { TreeHelper } from '$lib/index.js';
	import { SelectionProvider } from '$lib/providers/selection-provider.js';

	export let checkboxes: SelectionModes;
	export let helper: TreeHelper;
	export let recursive: boolean;
	export let node: Node;
	export let onlyLeafCheckboxes: boolean;
	export let hideDisabledCheckboxes: boolean;
	export let readonly = false;

	let indeterminate: boolean;

	$: {
		if (helper.props.visualState(node) == 'indeterminate') {
			indeterminate = true;
		} else {
			indeterminate = false;
		}
	}
	// TODO pass from root
	$: selectionProvider = new SelectionProvider(helper, recursive);

	const dispatch = createEventDispatcher();

	function onSelect(node: Node) {
		dispatch('select', { node });
	}
</script>

{#if checkboxes == SelectionModes.perNode || checkboxes == SelectionModes.all}
	{#if selectionProvider.isSelectable(node, checkboxes)}
		<!-- select node -->
		{#if !recursive || (recursive && !helper.props.hasChildren(node))}
			<input
				type="checkbox"
				on:change={() => onSelect(node)}
				checked={helper.props.selected(node)}
				disabled={readonly}
			/>
			<!-- select children-->
		{:else if !onlyLeafCheckboxes}
			<!-- @ts-ingore -->
			<input
				type="checkbox"
				on:click={() => onSelect(node)}
				checked={helper.props.visualState(node) === VisualState.selected}
				{indeterminate}
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
