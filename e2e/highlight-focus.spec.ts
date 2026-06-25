import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for /test/highlight-focus.
 *
 * Two contracts:
 *
 *  1. Highlight-marker FALLBACK. `.stv__node-content--highlighted` ships a
 *     default look so highlight is visible out of the box, but Node.svelte only
 *     applies it when `highlightedNodeClass` is unset. The moment a highlight
 *     class is configured the marker must NOT be on the element — otherwise the
 *     default background fights the configured style (regression that prompted
 *     these tests).
 *
 *  2. Focused-node styling. `.stv__node-content--focused` is a pure hook applied
 *     whenever a node is focused (regardless of focusedNodeClass). The optional
 *     `focusedNodeClass` is additive and lands on exactly the one focused row;
 *     focus is single, so moving focus moves the class.
 *
 * Page data (alpha-sorted by name): '1' Documents, '1.1' Work, '1.2' Personal,
 * '2' Downloads. 1.1/1.2/2 are leaves — clicking them never toggles expand.
 * clickBehavior="select": a plain click focuses + highlights (replace).
 */

const PAGE = '/test/highlight-focus';

const MARKER = 'stv__node-content--highlighted';
const FOCUS_MARKER = 'stv__node-content--focused';
const BOLD = 'stv__node-content--highlight-bold';
const GLOW = 'stv__node-content--highlight-glow';
const FOCUS_CLASS = 'test-focus';

function nodeContent(page: Page, path: string): Locator {
	return page
		.locator(`.stv__node[data-tree-path="${path}"]`)
		.first()
		.locator('> .stv__node-row .stv__node-content')
		.first();
}

async function goto(page: Page) {
	await page.goto(PAGE);
	await expect(page.locator('.stv__node').first()).toBeVisible();
}

// ── Highlight marker fallback ────────────────────────────────────────────────

test.describe('highlight marker fallback', () => {
	test('no highlightedNodeClass: highlighted row gets the fallback marker', async ({ page }) => {
		await goto(page);

		const work = nodeContent(page, '1.1');
		await work.click();

		await expect(page.locator('.output').filter({ hasText: 'Highlighted' }).locator('pre')).toContainText('1.1');
		// Fallback marker present because no class is configured.
		await expect(work).toHaveClass(new RegExp(`\\b${MARKER}\\b`));
	});

	test('highlightedNodeClass="Bold": custom class applied, fallback marker suppressed', async ({ page }) => {
		await goto(page);
		await page.getByLabel('Highlight Class:').selectOption(BOLD);

		const work = nodeContent(page, '1.1');
		await work.click();

		// Custom class is on the row...
		await expect(work).toHaveClass(new RegExp(`\\b${BOLD}\\b`));
		// ...and the fallback marker is NOT — this is the anti-fight contract.
		await expect(work).not.toHaveClass(new RegExp(`\\b${MARKER}\\b`));
	});

	test('highlightedNodeClass="Glow": custom class applied, fallback marker suppressed', async ({ page }) => {
		await goto(page);
		await page.getByLabel('Highlight Class:').selectOption(GLOW);

		const work = nodeContent(page, '1.1');
		await work.click();

		await expect(work).toHaveClass(new RegExp(`\\b${GLOW}\\b`));
		await expect(work).not.toHaveClass(new RegExp(`\\b${MARKER}\\b`));
	});

	test('switching the class back to none restores the fallback marker', async ({ page }) => {
		await goto(page);

		// Start with Bold → no marker.
		await page.getByLabel('Highlight Class:').selectOption(BOLD);
		const work = nodeContent(page, '1.1');
		await work.click();
		await expect(work).not.toHaveClass(new RegExp(`\\b${MARKER}\\b`));

		// Switch back to (none) — the same highlighted row should regain the marker
		// and drop the Bold class.
		await page.getByLabel('Highlight Class:').selectOption('');
		await expect(work).toHaveClass(new RegExp(`\\b${MARKER}\\b`));
		await expect(work).not.toHaveClass(new RegExp(`\\b${BOLD}\\b`));
	});
});

// ── Focused node styling ─────────────────────────────────────────────────────

test.describe('focused node styling', () => {
	test('focus marker hook is applied to the focused row even with no focusedNodeClass', async ({ page }) => {
		await goto(page);

		const work = nodeContent(page, '1.1');
		await work.click();

		await expect(page.locator('.output').filter({ hasText: 'Focused Node' }).locator('pre')).toContainText('Work');
		// Pure hook is always present on the focused row.
		await expect(work).toHaveClass(new RegExp(`\\b${FOCUS_MARKER}\\b`));
		// No custom class configured → it must not appear.
		await expect(work).not.toHaveClass(new RegExp(`\\b${FOCUS_CLASS}\\b`));
	});

	test('focusedNodeClass lands on the focused row', async ({ page }) => {
		await goto(page);
		await page.getByLabel('Focus Class:').selectOption(FOCUS_CLASS);

		const work = nodeContent(page, '1.1');
		await work.click();

		await expect(work).toHaveClass(new RegExp(`\\b${FOCUS_CLASS}\\b`));
		await expect(work).toHaveClass(new RegExp(`\\b${FOCUS_MARKER}\\b`));
	});

	test('focus is single: moving focus moves both the hook and the custom class', async ({ page }) => {
		await goto(page);
		await page.getByLabel('Focus Class:').selectOption(FOCUS_CLASS);

		const work = nodeContent(page, '1.1');
		const personal = nodeContent(page, '1.2');

		await work.click();
		await expect(work).toHaveClass(new RegExp(`\\b${FOCUS_CLASS}\\b`));

		// Focus a different row — the previous one must lose focus styling.
		await personal.click();
		await expect(personal).toHaveClass(new RegExp(`\\b${FOCUS_CLASS}\\b`));
		await expect(personal).toHaveClass(new RegExp(`\\b${FOCUS_MARKER}\\b`));
		await expect(work).not.toHaveClass(new RegExp(`\\b${FOCUS_CLASS}\\b`));
		await expect(work).not.toHaveClass(new RegExp(`\\b${FOCUS_MARKER}\\b`));

		// Exactly one focused row on the page.
		await expect(page.locator(`.${FOCUS_MARKER}`)).toHaveCount(1);
	});

	test('highlight and focus stack independently on the same row', async ({ page }) => {
		await goto(page);
		await page.getByLabel('Highlight Class:').selectOption(BOLD);
		await page.getByLabel('Focus Class:').selectOption(FOCUS_CLASS);

		const work = nodeContent(page, '1.1');
		await work.click();

		// A plain click both highlights and focuses the same row, so both the
		// configured highlight class and the configured focus class coexist —
		// and the fallback marker still stays away.
		await expect(work).toHaveClass(new RegExp(`\\b${BOLD}\\b`));
		await expect(work).toHaveClass(new RegExp(`\\b${FOCUS_CLASS}\\b`));
		await expect(work).not.toHaveClass(new RegExp(`\\b${MARKER}\\b`));
	});
});
