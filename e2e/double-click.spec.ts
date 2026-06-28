import { test, expect, Page } from '@playwright/test';

/**
 * Coverage for the onNodeDoubleClick event (added v5.0.0-rc13) at /test/double-click.
 *
 * Detection is manual on the controller (the browser's native dblclick can't be
 * trusted in flat mode — the first click bumps node._rev → the row is recreated),
 * so we exercise it with two quick re-resolved clicks rather than .dblclick():
 * each click re-queries the locator, surviving the row re-render, and they land
 * well within the 400ms double-click window.
 */

const content = (page: Page, section: string, path: string) =>
	page.locator(`[data-testid="${section}"] [data-tree-path="${path}"] .stv__node-content`);

async function doubleClick(page: Page, section: string, path: string) {
	const loc = content(page, section, path);
	await loc.click();
	await loc.click();
}

const dblCount = (page: Page) => page.getByTestId('dbl-count');
const dblLog = (page: Page) => page.getByTestId('dbl-log');
const clickCount = (page: Page) => page.getByTestId('click-count');

test.describe('onNodeDoubleClick event', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/test/double-click');
		await page.waitForLoadState('networkidle');
	});

	test('fires in clickBehavior="select" and expands the node', async ({ page }) => {
		// Beta (1.2) is collapsed at expandLevel=1; its child isn't rendered yet.
		await expect(content(page, 'select', '1.2.1')).toHaveCount(0);

		await doubleClick(page, 'select', '1.2');

		await expect(dblCount(page)).toHaveText('1');
		await expect(dblLog(page)).toHaveText('Beta');
		// Built-in select-mode behaviour: double-click expanded it.
		await expect(content(page, 'select', '1.2.1')).toBeVisible();
		// The 2nd click is consumed as the double — only the 1st fired onNodeClick.
		await expect(clickCount(page)).toHaveText('1');
	});

	test('fires in the default clickBehavior="expand-and-focus" too', async ({ page }) => {
		await doubleClick(page, 'expand', '1.2');
		await expect(dblCount(page)).toHaveText('1');
		await expect(dblLog(page)).toHaveText('Beta');
	});

	test('a single click does not fire onNodeDoubleClick', async ({ page }) => {
		await content(page, 'select', '1.1').click(); // Alpha, a single click
		await expect(clickCount(page)).toHaveText('1');
		await expect(dblCount(page)).toHaveText('0');
	});

	test('two clicks on different nodes are not a double-click', async ({ page }) => {
		await content(page, 'select', '1.1').click(); // Alpha
		await content(page, 'select', '1.2').click(); // Beta
		await expect(dblCount(page)).toHaveText('0');
	});
});
