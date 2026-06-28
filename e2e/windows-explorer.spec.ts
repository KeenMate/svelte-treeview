import { test, expect, Page } from '@playwright/test';

/**
 * Smoke coverage for the Windows File Explorer demo at /examples/custom-layout
 * (WindowsExplorer.svelte). BOTH panes are <Tree> instances with custom
 * nodeTemplate renderers: the left nav tree (hierarchical, folders only) and the
 * right details list (a flat <Tree> whose rows are a 4-column grid). The demo
 * opens at C:\Windows (DEFAULT_PATH '1.4.6') — 32 folders + 14 files (46 items).
 */

const winx = (page: Page) => page.locator('.winx');
// A right-pane row = a .stv__node in the right tree whose name cell matches.
const row = (page: Page, name: string) =>
	page.locator('.winx-right .stv__node', { has: page.locator('.winx__rowname', { hasText: name }) });
const rowContent = (page: Page, name: string) => row(page, name).locator('.stv__node-content');
const rowNames = (page: Page) => page.locator('.winx-right .winx__rowname').allTextContents();

// Open = double-click. The right tree re-renders the row on the first click
// (highlight bumps _rev), so re-resolve the locator for each click rather than
// using .dblclick() on a stale element — two quick clicks trip the controller's
// manual double-click detection (and onNodeDoubleClick).
async function open(page: Page, name: string) {
	await rowContent(page, name).click();
	await rowContent(page, name).click();
}

