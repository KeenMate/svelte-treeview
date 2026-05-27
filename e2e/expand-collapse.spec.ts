import { test, expect, Page } from '@playwright/test';

/**
 * E2E coverage for the array + exclusive variants of expandNodes / collapseNodes /
 * expandAll / collapseAll. Targets /test/expand-collapse.
 *
 * Tree layout (paths):
 *   1                       2                   3
 *   ├── 1.1                 ├── 2.1             ├── 3.1
 *   │   ├── 1.1.1           │   └── 2.1.1       │   └── 3.1.1
 *   │   └── 1.1.2           └── 2.2             └── 3.2
 *   ├── 1.2
 *   │   ├── 1.2.1
 *   │   └── 1.2.2
 *   └── 1.3
 *       └── 1.3.1
 *
 * Initial expandLevel=0, so only the three roots (1, 2, 3) are visible.
 *
 * Visibility is asserted by reading data-tree-path attributes from the DOM.
 */

const PAGE = '/test/expand-collapse';
const ALL_PATHS = [
	'1',
	'1.1',
	'1.1.1',
	'1.1.2',
	'1.2',
	'1.2.1',
	'1.2.2',
	'1.3',
	'1.3.1',
	'2',
	'2.1',
	'2.1.1',
	'2.2',
	'3',
	'3.1',
	'3.1.1',
	'3.2'
];

async function goto(page: Page) {
	await page.goto(PAGE);
	await expect(page.locator('.ltree-node').first()).toBeVisible();
}

async function visiblePaths(page: Page): Promise<string[]> {
	const paths = await page
		.locator('[data-tree-path]')
		.evaluateAll((els) =>
			els
				.map((e) => e.getAttribute('data-tree-path'))
				.filter((p): p is string => p !== null && p !== '')
		);
	return paths.sort();
}

function sorted(paths: string[]): string[] {
	return [...paths].sort();
}

async function resetCollapsed(page: Page) {
	await page.getByTestId('collapse-all').click();
	expect(await visiblePaths(page)).toEqual(sorted(['1', '2', '3']));
}

async function resetExpanded(page: Page) {
	await page.getByTestId('expand-all').click();
	expect(await visiblePaths(page)).toEqual(sorted(ALL_PATHS));
}

test('initial state: only roots visible (expandLevel=0)', async ({ page }) => {
	await goto(page);
	expect(await visiblePaths(page)).toEqual(sorted(['1', '2', '3']));
});

// ── expandNodes ─────────────────────────────────────────────────────────────

test.describe('expandNodes', () => {
	test('single string: opens spine, leaves other roots collapsed', async ({ page }) => {
		await goto(page);
		await resetCollapsed(page);

		await page.getByTestId('expand-nodes-single').click();

		// Spine 1 → 1.1 → 1.1.1 open. Children of 1 and 1.1 visible.
		expect(await visiblePaths(page)).toEqual(
			sorted(['1', '1.1', '1.1.1', '1.1.2', '1.2', '1.3', '2', '3'])
		);
	});

	test('array: opens spines for every path independently', async ({ page }) => {
		await goto(page);
		await resetCollapsed(page);

		await page.getByTestId('expand-nodes-array').click();

		expect(await visiblePaths(page)).toEqual(
			sorted(['1', '1.1', '1.1.1', '1.1.2', '1.2', '1.3', '2', '2.1', '2.1.1', '2.2', '3'])
		);
	});

	test('exclusive: collapses off-spine branches that were previously open', async ({ page }) => {
		await goto(page);
		await resetExpanded(page);

		await page.getByTestId('expand-nodes-exclusive').click();

		// Off-spine branches under root 1 and the sibling roots 2/3 collapse,
		// but they remain visible because their own parent (root) is on the spine
		// or is itself a root. Only descendants of the collapsed branches disappear.
		expect(await visiblePaths(page)).toEqual(
			sorted(['1', '1.1', '1.1.1', '1.1.2', '1.2', '1.3', '2', '3'])
		);
	});

	test('array + exclusive: union of spines; everything else collapses', async ({ page }) => {
		await goto(page);
		await resetExpanded(page);

		await page.getByTestId('expand-nodes-array-exclusive').click();

		// Spine union = {1, 1.1, 1.1.1} ∪ {3, 3.1, 3.1.1}.
		// Sibling subtree under 1.2 / 1.3 / 2.1 collapses.
		expect(await visiblePaths(page)).toEqual(
			sorted([
				'1',
				'1.1',
				'1.1.1',
				'1.1.2',
				'1.2',
				'1.3',
				'2',
				'3',
				'3.1',
				'3.1.1',
				'3.2'
			])
		);
	});
});

