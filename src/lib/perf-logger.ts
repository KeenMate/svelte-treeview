/**
 * Performance logging for svelte-treeview
 *
 * Provides timing utilities for measuring key operations:
 * - insertArray phases (conversion, sort, insert)
 * - filterNodes
 * - expandAll/collapseAll
 * - search indexing
 * - rendering
 *
 * Usage:
 *   import { perfLogger, enablePerfLogging } from '@keenmate/svelte-treeview';
 *
 *   // Enable performance logging
 *   enablePerfLogging();
 *
 *   // Or set minimum threshold (only log operations slower than X ms)
 *   setPerfThreshold(10); // Only log operations taking >10ms
 */

import log from './vendor/loglevel/index.js';
import prefix from './vendor/loglevel/prefix.js';
import type { Logger } from './vendor/loglevel/index.js';

// Performance logger instance
export const perfLogger: Logger = log.getLogger('LTREE:PERF');

// Threshold for logging (0 = log everything)
let perfThreshold = 0;

// Color for performance logs
const PERF_COLOR = '#a855f7'; // Purple

// Apply prefix styling
const prefixOptions = {
    format(level: string, name: string | undefined, timestamp: string) {
        return `%c[${timestamp}]%c %c[PERF]%c`;
    },
    timestampFormatter(date: Date) {
        return date.toTimeString().split(' ')[0] + '.' + date.getMilliseconds().toString().padStart(3, '0');
    }
};

// Create color-aware method factory
function createPerfMethodFactory(originalFactory: any) {
    return function(methodName: string, logLevel: number, loggerName: string) {
        const rawMethod = originalFactory(methodName, logLevel, loggerName);

        return function(...args: any[]) {
            if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('%c')) {
                const numMarkers = (args[0].match(/%c/g) || []).length;
                const colorStyles: string[] = [];
                for (let i = 0; i < numMarkers; i++) {
                    colorStyles.push(i % 2 === 0 ? `color: ${PERF_COLOR}; font-weight: bold;` : 'color: inherit;');
                }
                rawMethod(args[0], ...colorStyles, ...args.slice(1));
            } else {
                rawMethod(...args);
            }
        };
    };
}

// Initialize the performance logger
const originalFactory = perfLogger.methodFactory;
perfLogger.methodFactory = createPerfMethodFactory(originalFactory);
prefix.reg(log);
prefix.apply(perfLogger, prefixOptions);
perfLogger.setLevel('silent'); // Disabled by default

/**
 * Active timers storage
 */
const activeTimers: Map<string, { start: number; metadata?: Record<string, any> }> = new Map();

/**
 * Start a performance timer
 * @param label - Unique label for the timer
 * @param metadata - Optional metadata to include in the log
 */
export function perfStart(label: string, metadata?: Record<string, any>): void {
    activeTimers.set(label, { start: performance.now(), metadata });
}

/**
 * End a performance timer and log the result
 * @param label - Label of the timer to end
 * @param itemCount - Optional item count for calculating items/sec
 * @returns Duration in milliseconds
 */
export function perfEnd(label: string, itemCount?: number): number {
    const timer = activeTimers.get(label);
    if (!timer) {
        perfLogger.warn(`Timer "${label}" not found`);
        return 0;
    }

    const duration = performance.now() - timer.start;
    activeTimers.delete(label);

    // Skip logging if below threshold
    if (duration < perfThreshold) {
        return duration;
    }

    // Build log message
    let message = `${label}: ${formatDuration(duration)}`;

    if (itemCount !== undefined && itemCount > 0) {
        const perItem = duration / itemCount;
        const itemsPerSec = 1000 / perItem;
        message += ` | ${itemCount.toLocaleString()} items | ${formatDuration(perItem)}/item | ${formatNumber(itemsPerSec)} items/sec`;
    }

    if (timer.metadata) {
        message += ` | ${JSON.stringify(timer.metadata)}`;
    }

    perfLogger.info(message);

    return duration;
}

/**
 * Measure a synchronous function and log the result
 * @param label - Label for the measurement
 * @param fn - Function to measure
 * @param itemCount - Optional item count
 * @returns The function's return value
 */
export function perfMeasure<T>(label: string, fn: () => T, itemCount?: number): T {
    perfStart(label);
    const result = fn();
    perfEnd(label, itemCount);
    return result;
}

/**
 * Measure an async function and log the result
 * @param label - Label for the measurement
 * @param fn - Async function to measure
 * @param itemCount - Optional item count
 * @returns Promise with the function's return value
 */
export async function perfMeasureAsync<T>(label: string, fn: () => Promise<T>, itemCount?: number): Promise<T> {
    perfStart(label);
    const result = await fn();
    perfEnd(label, itemCount);
    return result;
}

/**
 * Log a performance summary with multiple timings
 */
export function perfSummary(treeId: string, timings: Record<string, number>, totalItems?: number): void {
    const total = Object.values(timings).reduce((a, b) => a + b, 0);

    if (total < perfThreshold) {
        return;
    }

    let message = `[${treeId}] Performance Summary:\n`;

    for (const [label, duration] of Object.entries(timings)) {
        const percentage = ((duration / total) * 100).toFixed(1);
        message += `  ${label}: ${formatDuration(duration)} (${percentage}%)\n`;
    }

    message += `  TOTAL: ${formatDuration(total)}`;

    if (totalItems !== undefined) {
        message += ` | ${totalItems.toLocaleString()} items | ${formatDuration(total / totalItems)}/item`;
    }

    perfLogger.info(message);
}

/**
 * Format duration for display
 */
function formatDuration(ms: number): string {
    if (ms < 1) {
        return `${(ms * 1000).toFixed(2)}µs`;
    } else if (ms < 1000) {
        return `${ms.toFixed(2)}ms`;
    } else {
        return `${(ms / 1000).toFixed(2)}s`;
    }
}

/**
 * Format large numbers with commas
 */
function formatNumber(num: number): string {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

/**
 * Enable performance logging
 */
export function enablePerfLogging(): void {
    perfLogger.setLevel('info');
}

/**
 * Disable performance logging
 */
export function disablePerfLogging(): void {
    perfLogger.setLevel('silent');
}

/**
 * Set minimum threshold for logging (only log operations slower than threshold)
 * @param thresholdMs - Threshold in milliseconds (0 = log everything)
 */
export function setPerfThreshold(thresholdMs: number): void {
    perfThreshold = thresholdMs;
}

/**
 * Get current performance logging state
 */
export function isPerfLoggingEnabled(): boolean {
    return perfLogger.getLevel() <= 2; // 2 = INFO level
}
