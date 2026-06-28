import { test, expect, Page } from '@playwright/test';

/**
 * Smoke coverage for the Windows File Explorer demo at /examples/custom-layout
 * (WindowsExplorer.svelte) — a dual-pane explorer built on <Tree>: nav tree (left)
 * + custom sortable details list (right), kept in sync via expandNodes()/focusNode().
 *
 * The demo opens at C:\Windows (DEFAULT_PATH '1.4.6'), which holds 32 folders +
 * 14 files (46 items) modelled on a real Windows 10 install.
 */

const winx = (page: Page) => page.locator('.winx');
const row = (page: Page, name: string) => page.locator('.winx__row', { hasText: name });
const rowNames = (page: Page) => page.locator('.winx__rowname').allTextContents();

test.describe('Windows File Explorer demo', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/examples/custom-layout');
		await page.waitForLoadState('networkidle');
		await winx(page).scrollIntoViewIfNeeded();
		await expect(winx(page)).toBeVisible();
	});

	test('opens at C:\\Windows and lists its folders + files', async ({ page }) => {
		await expect(page.locator('.winx__address')).toContainText('Windows');
		await expect(page.locator('.winx__status')).toHaveText(/46 items/);
		await expect(row(page, 'System32')).toBeVisible();
		await expect(row(page, 'Fonts')).toBeVisible();
		// A root-level file with a real type label.
		await expect(row(page, 'explorer.exe')).toBeVisible();
		await expect(page.locator('.winx__row', { hasText: 'explorer.exe' }).locator('.winx__cell--type')).toContainText('Application');
	});

	test('double-clicking drills into multi-level subfolders', async ({ page }) => {
		await row(page, 'System32').dblclick();
		await expect(page.locator('.winx__address')).toContainText('System32');
		await expect(row(page, 'drivers')).toBeVisible();
		await expect(row(page, 'kernel32.dll')).toBeVisible();

		await row(page, 'drivers').dblclick();
		await expect(page.locator('.winx__address')).toContainText('drivers');
		await expect(row(page, 'etc')).toBeVisible();

		await row(page, 'etc').dblclick();
		await expect(row(page, 'hosts')).toBeVisible();
		await expect(row(page, 'services')).toBeVisible();
	});

	test('empty folders render the empty-state message', async ({ page }) => {
		await row(page, 'Prefetch').dblclick();
		await expect(page.locator('.winx__address')).toContainText('Prefetch');
		await expect(page.locator('.winx__empty')).toContainText('This folder is empty');
		await expect(page.locator('.winx__status')).toHaveText(/0 items/);
	});

	test('Up button and breadcrumb navigate back up the tree', async ({ page }) => {
		await row(page, 'System32').dblclick();
		await row(page, 'drivers').dblclick();
		await page.locator('.winx__navbtn[title="Up"]').click();
		await expect(page.locator('.winx__address')).toContainText('System32');
		await expect(page.locator('.winx__address')).not.toContainText('drivers');
		// Jump straight to Windows via breadcrumb.
		await page.locator('.winx__crumb', { hasText: 'Windows' }).click();
		await expect(page.locator('.winx__status')).toHaveText(/46 items/);
	});

	test('Back / Forward history works', async ({ page }) => {
		await row(page, 'System32').dblclick();
		await expect(page.locator('.winx__address')).toContainText('System32');
		await page.locator('.winx__navbtn[title="Back"]').click();
		await expect(page.locator('.winx__status')).toHaveText(/46 items/);
		await page.locator('.winx__navbtn[title="Forward"]').click();
		await expect(page.locator('.winx__address')).toContainText('System32');
	});

	test('search recurses into subfolders and shows each hit’s location', async ({ page }) => {
		// `hosts` lives only in System32\drivers\etc — a direct-children search would miss it.
		await page.locator('.winx__search input').fill('hosts');
		await expect(row(page, 'hosts')).toBeVisible();
		await expect(page.locator('.winx__row', { hasText: 'hosts' }).locator('.winx__rowloc'))
			.toHaveText('in Windows \\ System32 \\ drivers \\ etc');

		// Every visible name still matches the query.
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
		expect(asc[0]).toBe('addins'); // first folder, case-insensitive ascending
		await page.locator('.winx__col--name').click(); // → descending
		const desc = await rowNames(page);
		expect(desc[0]).not.toBe(asc[0]);
		expect(desc[0]).toBe('WinSxS'); // last folder is now first
		// Folders precede files in BOTH directions: last row is always a file.
		await expect(page.locator('.winx__row').last().locator('.winx__cell--size')).not.toHaveText('');
	});

	test('clicking a nav-tree folder drives the right pane', async ({ page }) => {
		await page.locator('.winx__nav .stv__node-content', { hasText: 'System32' }).first().click();
		await expect(page.locator('.winx__address')).toContainText('System32');
		await expect(row(page, 'drivers')).toBeVisible();
	});

	test('right-click opens a context menu; Delete removes the item', async ({ page }) => {
		await row(page, 'Branding').click({ button: 'right' });
		const menu = page.locator('.winx__menu');
		await expect(menu).toBeVisible();
		await expect(menu.locator('.winx__menu-item', { hasText: 'Open' })).toBeVisible();
		await expect(menu.locator('.winx__menu-item', { hasText: 'Rename' })).toBeVisible();
		await menu.locator('.winx__menu-item', { hasText: 'Delete' }).click();
		await expect(row(page, 'Branding')).toHaveCount(0);
		await expect(menu).toHaveCount(0); // menu closed after action
	});

	test('context menu closes on Escape', async ({ page }) => {
		await row(page, 'Fonts').click({ button: 'right' });
		await expect(page.locator('.winx__menu')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('.winx__menu')).toHaveCount(0);
	});

	test('single click previews in the status bar; double click opens', async ({ page }) => {
		// Single click a file → its details appear in the status bar (debounced action).
		await row(page, 'explorer.exe').click();
		await expect(page.locator('.winx__status-info')).toContainText('explorer.exe — Application');
		// Double click a folder → navigates (the pending single-click preview is cancelled).
		await row(page, 'System32').dblclick();
		await expect(page.locator('.winx__address')).toContainText('System32');
	});

	test('New folder creates it (nav + contents); Delete removes it; tree stays expanded', async ({ page }) => {
		const navBefore = await page.locator('.winx__nav .stv__node').count();
		await page.locator('.winx__action', { hasText: 'New folder' }).click();
		await expect(row(page, 'New folder')).toBeVisible();
		// It also appears in the nav tree, and prior expansion is preserved (+1 node).
		await expect.poll(() => page.locator('.winx__nav .stv__node').count()).toBe(navBefore + 1);

		await page.locator('.winx__action', { hasText: 'Delete' }).click();
		await expect(row(page, 'New folder')).toHaveCount(0);
		await expect.poll(() => page.locator('.winx__nav .stv__node').count()).toBe(navBefore);
	});
});
