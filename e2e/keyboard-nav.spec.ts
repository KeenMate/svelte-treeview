import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for the keyboard-navigation test fixture at /test/keyboard-nav.
 *
 * The fixture mounts a tree with 18 visible nodes when fully expanded:
 *
 *   idx | path  | name     | level
 *   ----+-------+----------+------
 *     0 | 1     | Root-A   |   1
 *     1 | 1.1   | A-1      |   2
 *     2 | 1.1.1 | A-1-x    |   3
 *     3 | 1.1.2 | A-1-y    |   3
 *     4 | 1.2   | A-2      |   2
 *     5 | 1.2.1 | A-2-x    |   3
 *     6 | 1.2.2 | A-2-y    |   3
 *     7 | 1.3   | A-3      |   2  leaf
 *     8 | 2     | Root-B   |   1
 *     9 | 2.1   | B-1      |   2
 *    10 | 2.1.1 | B-1-x    |   3
 *    11 | 2.1.2 | B-1-y    |   3
 *    12 | 2.2   | B-2      |   2  leaf
 *    13 | 3     | Root-C   |   1
 *    14 | 3.1   | C-1      |   2  leaf
 *    15 | 3.2   | C-2      |   2  leaf
 *    16 | 4     | Root-D   |   1  leaf
 *    17 | 5     | Root-E   |   1  leaf
 *
 * Each test clicks a node to seed focus, then presses keys and asserts the
 * resulting focusedNode.path (and, for Shift+ tests, highlightedPaths).
 */

const PAGE = '/test/keyboard-nav';

function nodeByPath(scope: Locator | Page, path: string): Locator {
	return scope.locator(`.stv__node[data-tree-path="${path}"]`).first();
}

function nodeContent(node: Locator): Locator {
	return node.locator('> .stv__node-row .stv__node-content').first();
}

async function gotoFixture(page: Page) {
	await page.goto(PAGE);
	await expect(page.locator('.stv__node').first()).toBeVisible();
}

async function clickToFocus(page: Page, path: string) {
	await nodeContent(nodeByPath(page, path)).click();
	await expect(page.getByTestId('focused-path')).toHaveText(path);
}

function visibleCount(page: Page): Promise<number> {
	return page.locator('.stv__node[data-tree-path]').count();
}

test.beforeEach(async ({ page }) => {
	await gotoFixture(page);
	// Sanity: all 18 nodes visible at start.
	await expect.poll(() => visibleCount(page)).toBe(18);
});

// ── Sibling navigation (no Shift) ──────────────────────────────────────────

test.describe('ArrowDown / ArrowUp — sibling navigation', () => {
	test('ArrowDown moves focus to the next sibling at the same level', async ({ page }) => {
		await clickToFocus(page, '1');
		await page.keyboard.press('ArrowDown');
		// Skips children (1.1, 1.1.1, …) — next level-1 sibling is '2'.
		await expect(page.getByTestId('focused-path')).toHaveText('2');
	});

	test('ArrowDown at level 2 walks level-2 siblings, skipping descendants', async ({ page }) => {
		await clickToFocus(page, '1.1');
		await page.keyboard.press('ArrowDown');
		// Skips 1.1.1, 1.1.2; lands on 1.2.
		await expect(page.getByTestId('focused-path')).toHaveText('1.2');
	});

	test('ArrowDown at level 3 walks level-3 siblings', async ({ page }) => {
		await clickToFocus(page, '1.1.1');
		await page.keyboard.press('ArrowDown');
		await expect(page.getByTestId('focused-path')).toHaveText('1.1.2');
	});

	test('ArrowDown on the last sibling is a no-op', async ({ page }) => {
		await clickToFocus(page, '5');
		await page.keyboard.press('ArrowDown');
		// No further level-1 sibling — focus stays put.
		await expect(page.getByTestId('focused-path')).toHaveText('5');
	});

	test('ArrowUp moves focus to the previous sibling at the same level', async ({ page }) => {
		await clickToFocus(page, '2');
		await page.keyboard.press('ArrowUp');
		await expect(page.getByTestId('focused-path')).toHaveText('1');
	});

	test('ArrowUp on the first sibling is a no-op', async ({ page }) => {
		await clickToFocus(page, '1');
		await page.keyboard.press('ArrowUp');
		await expect(page.getByTestId('focused-path')).toHaveText('1');
	});
});

// ── Tree-traversal navigation ──────────────────────────────────────────────

