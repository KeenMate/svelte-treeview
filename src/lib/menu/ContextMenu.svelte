<script lang="ts">
	import type {Node} from "$lib/types.js"
	import Menu from "./Menu.svelte"

	let pos                      = {x: 0, y: 0}
	let showMenu                 = false
	let clickedNode: Node | null = null

	export async function onRightClick(event: MouseEvent, node: Node) {
		if (showMenu) {
			showMenu = false
			await new Promise((res) => setTimeout(res, 100))
		}
		clickedNode = node
		pos         = {x: event.clientX, y: event.clientY}
		showMenu    = true
	}

	function closeMenu() {
		showMenu    = false
		clickedNode = null
	}
</script>

<svelte:window on:click={closeMenu} />
{#if showMenu}
	<Menu {...pos} on:click={closeMenu} on:clickoutside={closeMenu}>
		<slot node={clickedNode}>
			<b> context menu openned from: {clickedNode?.path}</b>
		</slot>
	</Menu>
{/if}
