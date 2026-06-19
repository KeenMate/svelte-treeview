<script lang="ts">
	import type { Snippet } from 'svelte';
	import { computePosition, autoUpdate, offset, flip, shift } from '@floating-ui/dom';

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

	let itemEl = $state<HTMLElement | null>(null);
	let submenuEl = $state<HTMLElement | null>(null);
	let submenuOpen = $state(false);
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;

	function cancelHide() {
		if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
	}

	function scheduleHide() {
		if (hideTimeout) clearTimeout(hideTimeout);
		hideTimeout = setTimeout(() => { submenuOpen = false; hideTimeout = null; }, 150);
	}

	$effect(() => {
		if (!submenuOpen || !itemEl || !submenuEl) return;
		const parent = itemEl;
		const menu = submenuEl;
		return autoUpdate(parent, menu, () => {
			computePosition(parent, menu, {
				strategy: 'fixed',
				placement: 'right-start',
				middleware: [
					offset({ mainAxis: 0, crossAxis: -4 }),
					flip({ fallbackPlacements: ['left-start'] }),
					shift({ padding: 8 })
				]
			}).then(({ x, y }) => {
				menu.style.left = `${x}px`;
				menu.style.top = `${y}px`;
			});
		});
	});
</script>

<div
	bind:this={itemEl}
	class="stv__context-menu-item {className || ''}"
	class:stv__context-menu-item--disabled={isDisabled}
	class:stv__context-menu-item--has-children={hasChildren}
	data-context-menu-id={id}
	role="menuitem"
	tabindex={isDisabled ? -1 : 0}
	onmouseenter={() => { if (hasChildren) { cancelHide(); submenuOpen = true; } }}
	onmouseleave={() => { if (hasChildren) scheduleHide(); }}
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
		<span class="stv__context-menu-icon">{icon}</span>
	{/if}
	<span class="stv__context-menu-label">{label}</span>
	{#if shortcut}
		<span class="stv__context-menu-shortcut">{shortcut}</span>
	{/if}
	{#if hasChildren}
		<span class="stv__context-menu-arrow">&#x25B8;</span>
	{/if}
</div>

{#if hasChildren && submenuOpen}
	<div
		bind:this={submenuEl}
		class="stv__context-menu stv__context-submenu"
		role="menu"
		tabindex="-1"
		onmouseenter={cancelHide}
		onmouseleave={scheduleHide}
	>
		{@render children!()}
	</div>
{/if}
