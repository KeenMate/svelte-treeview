import { test, expect, Page } from '@playwright/test';

/**
 * E2E that asserts the EXACT context object each clipboard callback receives on
 * /test/clipboard-context — the field-level contract of the unified vocabulary:
 *   - NodeTransformContext (output + input transforms): operation, phase, isRoot, index,
 *     position, and the symmetric source/target groups ({ path, node, parent, siblings }).
 *   - BeforeCopyContext / BeforeDeleteContext ({ paths, nodes }), BeforePasteContext
 *     ({ operation, target: { path, node }, entries }).
 *   - onTreeKeydown ({ event, focusedNode, highlightedNodes, controller }).
 *   - same-tree source refs are LIVE; cross-tree source refs are null/[].
 */

const PAGE = '/test/clipboard-context';

function treeA(page: Page) {
	return page.getByTestId('tree-a').locator('.stv__container').first();
}
function treeB(page: Page) {
	return page.getByTestId('tree-b').locator('.stv__container').first();
}
function nodeA(page: Page, name: string) {
	return treeA(page).locator(`[data-name="${name}"]`).first();
}
function nodeB(page: Page, name: string) {
	return treeB(page).locator(`[data-name="${name}"]`).first();
}
async function clickA(page: Page, name: string) {
	await nodeA(page, name).click();
	await treeA(page).focus();
}
async function ctrlClickA(page: Page, name: string) {
	await nodeA(page, name).click({ modifiers: ['Control'] });
	await treeA(page).focus();
}
async function clickB(page: Page, name: string) {
	await nodeB(page, name).click();
	await treeB(page).focus();
}
async function readLog(page: Page, testid: string): Promise<any[]> {
	const txt = await page.getByTestId(testid).textContent();
	return JSON.parse(txt || '[]');
}
const sorted = (a: string[]) => [...a].sort();

