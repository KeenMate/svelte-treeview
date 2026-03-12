<script lang="ts">
	import RenderModeSwitch from './RenderModeSwitch.svelte';

	interface Props {
		title: string;
		subtitle?: string;
		showRenderModeSwitch?: boolean;
	}

	let { title, subtitle, showRenderModeSwitch = true }: Props = $props();
</script>

<header class="example-header">
	<a href="/" class="back-link">&larr; Back to Examples</a>
	<h1>{title}</h1>
	{#if subtitle}
		<p class="subtitle">{subtitle}</p>
	{/if}
	{#if showRenderModeSwitch}
		<RenderModeSwitch />
	{/if}
</header>
