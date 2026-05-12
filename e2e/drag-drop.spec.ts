import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for /examples/drag-drop.
 *
 * Page has three demos:
 *   1. "Drag Between Trees"      — Source (with 7 nodes) ↔ Target (starts empty)
 *   2. "Restricted Drop Positions" — single tree using allowedDropPositionsMember
 *   3. "Touch Drag (Mobile)"      — single tree for long-press touch drag
 *
 * Native HTML5 drag-and-drop is awkward to synthesize precisely (dataTransfer
 * carries state the drag listeners read), so most tests target the
 * page-level UI (settings, buttons, logs, restricted-position hints) and we
 * attempt one programmatic drag with `dragTo` as a smoke check.
 *
 * The page persists drop-zone settings to localStorage under 'dropZoneConfig';
 * clear before each test for determinism.
 */

const PAGE = '/examples/drag-drop';

// ── Helpers ─────────────────────────────────────────────────────────────────

function cardByHeading(page: Page, heading: string): Locator {
	return page.locator('.card').filter({ has: page.locator('h2', { hasText: heading }) }).first();
}

function dragBetweenCard(page: Page): Locator {
	return cardByHeading(page, 'Drag Between Trees');
}

function restrictedCard(page: Page): Locator {
	return cardByHeading(page, 'Restricted Drop Positions');
}

function sourceTreeContainer(page: Page): Locator {
	// First .tree-container inside the "Drag Between Trees" card.
	return dragBetweenCard(page).locator('.tree-container').nth(0);
}

function targetTreeContainer(page: Page): Locator {
	return dragBetweenCard(page).locator('.tree-container').nth(1);
}

function nodeInContainer(container: Locator, path: string): Locator {
	return container.locator(`.ltree-node[data-tree-path="${path}"]`).first();
}

function nodeContent(node: Locator): Locator {
	return node.locator('> .ltree-node-row .ltree-node-content').first();
}

function activityLog(card: Locator): Locator {
	return card.locator('.output pre').first();
}

async function gotoDragDrop(page: Page) {
	await page.addInitScript(() => {
		try {
			localStorage.removeItem('dropZoneConfig');
		} catch {
			/* nothing to clean if localStorage blocked */
		}
	});
	await page.goto(PAGE);
	// At least one source node must be present before tests proceed.
	await expect(page.locator('.ltree-node').first()).toBeVisible();
}

// ── Drag Between Trees: render + UI ────────────────────────────────────────

