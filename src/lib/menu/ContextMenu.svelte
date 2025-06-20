<script lang="ts">
	import type {Node} from "$lib/types.js"
	import Menu from "./Menu.svelte"
	interface Props {
		children?: import('svelte').Snippet<[any]>;
	}

	let { children }: Props = $props();

	let pos                      = $state({x: 0, y: 0})
	let showMenu                 = $state(false)
	let clickedNode: Node | null = $state(null)

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

<svelte:window onclick={closeMenu} />
{#if showMenu}
	<Menu {...pos} on:click={closeMenu} on:clickoutside={closeMenu}>
		{#if children}{@render children({ node: clickedNode, })}{:else}
			<b> context menu openned from: {clickedNode?.path}</b>
		{/if}
	</Menu>
{/if}
