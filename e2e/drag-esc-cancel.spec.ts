import { test, expect } from '@playwright/test';

/**
 * Regression: Esc-cancelling a drag must restore the pre-drag highlight.
 *
 * On dragstart, TreeController._onNodeDragStart schedules a rAF that replaces
 * the highlight with the dragged node (OS-convention selection sync). If the
 * user then presses Esc, the browser fires dragend with dropEffect='none' and
 * _onNodeDragEnd must roll the highlight back. Without the rollback the user
 * is left with the dragged node visually selected (.stv__node-content--highlight-bold
 * sticks on the source row).
 *
 * Playwright's mouse helpers don't synthesize HTML5 drag events, so we
 * dispatch dragstart / dragend directly with a real DataTransfer. Esc-cancel
 * is modeled as dragend firing with the default dropEffect = 'none'. The
 * source element is re-queried after the rAF because TreeController's
 * tree.refresh() re-keys the row and the original DOM node is detached.
 */
test('Esc during drag restores the pre-drag highlight on the source row', async ({ page }) => {
	await page.goto('/examples/drag-drop');
	await page.waitForLoadState('networkidle');

	const fileARow = page
		.locator('.stv__container')
		.first()
		.locator('.stv__node[data-tree-path="1.1"] .stv__node-content')
		.first();
	await expect(fileARow).toBeVisible();

	const before = await fileARow.getAttribute('class');

	// Dispatch a real dragstart, wait for the controller's rAF selection sync to
	// run (the bug: that sync sets node.isHighlighted = true), then dispatch a
	// dragend with dropEffect='none' (which is what Esc-cancel produces).
	// Re-query the row after the rAF — the controller's tree.refresh() re-keys
	// the source node, so the original DOM element is detached and dragend on
	// it wouldn't bubble.
	await page.evaluate(async () => {
		const find = () =>
			document.querySelector(
				'.stv__container .stv__node[data-tree-path="1.1"] .stv__node-content'
			) as HTMLElement | null;
		const start = find();
		if (!start) throw new Error('source row missing');
		const dt = new DataTransfer();
		start.dispatchEvent(
			new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true })
		);
		await new Promise<void>((r) => requestAnimationFrame(() => r()));
		await new Promise<void>((r) => requestAnimationFrame(() => r()));
		const end = find();
		if (!end) throw new Error('source row missing after rAF');
		end.dispatchEvent(new DragEvent('dragend', { dataTransfer: dt, bubbles: true }));
	});
	await page.waitForTimeout(50);

	const after = await fileARow.getAttribute('class');

	expect(after).toBe(before);
});