test.describe('Windows File Explorer demo', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/examples/custom-layout');
		await page.waitForLoadState('networkidle');
		await winx(page).scrollIntoViewIfNeeded();
		await expect(winx(page)).toBeVisible();
		await expect(row(page, 'System32')).toBeVisible();
	});

	test('opens at C:\\Windows; both panes are svelte-treeview', async ({ page }) => {
		await expect(page.locator('.winx__address')).toContainText('Windows');
		await expect(page.locator('.winx__status')).toHaveText(/46 items/);
		// Left nav + right details are both .stv__ trees.
		await expect(page.locator('.winx__nav .stv__node').first()).toBeVisible();
		await expect(page.locator('.winx-right .stv__node').first()).toBeVisible();
		await expect(row(page, 'Fonts')).toBeVisible();
		// nodeClass tags each row by kind (data-driven class hook).
		await expect(row(page, 'System32')).toHaveClass(/winx-folder/);
		await expect(row(page, 'explorer.exe')).toHaveClass(/winx-file/);
		await expect(row(page, 'explorer.exe').locator('.winx__cell--type')).toContainText('Application');
	});

	test('double-clicking drills into multi-level subfolders', async ({ page }) => {
		await open(page, 'System32');
		await expect(page.locator('.winx__address')).toContainText('System32');
		await expect(row(page, 'drivers')).toBeVisible();
		await expect(row(page, 'kernel32.dll')).toBeVisible();

		await open(page, 'drivers');
		await expect(page.locator('.winx__address')).toContainText('drivers');
		await expect(row(page, 'etc')).toBeVisible();

		await open(page, 'etc');
		await expect(row(page, 'hosts')).toBeVisible();
		await expect(row(page, 'services')).toBeVisible();
	});

	test('empty folders render the empty-state message', async ({ page }) => {
		await open(page, 'Prefetch');
		await expect(page.locator('.winx__address')).toContainText('Prefetch');
		await expect(page.locator('.winx__empty')).toContainText('This folder is empty');
		await expect(page.locator('.winx__status')).toHaveText(/0 items/);
	});

	test('Up button and breadcrumb navigate back up the tree', async ({ page }) => {
		await open(page, 'System32');
		await open(page, 'drivers');
		await page.locator('.winx__navbtn[title="Up"]').click();
		await expect(page.locator('.winx__address')).toContainText('System32');
		await expect(page.locator('.winx__address')).not.toContainText('drivers');
		await page.locator('.winx__crumb', { hasText: 'Windows' }).click();
		await expect(page.locator('.winx__status')).toHaveText(/46 items/);
	});

	test('Back / Forward history works', async ({ page }) => {
		await open(page, 'System32');
		await expect(page.locator('.winx__address')).toContainText('System32');
		await page.locator('.winx__navbtn[title="Back"]').click();
		await expect(page.locator('.winx__status')).toHaveText(/46 items/);
		await page.locator('.winx__navbtn[title="Forward"]').click();
		await expect(page.locator('.winx__address')).toContainText('System32');
	});

	test('search recurses into subfolders and shows each hit’s location', async ({ page }) => {
		await page.locator('.winx__search input').fill('hosts');
		await expect(row(page, 'hosts')).toBeVisible();
		await expect(row(page, 'hosts').locator('.winx__rowloc'))
			.toHaveText('in Windows \\ System32 \\ drivers \\ etc');

		await page.locator('.winx__search input').fill('Sys');
		const names = await rowNames(page);
		expect(names.length).toBeGreaterThan(0);
		expect(names.every((n) => n.toLowerCase().includes('sys'))).toBe(true);

		// Wildcard glob: `*.dll` matches names ending in .dll (and nothing else).
		await page.locator('.winx__search input').fill('*.dll');
		const dlls = await rowNames(page);
		expect(dlls.length).toBeGreaterThan(0);
		expect(dlls.every((n) => n.toLowerCase().endsWith('.dll'))).toBe(true);

		// Navigating clears the search.
		await page.locator('.winx__crumb', { hasText: 'Windows' }).click();
		await expect(page.locator('.winx__search input')).toHaveValue('');
	});

	test('clicking a column header sorts; toggling reverses; folders stay first', async ({ page }) => {
		const asc = await rowNames(page);
		expect(asc[0]).toBe('addins');
		await page.locator('.winx__col--name').click(); // → descending
		const desc = await rowNames(page);
		expect(desc[0]).not.toBe(asc[0]);
		expect(desc[0]).toBe('WinSxS');
		// Folders precede files in BOTH directions: last row is always a file (has a size).
		await expect(page.locator('.winx-right .stv__node').last().locator('.winx__cell--size')).not.toHaveText('');
	});

	test('clicking a nav-tree folder drives the right pane', async ({ page }) => {
		await page.locator('.winx__nav .stv__node-content', { hasText: 'System32' }).first().click();
		await expect(page.locator('.winx__address')).toContainText('System32');
		await expect(row(page, 'drivers')).toBeVisible();
	});

	test('selecting rows uses the library highlight; status reflects the count', async ({ page }) => {
		await rowContent(page, 'System32').click();
		await expect(row(page, 'System32').locator('.stv__node-content')).toHaveClass(/stv__node-content--highlighted/);
		await expect(page.locator('.winx__status-sel')).toHaveText(/1 item selected/);
		// Ctrl+click extends (selectionMode="multi").
		await rowContent(page, 'Fonts').click({ modifiers: ['Control'] });
		await expect(page.locator('.winx__status-sel')).toHaveText(/2 items selected/);
	});

	test('single click previews in the status bar; double click opens', async ({ page }) => {
		await rowContent(page, 'explorer.exe').click();
		await expect(page.locator('.winx__status-info')).toContainText('explorer.exe — Application');
		await open(page, 'System32');
		await expect(page.locator('.winx__address')).toContainText('System32');
	});

	test('right-click opens the library context menu; Delete removes the item', async ({ page }) => {
		await rowContent(page, 'Branding').click({ button: 'right' });
		const menu = page.locator('.stv__context-menu').first();
		await expect(menu).toBeVisible();
		await expect(menu.locator('.stv__context-menu-item', { hasText: 'Open' })).toBeVisible();
		await menu.locator('.stv__context-menu-item', { hasText: 'Delete' }).click();
		await expect(row(page, 'Branding')).toHaveCount(0);
	});

	test('clicking a menu item auto-closes the menu (no manual close() needed)', async ({ page }) => {
		// The demo's menu callback does NOT call the close() argument — the library
		// auto-closes after a leaf item is activated.
		await rowContent(page, 'Fonts').click({ button: 'right' });
		await expect(page.locator('.stv__context-menu')).toBeVisible();
		await page.locator('.stv__context-menu-item', { hasText: 'Copy path' }).click();
		await expect(page.locator('.stv__context-menu')).toHaveCount(0);
	});

	test('New folder creates it (nav + contents); Delete removes it; nav stays expanded', async ({ page }) => {
		const navBefore = await page.locator('.winx__nav .stv__node').count();
		await page.locator('.winx__action', { hasText: 'New folder' }).click();
		await expect(row(page, 'New folder')).toBeVisible();
		await expect.poll(() => page.locator('.winx__nav .stv__node').count()).toBe(navBefore + 1);

		await page.locator('.winx__action', { hasText: 'Delete' }).click();
		await expect(row(page, 'New folder')).toHaveCount(0);
		await expect.poll(() => page.locator('.winx__nav .stv__node').count()).toBe(navBefore);
	});
});
