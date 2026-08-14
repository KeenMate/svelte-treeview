import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for /test/interaction (minimal fixture page; /examples/interaction
 * is the tutorial demo with the same logic plus persistence and styling controls).
 *
 * Three trees live on this page, sharing the shouldShowCheckboxes/checkboxMode
 * settings but each binding its own focusedNode / highlightedPaths /
 * selectedPaths Set. Locators are scoped by the card heading so the trees
 * don't collide.
 *
 * The page persists its settings to localStorage under
 * 'svelte-treeview-interaction-settings'. We clear that before every test
 * so persisted state from one test doesn't leak into the next.
 *
 * Sample data is sorted alphabetically by `name` (sortCallback). Useful paths:
 *   '1'   Documents     (level 1, root)
 *   '1.1' Work          (level 2)
 *   '1.2' Personal      (level 2)
 *   '2'   Downloads     (level 1)
 *   '2.1' Software      (level 2)   [alphabetically sorted children: Archives, Documents, Drivers, Fonts, Images, Media, Plugins, Software]
 *   '3'   Projects      (level 1)
 *   '3.1' Web App       (level 2)
 *
 * Click Behavior tree uses expandLevel=2 (levels 1 & 2 visible). Multi-Select
 * tree uses expandLevel=3 (everything visible).
 */

const PAGE = '/test/interaction';

// ── Helpers ─────────────────────────────────────────────────────────────────

function cardByHeading(page: Page, heading: string): Locator {
	return page.locator('.card').filter({ has: page.locator('h2', { hasText: heading }) }).first();
}

function clickBehaviorCard(page: Page): Locator {
	return cardByHeading(page, 'Click Behavior');
}

function multiSelectCard(page: Page): Locator {
	return cardByHeading(page, 'Multi-Select');
}

function keyboardNavCard(page: Page): Locator {
	return cardByHeading(page, 'Keyboard Navigation');
}

function nodeInCard(card: Locator, path: string): Locator {
	return card.locator(`.stv__node[data-tree-path="${path}"]`).first();
}

function nodeContent(node: Locator): Locator {
	return node.locator('> .stv__node-row .stv__node-content').first();
}

function checkboxLabelOf(node: Locator): Locator {
	return node.locator('> .stv__node-row .stv__checkbox').first();
}

function checkboxInputOf(node: Locator): Locator {
	return node.locator('> .stv__node-row .stv__checkbox input[type="checkbox"]').first();
}

/**
 * Read the <pre> immediately under a given output label inside a card. Output
 * blocks look like:
 *   <div class="output">
 *     <p class="output-label">Focused Node</p>
 *     <pre>...</pre>
 *   </div>
 */
function outputValue(card: Locator, label: string): Locator {
	return card
		.locator('.output')
		.filter({ has: card.page().locator('p.output-label', { hasText: label }) })
		.first()
		.locator('pre')
		.first();
}

async function gotoInteraction(page: Page) {
	// Clear persisted settings so each test sees defaults.
	await page.addInitScript(() => {
		try {
			localStorage.removeItem('svelte-treeview-interaction-settings');
		} catch {
			/* localStorage can be blocked in some contexts; nothing to clean. */
		}
	});
	await page.goto(PAGE);
	await expect(page.locator('.stv__node').first()).toBeVisible();
}

// ── Click Behavior tree ─────────────────────────────────────────────────────

