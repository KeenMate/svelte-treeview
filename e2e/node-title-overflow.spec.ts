import { test, expect, Page } from '@playwright/test';

/**
 * Coverage for the nodeTitleOverflow prop (wrap | ellipsis | info) at
 * /test/node-title-overflow. A 240px container clips the long label (path 1.1);
 * the short label (1.2) stays un-clipped so the info affordance is row-specific.
 */

const node = (page: Page, path: string) => page.locator(`[data-tree-path="${path}"]`);
const label = (page: Page, path: string) => node(page, path).locator('.stv__node-label').first();

test.describe('nodeTitleOverflow', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/test/node-title-overflow');
		await page.waitForLoadState('networkidle');
		await expect(node(page, '1.1')).toBeVisible();
	});

	test('wrap (default): label is multi-line, not clipped, no info button', async ({ page }) => {
		const l = label(page, '1.1');
		await expect(l).toHaveCSS('white-space', 'normal');
		// A long label wrapped onto several lines is much taller than one row.
		const h = await l.evaluate((el) => el.clientHeight);
		expect(h).toBeGreaterThan(30);
		await expect(node(page, '1.1').locator('.stv__node-info')).toHaveCount(0);
	});

	test('ellipsis: single-line clip, no info button', async ({ page }) => {
		await page.getByTestId('mode-ellipsis').click();
		const l = label(page, '1.1');
		await expect(l).toHaveCSS('text-overflow', 'ellipsis');
		await expect(l).toHaveCSS('white-space', 'nowrap');
		// The label is actually clipped (content wider than the box).
		const clipped = await l.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
		expect(clipped).toBe(true);
		await expect(node(page, '1.1').locator('.stv__node-info')).toHaveCount(0);
	});

	test('info: ⓘ appears only on the clipped row and reveals the full label', async ({ page }) => {
		await page.getByTestId('mode-info').click();

		// The long row is clipped → info button; the short row is not.
		const info = node(page, '1.1').locator('.stv__node-info');
		await expect(info).toBeVisible();
		await expect(node(page, '1.2').locator('.stv__node-info')).toHaveCount(0);

		// Click reveals the full label in a popover.
		await info.click();
		const reveal = page.locator('.stv__node-info-reveal');
		await expect(reveal).toBeVisible();
		await expect(reveal).toContainText('extremely long node label');

		// Second click on the same button dismisses it.
		await info.click();
		await expect(reveal).toHaveCount(0);
	});

	test('info: clicking the ⓘ does not select the node', async ({ page }) => {
		await page.getByTestId('mode-info').click();
		const info = node(page, '1.1').locator('.stv__node-info');
		await info.click();
		await expect(node(page, '1.1').locator('.stv__node-content--focused')).toHaveCount(0);
		// dismiss so state is clean
		await page.keyboard.press('Escape');
	});
});
