import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for the branch-operations test fixture at /test/branch-operations.
 *
 * Exercises insertBranch / replaceBranch / deleteBranch plus a minimal
 * cut/paste flow and failure-path buttons.
 *
 * The fixture exposes the last operation's return value via data-testid spans
 * and an op-call counter so specs assert on the lib's actual return shape
 * (success / count / removedCount / failed[] / error). The op-call counter
 * proxies for emission frequency at the public-API level — strict
 * single-emission-of-_emitTreeChanged is verified in a unit test, not here.
 */

const PAGE = '/test/branch-operations';

async function gotoFixture(page: Page) {
	await page.goto(PAGE);
	await expect(page.locator('.ltree-node').first()).toBeVisible();
}

function nodeByPath(scope: Locator | Page, path: string): Locator {
	return scope.locator(`.ltree-node[data-tree-path="${path}"]`).first();
}

function readCount(page: Page, testId: string): Promise<number> {
	return page
		.getByTestId(testId)
		.textContent()
		.then((t) => Number(t ?? '0'));
}

test.beforeEach(async ({ page }) => {
	await gotoFixture(page);
});

// ── Initial state ──────────────────────────────────────────────────────────

test.describe('initial state', () => {
	test('seed tree exposes 8 nodes and a clean lastOp / clipboard', async ({ page }) => {
		await expect(page.getByTestId('op-call-count')).toHaveText('0');
		await expect(page.getByTestId('total-node-count')).toHaveText('8');
		await expect(page.getByTestId('clipboard-source')).toHaveText('(empty)');
		await expect(page.getByTestId('last-op-name')).toHaveText('');

		// Seed paths are present.
		for (const p of ['1', '1.1', '1.2', '2', '2.1', '2.1.1', '2.1.2', '3']) {
			await expect(nodeByPath(page, p)).toBeVisible();
		}
	});
});

// ── insertBranch ───────────────────────────────────────────────────────────

test.describe('insertBranch', () => {
	test('inserts a 3-node branch under "1" — one API call, count=3', async ({ page }) => {
		const before = await readCount(page, 'op-call-count');
		const totalBefore = await readCount(page, 'total-node-count');

		await page.getByTestId('btn-insert-under-1').click();

		await expect(page.getByTestId('last-op-name')).toHaveText('insertBranch');
		await expect(page.getByTestId('last-op-success')).toHaveText('true');
		await expect(page.getByTestId('last-op-count')).toHaveText('3');
		await expect(page.getByTestId('last-op-failed-count')).toHaveText('0');
		await expect(page.getByTestId('last-op-error')).toHaveText('');

		// Exactly one public-API call recorded.
		await expect(page.getByTestId('op-call-count')).toHaveText(String(before + 1));
		// All three nodes landed.
		await expect(page.getByTestId('total-node-count')).toHaveText(String(totalBefore + 3));

		// New nodes visible in the tree.
		await expect(page.getByText('New-Root')).toBeVisible();
		await expect(page.getByText('New-Child-A')).toBeVisible();
		await expect(page.getByText('New-Child-B')).toBeVisible();
	});

	test('inserts under "3" (a leaf) — succeeds and adds branch as descendants', async ({ page }) => {
		await page.getByTestId('btn-insert-under-3').click();

		await expect(page.getByTestId('last-op-success')).toHaveText('true');
		await expect(page.getByTestId('last-op-count')).toHaveText('3');
		await expect(page.getByTestId('total-node-count')).toHaveText('11');
	});
});

// ── replaceBranch ──────────────────────────────────────────────────────────

test.describe('replaceBranch', () => {
	test('replaces all descendants under "1" — old subtree gone, new subtree present', async ({
		page
	}) => {
		// Sanity: original children of "1" are present.
		await expect(nodeByPath(page, '1.1')).toBeVisible();
		await expect(nodeByPath(page, '1.2')).toBeVisible();

		await page.getByTestId('btn-replace-1').click();

		await expect(page.getByTestId('last-op-name')).toHaveText('replaceBranch');
		await expect(page.getByTestId('last-op-success')).toHaveText('true');
		// 4 new nodes inserted (3 siblings + 1 child of the first).
		await expect(page.getByTestId('last-op-count')).toHaveText('4');

		// Old children "1.1" and "1.2" no longer exist.
		await expect(nodeByPath(page, '1.1')).toHaveCount(0);
		await expect(nodeByPath(page, '1.2')).toHaveCount(0);
		// New children visible by name (exact match avoids hitting "Replaced-1-child").
		await expect(page.getByText('Replaced-1', { exact: true })).toBeVisible();
		await expect(page.getByText('Replaced-2', { exact: true })).toBeVisible();
		await expect(page.getByText('Replaced-3', { exact: true })).toBeVisible();
		await expect(page.getByText('Replaced-1-child', { exact: true })).toBeVisible();
	});

	test('replaceBranch is a single public-API call', async ({ page }) => {
		const before = await readCount(page, 'op-call-count');
		await page.getByTestId('btn-replace-2.1').click();
		await expect(page.getByTestId('op-call-count')).toHaveText(String(before + 1));
	});
});

