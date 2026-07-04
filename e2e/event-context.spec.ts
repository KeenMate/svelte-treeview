import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E that asserts the EXACT context object each on* EVENT receives on
 * /test/event-context — the field-level contract of the enriched event surface:
 *   - NodeRef (onNodeClick/onNodeDoubleClick): path, node, parent, siblings.
 *   - NodeDragContext (onNodeDragStart/onNodeDragOver): NodeRef + event + dragged[].
 *   - NodeDropContext (onNodeDrop): source, target, dragged[], dropped[]|null, position, operation.
 *   - ClipboardEventContext (onCopy/onCut/onDelete) + SelectionChangeContext (onHighlight/Selection).
 *   - single-fire semantics: a drag fires once; `dragged` carries the full multi-set.
 *   - `dropped` is populated for auto-handled same-tree ops, null cross-tree.
 */

const PAGE = '/test/event-context';

function treeA(page: Page) {
	return page.getByTestId('tree-a').locator('.stv__container').first();
}
function treeB(page: Page) {
	return page.getByTestId('tree-b').locator('.stv__container').first();
}
function nodeA(page: Page, name: string): Locator {
	return treeA(page).locator(`[data-name="${name}"]`).first();
}
// The draggable .stv__node-content, addressed by the stable data-tree-path (paths below).
function rowA(page: Page, path: string): Locator {
	return treeA(page).locator(`.stv__node[data-tree-path="${path}"] > .stv__node-row .stv__node-content`).first();
}
function rowB(page: Page, path: string): Locator {
	return treeB(page).locator(`.stv__node[data-tree-path="${path}"] > .stv__node-row .stv__node-content`).first();
}
function checkboxA(page: Page, path: string): Locator {
	return treeA(page).locator(`.stv__node[data-tree-path="${path}"] > .stv__node-row .stv__checkbox`).first();
}
async function clickA(page: Page, name: string) {
	await nodeA(page, name).click();
	await treeA(page).focus();
}
async function ctrlClickA(page: Page, name: string) {
	await nodeA(page, name).click({ modifiers: ['Control'] });
	await treeA(page).focus();
}
async function readLog(page: Page, testid: string): Promise<any[]> {
	const txt = await page.getByTestId(testid).textContent();
	return JSON.parse(txt || '[]');
}
const sorted = (a: string[]) => [...a].sort();

/** Drag src → dst aiming at a quadrant so the lib resolves before/after/child deterministically.
 *  `force` skips Playwright's actionability/stability wait — needed when the highlight re-render
 *  (multi-drag) reflows the target and the auto-wait would otherwise time out. */
async function dragTo(
	src: Locator,
	dst: Locator,
	position: 'before' | 'after' | 'child',
	opts: { force?: boolean; timeout?: number } = {}
) {
	const box = await dst.boundingBox();
	if (!box) throw new Error('Missing target boundingBox');
	let x: number, y: number;
	if (position === 'child') {
		x = box.width * 0.8;
		y = box.height / 2;
	} else {
		x = box.width * 0.2;
		y = position === 'before' ? Math.max(1, box.height * 0.15) : box.height * 0.85;
	}
	await src.dragTo(dst, { targetPosition: { x, y }, force: opts.force, timeout: opts.timeout });
}

