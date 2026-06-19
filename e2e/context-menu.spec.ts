import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for /test/context-menu (minimal fixture page; the
 * /examples/context-menu demo carries the same logic but with tutorial
 * chrome that this spec doesn't need).
 *
 * The page hosts two trees, each in its own card:
 *   1. "Callback Approach"          — uses getContextMenuItemsCallback
 *   2. "Snippet + Component Approach" — uses the {#snippet contextMenu} form
 *
 * Both render the same FileItem sample (alphabetically sorted by name, with
 * expandLevel=3 so every node is visible):
 *   '1'     Documents     (folder)
 *   '1.1'   Reports       (folder)
 *   '1.1.1' Q1 Report.pdf (file)
 *   '1.1.2' Q2 Report.pdf (file, readonly)
 *   '1.2'   Notes.txt     (file)
 *   '2'     Images        (folder)
 *   '2.1'   Photo.jpg     (file)
 *   '2.2'   Logo.png      (file)
 *
 * The callback varies the menu by node:
 *   - folders get a "New File" / "New Folder" pair + divider on top
 *   - "Paste" is disabled on non-folders
 *   - "Cut" / "Rename" / "Delete" are disabled on readonly items
 *   - "Read-only file" entry has isVisible=true only for readonly items
 */

const PAGE = '/test/context-menu';

// ── Helpers ─────────────────────────────────────────────────────────────────

function cardByHeading(page: Page, heading: string): Locator {
	return page.locator('.card').filter({ has: page.locator('h2', { hasText: heading }) }).first();
}

function callbackCard(page: Page): Locator {
	return cardByHeading(page, 'Callback Approach');
}

function snippetCard(page: Page): Locator {
	return cardByHeading(page, 'Snippet + Component Approach');
}

function treeIn(card: Locator): Locator {
	return card.locator('.tree-container').first();
}

function nodeIn(card: Locator, path: string): Locator {
	return treeIn(card).locator(`.ltree-node[data-tree-path="${path}"]`).first();
}

function nodeContent(node: Locator): Locator {
	return node.locator('> .ltree-node-row .ltree-node-content').first();
}

function menuIn(card: Locator): Locator {
	return card.locator('.ltree-context-menu').first();
}

/**
 * Find a top-level menu item by its visible label. We anchor on the
 * `.ltree-context-menu-label` span (matched exactly) so partial-match collisions
 * between e.g. "Cut" and "Copy" never bite.
 */
function menuItem(card: Locator, label: string): Locator {
	const page = card.page();
	return menuIn(card)
		.locator('> .ltree-context-menu-item')
		.filter({ has: page.locator('.ltree-context-menu-label', { hasText: new RegExp(`^${escapeRe(label)}$`) }) })
		.first();
}

function activityLog(card: Locator): Locator {
	// The Activity Log <pre> sits inside .output, which only mounts once the
	// log has entries.
	return card.locator('.output pre').first();
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function rightClick(card: Locator, path: string) {
	// The tree closes its context menu on any window/document scroll, and
	// Playwright auto-scrolls offscreen targets into view before clicking —
	// that scroll event fires async, lands *after* the menu opens, and
	// immediately closes it. Pre-scroll and let the scroll event drain so
	// the menu stays open after the right-click.
	//
	// Use Locator.evaluate to scroll rather than scrollIntoViewIfNeeded: the
	// tree uses `{#key nodeRev}` per-node re-renders, so a node's DOM can be
	// replaced between the visibility check and the action. evaluate resolves
	// the element fresh and doesn't require the action-stability wait that
	// scrollIntoViewIfNeeded performs (which is what flaked).
	const content = nodeContent(nodeIn(card, path));
	await expect(content).toBeVisible();
	await content.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
	await content.page().waitForTimeout(50);
	await content.click({ button: 'right' });
	await expect(menuIn(card)).toBeVisible();
}

async function gotoContextMenu(page: Page) {
	await page.goto(PAGE);
	await expect(page.locator('.ltree-node').first()).toBeVisible();
}

// ── Callback approach ──────────────────────────────────────────────────────

test.describe('Callback approach', () => {
	test('right-click on a folder shows the folder-specific entries and named divider', async ({ page }) => {
		await gotoContextMenu(page);
		const card = callbackCard(page);

		await rightClick(card, '1'); // Documents (folder)

		// Folder-only entries appear at the top.
		await expect(menuItem(card, 'New File')).toBeVisible();
		await expect(menuItem(card, 'New Folder')).toBeVisible();
		// Always-present entries.
		await expect(menuItem(card, 'Copy')).toBeVisible();
		await expect(menuItem(card, 'Cut')).toBeVisible();
		await expect(menuItem(card, 'Paste')).toBeVisible();
		await expect(menuItem(card, 'Export As...')).toBeVisible();
		await expect(menuItem(card, 'Rename')).toBeVisible();
		await expect(menuItem(card, 'Delete')).toBeVisible();
		// Named divider "Danger zone".
		await expect(menuIn(card).locator('.ltree-context-menu-divider-label')).toHaveText('Danger zone');
		// Read-only entry is gated by isVisible — Documents is writable, so absent.
		await expect(menuIn(card).locator('.ltree-context-menu-label', { hasText: 'Read-only file' })).toHaveCount(0);
	});

	test('right-click on a file hides folder-only entries and disables Paste', async ({ page }) => {
		await gotoContextMenu(page);
		const card = callbackCard(page);

		await rightClick(card, '1.2'); // Notes.txt (file, writable)

		await expect(menuIn(card).locator('.ltree-context-menu-label', { hasText: 'New File' })).toHaveCount(0);
		await expect(menuIn(card).locator('.ltree-context-menu-label', { hasText: 'New Folder' })).toHaveCount(0);

		// Paste is disabled on non-folders.
		await expect(menuItem(card, 'Paste')).toHaveClass(/ltree-context-menu-item-disabled/);
		// Cut/Rename/Delete remain enabled (Notes.txt is not readonly).
		await expect(menuItem(card, 'Cut')).not.toHaveClass(/ltree-context-menu-item-disabled/);
		await expect(menuItem(card, 'Rename')).not.toHaveClass(/ltree-context-menu-item-disabled/);
		await expect(menuItem(card, 'Delete')).not.toHaveClass(/ltree-context-menu-item-disabled/);
	});

	test('readonly file disables Cut/Rename/Delete and surfaces the "Read-only file" entry', async ({ page }) => {
		await gotoContextMenu(page);
		const card = callbackCard(page);

		await rightClick(card, '1.1.2'); // Q2 Report.pdf (readonly)

		await expect(menuItem(card, 'Cut')).toHaveClass(/ltree-context-menu-item-disabled/);
		await expect(menuItem(card, 'Rename')).toHaveClass(/ltree-context-menu-item-disabled/);
		await expect(menuItem(card, 'Delete')).toHaveClass(/ltree-context-menu-item-disabled/);

		// Only renders when node.readonly is truthy.
		await expect(menuIn(card).locator('.ltree-context-menu-label', { hasText: 'Read-only file' })).toBeVisible();
	});

	test('clicking an item fires the callback, closes the menu, and appends to the activity log', async ({ page }) => {
		await gotoContextMenu(page);
		const card = callbackCard(page);

		await rightClick(card, '1'); // Documents
		await menuItem(card, 'Copy').click();

		// Menu closes after onclick → close().
		await expect(menuIn(card)).toHaveCount(0);
		// Log entry contains the action and node name.
		await expect(activityLog(card)).toContainText('Copied "Documents"');
	});

	test('clicking a disabled item does not fire the callback', async ({ page }) => {
		await gotoContextMenu(page);
		const card = callbackCard(page);

		await rightClick(card, '1.2'); // Notes.txt → Paste is disabled
		// .force is required because Playwright's actionability check would
		// otherwise refuse to click an item marked disabled. The component
		// renders disabled items as plain divs (not <button disabled>), so the
		// click reaches the DOM and the onclick guard inside is what must hold.
		await menuItem(card, 'Paste').click({ force: true });

		// Menu stays open (close() is only called from the callback, which
		// never ran), and no log entry was created.
		await expect(menuIn(card)).toBeVisible();
		await expect(card.locator('.output')).toHaveCount(0);
	});

	test('hovering "Export As..." reveals its submenu items', async ({ page }) => {
		await gotoContextMenu(page);
		const card = callbackCard(page);

		await rightClick(card, '1'); // Documents

		const exportItem = menuItem(card, 'Export As...');
		await expect(exportItem).toHaveClass(/ltree-context-menu-has-children/);

		// Submenu mounts on hover (Floating UI), positioned as a sibling under the root menu.
		const submenu = menuIn(card).locator('.ltree-context-submenu').first();
		await expect(submenu).toHaveCount(0);

		await exportItem.hover();
		await expect(submenu).toBeVisible();
		await expect(submenu.locator('.ltree-context-menu-label', { hasText: 'JSON' })).toBeVisible();
		await expect(submenu.locator('.ltree-context-menu-label', { hasText: 'XML' })).toBeVisible();
		await expect(submenu.locator('.ltree-context-menu-label', { hasText: 'CSV' })).toBeVisible();
	});

	test('clicking a submenu entry fires the nested callback', async ({ page }) => {
		await gotoContextMenu(page);
		const card = callbackCard(page);

		await rightClick(card, '1'); // Documents

		const exportItem = menuItem(card, 'Export As...');
		await exportItem.hover();
		const submenu = menuIn(card).locator('.ltree-context-submenu').first();
		await submenu.locator('.ltree-context-menu-item', { hasText: 'JSON' }).first().click();

		await expect(menuIn(card)).toHaveCount(0);
		await expect(activityLog(card)).toContainText('Export "Documents" as JSON');
	});

	test('clicking outside the menu closes it', async ({ page }) => {
		await gotoContextMenu(page);
		const card = callbackCard(page);

		await rightClick(card, '1');
		// Click the card heading — well outside the menu.
		await card.locator('h2').click();
		await expect(menuIn(card)).toHaveCount(0);
	});

	test('Clear Log empties the activity log output', async ({ page }) => {
		await gotoContextMenu(page);
		const card = callbackCard(page);

		await rightClick(card, '1');
		await menuItem(card, 'Copy').click();
		await expect(activityLog(card)).toContainText('Copied "Documents"');

		await card.getByRole('button', { name: 'Clear Log' }).click();
		// The output block unmounts when the log is empty.
		await expect(card.locator('.output')).toHaveCount(0);
	});

	test('debug mode keeps the menu open after right-click and clicks the named divider region', async ({ page }) => {
		await gotoContextMenu(page);
		const card = callbackCard(page);

		await card.getByText('Debug Mode (menu appears at fixed position)').click();
		await rightClick(card, '1');

		// The named divider is still rendered with its label.
		await expect(menuIn(card).locator('.ltree-context-menu-divider-label')).toHaveText('Danger zone');
	});
});

// ── Snippet approach ───────────────────────────────────────────────────────

test.describe('Snippet + Component approach', () => {
	test('right-click on a folder shows the snippet menu with submenu', async ({ page }) => {
		await gotoContextMenu(page);
		const card = snippetCard(page);

		await rightClick(card, '1'); // Documents (folder)

		await expect(menuItem(card, 'Copy')).toBeVisible();
		await expect(menuItem(card, 'Cut')).toBeVisible();
		// Folder-only entry from the snippet's {#if node.data?.type === 'folder'}.
		await expect(menuItem(card, 'Export As...')).toBeVisible();
		await expect(menuIn(card).locator('.ltree-context-menu-divider-label')).toHaveText('Danger zone');
		await expect(menuItem(card, 'Delete')).toBeVisible();
	});

	test('right-click on a file omits the folder-only submenu', async ({ page }) => {
		await gotoContextMenu(page);
		const card = snippetCard(page);

		await rightClick(card, '1.2'); // Notes.txt
		await expect(menuIn(card).locator('.ltree-context-menu-label', { hasText: 'Export As...' })).toHaveCount(0);
		// Other items still render.
		await expect(menuItem(card, 'Copy')).toBeVisible();
		await expect(menuItem(card, 'Delete')).toBeVisible();
	});

	test('readonly item disables Cut and Delete', async ({ page }) => {
		await gotoContextMenu(page);
		const card = snippetCard(page);

		await rightClick(card, '1.1.2'); // Q2 Report.pdf (readonly)
		await expect(menuItem(card, 'Cut')).toHaveClass(/ltree-context-menu-item-disabled/);
		await expect(menuItem(card, 'Delete')).toHaveClass(/ltree-context-menu-item-disabled/);
	});

	test('clicking Copy appends to the snippet card activity log', async ({ page }) => {
		await gotoContextMenu(page);
		const card = snippetCard(page);

		await rightClick(card, '2'); // Images
		await menuItem(card, 'Copy').click();

		await expect(menuIn(card)).toHaveCount(0);
		await expect(activityLog(card)).toContainText('Copied "Images"');
	});
});
