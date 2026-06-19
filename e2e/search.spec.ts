import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for /test/search (minimal fixture page; /examples/search is
 * the tutorial demo with the same logic and a 160-row dataset).
 *
 * Single tree (~8 countries+cities) with a search bar above it. The page
 * supports two modes:
 *   - 'filter' (default): typing hides non-matching nodes via bind:searchText.
 *   - 'search':           tree stays whole; typing finds matches and the user
 *                         navigates between them (scrollToPath).
 *
 * The internal search index is built asynchronously via requestIdleCallback,
 * so we let Playwright's auto-wait poll until results surface rather than
 * forcing a sleep.
 *
 * Useful search terms (chosen so the visible result count is stable):
 *   'london'  → 2 matches (London/UK, London/Canada)
 *   'tokyo'   → 1 match
 *   'xxx_no_match' → 0 results
 */

const PAGE = '/test/search';

// ── Helpers ─────────────────────────────────────────────────────────────────

function card(page: Page): Locator {
	return page.locator('.card').filter({ has: page.locator('h2', { hasText: 'Search & Navigate' }) }).first();
}

function searchBar(page: Page): Locator {
	return card(page).locator('.search-bar').first();
}

function searchInput(page: Page): Locator {
	return searchBar(page).locator('input.search-input').first();
}

function searchCounter(page: Page): Locator {
	return searchBar(page).locator('.search-counter').first();
}

function modeLabel(page: Page): Locator {
	return searchBar(page).locator('.search-mode-label').first();
}

function modeToggleButton(page: Page): Locator {
	return searchBar(page).locator('button.search-mode-btn').first();
}

function treeContainer(page: Page): Locator {
	// First .tree-container under the card; the second is the Results list.
	return card(page).locator('.tree-container').nth(0);
}

function resultsContainer(page: Page): Locator {
	return card(page).locator('.tree-container').nth(1);
}

function nodeByName(page: Page, name: string): Locator {
	return treeContainer(page)
		.locator('.stv__node')
		.filter({ has: page.locator('.location-name', { hasText: new RegExp(`^${name}$`) }) })
		.first();
}

async function gotoSearch(page: Page) {
	await page.goto(PAGE);
	// Wait for the tree to render at least one node before tests probe state.
	await expect(page.locator('.stv__node').first()).toBeVisible();
}

/**
 * The search counter only re-renders on `oninput`. If the async indexer is
 * still catching up when we first fill, the page settles at "0 results" and
 * never updates. Re-fill in a poll loop until the counter matches.
 */
async function fillUntilCounter(page: Page, query: string, match: RegExp | string) {
	const input = searchInput(page);
	await expect
		.poll(
			async () => {
				await input.fill('');
				await input.fill(query);
				await page.waitForTimeout(150);
				return (await searchCounter(page).textContent()) ?? '';
			},
			{ timeout: 20_000 }
		)
		.toMatch(match instanceof RegExp ? match : new RegExp(`^${match}$`));
}

// ── Tests ───────────────────────────────────────────────────────────────────

test.describe('Initial state', () => {
	test('renders the tree and starts in filter mode with an empty search bar', async ({ page }) => {
		await gotoSearch(page);

		await expect(modeLabel(page)).toHaveText('Filter');
		await expect(searchInput(page)).toHaveValue('');
		// No counter visible until the user types.
		await expect(searchCounter(page)).toHaveCount(0);

		// The 8 country roots are visible (level 1).
		await expect(nodeByName(page, 'United States')).toBeVisible();
		await expect(nodeByName(page, 'Germany')).toBeVisible();
		await expect(nodeByName(page, 'Japan')).toBeVisible();
	});
});

