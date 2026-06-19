import { test, expect, Page } from '@playwright/test';

/**
 * Regression: search hit in a collapsed deep branch must expand ancestors AND
 * scroll the container so the match is on-screen.
 *
 * Fixture (/test/search-deep): 10×10×10 = 1000 leaves over 3 levels,
 * expandLevel=1 so levels 2 and 3 start collapsed. The tree lives inside a
 * fixed-height (240 px) overflow-auto container with containerScroll=true on
 * scrollToPath, so the only way the target row reaches the viewport is if the
 * controller scrolls the wrapper.
 *
 * Targets a leaf in the bottom half ("Leaf-9-7-3" → path "9.7.3") so initial
 * collapsed view (just 10 group rows) doesn't already include it.
 *
 * The internal search index builds via requestIdleCallback. Poll on the
 * result-count testid until the indexer has caught up.
 */

const TARGET_NAME = 'ZZTARGETUNIQUE';
const TARGET_PATH = '9.7.10';

async function fillUntilCounter(page: Page, query: string, expected: string) {
	const input = page.getByTestId('search-input');
	await expect
		.poll(
			async () => {
				await input.fill('');
				await input.fill(query);
				await page.waitForTimeout(150);
				return (await page.getByTestId('result-count').textContent()) ?? '';
			},
			{ timeout: 15_000 }
		)
		.toBe(expected);
}

test('search-result navigation expands ancestors and scrolls a collapsed-branch hit into view', async ({ page }) => {
	await page.goto('/test/search-deep');
	await expect(page.locator('.stv__node').first()).toBeVisible();

	// Sanity: the deep target is not in the DOM before search (collapsed).
	await expect(page.locator(`.stv__node[data-tree-path="${TARGET_PATH}"]`)).toHaveCount(0);

	// Search auto-navigates to result 0 in the fixture's oninput handler.
	await fillUntilCounter(page, TARGET_NAME, '1');

	// Ancestors must have been expanded so the row mounts.
	const targetRow = page.locator(`.stv__node[data-tree-path="${TARGET_PATH}"]`).first();
	await expect(targetRow).toBeVisible();
	await expect(targetRow.locator('.node-name')).toHaveText(TARGET_NAME);

	// Wait for the smooth scroll to settle before measuring positions.
	await page.waitForTimeout(800);

	// The row's bounding rect must sit inside the scroll container's viewport.
	const container = page.getByTestId('scroll-container');
	const containerBox = await container.boundingBox();
	const rowBox = await targetRow.boundingBox();
	if (!containerBox || !rowBox) throw new Error('missing bounding box');
	expect(rowBox.y).toBeGreaterThanOrEqual(containerBox.y - 1);
	expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(containerBox.y + containerBox.height + 1);

	// And the scroll-highlight class must be applied to the matched row.
	await expect(targetRow.locator('.stv__node-content').first()).toHaveClass(/stv__node-content--scroll-highlight/);
});

test('sequential search to a different collapsed branch scrolls there too', async ({ page }) => {
	await page.goto('/test/search-deep');
	await expect(page.locator('.stv__node').first()).toBeVisible();

	// First search: collapsed branch near the bottom.
	await fillUntilCounter(page, TARGET_NAME, '1');
	const first = page.locator(`.stv__node[data-tree-path="${TARGET_PATH}"]`).first();
	await expect(first).toBeVisible();
	await page.waitForTimeout(800);

	// Second search: a different collapsed branch nearer the top. The
	// previously-expanded branch is still expanded, so the second target is
	// further from the current scroll position than it'd be on a fresh page.
	await fillUntilCounter(page, 'AATARGETUNIQUE', '1');
	const secondPath = '2.3.10';
	const second = page.locator(`.stv__node[data-tree-path="${secondPath}"]`).first();
	await expect(second).toBeVisible();

	await page.waitForTimeout(800);

	const container = page.getByTestId('scroll-container');
	const containerBox = await container.boundingBox();
	const rowBox = await second.boundingBox();
	if (!containerBox || !rowBox) throw new Error('missing bounding box');
	expect(rowBox.y).toBeGreaterThanOrEqual(containerBox.y - 1);
	expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(containerBox.y + containerBox.height + 1);

	await expect(second.locator('.stv__node-content').first()).toHaveClass(/stv__node-content--scroll-highlight/);
});