// ── collapseNodes ───────────────────────────────────────────────────────────

test.describe('collapseNodes', () => {
	test('single string: closes just the target node, leaves rest intact', async ({ page }) => {
		await goto(page);
		await resetExpanded(page);

		await page.getByTestId('collapse-nodes-single').click();

		// 1.1 is now closed; its children disappear. Everything else stays open.
		const expected = ALL_PATHS.filter((p) => p !== '1.1.1' && p !== '1.1.2');
		expect(await visiblePaths(page)).toEqual(sorted(expected));
	});

	test('array: closes every target node independently', async ({ page }) => {
		await goto(page);
		await resetExpanded(page);

		await page.getByTestId('collapse-nodes-array').click();

		const expected = ALL_PATHS.filter(
			(p) => p !== '1.1.1' && p !== '1.1.2' && p !== '2.1.1'
		);
		expect(await visiblePaths(page)).toEqual(sorted(expected));
	});
});

// ── expandAll ───────────────────────────────────────────────────────────────

test.describe('expandAll', () => {
	test('no args: expands the entire tree', async ({ page }) => {
		await goto(page);
		await resetCollapsed(page);

		await page.getByTestId('expand-all').click();

		expect(await visiblePaths(page)).toEqual(sorted(ALL_PATHS));
	});

	test('single subtree: expands only that subtree', async ({ page }) => {
		await goto(page);
		await resetCollapsed(page);

		await page.getByTestId('expand-all-subtree').click();

		expect(await visiblePaths(page)).toEqual(sorted(['1', '2', '2.1', '2.1.1', '2.2', '3']));
	});

	test('array: expands multiple subtrees, leaves siblings collapsed', async ({ page }) => {
		await goto(page);
		await resetCollapsed(page);

		await page.getByTestId('expand-all-array').click();

		expect(await visiblePaths(page)).toEqual(
			sorted([
				'1',
				'1.1',
				'1.1.1',
				'1.1.2',
				'1.2',
				'1.2.1',
				'1.2.2',
				'1.3',
				'1.3.1',
				'2',
				'3',
				'3.1',
				'3.1.1',
				'3.2'
			])
		);
	});

	test('exclusive: expands target subtree and collapses everything outside it', async ({ page }) => {
		await goto(page);
		await resetExpanded(page);

		await page.getByTestId('expand-all-exclusive').click();

		// Target = 1.1. Spine = {1, 1.1}; subtree of 1.1 = {1.1, 1.1.1, 1.1.2}.
		// Everything else expanded gets collapsed: 1.2, 1.3, 2, 3 all collapsed
		// (still visible since they're under expanded parents or are roots).
		expect(await visiblePaths(page)).toEqual(
			sorted(['1', '1.1', '1.1.1', '1.1.2', '1.2', '1.3', '2', '3'])
		);
	});
});

// ── collapseAll ─────────────────────────────────────────────────────────────

test.describe('collapseAll', () => {
	test('no args: collapses the entire tree', async ({ page }) => {
		await goto(page);
		await resetExpanded(page);

		await page.getByTestId('collapse-all').click();

		expect(await visiblePaths(page)).toEqual(sorted(['1', '2', '3']));
	});

	test('single subtree: closes that subtree, leaves others open', async ({ page }) => {
		await goto(page);
		await resetExpanded(page);

		await page.getByTestId('collapse-all-subtree').click();

		// Subtree of 1 fully collapsed; 2 and 3 still fully expanded.
		expect(await visiblePaths(page)).toEqual(
			sorted(['1', '2', '2.1', '2.1.1', '2.2', '3', '3.1', '3.1.1', '3.2'])
		);
	});

	test('array: collapses multiple subtrees', async ({ page }) => {
		await goto(page);
		await resetExpanded(page);

		await page.getByTestId('collapse-all-array').click();

		expect(await visiblePaths(page)).toEqual(sorted(['1', '2', '3', '3.1', '3.1.1', '3.2']));
	});
});
