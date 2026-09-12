import { test, expect, Page } from '@playwright/test';

/**
 * The disclosure toggle is ONE mask-image glyph read from ONE variable set
 * (--stv-icon-expand / --stv-icon-collapse + rotation), and `iconSet` just
 * re-points those variables (via data-icon-set on .stv__container) — it is NOT
 * four parallel families of CSS classes. These verify each set resolves the
 * expected glyph + rotation, that the default chains to --base-icon-chevron, that
 * swap mode flips the pictured glyph, and that switching iconSet at runtime
 * re-points the variables reactively.
 *
 * Fixture: src/routes/test/icon-set/+page.svelte
 */

const container = (page: Page, id: string) =>
	page.locator(`[data-testid="${id}"] .stv__container`);

// --stv-* are declared on .stv__container and inherit, so reading them off the
// container is the most structure-independent probe of the resolved chain.
function iconVar(page: Page, id: string, name: string) {
	return container(page, id).evaluate(
		(el, v) => getComputedStyle(el).getPropertyValue(v).trim(),
		name
	);
}

// Resolved mask-image of the (expanded) disclosure toggle's ::before.
function toggleMask(page: Page, id: string) {
	return container(page, id).evaluate((el) => {
		const toggle =
			el.querySelector('.stv__toggle-icon--expand.expanded') ??
			el.querySelector('.stv__toggle-icon--expand');
		return getComputedStyle(toggle as Element, '::before').maskImage;
	});
}

test.describe('iconSet', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/test/icon-set');
		await page.waitForLoadState('networkidle');
		await expect(container(page, 'tree-chevron').locator('.stv__toggle-icon--expand').first()).toBeVisible();
	});

	test('default set = chevron, chained to --base-icon-chevron', async ({ page }) => {
		const glyph = await iconVar(page, 'tree-chevron', '--stv-icon-expand');
		expect(glyph).toContain('data:image/svg');
		expect(glyph).toContain('9 18 6-6-6-6'); // Lucide chevron path
		// Right-pointing chevron: no collapsed rotation, 90° when expanded.
		expect(await iconVar(page, 'tree-chevron', '--stv-icon-rotate-collapsed')).toBe('0deg');
		expect(await iconVar(page, 'tree-chevron', '--stv-icon-rotate-expanded')).toBe('90deg');
		// The glyph actually renders (mask resolved, not none).
		expect(await toggleMask(page, 'tree-chevron')).not.toBe('none');
	});

	test('iconSet="triangle" re-points to a down-caret with a -90° collapsed offset', async ({ page }) => {
		const glyph = await iconVar(page, 'tree-triangle', '--stv-icon-expand');
		expect(glyph).toContain('M12 15 6 9h12z'); // caret-down fallback
		// A down-pointing caret must rotate -90° to read as "collapsed" (points right).
		expect(await iconVar(page, 'tree-triangle', '--stv-icon-rotate-collapsed')).toBe('-90deg');
		expect(await iconVar(page, 'tree-triangle', '--stv-icon-rotate-expanded')).toBe('0deg');
	});

	test('iconSet="plus-minus" is a swap set: distinct + / − glyphs, no rotation', async ({ page }) => {
		const expand = await iconVar(page, 'tree-plus-minus', '--stv-icon-expand');
		const collapse = await iconVar(page, 'tree-plus-minus', '--stv-icon-collapse');
		expect(expand).toContain('M12 5v14'); // plus has the vertical stroke
		expect(collapse).not.toContain('M12 5v14'); // minus does not
		expect(expand).not.toBe(collapse);
		expect(await iconVar(page, 'tree-plus-minus', '--stv-icon-rotate-collapsed')).toBe('0deg');
		expect(await iconVar(page, 'tree-plus-minus', '--stv-icon-rotate-expanded')).toBe('0deg');
		// Expanded row shows the collapse (minus) glyph — forced swap regardless of mode.
		expect(await toggleMask(page, 'tree-plus-minus')).not.toContain('M12 5v14');
	});

	test('iconSet="arrow" points right and rotates 90° when expanded', async ({ page }) => {
		const glyph = await iconVar(page, 'tree-arrow', '--stv-icon-expand');
		expect(glyph).toContain('M5 12h14'); // arrow shaft
		expect(await iconVar(page, 'tree-arrow', '--stv-icon-rotate-collapsed')).toBe('0deg');
		expect(await iconVar(page, 'tree-arrow', '--stv-icon-rotate-expanded')).toBe('90deg');
	});

	test('toggleIconMode="swap" flips the expanded glyph to the collapse chevron', async ({ page }) => {
		await expect(container(page, 'tree-swap')).toHaveAttribute('data-toggle-icon-mode', 'swap');
		// Expanded row renders the collapse glyph (chevron-down) rather than rotating.
		expect(await toggleMask(page, 'tree-swap')).toContain('6 9 6 6 6-6');
	});

	test('--base-icon-chevron override re-skins the default set through the ancestor', async ({ page }) => {
		expect(await iconVar(page, 'tree-base-icon', '--stv-icon-expand')).toContain('sentinel.test/chevron.svg');
	});

	test('switching iconSet at runtime re-points the variables reactively', async ({ page }) => {
		// Starts as chevron.
		await expect(container(page, 'tree-live')).toHaveAttribute('data-icon-set', 'chevron');
		expect(await iconVar(page, 'tree-live', '--stv-icon-rotate-collapsed')).toBe('0deg');
		// Switch to triangle → data-icon-set + the down-caret's -90° offset follow.
		await page.getByTestId('live-triangle').click();
		await expect(container(page, 'tree-live')).toHaveAttribute('data-icon-set', 'triangle');
		expect(await iconVar(page, 'tree-live', '--stv-icon-rotate-collapsed')).toBe('-90deg');
	});
});
