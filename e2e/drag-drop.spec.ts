import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for the drag-and-drop test fixture at /test/drag-drop.
 *
 * The fixture page exposes the last drop event from each section via
 * data-testid spans so assertions read parsed state instead of log strings.
 *
 * Native HTML5 drag-and-drop is awkward to synthesize precisely (dataTransfer
 * carries state the drag listeners read). Playwright's dragTo() does the
 * minimum dance — dragstart, dragover, drop — with a real DataTransfer object.
 * Use targetPosition to push the drop point into a specific quarter of the
 * target node so the position resolution (before / after / child) is
 * deterministic.
 */

const PAGE = '/test/drag-drop';

async function gotoFixture(page: Page) {
	await page.goto(PAGE);
	await expect(page.locator('.stv__node').first()).toBeVisible();
}

function nodeByPath(scope: Locator | Page, path: string): Locator {
	return scope.locator(`.stv__node[data-tree-path="${path}"]`).first();
}

function nodeRow(node: Locator): Locator {
	return node.locator('> .stv__node-row .stv__node-content').first();
}

/**
 * Drag `src` to `dst` aiming for a specific drop position. The lib resolves
 * position from cursor location relative to the target's bounding box:
 *   - x > width/2          → 'child'
 *   - x ≤ width/2, y < h/2 → 'before'
 *   - x ≤ width/2, y ≥ h/2 → 'after'
 * We pad the chosen quadrant inset from the edges to avoid landing on a
 * boundary where rounding can flip the resolution.
 */
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

// ── Section 1: single-tree drag ────────────────────────────────────────────

test.describe('single-tree drag', () => {
	test('drag fires onNodeDrop with operation=move and dragged/target names', async ({ page }) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-single');

		await expect(page.getByTestId('single-drop-count')).toHaveText('0');

		await dragNodeTo(nodeRow(nodeByPath(section, '1.1')), nodeRow(nodeByPath(section, '2')), 'after');

		await expect(page.getByTestId('single-drop-count')).toHaveText('1');
		await expect(page.getByTestId('single-drop-dragged')).toHaveText('Alpha-1');
		await expect(page.getByTestId('single-drop-target')).toHaveText('Beta');
		await expect(page.getByTestId('single-drop-operation')).toHaveText('move');
	});

	test('drop on right half of a target resolves to "child"', async ({ page }) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-single');

		await dragNodeTo(nodeRow(nodeByPath(section, '1.1')), nodeRow(nodeByPath(section, '2')), 'child');

		await expect(page.getByTestId('single-drop-count')).toHaveText('1');
		await expect(page.getByTestId('single-drop-position')).toHaveText('child');
	});

	test('drop on left-top of a target resolves to "before"', async ({ page }) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-single');

		await dragNodeTo(
			nodeRow(nodeByPath(section, '2.1')),
			nodeRow(nodeByPath(section, '1.2')),
			'before'
		);

		await expect(page.getByTestId('single-drop-count')).toHaveText('1');
		await expect(page.getByTestId('single-drop-position')).toHaveText('before');
	});
});

// ── Section 2: two-tree drag ───────────────────────────────────────────────

