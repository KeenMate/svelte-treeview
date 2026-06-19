import { test, expect, Page, Locator } from '@playwright/test';

/**
 * E2E coverage for /test/performance (minimal fixture page; /examples/performance
 * is the full benchmark playground with the same controls plus persistence,
 * countries-data loader, and timing metrics).
 *
 * This page is the benchmark playground: three render modes (recursive / flat
 * / virtual), a synthetic data generator, configurable node count and expand
 * level, plus search and timing of updateNode / expandAll / etc. The point of
 * these tests is *not* to measure performance — they're correctness smoke
 * tests that catch regressions in the controls and tree behavior across modes.
 *
 * The page persists config to localStorage under 'svelte-treeview-perf-config'.
 * Every test clears that key first so we don't inherit a previous run's
 * 50k-node setting. Tests run serially within the file so the heavy renders
 * don't compete for the shared dev server.
 *
 * Each test generates a small dataset (~300-target → 273 actual nodes) for
 * speed. The synthetic generator builds a 3-level hierarchy
 * (Engineering / Sales / … → Alpha Team / Beta Squad / … → Member 1 / …) so
 * the node count isn't exactly the target — see `readNodeCount()`.
 *
 * The "Load Countries + States" button hits an external GitHub raw URL — we
 * never click it from tests so the suite stays offline-friendly.
 */

// Long per-test timeout for this file: a single test runs Generate (which
// mounts ~273 nodes + builds the search index), Expand/Collapse cycles, and
// search assertions with up to ACTION_TIMEOUT each. The project-wide 45s
// ceiling clips that under parallel-worker dev-server load.
test.describe.configure({ mode: 'serial', timeout: 120_000 });

const PAGE = '/test/performance';
const STORAGE_KEY = 'svelte-treeview-perf-config';
const TARGET_NODE_COUNT = 300;

// /test/performance does a lot under parallel-worker dev-server load: ~273
// Tree nodes mount + the async search indexer + Svelte's first-mount work
// per route. The default 10s expect.poll / assertion timeouts are too tight
// for these specific waits, and the failures aren't real regressions — they
// just need more headroom. Bump them across the file via this constant.
const ACTION_TIMEOUT = 30_000;

// ── Helpers ─────────────────────────────────────────────────────────────────

function cardByHeading(page: Page, heading: string): Locator {
	return page.locator('.card').filter({ has: page.locator('h2', { hasText: heading }) }).first();
}

function configCard(page: Page): Locator {
	return cardByHeading(page, 'Configuration');
}

function modeCard(page: Page): Locator {
	return cardByHeading(page, 'Rendering Mode');
}

function metricsCard(page: Page): Locator {
	return cardByHeading(page, 'Performance Metrics');
}

/** The data card mounts only after `treeData.length > 0`. Title pattern is e.g. "Synthetic Data (300 nodes) - Flat Mode". */
function dataCard(page: Page): Locator {
	return page.locator('.card').filter({ has: page.locator('h2', { hasText: /(Synthetic Data|Countries \+ States)/ }) }).first();
}

function treeContainer(page: Page): Locator {
	return dataCard(page).locator('.tree-container').first();
}

function metricValue(page: Page, label: string): Locator {
	return metricsCard(page)
		.locator('.metric')
		.filter({ has: page.locator('.label', { hasText: new RegExp(`^${label}$`) }) })
		.first()
		.locator('.value')
		.first();
}

/** Read the actual generated node count from the Nodes metric, e.g. "273". */
async function readNodeCount(page: Page): Promise<number> {
	return parseDigits((await metricValue(page, 'Nodes').textContent()) ?? '0');
}

/**
 * Strip locale separators (commas, spaces, non-breaking spaces) and return the
 * remaining digits as a number. Needed because the Playwright runner and the
 * browser may render different locales for the same value (e.g. "1,000" vs
 * "1 000"), so any text-equality assertion has to normalize first.
 */
function parseDigits(s: string): number {
	return Number(s.replace(/[^0-9]/g, '')) || 0;
}

async function visibleNodeCount(page: Page): Promise<number> {
	return treeContainer(page).locator('.stv__node').count();
}

