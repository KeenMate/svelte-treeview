<script>
	import { createEventDispatcher } from "svelte";
	import { checkboxesType } from "./consts";

	export let checkboxes;
	export let helper;
	export let recursive;
	export let node;
	export let onlyLeafCheckboxes;
	export let checkboxesDisabled;

	const dispatch = createEventDispatcher();
</script>

{#if checkboxes == checkboxesType.perNode || checkboxes == checkboxesType.all}
	{#if helper.selection.isSelectable(node, checkboxes)}
		<!-- select node -->
		{#if !recursive || (recursive && !node[helper.props.hasChildren])}
			<input
				type="checkbox"
				on:change={() => dispatch("select", node)}
				checked={node[helper.props.selected] ? "false" : ""}
			/>
			<!-- select children-->
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