test.describe('ArrowRight / ArrowLeft — descend and ascend', () => {
	test('ArrowRight on an expanded parent moves into the first child', async ({ page }) => {
		await clickToFocus(page, '1');
		await page.keyboard.press('ArrowRight');
		await expect(page.getByTestId('focused-path')).toHaveText('1.1');
	});

	test('ArrowRight on a collapsed parent first expands, then moves into the first child', async ({
		page
	}) => {
		// Collapse '1' first (Space toggles expand/collapse when no checkboxes).
		await clickToFocus(page, '1');
		await page.keyboard.press('Space');
		// Collapsing '1' removes 7 descendants from the visible flat list.
		await expect.poll(() => visibleCount(page)).toBe(11);

		await page.keyboard.press('ArrowRight');
		// '1' expands again and focus moves to the first child.
		await expect(page.getByTestId('focused-path')).toHaveText('1.1');
		await expect.poll(() => visibleCount(page)).toBe(18);
	});

	test('ArrowRight on a leaf is a no-op', async ({ page }) => {
		await clickToFocus(page, '1.3');
		await page.keyboard.press('ArrowRight');
		await expect(page.getByTestId('focused-path')).toHaveText('1.3');
	});

	test('ArrowLeft moves focus to the parent', async ({ page }) => {
		await clickToFocus(page, '1.1');
		await page.keyboard.press('ArrowLeft');
		await expect(page.getByTestId('focused-path')).toHaveText('1');
	});

	test('ArrowLeft from a level-3 descendant moves to its level-2 parent', async ({ page }) => {
		await clickToFocus(page, '1.1.1');
		await page.keyboard.press('ArrowLeft');
		await expect(page.getByTestId('focused-path')).toHaveText('1.1');
	});

	test('ArrowLeft on a root node is a no-op', async ({ page }) => {
		await clickToFocus(page, '1');
		await page.keyboard.press('ArrowLeft');
		await expect(page.getByTestId('focused-path')).toHaveText('1');
	});
});

// ── Backspace: navBackOut (collapse parent, focus parent) ──────────────────

test.describe('Backspace — collapse parent and focus it', () => {
	test('Backspace collapses the focused node\'s parent and moves focus there', async ({ page }) => {
		await clickToFocus(page, '1.1');
		await page.keyboard.press('Backspace');
		await expect(page.getByTestId('focused-path')).toHaveText('1');
		// Parent '1' collapsed → 7 descendants hidden → 11 visible.
		await expect.poll(() => visibleCount(page)).toBe(11);
	});

	test('Backspace from a level-3 node collapses the level-2 parent', async ({ page }) => {
		await clickToFocus(page, '1.1.1');
		await page.keyboard.press('Backspace');
		await expect(page.getByTestId('focused-path')).toHaveText('1.1');
		// '1.1' collapses → hides 1.1.1, 1.1.2 → 16 visible.
		await expect.poll(() => visibleCount(page)).toBe(16);
	});

	test('Backspace on a root node is a no-op (no parent)', async ({ page }) => {
		await clickToFocus(page, '1');
		await page.keyboard.press('Backspace');
		await expect(page.getByTestId('focused-path')).toHaveText('1');
		await expect.poll(() => visibleCount(page)).toBe(18);
	});
});

// ── Space: navToggle (Enter is reserved for selection / highlight) ─────────

test.describe('Space — toggle expand state of focused node', () => {
	test('Space collapses an expanded parent', async ({ page }) => {
		await clickToFocus(page, '1');
		// Starts with 18 visible (beforeEach asserts), so '1' must be expanded.
		await page.keyboard.press('Space');
		await expect.poll(() => visibleCount(page)).toBe(11);
	});

	test('Space re-expands a collapsed parent', async ({ page }) => {
		await clickToFocus(page, '1');
		await page.keyboard.press('Space');
		await expect.poll(() => visibleCount(page)).toBe(11);

		await page.keyboard.press('Space');
		await expect.poll(() => visibleCount(page)).toBe(18);
	});

	test('Space on a different expanded node also collapses', async ({ page }) => {
		await clickToFocus(page, '2');
		await page.keyboard.press('Space');
		// '2' has 4 descendants (2.1, 2.1.1, 2.1.2, 2.2) → 14 visible.
		await expect.poll(() => visibleCount(page)).toBe(14);
	});

	test('Space on a leaf is a no-op', async ({ page }) => {
		await clickToFocus(page, '1.3');
		await page.keyboard.press('Space');
		// '1.3' has no children, so visible count is unchanged.
		await expect.poll(() => visibleCount(page)).toBe(18);
	});
});

// ── Home / End: jump to ends of visible flat list ──────────────────────────

test.describe('Home / End — jump to first/last visible', () => {
	test('Home moves focus to the first visible node', async ({ page }) => {
		await clickToFocus(page, '2.1.1');
		await page.keyboard.press('Home');
		await expect(page.getByTestId('focused-path')).toHaveText('1');
	});

	test('End moves focus to the last visible node', async ({ page }) => {
		await clickToFocus(page, '1');
		await page.keyboard.press('End');
		await expect(page.getByTestId('focused-path')).toHaveText('5');
	});
});

// ── PageDown / PageUp: jump ±10 in the visible flat list ───────────────────

