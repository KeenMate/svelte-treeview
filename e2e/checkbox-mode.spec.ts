import { test, expect, Page, Locator } from '@playwright/test';

/**
 * Regression for switching checkboxMode at runtime on /test/checkbox-mode.
 *
 * Bug: in cascade mode a partially-selected parent renders indeterminate ([-]).
 * Switching to independent left it stuck at [-] — the checkbox's `indeterminate`
 * DOM property is set imperatively and was never rewritten (no re-render on the
 * mode change). Rule: switching to independent promotes an indeterminate node to
 * fully CHECKED. This spec asserts the parent leaves [-] and lands checked.
 */

const PAGE = '/test/checkbox-mode';

function tree(page: Page) {
	return page.locator('.stv__container').first();
}
function checkboxInput(page: Page, path: string): Locator {
	return tree(page).locator(`.stv__node[data-tree-path="${path}"] > .stv__node-row .stv__checkbox input`).first();
}
function checkboxLabel(page: Page, path: string): Locator {
	return tree(page).locator(`.stv__node[data-tree-path="${path}"] > .stv__node-row .stv__checkbox`).first();
}
function isIndeterminate(input: Locator): Promise<boolean> {
	return input.evaluate((el) => (el as HTMLInputElement).indeterminate);
}

test.describe('Checkbox mode switch', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(PAGE);
		await page.waitForLoadState('networkidle');
		await page.locator('h1').first().waitFor();
		await expect(page.getByTestId('mode')).toHaveText('cascade');
	});

	test('indeterminate parent becomes CHECKED (not stuck at [-]) when switching cascade → independent', async ({ page }) => {
		// Cascade: check one child of Documents (1) so the parent goes indeterminate.
		await checkboxLabel(page, '1.1').click();

		// Parent (path 1) is indeterminate, not checked.
		await expect.poll(() => isIndeterminate(checkboxInput(page, '1'))).toBe(true);
		await expect(checkboxInput(page, '1')).not.toBeChecked();

		// Switch to independent mode.
		await page.getByTestId('mode-independent').click();
		await expect(page.getByTestId('mode')).toHaveText('independent');

		// The parent must LEAVE the indeterminate state and land fully checked.
		await expect.poll(() => isIndeterminate(checkboxInput(page, '1'))).toBe(false);
		await expect(checkboxInput(page, '1')).toBeChecked();

		// And its path is now in the checkbox selection set.
		await expect(page.getByTestId('selection')).toContainText('1');
		// The still-checked child stays checked.
		await expect(checkboxInput(page, '1.1')).toBeChecked();
		// The untouched sibling stays unchecked and not indeterminate.
		await expect(checkboxInput(page, '1.2')).not.toBeChecked();
		await expect.poll(() => isIndeterminate(checkboxInput(page, '1.2'))).toBe(false);
	});

	test('switching independent → cascade re-derives the parent dash', async ({ page }) => {
		// Move to independent first, check only one child.
		await page.getByTestId('mode-independent').click();
		await checkboxLabel(page, '1.1').click();

		// Independent: parent stays unchecked, no dash.
		await expect(checkboxInput(page, '1')).not.toBeChecked();
		await expect.poll(() => isIndeterminate(checkboxInput(page, '1'))).toBe(false);

		// Switch to cascade — parent should now show indeterminate from its one checked child.
		await page.getByTestId('mode-cascade').click();
		await expect(page.getByTestId('mode')).toHaveText('cascade');
		await expect.poll(() => isIndeterminate(checkboxInput(page, '1'))).toBe(true);
	});
});
