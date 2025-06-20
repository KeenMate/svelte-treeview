<script lang="ts">
	// @ts-nocheck

	import {createEventDispatcher, getContext} from "svelte"
	import {key} from "./menu.js"

	interface Props {
		isDisabled?: boolean;
		text?: string;
		children?: import('svelte').Snippet;
	}

	let { isDisabled = false, text = "", children }: Props = $props();

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

<div class:disabled={isDisabled} onclick={handleClick} onkeydown={handleClick} role="button" tabindex="">
	{#if text}
		{text}
	{:else}
		{@render children?.()}
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