// ── deleteBranch ───────────────────────────────────────────────────────────

test.describe('deleteBranch', () => {
	test('deletes "2.1" subtree — removedCount=3 (self + 2 grandchildren)', async ({ page }) => {
		await page.getByTestId('btn-delete-2.1').click();

		await expect(page.getByTestId('last-op-name')).toHaveText('deleteBranch');
		await expect(page.getByTestId('last-op-success')).toHaveText('true');
		await expect(page.getByTestId('last-op-removed')).toHaveText('3');

		// "2.1" and its descendants are gone; "2" remains.
		await expect(nodeByPath(page, '2.1')).toHaveCount(0);
		await expect(nodeByPath(page, '2.1.1')).toHaveCount(0);
		await expect(nodeByPath(page, '2.1.2')).toHaveCount(0);
		await expect(nodeByPath(page, '2')).toBeVisible();

		await expect(page.getByTestId('total-node-count')).toHaveText('5');
	});

	test('keepParent=true removes only descendants', async ({ page }) => {
		await page.getByTestId('btn-delete-2.1-keepParent').click();

		await expect(page.getByTestId('last-op-name')).toHaveText('deleteBranch(keepParent)');
		await expect(page.getByTestId('last-op-success')).toHaveText('true');
		// 2 grandchildren removed; the node "2.1" itself stays.
		await expect(page.getByTestId('last-op-removed')).toHaveText('2');

		await expect(nodeByPath(page, '2.1')).toBeVisible();
		await expect(nodeByPath(page, '2.1.1')).toHaveCount(0);
		await expect(nodeByPath(page, '2.1.2')).toHaveCount(0);
	});

	test('deleteBranch on a leaf removes only that leaf', async ({ page }) => {
		await page.getByTestId('btn-delete-3').click();
		await expect(page.getByTestId('last-op-removed')).toHaveText('1');
		await expect(nodeByPath(page, '3')).toHaveCount(0);
	});
});

// ── Cut / paste flow ──────────────────────────────────────────────────────

test.describe('cut/paste workflow', () => {
	test('cut populates clipboard; paste under another node moves the branch', async ({ page }) => {
		// Cut "2.1" — clipboard reflects the source path.
		await page.getByTestId('btn-cut-2.1').click();
		await expect(page.getByTestId('clipboard-source')).toHaveText('2.1');

		// Paste under "3". Two underlying ops fire (delete + insert), so call
		// count goes up by 2 since the cut itself didn't bump it.
		const before = await readCount(page, 'op-call-count');
		await page.getByTestId('btn-paste-3').click();

		// Last recorded op is the insert leg of the paste.
		await expect(page.getByTestId('last-op-name')).toHaveText('paste:insert');
		await expect(page.getByTestId('last-op-success')).toHaveText('true');
		// 3 nodes copied (2.1 + its 2 descendants).
		await expect(page.getByTestId('last-op-count')).toHaveText('3');

		await expect(page.getByTestId('op-call-count')).toHaveText(String(before + 2));

		// Clipboard cleared after successful paste.
		await expect(page.getByTestId('clipboard-source')).toHaveText('(empty)');

		// Old "2.1" subtree gone; new copies live under "3".
		await expect(nodeByPath(page, '2.1')).toHaveCount(0);
		await expect(nodeByPath(page, '2.1.1')).toHaveCount(0);

		// Total node count unchanged (3 deleted, 3 inserted).
		await expect(page.getByTestId('total-node-count')).toHaveText('8');
	});

	test('pasting into self records error and leaves clipboard intact', async ({ page }) => {
		await page.getByTestId('btn-cut-2.1').click();
		await expect(page.getByTestId('clipboard-source')).toHaveText('2.1');

		await page.getByTestId('btn-paste-into-self').click();

		await expect(page.getByTestId('last-op-name')).toHaveText('paste');
		await expect(page.getByTestId('last-op-success')).toHaveText('false');
		await expect(page.getByTestId('last-op-error')).toHaveText(
			'Cannot paste into self or descendant'
		);
		// Source subtree still intact.
		await expect(nodeByPath(page, '2.1')).toBeVisible();
		await expect(nodeByPath(page, '2.1.1')).toBeVisible();
	});

	test('Clear clipboard button empties the clipboard', async ({ page }) => {
		await page.getByTestId('btn-cut-1.1').click();
		await expect(page.getByTestId('clipboard-source')).toHaveText('1.1');

		await page.getByTestId('btn-clear-clipboard').click();
		await expect(page.getByTestId('clipboard-source')).toHaveText('(empty)');
	});
});

