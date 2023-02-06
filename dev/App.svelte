<script>
	import Draganddrop from "./Draganddrop.svelte";
	import DragTester from "./DragTester.svelte";

	const demos = { generic: "Generic", drag: "dragTester" };
	let selectedDemo = demos.drag;
	$: console.log(selectedDemo);
</script>

<select bind:value={selectedDemo}>
	{#each Object.values(demos) as op}
		<option value={op}>
			{op}
		</option>
	{/each}</select
>

{#if selectedDemo == demos.generic}
	<Draganddrop />
{:else if selectedDemo == demos.drag}
	<DragTester />
{:else}
	NO/Wrong demo selected
{/if}