/**
 * Configure the target dataset and click "Generate <N> Nodes". The generator's
 * 3-level hierarchy doesn't hit the target exactly, so callers read the actual
 * count from the metric instead of assuming.
 */
async function generate(page: Page, target: number = TARGET_NODE_COUNT) {
	const generateBtn = configCard(page).getByRole('button', { name: /^Generate / });
	await configCard(page).getByLabel('Node Count:').fill(String(target));
	// The button label reads "Generate <count> Nodes" from the bound state.
	// Wait for the label to reflect the new target before clicking — that
	// proves Svelte has applied the bind:value change and the click won't
	// fire generateTestData with a stale `nodeCountTarget`. Compare on raw
	// digits to dodge locale formatting (browser may render '1,000' while the
	// runner's `toLocaleString` produces '1 000').
	await expect
		.poll(async () => parseDigits((await generateBtn.textContent()) ?? ''), {
			timeout: ACTION_TIMEOUT
		})
		.toBe(target);
	await generateBtn.click();
	// Cold-load of /test/performance + first-time generate of a few hundred
	// nodes can push past the default 20s on a loaded dev server. Give the
	// data card a longer window before failing the test.
	await expect(treeContainer(page)).toBeVisible({ timeout: 60_000 });
	await expect.poll(() => visibleNodeCount(page), { timeout: ACTION_TIMEOUT }).toBeGreaterThan(0);
}

async function gotoPerformance(page: Page) {
	await page.addInitScript((key) => {
		try {
			localStorage.removeItem(key);
		} catch {
			/* localStorage can be blocked in some contexts. */
		}
	}, STORAGE_KEY);
	await page.goto(PAGE);
	await expect(page.locator('h1', { hasText: 'Performance Test' })).toBeVisible();
}

// ── Initial state ──────────────────────────────────────────────────────────

test.describe('Initial state', () => {
	test('renders controls and metrics cards, no tree until Generate is clicked', async ({ page }) => {
		await gotoPerformance(page);

		await expect(modeCard(page)).toBeVisible();
		await expect(configCard(page)).toBeVisible();
		await expect(metricsCard(page)).toBeVisible();

		await expect(metricValue(page, 'Nodes')).toHaveText('0');

		// Data card only mounts after data is loaded.
		await expect(dataCard(page)).toHaveCount(0);

		// Redraw / Clear are disabled with no data.
		await expect(configCard(page).getByRole('button', { name: 'Redraw' })).toBeDisabled();
		await expect(configCard(page).getByRole('button', { name: 'Clear' })).toBeDisabled();
	});
});

// ── Generate / Clear / Redraw ──────────────────────────────────────────────

test.describe('Data lifecycle', () => {
	test('Generate populates the tree; Nodes metric matches the data card title', async ({ page }) => {
		await gotoPerformance(page);
		await generate(page);

		const generated = await readNodeCount(page);
		expect(generated).toBeGreaterThan(0);

		// The data card title carries the same count (rendered as "(<N> nodes)").
		// Compare on raw digits — see the note in `generate()` for the locale gotcha.
		const titleText = (await dataCard(page).locator('h2').textContent()) ?? '';
		expect(parseDigits(titleText)).toBe(generated);
	});

	test('Clear empties the tree and resets metrics', async ({ page }) => {
		await gotoPerformance(page);
		await generate(page);

		await configCard(page).getByRole('button', { name: 'Clear' }).click();

		await expect(dataCard(page)).toHaveCount(0);
		await expect(metricValue(page, 'Nodes')).toHaveText('0');
		await expect(configCard(page).getByRole('button', { name: 'Clear' })).toBeDisabled();
	});

	test('Redraw keeps the data but re-mounts the tree', async ({ page }) => {
		await gotoPerformance(page);
		await generate(page);

		const before = await visibleNodeCount(page);
		await configCard(page).getByRole('button', { name: 'Redraw' }).click();
		// Tree re-mounts via {#key treeKey}.
		await expect(treeContainer(page)).toBeVisible({ timeout: ACTION_TIMEOUT });
		await expect.poll(() => visibleNodeCount(page), { timeout: ACTION_TIMEOUT }).toBe(before);
	});
});