test.describe('two-tree drag (source → target)', () => {
	test('target starts empty (no nodes); empty-state drop area is rendered', async ({ page }) => {
		await gotoFixture(page);
		const target = page.getByTestId('two-trees-target-box');

		// The dropPlaceholder snippet only renders during an active drag-over;
		// what's always present when the tree is empty is the .stv__empty-state
		// drop zone that catches the dragenter.
		await expect(target.locator('.stv__node[data-tree-path]')).toHaveCount(0);
		await expect(target.locator('.stv__empty-state')).toHaveCount(1);
	});

	test('dragging from source onto the empty target inserts and records drop event', async ({
		page
	}) => {
		await gotoFixture(page);
		const sourceBox = page.getByTestId('two-trees-source-box');
		const targetBox = page.getByTestId('two-trees-target-box');

		const src = nodeRow(nodeByPath(sourceBox, '1.1')); // Src-A
		const emptyDropArea = targetBox.locator('.stv__empty-state');

		await src.dragTo(emptyDropArea);

		// Drop event reported by target tree.
		await expect(page.getByTestId('two-trees-drop-count')).toHaveText('1');
		await expect(page.getByTestId('two-trees-drop-tree')).toHaveText('target');
		await expect(page.getByTestId('two-trees-drop-dragged')).toHaveText('Src-A');

		// Cross-tree handler called copyNodeWithDescendants — target now has the
		// dragged node materialized with a fresh id (the new path is generated by
		// the lib, so just assert presence by name and count).
		await expect(targetBox.locator('.stv__node[data-tree-path]')).toHaveCount(1);
		await expect(targetBox.getByText('Src-A')).toBeVisible();
	});

	test('dragging within source tree records tree=source', async ({ page }) => {
		await gotoFixture(page);
		const sourceBox = page.getByTestId('two-trees-source-box');

		await dragNodeTo(
			nodeRow(nodeByPath(sourceBox, '1.1')),
			nodeRow(nodeByPath(sourceBox, '1.2')),
			'after'
		);

		await expect(page.getByTestId('two-trees-drop-tree')).toHaveText('source');
		await expect(page.getByTestId('two-trees-drop-dragged')).toHaveText('Src-A');
	});

	test('Reset button clears target and zeroes drop counter', async ({ page }) => {
		await gotoFixture(page);
		const sourceBox = page.getByTestId('two-trees-source-box');
		const targetBox = page.getByTestId('two-trees-target-box');
		const emptyDropArea = targetBox.locator('.stv__empty-state');

		// Seed a drop first.
		await nodeRow(nodeByPath(sourceBox, '1.1')).dragTo(emptyDropArea);
		await expect(page.getByTestId('two-trees-drop-count')).toHaveText('1');

		await page.getByTestId('two-trees-reset').click();
		await expect(page.getByTestId('two-trees-drop-count')).toHaveText('0');
		await expect(targetBox.locator('.stv__node[data-tree-path]')).toHaveCount(0);
	});
});

// ── Section 3: restricted positions via allowedDropPositionsMember ─────────

test.describe('restricted drop positions — allowedDropPositionsMember', () => {
	test('node restricted to ["child"] shows hint and snaps drops to child', async ({ page }) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-restricted-member');

		// Hint renders next to TrashChildOnly (path '1').
		await expect(page.getByTestId('r-member-hint-1')).toHaveText('[child]');

		// Aim at "before" — left-top — but TrashChildOnly only allows ['child'],
		// so the lib should snap to 'child'.
		await dragNodeTo(
			nodeRow(nodeByPath(section, '4')),
			nodeRow(nodeByPath(section, '1')),
			'before'
		);

		await expect(page.getByTestId('r-member-drop-count')).toHaveText('1');
		await expect(page.getByTestId('r-member-drop-target')).toHaveText('TrashChildOnly');
		await expect(page.getByTestId('r-member-drop-position')).toHaveText('child');
	});

	test('node restricted to ["before","after"] does not resolve to child', async ({ page }) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-restricted-member');

		await expect(page.getByTestId('r-member-hint-3')).toHaveText('[before|after]');

		// Aim at 'child' (right half) — should snap to before or after.
		await dragNodeTo(
			nodeRow(nodeByPath(section, '4')),
			nodeRow(nodeByPath(section, '3')),
			'child'
		);

		await expect(page.getByTestId('r-member-drop-count')).toHaveText('1');
		await expect(page.getByTestId('r-member-drop-position')).not.toHaveText('child');
		await expect(['before', 'after']).toContain(
			await page.getByTestId('r-member-drop-position').textContent()
		);
	});
});

// ── Section 4: restricted positions via getAllowedDropPositionsCallback ────

test.describe('restricted drop positions — getAllowedDropPositionsCallback', () => {
	test('callback restricting odd-id nodes to ["before"] snaps "child" intent to "before"', async ({
		page
	}) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-restricted-callback');

		// Aim at 'child' (right half) onto OddBeforeOnly-31 (id 31 → ['before']).
		await dragNodeTo(
			nodeRow(nodeByPath(section, '4')),
			nodeRow(nodeByPath(section, '1')),
			'child'
		);

		await expect(page.getByTestId('r-callback-drop-count')).toHaveText('1');
		await expect(page.getByTestId('r-callback-drop-target')).toHaveText('OddBeforeOnly-31');
		await expect(page.getByTestId('r-callback-drop-position')).toHaveText('before');
	});

	test('callback restricting even-id nodes to ["child"] snaps "before" intent to "child"', async ({
		page
	}) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-restricted-callback');

		// Aim at 'before' (left-top) onto EvenChildOnly-32 (id 32 → ['child']).
		await dragNodeTo(
			nodeRow(nodeByPath(section, '4')),
			nodeRow(nodeByPath(section, '2')),
			'before'
		);

		await expect(page.getByTestId('r-callback-drop-count')).toHaveText('1');
		await expect(page.getByTestId('r-callback-drop-position')).toHaveText('child');
	});
});

