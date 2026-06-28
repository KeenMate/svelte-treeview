import { test, expect, Page } from '@playwright/test';

/**
 * Coverage for the data-driven per-node class hooks nodeClass / nodeContentClass
 * (added v5.0.0-rc13) at /test/node-class. nodeClass lands on .stv__node,
 * nodeContentClass on .stv__node-content — both derived from node data.
 */

const node = (page: Page, path: string) => page.locator(`[data-tree-path="${path}"]`);

test.describe('nodeClass / nodeContentClass', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/test/node-class');
		await page.waitForLoadState('networkidle');
		await expect(node(page, '1')).toBeVisible();
	});

	test('nodeClass lands on .stv__node, derived from data', async ({ page }) => {
		await expect(node(page, '1')).toHaveClass(/kind-folder/); // Root
		await expect(node(page, '1.1')).toHaveClass(/kind-folder/); // Folder-A
		await expect(node(page, '1.2')).toHaveClass(/kind-file/); // File-A
		await expect(node(page, '1.3')).toHaveClass(/kind-file/); // File-B
	});

	test('nodeContentClass lands on .stv__node-content, only for files', async ({ page }) => {
		await expect(node(page, '1.2').locator('.stv__node-content')).toHaveClass(/is-file-content/);
		await expect(node(page, '1.1').locator('.stv__node-content')).not.toHaveClass(/is-file-content/);
	});

	test('the classes are stylable from app CSS', async ({ page }) => {
		// kind-file → tomato outline; kind-folder → royalblue.
		const fileOutline = await node(page, '1.2').evaluate((el) => getComputedStyle(el).outlineColor);
		const folderOutline = await node(page, '1.1').evaluate((el) => getComputedStyle(el).outlineColor);
		expect(fileOutline).toBe('rgb(255, 99, 71)'); // tomato
		expect(folderOutline).toBe('rgb(65, 105, 225)'); // royalblue
	});
});
