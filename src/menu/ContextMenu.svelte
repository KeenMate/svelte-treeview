<script>
	import Menu from "./Menu.svelte";

	let pos = { x: 0, y: 0 };
	let showMenu = false;
	let node = null;

	export async function onRightClick(e, n) {
		if (showMenu) {
			showMenu = false;
			await new Promise((res) => setTimeout(res, 100));
		}
		node = n;
		pos = { x: e.clientX, y: e.clientY };
		showMenu = true;
	}

	function closeMenu() {
		showMenu = false;
		node = null;
	}
</script>

<svelte:window on:click={closeMenu} />
{#if showMenu}
	<Menu {...pos} on:click={closeMenu} on:clickoutside={closeMenu}>
		<slot {node}>
			<b> context menu openned from: {node?.nodePath}</b>
		</slot>
	</Menu>
{/if}