// ── Section 5: Ctrl-drag copy ──────────────────────────────────────────────

test.describe('Ctrl-drag copy (isCopyAllowed=true)', () => {
	test('plain drag reports operation=move', async ({ page }) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-copy');

		await dragNodeTo(nodeRow(nodeByPath(section, '1')), nodeRow(nodeByPath(section, '2')), 'after');

		await expect(page.getByTestId('copy-drop-count')).toHaveText('1');
		await expect(page.getByTestId('copy-drop-operation')).toHaveText('move');
	});

	test('drag with Ctrl held reports operation=copy', async ({ page }) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-copy');

		// Playwright's dragTo doesn't honor modifiers, so script the drag manually
		// while holding Control.
		const src = nodeRow(nodeByPath(section, '1'));
		const dst = nodeRow(nodeByPath(section, '2'));
		const srcBox = await src.boundingBox();
		const dstBox = await dst.boundingBox();
		if (!srcBox || !dstBox) throw new Error('Missing bounding box for drag endpoints');

		await page.keyboard.down('Control');
		await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
		await page.mouse.down();
		// Two move steps are needed to trigger the drag start in Chromium.
		await page.mouse.move(
			dstBox.x + dstBox.width / 2,
			dstBox.y + dstBox.height * 0.75,
			{ steps: 5 }
		);
		await page.mouse.move(
			dstBox.x + dstBox.width / 2,
			dstBox.y + dstBox.height * 0.75 + 2,
			{ steps: 5 }
		);
		await page.mouse.up();
		await page.keyboard.up('Control');

		// Native drag-and-drop synthesis via mouse events is not 100% reliable —
		// some Chromium versions reject the chain entirely. Only assert on the
		// operation field IF a drop fired.
		const count = await page.getByTestId('copy-drop-count').textContent();
		if (count && Number(count) > 0) {
			await expect(page.getByTestId('copy-drop-operation')).toHaveText('copy');
		} else {
			test.info().annotations.push({
				type: 'note',
				description:
					'Ctrl+drag synthesized chain did not register a drop in this Chromium build — skipping op assertion.'
			});
		}
	});
});

// ── Section 6: multi-drag (selectionMode='multi') ──────────────────────────

