/**
 * Global render coordinator for progressive rendering.
 * Manages a single render loop that processes all pending node renders
 * instead of each node having its own RAF loop.
 */

import { renderLogger } from '../logger.js';

type RenderCallback = () => boolean; // Returns true if more rendering needed

export interface RenderStats {
	pending: number;
	processed: number;
}

export interface RenderCoordinatorCallbacks {
	onStart?: () => void;
	onProgress?: (stats: RenderStats) => void;
	onComplete?: (stats: RenderStats) => void;
}

export interface RenderCoordinator {
	/** Register a node's render callback. Returns an unregister function. */
	register(id: string, callback: RenderCallback): () => void;
	/** Check if coordinator is actively rendering */
	isActive(): boolean;
	/** Get stats for debugging */
	getStats(): RenderStats;
	/** Check if a node path was already fully rendered */
	isCompleted(id: string): boolean;
	/** Reset completed state (e.g., when tree data changes) */
	reset(): void;
}

export function createRenderCoordinator(
	batchSize: number = 100,
	callbacks?: RenderCoordinatorCallbacks
): RenderCoordinator {
	const pendingNodes = new Map<string, RenderCallback>();
	const completedNodes = new Set<string>(); // Track nodes that finished rendering
	let rafId: number | null = null;
	let isProcessing = false;
	let processedCount = 0;
	let wasActive = false;

	function scheduleProcess() {
		if (rafId !== null || pendingNodes.size === 0) return;

		rafId = requestAnimationFrame(() => {
			rafId = null;
			processFrame();
		});
	}

	function processFrame() {
		const frameStart = performance.now();

		if (pendingNodes.size === 0) {
			if (wasActive) {
				isProcessing = false;
				wasActive = false;
				callbacks?.onComplete?.({ pending: 0, processed: processedCount });
			}
			return;
		}

		// Notify start on first frame
		if (!wasActive) {
			wasActive = true;
			processedCount = 0;
			callbacks?.onStart?.();
		}

		isProcessing = true;
		let budget = batchSize;
		const toRemove: string[] = [];

		renderLogger.trace(`Frame start: pending=${pendingNodes.size}, budget=${budget}`);

		// Process nodes until budget is exhausted
		for (const [id, callback] of pendingNodes) {
			if (budget <= 0) break;

			const callbackStart = performance.now();
			const needsMore = callback();
			const callbackTime = performance.now() - callbackStart;

			if (callbackTime > 10) {
				renderLogger.warn(`Slow callback: ${id} took ${callbackTime.toFixed(2)}ms`);
			}

			budget--;
			processedCount++;

			if (!needsMore) {
				toRemove.push(id);
			}
		}

		// Remove completed nodes and mark them as done
		for (const id of toRemove) {
			pendingNodes.delete(id);
			completedNodes.add(id);
		}

		const frameTime = performance.now() - frameStart;
		renderLogger.trace(`Frame end: processed ${batchSize - budget} nodes in ${frameTime.toFixed(2)}ms`);

		// Notify progress
		callbacks?.onProgress?.({ pending: pendingNodes.size, processed: processedCount });

		// Schedule next frame if there's more work
		if (pendingNodes.size > 0) {
			scheduleProcess();
		} else {
			isProcessing = false;
			wasActive = false;
			callbacks?.onComplete?.({ pending: 0, processed: processedCount });
		}
	}

	return {
		register(id: string, callback: RenderCallback) {
			// Skip if this node was already fully rendered
			if (completedNodes.has(id)) {
				return () => {}; // No-op unregister
			}

			pendingNodes.set(id, callback);
			scheduleProcess();

			// Return unregister function
			return () => {
				pendingNodes.delete(id);
			};
		},

		isActive() {
			return isProcessing || pendingNodes.size > 0;
		},

		getStats() {
			return {
				pending: pendingNodes.size,
				processed: processedCount
			};
		},

		isCompleted(id: string) {
			return completedNodes.has(id);
		},

		reset() {
			// Clear completed tracking when tree data changes
			completedNodes.clear();
			pendingNodes.clear();
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
			isProcessing = false;
			wasActive = false;
			processedCount = 0;
		}
	};
}
