<script lang="ts">
	interface Props {
		label?: string;
	}

	let { label }: Props = $props();
</script>

<div class="stv__context-menu-divider" role="separator">
	{#if label}
		<span class="stv__context-menu-divider-label">{label}</span>
	{/if}
</div>