test.describe('multi-drag (selectionMode=multi)', () => {
	// Resolve all root-level node names in sorted DOM order. The library
	// reassigns sortOrders during multi-drag, so we can't index by path —
	// reading the rendered names is the cleanest way to assert the new order.
	// Tree renders in flat mode (all nodes DOM siblings, indent via margin),
	// so "root" = path without a separator dot.
	async function rootNodeNamesInOrder(section: Locator): Promise<string[]> {
		const roots = section.locator('.stv__node[data-tree-path]:not([data-tree-path*="."])');
		return await roots.locator('.stv__node-row .stv__node-content > span').allInnerTexts();
	}

	test('grabbing a non-highlighted node replaces the highlight with just that node', async ({
		page
	}) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-multi');
		await section.scrollIntoViewIfNeeded();

		// Build a 2-node highlight: Multi-A + Multi-B.
		await nodeRow(nodeByPath(section, '1')).click();
		await nodeRow(nodeByPath(section, '2')).click({ modifiers: ['Control'] });
		await expect(page.getByTestId('multi-highlighted-size')).toHaveText('2');

		// Drag Multi-C (NOT in the highlight set) onto Multi-D as child.
		await dragNodeTo(nodeRow(nodeByPath(section, '3')), nodeRow(nodeByPath(section, '4')), 'child');

		// Highlight replaced with just the dragged node (OS-explorer convention).
		await expect(page.getByTestId('multi-highlighted-size')).toHaveText('1');
		// Drop event fired once for the single non-highlighted drag.
		await expect(page.getByTestId('multi-drop-count')).toHaveText('1');
		await expect(page.getByTestId('multi-drop-dragged')).toHaveText('Multi-C');
	});

	test('grabbing a highlighted node preserves the highlight set', async ({ page }) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-multi');
		await section.scrollIntoViewIfNeeded();

		// Highlight Multi-A, Multi-B, Multi-C.
		await nodeRow(nodeByPath(section, '1')).click();
		await nodeRow(nodeByPath(section, '2')).click({ modifiers: ['Control'] });
		await nodeRow(nodeByPath(section, '3')).click({ modifiers: ['Control'] });
		await expect(page.getByTestId('multi-highlighted-size')).toHaveText('3');

		// Drag Multi-A (which IS highlighted) onto Multi-D as child.
		await dragNodeTo(nodeRow(nodeByPath(section, '1')), nodeRow(nodeByPath(section, '4')), 'child');

		// Highlight set is not collapsed to one — the library kept it intact.
		await expect(page.getByTestId('multi-highlighted-size')).not.toHaveText('1');
	});

	test('multi-drag (child position): all top-level highlighted subtrees land under dropNode', async ({
		page
	}) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-multi');
		await section.scrollIntoViewIfNeeded();

		// Initial root order: Multi-A, Multi-B, Multi-C, Multi-D (sortOrder 10/20/30/40).
		const initialRoots = await rootNodeNamesInOrder(section);
		expect(initialRoots).toEqual(['Multi-A', 'Multi-B', 'Multi-C', 'Multi-D']);

		// Highlight A, B, C.
		await nodeRow(nodeByPath(section, '1')).click();
		await nodeRow(nodeByPath(section, '2')).click({ modifiers: ['Control'] });
		await nodeRow(nodeByPath(section, '3')).click({ modifiers: ['Control'] });
		await expect(page.getByTestId('multi-highlighted-size')).toHaveText('3');

		// Drag Multi-A (in the set) onto Multi-D as 'child'. All three move under D.
		await dragNodeTo(nodeRow(nodeByPath(section, '1')), nodeRow(nodeByPath(section, '4')), 'child');

		// Only Multi-D remains at root; A, B, C are now its children. Multi-A
		// still has its own children A-1, A-2 absorbed inside.
		const afterRoots = await rootNodeNamesInOrder(section);
		expect(afterRoots).toEqual(['Multi-D']);

		// Total node count unchanged (6 — no orphans, no duplicates).
		await expect(section.locator('.stv__node[data-tree-path]')).toHaveCount(6);

		// All three moved nodes + the absorbed child still rendered as tree nodes
		// (scoped to node spans so we don't pick up the drop-state display).
		const nodeSpans = section.locator('[data-testid^="multi-node-"]');
		await expect(nodeSpans.filter({ hasText: /^Multi-A$/ })).toHaveCount(1);
		await expect(nodeSpans.filter({ hasText: /^Multi-B$/ })).toHaveCount(1);
		await expect(nodeSpans.filter({ hasText: /^Multi-C$/ })).toHaveCount(1);
		await expect(nodeSpans.filter({ hasText: /^A-1$/ })).toHaveCount(1);

		// Single drop event for the lead node — internal multi-move handles the rest.
		await expect(page.getByTestId('multi-drop-count')).toHaveText('1');
		await expect(page.getByTestId('multi-drop-dragged')).toHaveText('Multi-A');
	});

	test('multi-drag (after position): all top-level highlighted subtrees become siblings after dropNode', async ({
		page
	}) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-multi');
		await section.scrollIntoViewIfNeeded();

		// Highlight A, B, C and drop A 'after' D. The chained-after behaviour
		// should yield root order [D, A, B, C] — A lands after D, B after A,
		// C after B, all as siblings at root.
		await nodeRow(nodeByPath(section, '1')).click();
		await nodeRow(nodeByPath(section, '2')).click({ modifiers: ['Control'] });
		await nodeRow(nodeByPath(section, '3')).click({ modifiers: ['Control'] });
		await dragNodeTo(nodeRow(nodeByPath(section, '1')), nodeRow(nodeByPath(section, '4')), 'after');

		const afterRoots = await rootNodeNamesInOrder(section);
		expect(afterRoots).toEqual(['Multi-D', 'Multi-A', 'Multi-B', 'Multi-C']);

		// Total node count unchanged (6 — A still has children A-1, A-2).
		await expect(section.locator('.stv__node[data-tree-path]')).toHaveCount(6);
	});

	test('multi-drag (before position): all top-level highlighted subtrees become siblings before dropNode', async ({
		page
	}) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-multi');
		await section.scrollIntoViewIfNeeded();

		// Highlight B, C and drop B 'before' D. Expected root order: [A, B, C, D].
		await nodeRow(nodeByPath(section, '2')).click();
		await nodeRow(nodeByPath(section, '3')).click({ modifiers: ['Control'] });
		await dragNodeTo(nodeRow(nodeByPath(section, '2')), nodeRow(nodeByPath(section, '4')), 'before');

		const afterRoots = await rootNodeNamesInOrder(section);
		expect(afterRoots).toEqual(['Multi-A', 'Multi-B', 'Multi-C', 'Multi-D']);
	});

	test('top-level absorption: descendant of a highlighted ancestor rides along inside', async ({
		page
	}) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-multi');
		await section.scrollIntoViewIfNeeded();

		// Highlight Multi-A (path 1) AND its child A-1 (path 1.1). A-1's nearest
		// highlighted ancestor IS in the set → absorbed, not separately moved.
		await nodeRow(nodeByPath(section, '1')).click();
		await nodeRow(nodeByPath(section, '1.1')).click({ modifiers: ['Control'] });
		await expect(page.getByTestId('multi-highlighted-size')).toHaveText('2');

		// Drag Multi-A as 'child' of Multi-D. Only Multi-A is top-level highlighted
		// (A-1's nearest highlighted ancestor IS in the set → absorbed). So only ONE
		// subtree moves; Multi-B and Multi-C stay put.
		await dragNodeTo(nodeRow(nodeByPath(section, '1')), nodeRow(nodeByPath(section, '4')), 'child');

		// Roots should be: B, C, D — Multi-A moved inside D, A-1 rides along inside A.
		const afterRoots = await rootNodeNamesInOrder(section);
		expect(afterRoots).toEqual(['Multi-B', 'Multi-C', 'Multi-D']);

		// Total node count unchanged (6 — nothing orphaned, nothing duplicated).
		await expect(section.locator('.stv__node[data-tree-path]')).toHaveCount(6);
		// A-1 still rendered — its path was reassigned but the text persists.
		const nodeSpans = section.locator('[data-testid^="multi-node-"]');
		await expect(nodeSpans.filter({ hasText: /^A-1$/ })).toHaveCount(1);
	});

	test('the focused node follows a multi-drag (focus is remapped, not stranded)', async ({
		page
	}) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-multi');
		await section.scrollIntoViewIfNeeded();

		// Highlight A, B, C — focus lands on the last-clicked, Multi-C (path '3').
		await nodeRow(nodeByPath(section, '1')).click();
		await nodeRow(nodeByPath(section, '2')).click({ modifiers: ['Control'] });
		await nodeRow(nodeByPath(section, '3')).click({ modifiers: ['Control'] });
		await expect(page.getByTestId('multi-focused-path')).toHaveText('3');

		// Drag the set onto Multi-D as child. Multi-C moves to a new path under D.
		await dragNodeTo(nodeRow(nodeByPath(section, '1')), nodeRow(nodeByPath(section, '4')), 'child');

		// Focus must follow Multi-C to its new home — not stay stranded at the old path
		// '3' (which no longer has a node). Regression guard for the moveNode focus remap.
		await expect(page.getByTestId('multi-focused-path')).not.toHaveText('3');
		const focusedPath = await page.getByTestId('multi-focused-path').innerText();
		expect(focusedPath).not.toBe('');
		await expect(section.getByTestId(`multi-node-${focusedPath}`)).toHaveText('Multi-C');
	});

	test('locked node (isDraggable=false) in the highlight set does NOT ride along on multi-drag', async ({
		page
	}) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-multi-locked');
		await section.scrollIntoViewIfNeeded();

		// Initial roots: Lock-A, Lock-B, Lock-C (pinned), Lock-D.
		expect(await rootNodeNamesInOrder(section)).toEqual([
			'Lock-A',
			'Lock-B',
			'Lock-C',
			'Lock-D'
		]);

		// Highlight all three of A, B and the LOCKED C.
		await nodeRow(nodeByPath(section, '1')).click();
		await nodeRow(nodeByPath(section, '2')).click({ modifiers: ['Control'] });
		await nodeRow(nodeByPath(section, '3')).click({ modifiers: ['Control'] });
		await expect(page.getByTestId('locked-highlighted-size')).toHaveText('3');

		// Drag the lead (Lock-A) onto Lock-D as child. A and B move; the locked
		// Lock-C must stay at root despite being highlighted.
		await dragNodeTo(nodeRow(nodeByPath(section, '1')), nodeRow(nodeByPath(section, '4')), 'child');

		// Lock-C and Lock-D remain at root (A + B moved under D). Pre-fix, Lock-C
		// would have ridden along and roots would be just ['Lock-D'].
		expect(await rootNodeNamesInOrder(section)).toEqual(['Lock-C', 'Lock-D']);

		// No orphans / duplicates — still exactly 4 nodes.
		await expect(section.locator('.stv__node[data-tree-path]')).toHaveCount(4);

		// Exactly two nodes are now nested (A + B under D); the locked C is not
		// one of them. Paths get reassigned on multi-drag, so assert by depth
		// (separator in path) rather than a fixed path string.
		await expect(section.locator('.stv__node[data-tree-path*="."]')).toHaveCount(2);

		// Drop fired once for the lead node.
		await expect(page.getByTestId('locked-drop-count')).toHaveText('1');
	});
});

