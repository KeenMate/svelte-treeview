<!-- component from https://svelte.dev/repl/3a33725c3adb4f57b46b597f9dade0c1?version=3.25.0 -->

<script lang="ts">
	import { run } from 'svelte/legacy';

	// @ts-nocheck

	import {createEventDispatcher, setContext} from "svelte"
	import {fade} from "svelte/transition"
	import {key} from "./menu.js"

	let { x = $bindable(), y = $bindable(), children } = $props();


	const dispatch = createEventDispatcher()

	setContext(key, {
		dispatchClick: () => dispatch("click")
	})

	let menuEl = $state()

	function onPageClick(e) {
		if (e.target === menuEl || menuEl.contains(e.target)) {
			return
		}
		dispatch("clickoutside")
	}
	// whenever x and y is changed, restrict box to be within bounds
	run(() => {
		(() => {
			if (!menuEl) {
				return
			}

			const rect = menuEl.getBoundingClientRect()
			x          = Math.min(window.innerWidth - rect.width, x)
			if (y > window.innerHeight - rect.height) {
				y -= rect.height
			}
		})(x, y)
	});
</script>

<svelte:body onclick={onPageClick} />

<div transition:fade={{ duration: 100 }} bind:this={menuEl} style="top: {y}px; left: {x}px;">
	{@render children?.()}
</div>

<style>
	div {
		position: fixed;
		display: grid;
		border: 1px solid #0003;
		box-shadow: 2px 2px 5px 0px #0002;
		background: white;
		z-index: 999;
	}
</style>