test.describe('Clipboard callback contexts', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto(PAGE);
		await page.waitForLoadState('networkidle');
		await page.locator('h1').first().waitFor();
		await page.getByTestId('clear').click();
	});

	test('nodeOutputTransformationCallback: phase output, target+position null, live source', async ({
		page
	}) => {
		await clickA(page, 'A1'); // path 1.1
		await page.keyboard.press('Control+c');

		const copy = await readLog(page, 'copy-ctx');
		expect(copy).toHaveLength(1);
		const c = copy[0];
		expect(c.operation).toBe('copy');
		expect(c.phase).toBe('output');
		expect(c.isRoot).toBe(true);
		expect(c.index).toBe(0);
		expect(c.position).toBeNull();
		expect(c.target).toBeNull();
		expect(c.source.path).toBe('1.1');
		expect(c.source.node).toBe('1.1');
		expect(c.source.parent).toBe('1');
		expect(sorted(c.source.siblings)).toEqual(['1.1', '1.2']);

		// beforeCopy fired alongside with resolved nodes.
		const bc = await readLog(page, 'before-copy-ctx');
		expect(bc).toEqual([{ operation: 'copy', paths: ['1.1'], nodes: ['1.1'] }]);
	});

	test('cut routes through the output transform with operation=cut + beforeCut', async ({
		page
	}) => {
		await clickA(page, 'A1');
		await page.keyboard.press('Control+x');

		const copy = await readLog(page, 'copy-ctx');
		expect(copy[0].operation).toBe('cut');
		expect(copy[0].phase).toBe('output');

		const bcut = await readLog(page, 'before-cut-ctx');
		expect(bcut).toEqual([{ operation: 'cut', paths: ['1.1'], nodes: ['1.1'] }]);
	});

	test('paste (child) onto a folder: target.node = the folder, landing = its children', async ({
		page
	}) => {
		await clickA(page, 'A1'); // copy leaf 1.1
		await page.keyboard.press('Control+c');
		await clickA(page, 'B'); // folder path 2 (children: 2.1)
		await page.keyboard.press('Control+v');

		const paste = await readLog(page, 'paste-ctx');
		expect(paste).toHaveLength(1);
		const p = paste[0];
		expect(p.phase).toBe('input');
		expect(p.isRoot).toBe(true);
		expect(p.index).toBe(0);
		expect(p.position).toBe('child');
		// source still live (same tree)
		expect(p.source.node).toBe('1.1');
		// target = the node you aimed at, symmetric with source
		expect(p.target.path).toBe('2');
		expect(p.target.node).toBe('2');
		expect(p.target.parent).toBeNull(); // B is top-level → no parent
		expect(sorted(p.target.siblings)).toEqual(['1', '2']); // B's siblings = top-level
		expect(sorted(p.target.childrenOfNode)).toEqual(['2.1']); // child-paste landing set

		const bp = await readLog(page, 'before-paste-ctx');
		expect(bp).toEqual([{ operation: 'copy', target: { path: '2', node: '2' }, entries: ['1.1'] }]);
	});

	test('paste (after) a sibling: position=after, target.node = the anchor, landing = its siblings', async ({
		page
	}) => {
		await clickA(page, 'A1');
		await page.keyboard.press('Control+c');
		await page.getByTestId('pos-after').check();
		await clickA(page, 'A2'); // anchor 1.2
		await page.keyboard.press('Control+v');

		const p = (await readLog(page, 'paste-ctx'))[0];
		expect(p.position).toBe('after');
		expect(p.target.node).toBe('1.2');
		expect(p.target.parent).toBe('1'); // A2's parent
		expect(sorted(p.target.siblings)).toEqual(['1.1', '1.2']); // before/after landing = anchor's siblings
	});

	test('paste at the root: target.node/parent null, position child, top-level siblings', async ({
		page
	}) => {
		await clickA(page, 'A1');
		await page.keyboard.press('Control+c');
		await page.getByTestId('paste-at-root').check();
		await treeA(page).focus(); // checking the box stole focus — route the key back to the tree
		await page.keyboard.press('Control+v');

		const p = (await readLog(page, 'paste-ctx'))[0];
		expect(p.position).toBe('child');
		expect(p.target.path).toBe('');
		expect(p.target.node).toBeNull();
		expect(p.target.parent).toBeNull();
		expect(sorted(p.target.siblings)).toEqual(['1', '2']);
		expect(p.target.childrenOfNode).toBeNull();
	});

	test('subtree copy/paste: root isRoot=true, descendants isRoot=false sharing the root index', async ({
		page
	}) => {
		await clickA(page, 'A'); // folder path 1 with A1/A2
		await page.keyboard.press('Control+c');

		// output phase snapshots root + both descendants, all phase output, index 0
		const copy = await readLog(page, 'copy-ctx');
		expect(copy).toHaveLength(3);
		expect(copy.every((e) => e.phase === 'output' && e.index === 0)).toBe(true);
		expect(copy.filter((e) => e.isRoot).map((e) => e.dataName)).toEqual(['A']);
		expect(sorted(copy.filter((e) => !e.isRoot).map((e) => e.dataName))).toEqual(['A1', 'A2']);

		await clickA(page, 'B');
		await page.keyboard.press('Control+v');

		const paste = await readLog(page, 'paste-ctx');
		expect(paste).toHaveLength(3);
		const root = paste.find((e) => e.isRoot);
		expect(root.dataName).toBe('A');
		expect(root.position).toBe('child');
		expect(root.target.node).toBe('2');
		// descendants nest as children of the freshly-created root copy, sharing its index
		const descs = paste.filter((e) => !e.isRoot);
		expect(sorted(descs.map((e) => e.dataName))).toEqual(['A1', 'A2']);
		expect(descs.every((e) => e.position === 'child' && e.index === 0)).toBe(true);
		// their target.node is the new root copy (same for both), not the original folder
		const anchors = new Set(descs.map((e) => e.target.node));
		expect(anchors.size).toBe(1);
		expect([...anchors][0]).not.toBe('1');
	});

	test('beforeDeleteCallback receives { paths, nodes } of the top-level target', async ({
		page
	}) => {
		await clickA(page, 'A2'); // leaf 1.2
		await page.keyboard.press('Delete');
		const bd = await readLog(page, 'before-delete-ctx');
		expect(bd).toEqual([{ paths: ['1.2'], nodes: ['1.2'] }]);
	});

	test('onTreeKeydown carries the resolved focusedNode + highlightedNodes', async ({ page }) => {
		await clickA(page, 'A1'); // highlight {1.1}, focus 1.1
		await ctrlClickA(page, 'A2'); // highlight {1.1,1.2}, focus 1.2
		await page.keyboard.press('Control+c');

		const kd = await readLog(page, 'keydown-ctx');
		const last = kd[kd.length - 1];
		expect(last.key).toBe('c');
		expect(last.ctrl).toBe(true);
		expect(last.focusedNode).toBe('1.2');
		expect(sorted(last.highlightedNodes)).toEqual(['1.1', '1.2']);
	});

	test('cross-tree paste: source refs are null/[], target refs resolve in the destination tree', async ({
		page
	}) => {
		await clickA(page, 'A1'); // copy in tree A (treeId treeA)
		await page.keyboard.press('Control+c');
		await clickB(page, 'T'); // paste into tree B (treeId treeB), path 1
		await page.keyboard.press('Control+v');

		const p = (await readLog(page, 'paste-ctx'))[0];
		expect(p.phase).toBe('input');
		// cross-tree: the source node is gone from this tree's perspective
		expect(p.source.path).toBe('1.1'); // path is still carried
		expect(p.source.node).toBeNull();
		expect(p.source.parent).toBeNull();
		expect(p.source.siblings).toEqual([]);
		// target resolves against tree B
		expect(p.target.node).toBe('1');
		expect(sorted(p.target.siblings)).toEqual(['1']);
	});
});