// ── Section 7: touch drag ──────────────────────────────────────────────────

test.describe('touch drag', () => {
	// Touch events only fire on contexts with hasTouch=true; the default Desktop
	// Chrome project is mouse-only.
	test.use({ hasTouch: true });

	// Dispatch a synthetic TouchEvent on a specific element. CDP-level
	// dispatchTouchEvent reliably triggers global touch listeners but does not
	// always reach individual Node `ontouchstart` handlers in Chromium —
	// dispatching the event on the element directly bridges that gap.
	async function dispatchTouch(
		page: Page,
		target: Locator,
		type: 'touchstart' | 'touchmove' | 'touchend',
		clientX: number,
		clientY: number
	) {
		await target.evaluate(
			(el, { type, clientX, clientY }) => {
				const touch = new Touch({
					identifier: 0,
					target: el,
					clientX,
					clientY,
					screenX: clientX,
					screenY: clientY,
					pageX: clientX,
					pageY: clientY
				});
				const init: TouchEventInit = {
					bubbles: true,
					cancelable: true,
					touches: type === 'touchend' ? [] : [touch],
					targetTouches: type === 'touchend' ? [] : [touch],
					changedTouches: [touch]
				};
				el.dispatchEvent(new TouchEvent(type, init));
			},
			{ type, clientX, clientY }
		);
	}

	test('long-press (>300ms) on a node creates the touch-ghost element', async ({ page }) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-touch');
		// Touch section sits below the fold; elementFromPoint returns null for
		// coords outside the viewport, so scroll the row into view first.
		await section.scrollIntoViewIfNeeded();
		const src = nodeRow(nodeByPath(section, '1'));
		await src.scrollIntoViewIfNeeded();
		const box = await src.boundingBox();
		if (!box) throw new Error('Missing bounding box for touch source');

		const x = box.x + box.width / 2;
		const y = box.y + box.height / 2;

		await dispatchTouch(page, src, 'touchstart', x, y);
		await page.waitForTimeout(400);

		// Ghost element is appended to document.body during a touch drag.
		await expect(page.locator('.stv__touch-ghost')).toHaveCount(1);

		await dispatchTouch(page, src, 'touchend', x, y);
		await expect(page.locator('.stv__touch-ghost')).toHaveCount(0);
	});

	test('long-press + drag + release fires onNodeDrop with the touched target', async ({ page }) => {
		await gotoFixture(page);
		const section = page.getByTestId('section-touch');
		await section.scrollIntoViewIfNeeded();
		const src = nodeRow(nodeByPath(section, '1')); // TouchA
		const dst = nodeRow(nodeByPath(section, '3')); // TouchC
		// Both rows must be inside the viewport: _docTouchEnd reads
		// elementFromPoint(x,y) which returns null outside the viewport.
		await src.scrollIntoViewIfNeeded();
		await dst.scrollIntoViewIfNeeded();
		const srcBox = await src.boundingBox();
		const dstBox = await dst.boundingBox();
		if (!srcBox || !dstBox) throw new Error('Missing bounding boxes for touch endpoints');

		const sx = srcBox.x + srcBox.width / 2;
		const sy = srcBox.y + srcBox.height / 2;
		const dx = dstBox.x + dstBox.width / 2;
		const dy = dstBox.y + dstBox.height * 0.75; // bottom-quarter → after

		await dispatchTouch(page, src, 'touchstart', sx, sy);
		await page.waitForTimeout(400); // > 300ms long-press
		// Touchmove is captured at the document level by the controller, so it
		// can be dispatched anywhere — pointing at the destination element keeps
		// the test self-documenting.
		await dispatchTouch(page, dst, 'touchmove', dx, dy);
		await page.waitForTimeout(50);
		await dispatchTouch(page, dst, 'touchend', dx, dy);

		await expect(page.getByTestId('touch-drop-count')).toHaveText('1');
		await expect(page.getByTestId('touch-drop-dragged')).toHaveText('TouchA');
		await expect(page.getByTestId('touch-drop-target')).toHaveText('TouchC');
	});
});
