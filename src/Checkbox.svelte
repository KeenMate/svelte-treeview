<script>
	import { createEventDispatcher } from "svelte";

	export let checkboxes;
	export let helper;
	export let recursive;
	export let node;
	export let onlyLeafCheckboxes;
	export let checkboxesDisabled;

	const dispatch = createEventDispatcher();
</script>

{#if checkboxes == "perNode" || checkboxes == "all"}
	{#if helper.selection.isSelectable(node, checkboxes)}
		{#if !recursive || (recursive && !node[helper.props.hasChildren])}
			<input
				type="checkbox"
				on:change={() => dispatch("select", node)}
				checked={node[helper.props.selected] ? "false" : ""}
			/>
		{:else if !onlyLeafCheckboxes}
			<input
				type="checkbox"
				on:click={() => {
					dispatch("select-children", {
						node,
						checked: node.__visual_state == "true",
					});
				}}
				checked={node.__visual_state == "true" ? "false" : ""}
				indeterminate={node.__visual_state == "indeterminate"}
			/>
		{:else}
			<input
				type="checkbox"
				onclick="return false;"
				disabled={true}
				class:invisible={!checkboxesDisabled}
			/>
		{/if}
	{:else}
		<input
			type="checkbox"
			onclick="return false;"
			disabled={true}
			class:invisible={!checkboxesDisabled}
		/>
	{/if}
{/if}
