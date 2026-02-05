/**
 * Logging configuration using loglevel with categorized loggers
 *
 * Categories:
 * - LTREE:INIT: Tree initialization and configuration
 * - LTREE:DATA: Data insertion, tree manipulation, node operations
 * - LTREE:RENDER: Rendering, progressive rendering, coordinator
 * - LTREE:INDEX: Search indexing operations
 * - LTREE:DRAG: Drag and drop operations
 *
 * Usage:
 * - By default, all logging is disabled (silent mode) for production
 * - Enable logging in browser console:
 *   ```javascript
 *   import { enableLogging, setLogLevel, setCategoryLevel } from '@keenmate/svelte-treeview';
 *
 *   // Enable all logging at debug level
 *   enableLogging();
 *
 *   // Or set a specific log level for all categories
 *   setLogLevel('info');  // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'
 *
 *   // Or enable/disable specific categories
 *   disableLogging();  // First disable all
 *   setCategoryLevel('LTREE:RENDER', 'debug');  // Enable only render logs
 *   setCategoryLevel('LTREE:INDEX', 'info');  // Enable only index logs at info level
 *   ```
 */

// Import vendored libraries via ES module wrappers
// @ts-ignore - Vendored library without type definitions
import log from './vendor/loglevel/index.js';
// @ts-ignore - Vendored library without type definitions
import prefix from './vendor/loglevel/prefix.js';

// Define color scheme
const COLORS: Record<string, string> = {
    trace: '#9ca3af',  // Gray
    debug: '#0ea5e9',  // Blue
    info: '#10b981',   // Green
    warn: '#f59e0b',   // Orange
    error: '#ef4444'   // Red
};

// Logger categories documentation:
// - LTREE:INIT: Tree initialization and configuration
// - LTREE:DATA: Data insertion, tree manipulation, node operations
// - LTREE:RENDER: Rendering, progressive rendering, coordinator
// - LTREE:INDEX: Search indexing operations
// - LTREE:DRAG: Drag and drop operations
// - LTREE:UI: User interactions (click, expand/collapse, selection)

// Register prefix plugin with the root logger
prefix.reg(log);

// Set default log level to silent (production mode)
log.setLevel('silent');

// Prefix format options that include %c markers
const prefixOptions = {
    format(level: string, name: string | undefined, timestamp: string) {
        return `%c[${timestamp}]%c %c[${level.toUpperCase()}]%c %c[${name}]%c`;
    },
    timestampFormatter(date: Date) {
        return date.toTimeString().split(' ')[0] + '.' + date.getMilliseconds().toString().padStart(3, '0');
    }
};

/**
 * Create a color-aware method factory that intercepts %c codes and adds CSS styles
 */
function createColorMethodFactory(originalFactory: any) {
    return function(methodName: string, logLevel: number, loggerName: string) {
        const rawMethod = originalFactory(methodName, logLevel, loggerName);

        return function(...args: any[]) {
            // If first arg contains %c color codes, inject the color styles
            if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('%c')) {
                const color = COLORS[methodName] || '#666';
                // Count how many %c markers we have (should be 6 for our format)
                const numMarkers = (args[0].match(/%c/g) || []).length;
                const colorStyles: string[] = [];
                for (let i = 0; i < numMarkers; i++) {
                    // Alternate between color and reset
                    colorStyles.push(i % 2 === 0 ? `color: ${color}; font-weight: bold;` : 'color: inherit;');
                }
                rawMethod(args[0], ...colorStyles, ...args.slice(1));
            } else {
                rawMethod(...args);
            }
        };
    };
}

// Create category-specific loggers
export const initLogger = log.getLogger('LTREE:INIT');
export const dataLogger = log.getLogger('LTREE:DATA');
export const renderLogger = log.getLogger('LTREE:RENDER');
export const indexLogger = log.getLogger('LTREE:INDEX');
export const dragLogger = log.getLogger('LTREE:DRAG');
export const uiLogger = log.getLogger('LTREE:UI');

// Apply prefix and color styling to all category loggers
const allLoggers = [
    initLogger,
    dataLogger,
    renderLogger,
    indexLogger,
    dragLogger,
    uiLogger
];

allLoggers.forEach(logger => {
    // First wrap the methodFactory with color injection
    // This needs to happen BEFORE prefix.apply so the prefix plugin's
    // output (which contains %c codes) goes through our color handler
    const originalFactory = logger.methodFactory;
    logger.methodFactory = createColorMethodFactory(originalFactory);

    // Now apply prefix - it will wrap our color-aware methodFactory
    prefix.apply(logger, prefixOptions);

    // Set level to rebuild methods
    logger.setLevel('silent');
});

// Export the default logger
export default log;

/**
 * List of all logging categories
 */
export const LOGGING_CATEGORIES = [
    'LTREE:INIT',
    'LTREE:DATA',
    'LTREE:RENDER',
    'LTREE:INDEX',
    'LTREE:DRAG',
    'LTREE:UI'
];

/**
 * Enable logging for all loggers
 */
export const setLogLevel = (level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent') => {
    log.setLevel(level);
    allLoggers.forEach(logger => logger.setLevel(level));
};

/**
 * Enable all logging (set to debug level)
 */
export const enableLogging = () => {
    setLogLevel('debug');
};

/**
 * Disable all logging (set to silent level)
 */
export const disableLogging = () => {
    setLogLevel('silent');
};

/**
 * Set log level for a specific category
 */
export const setCategoryLevel = (
    category: 'LTREE:INIT' | 'LTREE:DATA' | 'LTREE:RENDER' | 'LTREE:INDEX' | 'LTREE:DRAG' | 'LTREE:UI',
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent' = 'debug'
) => {
    const loggerMap: Record<string, typeof initLogger> = {
        'LTREE:INIT': initLogger,
        'LTREE:DATA': dataLogger,
        'LTREE:RENDER': renderLogger,
        'LTREE:INDEX': indexLogger,
        'LTREE:DRAG': dragLogger,
        'LTREE:UI': uiLogger
    };
    loggerMap[category]?.setLevel(level);
};
