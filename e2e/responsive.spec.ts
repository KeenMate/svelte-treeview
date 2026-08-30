import { test, expect, Page } from '@playwright/test';

/**
 * Coverage for the responsive container-box signal at /test/responsive
 * (transferred 1:1 from web-components-core; wired via core/responsive.svelte.ts).
 * The tree renders inline and changes nothing itself — it EXPOSES its own
 * .stv__container border-box two ways, both fed by the shared ResizeObserver:
 *   - bind:containerSize  → drives a `$derived` isNarrow flag
 *   - onContainerResize   → imperative callback (size + window deviceClass)
 * The fixture drives the wrapper width; assertions retry (ResizeObserver is async
 * + throttled ~30ms) via expect.poll / toHaveAttribute.
 */

const readout = (page: Page) => page.getByTestId('readout');

/** Read a numeric data-* attribute off the readout (retries until it settles near `expected`). */
async function expectWidthNear(page: Page, attr: string, expected: number, tol = 24) {
	await expect
		.poll(async () => Number((await readout(page).getAttribute(attr)) || 'NaN'), {
			timeout: 4000
		})
		.toBeGreaterThan(expected - tol);
	await expect
		.poll(async () => Number((await readout(page).getAttribute(attr)) || 'NaN'))
		.toBeLessThan(expected + tol);
}

test.describe('responsive container signal', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/test/responsive');
		await page.waitForLoadState('networkidle');
		await expect(page.locator('[data-tree-path="1"]')).toBeVisible();
	});

	test('bindable containerSize reports the tree box and fires immediately on mount', async ({
		page
	}) => {
		// Initial width is 500 → bindable ~500, not narrow.
		await expectWidthNear(page, 'data-bind-width', 500);
		await expect(readout(page)).toHaveAttribute('data-narrow', 'false');
		// A height was measured too (non-empty, positive).
		const h = Number((await readout(page).getAttribute('data-bind-height')) || '0');
		expect(h).toBeGreaterThan(0);
	});

	test('onContainerResize fires with a size and a valid device class', async ({ page }) => {
		await expectWidthNear(page, 'data-cb-width', 500);
		await expect
			.poll(async () => Number((await readout(page).getAttribute('data-cb-count')) || '0'))
			.toBeGreaterThan(0);
		const device = await readout(page).getAttribute('data-cb-device');
		expect(['mobile', 'tablet', 'desktop']).toContain(device);
	});

	test('resizing the container updates BOTH surfaces and flips the derived narrow flag', async ({
		page
	}) => {
		const before = Number((await readout(page).getAttribute('data-cb-count')) || '0');

		// Shrink below the 400px threshold → narrow = true, both widths track ~300.
		await page.getByTestId('w-300').click();
		await expectWidthNear(page, 'data-bind-width', 300);
		await expectWidthNear(page, 'data-cb-width', 300);
		await expect(readout(page)).toHaveAttribute('data-narrow', 'true');

		// Grow back above the threshold → narrow = false, widths track ~700.
		await page.getByTestId('w-700').click();
		await expectWidthNear(page, 'data-bind-width', 700);
		await expect(readout(page)).toHaveAttribute('data-narrow', 'false');

		// The callback fired again for each real change (throttled, so ≥ +1, not per-frame).
		await expect
			.poll(async () => Number((await readout(page).getAttribute('data-cb-count')) || '0'))
			.toBeGreaterThan(before);
	});
});
