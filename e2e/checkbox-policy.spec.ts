import { test, expect, Page, Locator } from '@playwright/test';

/**
 * cascadeSelectPolicy on /test/checkbox-policy — the value policy that controls
 * WHICH paths the checkbox selection emits (via bindable selectedPaths) in cascade
 * mode. Orthogonal to checkboxMode (which controls the cascade BEHAVIOUR).
 *
 * Fixture tree: Fruits (1) → Apple (1.1), Banana (1.2); Vegetables (2) → Carrot
 * (2.1), Potato (2.2). Scenario: check Fruits fully + Carrot only, so the canonical
 * checked set is {1, 1.1, 1.2, 2.1}. The three policies project it differently:
 *   rolled-up → 1, 2.1
 *   leaves    → 1.1, 1.2, 2.1
 *   all       → 1, 1.1, 1.2, 2.1
 */

const PAGE = '/test/checkbox-policy';

function tree(page: Page) {
	return page.locator('.stv__container').first();
}
function checkboxLabel(page: Page, path: string): Locator {
	return tree(page)
		.locator(`.stv__node[data-tree-path="${path}"] > .stv__node-row .stv__checkbox`)
		.first();
}
function selection(page: Page) {
	return page.getByTestId('selection');
}

async function buildScenario(page: Page) {
	// Cascade-check Fruits (fills 1, 1.1, 1.2) then Carrot only (2.1).
	await checkboxLabel(page, '1').click();
	await checkboxLabel(page, '2.1').click();
}

test.describe('Cascade select policy', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(PAGE);
		await page.waitForLoadState('networkidle');
		await page.locator('h1').first().waitFor();
		await expect(page.getByTestId('policy')).toHaveText('rolled-up');
	});

	test('default policy is rolled-up (fully-checked subtree collapses to root)', async ({
		page
	}) => {
		await buildScenario(page);
		// rolled-up: Fruits collapses to 1; partial Vegetables emits only Carrot.
		await expect(selection(page)).toHaveText('1,2.1');
	});

	test('leaves policy emits only checked leaf nodes', async ({ page }) => {
		await buildScenario(page);
		await page.getByTestId('policy-leaves').click();
		await expect(page.getByTestId('policy')).toHaveText('leaves');
		await expect(selection(page)).toHaveText('1.1,1.2,2.1');
	});

	test('all policy emits every fully-checked node (branches + leaves)', async ({ page }) => {
		await buildScenario(page);
		await page.getByTestId('policy-all').click();
		await expect(page.getByTestId('policy')).toHaveText('all');
		await expect(selection(page)).toHaveText('1,1.1,1.2,2.1');
	});

	test('switching policy live re-projects the SAME checked state', async ({ page }) => {
		await buildScenario(page);
		// Start rolled-up.
		await expect(selection(page)).toHaveText('1,2.1');
		// → all
		await page.getByTestId('policy-all').click();
		await expect(selection(page)).toHaveText('1,1.1,1.2,2.1');
		// → leaves
		await page.getByTestId('policy-leaves').click();
		await expect(selection(page)).toHaveText('1.1,1.2,2.1');
		// → back to rolled-up, identical to the start (no state lost in the round-trip).
		await page.getByTestId('policy-rolled-up').click();
		await expect(selection(page)).toHaveText('1,2.1');
	});

	test('unchecking clears the emitted selection under every policy', async ({ page }) => {
		await buildScenario(page);
		await page.getByTestId('policy-leaves').click();
		await expect(selection(page)).toHaveText('1.1,1.2,2.1');
		// Uncheck Fruits (cascade removes 1, 1.1, 1.2) — only Carrot leaf remains.
		await checkboxLabel(page, '1').click();
		await expect(selection(page)).toHaveText('2.1');
		// Uncheck Carrot — empty under leaves.
		await checkboxLabel(page, '2.1').click();
		await expect(selection(page)).toHaveText('(empty)');
	});
});
