import { test, expect, Page } from '@playwright/test';

/**
 * Regression coverage for the BRAND themes in the /examples/theming "Dark Mode
 * Playground". The sibling spec theming.spec.ts exercises the library's dark-mode
 * SIGNAL precedence with a synthetic Debug theme; it never touches the real brand
 * themes (Material, Glass, Soft, Forest, Neon, Sharp), which are demo-page CSS.
 *
 * The bug this guards: the generic playground surface rules
 *   :global(.playground-wrapper:has(.stv__container[data-theme='light'])) { background:#f9fafb }
 * carried specificity (0,3,0) — higher than a brand theme's base rule (0,2,0) — so
 * selecting per-instance theme="light" reverted the wrapper to plain gray and
 * wiped the brand surface. Glass was worst hit: white text on a now-white surface
 * (invisible labels). The fix scopes those generic :has() rules to .brand-default.
 *
 * Invariant asserted here: a gradient-based brand theme keeps a gradient surface
 * on its wrapper in ALL three per-instance modes (inherit / dark / light) — never
 * the generic gray solid that signals "brand surface got clobbered".
 */

// Brand themes whose wrapper surface is a gradient in every mode.
const GRADIENT_BRANDS = ['material', 'neon', 'soft', 'glass', 'forest'] as const;

// Brand radios live in the 4th fieldset of .playground-controls; their `value`
// (default/material/glass/…) is unique within the control panel, so a value
// selector is unambiguous (unlike accessible-name matching, which is brittle here).
async function selectBrand(page: Page, brand: string) {
	const radio = page.locator(`.playground-controls input[value="${brand}"]`);
	const wrapper = page.locator('.playground-wrapper').first();
	// Retry the click until the wrapper class updates: a click that lands before
	// Svelte hydration attaches bind:group toggles the native radio without
	// updating brandTheme. Use click() (not check(), which Playwright skips once
	// the radio is natively "checked") so each retry re-fires change until the
	// bind is live.
	await expect(async () => {
		await radio.click();
		await expect(wrapper).toHaveClass(new RegExp(`brand-${brand}\\b`), { timeout: 1000 });
	}).toPass({ timeout: 10000 });
}

// Per-instance theme radios are the 3rd fieldset (values none/dark/light). Scope
// to that fieldset since "dark"/"light" also appear in the page-scheme fieldset.
async function selectInstanceMode(page: Page, mode: 'inherit' | 'dark' | 'light') {
	const value = mode === 'inherit' ? 'none' : mode;
	await page
		.locator('.playground-controls fieldset', { hasText: 'Per-instance' })
		.locator(`input[value="${value}"]`)
		.check();
}

async function wrapperBackgroundImage(page: Page): Promise<string> {
	return page.locator('.playground-wrapper').first().evaluate(
		(el) => getComputedStyle(el).backgroundImage
	);
}

test.describe('Theming — brand themes survive every per-instance mode', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/examples/theming');
		// networkidle ensures Svelte hydration has finished before we click radios —
		// a click that lands pre-hydration toggles the native input without updating
		// the bound state.
		await page.waitForLoadState('networkidle');
		await page.locator('h1').first().waitFor();
	});

	for (const brand of GRADIENT_BRANDS) {
		test(`${brand}: wrapper keeps a gradient surface in inherit / dark / light`, async ({ page }) => {
			await selectBrand(page, brand);

			for (const mode of ['inherit', 'dark', 'light'] as const) {
				await selectInstanceMode(page, mode);
				await expect
					.poll(() => wrapperBackgroundImage(page), {
						message: `brand=${brand} mode=${mode} should keep a gradient surface`,
						timeout: 5000
					})
					.toContain('linear-gradient');
			}
		});
	}

	test('glass: light mode renders the purple gradient, not the generic gray', async ({ page }) => {
		await selectBrand(page, 'glass');
		await selectInstanceMode(page, 'light');
		// Glass light surface starts at #667eea = rgb(102, 126, 234).
		await expect
			.poll(() => wrapperBackgroundImage(page), { timeout: 5000 })
			.toContain('rgb(102, 126, 234)');
	});
});