test.describe('Click Behavior tree', () => {
	test('default mode (expand-and-focus): clicking a node sets focusedNode', async ({ page }) => {
		await gotoInteraction(page);
		const card = clickBehaviorCard(page);

		await expect(outputValue(card, 'Focused Node')).toHaveText('(none)');

		// 'Documents' is path 1. Click anywhere on the node content (not the
		// expand chevron) to ensure the focus path fires.
		await nodeContent(nodeInCard(card, '1')).click();

		// Output format: "📁 Documents (1)". Use substring match.
		await expect(outputValue(card, 'Focused Node')).toContainText('Documents');
		await expect(outputValue(card, 'Focused Node')).toContainText('(1)');
	});

	test('Ctrl+click adds paths to highlightedPaths', async ({ page }) => {
		await gotoInteraction(page);
		const card = clickBehaviorCard(page);

		// Highlighted starts empty.
		await expect(outputValue(card, 'Highlighted').first()).toContainText('(none');

		await nodeContent(nodeInCard(card, '1')).click(); // anchors focus on Documents
		await nodeContent(nodeInCard(card, '2')).click({ modifiers: ['Control'] }); // adds Downloads
		await nodeContent(nodeInCard(card, '3')).click({ modifiers: ['Control'] }); // adds Projects

		const highlighted = outputValue(card, 'Highlighted');
		// All three paths should be present; render order is the Set insertion order.
		await expect(highlighted).toContainText('1');
		await expect(highlighted).toContainText('2');
		await expect(highlighted).toContainText('3');
	});

	test('Clear All resets focus / highlighted / selected outputs', async ({ page }) => {
		await gotoInteraction(page);
		const card = clickBehaviorCard(page);

		await nodeContent(nodeInCard(card, '1')).click();
		await nodeContent(nodeInCard(card, '2')).click({ modifiers: ['Control'] });
		await expect(outputValue(card, 'Highlighted')).not.toContainText('(none');

		await card.getByRole('button', { name: 'Clear All' }).click();
		await expect(outputValue(card, 'Highlighted')).toContainText('(none');
		await expect(outputValue(card, 'Selected / Checked')).toContainText('(none');
	});

	test('toggling Show Checkboxes renders checkboxes on selectable nodes', async ({ page }) => {
		await gotoInteraction(page);
		const card = clickBehaviorCard(page);

		// Off by default → no checkbox label on root node.
		await expect(checkboxLabelOf(nodeInCard(card, '1'))).toHaveCount(0);

		// Tick the Show Checkboxes label (a top-level <label> in the controls block).
		await card.getByText('Show Checkboxes').click();

		await expect(checkboxLabelOf(nodeInCard(card, '1'))).toBeVisible();
		await expect(checkboxLabelOf(nodeInCard(card, '2'))).toBeVisible();
	});

	test('cascade mode: toggling a parent checkbox checks visible descendants', async ({ page }) => {
		await gotoInteraction(page);
		const card = clickBehaviorCard(page);

		// Turn on checkboxes, then switch to cascade.
		await card.getByText('Show Checkboxes').click();
		await card.getByLabel('Checkbox Mode:').selectOption('cascade');

		// Toggle 'Documents' (path 1) — has visible children 1.1 (Work) and 1.2 (Personal)
		// at expandLevel=2.
		await checkboxLabelOf(nodeInCard(card, '1')).click();

		const selected = outputValue(card, 'Selected / Checked');
		// Default cascadeSelectPolicy is 'rolled-up': a fully-checked subtree collapses to its
		// root, so the EMITTED set is just the parent path — not the flattened descendants.
		// (The 'all' projection is covered separately in e2e/checkbox-policy.spec.ts.)
		await expect(selected).toContainText('1');
		await expect(selected).not.toContainText('1.1');
		await expect(selected).not.toContainText('1.2');

		// Descendants are still visually checked (cascade behaviour) even though the emitted
		// set rolls them up — the parent's checkbox and both children reflect checked.
		await expect(checkboxInputOf(nodeInCard(card, '1'))).toBeChecked();
		await expect(checkboxInputOf(nodeInCard(card, '1.1'))).toBeChecked();
		await expect(checkboxInputOf(nodeInCard(card, '1.2'))).toBeChecked();
	});

	test('independent mode: checking children does NOT auto-check parent', async ({ page }) => {
		await gotoInteraction(page);
		const card = clickBehaviorCard(page);

		await card.getByText('Show Checkboxes').click();
		// Mode stays 'independent' (default).

		// Check all visible children of Documents.
		await checkboxLabelOf(nodeInCard(card, '1.1')).click();
		await checkboxLabelOf(nodeInCard(card, '1.2')).click();

		// Children are checked.
		await expect(checkboxInputOf(nodeInCard(card, '1.1'))).toBeChecked();
		await expect(checkboxInputOf(nodeInCard(card, '1.2'))).toBeChecked();

		// Parent must remain unchecked — independent mode means no ancestor sync.
		await expect(checkboxInputOf(nodeInCard(card, '1'))).not.toBeChecked();

		const selected = outputValue(card, 'Selected / Checked');
		await expect(selected).toContainText('1.1');
		await expect(selected).toContainText('1.2');
		await expect(selected).not.toContainText('(none)');
		// Parent path '1' should NOT be in the set. Exact-match the line content.
		await expect(selected).not.toHaveText(/(^|, )1(,|$)/);
	});

	test('shouldClickToggleCheckbox: plain click toggles checkbox and skips focus/highlight', async ({ page }) => {
		await gotoInteraction(page);
		const card = clickBehaviorCard(page);

		await card.getByText('Show Checkboxes').click();
		await card.getByText('Click row toggles checkbox').click();

		// Plain click on the node row.
		await nodeContent(nodeInCard(card, '1.1')).click();

		// Checkbox toggled.
		await expect(checkboxInputOf(nodeInCard(card, '1.1'))).toBeChecked();
		await expect(outputValue(card, 'Selected / Checked')).toContainText('1.1');

		// Focus and highlight stay empty — that's the whole point of the flag.
		await expect(outputValue(card, 'Focused Node')).toHaveText('(none)');
		await expect(outputValue(card, 'Highlighted')).toHaveText('(none)');

		// Click again unchecks it.
		await nodeContent(nodeInCard(card, '1.1')).click();
		await expect(checkboxInputOf(nodeInCard(card, '1.1'))).not.toBeChecked();
	});

	test('shouldClickToggleCheckbox: Ctrl+click still builds multi-highlight (modifier falls through)', async ({ page }) => {
		await gotoInteraction(page);
		const card = clickBehaviorCard(page);

		await card.getByText('Show Checkboxes').click();
		await card.getByText('Click row toggles checkbox').click();

		// Ctrl+click should bypass the checkbox-toggle gate and extend highlight.
		await nodeContent(nodeInCard(card, '1.1')).click({ modifiers: ['Control'] });
		await nodeContent(nodeInCard(card, '1.2')).click({ modifiers: ['Control'] });

		await expect(outputValue(card, 'Highlighted')).toContainText('1.1');
		await expect(outputValue(card, 'Highlighted')).toContainText('1.2');

		// Checkboxes untouched — modifier path doesn't toggle them.
		await expect(checkboxInputOf(nodeInCard(card, '1.1'))).not.toBeChecked();
		await expect(checkboxInputOf(nodeInCard(card, '1.2'))).not.toBeChecked();
	});

	test('expand mode: clicking does NOT update focusedNode', async ({ page }) => {
		await gotoInteraction(page);
		const card = clickBehaviorCard(page);

		await card.getByLabel('Click Behavior:').selectOption('expand');

		await nodeContent(nodeInCard(card, '1')).click();

		// In expand-only mode the focus binding never fires.
		await expect(outputValue(card, 'Focused Node')).toHaveText('(none)');
	});

	test('select mode: single click focuses without toggling expand state', async ({ page }) => {
		await gotoInteraction(page);
		const card = clickBehaviorCard(page);

		await card.getByLabel('Click Behavior:').selectOption('select');

		// 'Documents' (path 1) starts expanded because expandLevel=2.
		// Single-click in 'select' mode should NOT collapse it.
		const docs = nodeInCard(card, '1');
		await nodeContent(docs).click();

		// Output reflects focus.
		await expect(outputValue(card, 'Focused Node')).toContainText('Documents');

		// Child 'Work' (1.1) should still be visible — proves Documents stayed expanded.
		await expect(nodeInCard(card, '1.1')).toBeVisible();
	});

	// ── Expand-state coverage: each mode's contract for toggling expand ──────

	test('expand-and-focus mode: clicking a node toggles its expand state', async ({ page }) => {
		await gotoInteraction(page);
		const card = clickBehaviorCard(page);

		// Default mode = 'expand-and-focus'. 'Documents' (1) starts expanded
		// at expandLevel=2, so a click should collapse it.
		const docs = nodeInCard(card, '1');
		await expect(nodeInCard(card, '1.1')).toBeVisible(); // baseline

		await nodeContent(docs).click();
		await expect(nodeInCard(card, '1.1')).toBeHidden();  // collapsed

		await nodeContent(docs).click();
		await expect(nodeInCard(card, '1.1')).toBeVisible(); // expanded again
	});

	test('expand mode: clicking a node toggles its expand state', async ({ page }) => {
		await gotoInteraction(page);
		const card = clickBehaviorCard(page);

		await card.getByLabel('Click Behavior:').selectOption('expand');

		const docs = nodeInCard(card, '1');
		await expect(nodeInCard(card, '1.1')).toBeVisible();

		await nodeContent(docs).click();
		await expect(nodeInCard(card, '1.1')).toBeHidden();

		await nodeContent(docs).click();
		await expect(nodeInCard(card, '1.1')).toBeVisible();
	});

	test('select mode: double-click toggles expand state', async ({ page }) => {
		await gotoInteraction(page);
		const card = clickBehaviorCard(page);

		await card.getByLabel('Click Behavior:').selectOption('select');

		const docs = nodeInCard(card, '1');
		await expect(nodeInCard(card, '1.1')).toBeVisible();

		// Double-click should collapse (the OS-file-explorer pattern this mode
		// implements). Single-click only sets focus — see the test above.
		await nodeContent(docs).dblclick();
		await expect(nodeInCard(card, '1.1')).toBeHidden();

		await nodeContent(docs).dblclick();
		await expect(nodeInCard(card, '1.1')).toBeVisible();
	});
});

