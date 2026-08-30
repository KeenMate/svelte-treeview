<script lang="ts">
	// Floating "on this page" jump navigator — the Svelte twin of web-multiselect's
	// examples-chapter-nav.js. A tab pinned to the right edge expands into a list of
	// the page's chapters (every <h2> inside .container) with scroll-spy, or, when
	// given `items`, a cross-page jump list (the examples index). Styles live in
	// static/examples-shared.css under `.chapter-nav*`.
	import { onMount, tick } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { computePosition, autoUpdate, offset, flip, shift } from '@floating-ui/dom';

	type NavItem = { label: string; href: string };
	type Chapter = { id: string | null; label: string; section: Element | null; href: string };

	let { items = null }: { items?: NavItem[] | null } = $props();

	const crossPage = $derived(!!items);

	let open = $state(false);
	let chapters = $state<Chapter[]>([]);
	let activeId = $state<string | null>(null);

	let rootEl = $state<HTMLDivElement | null>(null);
	let toggleEl = $state<HTMLButtonElement | null>(null);
	let panelEl = $state<HTMLElement | null>(null);

	function slugify(text: string, i: number, used: Set<string>): string {
		let id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `section-${i + 1}`;
		if (used.has(id)) {
			let n = 2;
			while (used.has(`${id}-${n}`)) n++;
			id = `${id}-${n}`;
		}
		used.add(id);
		return id;
	}

	function scanChapters() {
		// Cross-page mode: use the explicit registry, no scroll-spy, no ids.
		if (items) {
			chapters = items
				.filter((it) => it && it.href)
				.map((it, i) => ({ id: null, label: it.label || `Item ${i + 1}`, section: null, href: it.href }));
			return;
		}
		// In-page mode: turn every <h2> in .container into a jumpable chapter. Reuse an
		// existing id, else slug the heading text; labels drop any inline .badge chip.
		const container = document.querySelector('.container') || document.body;
		const headings = Array.from(container.querySelectorAll('h2'));
		const used = new Set<string>();
		chapters = headings.map((h2, i) => {
			const section = h2.closest('.card, .example-section') || h2.parentElement || h2;
			const clone = h2.cloneNode(true) as HTMLElement;
			clone.querySelectorAll('.badge').forEach((b) => b.remove());
			const label = (clone.textContent || '').replace(/\s+/g, ' ').trim() || `Section ${i + 1}`;
			let id = (section as HTMLElement).id || h2.id;
			if (!id) {
				id = slugify(label, i, used);
				(section as HTMLElement).id = id;
			} else {
				used.add(id);
			}
			return { id, label, section, href: `#${id}` };
		});
		updateActive();
	}

	function updateActive() {
		if (crossPage || chapters.length === 0) return;
		let current = chapters[0].id;
		for (const c of chapters) {
			if (c.section && c.section.getBoundingClientRect().top <= 120) current = c.id;
			else break;
		}
		activeId = current;
	}

	// Anchor the open panel to the tab with Floating UI; autoUpdate keeps it pinned
	// across scroll/resize/zoom. Falls back to a flip through the other corners.
	$effect(() => {
		if (!open || !toggleEl || !panelEl) return;
		const stop = autoUpdate(toggleEl, panelEl, () => {
			computePosition(toggleEl!, panelEl!, {
				placement: 'left-start',
				strategy: 'fixed',
				middleware: [offset(8), flip({ fallbackPlacements: ['right-start', 'bottom-end', 'top-end'] }), shift({ padding: 8 })]
			}).then(({ x, y }) => {
				if (panelEl) {
					panelEl.style.left = `${x}px`;
					panelEl.style.top = `${y}px`;
				}
			});
		});
		return stop;
	});

	function pick(c: Chapter) {
		if (c.id) activeId = c.id;
		open = false;
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			open = false;
			toggleEl?.focus();
		}
	}

	function onWindowClick(e: MouseEvent) {
		if (open && rootEl && !rootEl.contains(e.target as Node)) open = false;
	}

	onMount(() => {
		scanChapters();
		if (crossPage) return;
		let ticking = false;
		const onScroll = () => {
			if (ticking) return;
			ticking = true;
			requestAnimationFrame(() => {
				updateActive();
				ticking = false;
			});
		};
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll, { passive: true });
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	});

	// The layout persists across client-side navigation between example pages, so
	// re-scan the new page's headings once its DOM has settled.
	afterNavigate(async () => {
		if (crossPage) return;
		open = false;
		await tick();
		scanChapters();
	});
</script>

<svelte:window on:keydown={onWindowKeydown} on:click={onWindowClick} />

{#if chapters.length >= 2}
	<div class="chapter-nav" data-open={open} bind:this={rootEl}>
		<button
			bind:this={toggleEl}
			type="button"
			class="chapter-nav__toggle"
			aria-expanded={open}
			aria-controls="chapter-nav-panel"
			aria-label={crossPage ? 'Jump to an example page' : 'Jump to a section on this page'}
			onclick={() => (open = !open)}
		>
			<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
				<line x1="8" y1="6" x2="20" y2="6" />
				<line x1="8" y1="12" x2="20" y2="12" />
				<line x1="8" y1="18" x2="20" y2="18" />
				<circle cx="4" cy="6" r="1.4" />
				<circle cx="4" cy="12" r="1.4" />
				<circle cx="4" cy="18" r="1.4" />
			</svg>
		</button>

		<nav
			bind:this={panelEl}
			class="chapter-nav__panel"
			id="chapter-nav-panel"
			aria-label={crossPage ? 'Examples' : 'On this page'}
		>
			{#if !crossPage}
				<a class="chapter-nav__back" href="/">← Back to Examples</a>
			{/if}
			<div class="chapter-nav__title">{crossPage ? 'Examples' : 'On this page'}</div>
			<ul class="chapter-nav__list">
				{#each chapters as c (c.href)}
					<li>
						<a
							class="chapter-nav__item"
							class:is-active={!!c.id && c.id === activeId}
							href={c.href}
							onclick={() => pick(c)}
						>
							{c.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</div>
{/if}