// ── Failure cases ─────────────────────────────────────────────────────────

test.describe('failure cases', () => {
	test('insertBranch on a missing parent returns success=false, parentNode=null', async ({
		page
	}) => {
		const totalBefore = await readCount(page, 'total-node-count');

		await page.getByTestId('btn-fail-insert-parent').click();

		await expect(page.getByTestId('last-op-name')).toHaveText('insertBranch(invalid-parent)');
		await expect(page.getByTestId('last-op-success')).toHaveText('false');
		await expect(page.getByTestId('last-op-count')).toHaveText('0');
		// Tree unchanged.
		await expect(page.getByTestId('total-node-count')).toHaveText(String(totalBefore));
	});

	test('insertBranch with mixed-validity items succeeds and surfaces failed[] entries', async ({
		page
	}) => {
		const totalBefore = await readCount(page, 'total-node-count');

		await page.getByTestId('btn-fail-insert-items').click();

		await expect(page.getByTestId('last-op-name')).toHaveText('insertBranch(mixed-validity)');
		await expect(page.getByTestId('last-op-success')).toHaveText('true');
		// 2 valid items in (1 with empty path, 1 with null path are rejected).
		await expect(page.getByTestId('last-op-count')).toHaveText('2');
		await expect(page.getByTestId('last-op-failed-count')).toHaveText('2');

		await expect(page.getByTestId('total-node-count')).toHaveText(String(totalBefore + 2));
	});

	test('replaceBranch on a missing parent returns success=false', async ({ page }) => {
		const totalBefore = await readCount(page, 'total-node-count');

		await page.getByTestId('btn-fail-replace-parent').click();

		await expect(page.getByTestId('last-op-name')).toHaveText('replaceBranch(invalid-parent)');
		await expect(page.getByTestId('last-op-success')).toHaveText('false');
		await expect(page.getByTestId('total-node-count')).toHaveText(String(totalBefore));
	});

	test('deleteBranch on a missing path returns success=false with an error message', async ({
		page
	}) => {
		const totalBefore = await readCount(page, 'total-node-count');

		await page.getByTestId('btn-fail-delete-path').click();

		await expect(page.getByTestId('last-op-name')).toHaveText('deleteBranch(invalid-path)');
		await expect(page.getByTestId('last-op-success')).toHaveText('false');
		await expect(page.getByTestId('last-op-removed')).toHaveText('0');
		await expect(page.getByTestId('last-op-error')).not.toHaveText('');
		await expect(page.getByTestId('total-node-count')).toHaveText(String(totalBefore));
	});
});

// ── Reset ─────────────────────────────────────────────────────────────────

test.describe('reset', () => {
	test('Reset Tree button restores the initial seed and clears lastOp/clipboard', async ({
		page
	}) => {
		// Mutate first.
		await page.getByTestId('btn-insert-under-1').click();
		await page.getByTestId('btn-cut-2.1').click();
		await expect(page.getByTestId('clipboard-source')).toHaveText('2.1');

		await page.getByTestId('btn-reset').click();

		await expect(page.getByTestId('total-node-count')).toHaveText('8');
		await expect(page.getByTestId('op-call-count')).toHaveText('0');
		await expect(page.getByTestId('clipboard-source')).toHaveText('(empty)');
		await expect(page.getByTestId('last-op-name')).toHaveText('');
	});
});
