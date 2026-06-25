import { test, expect, Page } from '@playwright/test';

/**
 * E2E coverage for the silent: true option on highlightNode / highlightNodes /
 * clearHighlight / clearSelection. Targets /test/silent-highlight.
 *
 * The fixture page wires every Tree event callback (onNodeClick,
 * onHighlightChange, onSelectionChange) to a counter rendered into the DOM.
 * Each control button calls a single Tree method — once with options omitted
 * ("loud"), once with { silent: true }. The spec asserts on the counters and
 * on the bindable highlightedPaths / selectedPaths to verify silent mode
 * suppresses callbacks but still updates state.
 *
 * Motivation: a user shares a URL with form data in query params. The page
 * loads form state from the URL and just needs to scroll + visually highlight
 * the matching node. Firing onHighlightChange in that flow would re-load the
 * form (or loop).
 */

const PAGE = '/test/silent-highlight';

async function goto(page: Page) {
	await page.goto(PAGE);
	await expect(page.locator('.stv__node').first()).toBeVisible();
}

async function counter(page: Page, name: 'click' | 'highlight' | 'selection'): Promise<number> {
	const txt = await page.getByTestId(`counter-${name}`).textContent();
	return Number(txt ?? '0');
}

async function highlightSize(page: Page): Promise<number> {
	return Number(await page.getByTestId('highlight-size').textContent() ?? '0');
}

async function selectionSize(page: Page): Promise<number> {
	return Number(await page.getByTestId('selection-size').textContent() ?? '0');
}

async function highlightPaths(page: Page): Promise<string> {
	return (await page.getByTestId('highlight-paths').textContent()) ?? '';
}

// ── highlightNode ───────────────────────────────────────────────────────────

test.describe('highlightNode', () => {
	test('loud: fires onNodeClick and onHighlightChange, updates state', async ({ page }) => {
		await goto(page);
		await page.getByTestId('reset-counters').click();

		await page.getByTestId('highlight-loud').click();

		expect(await counter(page, 'click')).toBe(1);
		expect(await counter(page, 'highlight')).toBe(1);
		expect(await highlightSize(page)).toBe(1);
		await expect(page.getByTestId('last-clicked')).toHaveText('1.2');
		await expect(page.getByTestId('highlight-paths')).toHaveText('1.2');
	});

	test('silent: skips callbacks but updates highlightedPaths and DOM class', async ({ page }) => {
		await goto(page);
		await page.getByTestId('reset-counters').click();

		await page.getByTestId('highlight-silent').click();

		// No callbacks fired
		expect(await counter(page, 'click')).toBe(0);
		expect(await counter(page, 'highlight')).toBe(0);
		await expect(page.getByTestId('last-clicked')).toHaveText('(none)');

		// State still updated
		expect(await highlightSize(page)).toBe(1);
		await expect(page.getByTestId('highlight-paths')).toHaveText('1.2');

		// Visual highlight class applied on the node-content element
		await expect(
			page.locator('.stv__node[data-tree-path="1.2"] .stv__node-content').first()
		).toHaveClass(/test-highlighted/);
	});

	test('silent then loud: counters only increment for loud call', async ({ page }) => {
		await goto(page);
		await page.getByTestId('reset-counters').click();

		await page.getByTestId('highlight-silent').click();
		await page.getByTestId('highlight-other-silent').click();
		expect(await counter(page, 'highlight')).toBe(0);
		expect(await highlightSize(page)).toBe(1);
		await expect(page.getByTestId('highlight-paths')).toHaveText('2.1');

		await page.getByTestId('highlight-loud').click();
		expect(await counter(page, 'highlight')).toBe(1);
		expect(await counter(page, 'click')).toBe(1);
		await expect(page.getByTestId('highlight-paths')).toHaveText('1.2');
	});
});

// ── highlightNodes ──────────────────────────────────────────────────────────

test.describe('highlightNodes', () => {
	test('loud: fires onHighlightChange, sets all paths', async ({ page }) => {
		await goto(page);
		await page.getByTestId('reset-counters').click();

		await page.getByTestId('highlight-many-loud').click();

		expect(await counter(page, 'highlight')).toBe(1);
		expect(await highlightSize(page)).toBe(2);
		await expect(page.getByTestId('highlight-paths')).toHaveText('1.1,1.2');
	});

	test('silent: skips callback, sets all paths', async ({ page }) => {
		await goto(page);
		await page.getByTestId('reset-counters').click();

		await page.getByTestId('highlight-many-silent').click();

		expect(await counter(page, 'highlight')).toBe(0);
		expect(await highlightSize(page)).toBe(2);
		await expect(page.getByTestId('highlight-paths')).toHaveText('1.1,1.2');
	});
});

// ── clearHighlight ──────────────────────────────────────────────────────────

test.describe('clearHighlight', () => {
	test('loud after highlight: fires onHighlightChange, clears state', async ({ page }) => {
		await goto(page);
		// Seed via silent so we don't pollute counters from setup.
		await page.getByTestId('highlight-silent').click();
		await page.getByTestId('reset-counters').click();

		await page.getByTestId('clear-loud').click();

		expect(await counter(page, 'highlight')).toBe(1);
		expect(await highlightSize(page)).toBe(0);
	});

	test('silent after highlight: skips callback, clears state', async ({ page }) => {
		await goto(page);
		await page.getByTestId('highlight-silent').click();
		await page.getByTestId('reset-counters').click();

		await page.getByTestId('clear-silent').click();

		expect(await counter(page, 'highlight')).toBe(0);
		expect(await highlightSize(page)).toBe(0);
	});
});

// ── clearSelection ───────────────────────────────────────────────────────────

test.describe('clearSelection', () => {
	test('loud after checkbox check: fires onSelectionChange, clears state', async ({ page }) => {
		await goto(page);

		// Check a checkbox via UI to populate selectedPaths.
		const checkbox = page.locator('.stv__node[data-tree-path="1.2"] .stv__checkbox').first();
		await checkbox.click();
		expect(await selectionSize(page)).toBeGreaterThan(0);

		await page.getByTestId('reset-counters').click();
		await page.getByTestId('clear-selection-loud').click();

		expect(await counter(page, 'selection')).toBe(1);
		expect(await selectionSize(page)).toBe(0);
	});

	test('silent after checkbox check: skips callback, clears state', async ({ page }) => {
		await goto(page);

		const checkbox = page.locator('.stv__node[data-tree-path="1.2"] .stv__checkbox').first();
		await checkbox.click();
		expect(await selectionSize(page)).toBeGreaterThan(0);

		await page.getByTestId('reset-counters').click();
		await page.getByTestId('clear-selection-silent').click();

		expect(await counter(page, 'selection')).toBe(0);
		expect(await selectionSize(page)).toBe(0);
	});
});

// ── User-facing URL-restore scenario ────────────────────────────────────────

test.describe('URL-restore scenario', () => {
	test('silent highlight + interactive click still fires (no callback poisoning)', async ({ page }) => {
		await goto(page);
		await page.getByTestId('reset-counters').click();

		// 1. URL restore: page sets highlight silently
		await page.getByTestId('highlight-silent').click();
		expect(await counter(page, 'highlight')).toBe(0);
		expect(await counter(page, 'click')).toBe(0);

		// 2. User then interacts normally — callbacks must still fire
		await page.locator('.stv__node[data-tree-path="2"] .stv__node-content').first().click();
		expect(await counter(page, 'click')).toBe(1);
		expect(await counter(page, 'highlight')).toBe(1);
	});
});
