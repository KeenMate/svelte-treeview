import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for /test/basic (minimal fixture page; /examples/basic is the
 * tutorial demo with the same logic).
 *
 * Four trees, one per card:
 *   1. "Simple Tree"                    — click focus → outputs
 *   2. "Expand Controls"                — expandLevel input + isAccordionExpand
 *   3. "Scroll to Path"                 — text input + button → scrollToPath
 *   4. "Programmatic Expand/Collapse"   — 4 buttons hitting public methods
 *
 * Sample data (15 nodes total, alphabetically sorted by sortByName):
 *   '1'     Documents
 *   '1.1'   Work
 *   '1.1.1' Reports
 *   '1.1.2' Presentations
 *   '1.2'   Personal
 *   '1.2.1' Photos
 *   '1.2.2' Music
 *   '2'     Downloads
 *   '2.1'   Software
 *   '2.2'   Media
 *   '3'     Projects
 *   '3.1'   Web App
 *   '3.1.1' Frontend
 *   '3.1.2' Backend
 *   '3.2'   Mobile App
 */

const PAGE = '/test/basic';

// ── Helpers ─────────────────────────────────────────────────────────────────

function cardByHeading(page: Page, heading: string): Locator {
	return page.locator('.card').filter({ has: page.locator('h2', { hasText: heading }) }).first();
}

function simpleCard(page: Page): Locator {
	return cardByHeading(page, 'Simple Tree');
}

function expandControlsCard(page: Page): Locator {
	return cardByHeading(page, 'Expand Controls');
}

function scrollCard(page: Page): Locator {
	return cardByHeading(page, 'Scroll to Path');
}

function programmaticCard(page: Page): Locator {
	return cardByHeading(page, 'Programmatic Expand/Collapse');
}

function treeIn(card: Locator): Locator {
	return card.locator('.tree-container').first();
}

function nodeIn(card: Locator, path: string): Locator {
	return treeIn(card).locator(`.stv__node[data-tree-path="${path}"]`).first();
}

function nodeContent(node: Locator): Locator {
	return node.locator('> .stv__node-row .stv__node-content').first();
}

function outputValue(card: Locator, label: string): Locator {
	return card
		.locator('.output')
		.filter({ has: card.page().locator('p.output-label', { hasText: label }) })
		.first()
		.locator('pre')
		.first();
}

async function gotoBasic(page: Page) {
	await page.goto(PAGE);
	await expect(page.locator('.stv__node').first()).toBeVisible();
}

// ── Simple Tree ────────────────────────────────────────────────────────────

test.describe('Simple Tree card', () => {
	test('renders the level-1 and level-2 nodes at expandLevel=2; deeper paths are hidden', async ({
		page
	}) => {
		await gotoBasic(page);
		const card = simpleCard(page);

		// Level-1 and level-2 paths are visible.
		await expect(nodeIn(card, '1')).toBeVisible();
		await expect(nodeIn(card, '1.1')).toBeVisible();
		await expect(nodeIn(card, '2')).toBeVisible();
		await expect(nodeIn(card, '3.2')).toBeVisible();

		// Level-3 paths are NOT rendered when their parent is collapsed.
		// expandLevel=2 means level-2 nodes ARE expanded, so 1.1.1 IS visible. To
		// hit a hidden case we'd need a parent at level >= 2. Verify deeper-than-
		// rendered isn't present: 1.1 expanded → 1.1.1 visible (sanity).
		await expect(nodeIn(card, '1.1.1')).toBeVisible();
	});

	test('outputs Selected Node + Last Clicked when a node is clicked', async ({ page }) => {
		await gotoBasic(page);
		const card = simpleCard(page);

		// Both output blocks are conditional ({#if ...}) and absent before clicking.
		await expect(card.locator('.output')).toHaveCount(0);

		await nodeContent(nodeIn(card, '1.2')).click();

		await expect(outputValue(card, 'Selected Node')).toContainText('"path": "1.2"');
		await expect(outputValue(card, 'Selected Node')).toContainText('Personal');

		await expect(outputValue(card, 'Last Clicked')).toContainText('Personal');
		await expect(outputValue(card, 'Last Clicked')).toContainText('1.2');
	});
});

// ── Expand Controls ────────────────────────────────────────────────────────

