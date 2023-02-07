<script>
	import Draganddrop from "./Draganddrop.svelte";
	import DragTester from "./DragTester.svelte";
	import Files from "./Files.svelte";

	const demos = { generic: "Generic", drag: "dragTester", files: "Files" };
	let selectedDemo = demos.files;
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
{:else if selectedDemo == demos.files}
	<Files />
{:else}
	NO/Wrong demo selected
{/if}
