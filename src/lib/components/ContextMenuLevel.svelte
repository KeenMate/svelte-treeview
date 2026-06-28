<script lang="ts" generics="T">
	import type { LTreeNode } from '../ltree/ltree-node.svelte.js';
	import type { ContextMenuEntry, ContextMenuItem } from '../ltree/types.js';
	import { computePosition, autoUpdate, offset, flip, shift } from '@floating-ui/dom';
	import Self from './ContextMenuLevel.svelte';

	interface Props {
		entries: ContextMenuEntry[];
		contextNode: LTreeNode<T>;
		closeContextMenu: () => void;
		/** Called by a child submenu to keep this level open while the cursor crosses into it. */
		cancelParentHide?: () => void;
	}

	let { entries, contextNode, closeContextMenu, cancelParentHide }: Props = $props();

	let openIdx = $state<number | null>(null);
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;
	// $state so `bind:this={itemEls[i]}` writes are reactive and the submenu
	// positioning $effect re-runs once the parent item element is attached.
	let itemEls = $state<HTMLElement[]>([]);
	let submenuEl = $state<HTMLElement | null>(null);

	function cancelHide() {
		if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
		cancelParentHide?.();
	}

	function scheduleHide() {
		if (hideTimeout) clearTimeout(hideTimeout);
		hideTimeout = setTimeout(() => { openIdx = null; hideTimeout = null; }, 150);
	}

	function showSubmenu(idx: number) {
		cancelHide();
		openIdx = idx;
	}

	$effect(() => {
		const idx = openIdx;
		const menu = submenuEl;
		if (idx === null || !menu) return;
		const parent = itemEls[idx];
		if (!parent) return;
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

{#each entries as entry, i (i)}
	{#if 'divider' in entry && entry.divider}
		<div class="stv__context-menu-divider" role="separator">
			{#if entry.label}
				<span class="stv__context-menu-divider-label">{entry.label}</span>
			{/if}
		</div>
	{:else if (entry as ContextMenuItem).isVisible !== false}
		{@const item = entry as ContextMenuItem}
		{@const hasChildren = !!item.children && item.children.length > 0}
		<div
			bind:this={itemEls[i]}
			class="stv__context-menu-item {item.className || ''}"
			class:stv__context-menu-item--disabled={item.isDisabled}
			class:stv__context-menu-item--has-children={hasChildren}
			role="menuitem"
			tabindex={item.isDisabled ? -1 : 0}
			onmouseenter={() => { if (hasChildren) showSubmenu(i); else cancelHide(); }}
			onmouseleave={() => { if (hasChildren) scheduleHide(); }}
			onclick={async () => {
				if (item.isDisabled || hasChildren) return;
				try {
					await item.onclick?.();
				} catch (error) {
					console.error('Context menu callback error:', error);
				} finally {
					// Auto-close after activating a leaf item — selecting an entry dismisses
					// the menu, like every native/desktop menu. Consumers no longer need to
					// call the close callback themselves (doing so anyway is harmless).
					// Opt out with shouldCloseOnClick: false to keep the menu open for incremental
					// actions; the handler then dismisses it via its captured close callback.
					if (item.shouldCloseOnClick !== false) closeContextMenu();
				}
			}}
			onkeydown={async (e) => {
				if ((e.key === 'Enter' || e.key === ' ') && !item.isDisabled && !hasChildren) {
					e.preventDefault();
					try {
						await item.onclick?.();
					} catch (error) {
						console.error('Context menu callback error:', error);
					} finally {
						if (item.shouldCloseOnClick !== false) closeContextMenu();
					}
				}
			}}
		>
			{#if item.icon}
				<span class="stv__context-menu-icon">{item.icon}</span>
			{/if}
			<span class="stv__context-menu-label">{item.label}</span>
			{#if item.shortcut}
				<span class="stv__context-menu-shortcut">{item.shortcut}</span>
			{/if}
			{#if hasChildren}
				<span class="stv__context-menu-arrow">&#x25B8;</span>
			{/if}
		</div>
	{/if}
{/each}

{#if openIdx !== null}
	{@const openItem = entries[openIdx] as ContextMenuItem}
	{#if openItem && openItem.children}
		<div
			bind:this={submenuEl}
			class="stv__context-menu stv__context-submenu"
			role="menu"
			tabindex="-1"
			onmouseenter={cancelHide}
			onmouseleave={scheduleHide}
		>
			<Self
				entries={openItem.children}
				{contextNode}
				{closeContextMenu}
				cancelParentHide={cancelHide}
			/>
		</div>
	{/if}
{/if}