test.describe('Filter mode (default)', () => {
	test('typing "london" filters the tree to matching paths', async ({ page }) => {
		await gotoSearch(page);

		await fillUntilCounter(page, 'london', /^\d+\/\d+$/);

		// London exists in both UK (5.1) and Canada (8.15) — the matching
		// branches stay visible, the others get filtered out.
		await expect(nodeByName(page, 'London')).toBeVisible();
		// "Tokyo" is in Japan, which doesn't match — it should be filtered out.
		await expect(nodeByName(page, 'Tokyo')).toHaveCount(0);
	});

	test('typing a non-matching query shows "0 results"', async ({ page }) => {
		await gotoSearch(page);

		await searchInput(page).fill('xxx_no_match_zzz');

		await expect(searchBar(page).locator('.search-counter.no-results')).toContainText('0 results');
	});

	test('Clear (×) button empties the input and restores the tree', async ({ page }) => {
		await gotoSearch(page);

		await fillUntilCounter(page, 'tokyo', /^\d+\/\d+$/);

		// The clear button is the one with title="Clear (Esc)".
		await searchBar(page).getByTitle('Clear (Esc)').click();

		await expect(searchInput(page)).toHaveValue('');
		// Counter unmounts when the input is empty.
		await expect(searchCounter(page)).toHaveCount(0);
		// Filtered-out roots return.
		await expect(nodeByName(page, 'United States')).toBeVisible();
		await expect(nodeByName(page, 'Germany')).toBeVisible();
	});

	test('Escape clears the search', async ({ page }) => {
		await gotoSearch(page);

		await fillUntilCounter(page, 'tokyo', /^\d+\/\d+$/);

		await searchInput(page).press('Escape');

		await expect(searchInput(page)).toHaveValue('');
		await expect(searchCounter(page)).toHaveCount(0);
	});

	test('Enter advances to the next result; Shift+Enter goes back', async ({ page }) => {
		await gotoSearch(page);

		// 'london' yields 2 matches (UK + Canada). The indexer adds items in
		// queue order; until Canada finishes, we may briefly see "1/1". The
		// search counter only refreshes on `oninput`, so we re-fill in a poll
		// loop until both Londons are indexed.
		const input = searchInput(page);
		await expect
			.poll(
				async () => {
					await input.fill('');
					await input.fill('london');
					await page.waitForTimeout(150);
					return (await searchCounter(page).textContent()) ?? '';
				},
				{ timeout: 20_000 }
			)
			.toBe('1/2');

		await searchInput(page).press('Enter');
		await expect(searchCounter(page)).toHaveText('2/2');

		// Wraps around after the last result.
		await searchInput(page).press('Enter');
		await expect(searchCounter(page)).toHaveText('1/2');

		// And goes back the other way.
		await searchInput(page).press('Shift+Enter');
		await expect(searchCounter(page)).toHaveText('2/2');
	});
});

test.describe('Mode toggle', () => {
	test('clicking the mode button switches to search mode and clears state', async ({ page }) => {
		await gotoSearch(page);

		// Type something in filter mode first.
		await fillUntilCounter(page, 'tokyo', /^\d+\/\d+$/);

		// Toggle mode — the page also clears the search on toggle.
		await modeToggleButton(page).click();
		await expect(modeLabel(page)).toHaveText('Search');
		await expect(searchInput(page)).toHaveValue('');

		// In search mode the tree stays unfiltered — all roots visible.
		await expect(nodeByName(page, 'United States')).toBeVisible();
		await expect(nodeByName(page, 'Germany')).toBeVisible();
		await expect(nodeByName(page, 'Japan')).toBeVisible();
	});

	test('search mode: typing surfaces matches in the results panel without hiding others', async ({
		page
	}) => {
		await gotoSearch(page);
		await modeToggleButton(page).click();
		await expect(modeLabel(page)).toHaveText('Search');

		await fillUntilCounter(page, 'tokyo', /^\d+\/\d+$/);

		// Tree itself still shows the unrelated roots — search did NOT filter.
		await expect(nodeByName(page, 'United States')).toBeVisible();

		// Results list (second .tree-container) shows the match.
		await expect(resultsContainer(page)).toContainText('Tokyo');
	});
});

test.describe('Container scroll setting', () => {
	test('toggling "Container scroll" is reflected in the checkbox state', async ({ page }) => {
		await gotoSearch(page);

		const cb = searchBar(page).getByLabel('Container scroll');
		// Default is on (useContainerScroll = true).
		await expect(cb).toBeChecked();

		await cb.uncheck();
		await expect(cb).not.toBeChecked();

		await cb.check();
		await expect(cb).toBeChecked();
	});
});
