import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for /test/theming. Each card uses the same Debug brand theme;
 * the scenarios differ only in WHICH dark-mode signal is applied. The Debug
 * theme's colors are stark on purpose:
 *
 *   Light: --base-main-bg = #dc2626 (red),  --base-accent-color = #fbbf24 (yellow)
 *   Dark:  --base-main-bg = #16a34a (green), --base-accent-color = #06b6d4 (cyan)
 *
 * A green tree surface under a dark-signal scenario proves the brand theme's
 * dark variant reaches the tree's --ltree-bg. A red surface proves the light
 * path. Anything else (e.g. library-default #1a1a1a) means the theme's
 * dark variant didn't actually win — the regression we want to catch.
 */

const PAGE = '/test/theming';

// Debug theme color literals — keep in sync with /test/theming/+page.svelte.
const LIGHT = {
	bg: 'rgb(220, 38, 38)',     // #dc2626 red
	text: 'rgb(255, 255, 255)', // #ffffff white
	border: 'rgb(0, 0, 0)'      // #000000 black
};
const DARK = {
	bg: 'rgb(22, 163, 74)',     // #16a34a green
	text: 'rgb(255, 255, 255)', // #ffffff white
	border: 'rgb(255, 255, 255)' // #ffffff white
};

function scenarioCard(page: Page, scenario: string): Locator {
	return page.locator(`.card[data-scenario="${scenario}"]`);
}

function ltreeContainer(card: Locator): Locator {
	return card.locator('.ltree-container').first();
}

async function backgroundColor(loc: Locator): Promise<string> {
	return loc.evaluate((el) => getComputedStyle(el).backgroundColor);
}

async function color(loc: Locator): Promise<string> {
	return loc.evaluate((el) => getComputedStyle(el).color);
}

// ── Tests ───────────────────────────────────────────────────────────────────

test.describe('Theming — Debug brand theme across all dark-mode signals', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(PAGE);
		// Wait for any first-render effects to settle.
		await page.locator('h1').first().waitFor();
	});

	test('1. No signal → tree surface is RED (light)', async ({ page }) => {
		const tree = ltreeContainer(scenarioCard(page, 'baseline-light'));
		expect(await backgroundColor(tree)).toBe(LIGHT.bg);
		expect(await color(tree)).toBe(LIGHT.text);
	});

	test('2. Per-instance theme="dark" → tree surface is GREEN (dark)', async ({ page }) => {
		const tree = ltreeContainer(scenarioCard(page, 'per-instance-dark'));
		expect(await backgroundColor(tree)).toBe(DARK.bg);
		expect(await color(tree)).toBe(DARK.text);
		// Per-instance prop is forwarded as the attribute the library reads.
		await expect(tree).toHaveAttribute('data-theme', 'dark');
	});

	test('3. Per-instance theme="light" → tree surface is RED (light)', async ({ page }) => {
		const tree = ltreeContainer(scenarioCard(page, 'per-instance-light'));
		expect(await backgroundColor(tree)).toBe(LIGHT.bg);
		expect(await color(tree)).toBe(LIGHT.text);
		await expect(tree).toHaveAttribute('data-theme', 'light');
	});

	test('4. Ancestor [data-theme="dark"] → tree surface is GREEN (dark)', async ({ page }) => {
		const tree = ltreeContainer(scenarioCard(page, 'ancestor-data-theme-dark'));
		expect(await backgroundColor(tree)).toBe(DARK.bg);
		expect(await color(tree)).toBe(DARK.text);
	});

	test('5. Ancestor [data-bs-theme="dark"] → tree surface is GREEN (dark)', async ({ page }) => {
		const tree = ltreeContainer(scenarioCard(page, 'ancestor-data-bs-theme-dark'));
		expect(await backgroundColor(tree)).toBe(DARK.bg);
		expect(await color(tree)).toBe(DARK.text);
	});

	test('6. Ancestor .dark (Tailwind) → tree surface is GREEN (dark)', async ({ page }) => {
		const tree = ltreeContainer(scenarioCard(page, 'ancestor-dark-class'));
		expect(await backgroundColor(tree)).toBe(DARK.bg);
		expect(await color(tree)).toBe(DARK.text);
	});

	test('7. Page color-scheme=dark flips light-dark()-aware values to GREEN', async ({ page }) => {
		// Set color-scheme directly on <html> via evaluate (bypassing the radio +
		// $effect chain, which races the assertion under parallel-test load).
		await page.evaluate(() => { document.documentElement.style.colorScheme = 'dark'; });
		const tree = ltreeContainer(scenarioCard(page, 'baseline-light'));
		// Force a style recalc so the new color-scheme is reflected immediately.
		await tree.evaluate((el) => void el.getBoundingClientRect());
		await expect.poll(() => backgroundColor(tree), { timeout: 5000 }).toBe(DARK.bg);
		expect(await color(tree)).toBe(DARK.text);
	});

	test('8. OS prefers-color-scheme=dark flips light-dark()-aware values to GREEN', async ({ browser }) => {
		const context = await browser.newContext({ colorScheme: 'dark' });
		const page = await context.newPage();
		await page.goto(PAGE);
		await page.locator('h1').first().waitFor();
		const tree = ltreeContainer(scenarioCard(page, 'baseline-light'));
		expect(await backgroundColor(tree)).toBe(DARK.bg);
		expect(await color(tree)).toBe(DARK.text);
		await context.close();
	});
});
