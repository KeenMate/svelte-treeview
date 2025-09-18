<script lang="ts">
	interface Props {
		title: string;
		subtitle?: string;
		demo?: import('svelte').Snippet;
		controls?: import('svelte').Snippet;
		description?: import('svelte').Snippet;
	}

	let { title, subtitle, demo, controls, description }: Props = $props();
</script>

<div class="showcase-section mb-5">
	<div class="row mb-4">
		<div class="col-12">
			<h2>{title}</h2>
			{#if subtitle}
				<p class="text-muted">{subtitle}</p>
			{/if}
		</div>
	</div>

	<div class="row">
		<div class="col-lg-4">
			<h5 class="text-primary">Demo</h5>
			<div class="demo-container border rounded p-3 bg-light">
				{@render demo?.()}
			</div>
		</div>

		<div class="col-lg-4">
			<h5 class="text-success">Controls</h5>
			<div class="controls-container">
				{@render controls?.()}
			</div>
		</div>

		<div class="col-lg-4">
			<h5 class="text-info">Description</h5>
			<div class="description-container">
				{@render description?.()}
			</div>
		</div>
	</div>
</div>

<style>
	.demo-container {
		min-height: 300px;
		max-height: 500px;
		overflow: auto;
	}

	.controls-container :global(.form-group) {
		margin-bottom: 1rem;
	}

	.description-container {
		font-size: 0.95rem;
	}

	.description-container :global(h6) {
		color: #495057;
		font-weight: 600;
		margin-top: 1rem;
		margin-bottom: 0.5rem;
	}

	.description-container :global(code) {
		background-color: #f8f9fa;
		padding: 0.2rem 0.4rem;
		border-radius: 0.25rem;
		font-size: 0.875em;
	}
</style>