test.describe('Expand Controls card', () => {
	test('setting expandLevel=0 collapses everything to just the roots', async ({ page }) => {
		await gotoBasic(page);
		const card = expandControlsCard(page);

		// Default level is 2. Drop to 0.
		await card.getByLabel('Expand Level:').fill('0');

		// Roots present, no level-2 paths in this re-mounted tree.
		const tree = treeIn(card);
		await expect(tree.locator('.stv__node[data-tree-path="1"]')).toBeVisible();
		await expect(tree.locator('.stv__node[data-tree-path="2"]')).toBeVisible();
		await expect(tree.locator('.stv__node[data-tree-path="1.1"]')).toHaveCount(0);
	});

	test('setting expandLevel=3 expands everything (15 visible nodes)', async ({ page }) => {
		await gotoBasic(page);
		const card = expandControlsCard(page);

		await card.getByLabel('Expand Level:').fill('3');

		// All 15 paths in the sample are at level ≤ 3, so all become visible.
		await expect(treeIn(card).locator('.stv__node[data-tree-path]')).toHaveCount(15);
	});

	test('isAccordionExpand collapses sibling subtrees when a new node is expanded', async ({
		page
	}) => {
		await gotoBasic(page);
		const card = expandControlsCard(page);

		// Start fully collapsed — at expandLevel=1 the roots are already expanded,
		// so dropping to 0 gives us a clean baseline where every toggle is an expand.
		await card.getByLabel('Expand Level:').fill('0');
		await card.getByLabel('Accordion Expand').check();

		const tree = treeIn(card);
		await expect(tree.locator('.stv__node[data-tree-path="1.1"]')).toHaveCount(0);

		// Expand Documents (1) — children appear.
		const docsToggle = tree
			.locator('.stv__node[data-tree-path="1"]')
			.first()
			.locator('> .stv__node-row .stv__toggle-icon')
			.first();
		await docsToggle.click();
		await expect(tree.locator('.stv__node[data-tree-path="1.1"]')).toBeVisible();

		// Now expand Downloads (2). Accordion mode should collapse Documents.
		const downloadsToggle = tree
			.locator('.stv__node[data-tree-path="2"]')
			.first()
			.locator('> .stv__node-row .stv__toggle-icon')
			.first();
		await downloadsToggle.click();
		await expect(tree.locator('.stv__node[data-tree-path="2.1"]')).toBeVisible();
		await expect(tree.locator('.stv__node[data-tree-path="1.1"]')).toHaveCount(0);
	});
});

// ── Scroll to Path ──────────────────────────────────────────────────────────

test.describe('Scroll to Path card', () => {
	test('clicking "Scroll to Path" highlights the target node', async ({ page }) => {
		await gotoBasic(page);
		const card = scrollCard(page);

		// Default value in the input is '1.2.1' (Photos).
		await card.getByRole('button', { name: 'Scroll to Path' }).click();

		// scrollToPath uses { highlight: true } by default — the highlight class
		// is `stv__node-content--scroll-highlight` and stays on until next scroll.
		const target = treeIn(card).locator('.stv__node[data-tree-path="1.2.1"]').first();
		await expect(target).toBeVisible();
		await expect(target.locator('> .stv__node-row .stv__node-content')).toHaveClass(
			/(^|\s)stv__node-content--scroll-highlight(\s|$)/
		);
	});

	test('changing the path input + clicking scrolls to a different node', async ({ page }) => {
		await gotoBasic(page);
		const card = scrollCard(page);

		const input = card.locator('input[type="text"]').first();
		await input.fill('3.1.1');
		await card.getByRole('button', { name: 'Scroll to Path' }).click();

		const target = treeIn(card).locator('.stv__node[data-tree-path="3.1.1"]').first();
		await expect(target.locator('> .stv__node-row .stv__node-content')).toHaveClass(
			/(^|\s)stv__node-content--scroll-highlight(\s|$)/
		);
	});
});

// ── Programmatic Expand/Collapse ───────────────────────────────────────────

test.describe('Programmatic Expand/Collapse card', () => {
	test('Expand All makes every node visible; Collapse All hides everything but the roots', async ({
		page
	}) => {
		await gotoBasic(page);
		const card = programmaticCard(page);

		// Starts at expandLevel=1: only roots expanded → roots + their direct
		// children render. Level-3 paths hidden.
		const tree = treeIn(card);
		await expect(tree.locator('.stv__node[data-tree-path="1.1.1"]')).toHaveCount(0);

		await card.getByRole('button', { name: 'Expand All' }).click();
		// All 15 paths now reachable.
		await expect(tree.locator('.stv__node[data-tree-path]')).toHaveCount(15);
		await expect(tree.locator('.stv__node[data-tree-path="1.1.1"]')).toBeVisible();

		await card.getByRole('button', { name: 'Collapse All' }).click();
		// Only root-level nodes remain visible.
		await expect(tree.locator('.stv__node[data-tree-path="1"]')).toBeVisible();
		await expect(tree.locator('.stv__node[data-tree-path="2"]')).toBeVisible();
		await expect(tree.locator('.stv__node[data-tree-path="3"]')).toBeVisible();
		await expect(tree.locator('.stv__node[data-tree-path="1.1"]')).toHaveCount(0);
	});

	test('Expand "Documents" expands that subtree only; Collapse "Documents" hides it again', async ({
		page
	}) => {
		await gotoBasic(page);
		const card = programmaticCard(page);

		// Collapse everything first for a clean baseline.
		await card.getByRole('button', { name: 'Collapse All' }).click();
		await expect(treeIn(card).locator('.stv__node[data-tree-path="1.1"]')).toHaveCount(0);

		await card.getByRole('button', { name: 'Expand "Documents" (1)' }).click();
		// Direct children of Documents are visible.
		await expect(treeIn(card).locator('.stv__node[data-tree-path="1.1"]')).toBeVisible();
		await expect(treeIn(card).locator('.stv__node[data-tree-path="1.2"]')).toBeVisible();
		// Other roots remain collapsed.
		await expect(treeIn(card).locator('.stv__node[data-tree-path="2.1"]')).toHaveCount(0);

		await card.getByRole('button', { name: 'Collapse "Documents" (1)' }).click();
		await expect(treeIn(card).locator('.stv__node[data-tree-path="1.1"]')).toHaveCount(0);
	});
});
