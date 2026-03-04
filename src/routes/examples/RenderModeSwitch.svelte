<script lang="ts">
	import { getRenderMode, setRenderMode, type RenderMode } from './render-mode.svelte.js';

	const modes: { value: RenderMode; label: string; title: string }[] = [
		{ value: 'recursive', label: 'Recursive', title: 'Traditional nested component rendering' },
		{ value: 'progressive', label: 'Progressive', title: 'Flat rendering with progressive batching' },
		{ value: 'virtual', label: 'Virtual', title: 'Flat rendering with virtual scrolling (~50 DOM nodes)' },
	];
</script>

<div class="render-mode-switch">
	{#each modes as mode}
		<button
			class="rms-btn"
			class:active={getRenderMode() === mode.value}
			title={mode.title}
			onclick={() => setRenderMode(mode.value)}
		>{mode.label}</button>
	{/each}
</div>

<style>
	.render-mode-switch {
		display: inline-flex;
		gap: 0;
		border: 1px solid #cbd5e0;
		border-radius: 6px;
		overflow: hidden;
		font-size: 0.8rem;
		margin-top: 0.5rem;
	}

	.rms-btn {
		padding: 0.35rem 0.75rem;
		border: none;
		background: white;
		color: #4a5568;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.15s;
		border-right: 1px solid #cbd5e0;
	}

	.rms-btn:last-child {
		border-right: none;
	}

	.rms-btn:hover {
		background: #f7fafc;
	}

	.rms-btn.active {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}
</style>
