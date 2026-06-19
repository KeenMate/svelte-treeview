import { test, expect } from '@playwright/test';

// Regression: bidirectional bind on focusedNode used to route the value through
// the parent's $state proxy, deep-cloning the node into a separate reactive
// reference. _setFocusedNode then mutated the clone, leaving the canonical
// tree node's isFocused = true. Visible as both anchor and clicked node showing
// the focusedNodeClass after a Shift+click range.
test('shift+click range only marks the clicked node as focused (not the anchor)', async ({ page }) => {
	await page.goto('/examples/interaction');
	await page.waitForLoadState('networkidle');

	const checkboxToggle = page.locator('label', { hasText: 'Show Checkboxes' }).locator('input');
	if (!(await checkboxToggle.isChecked())) {
		await checkboxToggle.check();
	}

	await page.getByLabel('Focused Style:').selectOption('demo-focused-outline');

	await page.waitForSelector('.stv__node-content', { timeout: 5000 });

	const firstTree = page.locator('.tree-container').first();
	const nodes = firstTree.locator('.stv__node-content');

	await nodes.nth(0).click();
	await nodes.nth(2).click({ modifiers: ['Shift'] });

	const focusedCount = await firstTree.locator('.stv__node-content.demo-focused-outline').count();
	const highlightedCount = await firstTree.locator('.stv__node-content.stv__node-content--highlight-bold').count();

	expect(focusedCount, 'Only one node should have focus style after Shift+click range').toBe(1);
	expect(highlightedCount, 'Three nodes should be highlighted in the range').toBeGreaterThanOrEqual(2);
});