test.describe('Drag Between Trees — render and controls', () => {
	test('source tree renders the 7 seed nodes; target tree starts empty', async ({ page }) => {
		await gotoDragDrop(page);

		// Source has 7 items at expandLevel=3 (all visible): paths 1, 1.1, 1.2, 1.3, 2, 2.1, 2.2.
		const source = sourceTreeContainer(page);
		await expect(source.locator('.ltree-node[data-tree-path]')).toHaveCount(7);

		// Target has no nodes; the heading reflects the empty state. (The drop
		// placeholder snippet only renders during an active drag-over.)
		const target = targetTreeContainer(page);
		await expect(target.locator('.ltree-node[data-tree-path]')).toHaveCount(0);
		await expect(dragBetweenCard(page).getByRole('heading', { name: /Target Tree \(Empty/ })).toBeVisible();

		// Activity log section is hidden when log is empty.
		await expect(dragBetweenCard(page).locator('.output pre')).toHaveCount(0);
	});

	test('Reset Target Tree populates the target with the seeded 100-node hierarchy', async ({
		page
	}) => {
		await gotoDragDrop(page);

		await dragBetweenCard(page).getByRole('button', { name: 'Reset Target Tree' }).click();

		// expandLevel=3 + the seed creates 10 roots × (1 + 3 + ~6 deeper) — we only
		// need to assert that the placeholder is gone and *some* nodes exist.
		const target = targetTreeContainer(page);
		await expect(target.getByText('Drop items here to add them')).toHaveCount(0);
		const nodeCount = await target.locator('.ltree-node[data-tree-path]').count();
		expect(nodeCount).toBeGreaterThan(50);

		// Activity log gets an entry.
		await expect(activityLog(dragBetweenCard(page))).toContainText('Reset target tree');
	});

	test('Clear Target Tree empties the target again', async ({ page }) => {
		await gotoDragDrop(page);

		const card = dragBetweenCard(page);
		await card.getByRole('button', { name: 'Reset Target Tree' }).click();
		await expect(targetTreeContainer(page).locator('.ltree-node').first()).toBeVisible();

		await card.getByRole('button', { name: 'Clear Target Tree' }).click();
		await expect(
			targetTreeContainer(page).locator('.ltree-node[data-tree-path]')
		).toHaveCount(0);
		await expect(activityLog(card)).toContainText('Cleared target tree');
	});

	test('Clear Log hides the activity log section', async ({ page }) => {
		await gotoDragDrop(page);

		const card = dragBetweenCard(page);
		// Generate a log entry first.
		await card.getByRole('button', { name: 'Reset Target Tree' }).click();
		await expect(activityLog(card)).toContainText('Reset target tree');

		await card.getByRole('button', { name: 'Clear Log' }).click();

		// {#if activityLog.length > 0} unmounts the whole <div class="output">.
		await expect(card.locator('.output pre')).toHaveCount(0);
	});

	test('switching dropZoneMode to "floating" reveals extra layout controls', async ({ page }) => {
		await gotoDragDrop(page);
		const card = dragBetweenCard(page);

		// Default is 'glow'; floating-specific controls are hidden.
		await expect(card.getByLabel('Layout:')).toHaveCount(0);

		await card.getByLabel('Drop Zone Mode:').selectOption('floating');
		await expect(card.getByLabel('Layout:')).toBeVisible();
		await expect(card.getByLabel('Zone Start:')).toBeVisible();
		await expect(card.getByLabel('Max Width (px):')).toBeVisible();
	});

	test('"Allow Ctrl+drag to copy" toggles and persists in localStorage', async ({ page }) => {
		await gotoDragDrop(page);
		const card = dragBetweenCard(page);

		// Locate the checkbox by its visible label text — bind:checked drives the prop.
		const copyToggle = card.getByLabel('Allow Ctrl+drag to copy');
		await expect(copyToggle).not.toBeChecked();

		await copyToggle.check();
		await expect(copyToggle).toBeChecked();

		// Settings $effect writes to localStorage synchronously after the state flips.
		await expect
			.poll(async () => {
				return await page.evaluate(() => localStorage.getItem('dropZoneConfig'));
			})
			.toContain('"allowCopy":true');
	});
});

// ── Restricted Drop Positions ──────────────────────────────────────────────

test.describe('Restricted Drop Positions tree', () => {
	test('renders the allowed-positions hint next to nodes that have them', async ({ page }) => {
		await gotoDragDrop(page);
		const card = restrictedCard(page);

		// Trash (path 1) only allows 'child'.
		const trash = nodeInContainer(card, '1');
		await expect(trash).toContainText('Trash');
		await expect(trash).toContainText('(child)');

		// Readme (path 3) only allows before/after.
		const readme = nodeInContainer(card, '3');
		await expect(readme).toContainText('Readme.md');
		await expect(readme).toContainText('(before/after)');

		// Projects (path 2) has no allowedDropPositions field — no hint rendered.
		const projects = nodeInContainer(card, '2');
		await expect(projects).toContainText('Projects');
		// No '(' opening for the hint span on this row.
		const projectsHint = projects.locator('> .ltree-node-row small');
		await expect(projectsHint).toHaveCount(0);
	});
});

// ── Drag smoke test ────────────────────────────────────────────────────────

test.describe('Drag interaction — smoke', () => {
	test('dragging File A onto File B inside the source tree fires the drop handler', async ({
		page
	}) => {
		await gotoDragDrop(page);
		const card = dragBetweenCard(page);
		const source = sourceTreeContainer(page);

		const fileA = nodeContent(nodeInContainer(source, '1.1')); // File A
		const fileB = nodeContent(nodeInContainer(source, '1.2')); // File B

		// Playwright's dragTo fires native dragstart/dragover/drop events with a
		// real DataTransfer payload. The component's onNodeDrop handler logs to
		// the activity feed when a drop completes successfully.
		await fileA.dragTo(fileB);

		// Drop handlers log the action; the exact text depends on which position
		// the drop is rounded to, so only assert that a log line appears mentioning
		// File A as the dragged subject.
		await expect(activityLog(card)).toContainText('File A');
	});
});
