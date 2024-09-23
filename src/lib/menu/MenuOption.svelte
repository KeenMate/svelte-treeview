<script>
	// @ts-nocheck

	import {createEventDispatcher, getContext} from "svelte"
	import {key} from "./menu.js"

	export let isDisabled = false
	export let text       = ""

	const dispatch = createEventDispatcher()

	const {dispatchClick} = getContext(key)

	const handleClick = (e) => {
		if (isDisabled) {
			return
		}

		dispatch("click")
		dispatchClick()
	}
</script>

<div class:disabled={isDisabled} on:click={handleClick} on:keydown={handleClick} role="button" tabindex="">
	{#if text}
		{text}
	{:else}
		<slot />
	{/if}
</div>

<style>
	div {
		padding: 4px 15px;
		cursor: default;
		font-size: 14px;
		display: flex;
		align-items: center;
		grid-gap: 5px;
	}

	div:hover {
		background: #0002;
	}

	div.disabled {
		color: #0006;
	}

	div.disabled:hover {
		background: white;
	}
</style>
