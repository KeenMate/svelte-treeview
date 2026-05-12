import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for /examples/data.
 *
 * Four trees live on this page, demonstrating path-based hierarchy and the
 * `treePathSeparator` prop:
 *
 *   1. "Path-Based Data Structure"   — default '.' separator, 4 nodes
 *   2. "Custom Path Separators"      — two side-by-side trees:
 *        a. slash '/'  (file-style paths like 'home/user/documents')
 *        b. colon '::' (namespace-style paths like 'App::Services::Auth')
 *   3. "Insert Result and Validation" — feeds problematic data (orphans,
 *      duplicate paths, empty paths) and binds `insertResult` so the page
 *      surfaces a JSON summary of what failed.
 *
 * Each tree is sorted alphabetically by name (sortByName).
 */

const PAGE = '/examples/data';

// ── Helpers ─────────────────────────────────────────────────────────────────

function cardByHeading(page: Page, heading: string): Locator {
	return page.locator('.card').filter({ has: page.locator('h2', { hasText: heading }) }).first();
}

function pathCard(page: Page): Locator {
	return cardByHeading(page, 'Path-Based Data Structure');
}

function separatorCard(page: Page): Locator {
	return cardByHeading(page, 'Custom Path Separators');
}

function insertCard(page: Page): Locator {
	return cardByHeading(page, 'Insert Result and Validation');
}

/**
 * The "Custom Path Separators" card hosts two trees. They're in column order:
 * index 0 = slash, index 1 = double-colon.
 */
function slashTree(page: Page): Locator {
	return separatorCard(page).locator('.tree-container').nth(0);
}

function colonTree(page: Page): Locator {
	return separatorCard(page).locator('.tree-container').nth(1);
}

function treeInCard(card: Locator): Locator {
	return card.locator('.tree-container').first();
}

function nodeByPath(tree: Locator, path: string): Locator {
	// data-tree-path holds the raw path string, so slashes / colons just work.
	return tree.locator(`.ltree-node[data-tree-path="${cssAttrEscape(path)}"]`).first();
}

function cssAttrEscape(s: string): string {
	// CSS attribute selectors need double quotes escaped — none of the demo
	// paths contain them today, but be defensive.
	return s.replace(/"/g, '\\"');
}

async function gotoData(page: Page) {
	await page.goto(PAGE);
	await expect(page.locator('.ltree-node').first()).toBeVisible();
}

// ── Path-Based Data Structure ──────────────────────────────────────────────

test.describe('Path-Based Data Structure', () => {
	test('renders all four nodes of the dot-separated hierarchy with their paths visible', async ({ page }) => {
		await gotoData(page);
		const tree = treeInCard(pathCard(page));

		await expect(nodeByPath(tree, '1')).toBeVisible();
		await expect(nodeByPath(tree, '1.1')).toBeVisible();
		await expect(nodeByPath(tree, '1.1.1')).toBeVisible();
		await expect(nodeByPath(tree, '1.2')).toBeVisible();

		// The nodeTemplate prints "<name> (<path>)". Spot-check a couple.
		await expect(nodeByPath(tree, '1')).toContainText('Root');
		await expect(nodeByPath(tree, '1')).toContainText('(1)');
		await expect(nodeByPath(tree, '1.1.1')).toContainText('Grandchild');
		await expect(nodeByPath(tree, '1.1.1')).toContainText('(1.1.1)');
	});
});

// ── Custom Path Separators ─────────────────────────────────────────────────

test.describe('Custom Path Separators', () => {
	test('slash separator: paths like "home/user/documents" build the expected hierarchy', async ({ page }) => {
		await gotoData(page);
		const tree = slashTree(page);

		await expect(nodeByPath(tree, 'home')).toBeVisible();
		await expect(nodeByPath(tree, 'home/user')).toBeVisible();
		await expect(nodeByPath(tree, 'home/user/documents')).toBeVisible();
		await expect(nodeByPath(tree, 'home/user/downloads')).toBeVisible();
		await expect(nodeByPath(tree, 'var')).toBeVisible();
		await expect(nodeByPath(tree, 'var/log')).toBeVisible();

		// Label text is the raw display value ("/home", "/var/log", …).
		await expect(nodeByPath(tree, 'home')).toContainText('/home');
		await expect(nodeByPath(tree, 'var/log')).toContainText('/var/log');
	});

	test('double-colon separator: paths like "App::Services::Auth" build the expected namespaces', async ({ page }) => {
		await gotoData(page);
		const tree = colonTree(page);

		await expect(nodeByPath(tree, 'App')).toBeVisible();
		await expect(nodeByPath(tree, 'App::Services')).toBeVisible();
		await expect(nodeByPath(tree, 'App::Services::Auth')).toBeVisible();
		await expect(nodeByPath(tree, 'App::Models')).toBeVisible();
		await expect(nodeByPath(tree, 'App::Models::User')).toBeVisible();

		await expect(nodeByPath(tree, 'App::Services::Auth')).toContainText('App::Services::Auth');
	});
});

// ── Insert Result and Validation ───────────────────────────────────────────

test.describe('Insert Result and Validation', () => {
	test('valid items render in the tree; orphans and empty paths land in insertResult.failed; duplicate path overrides', async ({ page }) => {
		await gotoData(page);
		const card = insertCard(page);
		const tree = treeInCard(card);

		// Source array (6 items, in order):
		//   { path: '1',    name: 'Valid Root' }
		//   { path: '1.1',  name: 'Valid Child' }
		//   { path: '2.1',  name: 'Orphan (parent 2 missing)' }  ← fails (no parent)
		//   { path: '1.1',  name: 'Duplicate Path' }               ← overwrites earlier 1.1
		//   { path: '',     name: 'Empty Path' }                   ← fails (empty path)
		//   { path: '1.2',  name: 'Another Valid Child' }
		//
		// LTree treats a duplicate path as a no-op insert (the first occurrence
		// wins) but still counts it as *successful*, not failed. So the tree
		// keeps 'Valid Child' at 1.1, never shows 'Duplicate Path', and the
		// duplicate row is included in the successful count.
		await expect(nodeByPath(tree, '1')).toBeVisible();
		await expect(nodeByPath(tree, '1.1')).toBeVisible();
		await expect(nodeByPath(tree, '1.2')).toBeVisible();
		await expect(nodeByPath(tree, '1.1')).toContainText('Valid Child');

		// Orphan, Empty Path, and the Duplicate's name never make it into the tree.
		await expect(tree).not.toContainText('Orphan');
		await expect(tree).not.toContainText('Empty Path');
		await expect(tree).not.toContainText('Duplicate Path');

		// Insert result block surfaces a JSON summary.
		const output = card.locator('.output pre').first();
		await expect(output).toBeVisible();
		const json = JSON.parse((await output.textContent()) ?? '{}');
		expect(json.total).toBe(6);
		expect(json.successful).toBe(4);
		expect(json.failed).toBe(2);

		// `failedDetails` lists each failure with its originalData and an error
		// string. Orphan + Empty Path are the only failures here.
		const failedNames = json.failedDetails.map((d: any) => d.originalData?.name);
		expect(failedNames).toEqual(
			expect.arrayContaining(['Orphan (parent 2 missing)', 'Empty Path'])
		);
		expect(json.failedDetails).toHaveLength(2);
	});
});