test.describe('PageDown / PageUp — jump ±10 in visible flat list', () => {
	test('PageDown jumps 10 nodes forward in the visible flat list', async ({ page }) => {
		await clickToFocus(page, '1'); // idx 0
		await page.keyboard.press('PageDown');
		// idx 10 → '2.1.1'.
		await expect(page.getByTestId('focused-path')).toHaveText('2.1.1');
	});

	test('PageDown clamps to the last visible node when near the end', async ({ page }) => {
		await clickToFocus(page, '2.1.1'); // idx 10
		await page.keyboard.press('PageDown');
		// min(20, 17) = 17 → '5'.
		await expect(page.getByTestId('focused-path')).toHaveText('5');
	});

	test('PageUp jumps 10 nodes backward in the visible flat list', async ({ page }) => {
		await clickToFocus(page, '5'); // idx 17
		await page.keyboard.press('PageUp');
		// idx 7 → '1.3'.
		await expect(page.getByTestId('focused-path')).toHaveText('1.3');
	});

	test('PageUp clamps to the first visible node when near the start', async ({ page }) => {
		await clickToFocus(page, '1.1'); // idx 1
		await page.keyboard.press('PageUp');
		// max(-9, 0) = 0 → '1'.
		await expect(page.getByTestId('focused-path')).toHaveText('1');
	});
});

// ── Shift+nav: extend highlight range ──────────────────────────────────────

test.describe('Shift+ArrowDown / Shift+ArrowUp — extend highlight by sibling', () => {
	test('Shift+ArrowDown highlights the visible-flat range from anchor to next-sibling target', async ({
		page
	}) => {
		await clickToFocus(page, '1.1');
		// After click, highlightedPaths = {1.1}.
		await expect(page.getByTestId('highlighted-size')).toHaveText('1');

		await page.keyboard.press('Shift+ArrowDown');

		// navHighlightNext walks to next level-2 sibling → '1.2'.
		// Range fills visible-flat from '1.1' to '1.2' = [1.1, 1.1.1, 1.1.2, 1.2].
		await expect(page.getByTestId('focused-path')).toHaveText('1.2');
		await expect(page.getByTestId('highlighted-size')).toHaveText('4');
		await expect(page.getByTestId('highlighted-sorted')).toHaveText('1.1,1.1.1,1.1.2,1.2');
	});

	test('Shift+ArrowUp highlights the visible-flat range from anchor to prev-sibling target', async ({
		page
	}) => {
		await clickToFocus(page, '1.2');

		await page.keyboard.press('Shift+ArrowUp');

		// navHighlightPrev → '1.1'. Range '1.2' to '1.1' = [1.1, 1.1.1, 1.1.2, 1.2].
		await expect(page.getByTestId('focused-path')).toHaveText('1.1');
		await expect(page.getByTestId('highlighted-size')).toHaveText('4');
		await expect(page.getByTestId('highlighted-sorted')).toHaveText('1.1,1.1.1,1.1.2,1.2');
	});
});

test.describe('Shift+Home / Shift+End — extend highlight to ends', () => {
	test('Shift+End highlights from anchor through the last visible node', async ({ page }) => {
		await clickToFocus(page, '2');
		// Anchor = '2' (idx 8). Range to idx 17 = 10 paths.

		await page.keyboard.press('Shift+End');

		await expect(page.getByTestId('focused-path')).toHaveText('5');
		await expect(page.getByTestId('highlighted-size')).toHaveText('10');
		await expect(page.getByTestId('highlighted-sorted')).toHaveText(
			'2,2.1,2.1.1,2.1.2,2.2,3,3.1,3.2,4,5'
		);
	});

	test('Shift+Home highlights from anchor back through the first visible node', async ({ page }) => {
		await clickToFocus(page, '1.2');
		// Anchor = '1.2' (idx 4). Range to idx 0 = 5 paths.

		await page.keyboard.press('Shift+Home');

		await expect(page.getByTestId('focused-path')).toHaveText('1');
		await expect(page.getByTestId('highlighted-size')).toHaveText('5');
		await expect(page.getByTestId('highlighted-sorted')).toHaveText('1,1.1,1.1.1,1.1.2,1.2');
	});
});

test.describe('Shift+PageDown / Shift+PageUp — extend highlight by ±10', () => {
	test('Shift+PageDown highlights from anchor through anchor+10 in visible-flat order', async ({
		page
	}) => {
		await clickToFocus(page, '1'); // anchor idx 0
		await page.keyboard.press('Shift+PageDown');
		// Target idx 10 → '2.1.1'. Range = idx 0..10 = 11 paths.
		await expect(page.getByTestId('focused-path')).toHaveText('2.1.1');
		await expect(page.getByTestId('highlighted-size')).toHaveText('11');
		await expect(page.getByTestId('highlighted-sorted')).toHaveText(
			'1,1.1,1.1.1,1.1.2,1.2,1.2.1,1.2.2,1.3,2,2.1,2.1.1'
		);
	});

	test('Shift+PageUp highlights from anchor back through anchor-10', async ({ page }) => {
		await clickToFocus(page, '5'); // anchor idx 17
		await page.keyboard.press('Shift+PageUp');
		// Target idx 7 → '1.3'. Range = idx 7..17 = 11 paths.
		await expect(page.getByTestId('focused-path')).toHaveText('1.3');
		await expect(page.getByTestId('highlighted-size')).toHaveText('11');
		await expect(page.getByTestId('highlighted-sorted')).toHaveText(
			'1.3,2,2.1,2.1.1,2.1.2,2.2,3,3.1,3.2,4,5'
		);
	});
});
