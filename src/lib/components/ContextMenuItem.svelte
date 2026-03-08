<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		id?: string;
		label: string;
		icon?: string;
		shortcut?: string;
		isDisabled?: boolean;
		className?: string;
		onclick?: () => void | Promise<void>;
		children?: Snippet;
	}

	let {
		id,
		label,
		icon,
		shortcut,
		isDisabled = false,
		className,
		onclick,
		children
	}: Props = $props();

	const hasChildren = $derived(!!children);
</script>

<div
	class="ltree-context-menu-item {className || ''}"
	class:ltree-context-menu-item-disabled={isDisabled}
	class:ltree-context-menu-has-children={hasChildren}
	data-context-menu-id={id}
	role="menuitem"
	tabindex={isDisabled ? -1 : 0}
	onclick={async () => {
		if (!isDisabled && !hasChildren) {
			try {
				await onclick?.();
			} catch (error) {
				console.error('Context menu callback error:', error);
			}
		}
	}}
	onkeydown={async (e) => {
		if ((e.key === 'Enter' || e.key === ' ') && !isDisabled && !hasChildren) {
			e.preventDefault();
			try {
				await onclick?.();
			} catch (error) {
				console.error('Context menu callback error:', error);
			}
		}
	}}
>
	{#if icon}
		<span class="ltree-context-menu-icon">{icon}</span>
	{/if}
	<span class="ltree-context-menu-label">{label}</span>
	{#if shortcut}
		<span class="ltree-context-menu-shortcut">{shortcut}</span>
	{/if}
	{#if hasChildren}
		<span class="ltree-context-menu-arrow">&#x25B8;</span>
		<div class="ltree-context-submenu" role="menu">
			{@render children!()}
		</div>
	{/if}
</div>
