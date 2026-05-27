import { chromium, FullConfig } from '@playwright/test';

/**
 * Pre-warm the Vite dev server by visiting every page the test suite uses.
 *
 * Vite compiles routes on demand on first request, and that compilation
 * competes with the page's own startup work (e.g. /examples/search's async
 * FlexSearch indexer, which runs via requestIdleCallback and starves under
 * load). Hitting each route once up-front pushes all the compile cost into
 * setup, so the actual tests see warm caches.
 */
export default async function globalSetup(config: FullConfig) {
	const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:17777';

	const routes = [
		'/test/basic',
		'/test/interaction',
		'/test/search',
		'/test/context-menu',
		'/test/data',
		'/test/performance',
		'/test/member-props',
		'/test/drag-drop',
		'/test/branch-operations',
		'/test/keyboard-nav',
		'/test/expand-collapse'
	];

	const browser = await chromium.launch();
	const page = await browser.newPage();
	for (const route of routes) {
		try {
			await page.goto(`${baseURL}${route}`, { waitUntil: 'load', timeout: 30_000 });
			// Briefly let the page settle so initial $effects / indexer / etc.
			// can fire while we hold the page open.
			await page.waitForTimeout(500);
		} catch {
			// If the page fails to warm we ignore it; the actual test will surface
			// the real error with more context.
		}
	}
	await browser.close();
}
