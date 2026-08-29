import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for the per-node drag/drop callbacks at /test/callbacks.
 *
 * Fixture data:
 *   1     Folder-A
 *   1.1   File-Normal          defaults (draggable, drop-allowed)
 *   1.2   File-Pinned          getIsDraggableCallback → false
 *   2     Folder-B
 *   2.1   ChildOnlyTarget      getAllowedDropPositionsCallback → ['child']
 *   2.2   BeforeAfterTarget    getAllowedDropPositionsCallback → ['before','after']
 *   2.3   NoDropTarget         getIsDropAllowedCallback → false (rejects all drops)
 *
 * Gap the existing /test/drag-drop spec already covers `allowedDropPositionsMember`
 * (data-field form). This spec covers the callback form plus per-node
 * `isDraggable: false` and per-node `isDropAllowed: false`, none of which had
 * desktop e2e assertions before.
 */

const PAGE = '/test/callbacks';

function nodeByPath(page: Page, path: string): Locator {
	return page.locator(`.stv__node[data-tree-path="${path}"]`).first();
}

function nodeRow(node: Locator): Locator {
	return node.locator('> .stv__node-row .stv__node-content').first();
}

async function gotoFixture(page: Page) {
	await page.goto(PAGE);
	await expect(page.locator('.stv__node').first()).toBeVisible();
}

async function dragNodeTo(
	src: Locator,
	dst: Locator,
	position: 'before' | 'after' | 'child'
) {
	const box = await dst.boundingBox();
	if (!box) throw new Error('Missing target boundingBox');
	let x: number;
	let y: number;
	if (position === 'child') {
		x = box.width * 0.8;
		y = box.height / 2;
	} else {
		x = box.width * 0.2;
		y = position === 'before' ? Math.max(1, box.height * 0.15) : box.height * 0.85;
	}
	await src.dragTo(dst, { targetPosition: { x, y } });
}

// ── isDraggable per-node opt-out (callback form) ─────────────────────────────

test.describe('isDraggable callback', () => {
	// Pointer-driven drag no longer uses the native `draggable` attribute; draggability is
	// signalled by the .stv__node-content--draggable class (cursor: grab + touch-action).
	test('normal node renders the draggable class', async ({ page }) => {
		await gotoFixture(page);
		const row = nodeRow(nodeByPath(page, '1.1'));
		await expect(row).toHaveClass(/stv__node-content--draggable/);
	});

	test('pinned node does NOT render the draggable class', async ({ page }) => {
		await gotoFixture(page);
		const row = nodeRow(nodeByPath(page, '1.2'));
		await expect(row).not.toHaveClass(/stv__node-content--draggable/);
	});

	test('attempting to drag a pinned node does NOT fire onNodeDrop', async ({ page }) => {
		await gotoFixture(page);
		await expect(page.getByTestId('drop-count')).toHaveText('0');

		// Try to drag File-Pinned onto Folder-B as child. Drag should be rejected
		// at the source because the row carries draggable="false" and ondragstart
		// gates on node.isDraggable — dataTransfer never gets the application
		// MIME type, so the receiving dragover is ignored and ondrop never fires.
		await dragNodeTo(nodeRow(nodeByPath(page, '1.2')), nodeRow(nodeByPath(page, '2')), 'child');

		await expect(page.getByTestId('drop-count')).toHaveText('0');
	});

	test('normal node CAN be dragged (control case)', async ({ page }) => {
		await gotoFixture(page);
		await expect(page.getByTestId('drop-count')).toHaveText('0');

		await dragNodeTo(nodeRow(nodeByPath(page, '1.1')), nodeRow(nodeByPath(page, '2')), 'child');

		await expect(page.getByTestId('drop-count')).toHaveText('1');
		await expect(page.getByTestId('drop-dragged')).toHaveText('File-Normal');
		await expect(page.getByTestId('drop-target')).toHaveText('Folder-B');
	});
});

// ── allowedDropPositions per-node restriction (callback form) ────────────────

test.describe('allowedDropPositions callback', () => {
	test('aiming at "before" on a ["child"]-only target snaps to "child"', async ({ page }) => {
		await gotoFixture(page);
		await expect(page.getByTestId('drop-count')).toHaveText('0');

		// Aim at the top-left (before zone) of ChildOnlyTarget — callback restricts
		// to ['child'] so the lib should coerce the position.
		await dragNodeTo(
			nodeRow(nodeByPath(page, '1.1')),
			nodeRow(nodeByPath(page, '2.1')),
			'before'
		);

		await expect(page.getByTestId('drop-count')).toHaveText('1');
		await expect(page.getByTestId('drop-target')).toHaveText('ChildOnlyTarget');
		await expect(page.getByTestId('drop-position')).toHaveText('child');
	});

	test('aiming at "child" on a ["before","after"] target snaps to before or after', async ({
		page
	}) => {
		await gotoFixture(page);

		// Aim at right half (child zone) — should snap to either before or after.
		await dragNodeTo(
			nodeRow(nodeByPath(page, '1.1')),
			nodeRow(nodeByPath(page, '2.2')),
			'child'
		);

		await expect(page.getByTestId('drop-count')).toHaveText('1');
		await expect(page.getByTestId('drop-target')).toHaveText('BeforeAfterTarget');
		const position = await page.getByTestId('drop-position').textContent();
		expect(['before', 'after']).toContain(position);
	});

	test('aiming at "before" on a ["before","after"] target stays "before" (allowed)', async ({
		page
	}) => {
		await gotoFixture(page);
		await dragNodeTo(
			nodeRow(nodeByPath(page, '1.1')),
			nodeRow(nodeByPath(page, '2.2')),
			'before'
		);
		await expect(page.getByTestId('drop-count')).toHaveText('1');
		await expect(page.getByTestId('drop-position')).toHaveText('before');
	});
});

// ── isDropAllowed per-node opt-out (callback form) ───────────────────────────

test.describe('isDropAllowed callback', () => {
	test('drop onto a node with isDropAllowed=false does NOT fire onNodeDrop', async ({ page }) => {
		await gotoFixture(page);
		await expect(page.getByTestId('drop-count')).toHaveText('0');

		// Drag File-Normal onto NoDropTarget — the dragover gate should reject
		// (no preventDefault), so the browser never fires a drop event.
		await dragNodeTo(nodeRow(nodeByPath(page, '1.1')), nodeRow(nodeByPath(page, '2.3')), 'child');

		await expect(page.getByTestId('drop-count')).toHaveText('0');
	});

	test('drop onto a normal node still fires onNodeDrop (control case)', async ({ page }) => {
		await gotoFixture(page);
		await expect(page.getByTestId('drop-count')).toHaveText('0');

		await dragNodeTo(nodeRow(nodeByPath(page, '1.1')), nodeRow(nodeByPath(page, '2')), 'child');

		await expect(page.getByTestId('drop-count')).toHaveText('1');
		await expect(page.getByTestId('drop-target')).toHaveText('Folder-B');
	});
});