// ── Render modes ───────────────────────────────────────────────────────────

test.describe('Render modes', () => {
	test('switching from Flat (default) to Recursive re-renders the tree', async ({ page }) => {
		await gotoPerformance(page);
		await generate(page);

		await expect(dataCard(page).locator('h2')).toContainText('Flat Mode');

		await modeCard(page).getByText('Recursive', { exact: true }).click();
		await expect(dataCard(page).locator('h2')).toContainText('Recursive Mode', {
			timeout: ACTION_TIMEOUT
		});
		await expect.poll(() => visibleNodeCount(page), { timeout: ACTION_TIMEOUT }).toBeGreaterThan(0);
	});

	test('switching to Virtual mode renders only a windowed subset of nodes', async ({ page }) => {
		await gotoPerformance(page);
		// Larger dataset makes the virtual-vs-full contrast obvious.
		await generate(page, 1000);

		const fullCount = await visibleNodeCount(page);

		await modeCard(page).getByText('Virtual Scroll', { exact: true }).click();
		await expect(dataCard(page).locator('h2')).toContainText('Virtual Scroll', {
			timeout: ACTION_TIMEOUT
		});

		// Virtual mode only renders the rows that fit the container + overscan,
		// so the DOM count drops well below the full tree.
		await expect.poll(() => visibleNodeCount(page), { timeout: ACTION_TIMEOUT }).toBeLessThan(fullCount);
		await expect.poll(() => visibleNodeCount(page), { timeout: ACTION_TIMEOUT }).toBeGreaterThan(0);
	});
});

// ── Expand / Collapse buttons ──────────────────────────────────────────────

test.describe('Expand / Collapse', () => {
	test('Expand All reveals every level; Collapse All hides children', async ({ page }) => {
		await gotoPerformance(page);
		await generate(page);

		const initial = await visibleNodeCount(page);

		await dataCard(page).getByRole('button', { name: 'Expand All' }).click();
		await expect.poll(() => visibleNodeCount(page), { timeout: ACTION_TIMEOUT }).toBeGreaterThan(initial);

		await dataCard(page).getByRole('button', { name: 'Collapse All' }).click();
		await expect.poll(() => visibleNodeCount(page), { timeout: ACTION_TIMEOUT }).toBeLessThan(initial);
	});

	test('Expand One adds rows; Collapse One drops below the baseline', async ({ page }) => {
		await gotoPerformance(page);
		await generate(page);

		const baseline = await visibleNodeCount(page);

		await dataCard(page).getByRole('button', { name: 'Expand One' }).click();
		await expect.poll(() => visibleNodeCount(page), { timeout: ACTION_TIMEOUT }).toBeGreaterThan(baseline);

		await dataCard(page).getByRole('button', { name: 'Collapse One' }).click();
		await expect.poll(() => visibleNodeCount(page), { timeout: ACTION_TIMEOUT }).toBeLessThan(baseline);
	});
});

// ── Search ─────────────────────────────────────────────────────────────────

test.describe('Search / Filter', () => {
	test('filter mode: typing a department name shows a search counter', async ({ page }) => {
		await gotoPerformance(page);
		await generate(page);

		const card = dataCard(page);
		const input = card.locator('input.search-input').first();

		// 'Engineering' is the first department generated, always indexed.
		await input.fill('Engineering');

		// Counter shows N/M once the async indexer returns.
		await expect(card.locator('.search-counter')).toContainText('/', { timeout: ACTION_TIMEOUT });

		// At least one node with 'Engineering' in its label survives the filter.
		await expect(treeContainer(page).locator('.stv__node-content', { hasText: 'Engineering' }).first()).toBeVisible({ timeout: ACTION_TIMEOUT });
	});

	test('Escape clears the search and removes the counter', async ({ page }) => {
		await gotoPerformance(page);
		await generate(page);

		const card = dataCard(page);
		const input = card.locator('input.search-input').first();

		await input.fill('Engineering');
		await expect(card.locator('.search-counter')).toBeVisible({ timeout: ACTION_TIMEOUT });

		await input.press('Escape');
		await expect(input).toHaveValue('');
		await expect(card.locator('.search-counter')).toHaveCount(0);
	});
});