// ── Multi-Select tree ───────────────────────────────────────────────────────

test.describe('Multi-Select tree', () => {
	test('Ctrl+click on two nodes highlights both', async ({ page }) => {
		await gotoInteraction(page);
		const card = multiSelectCard(page);

		await nodeContent(nodeInCard(card, '1')).click();
		await nodeContent(nodeInCard(card, '3')).click({ modifiers: ['Control'] });

		const highlighted = outputValue(card, 'Highlighted');
		await expect(highlighted).toContainText('1');
		await expect(highlighted).toContainText('3');
	});

	test('Shift+click selects a visual range', async ({ page }) => {
		await gotoInteraction(page);
		const card = multiSelectCard(page);

		// Anchor on Documents (1), then Shift+click on Projects (3).
		// In visual mode (default), every visible node between them should be picked.
		await nodeContent(nodeInCard(card, '1')).click();
		await nodeContent(nodeInCard(card, '3')).click({ modifiers: ['Shift'] });

		const highlighted = outputValue(card, 'Highlighted');
		// Anchor + endpoint at minimum.
		await expect(highlighted).toContainText('1');
		await expect(highlighted).toContainText('3');
		// And the middle root-level path (Downloads = 2).
		await expect(highlighted).toContainText('2');
	});

	test('Clear All resets multi-select outputs', async ({ page }) => {
		await gotoInteraction(page);
		const card = multiSelectCard(page);

		await nodeContent(nodeInCard(card, '1')).click();
		await nodeContent(nodeInCard(card, '2')).click({ modifiers: ['Control'] });
		await expect(outputValue(card, 'Highlighted')).not.toContainText('(none');

		await card.getByRole('button', { name: 'Clear All' }).click();
		await expect(outputValue(card, 'Highlighted')).toContainText('(none');
	});
});

