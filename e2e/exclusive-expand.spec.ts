import { test, expect } from '@playwright/test';

/**
 * Regression: an API call to `expandNodes(path, { exclusive: true })` must
 * collapse off-spine branches *visually*, including flipping their toggle
 * icon back to the collapsed state. A pure data-only mutation that leaves the
 * toggle UI showing the previous expanded chevron is a bug — the user
 * couldn't tell whether the branch is open or closed.
 *
 * Fixture (/test/exclusive-expand): three siblings A1, A2, A3 collapsed at
 * expandLevel=0. Spec expands A3 by clicking its toggle, then triggers
 * exclusive-expand on A2 via a UI button → A3's toggle must lose the
 * `.expanded` modifier class (default toggleIconMode='rotate'), and A3's
 * children must leave the DOM.
 */

test('exclusive expand of A2 collapses previously-expanded A3 in the UI', async ({ page }) => {
	await page.goto('/test/exclusive-expand');
	await expect(page.locator('.stv__node').first()).toBeVisible();

	// Sanity: collapsed initially.
	const a3 = page.locator('.stv__node[data-tree-path="3"]').first();
	const a3Toggle = a3.locator('> .stv__node-row .stv__toggle-icon').first();
	await expect(a3Toggle).not.toHaveClass(/(?:^|\s)expanded(?:\s|$)/);
	await expect(page.locator('.stv__node[data-tree-path="3.1"]')).toHaveCount(0);

	// Expand A3 by clicking its toggle.
	await a3Toggle.click();
	await expect(a3Toggle).toHaveClass(/(?:^|\s)expanded(?:\s|$)/);
	await expect(page.locator('.stv__node[data-tree-path="3.1"]').first()).toBeVisible();
	await expect(page.locator('.stv__node[data-tree-path="3.2"]').first()).toBeVisible();

	// Trigger the API call: expandNodes('2', { exclusive: true }).
	await page.getByTestId('exclusive-expand-a2').click();

	// A2 should now be expanded, A3's children gone, A3's toggle no longer
	// flagged expanded.
	const a2 = page.locator('.stv__node[data-tree-path="2"]').first();
	const a2Toggle = a2.locator('> .stv__node-row .stv__toggle-icon').first();
	await expect(a2Toggle).toHaveClass(/(?:^|\s)expanded(?:\s|$)/);
	await expect(page.locator('.stv__node[data-tree-path="2.1"]').first()).toBeVisible();

	// The critical assertion: A3's toggle UI must reflect the data change.
	await expect(a3Toggle).not.toHaveClass(/(?:^|\s)expanded(?:\s|$)/);
	await expect(page.locator('.stv__node[data-tree-path="3.1"]')).toHaveCount(0);
	await expect(page.locator('.stv__node[data-tree-path="3.2"]')).toHaveCount(0);
});
