import { test, expect, Page } from '@playwright/test';

/**
 * E2E for the rc12+ clipboard data-flow on /test/clipboard-transform:
 *   - nodeInputTransformationCallback: per-node ids/names + return null to SKIP
 *   - nodeOutputTransformationCallback: redact data at snapshot time
 *   - leaf-aware paste position (paste onto a file → siblings, via allowedDropPositions)
 *   - per-entry self-paste skip + PasteResult.skipped (no silent all-or-nothing)
 *   - Delete with a "node has subnodes" guard + warning
 */

const PAGE = '/test/clipboard-transform';

function tree(page: Page) {
	return page.locator('.stv__container').first();
}
function nodeByName(page: Page, name: string) {
	return tree(page).locator(`[data-name="${name}"]`).first();
}
function countByName(page: Page, name: string) {
	return tree(page).locator(`[data-name="${name}"]`).count();
}
async function clickNode(page: Page, name: string) {
	await nodeByName(page, name).click();
	await tree(page).focus();
}

test.describe('Clipboard transform (rc12 data-flow)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(PAGE);
		await page.waitForLoadState('networkidle');
		await page.locator('h1').first().waitFor();
	});

	test('nodeOutputTransformationCallback redacts data before it hits the clipboard', async ({
		page
	}) => {
		// a1.txt carries secret="top". Copy it, paste under Folder B.
		await clickNode(page, 'a1.txt');
		await page.keyboard.press('Control+c');
		await clickNode(page, 'Folder B');
		await page.keyboard.press('Control+v');
		await expect(page.getByTestId('last-log')).toHaveText('pasted 1 skipped 0');

		// The pasted copy is redacted; the original is untouched.
		await expect
			.poll(() => tree(page).locator('[data-name="a1.txt"][data-secret="REDACTED"]').count())
			.toBe(1);
		await expect(tree(page).locator('[data-name="a1.txt"][data-secret="top"]')).toHaveCount(1);
	});

	test('nodeInputTransformationCallback returning null skips that node (skipped count)', async ({
		page
	}) => {
		// Multi-select a1.txt + locked.txt (the transform returns null for locked.txt).
		await nodeByName(page, 'a1.txt').click();
		await nodeByName(page, 'locked.txt').click({ modifiers: ['Control'] });
		await tree(page).focus();
		await page.keyboard.press('Control+c');

		await clickNode(page, 'Folder B');
		await page.keyboard.press('Control+v');

		await expect(page.getByTestId('paste-count')).toHaveText('1');
		await expect(page.getByTestId('paste-skipped')).toHaveText('1');
		// locked.txt still exists only at its original spot — it was not pasted.
		await expect.poll(() => countByName(page, 'locked.txt')).toBe(1);
		await expect.poll(() => countByName(page, 'a1.txt')).toBe(2);
	});

	test('parent + its own child: self-paste guard skips the parent, pastes the child (no silent total failure)', async ({
		page
	}) => {
		const before = await tree(page).locator('.stv__node-content').count();
		// Select Folder A + a1.txt (its child), then paste-in-place onto a1.txt.
		// a1.txt is a leaf → paste redirects into Folder A; Folder A is then a self-paste
		// (skip), a1.txt pastes as a "Copy 1" sibling. The whole batch is NOT rejected.
		await nodeByName(page, 'Folder A').click();
		await nodeByName(page, 'a1.txt').click({ modifiers: ['Control'] });
		await tree(page).focus();
		await page.keyboard.press('Control+c');
		await clickNode(page, 'a1.txt');
		await page.keyboard.press('Control+v');

		await expect(page.getByTestId('paste-count')).toHaveText('1');
		await expect(page.getByTestId('paste-skipped')).toHaveText('1');
		// Folder A was not duplicated; a1.txt Copy 1 landed inside it.
		await expect(countByName(page, 'Folder A')).resolves.toBe(1);
		await expect.poll(() => countByName(page, 'a1.txt Copy 1')).toBe(1);
		// Exactly one node added overall.
		await expect.poll(() => tree(page).locator('.stv__node-content').count()).toBe(before + 1);
	});

	test('leaf-aware paste: pasting onto a file lands the copy as a sibling, not nested inside it', async ({
		page
	}) => {
		// Copy a1.txt, focus b1.txt (a file = leaf, path 2.1), paste. The copy must land
		// under Folder B (b1.txt's parent), NOT inside b1.txt.
		await clickNode(page, 'a1.txt');
		await page.keyboard.press('Control+c');
		await clickNode(page, 'b1.txt');
		await page.keyboard.press('Control+v');
		await expect(page.getByTestId('last-log')).toHaveText('pasted 1 skipped 0');

		await expect.poll(() => countByName(page, 'a1.txt')).toBe(2);
		// Nothing got nested under b1.txt (path 2.1.*).
		await expect(tree(page).locator('[data-path^="2.1."]')).toHaveCount(0);
	});

	test('repeated pastes via the transform number sequentially (Copy 1/2/3) with no compounding', async ({
		page
	}) => {
		await clickNode(page, 'a1.txt');
		await page.keyboard.press('Control+c');
		await clickNode(page, 'Folder A');
		for (let i = 0; i < 3; i++) await page.keyboard.press('Control+v');

		await expect.poll(() => countByName(page, 'a1.txt Copy 1')).toBe(1);
		await expect(countByName(page, 'a1.txt Copy 2')).resolves.toBe(1);
		await expect(countByName(page, 'a1.txt Copy 3')).resolves.toBe(1);
		await expect(countByName(page, 'a1.txt Copy 1 Copy 1')).resolves.toBe(0);
	});

	test('Delete removes a leaf', async ({ page }) => {
		expect(await countByName(page, 'a2.txt')).toBe(1);
		await clickNode(page, 'a2.txt');
		await page.keyboard.press('Delete');
		await expect.poll(() => countByName(page, 'a2.txt')).toBe(0);
	});

	test('Delete is blocked for a node with subnodes, with a warning', async ({ page }) => {
		await clickNode(page, 'Folder A');
		await page.keyboard.press('Delete');
		await expect(page.getByTestId('delete-warning')).toHaveText(
			'Cannot delete 1 node(s) with subnodes'
		);
		// Folder A is still there.
		await expect(countByName(page, 'Folder A')).resolves.toBe(1);
	});

	test('Delete on a mixed selection removes the leaf and skips the folder', async ({ page }) => {
		await nodeByName(page, 'a2.txt').click();
		await nodeByName(page, 'Folder B').click({ modifiers: ['Control'] });
		await tree(page).focus();
		await page.keyboard.press('Delete');
		await expect(page.getByTestId('last-log')).toHaveText('deleted 1 blocked 1');
		await expect.poll(() => countByName(page, 'a2.txt')).toBe(0);
		await expect(countByName(page, 'Folder B')).resolves.toBe(1);
	});
});