// ── Keyboard Navigation tree ────────────────────────────────────────────────

test.describe('Keyboard Navigation tree', () => {
	test('ArrowDown moves focus to the next sibling', async ({ page }) => {
		await gotoInteraction(page);
		const card = keyboardNavCard(page);

		// Click first root node to anchor focus inside this tree.
		await nodeContent(nodeInCard(card, '1')).click();

		// Focused Node output is only rendered after navFocusedNode is set.
		await expect(outputValue(card, 'Focused Node')).toContainText('Documents');

		// ArrowDown is wired to navNextSibling — it walks siblings at the same
		// level, not into children. From Documents (1), next sibling is Downloads (2).
		await page.keyboard.press('ArrowDown');

		await expect(outputValue(card, 'Focused Node')).toContainText('Downloads');
		await expect(outputValue(card, 'Focused Node')).toContainText('(2)');
	});

	test('ArrowUp moves focus to the previous sibling', async ({ page }) => {
		await gotoInteraction(page);
		const card = keyboardNavCard(page);

		await nodeContent(nodeInCard(card, '1')).click();
		await page.keyboard.press('ArrowDown');
		await expect(outputValue(card, 'Focused Node')).toContainText('Downloads');

		await page.keyboard.press('ArrowUp');
		await expect(outputValue(card, 'Focused Node')).toContainText('Documents');
	});

	test('ArrowRight descends into a child of the focused node', async ({ page }) => {
		await gotoInteraction(page);
		const card = keyboardNavCard(page);

		await nodeContent(nodeInCard(card, '1')).click();
		await expect(outputValue(card, 'Focused Node')).toContainText('Documents');

		// ArrowRight is wired to navInto — it descends into children when the
		// node is already expanded. Path order vs alpha-sorted display order
		// can disagree here, so just assert that focus landed on *some* child
		// of '1' (level-2 path '1.x').
		await page.keyboard.press('ArrowRight');

		const focused = outputValue(card, 'Focused Node');
		await expect(focused).toContainText(/\(1\.\d+\)/);
	});

	test('clicking a node appends to the navigation log', async ({ page }) => {
		await gotoInteraction(page);
		const card = keyboardNavCard(page);

		await nodeContent(nodeInCard(card, '1')).click();
		await expect(outputValue(card, 'Navigation Log')).toContainText('Documents');
		await expect(outputValue(card, 'Navigation Log')).toContainText('(1)');

		await nodeContent(nodeInCard(card, '2')).click();
		const log = outputValue(card, 'Navigation Log');
		await expect(log).toContainText('Downloads');
		// Earlier entry stays in the log (max 10).
		await expect(log).toContainText('Documents');
	});
});
