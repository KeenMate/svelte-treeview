<script lang="ts">
	interface Props {
		label?: string;
	}

	let { label }: Props = $props();
</script>

<div class="ltree-context-menu-divider" role="separator">
	{#if label}
		<span class="ltree-context-menu-divider-label">{label}</span>
	{/if}
</div>