test.describe('Event contexts', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(PAGE);
		await page.waitForLoadState('networkidle');
		await page.locator('h1').first().waitFor();
		await page.getByTestId('clear').click();
	});

	test('onNodeClick carries a NodeRef with resolved parent + siblings', async ({ page }) => {
		await clickA(page, 'A1'); // path 1.1
		const click = await readLog(page, 'click-ctx');
		expect(click).toHaveLength(1);
		const c = click[0];
		expect(c.path).toBe('1.1');
		expect(c.node).toBe('1.1');
		expect(c.parent).toBe('1'); // A1's parent = A
		expect(sorted(c.siblings)).toEqual(['1.1', '1.2']); // A's children

		// click also fires onHighlightChange with the resolved node
		const hl = await readLog(page, 'highlight-ctx');
		expect(hl[hl.length - 1]).toEqual({ paths: ['1.1'], nodes: ['1.1'] });
	});

	test('onNodeDoubleClick carries a NodeRef', async ({ page }) => {
		await nodeA(page, 'A2').dblclick();
		const dbl = await readLog(page, 'dblclick-ctx');
		expect(dbl.length).toBeGreaterThanOrEqual(1);
		const d = dbl[dbl.length - 1];
		expect(d.node).toBe('1.2');
		expect(d.parent).toBe('1');
	});

	test('onSelectionChange carries { paths, nodes } for the checkbox set', async ({ page }) => {
		await checkboxA(page, '1.1').click(); // toggle A1's checkbox
		const sel = await readLog(page, 'selection-ctx');
		expect(sel.length).toBeGreaterThanOrEqual(1);
		expect(sel[sel.length - 1]).toEqual({ paths: ['1.1'], nodes: ['1.1'] });
	});

	test('onCopy / onCut carry { operation, paths, nodes }', async ({ page }) => {
		await clickA(page, 'A1');
		await page.keyboard.press('Control+c');
		expect((await readLog(page, 'copy-ctx'))[0]).toEqual({
			operation: 'copy',
			paths: ['1.1'],
			nodes: ['1.1']
		});

		await treeA(page).focus();
		await page.keyboard.press('Control+x');
		expect((await readLog(page, 'cut-ctx'))[0]).toEqual({
			operation: 'cut',
			paths: ['1.1'],
			nodes: ['1.1']
		});
	});

	test('onDelete carries { paths, nodes } (pre-removal snapshot, no operation)', async ({ page }) => {
		await clickA(page, 'A2'); // highlight 1.2
		await page.keyboard.press('Delete');
		const del = await readLog(page, 'delete-ctx');
		expect(del[0]).toEqual({ operation: null, paths: ['1.2'], nodes: ['1.2'] });
	});

	test('onNodeDragStart carries a NodeDragContext (event + single-item dragged)', async ({ page }) => {
		await dragTo(rowA(page, '1.1'), rowA(page, '2'), 'after');
		const ds = await readLog(page, 'dragstart-ctx');
		expect(ds.length).toBeGreaterThanOrEqual(1);
		const s = ds[0];
		expect(s.node).toBe('1.1'); // the grabbed node
		expect(s.hasEvent).toBe(true);
		expect(s.dragged).toHaveLength(1); // single drag
		expect(s.dragged[0].node).toBe('1.1');
	});

	test('onNodeDrop (same-tree move): source/target + dragged[1] + dropped[1] placed', async ({ page }) => {
		await dragTo(rowA(page, '1.1'), rowA(page, '2'), 'after');
		const drop = await readLog(page, 'drop-ctx');
		expect(drop).toHaveLength(1);
		const d = drop[0];
		expect(d.operation).toBe('move');
		expect(d.position).toBe('after');
		expect(d.target.node).toBe('2'); // dropped onto B (top-level, path 2 — unaffected by the move)
		expect(d.hasEvent).toBe(true);
		// single-origin: one dragged, and the library placed exactly one node (moved in place)
		expect(d.dragged).toHaveLength(1);
		expect(d.dropped).not.toBeNull();
		expect(d.dropped).toHaveLength(1);
	});

	test('multi-drag is single-origin: dragStart fires ONCE carrying the full dragged set', async ({ page }) => {
		await clickA(page, 'A1'); // highlight {1.1}
		await ctrlClickA(page, 'A2'); // highlight {1.1, 1.2}
		await page.getByTestId('clear').click();

		// A drag has one DOM origin, so onNodeDragStart fires once even for a 2-node
		// selection — `dragged` is how the whole set is exposed. (Chromium's synthetic
		// multi-source DnD doesn't reliably land the drop, and the drop's dragged/dropped
		// mechanics are already covered by the single + cross-tree cases above and by
		// drag-drop.spec.ts, so we fire dragstart directly and assert its contract.)
		const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
		await rowA(page, '1.1').dispatchEvent('dragstart', { dataTransfer });

		const ds = await readLog(page, 'dragstart-ctx');
		expect(ds).toHaveLength(1); // ONE fire, not one-per-selected-node
		expect(ds[0].node).toBe('1.1'); // lead = the grabbed node
		expect(sorted(ds[0].dragged.map((r: any) => r.node))).toEqual(['1.1', '1.2']); // full set
	});

	test('cross-tree drop: source resolves to the origin path, dropped is null (consumer inserts)', async ({ page }) => {
		await dragTo(rowA(page, '1.1'), rowB(page, '1'), 'child');
		const drop = await readLog(page, 'drop-ctx');
		expect(drop).toHaveLength(1);
		const d = drop[0];
		expect(d.source.node).toBe('1.1'); // the dragged node from tree A
		expect(d.target.node).toBe('1'); // T in tree B
		expect(d.dragged).toHaveLength(1);
		expect(d.dropped).toBeNull(); // library did NOT place it — cross-tree, consumer owns insertion

		// Cross-tree MULTI-drag (dragged carries the WHOLE source set, not just the lead)
		// is the conjunction of two paths that ARE covered here: the source PUBLISHES the
		// full set on drag start (see 'multi-drag is single-origin' → dragged=[1.1,1.2]),
		// and the cross-tree drop READS the published set via getDragSet (this test's
		// dragged=[1.1] round-trips a 1-element set). It isn't asserted end-to-end because
		// a multi-highlight cross-tree drop doesn't land under Playwright/Chromium — same
		// synthetic-DnD limitation as the multi-source case above.
	});
});
